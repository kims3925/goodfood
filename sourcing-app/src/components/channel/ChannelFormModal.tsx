'use client'

import { useState, useEffect, useCallback } from 'react'
import Modal, { ModalFooter } from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

type ChannelKind = 'WHOLESALE' | 'RETAIL'
type ChannelPlatform = 'BAND' | 'NAVER_CAFE' | 'ALIEXPRESS' | 'SMARTSTORE' | 'COUPANG' | 'SHOP' | 'CUSTOM'

interface BandInfo {
  bandKey: string
  name: string
  coverUrl: string
}

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
    accountHolder: '',
    bankAccount: '',
    bankName: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 밴드 목록 관련 상태
  const [bandList, setBandList] = useState<BandInfo[]>([])
  const [isLoadingBands, setIsLoadingBands] = useState(false)
  const [bandError, setBandError] = useState<string | null>(null)
  const [bandListFetched, setBandListFetched] = useState(false)

  // 파일 업로드 관련 상태
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // 16자리 UUID 생성 함수
  const generateShortUUID = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // 밴드 목록 조회
  const fetchBandList = useCallback(async () => {
    if (bandListFetched && bandList.length > 0) return // 이미 조회했으면 스킵

    setIsLoadingBands(true)
    setBandError(null)
    try {
      const response = await fetch('/api/band/list')
      const data = await response.json()
      if (data.success) {
        setBandList(data.data)
        setBandListFetched(true)
      } else {
        setBandError(data.error || '밴드 목록을 불러오지 못했습니다.')
        setBandList([])
      }
    } catch (error) {
      console.error('밴드 목록 조회 실패:', error)
      setBandError('밴드 목록을 불러오는 중 오류가 발생했습니다.')
      setBandList([])
    } finally {
      setIsLoadingBands(false)
    }
  }, [bandListFetched, bandList.length])

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
          accountHolder: '',
          bankAccount: '',
          bankName: '',
        })
      }
      setErrors({})
      setBandList([])
      setBandError(null)
      setBandListFetched(false)
      setLogoPreview(null)

      // 등록 모드이고 초기 플랫폼이 BAND인 경우 밴드 목록 조회
      if (!channel) {
        // 약간의 딜레이 후 조회 (상태 초기화 완료 후)
        setTimeout(() => {
          fetchBandListImmediate()
        }, 0)
      }
    }
  }, [isOpen, channel])

  // 즉시 밴드 목록 조회 (초기 로드용)
  const fetchBandListImmediate = async () => {
    setIsLoadingBands(true)
    setBandError(null)
    try {
      const response = await fetch('/api/band/list')
      const data = await response.json()
      if (data.success) {
        setBandList(data.data)
        setBandListFetched(true)
      } else {
        setBandError(data.error || '밴드 목록을 불러오지 못했습니다.')
        setBandList([])
      }
    } catch (error) {
      console.error('밴드 목록 조회 실패:', error)
      setBandError('밴드 목록을 불러오는 중 오류가 발생했습니다.')
      setBandList([])
    } finally {
      setIsLoadingBands(false)
    }
  }

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

    // SHOP 플랫폼은 channelKey가 자동 생성되므로 검증 제외
    if (!formData.channelKey.trim() && formData.platform !== 'SHOP') {
      if (formData.platform === 'BAND') {
        newErrors.channelKey = '밴드를 선택해주세요.'
      } else if (formData.platform === 'NAVER_CAFE') {
        newErrors.channelKey = '네이버 카페를 선택해주세요.'
      } else if (formData.platform === 'ALIEXPRESS') {
        newErrors.channelKey = '알리익스프레스 스토어를 선택해주세요.'
      } else if (formData.platform === 'SMARTSTORE') {
        newErrors.channelKey = '스마트스토어를 선택해주세요.'
      } else if (formData.platform === 'COUPANG') {
        newErrors.channelKey = '쿠팡 스토어를 선택해주세요.'
      } else {
        newErrors.channelKey = '채널 키를 입력해주세요.'
      }
    }
    // 수정 모드 또는 쇼핑몰일 때 채널명 검사 (나머지는 자동 설정)
    if ((isEditMode || formData.platform === 'SHOP') && !formData.name.trim()) {
      newErrors.name = formData.platform === 'SHOP' ? '쇼핑몰명을 입력해주세요.' : '채널명을 입력해주세요.'
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

  // 플랫폼 선택 핸들러
  const handlePlatformSelect = (platform: ChannelPlatform) => {
    // 로고 프리뷰 초기화
    setLogoPreview(null)

    // SHOP 플랫폼인 경우 자동으로 16자리 UUID 생성
    if (platform === 'SHOP') {
      const generatedKey = generateShortUUID()
      setFormData((prev) => ({
        ...prev,
        platform,
        channelKey: generatedKey,
        name: '',
        coverUrl: '',
      }))
    } else {
      // 플랫폼 변경 시 채널 관련 필드 초기화
      setFormData((prev) => ({
        ...prev,
        platform,
        channelKey: '',
        name: '',
        coverUrl: '',
      }))
    }

    // 밴드 플랫폼 선택 시 밴드 목록 조회
    if (platform === 'BAND') {
      fetchBandList()
    }
  }

  // 로고 파일 업로드 핸들러
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp)')
      return
    }

    // 파일 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('파일 크기는 5MB 이하여야 합니다.')
      return
    }

    setIsUploadingLogo(true)
    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      })

      const data = await response.json()

      if (data.success) {
        setFormData((prev) => ({ ...prev, coverUrl: data.data.url }))
        setLogoPreview(data.data.url)
        toast.success('로고가 업로드되었습니다.')
      } else {
        toast.error(data.error || '로고 업로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('로고 업로드 실패:', error)
      toast.error('로고 업로드 중 오류가 발생했습니다.')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  // 로고 삭제 핸들러
  const handleLogoRemove = () => {
    setFormData((prev) => ({ ...prev, coverUrl: '' }))
    setLogoPreview(null)
  }

  // 밴드 선택 핸들러
  const handleBandSelect = (band: BandInfo) => {
    setFormData((prev) => ({
      ...prev,
      channelKey: band.bandKey,
      name: band.name,
      coverUrl: band.coverUrl || '',
    }))
    // 채널 키 에러 제거
    if (errors.channelKey) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors.channelKey
        return newErrors
      })
    }
    if (errors.name) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors.name
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
      size="xl"
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
                  onClick={() => handlePlatformSelect(option.value)}
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

        {/* 밴드 선택 (등록 시, 플랫폼이 BAND일 때만) */}
        {!isEditMode && formData.platform === 'BAND' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              밴드 선택 <span className="text-red-500">*</span>
            </label>
            {errors.channelKey && !formData.channelKey && (
              <p className="text-sm text-red-500 mb-2">{errors.channelKey}</p>
            )}
            {isLoadingBands ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                밴드 목록을 불러오는 중...
              </div>
            ) : bandError ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{bandError}</p>
                <button
                  type="button"
                  onClick={fetchBandList}
                  className="mt-2 text-sm text-red-700 underline hover:no-underline"
                >
                  다시 시도
                </button>
              </div>
            ) : bandList.length === 0 ? (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <p className="text-sm text-gray-500">등록된 밴드가 없습니다.</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg h-80 overflow-y-auto">
                <div className="grid grid-cols-1 gap-2 p-2">
                  {bandList.map((band) => (
                    <button
                      key={band.bandKey}
                      type="button"
                      onClick={() => handleBandSelect(band)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        formData.channelKey === band.bandKey
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {band.coverUrl ? (
                        <img
                          src={band.coverUrl}
                          alt={band.name}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{band.name}</div>
                        <div className="text-xs text-gray-500 truncate">{band.bandKey}</div>
                      </div>
                      {formData.channelKey === band.bandKey && (
                        <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 네이버 카페 선택 (등록 시, 플랫폼이 NAVER_CAFE일 때) */}
        {!isEditMode && formData.platform === 'NAVER_CAFE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              네이버 카페 선택 <span className="text-red-500">*</span>
            </label>
            {errors.channelKey && !formData.channelKey && (
              <p className="text-sm text-red-500 mb-2">{errors.channelKey}</p>
            )}
            <div className="border border-gray-200 rounded-lg h-80 overflow-y-auto">
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-sm">네이버 카페 연동 준비 중</p>
                  <p className="text-xs mt-1">API 설정 후 이용 가능합니다</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 알리익스프레스 선택 (등록 시, 플랫폼이 ALIEXPRESS일 때) */}
        {!isEditMode && formData.platform === 'ALIEXPRESS' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              알리익스프레스 스토어 선택 <span className="text-red-500">*</span>
            </label>
            {errors.channelKey && !formData.channelKey && (
              <p className="text-sm text-red-500 mb-2">{errors.channelKey}</p>
            )}
            <div className="border border-gray-200 rounded-lg h-80 overflow-y-auto">
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-sm">알리익스프레스 연동 준비 중</p>
                  <p className="text-xs mt-1">API 설정 후 이용 가능합니다</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 스마트스토어 선택 (등록 시, 플랫폼이 SMARTSTORE일 때) */}
        {!isEditMode && formData.platform === 'SMARTSTORE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              스마트스토어 선택 <span className="text-red-500">*</span>
            </label>
            {errors.channelKey && !formData.channelKey && (
              <p className="text-sm text-red-500 mb-2">{errors.channelKey}</p>
            )}
            <div className="border border-gray-200 rounded-lg h-80 overflow-y-auto">
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <p className="text-sm">스마트스토어 연동 준비 중</p>
                  <p className="text-xs mt-1">API 설정 후 이용 가능합니다</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 쿠팡 선택 (등록 시, 플랫폼이 COUPANG일 때) */}
        {!isEditMode && formData.platform === 'COUPANG' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              쿠팡 스토어 선택 <span className="text-red-500">*</span>
            </label>
            {errors.channelKey && !formData.channelKey && (
              <p className="text-sm text-red-500 mb-2">{errors.channelKey}</p>
            )}
            <div className="border border-gray-200 rounded-lg h-80 overflow-y-auto">
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-sm">쿠팡 연동 준비 중</p>
                  <p className="text-xs mt-1">API 설정 후 이용 가능합니다</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 쇼핑몰 (등록 시, 플랫폼이 SHOP일 때) - 자체 쇼핑몰 */}
        {!isEditMode && formData.platform === 'SHOP' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              자체 쇼핑몰 정보 <span className="text-red-500">*</span>
            </label>
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">자체 운영 쇼핑몰</div>
                  <div className="text-xs text-gray-500">쇼핑몰 정보를 입력해주세요</div>
                </div>
              </div>
              <div>
                <Input
                  label={
                    <>
                      쇼핑몰명 <span className="text-red-500">*</span>
                    </>
                  }
                  placeholder="쇼핑몰 이름을 입력하세요"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  error={errors.name}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">쇼핑몰 로고</label>
                {logoPreview || formData.coverUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img
                        src={logoPreview || formData.coverUrl}
                        alt="쇼핑몰 로고"
                        className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <span className="text-sm text-gray-500">로고가 업로드되었습니다.</span>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {isUploadingLogo ? (
                        <>
                          <svg className="animate-spin h-8 w-8 text-purple-500 mb-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <p className="text-sm text-gray-500">업로드 중...</p>
                        </>
                      ) : (
                        <>
                          <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm text-gray-500">
                            <span className="font-semibold text-purple-600">클릭하여 업로드</span>
                          </p>
                          <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, WEBP (최대 5MB)</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 소매 채널 전용 필드 (등록 시) */}
        {!isEditMode && isRetail && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">소매 채널 정보</h3>

            <div className="space-y-4">
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

        {/* 수정 모드 - 채널 키 표시 */}
        {isEditMode && (
          <div>
            <Input
              label="채널 키"
              value={formData.channelKey}
              disabled
              helperText="채널 키는 수정할 수 없습니다."
            />
          </div>
        )}

        {/* 수정 모드 - 채널명 */}
        {isEditMode && (
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
        )}

        {/* 수정 모드 - 커버 이미지 URL */}
        {isEditMode && (
          <div>
            <Input
              label="커버 이미지 URL"
              placeholder="https://example.com/cover.jpg"
              value={formData.coverUrl}
              onChange={(e) => handleChange('coverUrl', e.target.value)}
            />
          </div>
        )}

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

        {/* 수정 모드 - 소매 채널 전용 필드 */}
        {isEditMode && isRetail && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">소매 채널 정보</h3>

            <div className="space-y-4">
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
