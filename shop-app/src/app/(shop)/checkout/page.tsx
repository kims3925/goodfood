'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Package, User, MapPin, CreditCard, Truck, Plus, Check, Building2, Wallet, AlertCircle, Ticket, X, ChevronDown } from 'lucide-react'
import TossPaymentWidget from '@/modules/payments/components/TossPaymentWidget'
import { useShop } from '@/contexts/ShopContext'
import { useShopUrl } from '@/hooks/useShopUrl'
import toast from 'react-hot-toast'

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
  originalPrice: number // 배송비 미포함 원가
  itemTotal: number // 정확한 아이템 총액
  quantity: number
  shippingFee: number | null
  bundleMaxQty: number
  bundleUnit?: number  // 옵션별 합배송 단위 수
  isBundleDiscount?: boolean  // 할인형 여부 (true: 할인 차감, false: 배송비 추가)
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

interface UserCoupon {
  id: number
  isUsed: boolean
  expiredAt: string
  isExpired: boolean
  coupon: {
    id: number
    code: string
    name: string
    description: string | null
    discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING'
    discountValue: number
    minPurchaseAmount: number | null
    maxDiscountAmount: number | null
  }
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const { shop } = useShop() // Shop 정보
  const { getPath, getApiPath } = useShopUrl()
  const fromCart = searchParams.get('fromCart') === 'true'
  const publishedProductId = searchParams.get('publishedProductId') // productId → publishedProductId로 변경
  const variantId = searchParams.get('variantId')
  const quantity = parseInt(searchParams.get('quantity') || '1')

  const [product, setProduct] = useState<any>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 결제 방식 관련
  const [paymentMethod, setPaymentMethod] = useState<'TOSS' | 'BANK_TRANSFER'>('TOSS')

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

  // 쿠폰 관련 상태
  const [availableCoupons, setAvailableCoupons] = useState<UserCoupon[]>([])
  const [selectedCoupon, setSelectedCoupon] = useState<UserCoupon | null>(null)
  const [showCouponModal, setShowCouponModal] = useState(false)

  // 에러 상태 및 섹션 ref
  const [errors, setErrors] = useState<{
    customerName?: string
    customerPhone?: string
    customerEmail?: string
    recipientName?: string
    recipientPhone?: string
    shippingAddress?: string
    detailAddress?: string
  }>({})
  const customerInfoRef = useRef<HTMLDivElement>(null)
  const shippingAddressRef = useRef<HTMLDivElement>(null)

  // 유효성 검증 함수들
  const validateName = (name: string): string | null => {
    if (!name.trim()) return '이름을 입력해주세요.'
    if (name.trim().length < 2) return '이름은 2자 이상 입력해주세요.'
    if (name.trim().length > 20) return '이름은 20자 이하로 입력해주세요.'
    return null
  }

  const validatePhone = (phone: string): string | null => {
    if (!phone.trim()) return '휴대폰 번호를 입력해주세요.'
    const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/
    if (!phoneRegex.test(phone.replace(/-/g, '').replace(/\s/g, ''))) {
      return '올바른 휴대폰 번호를 입력해주세요. (예: 010-1234-5678)'
    }
    return null
  }

