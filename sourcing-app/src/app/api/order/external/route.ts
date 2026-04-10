export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { orderService } from '@/services/order.service'

interface CreateExternalOrderRequest {
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
    | { isCustom?: false; shopProductId: number; variantId?: number; quantity: number }
    | { isCustom: true; customProductName: string; customUnitPrice: number; quantity: number }
  >
  memo?: string
  customTotalAmount?: number
}

/**
 * POST /api/order/external
 *
 * 외부 주문 생성 (문자, 밴드 댓글 등 외부 경로로 받은 주문)
 * GuestOrder 테이블에 PENDING 상태로 저장
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    let body: CreateExternalOrderRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: '요청 본문(JSON)이 올바르지 않습니다.' },
        { status: 400 }
      )
    }
    const { shopId, guestName, guestPhone, shippingAddress, items } = body

    // 입력 검증
    // shopId 검증: 유효한 양의 정수인지 확인
    if (shopId === undefined || shopId === null) {
      return NextResponse.json(
        { success: false, error: 'shopId는 필수입니다.' },
        { status: 400 }
      )
    }

    if (!Number.isFinite(shopId) || !Number.isInteger(shopId) || shopId <= 0) {
      return NextResponse.json(
        { success: false, error: 'shopId는 유효한 양의 정수여야 합니다.' },
        { status: 400 }
      )
    }

    // 검증된 shopId 값 사용
    const validatedShopId = shopId

    if (!guestName?.trim()) {
      return NextResponse.json(
        { success: false, error: '고객명은 필수입니다.' },
        { status: 400 }
      )
    }

    if (!guestPhone?.trim()) {
      return NextResponse.json(
        { success: false, error: '전화번호는 필수입니다.' },
        { status: 400 }
      )
    }

    if (!shippingAddress?.address || !shippingAddress?.postalCode) {
      return NextResponse.json(
        { success: false, error: '배송 주소는 필수입니다.' },
        { status: 400 }
      )
    }

    if (!shippingAddress?.recipientName || !shippingAddress?.recipientPhone) {
      return NextResponse.json(
        { success: false, error: '수령인 정보는 필수입니다.' },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '주문 상품이 없습니다.' },
        { status: 400 }
      )
    }

    // 각 주문 항목 검증
    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      // quantity 검증: 공통 (양의 정수)
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: `잘못된 주문 항목: ${i + 1}번째 상품의 수량이 유효하지 않습니다.` },
          { status: 400 }
        )
      }

      if (item.isCustom) {
        // 커스텀 상품 검증
        if (!item.customProductName?.trim()) {
          return NextResponse.json(
            { success: false, error: `잘못된 주문 항목: ${i + 1}번째 커스텀 상품의 상품명이 없습니다.` },
            { status: 400 }
          )
        }
        if (!Number.isFinite(item.customUnitPrice) || item.customUnitPrice < 0) {
          return NextResponse.json(
            { success: false, error: `잘못된 주문 항목: ${i + 1}번째 커스텀 상품의 가격이 유효하지 않습니다.` },
            { status: 400 }
          )
        }
      } else {
        // 일반 상품 검증
        if (!Number.isInteger(item.shopProductId) || item.shopProductId <= 0) {
          return NextResponse.json(
            { success: false, error: `잘못된 주문 항목: ${i + 1}번째 상품의 shopProductId가 유효하지 않습니다.` },
            { status: 400 }
          )
        }
        if (item.variantId !== undefined && item.variantId !== null) {
          if (!Number.isInteger(item.variantId) || item.variantId <= 0) {
            return NextResponse.json(
              { success: false, error: `잘못된 주문 항목: ${i + 1}번째 상품의 variantId가 유효하지 않습니다.` },
              { status: 400 }
            )
          }
        }
      }
    }

    // customTotalAmount 검증 (optional이지만 있으면 양의 정수여야 함)
    if (body.customTotalAmount !== undefined && body.customTotalAmount !== null) {
      if (!Number.isInteger(body.customTotalAmount) || body.customTotalAmount < 0) {
        return NextResponse.json(
          { success: false, error: '결제금액은 0 이상의 정수여야 합니다.' },
          { status: 400 }
        )
      }
    }

    try {
      const result = await orderService.createExternalOrder({
        userId: user.userId,
        shopId: validatedShopId,
        guestName,
        guestPhone,
        guestEmail: body.guestEmail,
        shippingAddress,
        items,
        memo: body.memo,
        customTotalAmount: body.customTotalAmount,
      })

      return NextResponse.json({
        success: true,
        data: result,
      })
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message || '주문 생성 중 오류가 발생했습니다.' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('외부 주문 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '외부 주문 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

