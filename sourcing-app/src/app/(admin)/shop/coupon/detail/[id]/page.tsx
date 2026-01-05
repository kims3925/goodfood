'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
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
  issuedCount: number
  validFrom: string
  validUntil: string
  isActive: boolean
}

export default function CouponDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [formData, setFormData] = useState<CouponFormData>({
    code: '',
    name: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 0,
    minPurchaseAmount: null,
    maxDiscountAmount: null,
    maxIssueCount: null,
    issuedCount: 0,
    validFrom: '',
    validUntil: '',
    isActive: true,
  })

  const loadCoupon = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/coupon/${id}`)
      const data = await response.json()

      if (data.success) {
        const coupon = data.data
        setFormData({
          code: coupon.code,
          name: coupon.name,
          description: coupon.description || '',
          discountType: coupon.discountType,
          discountValue: Number(coupon.discountValue),
          minPurchaseAmount: coupon.minPurchaseAmount ? Number(coupon.minPurchaseAmount) : null,
          maxDiscountAmount: coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null,
          maxIssueCount: coupon.maxIssueCount,
          issuedCount: coupon.issuedCount,
          validFrom: new Date(coupon.validFrom).toISOString().split('T')[0],
          validUntil: new Date(coupon.validUntil).toISOString().split('T')[0],
          isActive: coupon.isActive,
        })
      } else {
        toast.error('쿠폰을 불러오는데 실패했습니다.')
        router.push('/shop/coupon/list')
      }
    } catch (error) {
      console.error('쿠폰 조회 실패:', error)
      toast.error('쿠폰을 불러오는데 실패했습니다.')
      router.push('/shop/coupon/list')
    } finally {
      setIsLoading(false)
    }
  }, [id, router, toast])

  useEffect(() => {
    loadCoupon()
  }, [loadCoupon])

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
      const response = await fetch(`/api/coupon/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('쿠폰이 수정되었습니다.')
        router.push('/shop/coupon/list')
      } else {
        toast.error(data.error || '쿠폰 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('쿠폰 수정 실패:', error)
      toast.error('쿠폰 수정에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/coupon/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('쿠폰이 삭제되었습니다.')
        router.push('/shop/coupon/list')
      } else {
        toast.error(data.error || '쿠폰 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('쿠폰 삭제 실패:', error)
      toast.error('쿠폰 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">쿠폰 수정</h1>
              <p className="text-gray-600">
                쿠폰 정보를 수정합니다.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
            >
              <Trash2 size={20} />
              삭제
            </button>
          </div>
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
                <Input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="예: WELCOME2024"
                  className="font-mono"
                  maxLength={50}
                />
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
              {/* 발급 현황 */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  현재 발급 수량: <span className="font-semibold text-gray-900">{formData.issuedCount}개</span>
                  {formData.maxIssueCount && (
                    <span className="text-gray-500"> / {formData.maxIssueCount}개</span>
                  )}
                </div>
              </div>

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
                  min={formData.issuedCount || 1}
                />
                <p className="text-xs text-gray-500 mt-1">
                  발급 가능한 총 수량입니다. 비워두면 무제한. 이미 발급된 수량보다 적게 설정할 수 없습니다.
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
              {isSubmitting ? '저장 중...' : '변경사항 저장'}
            </button>
          </div>
        </form>
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="쿠폰 삭제"
        message="이 쿠폰을 삭제하시겠습니까? 이미 발급된 사용자 쿠폰도 함께 삭제됩니다."
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
