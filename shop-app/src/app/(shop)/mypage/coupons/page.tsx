'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Tag, Plus } from 'lucide-react'
import { useShopUrl } from '@/hooks/useShopUrl'
import { useShop } from '@/contexts/ShopContext'

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
  const { getApiPath } = useShopUrl()
  const { shop } = useShop()
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [couponCode, setCouponCode] = useState('')
  const [showCouponInput, setShowCouponInput] = useState(false)
  const [filter, setFilter] = useState<'all' | 'available' | 'used'>('available')

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(getApiPath('/api/mypage/coupons'))
      const data = await response.json()

      if (data.success) {
        setCoupons(data.coupons || [])
      } else {
        setCoupons([])
      }
    } catch (error) {
      console.error('Failed to fetch coupons:', error)
      setCoupons([])
    } finally {
      setLoading(false)
    }
  }, [getApiPath])

  useEffect(() => {
    if (session) {
      fetchCoupons()
    }
  }, [session, fetchCoupons])

  const handleIssueCoupon = async () => {
    if (!couponCode.trim()) {
      return
    }

    try {
      const response = await fetch(getApiPath('/api/mypage/coupons'), {
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
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: primaryColor }}></div>
      </div>
    )
  }

  return (
    <>
      {/* 헤더 */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">쿠폰</h1>
          <p className="text-gray-600">보유하신 쿠폰을 확인하고 사용하세요</p>
        </div>
        <button
          onClick={() => setShowCouponInput(!showCouponInput)}
          className="px-6 py-3 text-white rounded-md hover:opacity-90 flex items-center justify-center gap-2 w-full sm:w-auto"
          style={{ backgroundColor: primaryColor }}
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1"
              style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
            />
            <button
              onClick={handleIssueCoupon}
              className="px-6 py-2 text-white rounded-md hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
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
              ? 'text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={filter === 'available' ? { backgroundColor: primaryColor } : {}}
        >
          사용가능
        </button>
        <button
          onClick={() => setFilter('used')}
          className={`px-4 py-2 rounded-full ${
            filter === 'used'
              ? 'text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={filter === 'used' ? { backgroundColor: primaryColor } : {}}
        >
          사용완료
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full ${
            filter === 'all'
              ? 'text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={filter === 'all' ? { backgroundColor: primaryColor } : {}}
        >
          전체
        </button>
      </div>

      {/* 쿠폰 목록 */}
      {filteredCoupons.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg w-full">
          <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">
            {filter === 'available' ? '사용 가능한 쿠폰이 없습니다' :
             filter === 'used' ? '사용한 쿠폰이 없습니다' : '보유하신 쿠폰이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCoupons.map((item) => (
            <div
              key={item.id}
              className={`bg-white border rounded-lg overflow-hidden ${
                item.isUsed || item.isExpired
                  ? 'border-gray-200 opacity-60'
                  : ''
              }`}
              style={!item.isUsed && !item.isExpired ? { borderColor: primaryColor } : {}}
            >
              <div className="p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">
                        {item.coupon.name}
                      </h3>
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
                    <p className="text-2xl font-bold mb-3" style={{ color: primaryColor }}>
                      {getDiscountText(item.coupon)}
                    </p>
                    {item.coupon.description && (
                      <p className="text-sm text-gray-600 mb-3">{item.coupon.description}</p>
                    )}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
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
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 font-mono">{item.coupon.code}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
