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

  // PublishedProduct 확인
  const published = await prisma.publishedProduct.findFirst({
    where: { productId: 96 },
    include: {
      shop: true,
    }
  })

  if (published) {
    console.log('\n=== 발행 정보 ===')
    console.log('PublishedProduct ID:', published.id)
    console.log('Shop:', published.shop?.name)
  }

  await prisma.$disconnect()
}

checkProduct().catch(console.error)
