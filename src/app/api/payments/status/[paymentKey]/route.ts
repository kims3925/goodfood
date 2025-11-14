import { NextRequest } from 'next/server'
import { getTossPaymentsService } from '@/domain/payments'
import { successResponse, errorResponse } from '@/lib/http/response'
import { handleServiceError } from '@/lib/errors/handlers'
import prisma from '@/lib/database/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { paymentKey: string } }
) {
  const requestAt = new Date().toISOString()

  try {
    const { paymentKey } = params

    if (!paymentKey) {
      return errorResponse({
        message: 'paymentKey가 필요합니다',
        code: 'VALIDATION_ERROR',
        status: 400,
        requestAt
      })
    }

    // 토스페이먼츠 서비스 인스턴스 생성
    const tossService = await getTossPaymentsService()

    // 토스페이먼츠에서 최신 결제 상태 조회
    const paymentInfo = await tossService.getPayment(paymentKey)

    // 데이터베이스에서 로컬 결제 정보 조회
    const localPayment = await prisma.payment.findFirst({
      where: { paymentKey },
      include: {
        order: {
          include: {
            customer: true,
            items: {
              include: {
                product: true
              }
            }
          }
        },
        refunds: true,
        paymentMethod: true
      }
    })

    // 로컬 정보와 토스페이먼츠 정보를 비교하여 동기화 필요시 업데이트
    if (localPayment && localPayment.status !== paymentInfo.status) {
      console.log(`결제 상태 동기화: ${localPayment.status} -> ${paymentInfo.status}`)

      await prisma.payment.update({
        where: { id: localPayment.id },
        data: {
          status: paymentInfo.status,
          webhookData: JSON.stringify(paymentInfo),
          updatedAt: new Date()
        }
      })

      // 주문 상태도 동기화
      let orderStatus = 'PENDING'
      let paymentStatus = 'PENDING'

      switch (paymentInfo.status) {
        case 'DONE':
          orderStatus = 'CONFIRMED'
          paymentStatus = 'PAID'
          break
        case 'CANCELED':
        case 'ABORTED':
        case 'EXPIRED':
          orderStatus = 'CANCELED'
          paymentStatus = 'FAILED'
          break
        case 'PARTIAL_CANCELED':
          orderStatus = 'PARTIAL_REFUND'
          paymentStatus = 'PARTIAL_REFUND'
          break
        case 'WAITING_FOR_DEPOSIT':
          orderStatus = 'PAYMENT_WAITING'
          paymentStatus = 'PENDING'
          break
      }

      if (localPayment.order) {
        await prisma.order.update({
          where: { id: localPayment.orderId },
          data: {
            status: orderStatus,
            paymentStatus: paymentStatus,
            updatedAt: new Date()
          }
        })
      }
    }

    // 응답 데이터 구성
    return successResponse({
      data: {
        payment: {
          paymentKey: paymentInfo.paymentKey,
          orderId: paymentInfo.orderId,
          orderName: paymentInfo.orderName,
          amount: paymentInfo.totalAmount,
          method: paymentInfo.method,
          status: paymentInfo.status,
          approvedAt: paymentInfo.approvedAt,
          requestedAt: paymentInfo.requestedAt,
          receipt: (paymentInfo as any).receipt,
          card: (paymentInfo as any).card,
          virtualAccount: (paymentInfo as any).virtualAccount,
          transfer: (paymentInfo as any).transfer,
          mobilePhone: (paymentInfo as any).mobilePhone,
          giftCertificate: (paymentInfo as any).giftCertificate,
          discount: (paymentInfo as any).discount,
          cancels: (paymentInfo as any).cancels,
          failure: (paymentInfo as any).failure
        },
        localInfo: localPayment
          ? {
              id: localPayment.id,
              orderId: localPayment.orderId,
              orderInfo: localPayment.order
                ? {
                    orderNumber: localPayment.order.orderNumber,
                    customerName: localPayment.order.customer?.name,
                    productTitle: localPayment.order.items?.[0]?.product?.title || 'Unknown',
                    quantity: localPayment.order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
                    totalAmount: localPayment.order.totalAmount,
                    status: localPayment.order.status,
                    paymentStatus: localPayment.order.paymentStatus
                  }
                : null,
              refunds: localPayment.refunds,
              createdAt: localPayment.createdAt,
              updatedAt: localPayment.updatedAt
            }
          : null
      },
      message: '결제 상태를 조회했습니다',
      code: 'PAYMENT_STATUS_FETCHED',
      requestAt
    })
  } catch (error: any) {
    console.error('결제 상태 조회 오류:', error)

    // 404 오류 (결제가 존재하지 않음)는 별도 처리
    if (error.message && error.message.includes('결제를 찾을 수 없습니다')) {
      return errorResponse({
        message: '결제 정보를 찾을 수 없습니다',
        code: 'NOT_FOUND',
        status: 404,
        requestAt
      })
    }

    const errorInfo = handleServiceError(error)
    return errorResponse({
      message: errorInfo.message,
      code: errorInfo.code,
      status: errorInfo.statusCode,
      meta: { details: errorInfo.details },
      requestAt
    })
  }
}
