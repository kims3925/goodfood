'use client'

import { useState, useEffect } from 'react'
import Modal, { ModalFooter } from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

type ChannelKind = 'WHOLESALE' | 'RETAIL'
type ChannelPlatform = 'BAND' | 'NAVER_CAFE' | 'ALIEXPRESS' | 'SMARTSTORE' | 'COUPANG' | 'SHOP' | 'CUSTOM'

interface Channel {
  id: number
  userId: number
  apiConfigId: number | null
  kind: ChannelKind
  platform: ChannelPlatform
  channelKey: string
  name: string
  coverUrl: string | null
  isActive: boolean
  formUrl: string | null
  accountHolder: string | null
  bankAccount: string | null
  bankName: string | null
  createdAt: string
  updatedAt: string
}

interface ChannelFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  channel?: Channel | null // null이면 등록 모드, 있으면 수정 모드
}

const KIND_OPTIONS: { value: ChannelKind; label: string; description: string }[] = [
  { value: 'WHOLESALE', label: '도매(소싱) 채널', description: '상품을 수집하는 도매 채널입니다.' },
  { value: 'RETAIL', label: '소매(판매) 채널', description: '상품을 판매하는 소매 채널입니다.' },
]

const PLATFORM_OPTIONS: { value: ChannelPlatform; label: string; kinds: ChannelKind[] }[] = [
  { value: 'BAND', label: '밴드', kinds: ['WHOLESALE', 'RETAIL'] },
  { value: 'NAVER_CAFE', label: '네이버 카페', kinds: ['WHOLESALE'] },
  { value: 'ALIEXPRESS', label: '알리익스프레스', kinds: ['WHOLESALE'] },
  { value: 'SMARTSTORE', label: '스마트스토어', kinds: ['RETAIL'] },
  { value: 'COUPANG', label: '쿠팡', kinds: ['RETAIL'] },
  { value: 'SHOP', label: '쇼핑몰', kinds: ['RETAIL'] },
  { value: 'CUSTOM', label: '커스텀', kinds: ['WHOLESALE', 'RETAIL'] },
]

const BANK_OPTIONS = [
  '국민은행',
  '신한은행',
  '우리은행',
  '하나은행',
  '농협은행',
  '기업은행',
  '카카오뱅크',
  '토스뱅크',
  '케이뱅크',
  '새마을금고',
  '우체국',
  '수협은행',
  '부산은행',
  '대구은행',
  '경남은행',
  '광주은행',
  '전북은행',
  '제주은행',
  'SC제일은행',
  '씨티은행',
]

