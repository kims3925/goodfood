/**
 * 무통장입금 기한 초과 주문 자동 취소 스케줄러
 * Prisma 직접 호출 방식 (HTTP fetch 불필요)
 */

import prisma, { CustomerOrderStatus, TossPaymentStatus } from '@bandauto/db'

const INTERVAL = 10 * 60 * 1000 // 10분

/**
 * 자동 취소 스케줄러 시작
 */
export function startExpiredOrderCanceller(): void {
  console.log('[AutoCancel] 자동 취소 스케줄러 시작 (10분 간격)')

  // 초기 실행 (서버 시작 후 1분 뒤)
  setTimeout(() => {
    cancelExpiredOrders()
  }, 60 * 1000)

  // 주기적 실행
  setInterval(() => {
    cancelExpiredOrders()
  }, INTERVAL)
}

/**
 * 입금 기한 초과 주문 취소 실행
 */
async function cancelExpiredOrders(): Promise<void> {
  try {
    const now = new Date()

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

    if (expiredOrders.length === 0) return

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

        console.log(`[AutoCancel] 주문 ${order.orderNumber} 자동 취소 완료`)
      } catch (error) {
        console.error(`[AutoCancel] 주문 ${order.orderNumber} 취소 실패:`, error)
      }
    }

    console.log(`[AutoCancel] ${expiredOrders.length}개 주문 자동 취소됨`)
  } catch (error) {
    console.error('[AutoCancel] 자동 취소 실행 실패:', error)
  }
}
