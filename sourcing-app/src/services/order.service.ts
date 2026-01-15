import crypto from 'crypto'
import prisma, { Prisma } from '@bandauto/db'
import { calculateSellingPrice, type BundleShippingType } from '@/lib/price-calculator'

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
  memo?: string // 외부 주문 메모
  customTotalAmount?: number // 수동 입력 결제금액 (할인/협의 가격)
}

/**
 * 외부 주문번호 생성
 * 형식: XORD-YYYYMMDD-XXXXXXXXXXXX (eXternal ORDer, 12자리 랜덤 HEX)
 * 날짜는 KST (한국 표준시, UTC+9) 기준
 */
function generateExternalOrderNumber(): string {
  // KST = UTC + 9시간
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000
  const kstDate = new Date(Date.now() + KST_OFFSET_MS)
  const dateStr = kstDate.toISOString().slice(0, 10).replace(/-/g, '')
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
    const { userId, shopId, guestName, guestPhone, guestEmail, shippingAddress, items, memo, customTotalAmount } = params

    return await prisma.$transaction(async (tx) => {
      // 1. Shop Validation (shopId는 필수)
      const shop = await tx.shop.findFirst({
        where: { id: shopId, userId, isActive: true, deletedAt: null },
      })
      if (!shop) {
        throw new Error('유효하지 않은 쇼핑몰입니다.')
      }

      // 2. Fetch ShopProducts (without product include)
      const shopProductIds = items.map(i => i.shopProductId)
      const shopProducts = await tx.shopProduct.findMany({
        where: {
          id: { in: shopProductIds },
          userId,
          deletedAt: null,
        },
      })

      // 3. Fetch Products with soft-delete and active filter
      const productIds = shopProducts
        .map(sp => sp.productId)
        .filter((id): id is number => id != null)

      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          deletedAt: null,
          isActive: true,
        },
        include: {
          variants: {
            where: {
              deletedAt: null,
            },
          },
        },
      })

      // 4. Build productMap for quick lookup
      const productMap = new Map(products.map(p => [p.id, p]))

      // 5. Build shopProductMap with filtered product attached
      const shopProductMap = new Map(
        shopProducts.map(sp => {
          const product = sp.productId ? productMap.get(sp.productId) : null
          return [sp.id, { ...sp, product: product ?? null }]
        })
      )

      // 6. Process Items & Calculate Totals
      const orderItemsData = []
      let subtotal = new Decimal(0)

      for (const item of items) {
        const shopProduct = shopProductMap.get(item.shopProductId)

        if (!shopProduct || !shopProduct.product) {
          throw new Error(`상품을 찾을 수 없습니다. (ID: ${item.shopProductId})`)
        }

        // quantity 검증: 1 이상의 정수여야 함
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          throw new Error(`유효하지 않은 수량입니다. (수량: ${item.quantity}, 상품ID: ${item.shopProductId})`)
        }
        const quantity = item.quantity

        const product = shopProduct.product
        let variant = null
        let basePrice: number // 소매가 (배송비 제외)
        let unitPrice: Prisma.Decimal // 판매가 (배송비 포함 가능)

        // 옵션(variant) 처리
        if (item.variantId) {
          variant = product.variants.find(v => v.id === item.variantId)
          if (!variant) {
            throw new Error(`유효하지 않은 상품 옵션입니다. (variantId: ${item.variantId})`)
          }
          // variant.price가 null/undefined인 경우 product.price로 fallback
          if (variant.price == null) {
            if (product.price == null) {
              throw new Error(`상품 가격이 설정되지 않았습니다. (옵션: ${variant.optionSummary || item.variantId}, 상품: ${product.name})`)
            }
            console.warn(`[External Order] variant.price가 없습니다. product.price로 대체합니다. (variantId: ${item.variantId})`)
            basePrice = product.price
          } else {
            basePrice = variant.price
          }
        } else if (product.variants.length > 0) {
          // 옵션이 있는 상품인데 옵션을 선택하지 않은 경우 에러
          throw new Error(`상품 옵션을 선택해주세요. (상품: ${product.name})`)
        } else {
          // 옵션이 없는 상품: product.price 사용
          if (product.price == null) {
            throw new Error(`상품 가격이 설정되지 않았습니다. (상품: ${product.name})`)
          }
          basePrice = product.price
        }

        // 배송비를 포함한 판매가 계산
        const shippingFee = product.shippingFee || 0
        const bundleShippingType = product.bundleShippingType as BundleShippingType
        const sellingPrice = calculateSellingPrice(basePrice, shippingFee, bundleShippingType)
        unitPrice = new Decimal(sellingPrice)

        // 합배송 규칙 적용: SEPARATE 타입은 배송비를 1회만 부과
        let totalPrice: Prisma.Decimal
        if (bundleShippingType === 'INCLUDED') {
          // 배송비 포함 상품: unitPrice * quantity
          totalPrice = unitPrice.mul(quantity)
        } else {
          // 배송비 별도 상품: (basePrice * quantity) + shippingFee (1회만)
          totalPrice = new Decimal(basePrice).mul(quantity).add(shippingFee)
        }

        subtotal = subtotal.add(totalPrice)

        orderItemsData.push({
          shopProductId: shopProduct.id,
          variantId: variant?.id || null,
          productName: product.name,
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product.thumbnailUrl,
          quantity,
          unitPrice,
          totalPrice,
        })
      }

      // 7. 최종 결제금액 결정
      let finalTotalAmount: Prisma.Decimal
      let discountAmount: Prisma.Decimal

      if (customTotalAmount !== undefined && customTotalAmount !== null) {
        // 수동 입력 금액 사용 (할인/협의 가격)
        finalTotalAmount = new Decimal(customTotalAmount)
        // 할인액 = 자동 계산 금액 - 수동 입력 금액
        discountAmount = subtotal.sub(finalTotalAmount)
      } else {
        // 자동 계산 금액 사용
        finalTotalAmount = subtotal
        discountAmount = new Decimal(0)
      }

      // 8. Create Order
      const order = await tx.guestOrder.create({
        data: {
          shopId,
          orderNumber: generateExternalOrderNumber(),
          status: 'PENDING',
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          guestEmail: guestEmail?.trim() || null,
          subtotalAmount: subtotal,
          discountAmount,
          totalAmount: finalTotalAmount,
          orderedAt: new Date(),
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

      const logMessage = customTotalAmount !== undefined && customTotalAmount !== null
        ? `[External Order] 외부 주문 생성 완료: ${order.orderNumber} (${orderItemsData.length}개 상품, 자동계산: ${subtotal.toString()}원, 최종금액: ${finalTotalAmount.toString()}원, 할인: ${discountAmount.toString()}원)`
        : `[External Order] 외부 주문 생성 완료: ${order.orderNumber} (${orderItemsData.length}개 상품, 총 ${subtotal.toString()}원)`

      console.log(logMessage)

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
