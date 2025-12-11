'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

interface CouponFormData {
  code: string
  name: string
  description: string
  discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING'
  discountValue: number
  minPurchaseAmount: number | null
  maxDiscountAmount: number | null
  maxIssueCount: number | null
  validFrom: string
  validUntil: string
  isActive: boolean
}

export default function CouponNewPage() {
  const router = useRouter()
  const toast = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState<CouponFormData>({
    code: '',
    name: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 0,
    minPurchaseAmount: null,
    maxDiscountAmount: null,
    maxIssueCount: null,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
  })

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 10; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, code }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.code.trim()) {
      toast.error('쿠폰 코드를 입력해주세요.')
      return
    }
    if (!formData.name.trim()) {
      toast.error('쿠폰명을 입력해주세요.')
      return
    }
    if (formData.discountType !== 'FREE_SHIPPING' && formData.discountValue <= 0) {
      toast.error('할인 값을 입력해주세요.')
      return
    }
    if (formData.discountType === 'PERCENTAGE' && formData.discountValue > 100) {
      toast.error('정률 할인은 100%를 초과할 수 없습니다.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('쿠폰이 생성되었습니다.')
        router.push('/shop/coupon/list')
      } else {
        toast.error(data.error || '쿠폰 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('쿠폰 생성 실패:', error)
      toast.error('쿠폰 생성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            <span>뒤로가기</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">쿠폰 생성</h1>
          <p className="text-gray-600">
            새로운 쿠폰을 생성합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 정보 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>

            <div className="space-y-4">
              {/* 쿠폰 코드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  쿠폰 코드 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="예: WELCOME2024"
                    className="flex-1 font-mono"
                    maxLength={50}
                  />
                  <button
                    type="button"
                    onClick={generateCode}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    자동생성
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  고객이 입력할 쿠폰 코드입니다. 영문과 숫자만 사용 가능합니다.
                </p>
              </div>

              {/* 쿠폰명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  쿠폰명 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 신규 가입 축하 쿠폰"
                  maxLength={200}
                />
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="쿠폰에 대한 상세 설명을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* 할인 설정 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">할인 설정</h2>

            <div className="space-y-4">
              {/* 할인 유형 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  할인 유형 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, discountType: 'PERCENTAGE' }))}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                      formData.discountType === 'PERCENTAGE'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">정률 할인</div>
                    <div className="text-sm text-gray-500">% 단위로 할인</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, discountType: 'FIXED' }))}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                      formData.discountType === 'FIXED'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">정액 할인</div>
                    <div className="text-sm text-gray-500">원 단위로 할인</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, discountType: 'FREE_SHIPPING', discountValue: 0 }))}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                      formData.discountType === 'FREE_SHIPPING'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">무료배송</div>
                    <div className="text-sm text-gray-500">배송비 무료</div>
                  </button>
                </div>
              </div>

              {/* 할인 값 */}
              {formData.discountType !== 'FREE_SHIPPING' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    할인 값 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.discountValue || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                      placeholder={formData.discountType === 'PERCENTAGE' ? '10' : '5000'}
                      min={0}
                      max={formData.discountType === 'PERCENTAGE' ? 100 : undefined}
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      {formData.discountType === 'PERCENTAGE' ? '%' : '원'}
                    </span>
                  </div>
                </div>
              )}

              {/* 최대 할인 금액 (정률인 경우만) */}
              {formData.discountType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    최대 할인 금액
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.maxDiscountAmount || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        maxDiscountAmount: e.target.value ? Number(e.target.value) : null
                      }))}
                      placeholder="10000"
                      min={0}
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">원</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    정률 할인 시 최대 할인 금액을 제한합니다. 비워두면 제한 없음.
                  </p>
                </div>
              )}

              {/* 최소 주문 금액 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  최소 주문 금액
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    value={formData.minPurchaseAmount || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      minPurchaseAmount: e.target.value ? Number(e.target.value) : null
                    }))}
                    placeholder="30000"
                    min={0}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">원</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  이 금액 이상 구매 시에만 쿠폰을 사용할 수 있습니다. 비워두면 제한 없음.
                </p>
              </div>
            </div>
          </div>

          {/* 발급 설정 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">발급 설정</h2>

            <div className="space-y-4">
              {/* 최대 발급 수량 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  최대 발급 수량
                </label>
                <Input
                  type="number"
                  value={formData.maxIssueCount || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    maxIssueCount: e.target.value ? Number(e.target.value) : null
                  }))}
                  placeholder="1000"
                  min={1}
                />
                <p className="text-xs text-gray-500 mt-1">
                  발급 가능한 총 수량입니다. 비워두면 무제한.
                </p>
              </div>

              {/* 유효기간 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시작일 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    종료일 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                  />
                </div>
              </div>

              {/* 활성 상태 */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  쿠폰 활성화
                </label>
              </div>
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={20} />
              {isSubmitting ? '저장 중...' : '쿠폰 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
