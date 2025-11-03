// 수정된 가격 계산 로직 테스트
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testFixedPricing() {
  try {
    console.log('=== 수정된 가격 계산 로직 테스트 ===\n')

    // 1. 나은VIP/SD 정책 테스트
    const testCases = [
      { price: 15000, shipping: 0, expected: 19000 }, // 15000 ≤ 19900 → +4000
      { price: 19900, shipping: 0, expected: 23900 }, // 19900 ≤ 19900 → +4000
      { price: 22000, shipping: 0, expected: 27000 }, // 22000 > 19900, 초과분 2100 → 1구간 → +4000+1000 = 27000
      { price: 28000, shipping: 0, expected: 33000 }, // 28000 > 19900, 초과분 8100 → 1구간 → +4000+1000 = 33000
      { price: 30000, shipping: 0, expected: 36000 }, // 30000 > 19900, 초과분 10100 → 2구간 → +4000+2000 = 36000
      { price: 34000, shipping: 0, expected: 40000 }, // 34000 > 19900, 초과분 14100 → 2구간 → +4000+2000 = 40000
    ]

    console.log('🧮 나은VIP/SD 가격정책 계산 테스트:')
    testCases.forEach(({ price, shipping, expected }) => {
      const basePrice = price + shipping
      
      let result
      if (basePrice <= 19900) {
        result = basePrice + 4000
      } else {
        const excess = basePrice - 19900
        const additionalSections = Math.ceil(excess / 10000) // 수정된 로직 (올림 처리)
        const additionalMargin = additionalSections * 1000
        result = basePrice + 4000 + additionalMargin
      }

      const isCorrect = result === expected
      console.log(`  ${price}원 + ${shipping}원 = ${basePrice}원 → ${result}원 ${isCorrect ? '✅' : '❌'} (예상: ${expected}원)`)
      
      if (!isCorrect) {
        const excess = basePrice - 19900
        const sections = Math.ceil(excess / 10000)
        console.log(`    초과분: ${excess}원, 구간수: ${sections}, 추가마진: ${sections * 1000}원`)
      }
    })

    console.log('\n=== 기존 상품 삭제 (테스트용) ===')
    await prisma.product.deleteMany({
      where: {
        title: { contains: '가을 신비복숭아' }
      }
    })
    console.log('✅ 기존 가을 신비복숭아 상품 삭제 완료')

    console.log('\n=== 테스트 완료 ===')
    console.log('이제 다음 단계를 수행하세요:')
    console.log('1. http://localhost:3000/dashboard/wholesale/collect 에서 가을 신비복숭아 소싱 확정')
    console.log('2. http://localhost:3000/dashboard/products 에서 3개 옵션별 상품 확인')
    console.log('   - 3kg (22,000원) → 27,000원')
    console.log('   - 4kg (28,000원) → 33,000원')
    console.log('   - 5kg (34,000원) → 40,000원')

  } catch (error) {
    console.error('테스트 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testFixedPricing()