export const dynamic = 'force-dynamic'

/**
 * Payment Status API
 * 결제 상태 조회 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma, { TossPaymentStatus } from '@bandauto/db'
import {
  TOSS_ERROR_CODES,
  getErrorDetails
} from '@/modules/payments/constants/toss-error-codes'

const TOSS_SECRET_KEY = process.env.TOSS_PAYMENTS_SECRET_KEY || ''
const TOSS_API_URL = 'https://api.tosspayments.com/v1/payments'

interface PaymentStatusResponse {
  success: boolean
  payment?: {
    paymentKey: string
    orderId: string
    orderNumber: string
    status: string
    statusLabel: string
    method: string
    methodLabel: string
    amount: number
    approvedAt: Date | null
    cancelledAt: Date | null
    cancelledAmount: number
    card?: {
      company: string
      number: string
      installmentMonth: number
    } | null
    virtualAccount?: {
      accountNumber: string
      bank: string
      dueDate: Date | null
    } | null
    order: {
      id: number
      status: string
      statusLabel: string
      customerName: string
      totalAmount: number
    }
  }
  error?: {
    code: string
    message: string
  }
}

/**
 * GET /api/payments/status
 * 결제 상태 조회
 *
 * Query Parameters:
 * - paymentKey: 토스 결제 키
 * - orderId: 주문번호 (orderNumber)
 *
 * 둘 중 하나는 필수
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // 인증 확인 (비회원 결제도 있을 수 있어서 선택적)
    const userId = session?.user?.id ? parseInt(session.user.id) : null
    const isAdmin = session?.user?.role === 'ADMIN'

    const { searchParams } = new URL(req.url)
    const paymentKey = searchParams.get('paymentKey')
    const orderId = searchParams.get('orderId')

    // 파라미터 검증
    if (!paymentKey && !orderId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.INVALID_REQUEST,
            message: 'paymentKey 또는 orderId가 필요합니다'
          }
        },
        { status: 400 }
      )
    }

    // DB에서 결제 정보 조회
    let payment
    if (paymentKey) {
      payment = await prisma.payment.findUnique({
        where: { paymentKey },
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      })
    } else if (orderId) {
      const order = await prisma.order.findUnique({
        where: { orderNumber: orderId },
        include: {
          payment: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })
      if (order?.payment) {
        payment = {
          ...order.payment,
          order: {
            ...order,
            user: order.user
          }
        }
      }
    }

    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.INVALID_REQUEST,
            message: '결제 정보를 찾을 수 없습니다'
          }
        },
        { status: 404 }
      )
    }

    // 권한 확인 (본인 주문 또는 관리자)
    if (!isAdmin && userId !== payment.order.userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '조회 권한이 없습니다'
          }
        },
        { status: 403 }
      )
    }

    // 토스페이먼츠 API에서 최신 상태 조회 (선택적)
    let tossStatus = null
    if (payment.paymentKey) {
      try {
        const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')
        const tossResponse = await fetch(`${TOSS_API_URL}/${payment.paymentKey}`, {
          headers: {
            'Authorization': `Basic ${authHeader}`,
          }
        })

        if (tossResponse.ok) {
          tossStatus = await tossResponse.json()

          // 상태가 다르면 DB 업데이트
          if (tossStatus.status !== payment.status) {
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: mapPaymentStatus(tossStatus.status),
                rawResponse: JSON.stringify(tossStatus)
              }
            })
            payment.status = mapPaymentStatus(tossStatus.status)
          }
        }
      } catch (error) {
        console.warn('토스 API 조회 실패 (DB 캐시 사용):', error)
      }
    }

    // 응답 구성
    const response: PaymentStatusResponse = {
      success: true,
      payment: {
        paymentKey: payment.paymentKey || '',
        orderId: payment.tossOrderId || '',
        orderNumber: payment.order.orderNumber,
        status: payment.status,
        statusLabel: getPaymentStatusLabel(payment.status),
        method: payment.method,
        methodLabel: getPaymentMethodLabel(payment.method),
        amount: Number(payment.amount),
        approvedAt: payment.approvedAt,
        cancelledAt: payment.cancelledAt,
        cancelledAmount: Number(payment.cancelledAmount || 0),
        card: payment.cardCompany ? {
          company: payment.cardCompany,
          number: payment.cardNumber || '',
          installmentMonth: payment.installmentMonth || 0
        } : null,
        virtualAccount: payment.virtualAccountNumber ? {
          accountNumber: payment.virtualAccountNumber,
          bank: payment.virtualAccountBank || '',
          dueDate: payment.virtualAccountDueDate
        } : null,
        order: {
          id: payment.order.id,
          status: payment.order.status,
          statusLabel: getOrderStatusLabel(payment.order.status),
          customerName: payment.order.user?.name || '비회원',
          totalAmount: Number(payment.order.totalAmount)
        }
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('결제 상태 조회 오류:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: TOSS_ERROR_CODES.FAILED_DB_PROCESSING,
          message: error.message || '결제 상태 조회 중 오류가 발생했습니다'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/payments/status
 * 토스페이먼츠 API에서 최신 상태 동기화
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { paymentKey } = body

    if (!paymentKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.INVALID_REQUEST,
            message: 'paymentKey가 필요합니다'
          }
        },
        { status: 400 }
      )
    }

    // 기존 결제 정보 조회
    const payment = await prisma.payment.findUnique({
      where: { paymentKey },
      include: {
        order: true
      }
    })

    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.INVALID_REQUEST,
            message: '결제 정보를 찾을 수 없습니다'
          }
        },
        { status: 404 }
      )
    }

    // 토스페이먼츠 API에서 최신 상태 조회
    const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')
    const tossResponse = await fetch(`${TOSS_API_URL}/${paymentKey}`, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
      }
    })

    if (!tossResponse.ok) {
      const errorData = await tossResponse.json()
      const errorDetails = getErrorDetails(errorData.code)

      return NextResponse.json(
        {
          success: false,
          error: {
            code: errorData.code,
            message: errorDetails.message || errorData.message,
            solution: errorDetails.solution
          }
        },
        { status: 400 }
      )
    }

    const tossData = await tossResponse.json()

    // DB 업데이트
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: mapPaymentStatus(tossData.status),
        approvedAt: tossData.approvedAt ? new Date(tossData.approvedAt) : payment.approvedAt,
        rawResponse: JSON.stringify(tossData)
      }
    })

    // 주문 상태도 동기화
    let orderStatus = payment.order.status
    if (tossData.status === 'DONE' && payment.order.status === 'PENDING') {
      orderStatus = 'PAID'
      await prisma.order.update({
        where: { id: payment.order.id },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      })
    } else if (tossData.status === 'CANCELED') {
      orderStatus = 'CANCELLED'
      await prisma.order.update({
        where: { id: payment.order.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      synchronized: true,
      payment: {
        paymentKey: updatedPayment.paymentKey,
        status: updatedPayment.status,
        statusLabel: getPaymentStatusLabel(updatedPayment.status),
        tossStatus: tossData.status
      },
      order: {
        status: orderStatus,
        statusLabel: getOrderStatusLabel(orderStatus)
      }
    })

  } catch (error: any) {
    console.error('결제 상태 동기화 오류:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: TOSS_ERROR_CODES.FAILED_DB_PROCESSING,
          message: error.message || '결제 상태 동기화 중 오류가 발생했습니다'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * 결제 상태 매핑
 */