export default function ChannelFormModal({
  isOpen,
  onClose,
  onSuccess,
  channel,
}: ChannelFormModalProps) {
  const toast = useToast()
  const isEditMode = !!channel

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    kind: 'WHOLESALE' as ChannelKind,
    platform: 'BAND' as ChannelPlatform,
    channelKey: '',
    name: '',
    coverUrl: '',
    isActive: true,
    // Retail 전용 필드
    formUrl: '',
    accountHolder: '',
    bankAccount: '',
    bankName: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 모달 열릴 때 폼 초기화
  useEffect(() => {
    if (isOpen) {
      if (channel) {
        setFormData({
          kind: channel.kind,
          platform: channel.platform,
          channelKey: channel.channelKey,
          name: channel.name,
          coverUrl: channel.coverUrl || '',
          isActive: channel.isActive,
          formUrl: channel.formUrl || '',
          accountHolder: channel.accountHolder || '',
          bankAccount: channel.bankAccount || '',
          bankName: channel.bankName || '',
        })
      } else {
        setFormData({
          kind: 'WHOLESALE',
          platform: 'BAND',
          channelKey: '',
          name: '',
          coverUrl: '',
          isActive: true,
          formUrl: '',
          accountHolder: '',
          bankAccount: '',
          bankName: '',
        })
      }
      setErrors({})
    }
  }, [isOpen, channel])

  // kind 변경 시 platform 초기화
  useEffect(() => {
    const availablePlatforms = PLATFORM_OPTIONS.filter((p) => p.kinds.includes(formData.kind))
    const currentPlatformAvailable = availablePlatforms.some((p) => p.value === formData.platform)

    if (!currentPlatformAvailable && availablePlatforms.length > 0) {
      setFormData((prev) => ({ ...prev, platform: availablePlatforms[0].value }))
    }
  }, [formData.kind])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.channelKey.trim()) {
      newErrors.channelKey = '채널 키를 입력해주세요.'
    }
    if (!formData.name.trim()) {
      newErrors.name = '채널명을 입력해주세요.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      const url = '/api/channel'
      const method = isEditMode ? 'PUT' : 'POST'

      const body = isEditMode
        ? {
            id: channel!.id,
            name: formData.name,
            isActive: formData.isActive,
            coverUrl: formData.coverUrl || null,
            formUrl: formData.formUrl || null,
            accountHolder: formData.accountHolder || null,
            bankAccount: formData.bankAccount || null,
            bankName: formData.bankName || null,
          }
        : {
            kind: formData.kind,
            platform: formData.platform,
            channelKey: formData.channelKey,
            name: formData.name,
            coverUrl: formData.coverUrl || null,
            formUrl: formData.formUrl || null,
            accountHolder: formData.accountHolder || null,
            bankAccount: formData.bankAccount || null,
            bankName: formData.bankName || null,
          }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(isEditMode ? '채널이 수정되었습니다.' : '채널이 등록되었습니다.')
        onSuccess()
        onClose()
      } else {
        toast.error(data.error || '처리에 실패했습니다.')
      }
    } catch (error) {
      console.error('채널 처리 실패:', error)
      toast.error('처리 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const availablePlatforms = PLATFORM_OPTIONS.filter((p) => p.kinds.includes(formData.kind))
  const isRetail = formData.kind === 'RETAIL'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? '채널 수정' : '채널 등록'}
      size="lg"
    >
      <div className="space-y-6">
        {/* 채널 유형 선택 (등록 시에만) */}
        {!isEditMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              채널 유형 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {KIND_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange('kind', option.value)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    formData.kind === option.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{option.label}</div>
                  <div className="text-sm text-gray-500 mt-1">{option.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 플랫폼 선택 (등록 시에만) */}
        {!isEditMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              플랫폼 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {availablePlatforms.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange('platform', option.value)}
                  className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    formData.platform === option.value
                      ? 'border-purple-500 bg-purple-500 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 수정 모드일 때 유형/플랫폼 표시 */}
        {isEditMode && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">채널 유형</label>
              <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-600">
                {KIND_OPTIONS.find((k) => k.value === formData.kind)?.label}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">플랫폼</label>
              <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-600">
                {PLATFORM_OPTIONS.find((p) => p.value === formData.platform)?.label}
              </div>
            </div>
          </div>
        )}

        {/* 채널 키 (등록 시에만 수정 가능) */}
        <div>
          <Input
            label={
              <>
                채널 키 <span className="text-red-500">*</span>
              </>
            }
            placeholder="채널의 고유 식별자 (예: band_12345678)"
            value={formData.channelKey}
            onChange={(e) => handleChange('channelKey', e.target.value)}
            error={errors.channelKey}
            disabled={isEditMode}
            helperText={isEditMode ? '채널 키는 수정할 수 없습니다.' : '밴드의 경우 밴드 URL에서 확인할 수 있습니다.'}
          />
        </div>

        {/* 채널명 */}
        <div>
          <Input
            label={
              <>
                채널명 <span className="text-red-500">*</span>
              </>
            }
            placeholder="채널 이름을 입력하세요"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={errors.name}
          />
        </div>

        {/* 커버 이미지 URL */}
        <div>
          <Input
            label="커버 이미지 URL"
            placeholder="https://example.com/cover.jpg"
            value={formData.coverUrl}
            onChange={(e) => handleChange('coverUrl', e.target.value)}
          />
        </div>

        {/* 활성 상태 (수정 모드) */}
        {isEditMode && (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              채널 활성화
            </label>
          </div>
        )}

        {/* 소매 채널 전용 필드 */}
        {isRetail && (
          <>
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">소매 채널 정보</h3>

              <div className="space-y-4">
                {/* 주문폼 URL */}
                <div>
                  <Input
                    label="주문폼 URL"
                    placeholder="https://example.com/order-form"
                    value={formData.formUrl}
                    onChange={(e) => handleChange('formUrl', e.target.value)}
                    helperText="고객이 주문할 때 사용하는 주문폼 URL"
                  />
                </div>

                {/* 정산 계좌 정보 */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">은행명</label>
                    <select
                      value={formData.bankName}
                      onChange={(e) => handleChange('bankName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">선택하세요</option>
                      {BANK_OPTIONS.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Input
                      label="계좌번호"
                      placeholder="000-0000-0000"
                      value={formData.bankAccount}
                      onChange={(e) => handleChange('bankAccount', e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      label="예금주"
                      placeholder="홍길동"
                      value={formData.accountHolder}
                      onChange={(e) => handleChange('accountHolder', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          취소
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? '처리 중...' : isEditMode ? '수정' : '등록'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
