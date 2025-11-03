import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixAllPolicies() {
  console.log('🔧 모든 도매밴드 가격정책 정리 시작...\n')

  try {
    // 1. 가족도매방
    await prisma.wholesaleBand.updateMany({
      where: { name: { contains: '가족도매' } },
      data: { pricingPolicy: '원가 그대로 판매 (39,900원 이상 구간별 마진 적용)' }
    })
    console.log('✅ 가족도매방 정책 설정 완료')

    // 2. 요한이네♧소매방
    await prisma.wholesaleBand.updateMany({
      where: { name: { contains: '요한이네' } },
      data: { pricingPolicy: '수집가격 기준 구간별 마진 적용' }
    })
    console.log('✅ 요한이네♧소매방 정책 설정 완료')

    // 3. 초록이네
    await prisma.wholesaleBand.updateMany({
      where: { name: { contains: '초록이네' } },
      data: { pricingPolicy: '수집가격 기준 구간별 마진 적용' }
    })
    console.log('✅ 초록이네 정책 설정 완료')

    // 4. 나은 상품 공급방
    await prisma.wholesaleBand.updateMany({
      where: { name: { contains: '나은' } },
      data: { pricingPolicy: '공급가와 배송비를 분리, 공급가에만 마진 적용' }
    })
    console.log('✅ 나은 상품 공급방 정책 설정 완료')

    // 5. S D 푸드
    await prisma.wholesaleBand.updateMany({
      where: { name: { contains: 'D' }, AND: { name: { contains: '푸드' } } },
      data: { pricingPolicy: '공급가와 배송비를 분리, 공급가에만 마진 적용' }
    })
    console.log('✅ S D 푸드 정책 설정 완료')

    // 6. 폐쇄몰VIP도매
    await prisma.wholesaleBand.updateMany({
      where: { name: { contains: '폐쇄몰' } },
      data: { pricingPolicy: '공급가와 배송비를 분리, 공급가에만 마진 적용' }
    })
    console.log('✅ 폐쇄몰VIP도매 정책 설정 완료')

    console.log('\n🎉 모든 밴드 정책 정리 완료!')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixAllPolicies()