  const validateEmail = (email: string): string | null => {
    if (!email.trim()) return null // 이메일은 선택사항
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return '올바른 이메일 주소를 입력해주세요.'
    }
    return null
  }

  const validateAddress = (address: string): string | null => {
    if (!address.trim()) return '주소를 입력해주세요. (주소 검색 버튼을 클릭하세요)'
    return null
  }

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

  // 페이지 로드 시 스크롤을 맨 위로 이동
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    // 세션 로딩 중에는 대기
    if (status === 'loading') return
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

      // 회원인 경우 프로필, 배송지 및 쿠폰 로드
      if (session) {
        const [profileResponse, addressResponse, couponResponse] = await Promise.all([
          fetch(getApiPath('/api/mypage/profile')),
          fetch(getApiPath('/api/mypage/addresses')),
          fetch(getApiPath('/api/mypage/coupons')),
        ])

        const profileData = await profileResponse.json()
        const addressData = await addressResponse.json()
        const couponData = await couponResponse.json()

        // 회원 프로필 정보로 주문자 및 수령인 정보 자동 세팅
        const userName = profileData.success && profileData.user ? profileData.user.name || '' : ''
        const userPhone = profileData.success && profileData.user ? profileData.user.phone || '' : ''
        const userEmail = profileData.success && profileData.user ? profileData.user.email || '' : ''

        if (addressData.success) {
          setAddresses(addressData.addresses)

          // 기본 배송지 자동 선택
          const defaultAddress = addressData.addresses.find((addr: Address) => addr.isDefault)
          if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id)
            // 배송지 주소 정보만 사용, 수령인은 항상 회원 정보 사용
            setFormData(prev => ({
              ...prev,
              customerName: userName,
              customerPhone: userPhone,
              customerEmail: userEmail,
              recipientName: userName,
              recipientPhone: userPhone,
              shippingAddress: {
                address: defaultAddress.address,
                detailAddress: defaultAddress.addressDetail || '',
                zipCode: defaultAddress.postalCode,
              }
            }))
          } else {
            // 기본 배송지가 없으면 회원 정보로 설정
            setFormData(prev => ({
              ...prev,
              customerName: userName,
              customerPhone: userPhone,
              customerEmail: userEmail,
              recipientName: userName,
              recipientPhone: userPhone,
            }))
          }
        } else {
          // 배송지 조회 실패해도 프로필 정보는 설정
          setFormData(prev => ({
            ...prev,
            customerName: userName,
            customerPhone: userPhone,
            customerEmail: userEmail,
            recipientName: userName,
            recipientPhone: userPhone,
          }))
        }

        // 사용 가능한 쿠폰만 필터링 (사용하지 않았고, 만료되지 않은)
        if (couponData.success && couponData.coupons) {
          const validCoupons = (couponData.coupons || []).filter(
            (c: UserCoupon) => !c.isUsed && !c.isExpired
          )
          setAvailableCoupons(validCoupons)
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

  // 비회원도 토스결제 가능하도록 기본값 유지 (TOSS)

  // 배송지 선택 시 formData 업데이트 (주소만, 수령인은 회원 정보 유지)
  const handleAddressSelect = (addressId: number) => {
    setSelectedAddressId(addressId)
    const selected = addresses.find(addr => addr.id === addressId)
    if (selected) {
      setFormData(prev => ({
        ...prev,
        // 수령인 정보는 회원 정보 유지
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
      const response = await fetch(getApiPath('/api/cart'))
      const data = await response.json()

      if (data.success && data.cart?.items?.length > 0) {
        setCartItems(data.cart.items)
      } else {
        // 장바구니가 비어있으면 장바구니 페이지로 이동
        router.push(getPath('/cart'))
      }
    } catch (error) {
      console.error('장바구니 로딩 실패:', error)
      router.push(getPath('/cart'))
    }
  }

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      // publishedProductId를 통해 상품 조회
      const response = await fetch(getApiPath(`/api/shop/product-publish/${publishedProductId}`))
      const data = await response.json()

      if (data.success && data.publishedProduct) {
        const pp = data.publishedProduct
        const product = pp.product
        const images = product.post?.images?.map((img: any) => img.url) || []

        // URL의 variantId로 해당 variant 찾기 (없으면 첫 번째)
        const selectedVariant = variantId
          ? product.variants?.find((v: any) => v.id === parseInt(variantId))
          : product.variants?.[0]

        // 합배송 옵션 계산 (상품 상세 페이지와 동일한 로직)
        const shippingFee = product.shippingFee ?? 0
        const bundleMaxQty = product.bundleMaxQty ?? 1
        const variantPrice = selectedVariant?.price || 0
        const bundleUnit = selectedVariant?.bundleUnit || 1

        // bundleShippingType에 따른 가격 계산
        // INCLUDED: 할인형 - 가격에 배송비 포함, 합배송 시 할인
        // SEPARATE: 배송비형 - 가격 + 배송비, 합배송 시 배송비 절약
        const isBundleDiscount = product.bundleShippingType === 'INCLUDED'

        let bundleOptions: any[] = []
        if (bundleMaxQty > 1 && shippingFee > 0) {
          // 합배송 표시용 최대 수량 (1묶음 완성까지)
          const maxDisplayQty = Math.floor(bundleMaxQty / bundleUnit) || 1

          for (let qty = 1; qty <= maxDisplayQty; qty++) {
            const totalBundleUnits = qty * bundleUnit
            const shippingCount = Math.ceil(totalBundleUnits / bundleMaxQty)

            let totalPrice: number
            let discount: number

            if (isBundleDiscount) {
              // 할인형: 첫 번째 수량은 배송비 포함, 2번째부터 할인
              const discountCount = Math.max(0, qty - shippingCount)
              totalPrice = (variantPrice * qty) - (shippingFee * discountCount)
              discount = shippingFee * discountCount
            } else {
              // 배송비형: 원가 + (배송비 × 횟수)
              const originalPrice = variantPrice - shippingFee
              totalPrice = (originalPrice * qty) + (shippingFee * shippingCount)
              const fullPrice = variantPrice * qty
              discount = fullPrice - totalPrice
            }

            bundleOptions.push({
              qty,
              totalPrice,
              discount,
              unitPrice: Math.round(totalPrice / qty),
              isBundleDiscount,
              bundleUnit,
            })
          }
        }

        setProduct({
          id: product.id,
          publishedProductId: pp.id,
          title: product.name,
          description: product.description || '',
          images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
          originalPrice: variantPrice,
          salePrice: variantPrice,
          category: product.categoryId || '',
          stock: selectedVariant?.stock || 100,
          bundleOptions,
          bundleMaxQty: bundleMaxQty > 1 ? bundleMaxQty : undefined,
          shippingFee,
          isBundleDiscount,
          bundleUnit,
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

  // 쿠폰 할인 금액 계산
  const calculateCouponDiscount = (subtotal: number, coupon: UserCoupon | null): number => {
    if (!coupon) return 0

    const { discountType, discountValue, minPurchaseAmount, maxDiscountAmount } = coupon.coupon

    // 최소 주문 금액 체크
    if (minPurchaseAmount && subtotal < minPurchaseAmount) {
      return 0
    }

    // 무료배송 쿠폰은 할인 금액 0 (배송비에서 처리)
    if (discountType === 'FREE_SHIPPING') {
      return 0
    }

    let discount = 0

    if (discountType === 'PERCENTAGE') {
      discount = Math.floor(subtotal * (discountValue / 100))
      // 최대 할인 금액 제한
      if (maxDiscountAmount && discount > maxDiscountAmount) {
        discount = maxDiscountAmount
      }
    } else if (discountType === 'FIXED') {
      discount = discountValue
    }

    // 할인이 상품 금액을 초과하지 않도록
    return Math.min(discount, subtotal)
  }

  // 쿠폰 사용 가능 여부 체크
  const isCouponApplicable = (coupon: UserCoupon, subtotal: number): boolean => {
    const { minPurchaseAmount } = coupon.coupon
    if (minPurchaseAmount && subtotal < minPurchaseAmount) {
      return false
    }
    return true
  }

  // 쿠폰 할인 텍스트
  const getCouponDiscountText = (coupon: UserCoupon): string => {
    const { discountType, discountValue, maxDiscountAmount } = coupon.coupon

    if (discountType === 'FREE_SHIPPING') {
      return '무료배송'
    } else if (discountType === 'PERCENTAGE') {
      let text = `${discountValue}% 할인`
      if (maxDiscountAmount) {
        text += ` (최대 ${formatPrice(maxDiscountAmount)}원)`
      }
      return text
    } else {
      return `${formatPrice(discountValue)}원 할인`
    }
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
    // 비회원 주문 지원: 로그인 체크 제거
    const isGuest = !session?.user?.id

    // 에러 초기화
    const newErrors: {
      customerName?: string
      customerPhone?: string
      customerEmail?: string
      recipientName?: string
      recipientPhone?: string
      shippingAddress?: string
      detailAddress?: string
    } = {}

    // 비회원일 때 주문자 정보 검증
    if (isGuest) {
      const customerNameError = validateName(formData.customerName)
      if (customerNameError) newErrors.customerName = customerNameError

      const customerPhoneError = validatePhone(formData.customerPhone)
      if (customerPhoneError) newErrors.customerPhone = customerPhoneError

      const customerEmailError = validateEmail(formData.customerEmail)
      if (customerEmailError) newErrors.customerEmail = customerEmailError
    }

    // 배송지 주소 검증
    const addressError = validateAddress(formData.shippingAddress.address)
    if (addressError) newErrors.shippingAddress = addressError

    // 수령인 정보 결정 및 검증
    let recipientName: string
    let recipientPhone: string

    if (!isGuest && session?.user) {
      // 회원인 경우 formData에서 가져옴 (loadCheckoutData에서 회원 정보로 자동 세팅됨)
      recipientName = formData.customerName
      recipientPhone = formData.customerPhone

      // 회원도 수령인 정보 검증 (프로필에 정보가 없을 수 있음)
      const memberNameError = validateName(recipientName)
      if (memberNameError) {
        newErrors.recipientName = '회원 정보에 이름이 없습니다. 마이페이지에서 정보를 업데이트해주세요.'
      }

      const memberPhoneError = validatePhone(recipientPhone)
      if (memberPhoneError) {
        newErrors.recipientPhone = '회원 정보에 전화번호가 없습니다. 마이페이지에서 정보를 업데이트해주세요.'
      }
    } else {
      // 비회원인 경우 입력된 수령인 정보 사용
      recipientName = formData.recipientName
      recipientPhone = formData.recipientPhone

      // 비회원 수령인 정보 검증
      const recipientNameError = validateName(recipientName)
      if (recipientNameError) newErrors.recipientName = recipientNameError

      const recipientPhoneError = validatePhone(recipientPhone)
      if (recipientPhoneError) newErrors.recipientPhone = recipientPhoneError
    }

    // 에러가 있으면 상태 업데이트 후 첫 번째 에러 섹션으로 스크롤
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)

      // 첫 번째 에러 섹션으로 스크롤
      if ((newErrors.customerName || newErrors.customerPhone || newErrors.customerEmail) && customerInfoRef.current) {
        customerInfoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if ((newErrors.recipientName || newErrors.recipientPhone || newErrors.shippingAddress || newErrors.detailAddress) && shippingAddressRef.current) {
        shippingAddressRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    // 에러가 없으면 에러 상태 초기화
    setErrors({})

    try {
      setIsSubmitting(true)

      // 주문 요청 데이터 준비
      const orderRequestData: any = {
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
        },
        // 쿠폰 정보
        coupon: selectedCoupon ? {
          userCouponId: selectedCoupon.id,
          discountAmount: couponDiscount,
          isFreeShipping: selectedCoupon.coupon.discountType === 'FREE_SHIPPING'
        } : undefined
      }

      // 회원인 경우 userId 추가
      if (!isGuest) {
        orderRequestData.userId = parseInt(session.user.id as string)
      }

      if (fromCart) {
        orderRequestData.fromCart = true
      } else {
        orderRequestData.fromCart = false
        orderRequestData.items = [{
          publishedProductId: parseInt(publishedProductId!),
          variantId: variantId ? parseInt(variantId) : undefined,
          quantity
        }]
      }

      // 무통장입금 분기
      if (paymentMethod === 'BANK_TRANSFER') {
        // 비회원/회원 구분하여 API 호출
        const apiUrl = getApiPath(isGuest ? '/api/guest-orders/bank-transfer' : '/api/orders/bank-transfer')

        const response = await fetch(apiUrl, {
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

          // 비회원인 경우 accessToken과 orderId도 전달
          if (isGuest && data.accessToken) {
            params.append('isGuest', 'true')
            params.append('accessToken', data.accessToken)
            params.append('orderId', data.order.id.toString())
          }

          router.push(getPath(`/order/bank-transfer/complete?${params.toString()}`))
        } else {
          toast.error(data.error || '주문 생성에 실패했습니다.')
        }
      } else {
        // 토스 결제 플로우 (회원/비회원 모두 지원)
        const apiUrl = getApiPath(isGuest ? '/api/guest-orders/prepare' : '/api/orders/prepare')

        const response = await fetch(apiUrl, {
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
          // 페이지 맨 위로 스크롤
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        } else {
          toast.error(data.error || '주문 준비에 실패했습니다.')
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
  let bundleDiscount = 0 // 합배송 할인액

  if (fromCart && cartItems.length > 0) {
    subtotal = cartItems.reduce((sum, item) => sum + item.itemTotal, 0)
    orderItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
    orderName = cartItems.length > 1
      ? `${cartItems[0].name} 외 ${cartItems.length - 1}건`
      : cartItems[0].name

    // 합배송 할인액 계산 (bundleUnit 고려)
    // - 배송비형: 합배송으로 절약되는 배송비
    // - 할인형: 첫 번째 제외, 2번째부터 할인
    bundleDiscount = cartItems.reduce((sum, item) => {
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
  } else if (product) {
    // 합배송 옵션이 있으면 bundleUnit 고려하여 가격 계산
    if (product.bundleOptions && product.bundleOptions.length > 0) {
      const bundleMaxQty = product.bundleMaxQty || 1
      const bundleUnit = product.bundleUnit || 1
      const isBundleDiscount = product.isBundleDiscount || false
      const shippingFee = product.shippingFee || 0
      const basePrice = product.salePrice || 0

      // bundleUnit을 고려한 총 합배송 단위 계산
      const totalBundleUnits = quantity * bundleUnit
      const shippingCount = Math.floor(totalBundleUnits / bundleMaxQty) +
        (totalBundleUnits % bundleMaxQty > 0 ? 1 : 0)

      if (isBundleDiscount) {
        // 할인형: 첫 번째 수량은 배송비 포함, 2번째부터 할인
        const discountCount = Math.max(0, quantity - shippingCount)
        subtotal = (basePrice * quantity) - (shippingFee * discountCount)
        bundleDiscount = shippingFee * discountCount
      } else {
        // 배송비형: (원가 × 수량) + (배송비 × 횟수)
        const originalPrice = basePrice - shippingFee
        subtotal = (originalPrice * quantity) + (shippingFee * shippingCount)
        // 절약액 = (매번 배송비 낼 경우) - (실제 배송비)
        bundleDiscount = (shippingFee * quantity) - (shippingFee * shippingCount)
      }
    } else {
      subtotal = product.salePrice * quantity
    }
    orderItemCount = quantity
    orderName = product.title
  }

  const couponDiscount = calculateCouponDiscount(subtotal, selectedCoupon)
  const totalAmount = subtotal - couponDiscount // 배송비는 상품 가격에 포함

  // 배송비 무료 여부 확인
  const isFreeShipping = (() => {
    if (fromCart && cartItems.length > 0) {
      // 장바구니: 모든 상품의 배송비가 0이거나 null이면 무료배송
      return cartItems.every(item => !item.shippingFee || item.shippingFee === 0)
    } else if (product) {
      // 바로구매: bundleOptions가 없고 배송비가 없으면 무료배송
      // bundleOptions가 있으면 배송비가 포함된 것
      return !product.bundleOptions || product.bundleOptions.length === 0
        ? product.salePrice === product.originalPrice
        : false
    }
    return false
  })()

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
          <Link href={getPath('/main')} className="text-blue-600 hover:underline">쇼핑몰 홈으로 돌아가기</Link>
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
                href={getPath(fromCart ? '/cart' : `/product/${product?.id || publishedProductId}`)}
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
                          <div className="relative w-16 h-16 flex-shrink-0">
                            <Image
                              src={item.image || '/placeholder.jpg'}
                              alt={item.name}
                              fill
                              sizes="64px"
                              className="object-cover rounded-lg"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{item.name}</h3>
                            {item.optionSummary && (
                              <p className="text-xs text-gray-500 mt-0.5">{item.optionSummary}</p>
                            )}
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-xs text-gray-500">수량: {item.quantity}개</span>
                              <span className="font-semibold text-[#FF6B6B] text-sm">
                                {formatPrice(item.itemTotal)}원
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : product && (
                    <div className="flex gap-4">
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <Image
                          src={product.images?.[0] || '/placeholder.jpg'}
                          alt={product.title}
                          fill
                          sizes="80px"
                          className="object-cover rounded-lg"
                        />
                      </div>
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

                {/* 주문자 정보 - 비회원일 때만 표시 */}
                {!session && (
                  <div ref={customerInfoRef} className="bg-white rounded-lg shadow-sm p-6 mb-6">
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
                          onChange={(e) => {
                            handleFormChange('customerName', e.target.value)
                            if (errors.customerName) setErrors(prev => ({ ...prev, customerName: undefined }))
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent ${
                            errors.customerName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="홍길동"
                        />
                        {errors.customerName && (
                          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.customerName}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          휴대폰 번호 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={formData.customerPhone}
                          onChange={(e) => {
                            handleFormChange('customerPhone', e.target.value)
                            if (errors.customerPhone) setErrors(prev => ({ ...prev, customerPhone: undefined }))
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent ${
                            errors.customerPhone ? 'border-red-500 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="010-1234-5678"
                        />
                        {errors.customerPhone && (
                          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.customerPhone}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          이메일
                        </label>
                        <input
                          type="email"
                          value={formData.customerEmail}
                          onChange={(e) => {
                            handleFormChange('customerEmail', e.target.value)
                            if (errors.customerEmail) setErrors(prev => ({ ...prev, customerEmail: undefined }))
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent ${
                            errors.customerEmail ? 'border-red-500 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="example@email.com"
                        />
                        {errors.customerEmail && (
                          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.customerEmail}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 배송지 정보 */}
                <div ref={shippingAddressRef} className="bg-white rounded-lg shadow-sm p-6 mb-6">
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
                              <p className="text-sm font-medium text-gray-900 mb-1">
                                {formData.customerName} · {formData.customerPhone}
                              </p>
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
                        onClick={() => router.push(getPath('/mypage/addresses'))}
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
                      {errors.shippingAddress && (
                        <p className="mb-3 text-sm text-red-500 flex items-center justify-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {errors.shippingAddress}
                        </p>
                      )}
                      <p className="text-gray-600 mb-4">등록된 배송지가 없습니다</p>
                      <button
                        onClick={() => router.push(getPath('/mypage/addresses'))}
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
                            onChange={(e) => {
                              handleFormChange('recipientName', e.target.value)
                              if (errors.recipientName) setErrors(prev => ({ ...prev, recipientName: undefined }))
                            }}
                            placeholder="이름"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent ${
                              errors.recipientName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}
                            required
                          />
                          {errors.recipientName && (
                            <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {errors.recipientName}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            연락처 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={formData.recipientPhone}
                            onChange={(e) => {
                              handleFormChange('recipientPhone', e.target.value)
                              if (errors.recipientPhone) setErrors(prev => ({ ...prev, recipientPhone: undefined }))
                            }}
                            placeholder="01012345678"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent ${
                              errors.recipientPhone ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}
                            required
                          />
                          {errors.recipientPhone && (
                            <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {errors.recipientPhone}
                            </p>
                          )}
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
                            className={`w-32 px-3 py-2 border rounded-lg bg-gray-50 ${
                              errors.shippingAddress ? 'border-red-500' : 'border-gray-300'
                            }`}
                            readOnly
                            required
                          />
                          <button
                            type="button"
                            onClick={() => {
                              openAddressSearch()
                              if (errors.shippingAddress) setErrors(prev => ({ ...prev, shippingAddress: undefined }))
                            }}
                            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                          >
                            주소 검색
                          </button>
                        </div>
                        <input
                          type="text"
                          value={formData.shippingAddress.address}
                          placeholder="기본 주소"
                          className={`w-full px-3 py-2 border rounded-lg bg-gray-50 mb-2 ${
                            errors.shippingAddress ? 'border-red-500' : 'border-gray-300'
                          }`}
                          readOnly
                          required
                        />
                        {errors.shippingAddress && (
                          <p className="mb-2 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.shippingAddress}
                          </p>
                        )}
                        <input
                          type="text"
                          value={formData.shippingAddress.detailAddress}
                          onChange={(e) => {
                            handleFormChange('shippingAddress.detailAddress', e.target.value)
                            if (errors.detailAddress) setErrors(prev => ({ ...prev, detailAddress: undefined }))
                          }}
                          placeholder="상세 주소를 입력해주세요"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent ${
                            errors.detailAddress ? 'border-red-500 bg-red-50' : 'border-gray-300'
                          }`}
                        />
                        {errors.detailAddress && (
                          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.detailAddress}
                          </p>
                        )}
                      </div>

                      <div className="bg-[#FFF5F5] border border-[#FFE5E5] rounded-lg p-4">
                        <p className="text-sm text-gray-800">
                          회원가입하시면 배송지를 저장하고 다음에도 빠르게 주문할 수 있습니다
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
                    {/* 토스 결제 - 회원/비회원 모두 */}
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
                          <p className="text-xs text-gray-500 mt-0.5">
                            토스페이먼츠를 통한 안전한 결제
                          </p>
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
                      
                      {/* 입금 계좌 정보 */}
                      {shop?.bankInfo ? (
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-sm font-medium text-gray-800 mb-3">입금 계좌 안내</p>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">은행</span>
                              <span className="font-medium text-gray-900">{shop.bankInfo.bankName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">계좌번호</span>
                              <span className="font-mono font-medium text-gray-900">{shop.bankInfo.bankAccount}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">예금주</span>
                              <span className="font-medium text-gray-900">{shop.bankInfo.accountHolder}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                          <p className="text-sm text-red-600">
                            쇼핑몰에 계좌정보가 등록되어 있지 않습니다. 관리자에게 문의해주세요.
                          </p>
                        </div>
                      )}

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
                    </div>
                  )}
                </div>
              </div>

              {/* 우측: 결제 정보 (스티키) */}
              <div className="lg:w-[320px] flex-shrink-0 lg:self-start lg:sticky lg:top-6">
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {/* 쿠폰 적용 (회원 전용) */}
                    {session && (
                      <div className="p-5 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-gray-600" />
                          쿠폰
                        </h2>

                        {selectedCoupon ? (
                          <div className="flex items-center justify-between p-3 bg-[#FFF5F5] border border-[#FFE5E5] rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {selectedCoupon.coupon.name}
                              </p>
                              <p className="text-xs text-[#FF6B6B]">
                                {getCouponDiscountText(selectedCoupon)}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedCoupon(null)}
                              className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowCouponModal(true)}
                            disabled={availableCoupons.length === 0}
                            className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-[#FF6B6B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="text-sm text-gray-600">
                              {availableCoupons.length > 0
                                ? `사용 가능한 쿠폰 ${availableCoupons.length}장`
                                : '사용 가능한 쿠폰이 없습니다'
                              }
                            </span>
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                      </div>
                    )}

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
                          <span className={isFreeShipping ? "text-[#22C55E] font-medium" : "text-[#FF6B6B]"}>
                            {isFreeShipping ? "무료" : "포함"}
                          </span>
                        </div>
                        {couponDiscount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">쿠폰 할인</span>
                            <span className="text-[#FF6B6B]">-{formatPrice(couponDiscount)}원</span>
                          </div>
                        )}
                        {selectedCoupon?.coupon.discountType === 'FREE_SHIPPING' && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">무료배송 쿠폰</span>
                            <span className="text-[#FF6B6B]">적용됨</span>
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
                      {(bundleDiscount > 0 || couponDiscount > 0) && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          {bundleDiscount > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-[#FF6B6B]">합배송 할인</span>
                              <span className="text-[#FF6B6B] font-medium">-{formatPrice(bundleDiscount)}원</span>
                            </div>
                          )}
                          {couponDiscount > 0 && (
                            <div className="flex justify-between items-center text-sm mt-1">
                              <span className="text-[#FF6B6B]">쿠폰 할인</span>
                              <span className="text-[#FF6B6B] font-medium">-{formatPrice(couponDiscount)}원</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 결제하기 버튼 */}
                    <div className="p-5 pb-4">
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (paymentMethod === 'BANK_TRANSFER' && !shop?.bankInfo)}
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

      {/* 쿠폰 선택 모달 */}
      {showCouponModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCouponModal(false)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">쿠폰 선택</h3>
              <button
                onClick={() => setShowCouponModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[60vh] p-4">
              {availableCoupons.length === 0 ? (
                <div className="text-center py-8">
                  <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">사용 가능한 쿠폰이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableCoupons.map((coupon) => {
                    const isApplicable = isCouponApplicable(coupon, subtotal)
                    return (
                      <button
                        key={coupon.id}
                        onClick={() => {
                          if (isApplicable) {
                            setSelectedCoupon(coupon)
                            setShowCouponModal(false)
                          }
                        }}
                        disabled={!isApplicable}
                        className={`w-full text-left p-4 border rounded-lg transition-all ${
                          isApplicable
                            ? 'border-gray-200 hover:border-[#FF6B6B] hover:bg-[#FFF5F5]'
                            : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {coupon.coupon.name}
                            </p>
                            <p className="text-lg font-bold text-[#FF6B6B] mt-1">
                              {getCouponDiscountText(coupon)}
                            </p>
                            {coupon.coupon.minPurchaseAmount && (
                              <p className="text-xs text-gray-500 mt-1">
                                {formatPrice(coupon.coupon.minPurchaseAmount)}원 이상 구매 시
                                {!isApplicable && (
                                  <span className="text-red-500 ml-1">
                                    (미충족)
                                  </span>
                                )}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(coupon.expiredAt).toLocaleDateString('ko-KR')}까지
                            </p>
                          </div>
                          {isApplicable && (
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex items-center justify-center">
                              {selectedCoupon?.id === coupon.id && (
                                <div className="w-3 h-3 bg-[#FF6B6B] rounded-full" />
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowCouponModal(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
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
