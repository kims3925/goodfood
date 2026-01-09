'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Trash2,
  Search,
  Package,
  User,
  Truck,
  FileText,
  Loader2,
  ShoppingCart,
  Check,
  Plus,
  Minus,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface Shop {
  id: number
  name: string
  channels?: Array<{
    id: number
    name: string
  }>
}

interface ProductVariant {
  id: number
  optionSummary: string | null
  price: number
}

interface ShopProduct {
  id: number
  product: {
    id: number
    name: string
    thumbnailUrl: string | null
    price: number | null
    variants: ProductVariant[]
  }
  shop: {
    id: number
    name: string
  }
}

interface OrderItem {
  shopProductId: number
  variantId: number | null
  quantity: number
  productName: string
  optionSummary: string
  unitPrice: number
  thumbnailUrl: string | null
}

export default function ExternalOrderNewPage() {
  const router = useRouter()

  // 쇼핑몰 목록
  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null)

  // 상품 목록 (선택용)
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)

  // 폼 상태
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')

  // 배송 정보
  const [sameAsCustomer, setSameAsCustomer] = useState(true)
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [deliveryMemo, setDeliveryMemo] = useState('')

  // 주문 상품
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])

  // 주문 메모
  const [memo, setMemo] = useState('')

  // 옵션 선택 모드 (열린 상품 ID)
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null)

  // 제출 상태
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Daum 우편번호 스크립트 로드
  useEffect(() => {
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  // 쇼핑몰 목록 로드
  useEffect(() => {
    async function loadShops() {
      try {
        const res = await fetch('/api/shop')
        const data = await res.json()
        if (data.success && data.data) {
          setShops(data.data)
          if (data.data.length === 1) {
            setSelectedShopId(data.data[0].id)
          }
        }
      } catch (err) {
        console.error('쇼핑몰 목록 로드 실패:', err)
      }
    }
    loadShops()
  }, [])

  // 상품 목록 로드
  const loadProducts = useCallback(async () => {
    if (!selectedShopId) {
      setShopProducts([])
      return
    }

    setLoadingProducts(true)
    try {
      const params = new URLSearchParams({
        shopId: String(selectedShopId),
        limit: '50',
      })
      if (productSearch) {
        params.set('search', productSearch)
      }

      const res = await fetch(`/api/shop-product?${params}`)
      const data = await res.json()
      if (data.success) {
        setShopProducts(data.data || [])
      }
    } catch (err) {
      console.error('상품 목록 로드 실패:', err)
    } finally {
      setLoadingProducts(false)
    }
  }, [selectedShopId, productSearch])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // 소매처 변경 시 장바구니 초기화
  useEffect(() => {
    setOrderItems([])
  }, [selectedShopId])

  // 고객 정보와 동일 체크박스 처리
  useEffect(() => {
    if (sameAsCustomer) {
      setRecipientName(guestName)
      setRecipientPhone(guestPhone)
    }
  }, [sameAsCustomer, guestName, guestPhone])

  // 주소 검색
  const handleSearchAddress = () => {
    if (typeof window !== 'undefined' && window.daum) {
      new window.daum.Postcode({
        oncomplete: (data) => {
          setPostalCode(data.zonecode)
          setAddress(data.address)
        },
      }).open()
    } else {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
    }
  }

  // 상품 카드 클릭 - 토글 (선택/해제)
  const handleToggleProduct = (shopProduct: ShopProduct, variantId?: number) => {
    const { product } = shopProduct
    const hasVariants = product.variants.length > 0
    const selectedVariant = variantId
      ? product.variants.find((v) => v.id === variantId)
      : hasVariants
        ? product.variants[0]
        : null

    // 이미 같은 상품+옵션이 있는지 확인
    const existingIndex = orderItems.findIndex(
      (item) =>
        item.shopProductId === shopProduct.id &&
        item.variantId === (selectedVariant?.id || null)
    )

    if (existingIndex >= 0) {
      // 이미 있으면 제거 (토글)
      setOrderItems(prev => prev.filter((_, i) => i !== existingIndex))
    } else {
      // 없으면 새로 추가
      const newItem: OrderItem = {
        shopProductId: shopProduct.id,
        variantId: selectedVariant?.id || null,
        quantity: 1,
        productName: product.name,
        optionSummary: selectedVariant?.optionSummary || '',
        unitPrice: selectedVariant?.price || Number(product.price) || 0,
        thumbnailUrl: product.thumbnailUrl,
      }
      setOrderItems(prev => [...prev, newItem])
    }
  }

  // 수량 변경
  const handleQuantityChange = (index: number, delta: number) => {
    setOrderItems((prev) => {
      const newItems = [...prev]
      const newQty = newItems[index].quantity + delta

      if (newQty <= 0) {
        // 수량이 0 이하면 삭제
        newItems.splice(index, 1)
      } else {
        newItems[index] = {
          ...newItems[index],
          quantity: newQty,
        }
      }
      return newItems
    })
  }

  // 상품 삭제
  const handleRemoveItem = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index))
  }

  // 합계 계산
  const totalAmount = orderItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  )

  // 폼 유효성 검사
  const isFormValid = () => {
    if (!selectedShopId) return false
    if (!guestName.trim()) return false
    if (!guestPhone.trim()) return false
    if (!recipientName.trim()) return false
    if (!recipientPhone.trim()) return false
    if (!postalCode || !address) return false
    if (orderItems.length === 0) return false
    return true
  }

  // 주문 생성
  const handleSubmit = async () => {
    if (!isFormValid()) {
      setError('필수 정보를 모두 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/order/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: selectedShopId,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          guestEmail: guestEmail.trim() || undefined,
          shippingAddress: {
            recipientName: recipientName.trim(),
            recipientPhone: recipientPhone.trim(),
            postalCode,
            address,
            addressDetail: addressDetail.trim() || undefined,
            deliveryMemo: deliveryMemo.trim() || undefined,
          },
          items: orderItems.map((item) => ({
            shopProductId: item.shopProductId,
            variantId: item.variantId || undefined,
            quantity: item.quantity,
          })),
          memo: memo.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        alert(`외부 주문이 생성되었습니다.\n주문번호: ${data.data.orderNumber}`)
        router.push('/shop/order/list')
      } else {
        setError(data.error || '주문 생성에 실패했습니다.')
      }
    } catch (err) {
      console.error('주문 생성 실패:', err)
      setError('주문 생성 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 상품이 장바구니에 있는지 확인
  const getItemQuantity = (shopProductId: number, variantId?: number | null) => {
    const item = orderItems.find(
      (i) => i.shopProductId === shopProductId && i.variantId === (variantId || null)
    )
    return item?.quantity || 0
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8 flex items-center gap-4">
          <Link href="/shop/order/list">
            <button className="rounded-lg p-2 hover:bg-gray-200 transition-colors">
              <ArrowLeft size={24} />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">외부 주문 추가</h1>
            <p className="text-sm text-gray-500">
              문자, 밴드 댓글 등 외부에서 받은 주문을 등록합니다.
            </p>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* 메인 컨텐츠 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측 컬럼 - 고객/배송 정보 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 소매처 선택 */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <ShoppingCart size={20} className="text-blue-600" />
                소매처 선택
              </h2>
              <select
                value={selectedShopId || ''}
                onChange={(e) => setSelectedShopId(Number(e.target.value) || null)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
              >
                <option value="">소매처를 선택하세요</option>
                {shops.map((shop) => {
                  const retailerName = shop.channels?.[0]?.name
                  const displayName = retailerName
                    ? `${retailerName} - ${shop.name}`
                    : shop.name
                  return (
                    <option key={shop.id} value={shop.id}>
                      {displayName}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* 고객 정보 */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <User size={20} className="text-green-600" />
                고객 정보
              </h2>
              <div className="space-y-4">
                <Input
                  label="고객명 *"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="홍길동"
                />
                <Input
                  label="전화번호 *"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="010-1234-5678"
                />
                <Input
                  label="이메일 (선택)"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="example@email.com"
                />
              </div>
            </div>

            {/* 배송 정보 */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Truck size={20} className="text-orange-600" />
                배송 정보
              </h2>

              <label className="mb-4 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsCustomer}
                  onChange={(e) => setSameAsCustomer(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">고객 정보와 동일</span>
              </label>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="수령인 *"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="홍길동"
                    disabled={sameAsCustomer}
                  />
                  <Input
                    label="연락처 *"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    disabled={sameAsCustomer}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    주소 *
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={postalCode}
                      placeholder="우편번호"
                      readOnly
                      className="w-28"
                    />
                    <Button type="button" variant="secondary" onClick={handleSearchAddress}>
                      <Search size={16} />
                      검색
                    </Button>
                  </div>
                  <Input
                    value={address}
                    placeholder="주소"
                    readOnly
                    className="mt-2"
                  />
                  <Input
                    value={addressDetail}
                    onChange={(e) => setAddressDetail(e.target.value)}
                    placeholder="상세 주소 (동/호수 등)"
                    className="mt-2"
                  />
                </div>

                <Input
                  label="배송 메모"
                  value={deliveryMemo}
                  onChange={(e) => setDeliveryMemo(e.target.value)}
                  placeholder="문 앞에 놓아주세요"
                />
              </div>
            </div>

            {/* 주문 메모 - PC */}
            <div className="hidden lg:block rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <FileText size={20} className="text-purple-600" />
                주문 메모 (선택)
              </h2>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="외부 주문 출처를 기록하세요 (예: 밴드 댓글, 문자 주문 등)"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors resize-none"
                rows={4}
              />
            </div>
          </div>

          {/* 우측 컬럼 - 상품 선택 및 장바구니 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 상품 검색 및 선택 */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Package size={20} className="text-indigo-600" />
                상품 선택
              </h2>

              {!selectedShopId ? (
                <div className="py-12 text-center">
                  <Package size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">먼저 소매처를 선택해주세요.</p>
                </div>
              ) : (
                <>
                  {/* 검색 입력 */}
                  <div className="mb-4">
                    <Input
                      placeholder="상품명으로 검색..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      leftIcon={<Search size={16} className="text-gray-400" />}
                    />
                  </div>

                  {/* 상품 카드 그리드 */}
                  {loadingProducts ? (
                    <div className="py-12 text-center">
                      <Loader2 size={32} className="mx-auto mb-4 text-gray-400 animate-spin" />
                      <p className="text-gray-500">상품을 불러오는 중...</p>
                    </div>
                  ) : shopProducts.length === 0 ? (
                    <div className="py-12 text-center">
                      <Package size={48} className="mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500">
                        {productSearch ? '검색 결과가 없습니다.' : '등록된 상품이 없습니다.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-1">
                      {shopProducts.map((sp) => {
                        const hasVariants = sp.product.variants.length > 0
                        const hasMultipleVariants = sp.product.variants.length > 1
                        const basePrice = hasVariants
                          ? sp.product.variants[0].price
                          : Number(sp.product.price) || 0
                        const isExpanded = expandedProductId === sp.id

                        // 이 상품의 총 장바구니 수량 (모든 옵션 합계)
                        const totalInCart = orderItems
                          .filter((item) => item.shopProductId === sp.id)
                          .reduce((sum, item) => sum + item.quantity, 0)

                        return (
                          <div
                            key={sp.id}
                            className={`relative rounded-lg border-2 p-3 transition-all ${
                              totalInCart > 0
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200'
                            }`}
                          >
                            {/* 선택됨 표시 */}
                            {totalInCart > 0 && (
                              <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold z-10">
                                {totalInCart}
                              </div>
                            )}

                            {/* 클릭 영역 */}
                            <div
                              onClick={() => {
                                if (hasMultipleVariants) {
                                  // 옵션이 여러 개면 확장/축소 토글
                                  setExpandedProductId(isExpanded ? null : sp.id)
                                } else {
                                  // 옵션이 하나거나 없으면 바로 토글
                                  handleToggleProduct(sp)
                                }
                              }}
                              className="cursor-pointer"
                            >
                              {/* 썸네일 */}
                              <div className="aspect-square w-full mb-2 rounded-lg overflow-hidden bg-gray-100">
                                {sp.product.thumbnailUrl ? (
                                  <img
                                    src={sp.product.thumbnailUrl}
                                    alt={sp.product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package size={32} className="text-gray-400" />
                                  </div>
                                )}
                              </div>

                              {/* 상품명 */}
                              <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                                {sp.product.name}
                              </p>

                              {/* 가격 */}
                              <p className="text-sm font-bold text-blue-600">
                                {basePrice.toLocaleString()}원
                                {hasMultipleVariants && ' ~'}
                              </p>

                              {/* 옵션 있음 표시 */}
                              {hasMultipleVariants && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {isExpanded ? '▲ 옵션 접기' : `▼ ${sp.product.variants.length}개 옵션`}
                                </p>
                              )}
                            </div>

                            {/* 옵션 선택 버튼들 (확장 시) */}
                            {isExpanded && hasMultipleVariants && (
                              <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                                {sp.product.variants.map((variant) => {
                                  const variantInCart = getItemQuantity(sp.id, variant.id)
                                  return (
                                    <button
                                      key={variant.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleToggleProduct(sp, variant.id)
                                      }}
                                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                        variantInCart > 0
                                          ? 'bg-blue-500 text-white'
                                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                      }`}
                                    >
                                      <div className="flex justify-between items-center">
                                        <span className="truncate">{variant.optionSummary || '기본'}</span>
                                        <span className="font-medium ml-1 flex-shrink-0">
                                          {variantInCart > 0 && <Check size={12} className="inline mr-1" />}
                                          {variant.price.toLocaleString()}원
                                        </span>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 선택된 상품 (장바구니) */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <ShoppingCart size={20} className="text-green-600" />
                선택된 상품
                {orderItems.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-sm rounded-full">
                    {orderItems.length}개
                  </span>
                )}
              </h2>

              {orderItems.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <ShoppingCart size={32} className="mx-auto mb-2 text-gray-300" />
                  <p>상품을 선택해주세요.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderItems.map((item, index) => (
                    <div
                      key={`${item.shopProductId}-${item.variantId}`}
                      className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 border border-gray-200"
                    >
                      {/* 썸네일 */}
                      <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={20} className="text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* 상품 정보 */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{item.productName}</p>
                        {item.optionSummary && (
                          <p className="text-sm text-gray-500">{item.optionSummary}</p>
                        )}
                        <p className="text-sm font-semibold text-blue-600">
                          {item.unitPrice.toLocaleString()}원
                        </p>
                      </div>

                      {/* 수량 조절 */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(index, -1)}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(index, 1)}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      {/* 소계 */}
                      <div className="text-right w-24">
                        <p className="font-bold text-gray-900">
                          {(item.unitPrice * item.quantity).toLocaleString()}원
                        </p>
                      </div>

                      {/* 삭제 */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 주문 메모 - 모바일 */}
            <div className="lg:hidden rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <FileText size={20} className="text-purple-600" />
                주문 메모 (선택)
              </h2>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="외부 주문 출처를 기록하세요 (예: 밴드 댓글, 문자 주문 등)"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors resize-none"
                rows={3}
              />
            </div>

            {/* 합계 및 버튼 */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">주문 합계</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {totalAmount.toLocaleString()}원
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  총 {orderItems.reduce((sum, item) => sum + item.quantity, 0)}개 상품
                </div>
              </div>

              <div className="flex gap-3">
                <Link href="/shop/order/list" className="flex-1 sm:flex-none">
                  <Button variant="secondary" fullWidth className="sm:px-8">
                    취소
                  </Button>
                </Link>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={!isFormValid() || isSubmitting}
                  loading={isSubmitting}
                  className="flex-1 sm:flex-none sm:px-12"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    '주문 생성'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
