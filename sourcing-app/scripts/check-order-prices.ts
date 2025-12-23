import prisma from '@bandauto/db'

async function checkOrderPrices() {
  // 특정 주문 조회
  const orderNumber = 'ORD-20251223-GB1F0M'

  // 비회원 주문 조회
  const guestOrder = await prisma.guestOrder.findFirst({
    where: { orderNumber },
    include: {
      items: {
        include: {
          variant: true,
          publishedProduct: {
            include: {
              product: {
                include: {
                  variants: true,
                }
              }
            }
          }
        }
      },
      payment: true,
    }
  })

  if (!guestOrder) {
    // 회원 주문 조회
    const memberOrder = await prisma.order.findFirst({
      where: { orderNumber },
      include: {
        items: {
          include: {
            variant: true,
            publishedProduct: {
              include: {
                product: {
                  include: {
                    variants: true,
                  }
                }
              }
            }
          }
        },
        payment: true,
      }
    })

    if (memberOrder) {
      console.log('\n=== 회원 주문 ===')
      console.log('주문번호:', memberOrder.orderNumber)
      console.log('상품금액 (subtotalAmount):', Number(memberOrder.subtotalAmount))
      console.log('배송비 (shippingFee):', Number(memberOrder.shippingFee))
      console.log('할인금액 (discountAmount):', Number(memberOrder.discountAmount))
      console.log('총결제금액 (totalAmount):', Number(memberOrder.totalAmount))
      console.log('결제금액 (payment.amount):', memberOrder.payment ? Number(memberOrder.payment.amount) : 'N/A')

      console.log('\n=== 주문 아이템 ===')
      for (const item of memberOrder.items) {
        const variant = item.variant
        const productVariant = item.publishedProduct?.product?.variants?.[0]

        console.log(`\n[${item.productName}]`)
        console.log('  옵션:', item.optionSummary)
        console.log('  수량:', item.quantity)
        console.log('  단가 (unitPrice):', Number(item.unitPrice))
        console.log('  총가격 (totalPrice):', Number(item.totalPrice))
        console.log('  도매가 (variant.wholesalePrice):', variant?.wholesalePrice ? Number(variant.wholesalePrice) : 'N/A')
        console.log('  상품 도매가 (product.variant.wholesalePrice):', productVariant?.wholesalePrice ? Number(productVariant.wholesalePrice) : 'N/A')
        console.log('  판매가 (variant.price):', variant?.price ? Number(variant.price) : 'N/A')
      }
    } else {
      console.log('주문을 찾을 수 없습니다:', orderNumber)
    }
  } else {
    console.log('\n=== 비회원 주문 ===')
    console.log('주문번호:', guestOrder.orderNumber)
    console.log('상품금액 (subtotalAmount):', Number(guestOrder.subtotalAmount))
    console.log('배송비 (shippingFee):', Number(guestOrder.shippingFee))
    console.log('할인금액 (discountAmount):', Number(guestOrder.discountAmount))
    console.log('총결제금액 (totalAmount):', Number(guestOrder.totalAmount))
    console.log('결제금액 (payment.amount):', guestOrder.payment ? Number(guestOrder.payment.amount) : 'N/A')

    console.log('\n=== 주문 아이템 ===')
    for (const item of guestOrder.items) {
      const variant = item.variant
      const productVariant = item.publishedProduct?.product?.variants?.find(
        v => v.optionSummary === item.optionSummary
      ) || item.publishedProduct?.product?.variants?.[0]

      console.log(`\n[${item.productName}]`)
      console.log('  옵션:', item.optionSummary)
      console.log('  수량:', item.quantity)
      console.log('  단가 (unitPrice):', Number(item.unitPrice))
      console.log('  총가격 (totalPrice):', Number(item.totalPrice))
      console.log('  도매가 (variant.wholesalePrice):', variant?.wholesalePrice ? Number(variant.wholesalePrice) : 'N/A')
      console.log('  상품 도매가 (product.variant.wholesalePrice):', productVariant?.wholesalePrice ? Number(productVariant.wholesalePrice) : 'N/A')
      console.log('  판매가 (variant.price):', variant?.price ? Number(variant.price) : 'N/A')
    }
  }

  await prisma.$disconnect()
}

checkOrderPrices().catch(console.error)
