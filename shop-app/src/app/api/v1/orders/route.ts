/**
 * 오픈 API v1 발주 (STEP 4-3)
 *
 * POST /api/v1/orders (scope: orders:write) — 발주 생성
 *   body: {
 *     items: [{ variant_id: number, quantity: number }],
 *     receiver: { name, phone, address, postal_code, address_detail?, delivery_memo? }
 *   }
 *   - 단가 = variant 공급가(wholesalePrice, 없으면 소매가 폴백)
 *   - 배송비 = 상품별 shippingFee 1회 합산 (bundleShippingType=INCLUDED 면 0)
 *   - 결제: 1차는 무통장/관리자 확인 흐름 (Order.status=PENDING, orderType=B2B_API)
 *
 * GET /api/v1/orders (scope: orders:read) — 내 발주 목록 (limit/offset, status 필터)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { Prisma } from '@bandauto/db'
import { authenticateApiRequest, logApiCall, parsePagination, apiError } from '@/lib/openapi/auth'
import { formatOrderForApi } from '@/lib/openapi/orders'
import { generateOrderNumber } from '@/lib/order-utils'

const Decimal = Prisma.Decimal

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'orders:read')
  if (auth instanceof NextResponse) return auth

  try {
    const { limit, offset } = parsePagination(req)
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: any = {
      userId: auth.userId,
      orderType: 'B2B_API',
      ...(status ? { status } : {}),
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: { items: true, shippingAddress: true },
        orderBy: { id: 'desc' },
        skip: offset,
        take: limit,
      }),
    ])

    const res = NextResponse.json({
      data: orders.map(formatOrderForApi),
      pagination: { limit, offset, total },
    })
    logApiCall(auth, req, 200)
    return res
  } catch (error: any) {
    console.error('[OpenAPI orders GET]', error)
    logApiCall(auth, req, 500)
    return apiError(500, 'INTERNAL_ERROR', '발주 목록 조회에 실패했습니다.')
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'orders:write')
  if (auth instanceof NextResponse) return auth

  let body: any
  try {
    body = await req.json()
  } catch {
    logApiCall(auth, req, 400)
    return apiError(400, 'INVALID_BODY', 'JSON 본문이 필요합니다.')
  }

  const items: { variant_id: number; quantity: number }[] = Array.isArray(body?.items) ? body.items : []
  const receiver = body?.receiver || {}

  if (items.length === 0) {
    logApiCall(auth, req, 400)
    return apiError(400, 'EMPTY_ITEMS', 'items 가 비어 있습니다. [{ variant_id, quantity }] 형식으로 전달하세요.')
  }
  if (items.length > 50) {
    logApiCall(auth, req, 400)
    return apiError(400, 'TOO_MANY_ITEMS', '발주당 최대 50개 품목까지 가능합니다.')
  }
  if (!receiver.name || !receiver.phone || !receiver.address || !receiver.postal_code) {
    logApiCall(auth, req, 400)
    return apiError(400, 'INVALID_RECEIVER', 'receiver { name, phone, address, postal_code } 는 필수입니다.')
  }

  try {
    // 품목 검증 + 단가 계산 (공급가 기준)
    const orderItems: {
      shopProductId: number
      variantId: number
      productName: string
      optionSummary: string | null
      thumbnailUrl: string | null
      quantity: number
      unitPrice: number
      totalPrice: number
    }[] = []
    const shippingByProduct = new Map<number, number>() // productId → 배송비 (1회)
    let shopId: number | null = null

    for (const item of items) {
      const variantId = Number(item.variant_id)
      const quantity = Math.floor(Number(item.quantity))
      if (!Number.isFinite(variantId) || variantId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
        logApiCall(auth, req, 400)
        return apiError(400, 'INVALID_ITEM', `잘못된 품목: variant_id=${item.variant_id}, quantity=${item.quantity}`)
      }

      const variant = await prisma.productVariant.findFirst({
        where: { id: variantId, deletedAt: null },
        include: {
          product: {
            include: { shopProducts: { where: { deletedAt: null }, take: 1 } },
          },
        },
      })

      if (!variant || !variant.product || variant.product.deletedAt) {
        logApiCall(auth, req, 404)
        return apiError(404, 'VARIANT_NOT_FOUND', `variant ${variantId} 를 찾을 수 없습니다.`)
      }
      const product = variant.product
      if (!product.isActive) {
        logApiCall(auth, req, 409)
        return apiError(409, 'PRODUCT_INACTIVE', `상품 '${product.name}' 은(는) 현재 판매 중이 아닙니다 (${product.sourceStatus}).`)
      }
      const shopProduct = product.shopProducts[0]
      if (!shopProduct) {
        logApiCall(auth, req, 409)
        return apiError(409, 'PRODUCT_NOT_PUBLISHED', `상품 '${product.name}' 은(는) 발주 가능한 상태가 아닙니다.`)
      }
      if (shopId === null) shopId = shopProduct.shopId

      // 단가: 공급가 우선, 없으면 소매가 폴백
      const wholesale = variant.wholesalePrice != null ? Number(variant.wholesalePrice) : 0
      const unitPrice = wholesale > 0 ? Math.round(wholesale) : variant.price

      // 배송비: 상품당 1회 (INCLUDED 면 0)
      if (!shippingByProduct.has(product.id)) {
        const fee = product.bundleShippingType === 'INCLUDED' ? 0 : (product.shippingFee ?? 0)
        shippingByProduct.set(product.id, fee)
      }

      orderItems.push({
        shopProductId: shopProduct.id,
        variantId: variant.id,
        productName: product.name,
        optionSummary: variant.optionSummary,
        thumbnailUrl: product.thumbnailUrl,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
      })
    }

    const subtotal = orderItems.reduce((sum, i) => sum + i.totalPrice, 0)
    const shippingTotal = [...shippingByProduct.values()].reduce((a, b) => a + b, 0)
    const totalAmount = subtotal + shippingTotal

    const order = await prisma.order.create({
      data: {
        userId: auth.userId,
        shopId,
        orderNumber: generateOrderNumber(),
        status: 'PENDING', // 무통장/관리자 확인 흐름 (1차)
        orderType: 'B2B_API',
        subtotalAmount: new Decimal(subtotal),
        discountAmount: new Decimal(0),
        totalAmount: new Decimal(totalAmount),
        items: {
          create: orderItems.map((i) => ({
            shopProductId: i.shopProductId,
            variantId: i.variantId,
            productName: i.productName,
            optionSummary: i.optionSummary,
            thumbnailUrl: i.thumbnailUrl,
            quantity: i.quantity,
            unitPrice: new Decimal(i.unitPrice),
            totalPrice: new Decimal(i.totalPrice),
          })),
        },
        shippingAddress: {
          create: {
            recipientName: String(receiver.name).slice(0, 100),
            recipientPhone: String(receiver.phone).slice(0, 20),
            address: String(receiver.address).slice(0, 500),
            postalCode: String(receiver.postal_code).slice(0, 10),
            addressDetail: receiver.address_detail ? String(receiver.address_detail).slice(0, 500) : null,
            deliveryMemo: receiver.delivery_memo ? String(receiver.delivery_memo).slice(0, 500) : null,
          },
        },
      },
      include: { items: true, shippingAddress: true },
    })

    const res = NextResponse.json(
      {
        data: {
          ...formatOrderForApi(order),
          shipping_amount: shippingTotal,
          payment_method: 'BANK_TRANSFER',
          message: '발주가 접수되었습니다. 무통장 입금 확인 후 처리됩니다.',
        },
      },
      { status: 201 }
    )
    logApiCall(auth, req, 201)
    return res
  } catch (error: any) {
    console.error('[OpenAPI orders POST]', error)
    logApiCall(auth, req, 500)
    return apiError(500, 'INTERNAL_ERROR', '발주 생성에 실패했습니다.')
  }
}
