import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()

async function cleanup() {
  console.log('더미 데이터 정리 시작...\n')

  // 1. 더미 소매밴드 삭제 (신선마켓, 청과물직거래, 농산물백화점)
  const dummyBandIds = [12, 13, 14]

  // 해당 밴드의 주문 아이템 먼저 삭제
  const ordersToDelete = await prisma.order.findMany({
    where: { retailBandId: { in: dummyBandIds } },
    select: { id: true }
  })

  if (ordersToDelete.length > 0) {
    await prisma.orderItem.deleteMany({
      where: { orderId: { in: ordersToDelete.map(o => o.id) } }
    })
  }

  // 해당 밴드의 주문 삭제
  const deletedOrders1 = await prisma.order.deleteMany({
    where: { retailBandId: { in: dummyBandIds } }
  })
  console.log('더미 밴드 주문 삭제:', deletedOrders1.count, '건')

  // 더미 소매밴드 삭제
  const deletedBands = await prisma.retailBand.deleteMany({
    where: { id: { in: dummyBandIds } }
  })
  console.log('더미 소매밴드 삭제:', deletedBands.count, '개')

  // 2. 발행 상품이 없는 밴드의 주문도 삭제
  const bandsWithPublish = await prisma.productPublish.findMany({
    where: { status: 'SUCCESS' },
    select: { retailBandId: true },
    distinct: ['retailBandId']
  })
  const publishedBandIds = bandsWithPublish.map(b => b.retailBandId)
  console.log('\n발행 상품이 있는 밴드 ID:', publishedBandIds)

  // 미발행 밴드의 주문 찾기
  const unpublishedBandOrders = await prisma.order.findMany({
    where: {
      retailBandId: { notIn: [...publishedBandIds] },
      NOT: { retailBandId: null }
    },
    select: { id: true, retailBandId: true }
  })

  if (unpublishedBandOrders.length > 0) {
    // 주문 아이템 먼저 삭제
    await prisma.orderItem.deleteMany({
      where: { orderId: { in: unpublishedBandOrders.map(o => o.id) } }
    })

    const deletedOrders2 = await prisma.order.deleteMany({
      where: { id: { in: unpublishedBandOrders.map(o => o.id) } }
    })
    console.log('미발행 밴드 주문 삭제:', deletedOrders2.count, '건')
  }

  // 3. 현재 상태 확인
  console.log('\n--- 정리 후 현황 ---')
  const bands = await prisma.retailBand.findMany({
    include: { apiConfig: { select: { platform: true } } }
  })
  console.log('남은 소매밴드:', bands.length, '개')
  bands.forEach(b => console.log('  -', b.id, b.name))

  const orders = await prisma.order.count()
  console.log('남은 주문:', orders, '건')
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
