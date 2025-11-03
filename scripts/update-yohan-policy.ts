import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateYohanPolicy() {
  console.log('🔧 요한이네♧소매방 가격정책 업데이트...\n')

  const result = await prisma.wholesaleBand.updateMany({
    where: {
      name: {
        contains: '요한이네'
      }
    },
    data: {
      pricingPolicy: '수집가격 기준 구간별 마진 적용'
    }
  })

  console.log(`✅ ${result.count}개 밴드 업데이트 완료!`)
  console.log('   정책: "수집가격 기준 구간별 마진 적용"')

  await prisma.$disconnect()
}

updateYohanPolicy()
