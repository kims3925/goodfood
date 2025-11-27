import { create } from 'zustand'

/**
 * 결제 수단 타입
 */
export type PaymentMethodType = 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER' | 'MOBILE_PHONE'

/**
 * 결제 정보 인터페이스
 */
export interface PaymentInfo {
  orderId: string
  orderNumber: string
  amount: number
  orderName: string
  customerEmail?: string
  customerName?: string
}

/**
 * 결제 상태 인터페이스
 */
interface PaymentState {
  // 상태
  paymentMethod: PaymentMethodType | null
  paymentInfo: PaymentInfo | null
  isProcessing: boolean
  error: string | null
  paymentKey: string | null  // 토스페이먼츠 결제 키

  // 액션
  setPaymentMethod: (method: PaymentMethodType) => void
  setPaymentInfo: (info: PaymentInfo) => void
  setPaymentKey: (key: string) => void
  startPayment: () => void
  completePayment: () => void
  failPayment: (error: string) => void
  resetPayment: () => void
}

/**
 * 결제 Zustand Store
 *
 * Context 격리: 결제 관련 상태만 관리
 * 결제 프로세스 중 상태 추적
 */
export const usePaymentStore = create<PaymentState>((set) => ({
  // 초기 상태
  paymentMethod: null,
  paymentInfo: null,
  isProcessing: false,
  error: null,
  paymentKey: null,

  // 결제 수단 설정
  setPaymentMethod: (method) => {
    set({ paymentMethod: method, error: null })
  },

  // 결제 정보 설정
  setPaymentInfo: (info) => {
    set({ paymentInfo: info, error: null })
  },

  // 결제 키 설정
  setPaymentKey: (key) => {
    set({ paymentKey: key })
  },

  // 결제 시작
  startPayment: () => {
    set({ isProcessing: true, error: null })
  },

  // 결제 완료
  completePayment: () => {
    set({ isProcessing: false, error: null })
  },

  // 결제 실패
  failPayment: (error) => {
    set({ isProcessing: false, error })
  },

  // 결제 초기화
  resetPayment: () => {
    set({
      paymentMethod: null,
      paymentInfo: null,
      isProcessing: false,
      error: null,
      paymentKey: null
    })
  }
}))

/**
 * 결제 수단 한글 이름
 */
export const PAYMENT_METHOD_NAMES: Record<PaymentMethodType, string> = {
  CARD: '카드',
  VIRTUAL_ACCOUNT: '가상계좌',
  TRANSFER: '계좌이체',
  MOBILE_PHONE: '휴대폰'
}
