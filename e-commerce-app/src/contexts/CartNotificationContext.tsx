'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface NotificationProduct {
  title: string
  image: string
  quantity: number
  isExisting?: boolean // 이미 담긴 상품의 수량 추가 여부
}

interface CartNotificationContextType {
  isVisible: boolean
  product: NotificationProduct | null
  showNotification: (product: NotificationProduct) => void
  hideNotification: () => void
}

const CartNotificationContext = createContext<CartNotificationContextType | undefined>(undefined)

export function CartNotificationProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)
  const [product, setProduct] = useState<NotificationProduct | null>(null)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

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
    <CartNotificationContext.Provider value={{ isVisible, product, showNotification, hideNotification }}>
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
