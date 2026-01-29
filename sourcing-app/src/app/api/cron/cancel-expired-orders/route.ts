export const dynamic = 'force-dynamic'

/**
 * 입금 기한 초과 주문 자동 취소 API
 * 무통장입금 주문 중 입금 기한이 지난 PENDING 상태 주문을 자동 취소 (회원 + 비회원)
 */

import { NextResponse } from 'next/server'
import prisma, { CustomerOrderStatus, TossPaymentStatus } from '@bandauto/db'

export async function GET() {
  try {
    const now = new Date()
    const cancelledOrderIds: number[] = []
    const cancelledGuestOrderIds: number[] = []
    const errors: string[] = []

    // 1. 회원 주문 자동 취소
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: CustomerOrderStatus.PENDING,
        payment: {
          method: 'BANK_TRANSFER',
          virtualAccountDueDate: {
            lt: now,
          },
        },
      },
      include: {
        payment: true,
      },
    })

    for (const order of expiredOrders) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: CustomerOrderStatus.CANCELLED,
              cancelledAt: now,
              cancelReason: '입금 기한 초과로 자동 취소',
            },
          })

          if (order.payment) {
            await tx.payment.update({
              where: { id: order.payment.id },
              data: {
                status: TossPaymentStatus.CANCELED,
              },
            })
          }

          await tx.userCoupon.updateMany({
            where: { orderId: order.id },
            data: {
              orderId: null,
              isUsed: false,
            },
          })
        })

        cancelledOrderIds.push(order.id)
        console.log(`[AutoCancel] 회원 주문 ${order.orderNumber} 자동 취소 완료`)
      } catch (error) {
        const errorMsg = `회원 주문 ${order.orderNumber} 취소 실패: ${error}`
        console.error(`[AutoCancel] ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    // 2. 비회원 주문 자동 취소
    const expiredGuestOrders = await prisma.guestOrder.findMany({
      where: {
        status: CustomerOrderStatus.PENDING,
        payment: {
          method: 'BANK_TRANSFER',
          virtualAccountDueDate: {
            lt: now,
          },
        },
      },
      include: {
        payment: true,
      },
    })

    for (const guestOrder of expiredGuestOrders) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.guestOrder.update({
            where: { id: guestOrder.id },
            data: {
              status: CustomerOrderStatus.CANCELLED,
              cancelledAt: now,
              cancelReason: '입금 기한 초과로 자동 취소',
            },
          })

          if (guestOrder.payment) {
            await tx.guestPayment.update({
              where: { id: guestOrder.payment.id },
              data: {
                status: TossPaymentStatus.CANCELED,
              },
            })
          }
        })

        cancelledGuestOrderIds.push(guestOrder.id)
        console.log(`[AutoCancel] 비회원 주문 ${guestOrder.orderNumber} 자동 취소 완료`)
      } catch (error) {
        const errorMsg = `비회원 주문 ${guestOrder.orderNumber} 취소 실패: ${error}`
        console.error(`[AutoCancel] ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    const totalCancelled = cancelledOrderIds.length + cancelledGuestOrderIds.length

    return NextResponse.json({
      success: true,
      message: totalCancelled > 0
        ? `${totalCancelled}개 주문 자동 취소 완료 (회원: ${cancelledOrderIds.length}, 비회원: ${cancelledGuestOrderIds.length})`
        : '취소할 주문이 없습니다.',
      cancelledCount: totalCancelled,
      cancelledOrderIds,
      cancelledGuestOrderIds,
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
