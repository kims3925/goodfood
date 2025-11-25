'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Search,
  Minus,
  Plus,
  ShoppingCart,
  ImageOff,
  Check,
  ArrowLeft,
  X,
  MapPin,
  CreditCard,
  Receipt,
  Truck,
  ChevronDown,
} from 'lucide-react'

interface Product {
  id: number
  name: string
  price: number | null
  wholesalePrice: number | null
  thumbnailUrl: string | null
  status: string
}

type PaymentMethod = 'CARD' | 'BANK_TRANSFER' | 'VIRTUAL_ACCOUNT'
type CashReceiptType = 'NONE' | 'INCOME' | 'EXPENSE'

export default function NewOrderPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // 주문 정보
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [showProductSelector, setShowProductSelector] = useState(false)

  // 주문자 정보
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  // 배송지 정보
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [deliveryMemo, setDeliveryMemo] = useState('')
  const [sameAsOrderer, setSameAsOrderer] = useState(false)

  // 결제 정보
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD')
  const [cashReceiptType, setCashReceiptType] = useState<CashReceiptType>('NONE')
  const [cashReceiptNumber, setCashReceiptNumber] = useState('')

  // 배송비
  const SHIPPING_FEE = 3000
  const FREE_SHIPPING_THRESHOLD = 50000

  const [submitting, setSubmitting] = useState(false)

  // 상품 목록 로드
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/product?limit=100&status=ACTIVE')
        const data = await res.json()
        if (data.success) {
          setProducts(data.data.products || data.data || [])
        }
      } catch (error) {
        console.error('상품 로드 실패:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  // 주문자 정보와 동일 체크
  useEffect(() => {
    if (sameAsOrderer) {
      setRecipientName(customerName)
      setRecipientPhone(customerPhone)
    }
  }, [sameAsOrderer, customerName, customerPhone])

  // 검색 필터링
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products
    const query = searchQuery.toLowerCase()
    return products.filter(p => p.name.toLowerCase().includes(query))
  }, [products, searchQuery])

  // 금액 계산
  const productTotal = useMemo(() => {
    if (!selectedProduct?.price) return 0
    return selectedProduct.price * quantity
  }, [selectedProduct, quantity])

  const shippingFee = useMemo(() => {
    if (productTotal >= FREE_SHIPPING_THRESHOLD) return 0
    return productTotal > 0 ? SHIPPING_FEE : 0
  }, [productTotal])

  const totalAmount = productTotal + shippingFee

  // 수량 변경
  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => Math.max(1, prev + delta))
  }

  // 상품 선택
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product)
    setShowProductSelector(false)
    setQuantity(1)
  }

  // 주문 제출
  const handleSubmit = async () => {
    // 유효성 검사
    if (!selectedProduct) {
      alert('상품을 선택해주세요.')
      return
    }
    if (!customerName.trim()) {
      alert('주문자 이름을 입력해주세요.')
      return
    }
    if (!customerPhone.trim()) {
      alert('주문자 연락처를 입력해주세요.')
      return
    }
    if (!recipientName.trim()) {
      alert('받는 분 이름을 입력해주세요.')
      return
    }
    if (!address.trim()) {
      alert('배송지 주소를 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/order/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity,
          unitPrice: selectedProduct.price || 0,
          shippingFee,
          totalPrice: totalAmount,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          postalCode: postalCode.trim(),
          address: address.trim(),
          addressDetail: addressDetail.trim() || null,
          deliveryMemo: deliveryMemo || null,
          paymentMethod,
          cashReceiptType,
          cashReceiptNumber: cashReceiptNumber.trim() || null,
        }),
      })

      const data = await res.json()

      if (data.success) {
        alert('주문이 등록되었습니다!')
        router.push('/order/list')
      } else {
        alert(data.error || '주문 등록에 실패했습니다.')
      }
    } catch (error) {
      console.error('주문 등록 실패:', error)
      alert('주문 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '가격 미정'
    return price.toLocaleString() + '원'
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4"
        >
          <ArrowLeft size={20} />
          <span>뒤로가기</span>
        </button>
        <h1 className="text-2xl font-bold text-text-primary">주문서 작성</h1>
        <p className="text-text-secondary mt-1">주문 정보를 입력하고 결제를 진행하세요</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Order Form */}
        <div className="flex-1 space-y-6">
          {/* 1. 주문자 정보 */}
          <section className="bg-white rounded-lg border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-surface">
              <h2 className="font-semibold text-text-primary">주문자 정보</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">이름 *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="주문자 이름"
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">연락처 *</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 2. 배송지 정보 */}
          <section className="bg-white rounded-lg border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-text-secondary" />
                <h2 className="font-semibold text-text-primary">배송지</h2>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsOrderer}
                  onChange={(e) => setSameAsOrderer(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary-color focus:ring-primary-light"
                />
                <span className="text-text-secondary">주문자 정보와 동일</span>
              </label>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">받는 분 *</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="받는 분 이름"
                    disabled={sameAsOrderer}
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">연락처 *</label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    disabled={sameAsOrderer}
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light disabled:bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">주소 *</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="우편번호"
                    className="w-32 px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
                  />
                  <button
                    type="button"
                    className="px-4 py-2.5 border border-border rounded-lg hover:bg-surface transition-colors text-sm"
                  >
                    주소 검색
                  </button>
                </div>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="기본 주소"
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light mb-2"
                />
                <input
                  type="text"
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                  placeholder="상세 주소 (동/호수)"
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">배송 메모</label>
                <select
                  value={deliveryMemo}
                  onChange={(e) => setDeliveryMemo(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light bg-white"
                >
                  <option value="">배송 메모를 선택해주세요</option>
                  <option value="문 앞에 놓아주세요">문 앞에 놓아주세요</option>
                  <option value="경비실에 맡겨주세요">경비실에 맡겨주세요</option>
                  <option value="배송 전 연락 부탁드립니다">배송 전 연락 부탁드립니다</option>
                  <option value="부재 시 휴대폰으로 연락주세요">부재 시 휴대폰으로 연락주세요</option>
                  <option value="직접입력">직접 입력</option>
                </select>
              </div>
            </div>
          </section>

          {/* 3. 상품 정보 */}
          <section className="bg-white rounded-lg border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-surface flex items-center gap-2">
              <ShoppingCart size={18} className="text-text-secondary" />
              <h2 className="font-semibold text-text-primary">상품 정보</h2>
            </div>
            <div className="p-6">
              {selectedProduct ? (
                <div className="flex items-start gap-4">
                  {/* 썸네일 */}
                  {selectedProduct.thumbnailUrl ? (
                    <Image
                      src={selectedProduct.thumbnailUrl}
                      alt={selectedProduct.name}
                      width={100}
                      height={100}
                      className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <ImageOff size={32} className="text-gray-400" />
                    </div>
                  )}

                  {/* 상품 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary mb-1">{selectedProduct.name}</p>
                    <p className="text-lg font-bold text-primary-color mb-3">
                      {formatPrice(selectedProduct.price)}
                    </p>

                    {/* 수량 선택 */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-text-secondary">수량</span>
                      <div className="flex items-center border border-border rounded-lg overflow-hidden">
                        <button
                          onClick={() => handleQuantityChange(-1)}
                          disabled={quantity <= 1}
                          className="p-2 hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 text-center text-sm font-medium border-x border-border py-2 focus:outline-none"
                        />
                        <button
                          onClick={() => handleQuantityChange(1)}
                          className="p-2 hover:bg-surface transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 변경 버튼 */}
                  <button
                    onClick={() => setShowProductSelector(true)}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface transition-colors"
                  >
                    변경
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowProductSelector(true)}
                  className="w-full p-8 border-2 border-dashed border-border rounded-lg hover:border-primary-color hover:bg-primary-light/10 transition-all flex flex-col items-center gap-2"
                >
                  <ShoppingCart size={40} className="text-text-secondary" />
                  <span className="text-text-secondary">클릭하여 상품을 선택하세요</span>
                </button>
              )}
            </div>
          </section>

          {/* 4. 결제 수단 */}
          <section className="bg-white rounded-lg border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-surface flex items-center gap-2">
              <CreditCard size={18} className="text-text-secondary" />
              <h2 className="font-semibold text-text-primary">결제 수단</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'CARD', label: '신용/체크카드' },
                  { value: 'BANK_TRANSFER', label: '계좌이체' },
                  { value: 'VIRTUAL_ACCOUNT', label: '가상계좌' },
                ].map((method) => (
                  <button
                    key={method.value}
                    onClick={() => setPaymentMethod(method.value as PaymentMethod)}
                    className={`
                      p-4 border-2 rounded-lg text-center transition-all
                      ${paymentMethod === method.value
                        ? 'border-primary-color bg-primary-light text-primary-color'
                        : 'border-border hover:border-gray-300'}
                    `}
                  >
                    <span className="text-sm font-medium">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 5. 현금영수증 */}
          <section className="bg-white rounded-lg border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-surface flex items-center gap-2">
              <Receipt size={18} className="text-text-secondary" />
              <h2 className="font-semibold text-text-primary">현금영수증</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                {[
                  { value: 'NONE', label: '미발행' },
                  { value: 'INCOME', label: '소득공제용' },
                  { value: 'EXPENSE', label: '지출증빙용' },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setCashReceiptType(type.value as CashReceiptType)}
                    className={`
                      px-4 py-2 border-2 rounded-lg text-sm font-medium transition-all
                      ${cashReceiptType === type.value
                        ? 'border-primary-color bg-primary-light text-primary-color'
                        : 'border-border hover:border-gray-300'}
                    `}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {cashReceiptType !== 'NONE' && (
                <input
                  type="text"
                  value={cashReceiptNumber}
                  onChange={(e) => setCashReceiptNumber(e.target.value)}
                  placeholder={cashReceiptType === 'INCOME' ? '휴대폰 번호 (- 제외)' : '사업자등록번호'}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              )}
            </div>
          </section>
        </div>

        {/* Right: Order Summary */}
        <div className="w-full lg:w-96">
          <div className="bg-white rounded-lg border border-border overflow-hidden lg:sticky lg:top-6">
            <div className="px-6 py-4 border-b border-border bg-surface">
              <h2 className="font-semibold text-text-primary">결제 금액</h2>
            </div>
            <div className="p-6 space-y-4">
              {/* 상품 미리보기 */}
              {selectedProduct && (
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  {selectedProduct.thumbnailUrl ? (
                    <Image
                      src={selectedProduct.thumbnailUrl}
                      alt={selectedProduct.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <ImageOff size={20} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{selectedProduct.name}</p>
                    <p className="text-xs text-text-secondary">{quantity}개</p>
                  </div>
                </div>
              )}

              {/* 금액 상세 */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">총 상품 가격</span>
                  <span className="font-medium">{productTotal.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary flex items-center gap-1">
                    <Truck size={14} />
                    배송비
                  </span>
                  <span className="font-medium">
                    {shippingFee === 0 && productTotal > 0 ? (
                      <span className="text-green-600">무료</span>
                    ) : (
                      `${shippingFee.toLocaleString()}원`
                    )}
                  </span>
                </div>
                {productTotal > 0 && productTotal < FREE_SHIPPING_THRESHOLD && (
                  <p className="text-xs text-text-secondary bg-surface px-3 py-2 rounded-lg">
                    {(FREE_SHIPPING_THRESHOLD - productTotal).toLocaleString()}원 더 구매 시 무료배송
                  </p>
                )}
              </div>

              {/* 총 결제 금액 */}
              <div className="pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-text-primary">총 결제 금액</span>
                  <span className="text-2xl font-bold text-primary-color">
                    {totalAmount.toLocaleString()}원
                  </span>
                </div>
              </div>

              {/* 결제 버튼 */}
              <button
                onClick={handleSubmit}
                disabled={!selectedProduct || !customerName.trim() || !address.trim() || submitting}
                className="w-full py-4 bg-primary-color text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg mt-4"
              >
                {submitting ? '처리 중...' : `${totalAmount.toLocaleString()}원 결제하기`}
              </button>

              <p className="text-xs text-text-secondary text-center">
                주문 내용을 확인하였으며, 결제에 동의합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Product Selector Modal */}
      {showProductSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-bold">상품 선택</h3>
              <button
                onClick={() => setShowProductSelector(false)}
                className="p-1 hover:bg-surface rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="상품명 검색..."
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
                  autoFocus
                />
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="text-center py-8 text-text-secondary">로딩 중...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">
                  {searchQuery ? '검색 결과가 없습니다' : '등록된 상품이 없습니다'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left
                        ${selectedProduct?.id === product.id
                          ? 'bg-primary-light border-2 border-primary-color'
                          : 'hover:bg-surface border-2 border-transparent'}
                      `}
                    >
                      {/* 썸네일 */}
                      {product.thumbnailUrl ? (
                        <Image
                          src={product.thumbnailUrl}
                          alt={product.name}
                          width={56}
                          height={56}
                          className="w-14 h-14 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <ImageOff size={20} className="text-gray-400" />
                        </div>
                      )}

                      {/* 상품 정보 */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary truncate">{product.name}</p>
                        <p className="text-sm text-primary-color font-medium mt-0.5">
                          {formatPrice(product.price)}
                        </p>
                      </div>

                      {/* 선택 표시 */}
                      {selectedProduct?.id === product.id && (
                        <div className="w-6 h-6 bg-primary-color rounded-full flex items-center justify-center">
                          <Check size={16} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
