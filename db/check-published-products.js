import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking published_product table...\n')

  // 전체 레코드 수
  const total = await prisma.publishedProduct.count()
  console.log(`Total published_products: ${total}\n`)

  // channelId가 null인 레코드 수
  const nullChannelCount = await prisma.publishedProduct.count({
    where: { channelId: null }
  })
  console.log(`Records with channelId = null: ${nullChannelCount}`)

  // shopId가 null인 레코드 수
  const nullShopCount = await prisma.publishedProduct.count({
    where: { shopId: null }
  })
  console.log(`Records with shopId = null: ${nullShopCount}`)

  // channelId와 shopId 모두 null인 레코드 수
  const bothNull = await prisma.publishedProduct.count({
    where: {
      channelId: null,
      shopId: null
    }
  })
  console.log(`Records with both null: ${bothNull}\n`)

  // 샘플 데이터 조회 (최근 20개)
  console.log('Sample data (recent 20 records):')
  console.log('=' .repeat(120))
  const samples = await prisma.publishedProduct.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      productId: true,
      channelId: true,
      shopId: true,
      productName: true,
      publishedAt: true,
      createdAt: true,
    }
  })

  console.table(samples)

  // channelId가 null인 샘플
  if (nullChannelCount > 0) {
    console.log('\nRecords with channelId = null:')
    console.log('=' .repeat(120))
    const nullChannelSamples = await prisma.publishedProduct.findMany({
      where: { channelId: null },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        productId: true,
        channelId: true,
        shopId: true,
        productName: true,
        publishedAt: true,
        createdAt: true,
      }
    })
    console.table(nullChannelSamples)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
