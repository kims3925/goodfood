import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { analyzeProductContent } from '@/lib/gemini-ai'
import { getAliExpressAPI } from '@/lib/ali-express-api'
import { getExchangeRate, parsePricingPolicy, calculateAliExpressPrice } from '@/lib/utils/currency'

// 콘텐츠 정화 함수 (Band 패턴 재사용)
function sanitizeContent(content: string | null | undefined): string {
  if (!content) return ''

  try {
    let sanitized = content.toString()
    sanitized = sanitized.replace(/\\/g, '')
    sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    sanitized = sanitized.replace(/\x00/g, '')
    sanitized = sanitized.replace(/['"`]/g, '')
    sanitized = sanitized.replace(/[\uFFF0-\uFFFF]/g, '')
    sanitized = sanitized.replace(/\s+/g, ' ')

    if (sanitized.length > 5000) {
      sanitized = sanitized.substring(0, 5000) + '...'
    }

    return sanitized.trim()
  } catch (error) {
    console.error('콘텐츠 정화 중 오류 발생:', error)
    return content?.toString()
      .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ0-9]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000) || ''
  }
}

// 문자열 유사도 계산 (Jaccard 유사도 - Band 패턴 재사용)
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0

  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(word => word.length > 1))
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(word => word.length > 1))

  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { sourcingId, keyword, maxProducts = 20 } = await request.json()

    if (!sourcingId) {
      return NextResponse.json({
        success: false,
        error: 'AliExpress 소싱 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 실제 사용자 ID 찾기
    let actualUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    })

    if (!actualUser) {
      actualUser = await prisma.user.findUnique({
        where: { email: session.user.email || '' },
        select: { id: true }
      })
    }

    if (!actualUser) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 해당 소싱 설정이 사용자의 것인지 확인
    const sourcing = await prisma.aliExpressSourcing.findFirst({
      where: {
        id: sourcingId,
        userId: actualUser.id
      },
      select: {
        id: true,
        searchValue: true,
        pricingPolicy: true,
        collectReviews: true
      }
    })

    if (!sourcing) {
      return NextResponse.json({
        success: false,
        error: '해당 소싱 설정에 접근할 수 없습니다.'
      }, { status: 403 })
    }

    console.log(`🔍 AliExpress 상품 검색 시작: ${keyword || sourcing.searchValue}`)

    // AliExpress API 클라이언트 초기화
    const aliExpressAPI = getAliExpressAPI()

    // 상품 검색 실행
    const searchResult = await aliExpressAPI.searchProducts({
      keyword: keyword || sourcing.searchValue,
      pageSize: maxProducts,
      page: 1
    })

    if (!searchResult.success || searchResult.products.length === 0) {
      return NextResponse.json({
        success: true,
        message: '검색 결과가 없습니다.',
        totalFound: 0,
        newPosts: 0,
        posts: []
      })
    }

    console.log(`✅ AliExpress 검색 결과: ${searchResult.products.length}개 상품 발견`)

    // 환율 조회 (캐싱 1시간)
    const exchangeRateResult = await getExchangeRate()
    console.log(`💰 현재 환율: ${exchangeRateResult.rate} KRW/USD ${exchangeRateResult.isDefault ? '(기본값)' : '(실시간)'}`)

    // 기본 환율 사용 시 경고
    if (exchangeRateResult.isDefault && exchangeRateResult.message) {
      console.warn(`⚠️ ${exchangeRateResult.message}`)
    }

    // 가격정책 파싱
    const pricingPolicy = parsePricingPolicy(sourcing.pricingPolicy || '', exchangeRateResult.rate)
    console.log(`📋 가격정책 적용: 환율 ${pricingPolicy.exchangeRate}원, 마진 ${pricingPolicy.marginPercent}%`)

    // 5단계 중복 제거 프로세스
    console.log('🔄 5단계 중복 제거 프로세스 시작...')

    // 1단계: productId 기반 중복 체크 (DB 대량 조회)
    const productIds = searchResult.products.map(p => p.productId)
    const existingProducts = await prisma.aliExpressProduct.findMany({
      where: {
        productId: { in: productIds },
        sourcingId: sourcing.id
      },
      select: { productId: true, productTitle: true }
    })

    const existingProductIds = new Set(existingProducts.map(p => p.productId))
    console.log(`🔍 1단계: DB에서 기존 상품 ${existingProducts.length}개 확인됨`)

    // 2단계: 제목 유사도 기반 중복 제거 (API 단계)
    const uniqueProducts = []
    const seenTitles = new Set<string>()
    const seenImages = new Set<string>()

    for (const product of searchResult.products) {
      // 1단계: productId 기반 중복 체크
      if (existingProductIds.has(product.productId)) {
        console.log(`🔄 이미 수집됨 (productId): ${product.productId}`)
        continue
      }

      // 2단계: 제목 기반 중복 체크
      const cleanTitle = product.productTitle
        .toLowerCase()
        .replace(/[0-9$.,\-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      if (cleanTitle && cleanTitle.length > 10 && seenTitles.has(cleanTitle)) {
        console.log(`🔄 제목 중복 상품 건너뜀: ${cleanTitle.slice(0, 30)}...`)
        continue
      }

      // 3단계: 이미지 기반 중복 체크
      if (product.productImage && seenImages.has(product.productImage)) {
        console.log(`🖼️ 이미지 중복 상품 건너뜀: ${product.productId}`)
        continue
      }

      // 4단계: DB에서 유사한 제목의 상품이 있는지 체크 (배치 쿼리로 최적화)
      if (cleanTitle && cleanTitle.length > 10) {
        const keywords = cleanTitle.split(' ').filter(word => word.length >= 3).slice(0, 3)

        if (keywords.length > 0) {
          // 모든 키워드를 한 번의 쿼리로 조회 (N+1 문제 해결)
          const similarProducts = await prisma.aliExpressProduct.findMany({
            where: {
              sourcingId: sourcing.id,
              OR: keywords.flatMap(keyword => [
                { productTitle: { contains: keyword } },
                { hookingTitle: { contains: keyword } }
              ])
            },
            take: 1,  // 하나라도 있으면 중복으로 판단
            select: { productTitle: true }
          })

          if (similarProducts.length > 0) {
            console.log(`🔄 키워드 기반 유사 상품 존재: ${similarProducts[0].productTitle?.slice(0, 30)}...`)
            continue
          }
        }

        seenTitles.add(cleanTitle)
      }

      // 5단계: 현재 배치에서 처리 중인 상품과 중복 체크
      const alreadyProcessed = uniqueProducts.find(existing => {
        const existingCleanTitle = existing.productTitle
          .toLowerCase()
          .replace(/[0-9$.,\-]/g, '')
          .replace(/\s+/g, ' ')
          .trim()

        if (cleanTitle && existingCleanTitle && cleanTitle.length > 5 && existingCleanTitle.length > 5) {
          const similarity = calculateSimilarity(cleanTitle, existingCleanTitle)
          return similarity > 0.8
        }

        return false
      })

      if (alreadyProcessed) {
        console.log(`🔄 현재 배치에서 이미 처리 중인 유사 상품: ${cleanTitle.slice(0, 30)}...`)
        continue
      }

      // 이미지 추가
      if (product.productImage) {
        seenImages.add(product.productImage)
      }

      uniqueProducts.push(product)
    }

    console.log(`✅ 5단계 중복 제거 완료: ${uniqueProducts.length}개 고유 상품 (${searchResult.products.length - uniqueProducts.length}개 제거)`)

    // 새로운 상품이 없는 경우
    if (uniqueProducts.length === 0) {
      return NextResponse.json({
        success: true,
        message: `모든 상품이 이미 등록되었거나 중복입니다. (총 ${searchResult.products.length}개 → 최종 0개)`,
        totalFound: searchResult.products.length,
        newPosts: 0,
        duplicatesRemoved: searchResult.products.length,
        posts: []
      })
    }

    // AI 분석 및 데이터베이스 저장
    console.log('🤖 AI 분석 시작...')
    const savedProducts = []
    const failedProducts: Array<{
      productId: string
      title: string
      error: string
    }> = []

    for (const product of uniqueProducts) {
      try {
        // 가격 계산 (환율 + 정책 적용)
        const priceCalculation = calculateAliExpressPrice(
          product.salePrice,
          product.shippingPrice || 0,
          pricingPolicy
        )

        // AI 분석 실행 (제목 + 상품 설명)
        const contentForAI = `${product.productTitle}\n\n가격: $${product.salePrice} (약 ${priceCalculation.originalPriceKRW}원)\n배송비: $${product.shippingPrice || 0}`

        const aiAnalysis = await analyzeProductContent(contentForAI, [], sourcing.pricingPolicy || undefined)

        // 데이터베이스 저장 (UPSERT 패턴)
        const savedProduct = await prisma.aliExpressProduct.upsert({
          where: {
            sourcingId_productId: {
              sourcingId: sourcing.id,
              productId: product.productId
            }
          },
          update: {
            lastCheckedAt: new Date(),
            isAvailable: true
          },
          create: {
            userId: actualUser.id,
            sourcingId: sourcing.id,
            productId: product.productId,
            productTitle: sanitizeContent(product.productTitle),
            productImage: product.productImage,
            productUrl: product.productUrl,
            originalPrice: product.originalPrice,
            salePrice: product.salePrice,
            discount: product.discount,
            currency: product.currency,
            rating: product.rating,
            totalOrders: product.totalOrders,
            shippingPrice: product.shippingPrice,
            categoryId: product.categoryId,
            sellerId: product.sellerId,
            status: 'PENDING',
            // AI 분석 결과
            aiAnalyzed: true,
            hookingTitle: sanitizeContent(aiAnalysis?.hookingTitle),
            hookingContent: sanitizeContent(aiAnalysis?.hookingContent),
            detailedContent: sanitizeContent(aiAnalysis?.detailedContent),
            productCategory: aiAnalysis?.productCategory || 'OTHER',
            // 가격 정보 (환율 + 정책 적용)
            extractedPrice: priceCalculation.originalPriceKRW,
            adjustedPrice: priceCalculation.adjustedPrice,
            policyApplied: true,
            priceCalculation: JSON.stringify(priceCalculation),
            aiProcessedAt: new Date(),
            lastCheckedAt: new Date(),
            isAvailable: true
          }
        })

        savedProducts.push(savedProduct)
        console.log(`✅ 상품 저장 완료: ${product.productId} - ${product.productTitle.slice(0, 30)}...`)

        // API Rate Limit 방지 (환경변수로 설정 가능)
        const RATE_LIMIT_DELAY = parseInt(process.env.ALIEXPRESS_RATE_LIMIT_DELAY || '1000')
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`❌ 상품 처리 실패 (${product.productId}):`, errorMessage)

        // 실패한 상품 정보 기록
        failedProducts.push({
          productId: product.productId,
          title: product.productTitle?.slice(0, 50) || 'Unknown',
          error: errorMessage
        })
        continue
      }
    }

    console.log(`🎉 AliExpress 수집 완료: ${savedProducts.length}개 상품 저장, ${failedProducts.length}개 실패`)

    return NextResponse.json({
      success: true,
      message: `${savedProducts.length}개의 새로운 AliExpress 상품을 수집했습니다! (중복 ${searchResult.products.length - uniqueProducts.length}개 제외${failedProducts.length > 0 ? `, 실패 ${failedProducts.length}개` : ''})`,
      totalFound: searchResult.products.length,
      uniqueFound: uniqueProducts.length,
      duplicatesRemoved: searchResult.products.length - uniqueProducts.length,
      newPosts: savedProducts.length,
      failedCount: failedProducts.length,
      failedProducts: failedProducts.length > 0 ? failedProducts : undefined,
      exchangeRate: exchangeRateResult.rate,
      exchangeRateIsDefault: exchangeRateResult.isDefault,
      exchangeRateWarning: exchangeRateResult.message,
      policyApplied: !!sourcing.pricingPolicy,
      posts: savedProducts
    })

  } catch (error) {
    console.error('AliExpress 상품 수집 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'AliExpress 상품을 수집할 수 없습니다.',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
