// 가격정책 문제 디버깅 스크립트
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function debugPricingIssue() {
  try {
    console.log('=== 가격정책 문제 디버깅 시작 ===\n')

    // 1. 최근 생성된 상품 확인 (가을 신비복숭아)
    const recentProduct = await prisma.product.findFirst({
      where: {
        title: { contains: '가을 신비복숭아' }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: { select: { email: true } }
      }
    })

    if (!recentProduct) {
      console.log('❌ 가을 신비복숭아 상품을 찾을 수 없습니다.')
      return
    }

    console.log('📦 최근 생성된 상품:')
    console.log(`제목: ${recentProduct.title}`)
    console.log(`원가: ${recentProduct.originalPrice}원`)
    console.log(`판매가: ${recentProduct.salePrice}원`)
    console.log(`소싱처: ${recentProduct.wholesaleBandName}`)
    console.log(`생성일: ${recentProduct.createdAt}`)
    console.log()

    // 2. priceInfo 파싱하여 옵션 확인
    console.log('💰 가격 정보 상세:')
    try {
      const priceInfo = JSON.parse(recentProduct.priceInfo || '{}')
      
      console.log('적용된 정책:', priceInfo.appliedPolicy || '없음')
      console.log('배송비:', priceInfo.shippingFee || 0, '원')
      console.log('원본 옵션 수:', priceInfo.originalPriceOptions?.length || 0)
      console.log('처리된 옵션 수:', priceInfo.processedPriceOptions?.length || 0)
      console.log()

      if (priceInfo.originalPriceOptions?.length > 0) {
        console.log('🎯 옵션별 가격 상세:')
        priceInfo.originalPriceOptions.forEach((option, index) => {
          const processedOption = priceInfo.processedPriceOptions?.[index]
          console.log(`옵션 ${index + 1}: ${option.option || option.name || '이름없음'}`)
          console.log(`  원가: ${option.price || 0}원`)
          console.log(`  처리된 가격: ${processedOption?.salePrice || '없음'}원`)
          console.log(`  단위: ${option.unit || '없음'}`)
          
          // 수동 계산 검증
          const originalPrice = option.price || 0
          const shippingFee = priceInfo.shippingFee || 0
          const basePrice = originalPrice + shippingFee
          
          console.log(`  검증 계산: (${originalPrice} + ${shippingFee}) = ${basePrice}원`)
          
          if (basePrice <= 19900) {
            console.log(`  예상 판매가: ${basePrice + 4000}원 (19900원 이하 +4000원)`)
          } else {
            const excess = basePrice - 19900
            const additionalMargin = Math.floor(excess / 10000) * 1000
            const expectedPrice = basePrice + 4000 + additionalMargin
            console.log(`  예상 판매가: ${expectedPrice}원 (19900원 초과, 추가마진 ${additionalMargin}원)`)
          }
          console.log()
        })
      }

    } catch (error) {
      console.log('❌ priceInfo 파싱 실패:', error.message)
      console.log('원본 priceInfo:', recentProduct.priceInfo)
    }

    // 3. 해당 상품의 원본 CollectedPost 확인
    console.log('📋 원본 게시물 확인:')
    const originalPost = await prisma.collectedPost.findUnique({
      where: { id: recentProduct.sourceId },
      include: {
        wholesaleBand: true
      }
    })

    if (originalPost) {
      console.log(`원본 제목: ${originalPost.title}`)
      console.log(`밴드: ${originalPost.wholesaleBand.name}`)
      console.log(`밴드 가격정책: ${originalPost.wholesaleBand.pricingPolicy}`)
      console.log(`배송비: ${originalPost.shippingFee || 0}원`)
      console.log()

      try {
        const originalPriceOptions = JSON.parse(originalPost.priceOptions || '[]')
        console.log('원본 가격 옵션 수:', originalPriceOptions.length)
        originalPriceOptions.forEach((option, index) => {
          console.log(`  원본 옵션 ${index + 1}: ${option.option || option.name} - ${option.price}원`)
        })
      } catch (error) {
        console.log('❌ 원본 가격옵션 파싱 실패:', error.message)
      }
    }

  } catch (error) {
    console.error('디버깅 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugPricingIssue()