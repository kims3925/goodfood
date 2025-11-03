import { NextRequest, NextResponse } from 'next/server'
import { getTossPaymentsService } from '@/lib/payments/toss-payments'
import prisma from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { paymentKey: string } }
) {
  try {
    const { paymentKey } = params

    if (!paymentKey) {
      return NextResponse.json(
        { success: false, error: 'paymentKey가 필요합니다.' },
        { status: 400 }
      )
    }

    // 토스페이먼츠 서비스 인스턴스 생성 (DB에서 키 조회)
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
            product: true
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
    const responseData = {
      success: true,
      payment: {
        paymentKey: paymentInfo.paymentKey,
        orderId: paymentInfo.orderId,
        orderName: paymentInfo.orderName,
        amount: paymentInfo.totalAmount,
        method: paymentInfo.method,
        status: paymentInfo.status,
        approvedAt: paymentInfo.approvedAt,
        requestedAt: paymentInfo.requestedAt,
        receipt: paymentInfo.receipt,
        card: paymentInfo.card,
        virtualAccount: paymentInfo.virtualAccount,
        transfer: paymentInfo.transfer,
        mobilePhone: paymentInfo.mobilePhone,
        giftCertificate: paymentInfo.giftCertificate,
        discount: paymentInfo.discount,
        cancels: paymentInfo.cancels,
        failure: paymentInfo.failure
      },
      localInfo: localPayment ? {
        id: localPayment.id,
        orderId: localPayment.orderId,
        orderInfo: localPayment.order ? {
          orderNumber: localPayment.order.orderNumber,
          customerName: localPayment.order.customer?.name,
          productTitle: localPayment.order.product?.title,
          quantity: localPayment.order.quantity,
          totalAmount: localPayment.order.totalAmount,
          status: localPayment.order.status,
          paymentStatus: localPayment.order.paymentStatus
        } : null,
        refunds: localPayment.refunds,
        createdAt: localPayment.createdAt,
        updatedAt: localPayment.updatedAt
      } : null
    }

    return NextResponse.json(responseData)

  } catch (error: any) {
    console.error('결제 상태 조회 오류:', error)

    // 404 오류 (결제가 존재하지 않음)는 별도 처리
    if (error.message && error.message.includes('결제를 찾을 수 없습니다')) {
      return NextResponse.json(
        { success: false, error: '결제 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || '결제 상태 조회 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}