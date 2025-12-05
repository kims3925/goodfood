'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Search, Package, AlertCircle, Phone, Hash } from 'lucide-react'

export default function GuestOrderLookupPage() {
  const router = useRouter()
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const formatPhone = (value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/[^0-9]/g, '')
    // 자동 하이픈 포맷팅
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    setPhone(formatted)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!orderNumber.trim()) {
      setError('주문번호를 입력해주세요')
      return
    }

    if (!phone.trim()) {
      setError('휴대폰 번호를 입력해주세요')
      return
    }

    try {
      setIsLoading(true)

      const response = await fetch('/api/guest-orders/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          phone: phone.replace(/-/g, ''), // 하이픈 제거
        }),
      })

      const data = await response.json()

      if (data.success) {
        // 주문 상세 페이지로 이동 (토큰 포함)
        router.push(`/order/guest/${data.order.id}?token=${encodeURIComponent(data.accessToken)}`)
      } else {
        setError(data.error || '주문을 찾을 수 없습니다')
      }
    } catch (err) {
      console.error('Order lookup error:', err)
      setError('주문 조회 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          {/* 헤더 */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/main"
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">비회원 주문 조회</h1>
          </div>

          {/* 안내 문구 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-start gap-3 mb-6">
              <Package className="w-6 h-6 text-[#FF6B6B] flex-shrink-0" />
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">주문 조회</h2>
                <p className="text-sm text-gray-600">
                  주문 시 입력하신 주문번호와 휴대폰 번호로 주문 내역을 확인하실 수 있습니다.
                </p>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* 조회 폼 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Hash className="w-4 h-4 inline mr-1" />
                  주문번호
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                  placeholder="GORD-20241201-XXXXXX"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  휴대폰 번호
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="010-1234-5678"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent"
                  maxLength={13}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-[#FF6B6B] text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#FF5252] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    주문 조회하기
                  </>
                )}
              </button>
            </form>
          </div>

          {/* 도움말 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-amber-800 mb-2">주문번호를 찾을 수 없나요?</h3>
            <ul className="text-xs text-amber-700 space-y-1">
              <li className="flex items-start gap-1.5">
                <span className="mt-1.5 w-1 h-1 bg-amber-500 rounded-full flex-shrink-0" />
                <span>주문 완료 시 화면에 표시된 주문번호를 확인해주세요</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-1.5 w-1 h-1 bg-amber-500 rounded-full flex-shrink-0" />
                <span>이메일을 입력하셨다면 주문 확인 메일을 확인해주세요</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-1.5 w-1 h-1 bg-amber-500 rounded-full flex-shrink-0" />
                <span>주문번호는 &apos;GORD-&apos;로 시작합니다</span>
              </li>
            </ul>
          </div>

          {/* 회원 안내 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-2">회원이시라면?</p>
            <Link
              href="/auth/login?redirect=/mypage/orders"
              className="text-[#FF6B6B] text-sm font-medium hover:underline"
            >
              로그인하고 주문 내역 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
