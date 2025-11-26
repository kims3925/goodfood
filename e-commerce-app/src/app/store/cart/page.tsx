'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Minus, Plus, X, ShoppingBag, Trash2 } from 'lucide-react'

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
  const [cart, setCart] = useState<Cart | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    loadCart()
  }, [])

  const loadCart = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/cart')
      const data = await response.json()

      if (data.success && data.cart) {
        setCart(data.cart)
        setSelectedItems(data.cart.items?.map((item: CartItem) => item.id) || [])
      }
    } catch (error) {
      console.error('장바구니 로딩 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

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
      await fetch('/api/cart', { method: 'DELETE' })
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
        await fetch(`/api/cart/items/${itemId}`, { method: 'DELETE' })
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <Link href="/store" className="p-2 -ml-2">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-lg font-bold">장바구니</h1>
            </div>
            {cart?.items && cart.items.length > 0 && (
              <button onClick={handleClearCart} className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1">
                <Trash2 className="w-4 h-4" />
                비우기
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Empty Cart */}
      {(!cart?.items || cart.items.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20">
          <ShoppingBag className="w-20 h-20 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg mb-2">장바구니가 비어있습니다</p>
          <p className="text-gray-400 text-sm mb-6">원하는 상품을 담아보세요</p>
          <Link href="/store" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            쇼핑하러 가기
          </Link>
        </div>
      ) : (
        <>
          {/* Select All */}
          <div className="bg-white border-b">
            <div className="container mx-auto px-4">
              <div className="flex items-center justify-between py-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === cart.items.length}
                    onChange={handleSelectAll}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    전체선택 ({selectedItems.length}/{cart.items.length})
                  </span>
                </label>
                <button onClick={handleRemoveSelected} className="text-sm text-gray-500 hover:text-red-500">
                  선택삭제
                </button>
              </div>
            </div>
          </div>

          {/* Cart Items */}
          <div className="container mx-auto px-4 py-4">
            <div className="space-y-3">
              {cart.items.map((item) => (
                <div key={item.id} className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex gap-3">
                    {/* Checkbox */}
                    <div className="flex items-start pt-1">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>

                    {/* Product Image */}
                    <Link href={`/store/product/${item.productId}`} className="flex-shrink-0">
                      <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={item.image || '/placeholder.jpg'}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </Link>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/store/product/${item.productId}`}>
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-blue-600">
                          {item.name}
                        </h3>
                      </Link>
                      {item.optionSummary && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.optionSummary}</p>
                      )}

                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <span className="text-base font-bold text-gray-900">
                            {formatPrice(item.price * item.quantity)}원
                          </span>
                          {item.quantity > 1 && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({formatPrice(item.price)}원 × {item.quantity})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Selector */}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center border border-gray-300 rounded">
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1 || isUpdating}
                            className="p-1.5 hover:bg-gray-100 disabled:opacity-50"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-10 text-center text-sm">{item.quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            disabled={isUpdating}
                            className="p-1.5 hover:bg-gray-100 disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <button onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Free Shipping Notice */}
          {subtotal > 0 && subtotal < 30000 && (
            <div className="container mx-auto px-4 pb-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">{formatPrice(30000 - subtotal)}원</span> 더 담으면 무료배송!
                </p>
                <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((subtotal / 30000) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Order Summary - Fixed Bottom */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-30">
            <div className="container mx-auto px-4 py-4">
              {/* Summary */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">상품금액</span>
                  <span className="text-gray-900">{formatPrice(subtotal)}원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">배송비</span>
                  <span className={shippingFee === 0 ? 'text-blue-600' : 'text-gray-900'}>
                    {shippingFee === 0 ? '무료' : `${formatPrice(shippingFee)}원`}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium text-gray-900">결제예정금액</span>
                  <span className="text-lg font-bold text-blue-600">{formatPrice(totalAmount)}원</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Link
                href="/store/checkout?fromCart=true"
                className={`w-full py-4 rounded-lg text-center font-semibold text-lg block ${
                  selectedItems.length > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                onClick={(e) => {
                  if (selectedItems.length === 0) {
                    e.preventDefault()
                    alert('주문할 상품을 선택해주세요.')
                  }
                }}
              >
                {selectedItems.length > 0
                  ? `${selectedItems.length}개 상품 주문하기`
                  : '상품을 선택해주세요'}
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
