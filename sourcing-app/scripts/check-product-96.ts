import prisma from '@bandauto/db'

async function checkProduct() {
  const product = await prisma.product.findFirst({
    where: { id: 96 },
    include: {
      variants: true,
    }
  })

  if (!product) {
    console.log('상품을 찾을 수 없습니다.')
    return
  }

  console.log('=== 상품 정보 ===')
  console.log('ID:', product.id)
  console.log('이름:', product.name)
  console.log('배송비:', product.shippingFee)
  console.log('합배송 최대:', product.bundleMaxQty)
  console.log('합배송 타입:', product.bundleShippingType)

  console.log('\n=== 옵션(Variants) ===')
  for (const v of product.variants) {
    console.log(`  [${v.id}] ${v.optionSummary}`)
    console.log(`    - price: ${v.price}`)
    console.log(`    - wholesalePrice: ${v.wholesalePrice}`)
    console.log(`    - bundleUnit: ${v.bundleUnit}`)
  }

  // ShopProduct 확인
  const shopProduct = await prisma.shopProduct.findFirst({
    where: { productId: 96 },
    include: {
      shop: true,
    }
  })

  if (shopProduct) {
    console.log('\n=== Shop 발행 정보 ===')
    console.log('ShopProduct ID:', shopProduct.id)
    console.log('Shop:', shopProduct.shop?.name)
  }

  // ChannelProduct 확인
  const channelProduct = await prisma.channelProduct.findFirst({
    where: { productId: 96 },
    include: {
      channel: true,
    }
  })

  if (channelProduct) {
    console.log('\n=== Channel 발행 정보 ===')
    console.log('ChannelProduct ID:', channelProduct.id)
    console.log('Channel:', channelProduct.channel?.name)
  }

  await prisma.$disconnect()
}

checkProduct().catch(console.error)
