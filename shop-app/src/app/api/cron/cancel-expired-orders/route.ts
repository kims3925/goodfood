export const dynamic = 'force-dynamic'

/**
 * 입금 기한 초과 주문 자동 취소 API
 * 무통장입금 주문 중 입금 기한이 지난 PENDING 상태 주문을 자동 취소
 */

import { NextResponse } from 'next/server'
import prisma, { CustomerOrderStatus, TossPaymentStatus } from '@bandauto/db'

export async function GET() {
  try {
    const now = new Date()

    // 입금 기한이 지난 PENDING 상태의 무통장입금 주문 조회
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: CustomerOrderStatus.PENDING,
        payment: {
          method: 'BANK_TRANSFER',
          virtualAccountDueDate: {
            lt: now, // 현재 시간보다 이전 (기한 초과)
          },
        },
      },
      include: {
        payment: true,
        userCoupons: true,
      },
    })

    if (expiredOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: '취소할 주문이 없습니다.',
        cancelledCount: 0,
      })
    }

    // 각 주문을 취소 처리
    const cancelledOrderIds: number[] = []
    const errors: string[] = []

    for (const order of expiredOrders) {
      try {
        await prisma.$transaction(async (tx) => {
          // 1. 주문 상태를 CANCELLED로 변경
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: CustomerOrderStatus.CANCELLED,
              cancelledAt: now,
              cancelReason: '입금 기한 초과로 자동 취소',
            },
          })

          // 2. 결제 상태를 CANCELED로 변경
          if (order.payment) {
            await tx.payment.update({
              where: { id: order.payment.id },
              data: {
                status: TossPaymentStatus.CANCELED,
              },
            })
          }

          // 3. 연결된 쿠폰이 있다면 연결 해제 (사용 안 함 상태 유지)
          if (order.userCoupons && order.userCoupons.length > 0) {
            await tx.userCoupon.updateMany({
              where: { orderId: order.id },
              data: {
                orderId: null,
                isUsed: false,
              },
            })
          }
        })

        cancelledOrderIds.push(order.id)
        console.log(`[AutoCancel] 주문 ${order.orderNumber} 자동 취소 완료`)
      } catch (error) {
        const errorMsg = `주문 ${order.orderNumber} 취소 실패: ${error}`
        console.error(`[AutoCancel] ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${cancelledOrderIds.length}개 주문 자동 취소 완료`,
      cancelledCount: cancelledOrderIds.length,
      cancelledOrderIds,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[AutoCancel] 자동 취소 처리 실패:', error)
    return NextResponse.json(
      { success: false, error: '자동 취소 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
