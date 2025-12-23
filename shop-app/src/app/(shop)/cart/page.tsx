'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Minus, Plus, X, ShoppingBag, Check } from 'lucide-react'
import { ConfirmModal } from '@/modules/common/ui-kit/src/ui'
import { useShop } from '@/contexts/ShopContext'
import { useShopUrl } from '@/hooks/useShopUrl'
import { useCartNotification } from '@/contexts/CartNotificationContext'

interface CartItem {
  id: number
  productId: number
  variantId: number | null
  name: string
  optionSummary: string | null
  image: string
  price: number
  originalPrice: number // 배송비 미포함 원가
  quantity: number
  stock: number
  shippingFee: number | null
  bundleMaxQty: number // 합배송 최대 수량
  bundleUnit?: number  // 옵션별 합배송 단위 수 (기본값 1)
  isBundleDiscount?: boolean  // 할인형 여부 (true: 할인 차감, false: 배송비 추가)
}

interface Cart {
  id: number
  sessionId: string
  items: CartItem[]
  totalItems: number
  subtotal: number
  shippingFee: number
  total: number
}

export default function CartPage() {
  const { data: session } = useSession()
  const { shop } = useShop()
  const { getPath, getApiPath } = useShopUrl()
  const { refreshCartCount } = useCartNotification()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [cart, setCart] = useState<Cart | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [isMounted, setIsMounted] = useState(false)
  const [isAutoAdding, setIsAutoAdding] = useState(false)
  const autoAddProcessed = useRef(false)

  // ConfirmModal 상태
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showRemoveSelectedConfirm, setShowRemoveSelectedConfirm] = useState(false)
  const [pendingRemoveItemId, setPendingRemoveItemId] = useState<number | null>(null)

  const loadCart = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(getApiPath('/api/cart'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('장바구니 API 응답 오류:', response.status)
        setCart(null)
        setSelectedItems([])
        return
      }

      const data = await response.json()

      if (data.success && data.cart) {
        setCart(data.cart)
        setSelectedItems(data.cart.items?.map((item: CartItem) => item.id) || [])
      } else {
        setCart(null)
        setSelectedItems([])
      }
    } catch (error) {
      console.error('장바구니 로딩 실패:', error)
      setCart(null)
      setSelectedItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 마운트 상태 관리 - hydration 이슈 해결
  useEffect(() => {
    setIsMounted(true)
    // 페이지 로드 시 스크롤을 맨 위로 이동 (새로고침 시 스크롤 복원 방지)
    window.scrollTo(0, 0)
  }, [])

  // 마운트 후에만 장바구니 로드
  useEffect(() => {
    if (isMounted) {
      loadCart()
    }
  }, [isMounted, loadCart])

  // URL 파라미터로 자동 장바구니 추가 (?add=publishedProductId)
  useEffect(() => {
    const addProductId = searchParams.get('add')

    if (!isMounted || !addProductId || autoAddProcessed.current) return

    autoAddProcessed.current = true

    const autoAddToCart = async () => {
      setIsAutoAdding(true)
      try {
        const response = await fetch(getApiPath('/api/cart'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            publishedProductId: parseInt(addProductId),
            quantity: 1,
          }),
        })

        if (response.ok) {
          // 장바구니 다시 로드
          await loadCart()
        }
      } catch (error) {
        console.error('자동 장바구니 추가 실패:', error)
      } finally {
        setIsAutoAdding(false)
        // URL에서 add 파라미터 제거 (히스토리 교체)
        router.replace(getPath('/cart'), { scroll: false })
      }
    }

    autoAddToCart()
  }, [isMounted, searchParams, loadCart, router])

  const formatPrice = (price: number) => {
    return price?.toLocaleString('ko-KR') || '0'
  }

  // 합배송 가격 계산 함수 (bundleUnit 기반)
  // bundleUnit을 고려하여 총 합배송 단위 계산 후 배송비/할인 횟수 산출
  const calculateItemPrice = (item: CartItem, newQuantity: number) => {
    const { originalPrice, shippingFee, bundleMaxQty, bundleUnit = 1, isBundleDiscount = false } = item
    const fee = shippingFee || 0

    // 합배송 상품인 경우 (bundleMaxQty > 1 && shippingFee > 0)
    if (bundleMaxQty > 1 && fee > 0) {
      // bundleUnit을 고려하여 총 합배송 단위 계산
      const totalBundleUnits = newQuantity * bundleUnit
      const shippingCount = Math.floor(totalBundleUnits / bundleMaxQty) +
        (totalBundleUnits % bundleMaxQty > 0 ? 1 : 0)

      let totalPrice: number
      if (isBundleDiscount) {
        // 할인형: 첫 번째 수량은 배송비 포함, 2번째 수량부터 할인
        const discountCount = Math.max(0, newQuantity - shippingCount)
        totalPrice = (originalPrice * newQuantity) - (fee * discountCount)
      } else {
        // 배송비형: 배송비 별도 상품, 묶음당 배송비 적용
        totalPrice = (originalPrice * newQuantity) + (fee * shippingCount)
      }
      return Math.round(totalPrice / newQuantity)
    }
    // 일반 상품 (배송비 별도)
    if (fee > 0 && !isBundleDiscount) {
      return originalPrice + fee
    }
    return originalPrice
  }

  // 아이템 총액 계산 (bundleUnit 기반)
  // bundleUnit을 고려하여 총 합배송 단위 계산 후 배송비/할인 횟수 산출
  const calculateItemTotal = (item: CartItem, quantity: number) => {
    const { originalPrice, shippingFee, bundleMaxQty, bundleUnit = 1, isBundleDiscount = false } = item
    const fee = shippingFee || 0

    // 합배송 상품인 경우 (배송비/할인 있음)
    if (bundleMaxQty > 1 && fee > 0) {
      // bundleUnit을 고려하여 총 합배송 단위 계산
      const totalBundleUnits = quantity * bundleUnit
      const shippingCount = Math.floor(totalBundleUnits / bundleMaxQty) +
        (totalBundleUnits % bundleMaxQty > 0 ? 1 : 0)

      if (isBundleDiscount) {
        // 할인형: 첫 번째 수량은 배송비 포함, 2번째 수량부터 할인
        const discountCount = Math.max(0, quantity - shippingCount)
        return (originalPrice * quantity) - (fee * discountCount)
      } else {
        // 배송비형: 배송비 별도 상품, 묶음당 배송비 적용
        return (originalPrice * quantity) + (fee * shippingCount)
      }
    }
    // 일반 상품 (배송비 별도)
    if (fee > 0 && !isBundleDiscount) {
      return (originalPrice + fee) * quantity
    }
    return originalPrice * quantity
  }

  // Optimistic Update: UI 즉시 업데이트, 백그라운드에서 API 호출
  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    if (newQuantity < 1 || !cart) return

    // 이전 상태 저장 (롤백용)
    const prevCart = cart

    // UI 즉시 업데이트 (합배송 가격 계산 적용)
    setCart(prev => {
      if (!prev) return prev
      const newItems = prev.items.map(item => {
        if (item.id === itemId) {
          const newPrice = calculateItemPrice(item, newQuantity)
          return { ...item, quantity: newQuantity, price: newPrice }
        }
        return item
      })
      // 합배송 할인이 적용된 총액 계산
      const newSubtotal = newItems.reduce((sum, item) => sum + calculateItemTotal(item, item.quantity), 0)
      return {
        ...prev,
        items: newItems,
        totalItems: newItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: newSubtotal,
        shippingFee: 0, // 배송비는 상품 가격에 포함
        total: newSubtotal,
      }
    })

    // 백그라운드에서 API 호출
    try {
      const response = await fetch(getApiPath(`/api/cart/items/${itemId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity }),
        credentials: 'include',
      })

      if (!response.ok) {
        // 실패 시 롤백
        setCart(prevCart)
      } else {
        // 성공 시 서버 응답으로 cart 업데이트 (정확한 가격 보장)
        const data = await response.json()
        if (data.success && data.cart) {
          setCart(data.cart)
          // 선택 상태 유지: 기존 선택된 아이템 중 여전히 존재하는 것만 유지
          const newItemIds = data.cart.items?.map((item: CartItem) => item.id) || []
          setSelectedItems(prev => prev.filter(id => newItemIds.includes(id)))
          // 뱃지 업데이트
          await refreshCartCount()
        }
      }
    } catch (error) {
      // 에러 시 롤백
      setCart(prevCart)
      console.error('수량 변경 실패:', error)
    }
  }

  // 삭제 모달 열기
  const handleRemoveItem = (itemId: number) => {
    if (!cart) return
    setPendingRemoveItemId(itemId)
    setShowRemoveConfirm(true)
  }

  // 실제 삭제 처리
  const confirmRemoveItem = async () => {
    if (!pendingRemoveItemId || !cart) return

    const itemId = pendingRemoveItemId
    const prevCart = cart
    const prevSelectedItems = selectedItems

    // UI 즉시 업데이트 (합배송 할인 적용)
    const newItems = cart.items.filter(item => item.id !== itemId)
    const newSubtotal = newItems.reduce((sum, item) => sum + calculateItemTotal(item, item.quantity), 0)

    setCart({
      ...cart,
      items: newItems,
      totalItems: newItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: newSubtotal,
      shippingFee: 0, // 배송비는 상품 가격에 포함
      total: newSubtotal,
    })
    setSelectedItems(prev => prev.filter(id => id !== itemId))

    // 백그라운드에서 API 호출
    try {
      const response = await fetch(getApiPath(`/api/cart/items/${itemId}`), {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        setCart(prevCart)
        setSelectedItems(prevSelectedItems)
      } else {
        // 뱃지 업데이트
        await refreshCartCount()
      }
    } catch (error) {
      setCart(prevCart)
      setSelectedItems(prevSelectedItems)
      console.error('상품 삭제 실패:', error)
    }

    setPendingRemoveItemId(null)
  }

  // 장바구니 비우기 모달 열기
  const handleClearCart = () => {
    setShowClearConfirm(true)
  }

  // 실제 장바구니 비우기 처리
  const confirmClearCart = async () => {
    try {
      await fetch(getApiPath('/api/cart'), { method: 'DELETE', credentials: 'include' })
      setCart(null)
      setSelectedItems([])
      // 뱃지 업데이트
      await refreshCartCount()
    } catch (error) {
      console.error('장바구니 비우기 실패:', error)
    }
  }

  const handleSelectItem = (itemId: number) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId)
      }
      return [...prev, itemId]
    })
  }

  const handleSelectAll = () => {
    if (!cart?.items) return

    if (selectedItems.length === cart.items.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(cart.items.map(item => item.id))
    }
  }

  // 선택 삭제 모달 열기
  const handleRemoveSelected = () => {
    if (selectedItems.length === 0) return
    setShowRemoveSelectedConfirm(true)
  }

  // 실제 선택 삭제 처리
  const confirmRemoveSelected = async () => {
    try {
      for (const itemId of selectedItems) {
        await fetch(getApiPath(`/api/cart/items/${itemId}`), { method: 'DELETE', credentials: 'include' })
      }
      await loadCart()
      // 뱃지 업데이트
      await refreshCartCount()
    } catch (error) {
      console.error('선택 상품 삭제 실패:', error)
    }
  }

  // 선택된 항목만 계산
  const selectedCartItems = cart?.items?.filter(item => selectedItems.includes(item.id)) || []

  // 원래 금액 (할인 전)
  // - 배송비형: (원가 + 배송비) × 수량
  // - 할인형: 원가 × 수량 (배송비가 이미 포함된 가격)
  const originalTotal = selectedCartItems.reduce((sum, item) => {
    const fee = item.shippingFee || 0
    const isBundleDiscount = item.isBundleDiscount || false

    if (isBundleDiscount) {
      // 할인형: 원가에 이미 배송비 포함
      return sum + item.originalPrice * item.quantity
    } else {
      // 배송비형: 원가 + 배송비
      return sum + (item.originalPrice + fee) * item.quantity
    }
  }, 0)

  // 합배송 할인액 계산 (bundleUnit 고려)
  // - 배송비형: 합배송으로 절약되는 배송비
  // - 할인형: 첫 번째 제외, 2번째부터 할인
  const totalBundleDiscount = selectedCartItems.reduce((sum, item) => {
    const bundleUnit = item.bundleUnit || 1
    const isBundleDiscount = item.isBundleDiscount || false

    // 합배송 상품
    if (item.bundleMaxQty > 1 && item.shippingFee && item.shippingFee > 0) {
      const totalBundleUnits = item.quantity * bundleUnit
      const shippingCount = Math.floor(totalBundleUnits / item.bundleMaxQty) +
        (totalBundleUnits % item.bundleMaxQty > 0 ? 1 : 0)

      if (isBundleDiscount) {
        // 할인형: 첫 번째 수량 제외, 2번째 수량부터 할인
        const discountCount = Math.max(0, item.quantity - shippingCount)
        return sum + (item.shippingFee * discountCount)
      } else if (item.quantity > 1) {
        // 배송비형: 합배송으로 절약되는 배송비
        const savings = (item.quantity * item.shippingFee) - (shippingCount * item.shippingFee)
        return sum + Math.max(0, savings)
      }
    }
    return sum
  }, 0)

  // 쿠폰 할인 (장바구니에서는 미적용, 주문서에서 적용)
  const couponDiscount = 0

  // 결제 예정 금액
  const totalAmount = originalTotal - totalBundleDiscount - couponDiscount

  // 커스텀 체크박스 컴포넌트
  const CustomCheckbox = ({ checked, onChange, className = '' }: { checked: boolean; onChange: () => void; className?: string }) => (
    <button
      type="button"
      onClick={onChange}
      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
        checked
          ? 'bg-[#FF6B6B] border-[#FF6B6B]'
          : 'bg-white border-gray-300 hover:border-gray-400'
      } ${className}`}
    >
      {checked && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
    </button>
  )

  // 마운트 전이거나 로딩 중일 때 로딩 표시
  if (!isMounted || isLoading || isAutoAdding) {
    return (
      <div className="min-h-screen bg-[#f4f4f4] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B] mx-auto"></div>
          {isAutoAdding && (
            <p className="mt-4 text-gray-600">장바구니에 담는 중...</p>
          )}
        </div>
      </div>
    )
  }

  // 빈 장바구니
  if (!cart?.items || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f4f4f4]">
        <div className="max-w-[1050px] mx-auto px-4 py-12">
          <h1 className="text-[28px] font-bold text-center text-gray-900 mb-12">장바구니</h1>
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-md">
            <ShoppingBag className="w-24 h-24 text-gray-200 mb-6" strokeWidth={1} />
            <p className="text-gray-500 text-lg mb-2">장바구니에 담긴 상품이 없습니다</p>
            <p className="text-gray-400 text-sm mb-8">원하는 상품을 장바구니에 담아보세요!</p>
            <Link
              href={getPath('/main')}
              className="px-10 py-3 border border-[#FF6B6B] text-[#FF6B6B] rounded-md hover:bg-[#FF6B6B] hover:text-white transition-colors font-medium"
            >
              쇼핑 계속하기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <div className="max-w-[1050px] mx-auto px-4 py-12">
        {/* 타이틀 */}
      <h1 className="text-[28px] font-bold text-gray-900 mb-6">장바구니</h1>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 좌측: 장바구니 상품 목록 */}
          <div className="flex-1">
            {/* 전체 선택 */}
            <div className="bg-white rounded-md mb-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <CustomCheckbox
                    checked={selectedItems.length === cart.items.length}
                    onChange={handleSelectAll}
                  />
                  <span className="text-sm text-gray-700">
                    전체선택 ({selectedItems.length}/{cart.items.length})
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleRemoveSelected}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-300 rounded"
                  >
                    선택삭제
                  </button>
                </div>
              </div>
            </div>

            {/* 상품 목록 */}
            <div className="bg-white rounded-md">
              <div className="divide-y divide-gray-100">
                {cart.items.map((item) => (
                  <div key={item.id} className="p-6">
                    <div className="flex gap-5">
                      {/* 체크박스 */}
                      <div className="flex-shrink-0 pt-2">
                        <CustomCheckbox
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                        />
                      </div>

                      {/* 상품 이미지 */}
                      <Link href={getPath(`/product/${item.productId}`)} className="flex-shrink-0">
                        <div className="relative w-[60px] h-[78px] bg-gray-100 rounded overflow-hidden">
                          <Image
                            src={item.image || '/placeholder.jpg'}
                            alt={item.name}
                            fill
                            sizes="60px"
                            className="object-cover"
                          />
                        </div>
                      </Link>

                      {/* 상품 정보 */}
                      <div className="flex-1 min-w-0">
                        <Link href={getPath(`/product/${item.productId}`)}>
                          <h3 className="text-[15px] text-gray-900 font-medium line-clamp-2 hover:underline">
                            {item.name}
                          </h3>
                        </Link>
                        {item.optionSummary && (
                          <p className="text-[13px] text-gray-500 mt-1">{item.optionSummary}</p>
                        )}

                        {/* 가격 (합배송 할인 적용) */}
                        <div className="mt-2">
                          <span className="text-[16px] font-bold text-gray-900">
                            {formatPrice(calculateItemTotal(item, item.quantity))}원
                          </span>
                          {/* 합배송 할인 표시 */}
                          {(() => {
                            const bundleUnit = item.bundleUnit || 1
                            const isBundleDiscount = item.isBundleDiscount || false

                            // 합배송 상품
                            if (item.bundleMaxQty > 1 && item.shippingFee && item.shippingFee > 0) {
                              const totalBundleUnits = item.quantity * bundleUnit
                              const shippingCount = Math.floor(totalBundleUnits / item.bundleMaxQty) +
                                (totalBundleUnits % item.bundleMaxQty > 0 ? 1 : 0)

                              if (isBundleDiscount) {
                                // 할인형: 첫 번째 수량 제외, 2번째 수량부터 할인
                                const discountCount = Math.max(0, item.quantity - shippingCount)
                                const discount = item.shippingFee * discountCount
                                return discount > 0 ? (
                                  <span className="ml-2 text-xs text-[#FF6B6B]">
                                    ({formatPrice(discount)}원 할인)
                                  </span>
                                ) : null
                              } else if (item.quantity > 1) {
                                // 배송비형: 절약된 배송비 표시
                                const savings = (item.quantity * item.shippingFee) - (shippingCount * item.shippingFee)
                                return savings > 0 ? (
                                  <span className="ml-2 text-xs text-[#FF6B6B]">
                                    ({formatPrice(savings)}원 절약)
                                  </span>
                                ) : null
                              }
                            }
                            return null
                          })()}
                        </div>

                        {/* 수량 조절 */}
                        <div className="mt-3 flex items-center">
                          <div className="inline-flex items-center border border-gray-300 rounded">
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"
                            >
                              <Minus className="w-3 h-3 text-gray-600" />
                            </button>
                            <span className="w-10 text-center text-sm text-gray-900 font-medium">{item.quantity}</span>
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center hover:bg-gray-50"
                            >
                              <Plus className="w-3 h-3 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 우측: 결제 정보 (스티키) */}
            <div className="lg:w-[320px] flex-shrink-0">
            <div className="lg:sticky lg:top-[294px]">
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* 결제 금액 */}
                <div className="p-5 border-b border-gray-100">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">상품금액</span>
                      <span className="text-gray-900">{formatPrice(originalTotal)}원</span>
                    </div>
                    {totalBundleDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#FF6B6B]">묶음 할인</span>
                        <span className="text-[#FF6B6B]">-{formatPrice(totalBundleDiscount)}원</span>
                      </div>
                    )}
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#FF6B6B]">쿠폰 할인</span>
                        <span className="text-[#FF6B6B]">-{formatPrice(couponDiscount)}원</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 결제 예정 금액 */}
                <div className="p-5 bg-[#fafafa]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">결제예정금액</span>
                    <span className="text-[22px] font-bold text-gray-900">{formatPrice(totalAmount)}원</span>
                  </div>
                </div>

                {/* 주문 버튼 */}
                <div className="p-5 pb-4 space-y-3">
                  {/* 회원/비회원 공통 주문하기 버튼 */}
                  <Link
                    href={getPath('/checkout?fromCart=true')}
                    className={`w-full py-4 rounded-md text-center font-semibold text-base block transition-colors ${
                      selectedItems.length > 0
                        ? 'bg-[#FF6B6B] text-white hover:bg-[#ff5252]'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    onClick={(e) => {
                      if (selectedItems.length === 0) {
                        e.preventDefault()
                      }
                    }}
                  >
                    {selectedItems.length > 0
                      ? session ? '주문하기' : '비회원 주문하기'
                      : '상품을 선택해주세요'}
                  </Link>

                  {/* 비회원인 경우 로그인 버튼 추가 */}
                  {!session && selectedItems.length > 0 && (
                    <Link
                      href={getPath('/auth/login')}
                      className="w-full py-3 rounded-md text-center font-medium text-sm block border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      로그인하고 주문하기
                    </Link>
                  )}
                </div>

                {/* 안내 문구 */}
                <div className="px-5 pb-5 pt-2 border-t border-gray-100">
                  <ul className="space-y-1.5 text-[11px] text-gray-500">
                    {!session && (
                      <li className="flex items-start gap-1">
                        <span className="text-[#FF6B6B]">·</span>
                        <span className="text-[#FF6B6B]">비회원 주문은 무통장입금만 가능합니다</span>
                      </li>
                    )}
                    <li className="flex items-start gap-1">
                      <span className="text-gray-400">·</span>
                      <span>쿠폰/적립금은 주문서에서 사용 가능합니다</span>
                    </li>
                    <li className="flex items-start gap-1">
                      <span className="text-gray-400">·</span>
                      <span>[주문완료] 상태일 경우에만 주문 취소 가능합니다</span>
                    </li>
                    <li className="flex items-start gap-1">
                      <span className="text-gray-400">·</span>
                      <span>[배송완료] 상태일 경우 교환/반품이 가능합니다</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 단일 상품 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => {
          setShowRemoveConfirm(false)
          setPendingRemoveItemId(null)
        }}
        onConfirm={confirmRemoveItem}
        title="상품 삭제"
        message="이 상품을 장바구니에서 삭제하시겠습니까?"
        confirmText="삭제"
        variant="danger"
      />

      {/* 장바구니 비우기 확인 모달 */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClearCart}
        title="장바구니 비우기"
        message="장바구니의 모든 상품을 삭제하시겠습니까?"
        confirmText="비우기"
        variant="danger"
      />

      {/* 선택 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showRemoveSelectedConfirm}
        onClose={() => setShowRemoveSelectedConfirm(false)}
        onConfirm={confirmRemoveSelected}
        title="선택 상품 삭제"
        message={`선택한 ${selectedItems.length}개 상품을 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
      />
    </div>
  )
}
