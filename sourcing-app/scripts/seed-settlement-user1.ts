import { PrismaClient, ChannelKind, ChannelPlatform, CustomerOrderStatus } from '@bandauto/db'

const prisma = new PrismaClient()

async function main() {
  console.log('userId=1 용 정산 더미데이터 생성 시작...')

  const userId = 1 // 홍성완 (ADMIN)

  // 기존 채널 확인
  const existingChannels = await prisma.channel.findMany({
    where: { userId, kind: ChannelKind.RETAIL }
  })
  console.log(`기존 소매채널: ${existingChannels.length}개`)

  // 채널이 없으면 생성
  let channels = existingChannels
  if (existingChannels.length === 0) {
    const channelConfigs = [
      { name: '패션몰 밴드', platform: ChannelPlatform.BAND, channelKey: `band_${Date.now()}` },
      { name: '스마트스토어 패션', platform: ChannelPlatform.SMARTSTORE, channelKey: `smartstore_${Date.now()}` },
      { name: '알리 직구몰', platform: ChannelPlatform.ALIEXPRESS, channelKey: `ali_${Date.now()}` },
    ]

    for (const config of channelConfigs) {
      const channel = await prisma.channel.create({
        data: {
          userId,
          kind: ChannelKind.RETAIL,
          platform: config.platform,
          channelKey: config.channelKey,
          name: config.name,
          coverUrl: `https://picsum.photos/seed/${config.platform}/200`,
          isActive: true,
        }
      })
      channels.push(channel)
      console.log(`채널 생성: ${channel.name}`)
    }
  }

  // 상품 생성
  const productNames = [
    '프리미엄 니트 가디건', '캐시미어 스웨터', '울 코트',
    '무선 이어폰', '충전 케이블', '블루투스 스피커',
    '휴대폰 케이스', 'LED 조명', '정리함 세트'
  ]

  const products = []
  for (const name of productNames) {
    const price = Math.floor(Math.random() * 50000) + 10000
    const product = await prisma.product.create({
      data: {
        userId,
        name,
        description: `${name} 상품 설명`,
        thumbnailUrl: `https://picsum.photos/seed/${name.replace(/\s/g, '')}/300`,
        variants: {
          create: {
            optionSummary: '기본',
            price,
          }
        }
      },
      include: {
        variants: true,
      }
    })
    products.push(product)
    console.log(`상품 생성: ${name} (${price.toLocaleString()}원)`)
  }

  // PublishedProduct 생성
  const publishedProducts = []
  for (let i = 0; i < channels.length; i++) {
    for (let j = 0; j < 3; j++) {
      const productIdx = i * 3 + j
      if (productIdx >= products.length) break

      const pp = await prisma.publishedProduct.create({
        data: {
          userId,
          productId: products[productIdx].id,
          channelId: channels[i].id,
          publishedAt: new Date(),
        }
      })
      publishedProducts.push({ ...pp, product: products[productIdx], channel: channels[i] })
      console.log(`발행: ${products[productIdx].name} -> ${channels[i].name}`)
    }
  }

  // 주문 생성
  const customerNames = ['김민수', '이영희', '박철수', '최지영', '정대호']
  const statuses: CustomerOrderStatus[] = ['PAID', 'SHIPPED', 'DELIVERED']

  let orderCount = 0
  for (const channel of channels) {
    const channelPPs = publishedProducts.filter(pp => pp.channel.id === channel.id)
    const numOrders = Math.floor(Math.random() * 3) + 3

    for (let i = 0; i < numOrders; i++) {
      const customerName = customerNames[Math.floor(Math.random() * customerNames.length)]
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      const orderedAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)

      const selectedPP = channelPPs[Math.floor(Math.random() * channelPPs.length)]
      if (!selectedPP) continue

      const quantity = Math.floor(Math.random() * 3) + 1
      const unitPrice = (selectedPP.product as any).variants?.[0]?.price || 15000
      const totalPrice = unitPrice * quantity
      const shippingFee = totalPrice >= 50000 ? 0 : 3000

      await prisma.order.create({
        data: {
          userId,
          orderNumber: `ORD-${Date.now()}-${orderCount++}`,
          status,
          recipientName: customerName,
          recipientPhone: `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
          postalCode: '12345',
          address: '서울시 강남구 테헤란로 123',
          subtotalAmount: totalPrice,
          shippingFee,
          discountAmount: 0,
          totalAmount: totalPrice + shippingFee,
          orderedAt,
          paidAt: orderedAt,
          shippedAt: status === 'SHIPPED' || status === 'DELIVERED' ? new Date(orderedAt.getTime() + 86400000) : null,
          deliveredAt: status === 'DELIVERED' ? new Date(orderedAt.getTime() + 3 * 86400000) : null,
          items: {
            create: [{
              publishedProductId: selectedPP.id,
              productName: selectedPP.product.name,
              thumbnailUrl: selectedPP.product.thumbnailUrl,
              quantity,
              unitPrice,
              totalPrice,
            }]
          }
        }
      })
      console.log(`주문: ${customerName} - ${selectedPP.product.name} - ${(totalPrice + shippingFee).toLocaleString()}원`)
    }
  }

  console.log(`\n=== 완료: ${orderCount}개 주문 생성 ===`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
