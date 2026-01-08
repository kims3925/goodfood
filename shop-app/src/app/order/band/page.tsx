'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Script from 'next/script'
import dynamic from 'next/dynamic'
import {
  Search,
  Minus,
  Plus,
  ShoppingCart,
  ImageOff,
  Check,
  ArrowLeft,
  X,
  User,
  Store,
  MapPin,
  Receipt,
  Truck,
  CreditCard,
} from 'lucide-react'

// TossPaymentWidget은 클라이언트 전용 (SSR 비활성화)
const TossPaymentWidget = dynamic(
  () => import('@/modules/payments/components/TossPaymentWidget'),
  { ssr: false }
)

interface RetailBand {
  id: number
  name: string
  bandKey: string
  coverUrl: string | null
  isActive: boolean
}

interface PublishedProduct {
  id: number // ProductPublish.id
  productId: number
  name: string
  price: number | null
  thumbnailUrl: string | null
  status: string
}

type CashReceiptType = 'NONE' | 'INCOME' | 'EXPENSE'

interface OrderData {
  orderNumber: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
  totalAmount: number
  thumbnailUrl: string | null
  retailBandName: string
}

export default function BandOrderPage() {
  const router = useRouter()

  // 소매밴드 목록
  const [retailBands, setRetailBands] = useState<RetailBand[]>([])
  const [selectedBand, setSelectedBand] = useState<RetailBand | null>(null)
  const [loadingBands, setLoadingBands] = useState(true)
  const [showBandSelector, setShowBandSelector] = useState(false)

  // 발행 상품 목록
  const [products, setProducts] = useState<PublishedProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 주문 정보
  const [selectedProduct, setSelectedProduct] = useState<PublishedProduct | null>(null)
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

  // 현금영수증
  const [cashReceiptType, setCashReceiptType] = useState<CashReceiptType>('NONE')
  const [cashReceiptNumber, setCashReceiptNumber] = useState('')

  // 배송비 설정
  const SHIPPING_FEE = 3000
  const FREE_SHIPPING_THRESHOLD = 50000

  const [submitting, setSubmitting] = useState(false)

  // 결제 관련 상태
  const [showPayment, setShowPayment] = useState(false)
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [tossClientKey, setTossClientKey] = useState<string>('')

  // 소매밴드 목록 로드
  useEffect(() => {
    const fetchRetailBands = async () => {
      try {
        const res = await fetch('/api/order/band/retail-bands')
        const data = await res.json()
        if (data.success) {
          const activeBands = (data.data || []).filter((b: RetailBand) => b.isActive)
          setRetailBands(activeBands)
        }
      } catch (error) {
        console.error('소매밴드 로드 실패:', error)
      } finally {
        setLoadingBands(false)
      }
    }
    fetchRetailBands()
  }, [])

  // 선택된 밴드의 발행 상품 로드
  useEffect(() => {
    if (!selectedBand) {
      setProducts([])
      return
    }

    const fetchProducts = async () => {
      setLoadingProducts(true)
      try {
        const res = await fetch(`/api/order/band/products?retailBandId=${selectedBand.id}`)
        const data = await res.json()
        if (data.success) {
          setProducts(data.data || [])
        }
      } catch (error) {
        console.error('발행 상품 로드 실패:', error)
      } finally {
        setLoadingProducts(false)
      }
    }
    fetchProducts()
  }, [selectedBand])

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

  // 밴드 선택
  const handleSelectBand = (band: RetailBand) => {
    setSelectedBand(band)
    setShowBandSelector(false)
    setSelectedProduct(null)
    setQuantity(1)
  }

  // 상품 선택
  const handleSelectProduct = (product: PublishedProduct) => {
    setSelectedProduct(product)
    setShowProductSelector(false)
    setQuantity(1)
  }

  // 다음 주소 검색 API
  const openPostcode = () => {
    new (window as any).daum.Postcode({
      oncomplete: (data: any) => {
        const fullAddress = data.roadAddress || data.jibunAddress
        setPostalCode(data.zonecode)
        setAddress(fullAddress)
        if (data.buildingName) {
          setAddressDetail(data.buildingName)
        }
      },
    }).open()
  }

  // 입력 검증
  const validateInputs = (): string | null => {
    if (!selectedBand) return '소매밴드를 선택해주세요.'
    if (!selectedProduct) return '상품을 선택해주세요.'
    if (!customerName.trim()) return '주문자 이름을 입력해주세요.'
    if (!customerPhone.trim()) return '주문자 연락처를 입력해주세요.'
    if (!recipientName.trim()) return '받는 분 이름을 입력해주세요.'
    if (!address || !postalCode) return '배송 주소를 입력해주세요.'
    return null
  }

  // 주문 제출 - 결제 준비
  const handleSubmit = async () => {
    setPrepareError(null)

    const validationError = validateInputs()
    if (validationError) {
      setPrepareError(validationError)
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/order/band/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailBandId: selectedBand!.id,
          productPublishId: selectedProduct!.id,
          quantity,
          customerInfo: {
            name: customerName.trim(),
            phone: customerPhone.trim(),
          },
          shippingAddress: {
            recipientName: recipientName.trim(),
            recipientPhone: recipientPhone.trim() || customerPhone.trim(),
            address,
            postalCode,
            addressDetail: addressDetail.trim() || undefined,
            deliveryMemo: deliveryMemo || undefined,
          },
          cashReceipt: {
            type: cashReceiptType,
            number: cashReceiptNumber.trim() || undefined,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setPrepareError(data.error || '주문 준비에 실패했습니다.')
        return
      }

      // 주문 준비 성공 - 결제 위젯 표시
      setOrderData(data.order)
      if (data.tossClientKey) {
        setTossClientKey(data.tossClientKey)
      }
      setShowPayment(true)
    } catch (error) {
      console.error('주문 준비 실패:', error)
      setPrepareError('주문 준비 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // 결제 취소 핸들러
  const handlePaymentCancel = () => {
    setShowPayment(false)
    setOrderData(null)
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '가격 미정'
    return price.toLocaleString() + '원'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Daum Postcode API Script */}
      <Script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        strategy="lazyOnload"
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft size={20} />
            <span>뒤로가기</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">밴드 주문서</h1>
          <p className="text-gray-500 mt-1">소매밴드에 발행된 상품으로 주문합니다</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Order Form */}
          <div className="flex-1 space-y-6">
            {/* 1. 소매밴드 선택 */}
            <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                <Store size={18} className="text-gray-500" />
                <h2 className="font-semibold text-gray-900">소매밴드 선택</h2>
              </div>
              <div className="p-6">
                {selectedBand ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedBand.coverUrl ? (
                        <Image
                          src={selectedBand.coverUrl}
                          alt={selectedBand.name}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Store size={24} className="text-purple-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{selectedBand.name}</p>
                        <p className="text-sm text-gray-500">{selectedBand.bandKey}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowBandSelector(true)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowBandSelector(true)}
                    disabled={loadingBands}
                    className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50/50 transition-all flex flex-col items-center gap-2"
                  >
                    <Store size={40} className="text-gray-400" />
                    <span className="text-gray-500">
                      {loadingBands ? '로딩 중...' : '클릭하여 소매밴드를 선택하세요'}
                    </span>
                  </button>
                )}
              </div>
            </section>

            {/* 2. 상품 정보 */}
            <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                <ShoppingCart size={18} className="text-gray-500" />
                <h2 className="font-semibold text-gray-900">상품 정보</h2>
                {selectedBand && (
                  <span className="text-sm text-gray-500 ml-auto">
                    발행 상품 {products.length}개
                  </span>
                )}
              </div>
              <div className="p-6">
                {!selectedBand ? (
                  <div className="text-center py-8 text-gray-500">
                    먼저 소매밴드를 선택해주세요
                  </div>
                ) : selectedProduct ? (
                  <div className="flex items-start gap-4">
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

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 mb-1">{selectedProduct.name}</p>
                      <p className="text-lg font-bold text-purple-600 mb-3">
                        {formatPrice(selectedProduct.price)}
                      </p>

                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">수량</span>
                        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleQuantityChange(-1)}
                            disabled={quantity <= 1}
                            className="p-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 text-center text-sm font-medium border-x border-gray-300 py-2 focus:outline-none"
                          />
                          <button
                            onClick={() => handleQuantityChange(1)}
                            className="p-2 hover:bg-gray-50 transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowProductSelector(true)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowProductSelector(true)}
                    disabled={loadingProducts}
                    className="w-full p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50/50 transition-all flex flex-col items-center gap-2"
                  >
                    <ShoppingCart size={40} className="text-gray-400" />
                    <span className="text-gray-500">
                      {loadingProducts ? '상품 로딩 중...' : '클릭하여 상품을 선택하세요'}
                    </span>
                  </button>
                )}
              </div>
            </section>

            {/* 3. 주문자 정보 */}
            <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                <User size={18} className="text-gray-500" />
                <h2 className="font-semibold text-gray-900">주문자 정보</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">이름 *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="주문자 이름"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">연락처</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="010-0000-0000"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 4. 배송지 정보 */}
            <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                <MapPin size={18} className="text-gray-500" />
                <h2 className="font-semibold text-gray-900">배송지</h2>
              </div>
              <div className="p-6 space-y-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameAsOrderer}
                    onChange={(e) => setSameAsOrderer(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-gray-600">주문자 정보와 동일</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">받는 분 *</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="받는 분 이름"
                      disabled={sameAsOrderer}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">연락처</label>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="010-0000-0000"
                      disabled={sameAsOrderer}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:bg-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">주소 *</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="우편번호"
                      onClick={openPostcode}
                      className="w-32 px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 cursor-pointer focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={openPostcode}
                      className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      주소 검색
                    </button>
                  </div>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="주소 검색 버튼을 클릭하세요"
                    onClick={openPostcode}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 cursor-pointer focus:outline-none mb-2"
                  />
                  <input
                    type="text"
                    value={addressDetail}
                    onChange={(e) => setAddressDetail(e.target.value)}
                    placeholder="상세 주소 (동/호수)"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">배송 메모</label>
                  <select
                    value={deliveryMemo}
                    onChange={(e) => setDeliveryMemo(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 bg-white"
                  >
                    <option value="">배송 메모를 선택해주세요</option>
                    <option value="문 앞에 놓아주세요">문 앞에 놓아주세요</option>
                    <option value="경비실에 맡겨주세요">경비실에 맡겨주세요</option>
                    <option value="배송 전 연락 부탁드립니다">배송 전 연락 부탁드립니다</option>
                    <option value="부재 시 휴대폰으로 연락주세요">부재 시 휴대폰으로 연락주세요</option>
                  </select>
                </div>
              </div>
            </section>

            {/* 5. 현금영수증 */}
            <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                <Receipt size={18} className="text-gray-500" />
                <h2 className="font-semibold text-gray-900">현금영수증</h2>
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
                          ? 'border-purple-600 bg-purple-50 text-purple-600'
                          : 'border-gray-300 hover:border-gray-400'}
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                  />
                )}
              </div>
            </section>
          </div>

          {/* Right: Order Summary */}
          <div className="w-full lg:w-96">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden lg:sticky lg:top-6">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-semibold text-gray-900">주문 요약</h2>
              </div>
              <div className="p-6 space-y-4">
                {/* 소매밴드 */}
                {selectedBand && (
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Store size={16} className="text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">소매밴드</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{selectedBand.name}</p>
                    </div>
                  </div>
                )}

                {/* 상품 미리보기 */}
                {selectedProduct && (
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
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
                      <p className="text-sm font-medium text-gray-900 truncate">{selectedProduct.name}</p>
                      <p className="text-xs text-gray-500">{quantity}개</p>
                    </div>
                  </div>
                )}

                {/* 금액 상세 */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">상품 금액</span>
                    <span className="font-medium">{productTotal.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1">
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
                    <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                      {(FREE_SHIPPING_THRESHOLD - productTotal).toLocaleString()}원 더 구매 시 무료배송
                    </p>
                  )}
                </div>

                {/* 총 금액 */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">총 금액</span>
                    <span className="text-2xl font-bold text-purple-600">
                      {totalAmount.toLocaleString()}원
                    </span>
                  </div>
                </div>

                {/* 에러 메시지 */}
                {prepareError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{prepareError}</p>
                  </div>
                )}

                {/* 주문 버튼 */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedBand || !selectedProduct || totalAmount <= 0}
                  className={`
                    w-full py-4 font-semibold rounded-lg text-lg mt-4 transition-colors
                    ${submitting || !selectedBand || !selectedProduct || totalAmount <= 0
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'}
                  `}
                >
                  {submitting ? '주문 준비 중...' : `${totalAmount.toLocaleString()}원 결제하기`}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  주문 내용을 확인하고 결제를 진행해주세요.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Band Selector Modal */}
        {showBandSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold">소매밴드 선택</h3>
                <button
                  onClick={() => setShowBandSelector(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {loadingBands ? (
                  <div className="text-center py-8 text-gray-500">로딩 중...</div>
                ) : retailBands.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    등록된 소매밴드가 없습니다
                  </div>
                ) : (
                  <div className="space-y-2">
                    {retailBands.map((band) => (
                      <button
                        key={band.id}
                        onClick={() => handleSelectBand(band)}
                        className={`
                          w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left
                          ${selectedBand?.id === band.id
                            ? 'bg-purple-50 border-2 border-purple-500'
                            : 'hover:bg-gray-50 border-2 border-transparent'}
                        `}
                      >
                        {band.coverUrl ? (
                          <Image
                            src={band.coverUrl}
                            alt={band.name}
                            width={56}
                            height={56}
                            className="w-14 h-14 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <Store size={24} className="text-purple-500" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{band.name}</p>
                          <p className="text-sm text-gray-500 truncate">{band.bandKey}</p>
                        </div>

                        {selectedBand?.id === band.id && (
                          <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
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

        {/* Product Selector Modal */}
        {showProductSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold">상품 선택</h3>
                <button
                  onClick={() => setShowProductSelector(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="상품명 검색..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {loadingProducts ? (
                  <div className="text-center py-8 text-gray-500">로딩 중...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? '검색 결과가 없습니다' : '발행된 상품이 없습니다'}
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
                            ? 'bg-purple-50 border-2 border-purple-500'
                            : 'hover:bg-gray-50 border-2 border-transparent'}
                        `}
                      >
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

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{product.name}</p>
                          <p className="text-sm text-purple-600 font-medium mt-0.5">
                            {formatPrice(product.price)}
                          </p>
                        </div>

                        {selectedProduct?.id === product.id && (
                          <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
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

        {/* Payment Widget Modal */}
        {showPayment && orderData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full my-8">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <CreditCard size={20} className="text-purple-600" />
                  <h3 className="text-lg font-bold">결제하기</h3>
                </div>
                <button
                  onClick={handlePaymentCancel}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-4">
                {/* 주문 요약 */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    {orderData.thumbnailUrl ? (
                      <Image
                        src={orderData.thumbnailUrl}
                        alt={orderData.productName}
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                        <ImageOff size={24} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{orderData.productName}</p>
                      <p className="text-sm text-gray-500">{orderData.quantity}개 · {orderData.retailBandName}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm border-t border-gray-200 pt-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">상품 금액</span>
                      <span>{orderData.subtotal.toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">배송비</span>
                      <span className="text-green-600">무료</span>
                    </div>
                    <div className="flex justify-between font-bold pt-2 border-t border-gray-200 mt-2">
                      <span>총 결제금액</span>
                      <span className="text-purple-600">{orderData.totalAmount.toLocaleString()}원</span>
                    </div>
                  </div>
                </div>

                {/* 토스페이먼츠 위젯 */}
                <TossPaymentWidget
                  orderId={orderData.orderNumber}
                  orderName={`${orderData.productName} x ${orderData.quantity}`}
                  amount={orderData.totalAmount}
                  customerName={customerName}
                  customerPhone={customerPhone}
                  tossClientKey={tossClientKey}
                  onPaymentCancel={handlePaymentCancel}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
