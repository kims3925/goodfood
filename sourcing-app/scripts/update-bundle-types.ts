import prisma from '@bandauto/db'

async function updateBundleShippingTypes() {
  // 모든 상품 조회
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      shippingInfo: true,
      shippingFee: true,
      bundleMaxQty: true,
      bundleShippingType: true,
    }
  })

  console.log('총 상품 수:', products.length)

  let includedCount = 0
  let separateCount = 0
  let noneCount = 0
  let updatedCount = 0

  for (const product of products) {
    const shippingInfoStr = String(product.shippingInfo || '')
    const shippingFee = product.shippingFee || 0

    let newType: 'NONE' | 'INCLUDED' | 'SEPARATE' = 'NONE'

    if (shippingInfoStr.includes('포함')) {
      newType = 'INCLUDED'
      includedCount++
    } else if (shippingFee > 0) {
      newType = 'SEPARATE'
      separateCount++
    } else {
      noneCount++
    }

    // 현재 타입과 다르면 업데이트
    if (product.bundleShippingType !== newType) {
      await prisma.product.update({
        where: { id: product.id },
        data: { bundleShippingType: newType }
      })
      console.log(`Updated: [${product.id}] ${product.name?.substring(0, 30)} → ${newType}`)
      updatedCount++
    }
  }

  console.log('\n=== 결과 ===')
  console.log('INCLUDED (배송비 포함형):', includedCount)
  console.log('SEPARATE (배송비 별도형):', separateCount)
  console.log('NONE (합배송 없음):', noneCount)
  console.log('업데이트된 상품 수:', updatedCount)

  await prisma.$disconnect()
}

updateBundleShippingTypes().catch(console.error)
