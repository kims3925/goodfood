'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { useShopUrl } from '@/hooks/useShopUrl'

interface NotificationProduct {
  title: string
  image: string
  quantity: number
  isExisting?: boolean // 이미 담긴 상품의 수량 추가 여부
}

interface CartNotificationContextType {
  isVisible: boolean
  product: NotificationProduct | null
  cartCount: number
  showNotification: (product: NotificationProduct) => void
  hideNotification: () => void
  refreshCartCount: () => Promise<void>
}

const CartNotificationContext = createContext<CartNotificationContextType | undefined>(undefined)

// 전역 이벤트 이름
const CART_UPDATED_EVENT = 'cartUpdated'

// 장바구니 변경 이벤트 발생 함수 (외부에서 호출 가능)
export function dispatchCartUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT))
  }
}

export function CartNotificationProvider({ children }: { children: ReactNode }) {
  const { getApiPath } = useShopUrl()
  const [isVisible, setIsVisible] = useState(false)
  const [product, setProduct] = useState<NotificationProduct | null>(null)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const [cartCount, setCartCount] = useState(0)
  const apiPathRef = useRef(getApiPath)

  // getApiPath 최신값 유지
  useEffect(() => {
    apiPathRef.current = getApiPath
  }, [getApiPath])

  // 장바구니 수량 조회 (ref 사용으로 의존성 문제 해결)
  const refreshCartCount = useCallback(async () => {
    try {
      const sessionId = localStorage.getItem('sessionId')
      if (sessionId) {
        const response = await fetch(apiPathRef.current(`/api/cart?sessionId=${sessionId}`))
        const data = await response.json()
        if (data.success && data.cart?.items) {
          // 상품 종류 수가 아닌 전체 수량 합계로 변경
          const totalCount = data.cart.items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)
          setCartCount(totalCount)
        } else {
          setCartCount(0)
        }
      }
    } catch (error) {
      console.error('Failed to load cart count:', error)
    }
  }, [])

  // 초기 로드 시 장바구니 수량 가져오기
  useEffect(() => {
    refreshCartCount()
  }, [refreshCartCount])

  // 전역 이벤트 리스너 등록
  useEffect(() => {
    const handleCartUpdate = () => {
      refreshCartCount()
    }

    window.addEventListener(CART_UPDATED_EVENT, handleCartUpdate)
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, handleCartUpdate)
    }
  }, [refreshCartCount])

  const showNotification = useCallback((productInfo: NotificationProduct) => {
    // 기존 타이머가 있으면 제거
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    setProduct(productInfo)
    setIsVisible(true)

    // 3초 후 자동으로 숨기기
    const newTimeoutId = setTimeout(() => {
      setIsVisible(false)
      setProduct(null)
    }, 3000)

    setTimeoutId(newTimeoutId)
  }, [timeoutId])

  const hideNotification = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    setIsVisible(false)
    setProduct(null)
  }, [timeoutId])

  return (
    <CartNotificationContext.Provider value={{ isVisible, product, cartCount, showNotification, hideNotification, refreshCartCount }}>
      {children}
    </CartNotificationContext.Provider>
  )
}

export function useCartNotification() {
  const context = useContext(CartNotificationContext)
  if (!context) {
    throw new Error('useCartNotification must be used within a CartNotificationProvider')
  }
  return context
}
