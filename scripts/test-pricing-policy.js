// 가격정책 테스트 스크립트
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testPricingPolicy() {
  try {
    // 1. 모든 도매 밴드 조회
    const wholesaleBands = await prisma.wholesaleBand.findMany({
      include: {
        user: {
          select: { email: true }
        }
      }
    })

    console.log('\n=== 현재 등록된 도매 밴드 목록 ===')
    wholesaleBands.forEach(band => {
      console.log(`ID: ${band.id}`)
      console.log(`이름: ${band.name}`)
      console.log(`사용자: ${band.user.email}`)
      console.log(`가격정책 원본: ${band.pricingPolicy}`)
      
      try {
        const parsed = band.pricingPolicy ? JSON.parse(band.pricingPolicy) : null
        console.log(`가격정책 파싱: ${JSON.stringify(parsed, null, 2)}`)
      } catch (error) {
        console.log(`가격정책 파싱 실패: ${error.message}`)
      }
      console.log('---')
    })

    // 2. 첫 번째 밴드에 테스트 가격정책 설정
    if (wholesaleBands.length > 0) {
      const firstBand = wholesaleBands[0]
      
      const testPolicy = {
        method: 'PERCENTAGE',
        value: 30  // 30% 마진
      }

      console.log('\n=== 테스트 가격정책 설정 ===')
      console.log(`밴드: ${firstBand.name}`)
      console.log(`설정할 정책: ${JSON.stringify(testPolicy)}`)

      const updatedBand = await prisma.wholesaleBand.update({
        where: { id: firstBand.id },
        data: {
          pricingPolicy: JSON.stringify(testPolicy)
        }
      })

      console.log('✅ 가격정책 설정 완료')
      console.log(`업데이트된 정책: ${updatedBand.pricingPolicy}`)

      // 3. 가격정책 테스트 계산
      console.log('\n=== 가격정책 테스트 계산 ===')
      const testPrices = [10000, 15000, 20000, 25000]
      
      testPrices.forEach(originalPrice => {
        let calculatedPrice
        
        if (testPolicy.method === 'PERCENTAGE') {
          calculatedPrice = Math.round(originalPrice * (1 + testPolicy.value / 100))
        } else if (testPolicy.method === 'FIXED_AMOUNT') {
          calculatedPrice = originalPrice + testPolicy.value
        } else if (testPolicy.method === 'MULTIPLY') {
          calculatedPrice = Math.round(originalPrice * testPolicy.value)
        } else {
          calculatedPrice = Math.round(originalPrice * 1.5)
        }

        console.log(`원가 ${originalPrice.toLocaleString()}원 → 판매가 ${calculatedPrice.toLocaleString()}원 (마진: ${((calculatedPrice - originalPrice) / originalPrice * 100).toFixed(1)}%)`)
      })
    }

    // 4. 최근 수집된 게시물 확인
    console.log('\n=== 최근 수집된 게시물 확인 ===')
    const recentPosts = await prisma.collectedPost.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        wholesaleBand: true
      },
      take: 3,
      orderBy: {
        createdAt: 'desc'
      }
    })

    recentPosts.forEach((post, index) => {
      console.log(`\n게시물 ${index + 1}:`)
      console.log(`제목: ${post.title}`)
      console.log(`밴드: ${post.wholesaleBand.name}`)
      console.log(`밴드 가격정책: ${post.wholesaleBand.pricingPolicy}`)
      
      try {
        const priceOptions = JSON.parse(post.priceOptions || '[]')
        console.log(`가격 옵션 수: ${priceOptions.length}`)
        if (priceOptions.length > 0) {
          console.log(`첫 번째 가격: ${priceOptions[0].price?.toLocaleString()}원`)
        }
      } catch {}
    })

  } catch (error) {
    console.error('테스트 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPricingPolicy()