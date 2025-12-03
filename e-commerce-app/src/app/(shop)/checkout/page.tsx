'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, Package, User, MapPin, CreditCard, Truck, Plus, Check, Building2, Wallet } from 'lucide-react'
import TossPaymentWidget from '@/modules/payments/components/TossPaymentWidget'

interface BankInfo {
  bankName: string
  bankAccount: string
  accountHolder: string
}

declare global {
  interface Window {
    daum: any
  }
}

interface Address {
  id: number
  label: string | null
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail: string | null
  isDefault: boolean
}

interface CartItem {
  id: number
  publishedProductId: number
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

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const fromCart = searchParams.get('fromCart') === 'true'
  const publishedProductId = searchParams.get('publishedProductId') // productId → publishedProductId로 변경
  const quantity = parseInt(searchParams.get('quantity') || '1')

  const [product, setProduct] = useState<any>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [cartChannelId, setCartChannelId] = useState<number | null>(null)
  const [productChannelId, setProductChannelId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 결제 방식 관련
  const [paymentMethod, setPaymentMethod] = useState<'TOSS' | 'BANK_TRANSFER'>('TOSS')
  const [channelBankInfo, setChannelBankInfo] = useState<BankInfo | null>(null)
  const [bankInfoLoading, setBankInfoLoading] = useState(false)

  // 회원 배송지 관련
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)

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
  const [tempOrderId, setTempOrderId] = useState<string>('') // 주문번호
  const [showPaymentWidget, setShowPaymentWidget] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Daum 우편번호 API (레이어 방식)
  const openAddressSearch = () => {
    new window.daum.Postcode({
      oncomplete: function (data: any) {
        const fullAddress = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress
        setFormData(prev => ({
          ...prev,
          shippingAddress: {
            ...prev.shippingAddress,
            zipCode: data.zonecode,
            address: fullAddress,
          }
        }))
        // 레이어 닫기
        const layer = document.getElementById('addressLayer')
        if (layer) layer.style.display = 'none'
        // body 스크롤 복원
        document.body.style.overflow = 'unset'
      },
      width: '100%',
      height: '100%',
    }).embed(document.getElementById('addressSearchIframe'))

    // 레이어 표시 및 body 스크롤 막기
    const layer = document.getElementById('addressLayer')
    if (layer) layer.style.display = 'block'
    document.body.style.overflow = 'hidden'
  }

  const closeAddressLayer = () => {
    const layer = document.getElementById('addressLayer')
    if (layer) layer.style.display = 'none'
    // body 스크롤 복원
    document.body.style.overflow = 'unset'
  }

  useEffect(() => {
    loadCheckoutData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCart, publishedProductId, session, status])

