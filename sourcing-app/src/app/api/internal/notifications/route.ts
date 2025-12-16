import { NextRequest, NextResponse } from 'next/server'
import {
  createOrderNotification,
  createCancelNotification,
  createRefundNotification,
  createInquiryNotification,
  createSettlementNotification,
} from '@/services/notification.service'

/**
 * POST /api/internal/notifications
 * 내부 API - 알림 생성 (shop-app에서 호출)
 *
 * Body:
 * {
 *   type: 'ORDER' | 'CANCEL' | 'REFUND' | 'INQUIRY' | 'SETTLEMENT',
 *   shopId: number,
 *   data: { ... } // 타입별 데이터
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 내부 API 인증 (간단한 헤더 체크 - 프로덕션에서는 더 강력한 인증 필요)
    const internalKey = request.headers.get('x-internal-key')
    if (internalKey !== process.env.INTERNAL_API_KEY && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { type, shopId, data } = body

    if (!type || !shopId || !data) {
      return NextResponse.json(
        { success: false, error: 'type, shopId, data are required' },
        { status: 400 }
      )
    }

    switch (type) {
      case 'ORDER':
        await createOrderNotification(shopId, {
          id: data.id,
          orderNumber: data.orderNumber,
          totalAmount: data.totalAmount,
          customerName: data.customerName,
        })
        break

      case 'CANCEL':
        await createCancelNotification(shopId, {
          id: data.id,
          orderNumber: data.orderNumber,
          customerName: data.customerName,
        })
        break

      case 'REFUND':
        await createRefundNotification(shopId, {
          id: data.id,
          orderNumber: data.orderNumber,
          type: data.returnType,
          customerName: data.customerName,
        })
        break

      case 'INQUIRY':
        await createInquiryNotification(shopId, {
          id: data.id,
          title: data.title,
          type: data.inquiryType,
          customerName: data.customerName,
        })
        break

      case 'SETTLEMENT':
        await createSettlementNotification(shopId, {
          id: data.id,
          periodStart: data.periodStart ? new Date(data.periodStart) : undefined,
          periodEnd: data.periodEnd ? new Date(data.periodEnd) : undefined,
          totalAmount: data.totalAmount,
        })
        break

      default:
        return NextResponse.json(
          { success: false, error: `Unknown notification type: ${type}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: `${type} notification created`,
    })
  } catch (error) {
    console.error('Internal notification API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}
