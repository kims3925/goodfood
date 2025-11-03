import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// CLAUDE.md 기준 6개 도매밴드별 가격정책 텍스트
const pricingPolicies = {
  '가족도매방': '원가 그대로 판매 (39,900원 이상 구간별 마진 적용)',
  '요한이네♧소매방': '수집가격 기준 구간별 마진 적용',
  '초록이네': '수집가격 기준 구간별 마진 적용',
  '나은 상품 공급방': '공급가와 배송비를 분리, 공급가에만 마진 적용',
  'S D 푸드': '공급가와 배송비를 분리, 공급가에만 마진 적용',
  '폐쇄몰VIP도매': '공급가와 배송비를 분리, 공급가에만 마진 적용'
}

async function setPricingPolicies() {
  console.log('🔧 도매밴드 가격정책 설정 시작...\n')

  try {
    // 모든 도매밴드 조회
    const wholesaleBands = await prisma.wholesaleBand.findMany({
      select: {
        id: true,
        name: true,
        pricingPolicy: true
      }
    })

    console.log(`📋 총 ${wholesaleBands.length}개의 도매밴드 발견\n`)

    let updatedCount = 0

    for (const band of wholesaleBands) {
      let matchedPolicy: string | null = null

      // 밴드명 정규화 (공백 제거, 소문자 변환)
      const normalizedBandName = band.name.replace(/\s+/g, '').toLowerCase()

      // 밴드명으로 정책 매칭
      for (const [bandName, policy] of Object.entries(pricingPolicies)) {
        const normalizedPolicyName = bandName.replace(/\s+/g, '').replace('♧', '').toLowerCase()

        if (normalizedBandName.includes(normalizedPolicyName) ||
            normalizedPolicyName.includes(normalizedBandName)) {
          matchedPolicy = policy
          break
        }
      }

      if (matchedPolicy) {
        // 정책 업데이트
        await prisma.wholesaleBand.update({
          where: { id: band.id },
          data: { pricingPolicy: matchedPolicy }
        })

        console.log(`✅ [${band.name}]`)
        console.log(`   이전: ${band.pricingPolicy || '(없음)'}`)
        console.log(`   이후: ${matchedPolicy}\n`)
        updatedCount++
      } else {
        console.log(`⚠️  [${band.name}] - 매칭되는 정책 없음 (기존 정책 유지)\n`)
      }
    }

    console.log(`\n🎉 완료! ${updatedCount}개 밴드의 가격정책 업데이트됨`)

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setPricingPolicies()
