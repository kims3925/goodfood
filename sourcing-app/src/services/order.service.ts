import crypto from 'crypto'
import prisma, { Prisma } from '@bandauto/db'
import { calculateSellingPrice, type BundleShippingType } from '@/lib/price-calculator'
import { sendExternalOrderWebhook } from '@/services/order-webhook.service'

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
  items: Array<
    | {
        isCustom?: false
        shopProductId: number
        variantId?: number
        quantity: number
      }
    | {
        isCustom: true
        customProductName: string
        customUnitPrice: number
        quantity: number
      }
  >
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

      // 2. 일반 상품 / 커스텀 상품 분리
      const regularItems = items.filter((i): i is Extract<typeof i, { isCustom?: false }> => !i.isCustom)
      const customItems = items.filter((i): i is Extract<typeof i, { isCustom: true }> => i.isCustom === true)

      // 3. Fetch ShopProducts (일반 상품만)
      const shopProductIds = regularItems.map(i => i.shopProductId)
      const shopProducts = shopProductIds.length > 0
        ? await tx.shopProduct.findMany({
            where: { id: { in: shopProductIds }, userId, deletedAt: null },
          })
        : []

      // 4. Fetch Products with soft-delete and active filter
      const productIds = shopProducts
        .map(sp => sp.productId)
        .filter((id): id is number => id != null)

      const products = productIds.length > 0
        ? await tx.product.findMany({
            where: { id: { in: productIds }, deletedAt: null, isActive: true },
            include: { variants: { where: { deletedAt: null } } },
          })
        : []

      // 5. Build lookup maps
      const productMap = new Map(products.map(p => [p.id, p]))
      const shopProductMap = new Map(
        shopProducts.map(sp => {
          const product = sp.productId ? productMap.get(sp.productId) : null
          return [sp.id, { ...sp, product: product ?? null }]
        })
      )

      // 6. Process Items & Calculate Totals
      const orderItemsData: Array<{
        shopProductId: number | null
        variantId: number | null
        productName: string
        optionSummary: string | null
        thumbnailUrl: string | null
        isCustomItem: boolean
        quantity: number
        unitPrice: Prisma.Decimal
        totalPrice: Prisma.Decimal
      }> = []
      let subtotal = new Decimal(0)

      // 6-A. 일반 상품 처리
      for (const item of regularItems) {
        const shopProduct = shopProductMap.get(item.shopProductId)

        if (!shopProduct || !shopProduct.product) {
          throw new Error(`상품을 찾을 수 없습니다. (ID: ${item.shopProductId})`)
        }

        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          throw new Error(`유효하지 않은 수량입니다. (수량: ${item.quantity}, 상품ID: ${item.shopProductId})`)
        }
        const quantity = item.quantity

        const product = shopProduct.product
        let variant = null
        let basePrice: number
        let unitPrice: Prisma.Decimal

        if (item.variantId) {
          variant = product.variants.find(v => v.id === item.variantId)
          if (!variant) {
            throw new Error(`유효하지 않은 상품 옵션입니다. (variantId: ${item.variantId})`)
          }
          if (variant.price == null) {
            if (product.price == null) {
              throw new Error(`상품 가격이 설정되지 않았습니다. (옵션: ${variant.optionSummary || item.variantId}, 상품: ${product.name})`)
            }
            basePrice = product.price
          } else {
            basePrice = variant.price
          }
        } else if (product.variants.length > 0) {
          throw new Error(`상품 옵션을 선택해주세요. (상품: ${product.name})`)
        } else {
          if (product.price == null) {
            throw new Error(`상품 가격이 설정되지 않았습니다. (상품: ${product.name})`)
          }
          basePrice = product.price
        }

        const shippingFee = product.shippingFee || 0
        const bundleShippingType = product.bundleShippingType as BundleShippingType
        const sellingPrice = calculateSellingPrice(basePrice, shippingFee, bundleShippingType)
        unitPrice = new Decimal(sellingPrice)

        let totalPrice: Prisma.Decimal
        if (bundleShippingType === 'INCLUDED') {
          totalPrice = unitPrice.mul(quantity)
        } else {
          totalPrice = new Decimal(basePrice).mul(quantity).add(shippingFee)
        }

        subtotal = subtotal.add(totalPrice)
        orderItemsData.push({
          shopProductId: shopProduct.id,
          variantId: variant?.id || null,
          productName: product.name,
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product.thumbnailUrl,
          isCustomItem: false,
          quantity,
          unitPrice,
          totalPrice,
        })
      }

      // 6-B. 커스텀 상품 처리 (카탈로그 미등록 상품 직접 입력)
      for (const item of customItems) {
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          throw new Error(`유효하지 않은 수량입니다. (수량: ${item.quantity}, 상품: ${item.customProductName})`)
        }
        const quantity = item.quantity
        const unitPrice = new Decimal(item.customUnitPrice)
        const totalPrice = unitPrice.mul(quantity)

        subtotal = subtotal.add(totalPrice)
        orderItemsData.push({
          shopProductId: null,
          variantId: null,
          productName: item.customProductName,
          optionSummary: null,
          thumbnailUrl: null,
          isCustomItem: true,
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

      // 외부 웹훅 알림 (슬랙/디스코드)
      sendExternalOrderWebhook({
        orderNumber: order.orderNumber,
        customerName: guestName,
        totalAmount: Number(order.totalAmount),
        items: orderItemsData.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          options: item.optionSummary || undefined,
        })),
        shopName: shop.name || undefined,
      })

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
