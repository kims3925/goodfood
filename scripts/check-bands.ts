import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkBands() {
  const bands = await prisma.wholesaleBand.findMany({
    select: {
      id: true,
      name: true,
      pricingPolicy: true
    }
  })

  console.log('📋 도매밴드 목록:\n')
  bands.forEach((band, index) => {
    console.log(`${index + 1}. [${band.name}]`)
    console.log(`   ID: ${band.id}`)
    console.log(`   정책: ${band.pricingPolicy || '(없음)'}\n`)
  })

  await prisma.$disconnect()
}

checkBands()
