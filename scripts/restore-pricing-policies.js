// 가격정책을 자연어 형태로 복원하는 스크립트
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function restorePricingPolicies() {
  try {
    console.log('=== 가격정책 자연어 형태로 복원 시작 ===\n')

    // 도매처별 정책 매핑
    const policyMapping = {
      '요한이네♧소매방': '기존가격 10,000원 구간별로 마진 1,000원씩 증가 (29,900원까지 +1,000원)',
      '초록이네': '기존가격 10,000원 구간별로 마진 1,000원씩 증가 (29,900원까지 +1,000원)',
      '나은 상품 공급방': '(공급가+배송비) 10,000원 구간별로 마진 1,000원씩 증가 (19,900원까지 +4,000원)',
      'S  D  푸드': '(공급가+배송비) 10,000원 구간별로 마진 1,000원씩 증가 (19,900원까지 +4,000원)',
      '폐쇄몰VIP도매': '(공급가+배송비) 10,000원 구간별로 마진 1,000원씩 증가 (19,900원까지 +4,000원)',
      '가족도매방': '원가 그대로'
    }

    // 모든 도매 밴드 조회
    const wholesaleBands = await prisma.wholesaleBand.findMany()

    for (const band of wholesaleBands) {
      console.log(`밴드: ${band.name}`)
      
      const newPolicy = policyMapping[band.name] || '기존가격 10,000원 구간별로 마진 1,000원씩 증가 (29,900원까지 +1,000원)'
      
      // 데이터베이스 업데이트
      await prisma.wholesaleBand.update({
        where: { id: band.id },
        data: {
          pricingPolicy: newPolicy
        }
      })

      console.log(`정책: ${newPolicy}`)
      console.log('✅ 업데이트 완료\n')
    }

    console.log('=== 가격정책 복원 완료 ===')

  } catch (error) {
    console.error('가격정책 복원 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

restorePricingPolicies()