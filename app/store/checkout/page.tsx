'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, User, MapPin, CreditCard } from 'lucide-react'
import TossPaymentWidget from '@/components/payments/TossPaymentWidget'

interface CheckoutFormData {
  customerName: string
  customerPhone: string
  customerEmail: string
  shippingAddress: {
    address: string
    detailAddress: string
    zipCode: string
  }
}

export default function CheckoutPage() {
  const searchParams = useSearchParams()
  const productId = searchParams.get('productId')
  const quantity = parseInt(searchParams.get('quantity') || '1')

  const [product, setProduct] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState<CheckoutFormData>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    shippingAddress: {
      address: '',
      detailAddress: '',
      zipCode: ''
    }
  })
  const [order, setOrder] = useState<any>(null)
  const [showPaymentWidget, setShowPaymentWidget] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (productId) {
      loadProduct()
    }
  }, [productId])

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/shop/products/${productId}`)
      const data = await response.json()

      if (data.success) {
        setProduct(data.product)
      } else {
        // 목업 데이터
        setProduct({
          id: productId,
          title: '[500g 2,900원] 택배비보다 싼!! 가마솥 사골 도가니탕 2종',
          images: ['https://via.placeholder.com/600x600/FF6B6B/FFFFFF?text=도가니탕'],
          originalPrice: 4900,
          salePrice: 2900,
          category: '육류'
        })
      }
    } catch (error) {
      console.error('Failed to load product:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString()
  }

  const calculateShipping = (subtotal: number) => {
    const freeShippingAmount = 30000
    const shippingFee = 3000
    return subtotal >= freeShippingAmount ? 0 : shippingFee
  }

  const handleFormChange = (field: string, value: string) => {
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
      alert('필수 정보를 입력해 주세요.')
      return
    }

    if (!formData.shippingAddress.address) {
      alert('배송 주소를 입력해 주세요.')
      return
    }

    try {
      setIsSubmitting(true)

      // 주문 생성 API 호출
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          quantity,
          customerInfo: {
            name: formData.customerName,
            phone: formData.customerPhone,
            email: formData.customerEmail
          },
          shippingAddress: formData.shippingAddress
        })
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">상품을 찾을 수 없습니다.</p>
          <Link href="/store" className="text-blue-600 hover:underline">쇼핑몰 홈으로 돌아가기</Link>
        </div>
      </div>
    )
  }

  const subtotal = product.salePrice * quantity
  const shippingFee = calculateShipping(subtotal)
  const totalAmount = subtotal + shippingFee

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
              orderName={`${product.title} ${quantity > 1 ? `외 ${quantity-1}건` : ''}`}
              customerName={formData.customerName}
              customerEmail={formData.customerEmail}
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link href={`/store/product/${productId}`} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">주문하기</h1>
          </div>

          {/* 상품 정보 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-600" />
              주문 상품
            </h2>
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
            <div className="space-y-4">
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
                <span className="text-gray-900">
                  {shippingFee > 0 ? `${formatPrice(shippingFee)}원` : '무료'}
                </span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-gray-900">총 결제금액</span>
                  <span className="text-xl font-bold text-blue-600">{formatPrice(totalAmount)}원</span>
                </div>
              </div>
            </div>
          </div>

          {/* 결제하기 버튼 */}
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
  )
}