import prisma, { Prisma } from '@bandauto/db'

const Decimal = Prisma.Decimal

interface CreateExternalOrderParams {
  userId: number
  shopId: number
  guestName: string
  guestPhone: string
  guestEmail?: string
  shippingAddress: {
    recipientName: string
    recipientPhone: string
    postalCode: string
    address: string
    addressDetail?: string
    deliveryMemo?: string
  }
  items: Array<{
    shopProductId: number
    variantId?: number
    quantity: number
  }>
  memo?: string
}

/**
 * 외부 주문번호 생성
 * 형식: XORD-YYYYMMDD-XXXXXX (eXternal ORDer)
 */
function generateExternalOrderNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()
  return `XORD-${dateStr}-${random}`
}

export const orderService = {
  /**
   * 외부 주문 생성
   * - ShopProduct 일괄 조회 (N+1 방지)
   * - 옵션 검증 및 가격 계산
   * - 트랜잭션 내 주문 생성
   */
  async createExternalOrder(params: CreateExternalOrderParams) {
    const { userId, shopId, guestName, guestPhone, guestEmail, shippingAddress, items, memo } = params

    return await prisma.$transaction(async (tx) => {
      // 1. Shop Validation
      if (shopId) {
        const shop = await tx.shop.findFirst({
          where: { id: shopId, userId, isActive: true, deletedAt: null },
        })
        if (!shop) {
          throw new Error('유효하지 않은 쇼핑몰입니다.')
        }
      }

      // 2. Fetch all ShopProducts in one query
      const shopProductIds = items.map(i => i.shopProductId)
      const shopProducts = await tx.shopProduct.findMany({
        where: {
          id: { in: shopProductIds },
          userId,
          deletedAt: null,
        },
        include: {
          product: {
            include: {
              variants: true,
            },
          },
        },
      })

      const shopProductMap = new Map(shopProducts.map(sp => [sp.id, sp]))

      // 3. Process Items & Calculate Totals
      const orderItemsData = []
      let subtotal = 0

      for (const item of items) {
        const shopProduct = shopProductMap.get(item.shopProductId)

        if (!shopProduct || !shopProduct.product) {
          throw new Error(`상품을 찾을 수 없습니다. (ID: ${item.shopProductId})`)
        }

        const product = shopProduct.product
        let variant = null
        let unitPrice = Number(product.price) || 0

        // 옵션(variant) 처리
        if (item.variantId) {
          variant = product.variants.find(v => v.id === item.variantId)
          if (!variant) {
            throw new Error(`유효하지 않은 상품 옵션입니다. (variantId: ${item.variantId})`)
          }
          unitPrice = Number(variant.price)
        } else if (product.variants.length > 0) {
          // 옵션이 있는 상품인데 옵션을 선택하지 않은 경우 에러
          throw new Error(`상품 옵션을 선택해주세요. (상품: ${product.name})`)
        }

        const quantity = item.quantity || 1
        const totalPrice = unitPrice * quantity
        subtotal += totalPrice

        orderItemsData.push({
          shopProductId: shopProduct.id,
          variantId: variant?.id || null,
          productName: product.name,
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product.thumbnailUrl,
          quantity,
          unitPrice: new Decimal(unitPrice),
          totalPrice: new Decimal(totalPrice),
        })
      }

      // 4. Create Order
      const order = await tx.guestOrder.create({
        data: {
          shopId: shopId || null,
          orderNumber: generateExternalOrderNumber(),
          status: 'PENDING',
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          guestEmail: guestEmail?.trim() || null,
          subtotalAmount: new Decimal(subtotal),
          discountAmount: new Decimal(0),
          totalAmount: new Decimal(subtotal),
          orderedAt: new Date(),
          // 메모가 있으면 cancelReason 필드에 임시 저장
          cancelReason: memo ? `[외부주문 메모] ${memo}` : null,
          shippingAddress: {
            create: {
              recipientName: shippingAddress.recipientName,
              recipientPhone: shippingAddress.recipientPhone,
              postalCode: shippingAddress.postalCode,
              address: shippingAddress.address,
              addressDetail: shippingAddress.addressDetail || null,
              deliveryMemo: shippingAddress.deliveryMemo || null,
            },
          },
          items: {
            create: orderItemsData,
          },
        },
        include: {
          shippingAddress: true,
          items: true,
        },
      })

      console.log(`[External Order] 외부 주문 생성 완료: ${order.orderNumber} (${orderItemsData.length}개 상품, 총 ${subtotal}원)`)

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        itemCount: order.items.length,
      }
    })
  }
}
