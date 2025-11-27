import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()

async function main() {
  console.log('정산 더미 주문 데이터 생성')
  console.log('(실제 소매밴드 + 실제 발행상품만 사용)\n')

  // 1. 기존 사용자 확인 (ADMIN)
  const user = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  })

  if (!user) {
    console.error('관리자 사용자가 없습니다.')
    process.exit(1)
  }
  console.log(`사용자: ${user.name} (ID: ${user.id})`)

  // 2. 발행된 상품이 있는 소매밴드만 조회
  const retailBands = await prisma.retailBand.findMany({
    where: {
      userId: user.id,
      isActive: true,
      productPublishes: {
        some: { status: 'SUCCESS' },
      },
    },
    include: {
      apiConfig: {
        select: { platform: true },
      },
      productPublishes: {
        where: { status: 'SUCCESS' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              thumbnailUrl: true,
            },
          },
        },
      },
    },
  })

  if (retailBands.length === 0) {
    console.error('\n발행된 상품이 있는 소매밴드가 없습니다.')
    console.log('먼저 소매밴드에 상품을 발행해주세요.')
    process.exit(1)
  }

  console.log(`\n발행 상품이 있는 소매밴드: ${retailBands.length}개`)
  retailBands.forEach(band => {
    console.log(`  - ${band.name} (${band.apiConfig?.platform}): 발행상품 ${band.productPublishes.length}개`)
    band.productPublishes.forEach(pp => {
      console.log(`      • ${pp.product.name} (${pp.product.price?.toLocaleString() || '가격미정'}원)`)
    })
  })

  // 3. 더미 주문 생성 데이터
  const customerNames = ['김철수', '이영희', '박민수', '최지연', '정우성', '한지민', '송중기', '김태희', '강동원', '손예진']
  const addresses = [
    { postal: '06234', addr: '서울특별시 강남구 테헤란로 152', detail: '강남파이낸스센터 32층' },
    { postal: '04763', addr: '서울특별시 성동구 왕십리로 115', detail: '헤이그라운드 서울숲점 5층' },
    { postal: '16954', addr: '경기도 용인시 기흥구 덕영대로 1732', detail: '삼성전자 R5 사업장' },
    { postal: '48060', addr: '부산광역시 해운대구 센텀중앙로 97', detail: '센텀스카이비즈 A동 1201호' },
    { postal: '35220', addr: '대전광역시 서구 둔산로 100', detail: '대전시청 별관 3층' },
    { postal: '61452', addr: '광주광역시 동구 금남로 245', detail: '금호생명빌딩 8층' },
  ]
  const deliveryMemos = ['문 앞에 놓아주세요', '경비실에 맡겨주세요', '부재시 연락 부탁드립니다', '택배함에 넣어주세요', null]
  const orderStatuses: Array<'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED'> = ['PAID', 'PAID', 'PAID', 'SHIPPED', 'DELIVERED']

  const now = new Date()
  let createdOrders = 0

  // 4. 각 소매밴드별로 발행된 상품에 대한 주문 생성
  for (const band of retailBands) {
    const publishedProducts = band.productPublishes.map(pp => pp.product)
    if (publishedProducts.length === 0) continue

    const orderCount = 5 + Math.floor(Math.random() * 6) // 5~10개
    console.log(`\n[${band.name}] ${orderCount}개 주문 생성 중...`)

    for (let i = 0; i < orderCount; i++) {
      const orderDate = new Date(now)
      orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30))
      orderDate.setHours(Math.floor(Math.random() * 14) + 8)
      orderDate.setMinutes(Math.floor(Math.random() * 60))

      const customerName = customerNames[Math.floor(Math.random() * customerNames.length)]
      const address = addresses[Math.floor(Math.random() * addresses.length)]
      const deliveryMemo = deliveryMemos[Math.floor(Math.random() * deliveryMemos.length)]
      const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)]

      // 발행된 상품 중에서 1~3개 랜덤 선택
      const itemCount = 1 + Math.floor(Math.random() * Math.min(3, publishedProducts.length))
      const selectedProducts = [...publishedProducts]
        .sort(() => Math.random() - 0.5)
        .slice(0, itemCount)

      const orderItems = selectedProducts.map(product => {
        const quantity = 1 + Math.floor(Math.random() * 3)
        const unitPrice = product.price || 30000 // 가격이 없으면 기본값
        return {
          productId: product.id,
          productName: product.name,
          thumbnailUrl: product.thumbnailUrl,
          quantity,
          unitPrice,
          totalPrice: unitPrice * quantity,
        }
      })

      const subtotalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0)
      const shippingFee = subtotalAmount >= 50000 ? 0 : 3000
      const totalAmount = subtotalAmount + shippingFee

      const orderNumber = `ORD-${orderDate.getFullYear()}${String(orderDate.getMonth() + 1).padStart(2, '0')}${String(orderDate.getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          retailBandId: band.id,
          orderNumber,
          status,
          recipientName: customerName,
          recipientPhone: `010-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          postalCode: address.postal,
          address: address.addr,
          addressDetail: address.detail,
          deliveryMemo,
          subtotalAmount,
          shippingFee,
          discountAmount: 0,
          totalAmount,
          orderedAt: orderDate,
          paidAt: status !== 'PENDING' ? orderDate : null,
          shippedAt: status === 'SHIPPED' || status === 'DELIVERED' ? new Date(orderDate.getTime() + 24 * 60 * 60 * 1000) : null,
          deliveredAt: status === 'DELIVERED' ? new Date(orderDate.getTime() + 3 * 24 * 60 * 60 * 1000) : null,
          items: {
            create: orderItems,
          },
        },
      })

      createdOrders++
      const productSummary = orderItems.map(item => `${item.productName.slice(0, 15)}(${item.quantity})`).join(', ')
      console.log(`  ${order.orderNumber}: ${customerName}, ${totalAmount.toLocaleString()}원`)
      console.log(`    └ ${productSummary}`)
    }
  }

  // 요약 출력
  console.log('\n' + '='.repeat(50))
  console.log('더미 주문 데이터 생성 완료!')
  console.log('='.repeat(50))
  console.log(`총 주문 수: ${createdOrders}건`)

  console.log('\n소매밴드별 현황:')
  for (const band of retailBands) {
    const bandOrders = await prisma.order.findMany({
      where: { retailBandId: band.id },
      select: { totalAmount: true },
    })
    const totalAmount = bandOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
    console.log(`  - ${band.name}: ${bandOrders.length}건, ${totalAmount.toLocaleString()}원`)
  }
}

main()
  .catch((e) => {
    console.error('에러:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
