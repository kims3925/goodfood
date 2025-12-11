'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
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

export function CartNotificationProvider({ children }: { children: ReactNode }) {
  const { getApiPath } = useShopUrl()
  const [isVisible, setIsVisible] = useState(false)
  const [product, setProduct] = useState<NotificationProduct | null>(null)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const [cartCount, setCartCount] = useState(0)

  // 장바구니 수량 조회
  const refreshCartCount = useCallback(async () => {
    try {
      const sessionId = localStorage.getItem('sessionId')
      if (sessionId) {
        const response = await fetch(getApiPath(`/api/cart?sessionId=${sessionId}`))
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
  }, [getApiPath])

  // 초기 로드 시 장바구니 수량 가져오기
  useEffect(() => {
    refreshCartCount()
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
