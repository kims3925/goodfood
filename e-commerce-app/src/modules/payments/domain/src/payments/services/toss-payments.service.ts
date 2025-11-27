import crypto from 'crypto'
import prisma from '@/modules/common/utils/src/database/client'

// 토스페이먼츠 API 응답 타입 정의
export interface TossPaymentResponse {
  paymentKey: string
  type: string
  orderId: string
  orderName: string
  mId: string
  currency: string
  method: string
  totalAmount: number
  balanceAmount: number
  status: string
  requestedAt: string
  approvedAt?: string
  useEscrow: boolean
  lastTransactionKey?: string
  suppliedAmount: number
  vat: number
  cultureBenefit: boolean
  taxFreeAmount: number
  taxExemptionAmount: number
  cancels?: any[]
  isPartialCancelable: boolean
  card?: any
  virtualAccount?: any
  transfer?: any
  mobilePhone?: any
  giftCertificate?: any
  cashReceipt?: any
  cashReceipts?: any[]
  discount?: any
  country: string
  failure?: {
    code: string
    message: string
  }
}

export interface TossPaymentRequest {
  paymentKey: string
  orderId: string
  amount: number
}

export class TossPaymentsService {
  private secretKey: string
  private clientKey: string
  private baseUrl: string

  constructor(secretKey?: string, clientKey?: string) {
    this.secretKey = secretKey || process.env.TOSS_PAYMENTS_SECRET_KEY || ''
    this.clientKey = clientKey || process.env.TOSS_PAYMENTS_CLIENT_KEY || ''
    this.baseUrl = 'https://api.tosspayments.com/v1'

    // 결제 위젯의 경우 백엔드에서는 Secret Key만 필요
    if (!this.secretKey) {
      throw new Error('토스페이먼츠 Secret Key가 설정되지 않았습니다.')
    }
  }

  /**
   * 결제 승인
   */
  async confirmPayment(request: TossPaymentRequest): Promise<TossPaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`결제 승인 실패: ${data.message || '알 수 없는 오류'}`)
      }

      return data
    } catch (error) {
      console.error('토스페이먼츠 결제 승인 오류:', error)
      throw error
    }
  }

  /**
   * 결제 조회
   */
  async getPayment(paymentKey: string): Promise<TossPaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentKey}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`,
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`결제 조회 실패: ${data.message || '알 수 없는 오류'}`)
      }

      return data
    } catch (error) {
      console.error('토스페이먼츠 결제 조회 오류:', error)
      throw error
    }
  }

  /**
   * 결제 취소
   */
  async cancelPayment(paymentKey: string, cancelReason: string, cancelAmount?: number): Promise<TossPaymentResponse> {
    try {
      const requestBody: any = { cancelReason }
      if (cancelAmount !== undefined) {
        requestBody.cancelAmount = cancelAmount
      }

      const response = await fetch(`${this.baseUrl}/payments/${paymentKey}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`결제 취소 실패: ${data.message || '알 수 없는 오류'}`)
      }

      return data
    } catch (error) {
      console.error('토스페이먼츠 결제 취소 오류:', error)
      throw error
    }
  }

  /**
   * 주문 ID 생성 (유니크 보장)
   */
  generateOrderId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `ORDER_${timestamp}_${random}`
  }

  /**
   * 웹훅 서명 검증
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    try {
      const webhookSecret = process.env.TOSS_PAYMENTS_WEBHOOK_SECRET
      if (!webhookSecret) {
        console.error('웹훅 시크릿이 설정되지 않았습니다.')
        return false
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('base64')

      return signature === expectedSignature
    } catch (error) {
      console.error('웹훅 서명 검증 오류:', error)
      return false
    }
  }

  /**
   * 결제 요청 데이터 생성
   */
  createPaymentRequest(orderId: string, amount: number, orderName: string, customerEmail?: string) {
    return {
      amount,
      orderId,
      orderName,
      customerEmail,
      successUrl: process.env.PAYMENT_SUCCESS_URL || 'http://localhost:3000/payment/success',
      failUrl: process.env.PAYMENT_FAIL_URL || 'http://localhost:3000/payment/fail',
    }
  }

  /**
   * 클라이언트 키 반환 (프론트엔드용)
   */
  getClientKey(): string {
    return this.clientKey
  }

  /**
   * 결제 금액 유효성 검증
   */
  validateAmount(amount: number): boolean {
    return amount > 0 && amount <= 10000000 && Number.isInteger(amount)
  }

  /**
   * 주문 ID 유효성 검증
   */
  validateOrderId(orderId: string): boolean {
    return orderId.length <= 64 && /^[A-Za-z0-9\-_]+$/.test(orderId)
  }
}

// 파일에서 토스페이먼츠 API 키를 가져오는 함수
async function getTossPaymentsKeys() {
  try {
    const fs = await import('fs')
    const path = await import('path')

    const settingsPath = path.join(process.cwd(), 'data', 'shop-settings.json')
    console.log('토스페이먼츠 키 조회 시작:', settingsPath)

    if (fs.existsSync(settingsPath)) {
      const fileContent = fs.readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(fileContent)

      const keys = {
        secretKey: settings.tossSecretKey || process.env.TOSS_PAYMENTS_SECRET_KEY || '',
        clientKey: settings.tossClientKey || process.env.TOSS_PAYMENTS_CLIENT_KEY || ''
      }

      console.log('파일에서 토스페이먼츠 키 로드 성공:', {
        hasSecretKey: !!keys.secretKey,
        hasClientKey: !!keys.clientKey,
        secretKeyPrefix: keys.secretKey.substring(0, 10),
        settingsKeys: { tossSecretKey: !!settings.tossSecretKey, tossClientKey: !!settings.tossClientKey }
      })

      return keys
    } else {
      console.log('파일이 존재하지 않음:', settingsPath)
    }
  } catch (error) {
    console.error('파일에서 토스페이먼츠 키 조회 실패, 환경변수 사용:', error)
  }

  return {
    secretKey: process.env.TOSS_PAYMENTS_SECRET_KEY || '',
    clientKey: process.env.TOSS_PAYMENTS_CLIENT_KEY || ''
  }
}

// 동적으로 서비스 인스턴스 생성 (DB에서 키 조회)
export async function getTossPaymentsService(): Promise<TossPaymentsService> {
  const keys = await getTossPaymentsKeys()
  return new TossPaymentsService(keys.secretKey, keys.clientKey)
}

// 동기식 버전 (환경변수만 사용)
export function getTossPaymentsServiceSync(): TossPaymentsService {
  return new TossPaymentsService()
}

// 결제 상태 상수
export const PAYMENT_STATUS = {
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS', 
  WAITING_FOR_DEPOSIT: 'WAITING_FOR_DEPOSIT',
  DONE: 'DONE',
  CANCELED: 'CANCELED',
  PARTIAL_CANCELED: 'PARTIAL_CANCELED',
  ABORTED: 'ABORTED',
  EXPIRED: 'EXPIRED'
} as const

// 결제 방법 상수
export const PAYMENT_METHOD = {
  CARD: '카드',
  VIRTUAL_ACCOUNT: '가상계좌',
  TRANSFER: '계좌이체',
  MOBILE_PHONE: '휴대폰',
  GIFT_CERTIFICATE: '상품권',
  CASH_RECEIPT: '현금영수증'
} as const