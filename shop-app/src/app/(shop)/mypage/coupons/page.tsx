'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Tag, Plus } from 'lucide-react'

interface Coupon {
  id: number
  isUsed: boolean
  usedAt: string | null
  expiredAt: string
  isExpired: boolean
  coupon: {
    id: number
    code: string
    name: string
    description: string | null
    discountType: string
    discountValue: number
    minPurchaseAmount: number | null
    maxDiscountAmount: number | null
  }
}

export default function CouponsPage() {
  const { data: session } = useSession()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [couponCode, setCouponCode] = useState('')
  const [showCouponInput, setShowCouponInput] = useState(false)
  const [filter, setFilter] = useState<'all' | 'available' | 'used'>('available')

  useEffect(() => {
    if (session) {
      fetchCoupons()
    }
  }, [session])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/mypage/coupons')
      const data = await response.json()

      if (data.success) {
        setCoupons(data.coupons)
      }
    } catch (error) {
      console.error('Failed to fetch coupons:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleIssueCoupon = async () => {
    if (!couponCode.trim()) {
      return
    }

    try {
      const response = await fetch('/api/mypage/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode }),
      })

      const data = await response.json()

      if (data.success) {
        setCouponCode('')
        setShowCouponInput(false)
        fetchCoupons()
      }
    } catch (error) {
      console.error('Failed to issue coupon:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getDiscountText = (coupon: Coupon['coupon']) => {
    if (coupon.discountType === 'PERCENTAGE') {
      return `${coupon.discountValue}% 할인`
    } else {
      return `${new Intl.NumberFormat('ko-KR').format(Number(coupon.discountValue))}원 할인`
    }
  }

  const filteredCoupons = coupons.filter((coupon) => {
    if (filter === 'available') {
      return !coupon.isUsed && !coupon.isExpired
    } else if (filter === 'used') {
      return coupon.isUsed
    }
    return true
  })

  if (loading) {
    return (
      <div className="kurly-container py-12">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B] mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="kurly-container py-12">
      {/* 헤더 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">쿠폰</h1>
          <p className="text-gray-600">보유하신 쿠폰을 확인하고 사용하세요</p>
        </div>
        <button
          onClick={() => setShowCouponInput(!showCouponInput)}
          className="px-6 py-3 bg-[#FF6B6B] text-white rounded-md hover:bg-[#FF5252] flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          쿠폰 등록
        </button>
      </div>

      {/* 쿠폰 등록 */}
      {showCouponInput && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">쿠폰 코드 등록</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="쿠폰 코드를 입력하세요"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#FF6B6B]"
            />
            <button
              onClick={handleIssueCoupon}
              className="px-6 py-2 bg-[#FF6B6B] text-white rounded-md hover:bg-[#FF5252]"
            >
              등록
            </button>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('available')}
          className={`px-4 py-2 rounded-full ${
            filter === 'available'
              ? 'bg-[#FF6B6B] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          사용가능
        </button>
        <button
          onClick={() => setFilter('used')}
          className={`px-4 py-2 rounded-full ${
            filter === 'used'
              ? 'bg-[#FF6B6B] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          사용완료
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full ${
            filter === 'all'
              ? 'bg-[#FF6B6B] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체
        </button>
      </div>

      {/* 쿠폰 목록 */}
      {filteredCoupons.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg">
          <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">보유하신 쿠폰이 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCoupons.map((item) => (
            <div
              key={item.id}
              className={`bg-white border rounded-lg overflow-hidden ${
                item.isUsed || item.isExpired
                  ? 'border-gray-200 opacity-60'
                  : 'border-[#FF6B6B]'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {item.coupon.name}
                    </h3>
                    <p className="text-2xl font-bold text-[#FF6B6B]">
                      {getDiscountText(item.coupon)}
                    </p>
                  </div>
                  {item.isUsed && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                      사용완료
                    </span>
                  )}
                  {item.isExpired && !item.isUsed && (
                    <span className="px-3 py-1 bg-red-100 text-red-600 text-sm rounded-full">
                      기간만료
                    </span>
                  )}
                </div>

                {item.coupon.description && (
                  <p className="text-sm text-gray-600 mb-4">{item.coupon.description}</p>
                )}

                <div className="space-y-2 text-sm text-gray-500">
                  {item.coupon.minPurchaseAmount && (
                    <p>
                      최소 주문금액:{' '}
                      {new Intl.NumberFormat('ko-KR').format(
                        Number(item.coupon.minPurchaseAmount)
                      )}
                      원
                    </p>
                  )}
                  {item.coupon.maxDiscountAmount && (
                    <p>
                      최대 할인금액:{' '}
                      {new Intl.NumberFormat('ko-KR').format(
                        Number(item.coupon.maxDiscountAmount)
                      )}
                      원
                    </p>
                  )}
                  <p>유효기간: {formatDate(item.expiredAt)}까지</p>
                  {item.isUsed && item.usedAt && (
                    <p className="text-gray-400">사용일: {formatDate(item.usedAt)}</p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 font-mono">{item.coupon.code}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
