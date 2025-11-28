'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Minus, Plus, X, ShoppingBag, Check, Truck } from 'lucide-react'

interface CartItem {
  id: number
  productId: number
  variantId: number | null
  name: string
  optionSummary: string | null
  image: string
  price: number
  quantity: number
  stock: number
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
  const [cart, setCart] = useState<Cart | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  const loadCart = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/cart', {
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

  const formatPrice = (price: number) => {
    return price?.toLocaleString('ko-KR') || '0'
  }

  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    if (newQuantity < 1) return
    if (isUpdating) return

    try {
      setIsUpdating(true)
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity }),
        credentials: 'include',
      })

      if (response.ok) {
        await loadCart()
      }
    } catch (error) {
      console.error('수량 변경 실패:', error)
      alert('수량 변경에 실패했습니다.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemoveItem = async (itemId: number) => {
    if (!confirm('이 상품을 장바구니에서 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        await loadCart()
        setSelectedItems(prev => prev.filter(id => id !== itemId))
      }
    } catch (error) {
      console.error('상품 삭제 실패:', error)
      alert('상품 삭제에 실패했습니다.')
    }
  }

  const handleClearCart = async () => {
    if (!confirm('장바구니를 비우시겠습니까?')) return

    try {
      await fetch('/api/cart', { method: 'DELETE', credentials: 'include' })
      setCart(null)
      setSelectedItems([])
    } catch (error) {
      console.error('장바구니 비우기 실패:', error)
      alert('장바구니를 비우는데 실패했습니다.')
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

  const handleRemoveSelected = async () => {
    if (selectedItems.length === 0) {
      alert('선택된 상품이 없습니다.')
      return
    }

    if (!confirm(`선택한 ${selectedItems.length}개 상품을 삭제하시겠습니까?`)) return

    try {
      for (const itemId of selectedItems) {
        await fetch(`/api/cart/items/${itemId}`, { method: 'DELETE', credentials: 'include' })
      }
      await loadCart()
    } catch (error) {
      console.error('선택 상품 삭제 실패:', error)
      alert('선택 상품 삭제에 실패했습니다.')
    }
  }

  // 선택된 항목만 계산
  const selectedCartItems = cart?.items?.filter(item => selectedItems.includes(item.id)) || []
  const subtotal = selectedCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const shippingFee = subtotal >= 30000 ? 0 : (subtotal > 0 ? 3000 : 0)
  const totalAmount = subtotal + shippingFee
  const discountAmount = 0 // 할인 금액 (추후 구현 시 사용)

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
  if (!isMounted || isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f4f4] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B]"></div>
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
              href="/store"
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
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 좌측: 장바구니 상품 목록 */}
          <div className="flex-1">
            {/* 타이틀 */}
            <h1 className="text-[28px] font-bold text-gray-900 mb-6">장바구니</h1>

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
                      <Link href={`/store/product/${item.productId}`} className="flex-shrink-0">
                        <div className="w-[60px] h-[78px] bg-gray-100 rounded overflow-hidden">
                          <img
                            src={item.image || '/placeholder.jpg'}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </Link>

                      {/* 상품 정보 */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/store/product/${item.productId}`}>
                          <h3 className="text-[15px] text-gray-900 font-medium line-clamp-2 hover:underline">
                            {item.name}
                          </h3>
                        </Link>
                        {item.optionSummary && (
                          <p className="text-[13px] text-gray-500 mt-1">{item.optionSummary}</p>
                        )}

                        {/* 가격 */}
                        <div className="mt-2">
                          <span className="text-[16px] font-bold text-gray-900">
                            {formatPrice(item.price * item.quantity)}원
                          </span>
                        </div>

                        {/* 수량 조절 */}
                        <div className="mt-3 flex items-center">
                          <div className="inline-flex items-center border border-gray-300 rounded">
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1 || isUpdating}
                              className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"
                            >
                              <Minus className="w-3 h-3 text-gray-600" />
                            </button>
                            <span className="w-10 text-center text-sm text-gray-900 font-medium">{item.quantity}</span>
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              disabled={isUpdating}
                              className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"
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

            {/* 무료배송 안내 */}
            {subtotal > 0 && subtotal < 30000 && (
              <div className="mt-4 bg-[#fef5f5] rounded-md p-4">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#FF6B6B]" />
                  <span className="text-sm text-gray-700">
                    <span className="font-bold text-[#FF6B6B]">{formatPrice(30000 - subtotal)}원</span> 더 담으면
                    <span className="font-bold text-[#FF6B6B]"> 무료배송</span>
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-[#FF6B6B] h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min((subtotal / 30000) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* 우측: 결제 정보 (스티키) */}
          <div className="lg:w-[284px] flex-shrink-0">
            <div className="lg:sticky lg:top-[294px]">
              <div className="bg-white rounded-md overflow-hidden">
                {/* 결제 금액 */}
                <div className="p-5 border-b border-gray-100">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">상품금액</span>
                      <span className="text-gray-900">{formatPrice(subtotal)}원</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">상품할인금액</span>
                      <span className="text-gray-900">{discountAmount > 0 ? `-${formatPrice(discountAmount)}` : '0'}원</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">배송비</span>
                      <span className={shippingFee === 0 && subtotal > 0 ? 'text-[#FF6B6B]' : 'text-gray-900'}>
                        {shippingFee === 0 && subtotal > 0 ? '무료' : `+${formatPrice(shippingFee)}원`}
                      </span>
                    </div>
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
                <div className="p-5 pb-4">
                  {session ? (
                    <Link
                      href="/store/checkout?fromCart=true"
                      className={`w-full py-4 rounded-md text-center font-semibold text-base block transition-colors ${
                        selectedItems.length > 0
                          ? 'bg-[#FF6B6B] text-white hover:bg-[#ff5252]'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                      onClick={(e) => {
                        if (selectedItems.length === 0) {
                          e.preventDefault()
                          alert('주문할 상품을 선택해주세요.')
                        }
                      }}
                    >
                      {selectedItems.length > 0
                        ? `주문하기 (${selectedItems.length}개)`
                        : '상품을 선택해주세요'}
                    </Link>
                  ) : (
                    <Link
                      href="/store/auth/login"
                      className="w-full py-4 rounded-md text-center font-semibold text-base block bg-[#FF6B6B] text-white hover:bg-[#ff5252] transition-colors"
                    >
                      로그인
                    </Link>
                  )}
                </div>

                {/* 안내 문구 */}
                <div className="px-5 pb-5 pt-2 border-t border-gray-100">
                  <ul className="space-y-1.5 text-[11px] text-gray-500">
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
    </div>
  )
}
