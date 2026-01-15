'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Search,
  Truck,
  Loader2,
  Package,
  Banknote,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

interface ShippingAddress {
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail: string | null
  deliveryMemo: string | null
}

interface OrderItem {
  id: number
  productName: string
  optionSummary: string | null
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
}

interface ExternalOrderData {
  id: number
  orderNumber: string
  isGuestOrder: boolean
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  shopId: number
  shopName: string
  shippingAddress: ShippingAddress
  totalAmount: number
  items: OrderItem[]
  status: string
  createdAt: string
}

export default function ExternalOrderEditPage() {
  const router = useRouter()
  const params = useParams()
  const toast = useToast()
  const orderNumber = params.orderNumber as string

  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<ExternalOrderData | null>(null)
  const [error, setError] = useState('')

  // 배송 정보
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [deliveryMemo, setDeliveryMemo] = useState('')

  // 결제금액
  const [totalAmount, setTotalAmount] = useState<number>(0)

  // 제출 상태
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  // 주문 데이터 로드
  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true)
        const res = await fetch(`/api/order/external/${orderNumber}`)
        const data = await res.json()

        if (data.success) {
          setOrder(data.data)
          // 폼 초기화
          setRecipientName(data.data.shippingAddress.recipientName)
          setRecipientPhone(data.data.shippingAddress.recipientPhone)
          setPostalCode(data.data.shippingAddress.postalCode)
          setAddress(data.data.shippingAddress.address)
          setAddressDetail(data.data.shippingAddress.addressDetail || '')
          setDeliveryMemo(data.data.shippingAddress.deliveryMemo || '')
          setTotalAmount(data.data.totalAmount)
        } else {
          setError(data.error || '주문을 불러오는데 실패했습니다.')
        }
      } catch (err) {
        console.error('주문 로드 실패:', err)
        setError('주문을 불러오는데 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }

    if (orderNumber) {
      loadOrder()
    }
  }, [orderNumber])

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

  // 폼 유효성 검사
  const isFormValid = () => {
    if (!recipientName.trim()) return false
    if (!recipientPhone.trim()) return false
    if (!postalCode || !address) return false
    if (totalAmount < 0) return false
    return true
  }

  // 주문 수정
  const handleSubmit = async () => {
    if (!isFormValid()) {
      setError('필수 정보를 모두 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/order/external/${orderNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingAddress: {
            recipientName: recipientName.trim(),
            recipientPhone: recipientPhone.trim(),
            postalCode,
            address,
            addressDetail: addressDetail.trim() || null,
            deliveryMemo: deliveryMemo.trim() || null,
          },
          totalAmount,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('주문이 수정되었습니다.')
        router.push(`/shop/order/detail/${orderNumber}?source=SHOPPING_MALL`)
      } else {
        setError(data.error || '주문 수정에 실패했습니다.')
      }
    } catch (err) {
      console.error('주문 수정 실패:', err)
      setError('주문 수정 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Link href="/shop/order/list">
                <Button variant="primary">주문 목록으로 돌아가기</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8 flex items-center gap-4">
          <Link href={`/shop/order/detail/${orderNumber}?source=SHOPPING_MALL`}>
            <button className="rounded-lg p-2 hover:bg-gray-200 transition-colors">
              <ArrowLeft size={24} />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">외부 주문 수정</h1>
            <p className="text-sm text-gray-500 font-mono">
              주문번호: {order?.orderNumber}
            </p>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            {error}
          </div>
        )}

        {order && (
          <div className="space-y-6">
            {/* 주문 정보 (읽기 전용) */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Package size={20} className="text-blue-600" />
                주문 정보
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">고객명</p>
                  <p className="font-medium text-gray-900">{order.customerName}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">소매처</p>
                  <p className="font-medium text-gray-900">{order.shopName}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">주문 상품</p>
                  <p className="font-medium text-gray-900">{order.items.length}개 상품</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">주문 상태</p>
                  <p className="font-medium text-gray-900">{order.status}</p>
                </div>
              </div>

              {/* 주문 상품 목록 */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">주문 상품</p>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.productName}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center">
                          <Package size={16} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.productName}
                        </p>
                        {item.optionSummary && (
                          <p className="text-xs text-gray-500">{item.optionSummary}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {item.unitPrice.toLocaleString()}원
                        </p>
                        <p className="text-xs text-gray-500">x {item.quantity}개</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 배송 정보 */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Truck size={20} className="text-orange-600" />
                배송 정보
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="수령인 *"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="홍길동"
                  />
                  <Input
                    label="연락처 *"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="010-1234-5678"
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

            {/* 결제금액 */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Banknote size={20} className="text-green-600" />
                결제금액
              </h2>
              <Input
                label="총 결제금액 *"
                type="number"
                value={totalAmount}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10)
                  if (!isNaN(value) && value >= 0) {
                    setTotalAmount(value)
                  }
                }}
                placeholder="0"
              />
              <p className="mt-2 text-sm text-gray-500">
                현재 결제금액: <span className="font-bold text-blue-600">{totalAmount.toLocaleString()}원</span>
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <Link href={`/shop/order/detail/${orderNumber}?source=SHOPPING_MALL`} className="flex-1">
                <Button variant="secondary" fullWidth>
                  취소
                </Button>
              </Link>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!isFormValid() || isSubmitting}
                loading={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    처리 중...
                  </>
                ) : (
                  '수정 완료'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
