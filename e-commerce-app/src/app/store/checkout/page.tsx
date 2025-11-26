'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, User, MapPin, CreditCard, Truck } from 'lucide-react'
import TossPaymentWidget from '@/domain/payments/components/payments/TossPaymentWidget'

interface CartItem {
  id: number
  productId: number
  variantId: number | null
  name: string
  optionSummary: string | null
  image: string
  price: number
  quantity: number
}

interface CheckoutFormData {
  customerName: string
  customerPhone: string
  customerEmail: string
  recipientName: string
  recipientPhone: string
  shippingAddress: {
    address: string
    detailAddress: string
    zipCode: string
  }
  deliveryMemo: string
  sameAsCustomer: boolean
}

export default function CheckoutPage() {
  const searchParams = useSearchParams()
  const fromCart = searchParams.get('fromCart') === 'true'
  const productId = searchParams.get('productId')
  const quantity = parseInt(searchParams.get('quantity') || '1')

  const [product, setProduct] = useState<any>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState<CheckoutFormData>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    recipientName: '',
    recipientPhone: '',
    shippingAddress: {
      address: '',
      detailAddress: '',
      zipCode: ''
    },
    deliveryMemo: '',
    sameAsCustomer: true
  })
  const [order, setOrder] = useState<any>(null)
  const [showPaymentWidget, setShowPaymentWidget] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (fromCart) {
      loadCartItems()
    } else if (productId) {
      loadProduct()
    } else {
      setIsLoading(false)
    }
  }, [fromCart, productId])

  // 주문자 정보와 수령인 정보 동기화
  useEffect(() => {
    if (formData.sameAsCustomer) {
      setFormData(prev => ({
        ...prev,
        recipientName: prev.customerName,
        recipientPhone: prev.customerPhone
      }))
    }
  }, [formData.customerName, formData.customerPhone, formData.sameAsCustomer])

  const loadCartItems = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/cart')
      const data = await response.json()

      if (data.success && data.cart?.items?.length > 0) {
        setCartItems(data.cart.items)
      } else {
        // 장바구니가 비어있으면 장바구니 페이지로 이동
        window.location.href = '/store/cart'
      }
    } catch (error) {
      console.error('장바구니 로딩 실패:', error)
      window.location.href = '/store/cart'
    } finally {
      setIsLoading(false)
    }
  }

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/shop/products/${productId}`)
      const data = await response.json()

      if (data.success) {
        setProduct(data.product)
      } else {
        setProduct({
          id: productId,
          title: '상품',
          images: ['/placeholder.jpg'],
          originalPrice: 0,
          salePrice: 0,
          category: ''
        })
      }
    } catch (error) {
      console.error('상품 로딩 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return price?.toLocaleString('ko-KR') || '0'
  }

  const calculateShipping = (subtotal: number) => {
    const freeShippingAmount = 30000
    const shippingFee = 3000
    return subtotal >= freeShippingAmount ? 0 : shippingFee
  }

  const handleFormChange = (field: string, value: string | boolean) => {
    if (field.startsWith('shippingAddress.')) {
      const addressField = field.split('.')[1]
      setFormData(prev => ({
        ...prev,
        shippingAddress: {
          ...prev.shippingAddress,
          [addressField]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleSubmit = async () => {
    // 폼 검증
    if (!formData.customerName || !formData.customerPhone) {
      alert('주문자 정보를 입력해 주세요.')
      return
    }

    if (!formData.shippingAddress.address) {
      alert('배송 주소를 입력해 주세요.')
      return
    }

    const recipientName = formData.sameAsCustomer ? formData.customerName : formData.recipientName
    const recipientPhone = formData.sameAsCustomer ? formData.customerPhone : formData.recipientPhone

    if (!recipientName || !recipientPhone) {
      alert('수령인 정보를 입력해 주세요.')
      return
    }

    try {
      setIsSubmitting(true)

      // 주문 생성 API 호출
      const orderData: any = {
        customerInfo: {
          name: formData.customerName,
          phone: formData.customerPhone,
          email: formData.customerEmail || undefined
        },
        shippingAddress: {
          address: formData.shippingAddress.address,
          postalCode: formData.shippingAddress.zipCode,
          addressDetail: formData.shippingAddress.detailAddress,
          recipientName,
          recipientPhone,
          deliveryMemo: formData.deliveryMemo || undefined
        }
      }

      if (fromCart) {
        orderData.fromCart = true
      } else {
        orderData.items = [{
          productId: parseInt(productId!),
          quantity
        }]
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      })

      const data = await response.json()

      if (data.success) {
        setOrder(data.order)
        setShowPaymentWidget(true)
      } else {
        alert(data.error || '주문 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('주문 생성 오류:', error)
      alert('주문 생성 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 계산
  let subtotal = 0
  let orderItemCount = 0
  let orderName = ''

  if (fromCart && cartItems.length > 0) {
    subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    orderItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
    orderName = cartItems.length > 1
      ? `${cartItems[0].name} 외 ${cartItems.length - 1}건`
      : cartItems[0].name
  } else if (product) {
    subtotal = product.salePrice * quantity
    orderItemCount = quantity
    orderName = product.title
  }

  const shippingFee = calculateShipping(subtotal)
  const totalAmount = subtotal + shippingFee

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!fromCart && !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">상품을 찾을 수 없습니다.</p>
          <Link href="/store" className="text-blue-600 hover:underline">쇼핑몰 홈으로 돌아가기</Link>
        </div>
      </div>
    )
  }

  if (showPaymentWidget && order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setShowPaymentWidget(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">결제하기</h1>
            </div>

            <TossPaymentWidget
              orderId={order.orderNumber}
              orderName={orderName}
              customerName={formData.customerName}
              customerEmail={formData.customerEmail || undefined}
              amount={totalAmount}
              onPaymentSuccess={(payment) => {
                console.log('결제 성공:', payment)
              }}
              onPaymentFail={(error) => {
                console.error('결제 실패:', error)
                alert('결제에 실패했습니다.')
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link
              href={fromCart ? '/store/cart' : `/store/product/${productId}`}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">주문하기</h1>
          </div>

          {/* 상품 정보 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-600" />
              주문 상품 {fromCart && `(${cartItems.length}개)`}
            </h2>

            {fromCart ? (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <img
                      src={item.image || '/placeholder.jpg'}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{item.name}</h3>
                      {item.optionSummary && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.optionSummary}</p>
                      )}
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-500">수량: {item.quantity}개</span>
                        <span className="font-semibold text-blue-600 text-sm">
                          {formatPrice(item.price * item.quantity)}원
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : product && (
              <div className="flex gap-4">
                <img
                  src={product.images?.[0] || '/placeholder.jpg'}
                  alt={product.title}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-1">{product.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{product.category}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">수량: {quantity}개</span>
                    <span className="font-semibold text-blue-600">{formatPrice(product.salePrice)}원</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 주문자 정보 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-600" />
              주문자 정보
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => handleFormChange('customerName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  휴대폰 번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => handleFormChange('customerPhone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="010-1234-5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => handleFormChange('customerEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="example@email.com"
                />
              </div>
            </div>
          </div>

          {/* 배송지 정보 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-600" />
              배송지 정보
            </h2>

            {/* 수령인 동일 체크 */}
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sameAsCustomer}
                onChange={(e) => handleFormChange('sameAsCustomer', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">주문자 정보와 동일</span>
            </label>

            <div className="space-y-4">
              {!formData.sameAsCustomer && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      수령인 이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.recipientName}
                      onChange={(e) => handleFormChange('recipientName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="홍길동"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      수령인 휴대폰 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.recipientPhone}
                      onChange={(e) => handleFormChange('recipientPhone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="010-1234-5678"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  우편번호
                </label>
                <input
                  type="text"
                  value={formData.shippingAddress.zipCode}
                  onChange={(e) => handleFormChange('shippingAddress.zipCode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="12345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주소 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.shippingAddress.address}
                  onChange={(e) => handleFormChange('shippingAddress.address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="서울특별시 강남구 테헤란로 123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상세주소
                </label>
                <input
                  type="text"
                  value={formData.shippingAddress.detailAddress}
                  onChange={(e) => handleFormChange('shippingAddress.detailAddress', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="101동 1001호"
                />
              </div>
            </div>
          </div>

          {/* 배송 메모 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-gray-600" />
              배송 요청사항
            </h2>
            <select
              value={formData.deliveryMemo}
              onChange={(e) => handleFormChange('deliveryMemo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">배송 메모를 선택해주세요</option>
              <option value="문 앞에 놓아주세요">문 앞에 놓아주세요</option>
              <option value="경비실에 맡겨주세요">경비실에 맡겨주세요</option>
              <option value="배송 전 연락 부탁드립니다">배송 전 연락 부탁드립니다</option>
              <option value="부재 시 연락 부탁드립니다">부재 시 연락 부탁드립니다</option>
            </select>
          </div>

          {/* 결제 금액 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-600" />
              결제 금액
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">상품금액</span>
                <span className="text-gray-900">{formatPrice(subtotal)}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">배송비</span>
                <span className={shippingFee === 0 ? 'text-blue-600' : 'text-gray-900'}>
                  {shippingFee > 0 ? `${formatPrice(shippingFee)}원` : '무료'}
                </span>
              </div>
              {shippingFee > 0 && subtotal < 30000 && (
                <p className="text-xs text-blue-600">
                  {formatPrice(30000 - subtotal)}원 추가 시 무료배송
                </p>
              )}
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-gray-900">총 결제금액</span>
                  <span className="text-xl font-bold text-blue-600">{formatPrice(totalAmount)}원</span>
                </div>
              </div>
            </div>
          </div>

          {/* 결제하기 버튼 - Fixed Bottom */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
            <div className="container mx-auto max-w-2xl">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '주문 생성 중...' : `${formatPrice(totalAmount)}원 결제하기`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