function mapPaymentStatus(status: string): TossPaymentStatus {
  const statusMap: Record<string, TossPaymentStatus> = {
    'READY': 'READY',
    'IN_PROGRESS': 'IN_PROGRESS',
    'WAITING_FOR_DEPOSIT': 'WAITING_FOR_DEPOSIT',
    'DONE': 'DONE',
    'CANCELED': 'CANCELED',
    'PARTIAL_CANCELED': 'PARTIAL_CANCELED',
    'ABORTED': 'ABORTED',
    'EXPIRED': 'EXPIRED',
  }
  return statusMap[status] || 'READY'
}

/**
 * 결제 상태 라벨
 */
function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'READY': '결제 대기',
    'IN_PROGRESS': '결제 진행 중',
    'WAITING_FOR_DEPOSIT': '입금 대기',
    'DONE': '결제 완료',
    'CANCELED': '결제 취소',
    'PARTIAL_CANCELED': '부분 취소',
    'ABORTED': '결제 중단',
    'EXPIRED': '결제 만료',
  }
  return labels[status] || status
}

/**
 * 결제 수단 라벨
 */
function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    'CARD': '신용/체크카드',
    'VIRTUAL_ACCOUNT': '가상계좌',
    'TRANSFER': '계좌이체',
    'MOBILE': '휴대폰 결제',
    'CULTURE_GIFT': '문화상품권',
    'BOOK_GIFT': '도서문화상품권',
    'GAME_GIFT': '게임문화상품권',
  }
  return labels[method] || method
}

/**
 * 주문 상태 라벨
 */
function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'PENDING': '주문 대기',
    'PAID': '결제 완료',
    'PREPARING': '상품 준비중',
    'SHIPPED': '배송 중',
    'DELIVERED': '배송 완료',
    'CANCELLED': '주문 취소',
    'PARTIAL_CANCELLED': '부분 취소',
    'REFUNDED': '환불 완료',
  }
  return labels[status] || status
}
