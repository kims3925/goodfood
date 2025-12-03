import { PrismaClient, ChannelKind, ChannelPlatform, CustomerOrderStatus } from '@bandauto/db'

const prisma = new PrismaClient()

async function main() {
  console.log('정산 더미데이터 생성 시작...')

  // 1. 기존 사용자 찾기 (SOURCING_USER 역할)
  let user = await prisma.user.findFirst({
    where: { role: 'SOURCING_USER' }
  })

  if (!user) {
    console.log('소싱 사용자가 없어 생성합니다...')
    user = await prisma.user.create({
      data: {
        email: 'test@bandauto.com',
        name: '테스트 관리자',
        role: 'SOURCING_USER',
      }
    })
  }

  console.log(`사용자: ${user.name} (ID: ${user.id})`)

  // 2. 소매채널 3개 생성 (BAND, SHOP, ALIEXPRESS)
  const channelConfigs = [
    {
      name: '패션몰 밴드',
      platform: ChannelPlatform.BAND,
      channelKey: `band_fashion_${Date.now()}`,
      coverUrl: 'https://picsum.photos/seed/band1/200',
    },
    {
      name: '마이 쇼핑몰',
      platform: ChannelPlatform.SHOP,
      channelKey: `shop_main_${Date.now()}`,
      coverUrl: 'https://picsum.photos/seed/shop1/200',
    },
    {
      name: '알리 직구몰',
      platform: ChannelPlatform.ALIEXPRESS,
      channelKey: `ali_direct_${Date.now()}`,
      coverUrl: 'https://picsum.photos/seed/ali1/200',
    },
  ]

  const channels = []
  for (const config of channelConfigs) {
    const channel = await prisma.channel.create({
      data: {
        userId: user.id,
        kind: ChannelKind.RETAIL,
        platform: config.platform,
        channelKey: config.channelKey,
        name: config.name,
        coverUrl: config.coverUrl,
        isActive: true,
        accountHolder: '홍길동',
        bankName: '국민은행',
        bankAccount: '123-456-789012',
      }
    })
    channels.push(channel)
    console.log(`채널 생성: ${channel.name} (${channel.platform})`)
  }

  // 3. 상품 9개 생성 (채널당 3개씩 발행)
  const productNames = [
    // BAND 채널용
    '프리미엄 니트 가디건',
    '캐시미어 터틀넥 스웨터',
    '울 블렌드 코트',
    // SHOP 채널용
    '스마트 무선 이어폰',
    '초고속 충전 케이블',
    '미니 블루투스 스피커',
    // ALIEXPRESS 채널용
    '실리콘 휴대폰 케이스',
    'LED 무드등 조명',
    '다용도 정리함 세트',
  ]

  const products = []
  for (let i = 0; i < productNames.length; i++) {
    const price = Math.floor(Math.random() * 50000) + 10000
    const product = await prisma.product.create({
      data: {
        userId: user.id,
        name: productNames[i],
        description: `${productNames[i]} 상품 설명입니다. 고품질의 제품으로 만족스러운 쇼핑을 약속드립니다.`,
        thumbnailUrl: `https://picsum.photos/seed/product${i}/300`,
        price: price,
      }
    })
    products.push(product)
    console.log(`상품 생성: ${product.name} (${price.toLocaleString()}원)`)
  }

  // 4. PublishedProduct 생성 (각 채널에 상품 3개씩 발행)
  const publishedProducts = []
  for (let channelIdx = 0; channelIdx < channels.length; channelIdx++) {
    for (let productOffset = 0; productOffset < 3; productOffset++) {
      const productIdx = channelIdx * 3 + productOffset
      const pp = await prisma.publishedProduct.create({
        data: {
          userId: user.id,
          productId: products[productIdx].id,
          channelId: channels[channelIdx].id,
          publishedAt: new Date(),
        }
      })
      publishedProducts.push({
        ...pp,
        product: products[productIdx],
        channel: channels[channelIdx],
      })
      console.log(`발행: ${products[productIdx].name} -> ${channels[channelIdx].name}`)
    }
  }

  // 5. 주문 생성 (각 채널별로 3~5개의 주문)
  const customerNames = ['김민수', '이영희', '박철수', '최지영', '정대호', '한소영', '오승민', '강미경']
  const statuses: CustomerOrderStatus[] = ['PAID', 'SHIPPED', 'DELIVERED']

  let orderCount = 0
  for (let channelIdx = 0; channelIdx < channels.length; channelIdx++) {
    const channelPPs = publishedProducts.filter(pp => pp.channel.id === channels[channelIdx].id)
    const numOrders = Math.floor(Math.random() * 3) + 3 // 3~5개

    for (let orderIdx = 0; orderIdx < numOrders; orderIdx++) {
      const customerName = customerNames[Math.floor(Math.random() * customerNames.length)]
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      const orderedAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000) // 최근 30일 내

      // 1~2개 상품 선택
      const numItems = Math.floor(Math.random() * 2) + 1
      const selectedPPs = channelPPs.slice(0, numItems)

      let subtotal = 0
      const orderItems: Array<{
        publishedProductId: number
        productName: string
        thumbnailUrl: string | null
        quantity: number
        unitPrice: number
        totalPrice: number
      }> = []

      for (const pp of selectedPPs) {
        const quantity = Math.floor(Math.random() * 3) + 1
        const unitPrice = pp.product.price || 15000
        const totalPrice = unitPrice * quantity
        subtotal += totalPrice

        orderItems.push({
          publishedProductId: pp.id,
          productName: pp.product.name,
          thumbnailUrl: pp.product.thumbnailUrl,
          quantity,
          unitPrice,
          totalPrice,
        })
      }

      const shippingFee = subtotal >= 50000 ? 0 : 3000
      const totalAmount = subtotal + shippingFee

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          orderNumber: `ORD-${Date.now()}-${orderCount++}`,
          status,
          recipientName: customerName,
          recipientPhone: `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
          postalCode: '12345',
          address: '서울특별시 강남구 테헤란로 123',
          addressDetail: `${Math.floor(Math.random() * 20) + 1}층 ${Math.floor(Math.random() * 100) + 1}호`,
          deliveryMemo: '부재시 경비실에 맡겨주세요',
          subtotalAmount: subtotal,
          shippingFee,
          discountAmount: 0,
          totalAmount,
          orderedAt,
          paidAt: status !== 'PENDING' ? orderedAt : null,
          shippedAt: status === 'SHIPPED' || status === 'DELIVERED' ? new Date(orderedAt.getTime() + 24 * 60 * 60 * 1000) : null,
          deliveredAt: status === 'DELIVERED' ? new Date(orderedAt.getTime() + 3 * 24 * 60 * 60 * 1000) : null,
          items: {
            create: orderItems,
          },
        },
      })

      console.log(`주문 생성: ${order.orderNumber} - ${customerName} (${status}) - ${totalAmount.toLocaleString()}원`)
    }
  }

  console.log('\n=== 더미데이터 생성 완료 ===')
  console.log(`- 소매채널: ${channels.length}개`)
  console.log(`- 상품: ${products.length}개`)
  console.log(`- 발행: ${publishedProducts.length}개`)
  console.log(`- 주문: ${orderCount}개`)
}

main()
  .catch((e) => {
    console.error('오류 발생:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
