import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()

async function check() {
  // OrderTest 테이블 (웹훅 주문) 확인
  const orderTestCount = await prisma.orderTest.count()
  const orderTests = await prisma.orderTest.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { retailBand: { select: { name: true, formUrl: true } } }
  })

  console.log('=== OrderTest (웹훅 주문) ===')
  console.log('총 개수:', orderTestCount)
  if (orderTests.length > 0) {
    orderTests.forEach(o => {
      console.log('---')
      console.log('ID:', o.id)
      console.log('상품명:', o.productName)
      console.log('고객:', o.customerName)
      console.log('retailBandId:', o.retailBandId)
      console.log('연결된 밴드:', o.retailBand?.name || '없음')
      console.log('밴드 formUrl:', o.retailBand?.formUrl || '없음')
    })
  } else {
    console.log('(데이터 없음)')
  }

  // Order 테이블 확인
  const orderCount = await prisma.order.count()
  const orders = await prisma.order.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    include: { retailBand: { select: { name: true, formUrl: true } } }
  })

  console.log('\n=== Order (정산용 주문) ===')
  console.log('총 개수:', orderCount)
  if (orders.length > 0) {
    orders.forEach(o => {
      console.log('---')
      console.log('주문번호:', o.orderNumber)
      console.log('retailBandId:', o.retailBandId)
      console.log('연결된 밴드:', o.retailBand?.name || '미분류')
    })
  }

  // RetailBand의 formUrl 현황
  console.log('\n=== 소매밴드 formUrl 현황 ===')
  const bands = await prisma.retailBand.findMany({
    select: { id: true, name: true, formUrl: true }
  })
  bands.forEach(b => {
    console.log(b.id, b.name, ':', b.formUrl || '(formUrl 없음)')
  })
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
