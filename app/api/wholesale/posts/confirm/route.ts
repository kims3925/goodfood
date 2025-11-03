import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { postIds, finalContents } = await request.json()

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '선택된 게시물이 없습니다.'
      }, { status: 400 })
    }

    // 선택된 게시물들 조회
    const selectedPosts = await prisma.collectedPost.findMany({
      where: {
        id: {
          in: postIds
        },
        userId: session.user.id,
        status: 'PENDING'
      },
      include: {
        wholesaleBand: true
      }
    })

    if (selectedPosts.length === 0) {
      return NextResponse.json({
        success: false,
        error: '처리 가능한 게시물이 없습니다.'
      }, { status: 400 })
    }

    let createdProductsCount = 0

    // 최종 게시 내용 매핑 생성
    const finalContentMap = new Map()
    if (finalContents && Array.isArray(finalContents)) {
      finalContents.forEach(item => {
        finalContentMap.set(item.id, item.finalContent)
      })
    }

    // 각 게시물을 상품으로 변환
    for (const post of selectedPosts) {
      try {
        // 가격 옵션 파싱
        let priceOptions = []
        try {
          priceOptions = JSON.parse(post.priceOptions || '[]')
        } catch {
          priceOptions = []
        }

        // 밴드 가격정책 가져오기 (자연어 정책)
        const policyText = post.wholesaleBand.pricingPolicy || ''

        // CLAUDE.md 파일 기준 정확한 가격정책 적용 함수
        const applyPricingPolicy = (originalPrice, shippingFee = 0) => {
          if (!policyText) {
            return originalPrice // 가격정책이 없으면 원가 그대로
          }

          let result = originalPrice

          // 1. 가족도매방: 판매가는 원가 그대로
          if (policyText.includes('원가 그대로')) {
            result = originalPrice
            return result
          }

          // 2. 요한이네♧소매방 & 초록이네: 수집가격 기준 구간별 마진 적용
          if (policyText.includes('수집가격 기준 구간별 마진 적용')) {
            const basePrice = originalPrice

            if (basePrice <= 19900) {
              result = basePrice + 1000
            } else if (basePrice >= 20000 && basePrice <= 29900) {
              result = basePrice + 2000
            } else if (basePrice >= 30000 && basePrice <= 39900) {
              result = basePrice + 3000
            } else if (basePrice >= 40000 && basePrice <= 49900) {
              result = basePrice + 4000
            } else if (basePrice >= 50000 && basePrice <= 59900) {
              result = basePrice + 5000
            } else if (basePrice >= 60000) {
              result = basePrice + 6000
            }

            return result
          }

          // 3. 나은 상품 공급방, S D 푸드, 폐쇄몰VIP도매: 공급가에만 마진 적용, 배송비 별도
          if (policyText.includes('공급가와 배송비를 분리, 공급가에만 마진 적용')) {
            const supplyPrice = originalPrice

            if (supplyPrice <= 19900) {
              result = supplyPrice + 4000 // 공급가 + 4,000원 마진
            } else {
              // 19,900원 초과시: 기본 4,000원 + 초과구간별(1만원마다) 1,000원
              const excess = supplyPrice - 19900
              const additionalSections = Math.ceil(excess / 10000)
              const additionalMargin = additionalSections * 1000
              result = supplyPrice + 4000 + additionalMargin
            }

            return result // 배송비는 별도 표시이므로 포함하지 않음
          }

          // 기본값: 원가 그대로
          return originalPrice
        }

        // 가격 파싱 함수 - 개선된 버전
        const parsePrice = (priceStr) => {
          if (!priceStr) return 10000
          if (typeof priceStr === 'number' && !isNaN(priceStr)) return Math.floor(priceStr)

          // 문자열 처리
          let cleanStr = String(priceStr)

          // 먼저 "원" 앞의 숫자만 추출 (콤마 포함)
          const priceMatch = cleanStr.match(/([0-9,]+)원/)
          if (priceMatch) {
            const priceOnly = priceMatch[1].replace(/,/g, '')
            const parsed = parseInt(priceOnly)
            return !isNaN(parsed) && parsed > 0 ? parsed : 10000
          }

          // "원"이 없는 경우 첫 번째 연속된 숫자 그룹만 추출
          const numberMatch = cleanStr.match(/^[0-9,]+/)
          if (numberMatch) {
            const cleanPrice = numberMatch[0].replace(/,/g, '')
            const parsed = parseInt(cleanPrice)
            return !isNaN(parsed) && parsed > 0 ? parsed : 10000
          }

          // 최후의 수단: 모든 숫자 추출 후 앞 5자리까지만
          const allNumbers = cleanStr.replace(/[^0-9]/g, '')
          if (allNumbers) {
            const limitedNumbers = allNumbers.substring(0, 6) // 최대 6자리
            const parsed = parseInt(limitedNumbers)
            return !isNaN(parsed) && parsed > 0 ? parsed : 10000
          }

          return 10000
        }

        // 가격 옵션들에 정책 적용
        let processedPriceOptions = []
        if (priceOptions.length > 0) {
          processedPriceOptions = priceOptions.map(option => {
            const parsedPrice = parsePrice(option.price)
            const calculatedSalePrice = applyPricingPolicy(parsedPrice, post.shippingFee || 0)
            return {
              ...option,
              salePrice: parsePrice(calculatedSalePrice), // 정책 적용 후에도 parsePrice로 정리
              originalPrice: parsedPrice
            }
          })
        }

        // 기본 가격 설정 (첫 번째 옵션이 있으면 사용, 없으면 기본값)
        const basePrice = processedPriceOptions.length > 0
          ? parsePrice(processedPriceOptions[0].originalPrice)
          : 10000
        const salePrice = processedPriceOptions.length > 0
          ? parsePrice(processedPriceOptions[0].salePrice)
          : applyPricingPolicy(basePrice, post.shippingFee || 0)

        // 특이사항 조합 (AI 분석 결과 우선 활용)
        let specialNotes = []
        
        // 추가적인 특이사항들
        if (post.hasDeadline && post.deadlineInfo) {
          specialNotes.push(`⏰ ${post.deadlineInfo}`)
        }
        if (!post.isAvailable && post.unavailableReason) {
          specialNotes.push(`❌ ${post.unavailableReason}`)
        }

        // 처리된 가격 옵션을 포함한 가격 정보
        const enhancedPriceInfo = {
          originalPriceOptions: priceOptions,
          processedPriceOptions: processedPriceOptions,
          appliedPolicy: policyText, // 자연어 정책 저장
          shippingFee: post.shippingFee || 0,
          baseInfo: post.priceInfo || ''
        }

        // 상품 생성 (모든 AI 분석 데이터 포함)
        const product = await prisma.product.create({
          data: {
            userId: session.user.id,
            title: post.hookingTitle || post.title || '제목 없음',
            originalPrice: parsePrice(basePrice), // 한 번 더 파싱 보장
            salePrice: parsePrice(salePrice), // 한 번 더 파싱 보장
            description: finalContentMap.get(post.id) || post.hookingContent || post.detailedContent || post.content || '',
            status: 'DRAFT',
            sourceType: 'COLLECTED_POST',
            sourceId: post.id,
            
            // AI 분석 결과 및 추가 정보
            images: post.images || '[]',
            hookingTitle: post.hookingTitle,
            hookingContent: post.hookingContent,
            detailedContent: post.detailedContent,
            productCategory: post.productCategory,
            
            // 가격 관련 정보 (옵션별 가격정책 적용 결과)
            shippingFee: post.shippingFee,
            priceInfo: JSON.stringify(enhancedPriceInfo),
            
            // 특이사항 및 메타데이터
            specialNotes: specialNotes.length > 0 ? specialNotes.join('\n') : null,
            hasDeadline: post.hasDeadline,
            deadlineInfo: post.deadlineInfo,
            isAvailable: post.isAvailable,
            unavailableReason: post.unavailableReason,
            
            // 소싱 정보
            wholesaleBandName: post.wholesaleBand.name,
            author: post.author,
            originalCreatedAt: post.bandCreatedAt
          }
        })

        createdProductsCount++
        console.log(`상품 생성 완료: ${product.title} (${product.id})`)

        // 게시물 상태 업데이트 (다중/단일 옵션 공통)
        await prisma.collectedPost.update({
          where: { id: post.id },
          data: {
            status: 'PROCESSED',
            isSelected: true
          }
        })

      } catch (productError) {
        console.error(`게시물 ${post.id} 처리 중 오류:`, productError)
        // 개별 게시물 오류는 전체 프로세스를 중단하지 않음
      }
    }

    return NextResponse.json({
      success: true,
      message: `${createdProductsCount}개의 상품이 성공적으로 생성되었습니다.`,
      createdProducts: createdProductsCount,
      totalSelected: selectedPosts.length
    })

  } catch (error) {
    console.error('소싱 확정 처리 실패:', error)
    return NextResponse.json({
      success: false,
      error: '소싱 확정 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}