  const loadCheckoutData = async () => {
    try {
      setIsLoading(true)

      // 장바구니 또는 상품 로드
      if (fromCart) {
        await loadCartItems()
      } else if (publishedProductId) {
        await loadProduct()
      }

      // 회원인 경우 배송지 로드
      if (session) {
        const addressResponse = await fetch('/api/mypage/addresses')
        const addressData = await addressResponse.json()

        if (addressData.success) {
          setAddresses(addressData.addresses)

          // 기본 배송지 자동 선택
          const defaultAddress = addressData.addresses.find((addr: Address) => addr.isDefault)
          if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id)
            // 배송지 정보 자동 입력
            setFormData(prev => ({
              ...prev,
              recipientName: defaultAddress.recipientName,
              recipientPhone: defaultAddress.recipientPhone,
              shippingAddress: {
                address: defaultAddress.address,
                detailAddress: defaultAddress.addressDetail || '',
                zipCode: defaultAddress.postalCode,
              }
            }))
          }
        }
      }
    } catch (error) {
      console.error('Failed to load checkout data:', error)
    } finally {
      setIsLoading(false)
    }
  }

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

  // 배송지 선택 시 formData 업데이트
  const handleAddressSelect = (addressId: number) => {
    setSelectedAddressId(addressId)
    const selected = addresses.find(addr => addr.id === addressId)
    if (selected) {
      setFormData(prev => ({
        ...prev,
        recipientName: selected.recipientName,
        recipientPhone: selected.recipientPhone,
        shippingAddress: {
          address: selected.address,
          detailAddress: selected.addressDetail || '',
          zipCode: selected.postalCode,
        }
      }))
    }
  }

  const loadCartItems = async () => {
    try {
      const response = await fetch('/api/cart')
      const data = await response.json()

      if (data.success && data.cart?.items?.length > 0) {
        setCartItems(data.cart.items)
        setCartChannelId(data.cart.channelId || data.cart.retailBandId || null)
      } else {
        // 장바구니가 비어있으면 장바구니 페이지로 이동
        window.location.href = '/cart'
      }
    } catch (error) {
      console.error('장바구니 로딩 실패:', error)
      window.location.href = '/cart'
    }
  }

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      // publishedProductId를 통해 상품 조회
      const response = await fetch(`/api/shop/product-publish/${publishedProductId}`)
      const data = await response.json()

      if (data.success && data.publishedProduct) {
        const pp = data.publishedProduct
        const product = pp.product
        const mainVariant = product.variants?.[0]
        const images = product.post?.images?.map((img: any) => img.url) || []

        // 채널 ID 저장
        if (pp.channelId) {
          setProductChannelId(pp.channelId)
        }

        setProduct({
          id: product.id,
          publishedProductId: pp.id,
          title: product.name,
          description: product.description || '',
          images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
          originalPrice: mainVariant?.price || product.price || 0,
          salePrice: mainVariant?.price || product.price || 0,
          category: product.categoryId || '',
          stock: mainVariant?.stock || 100
        })
      } else {
        setProduct({
          id: publishedProductId,
          publishedProductId: publishedProductId,
          title: '상품',
          images: ['/placeholder.jpg'],
          originalPrice: 0,
          salePrice: 0,
          category: ''
        })
      }
    } catch (error) {
      console.error('상품 로딩 실패:', error)
      setProduct({
        id: publishedProductId,
        publishedProductId: publishedProductId,
        title: '상품',
        images: ['/placeholder.jpg'],
        originalPrice: 0,
        salePrice: 0,
        category: ''
      })
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

  // 채널 입금정보 로드
  const loadBankInfo = async (channelId: number) => {
    try {
      setBankInfoLoading(true)
      const response = await fetch(`/api/shop/channel/${channelId}/bank-info`)
      const data = await response.json()
      if (data.success) {
        setChannelBankInfo(data.bankInfo)
      } else {
        setChannelBankInfo(null)
        console.error('입금정보 로드 실패:', data.error)
      }
    } catch (error) {
      console.error('입금정보 로드 오류:', error)
      setChannelBankInfo(null)
    } finally {
      setBankInfoLoading(false)
    }
  }

  // 무통장입금 선택 시 입금정보 로드
  useEffect(() => {
    if (paymentMethod === 'BANK_TRANSFER') {
      const channelId = fromCart ? cartChannelId : productChannelId
      if (channelId) {
        loadBankInfo(channelId)
      }
    }
  }, [paymentMethod, cartChannelId, productChannelId, fromCart])

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
    // 로그인 체크
    if (!session?.user?.id) {
      router.push('/auth/login')
      return
    }

    // 폼 검증
    if (!formData.customerName || !formData.customerPhone) {
      return
    }

    if (!formData.shippingAddress.address) {
      return
    }

    const recipientName = formData.sameAsCustomer ? formData.customerName : formData.recipientName
    const recipientPhone = formData.sameAsCustomer ? formData.customerPhone : formData.recipientPhone

    if (!recipientName || !recipientPhone) {
      return
    }

    try {
      setIsSubmitting(true)

      // 주문 요청 데이터 준비
      const orderRequestData: any = {
        userId: session?.user?.id ? parseInt(session.user.id as string) : undefined,
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
        orderRequestData.fromCart = true
      } else {
        orderRequestData.fromCart = false
        orderRequestData.items = [{
          publishedProductId: parseInt(publishedProductId!),
          quantity
        }]
      }

      // 무통장입금 분기
      if (paymentMethod === 'BANK_TRANSFER') {
        const response = await fetch('/api/orders/bank-transfer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderRequestData)
        })

        const data = await response.json()

        if (data.success) {
          // 무통장입금 주문 완료 페이지로 이동
          const params = new URLSearchParams({
            orderNumber: data.order.orderNumber,
            totalAmount: data.order.totalAmount.toString(),
            bankName: data.bankInfo.bankName,
            bankAccount: data.bankInfo.bankAccount,
            accountHolder: data.bankInfo.accountHolder,
            depositDeadline: data.bankInfo.depositDeadline,
          })
          router.push(`/order/bank-transfer/complete?${params.toString()}`)
        } else {
          alert(data.error || '주문 생성에 실패했습니다.')
        }
      } else {
        // 토스 결제 플로우
        const response = await fetch('/api/orders/prepare', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderRequestData)
        })

        const data = await response.json()

        if (data.success) {
          // 주문번호 저장 (실제 주문은 결제 성공 시 생성됨)
          setTempOrderId(data.order.orderNumber)
          setShowPaymentWidget(true)
          // 🔼 여기서 페이지 맨 위로 스크롤
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }
      }
    } catch (error) {
      console.error('주문 준비 오류:', error)
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
          <Link href="/main" className="text-blue-600 hover:underline">쇼핑몰 홈으로 돌아가기</Link>
        </div>
      </div>
    )
  }

  if (showPaymentWidget && tempOrderId) {
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
              orderId={tempOrderId}
              orderName={orderName}
              customerName={formData.customerName}
              customerEmail={formData.customerEmail || undefined}
              amount={totalAmount}
              onPaymentFail={(error) => {
                console.error('결제 실패:', error)
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Daum Postcode Script */}
      <script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        async
      />

      {/* 주소 검색 레이어 */}
      <div
        id="addressLayer"
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
        }}
        onClick={closeAddressLayer}
      >
        <div
          style={{
            position: 'relative',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '500px',
            backgroundColor: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 섹션 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#fff',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111' }}>
              주소 검색
            </h3>
            <button
              onClick={closeAddressLayer}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                padding: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* 주소 검색 iframe */}
          <div style={{ height: '600px' }}>
            <div id="addressSearchIframe" style={{ width: '100%', height: '100%' }}></div>
          </div>
        </div>
      </div>

      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-[1050px] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <Link
                href={fromCart ? '/cart' : `/product/${product?.id || publishedProductId}`}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold text-gray-900">주문하기</h1>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
              {/* 좌측: 주문 정보 입력 */}
              <div className="flex-1">
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
                              <span className="font-semibold text-[#FF6B6B] text-sm">
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
                          <span className="font-semibold text-[#FF6B6B]">{formatPrice(product.salePrice)}원</span>
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent"
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

                  {/* 회원: 배송지 선택 */}
                  {session && addresses.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {addresses.map((address) => (
                        <div
                          key={address.id}
                          onClick={() => handleAddressSelect(address.id)}
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            selectedAddressId === address.id
                              ? 'border-[#FF6B6B] bg-[#FFF5F5]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {address.label && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                    {address.label}
                                  </span>
                                )}
                                {address.isDefault && (
                                  <span className="px-2 py-1 bg-[#FF6B6B] text-white text-xs rounded">
                                    기본배송지
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-gray-900 text-sm">{address.recipientName}</p>
                              <p className="text-sm text-gray-600">{address.recipientPhone}</p>
                              <p className="text-sm text-gray-600">
                                ({address.postalCode}) {address.address}
                              </p>
                              {address.addressDetail && (
                                <p className="text-sm text-gray-600">{address.addressDetail}</p>
                              )}
                            </div>
                            {selectedAddressId === address.id && (
                              <Check className="w-5 h-5 text-[#FF6B6B] flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => router.push('/mypage/addresses')}
                        className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-[#FF6B6B] hover:text-[#FF6B6B] transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        새 배송지 추가
                      </button>
                    </div>
                  )}

                  {/* 회원: 등록된 배송지 없음 */}
                  {session && addresses.length === 0 && (
                    <div className="text-center py-8 bg-gray-50 rounded-lg mb-4">
                      <p className="text-gray-600 mb-4">등록된 배송지가 없습니다</p>
                      <button
                        onClick={() => router.push('/mypage/addresses')}
                        className="px-6 py-2 bg-[#FF6B6B] text-white rounded-lg hover:bg-[#FF5252] transition-colors inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        배송지 추가하기
                      </button>
                    </div>
                  )}

                  {/* 비회원: 배송지 직접 입력 */}
                  {!session && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            받는 분 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.recipientName}
                            onChange={(e) => handleFormChange('recipientName', e.target.value)}
                            placeholder="이름"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            연락처 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={formData.recipientPhone}
                            onChange={(e) => handleFormChange('recipientPhone', e.target.value)}
                            placeholder="01012345678"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          주소 <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={formData.shippingAddress.zipCode}
                            placeholder="우편번호"
                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                            readOnly
                            required
                          />
                          <button
                            type="button"
                            onClick={openAddressSearch}
                            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                          >
                            주소 검색
                          </button>
                        </div>
                        <input
                          type="text"
                          value={formData.shippingAddress.address}
                          placeholder="기본 주소"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 mb-2"
                          readOnly
                          required
                        />
                        <input
                          type="text"
                          value={formData.shippingAddress.detailAddress}
                          onChange={(e) => handleFormChange('shippingAddress.detailAddress', e.target.value)}
                          placeholder="상세 주소를 입력해주세요"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent"
                        />
                      </div>

                      <div className="bg-[#FFF5F5] border border-[#FFE5E5] rounded-lg p-4">
                        <p className="text-sm text-gray-800">
                          💡 회원가입하시면 배송지를 저장하고 다음에도 빠르게 주문할 수 있습니다
                        </p>
                      </div>
                    </div>
                  )}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent"
                  >
                    <option value="">배송 메모를 선택해주세요</option>
                    <option value="문 앞에 놓아주세요">문 앞에 놓아주세요</option>
                    <option value="경비실에 맡겨주세요">경비실에 맡겨주세요</option>
                    <option value="배송 전 연락 부탁드립니다">배송 전 연락 부탁드립니다</option>
                    <option value="부재 시 연락 부탁드립니다">부재 시 연락 부탁드립니다</option>
                  </select>
                </div>

                {/* 결제 방식 선택 */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-gray-600" />
                    결제 방식
                  </h2>
                  <div className="space-y-3">
                    <label
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                        paymentMethod === 'TOSS'
                          ? 'border-[#FF6B6B] bg-[#FFF5F5]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="TOSS"
                        checked={paymentMethod === 'TOSS'}
                        onChange={() => setPaymentMethod('TOSS')}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3 flex-1">
                        <CreditCard className={`w-5 h-5 ${paymentMethod === 'TOSS' ? 'text-[#FF6B6B]' : 'text-gray-400'}`} />
                        <div>
                          <span className={`font-medium ${paymentMethod === 'TOSS' ? 'text-gray-900' : 'text-gray-700'}`}>
                            신용카드 / 간편결제
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">토스페이먼츠를 통한 안전한 결제</p>
                        </div>
                      </div>
                      {paymentMethod === 'TOSS' && (
                        <Check className="w-5 h-5 text-[#FF6B6B]" />
                      )}
                    </label>

                    <label
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                        paymentMethod === 'BANK_TRANSFER'
                          ? 'border-[#FF6B6B] bg-[#FFF5F5]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="BANK_TRANSFER"
                        checked={paymentMethod === 'BANK_TRANSFER'}
                        onChange={() => setPaymentMethod('BANK_TRANSFER')}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3 flex-1">
                        <Building2 className={`w-5 h-5 ${paymentMethod === 'BANK_TRANSFER' ? 'text-[#FF6B6B]' : 'text-gray-400'}`} />
                        <div>
                          <span className={`font-medium ${paymentMethod === 'BANK_TRANSFER' ? 'text-gray-900' : 'text-gray-700'}`}>
                            무통장입금
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">계좌이체로 직접 입금</p>
                        </div>
                      </div>
                      {paymentMethod === 'BANK_TRANSFER' && (
                        <Check className="w-5 h-5 text-[#FF6B6B]" />
                      )}
                    </label>
                  </div>

                  {/* 무통장입금 선택 시 상세 안내 */}
                  {paymentMethod === 'BANK_TRANSFER' && (
                    <div className="mt-4 space-y-3">
                      {/* 입금기한 안내 */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                        <p className="text-sm font-medium text-blue-800 mb-1">입금기한</p>
                        <p className="text-sm text-blue-700">
                          주문 완료일로부터 3일 이내
                        </p>
                      </div>
                      
                      {/* 주의사항 */}
                      <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                        <p className="text-sm font-medium text-amber-800 mb-2">안내사항</p>
                        <ul className="text-xs text-amber-700 space-y-1.5">
                          <li className="flex items-start gap-1.5">
                            <span className="mt-1.5 w-1 h-1 bg-amber-500 rounded-full flex-shrink-0" />
                            <span>입금완료 후 상품품절로 인해 자동취소된 상품은 환불 처리해 드립니다</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="mt-1.5 w-1 h-1 bg-amber-500 rounded-full flex-shrink-0" />
                            <span>은행 이체 수수료가 발생될 수 있습니다. 입금시 수수료를 확인해주세요.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="mt-1.5 w-1 h-1 bg-amber-500 rounded-full flex-shrink-0" />
                            <span>입금 기한 내 미입금 시 주문이 자동 취소됩니다</span>
                          </li>
                        </ul>
                      </div>

                      {/* 계좌 안내 예고 */}
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-sm text-gray-600">
                          주문 완료 후 입금 계좌 정보가 안내됩니다.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 우측: 결제 정보 (스티키) */}
              <div className="lg:w-[320px] flex-shrink-0">
                <div className="lg:sticky lg:top-[294px]">
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {/* 결제 금액 */}
                    <div className="p-5 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-gray-600" />
                        결제 금액
                      </h2>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">상품금액</span>
                          <span className="text-gray-900">{formatPrice(subtotal)}원</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">배송비</span>
                          <span className={shippingFee === 0 ? 'text-[#FF6B6B]' : 'text-gray-900'}>
                            {shippingFee > 0 ? `+${formatPrice(shippingFee)}원` : '무료'}
                          </span>
                        </div>
                        {shippingFee > 0 && subtotal < 30000 && (
                          <p className="text-xs text-[#FF6B6B]">
                            {formatPrice(30000 - subtotal)}원 추가 시 무료배송
                          </p>
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

                    {/* 결제하기 버튼 */}
                    <div className="p-5 pb-4">
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (paymentMethod === 'BANK_TRANSFER' && !channelBankInfo)}
                        className="w-full py-4 rounded-lg text-center font-semibold text-base transition-colors bg-[#FF6B6B] text-white hover:bg-[#FF5252] disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {isSubmitting
                          ? '주문 생성 중...'
                          : paymentMethod === 'BANK_TRANSFER'
                            ? `${formatPrice(totalAmount)}원 주문하기`
                            : `${formatPrice(totalAmount)}원 결제하기`
                        }
                      </button>
                    </div>

                    {/* 안내 문구 */}
                    <div className="px-5 pb-5 pt-2 border-t border-gray-100">
                      <ul className="space-y-1.5 text-[11px] text-gray-500">
                        <li className="flex items-start gap-1">
                          <span className="text-gray-400">·</span>
                          <span>주문 내용을 확인하였으며, 정보 제공 등에 동의합니다</span>
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
      </div>
    </>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-[#FF6B6B] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
