// 가격정책 JSON 형식으로 수정하는 스크립트
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixPricingPolicies() {
  try {
    console.log('=== 가격정책 JSON 형식으로 변환 시작 ===\n')

    // 모든 도매 밴드 조회
    const wholesaleBands = await prisma.wholesaleBand.findMany()

    for (const band of wholesaleBands) {
      console.log(`밴드: ${band.name}`)
      console.log(`기존 정책: ${band.pricingPolicy}`)

      let newPolicy = null

      // 기존 정책을 분석하여 적절한 JSON 정책으로 변환
      if (band.pricingPolicy) {
        const policy = band.pricingPolicy.toLowerCase()

        if (policy.includes('원가 그대로') || policy.includes('원가그대로')) {
          // 원가 그대로 적용 → 0% 마진
          newPolicy = {
            method: 'PERCENTAGE',
            value: 0,
            description: '원가 그대로 적용'
          }
        } else if (policy.includes('10,000원 구간별로 마진 1,000원')) {
          // 구간별 마진 → 20% 마진으로 근사치 적용
          newPolicy = {
            method: 'PERCENTAGE', 
            value: 20,
            description: '구간별 마진 (20% 근사치)'
          }
        } else if (policy.includes('마진') && policy.includes('%')) {
          // 퍼센트 마진 추출 시도
          const percentMatch = policy.match(/(\d+)%/)
          if (percentMatch) {
            newPolicy = {
              method: 'PERCENTAGE',
              value: parseInt(percentMatch[1]),
              description: `${percentMatch[1]}% 마진`
            }
          }
        } else {
          // 기타 경우 → 기본 25% 마진
          newPolicy = {
            method: 'PERCENTAGE',
            value: 25,
            description: '기본 마진 (25%)'
          }
        }
      } else {
        // 정책이 없는 경우 → 기본 30% 마진
        newPolicy = {
          method: 'PERCENTAGE',
          value: 30,
          description: '기본 마진 (30%)'
        }
      }

      // 데이터베이스 업데이트
      await prisma.wholesaleBand.update({
        where: { id: band.id },
        data: {
          pricingPolicy: JSON.stringify(newPolicy)
        }
      })

      console.log(`새 정책: ${JSON.stringify(newPolicy)}`)
      console.log('✅ 업데이트 완료\n')
    }

    console.log('=== 가격정책 변환 완료 ===\n')

    // 결과 확인
    console.log('=== 변환 결과 확인 ===')
    const updatedBands = await prisma.wholesaleBand.findMany()
    
    updatedBands.forEach((band, index) => {
      console.log(`${index + 1}. ${band.name}`)
      try {
        const policy = JSON.parse(band.pricingPolicy)
        console.log(`   정책: ${policy.method} ${policy.value}${policy.method === 'PERCENTAGE' ? '%' : ''}`)
        console.log(`   설명: ${policy.description}`)
      } catch (error) {
        console.log(`   ❌ 파싱 실패: ${band.pricingPolicy}`)
      }
      console.log()
    })

  } catch (error) {
    console.error('가격정책 변환 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixPricingPolicies()