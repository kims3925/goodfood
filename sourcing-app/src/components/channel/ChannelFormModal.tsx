'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Modal, { ModalFooter } from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

type ChannelKind = 'WHOLESALE' | 'RETAIL'
type ChannelPlatform = 'BAND' | 'NAVER_CAFE' | 'ALIEXPRESS' | 'SMARTSTORE' | 'COUPANG' | 'CUSTOM'

interface BandInfo {
  bandKey: string
  name: string
  coverUrl: string
}

interface Channel {
  id: number
  userId: number
  kind: ChannelKind
  platform: ChannelPlatform
  channelKey: string
  name: string
  coverUrl: string | null
  isActive: boolean
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
]

export default function ChannelFormModal({
  isOpen,
  onClose,
  onSuccess,
  channel,
}: ChannelFormModalProps) {
  const toast = useToast()
  const router = useRouter()
  const isEditMode = !!channel

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    kind: 'WHOLESALE' as ChannelKind,
    platform: 'BAND' as ChannelPlatform,
    channelKey: '',
    name: '',
    coverUrl: '',
    isActive: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 밴드 목록 관련 상태
  const [bandList, setBandList] = useState<BandInfo[]>([])
  const [isLoadingBands, setIsLoadingBands] = useState(false)
  const [bandError, setBandError] = useState<string | null>(null)
  const [bandListFetched, setBandListFetched] = useState(false)

  // 다중 선택 관련 상태
  const [selectedBands, setSelectedBands] = useState<BandInfo[]>([])

  // 설정된 API 플랫폼 상태
  const [configuredPlatforms, setConfiguredPlatforms] = useState<string[]>([])
  const [isLoadingApiSettings, setIsLoadingApiSettings] = useState(false)


  // 기존 채널 키 목록 (DB에서 조회, 도매/소매 분리)
  const [existingChannelKeys, setExistingChannelKeys] = useState<{
    wholesale: string[]
    retail: string[]
  }>({ wholesale: [], retail: [] })

  // 설정된 API 플랫폼 조회
  const fetchConfiguredPlatforms = useCallback(async () => {
    setIsLoadingApiSettings(true)
    try {
      const response = await fetch('/api/settings/api')
      const data = await response.json()
      if (data.success && data.settings) {
        const platforms: string[] = []
        // Band API 설정 확인
        if (data.settings.band?.accessToken) {
          platforms.push('BAND')
        }
        // Aliexpress API 설정 확인
        if (data.settings.aliexpress?.apiKey || data.settings.aliexpress?.accessToken) {
          platforms.push('ALIEXPRESS')
        }
        setConfiguredPlatforms(platforms)
      }
    } catch (error) {
      console.error('API 설정 조회 실패:', error)
      setConfiguredPlatforms([])
    } finally {
      setIsLoadingApiSettings(false)
    }
  }, [])

  // 기존 채널 키 조회 (DB에서, 도매/소매 분리)
  const fetchExistingChannelKeys = useCallback(async () => {
    try {
      const response = await fetch('/api/channel/keys')
      const data = await response.json()
      if (data.success) {
        setExistingChannelKeys({
          wholesale: data.data.wholesale || [],
          retail: data.data.retail || [],
        })
      }
    } catch (error) {
      console.error('기존 채널 키 조회 실패:', error)
    }
  }, [])

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
        })
      } else {
        // 등록 모드: 초기 플랫폼은 API 설정 조회 후 설정
        setFormData({
          kind: 'WHOLESALE',
          platform: '' as ChannelPlatform, // 초기값 비움
          channelKey: '',
          name: '',
          coverUrl: '',
          isActive: true,
        })
        // API 설정 조회
        fetchConfiguredPlatforms()
        // 기존 채널 키 조회
        fetchExistingChannelKeys()
      }
      setErrors({})
      setBandList([])
      setBandError(null)
      setBandListFetched(false)
      setSelectedBands([])
    }
  }, [isOpen, channel, fetchConfiguredPlatforms, fetchExistingChannelKeys])

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

  // API 설정된 플랫폼 로드 후 첫 번째 플랫폼 선택 및 BAND 목록 조회
  useEffect(() => {
    if (!isEditMode && configuredPlatforms.length > 0 && !formData.platform) {
      // 현재 kind에서 사용 가능한 설정된 플랫폼 찾기
      const availableConfigured = PLATFORM_OPTIONS.filter(
        (p) => p.kinds.includes(formData.kind) && configuredPlatforms.includes(p.value)
      )
      if (availableConfigured.length > 0) {
        const firstPlatform = availableConfigured[0].value
        setFormData((prev) => ({ ...prev, platform: firstPlatform }))
        // BAND인 경우 밴드 목록 조회
        if (firstPlatform === 'BAND') {
          fetchBandListImmediate()
        }
      }
    }
  }, [configuredPlatforms, formData.kind, formData.platform, isEditMode])

  // kind 변경 시 platform 초기화
  useEffect(() => {
    if (isEditMode) return // 수정 모드에서는 변경하지 않음

    const availableConfigured = PLATFORM_OPTIONS.filter(
      (p) => p.kinds.includes(formData.kind) && configuredPlatforms.includes(p.value)
    )
    const currentPlatformAvailable = availableConfigured.some((p) => p.value === formData.platform)

    if (!currentPlatformAvailable && availableConfigured.length > 0) {
      const newPlatform = availableConfigured[0].value
      setFormData((prev) => ({
        ...prev,
        platform: newPlatform,
        channelKey: '',
        name: '',
        coverUrl: ''
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.kind, configuredPlatforms, isEditMode])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // BAND 플랫폼 검증: 도매/소매 모두 다중 선택
    if (formData.platform === 'BAND' && !isEditMode) {
      if (selectedBands.length === 0) {
        newErrors.channelKey = '밴드를 선택해주세요.'
      }
    }
    // 기타 플랫폼 channelKey 검증
    if (!formData.channelKey.trim() && formData.platform !== 'BAND') {
      if (formData.platform === 'NAVER_CAFE') {
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

    // 채널명 검사: 수정 모드일 때만 필수 (BAND 다중 선택 시 자동 설정됨)
    if (!formData.name.trim()) {
      if (isEditMode) {
        newErrors.name = '채널명을 입력해주세요.'
      } else if (formData.platform === 'BAND' && selectedBands.length > 0) {
        // BAND 다중 선택 시 name은 각 밴드에서 가져오므로 검증 제외
      } else if (formData.platform === 'BAND' && selectedBands.length === 0) {
        // BAND는 밴드 선택 시 name이 자동 설정되므로, 선택이 없을 때는 channelKey 에러가 우선
      } else if (!formData.channelKey) {
        // 다른 플랫폼도 선택 시 name이 자동 설정됨
      } else {
        newErrors.name = '채널명을 입력해주세요.'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      const url = '/api/channel'

      if (isEditMode) {
        // 수정 모드
        const body = {
          id: channel!.id,
          name: formData.name,
          isActive: formData.isActive,
          coverUrl: formData.coverUrl || null,
        }

        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const data = await response.json()

        if (data.success) {
          toast.success('채널이 수정되었습니다.')
          onSuccess()
          onClose()
        } else {
          toast.error(data.error || '처리에 실패했습니다.')
        }
      } else if (formData.platform === 'BAND' && selectedBands.length > 0) {
        // BAND 다중 등록
        let successCount = 0
        let failCount = 0
        const failedBands: string[] = []

        for (const band of selectedBands) {
          try {
            const body = {
              kind: formData.kind,
              platform: formData.platform,
              channelKey: band.bandKey,
              name: band.name,
              coverUrl: band.coverUrl || null,
            }

            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })

            const data = await response.json()

            if (data.success) {
              successCount++
            } else {
              failCount++
              failedBands.push(band.name)
            }
          } catch (error) {
            console.error(`밴드 등록 실패 (${band.name}):`, error)
            failCount++
            failedBands.push(band.name)
          }
        }

        if (successCount > 0) {
          if (failCount > 0) {
            toast.success(`${successCount}개 채널 등록 완료. ${failCount}개 실패: ${failedBands.join(', ')}`)
          } else {
            toast.success(`${successCount}개 채널이 등록되었습니다.`)
          }
          onSuccess()
          onClose()
        } else {
          toast.error('채널 등록에 실패했습니다.')
        }
      } else {
        // 단일 등록 (다른 플랫폼)
        const body = {
          kind: formData.kind,
          platform: formData.platform,
          channelKey: formData.channelKey,
          name: formData.name,
          coverUrl: formData.coverUrl || null,
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const data = await response.json()

        if (data.success) {
          toast.success('채널이 등록되었습니다.')
          onSuccess()
          onClose()
        } else {
          toast.error(data.error || '처리에 실패했습니다.')
        }
      }
    } catch (error) {
      console.error('채널 처리 실패:', error)
      toast.error('처리 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string | boolean) => {
    // kind 변경 시 관련 상태 초기화
    if (field === 'kind') {
      setSelectedBands([])
      setFormData((prev) => ({
        ...prev,
        kind: value as ChannelKind,
        channelKey: '',
        name: '',
        coverUrl: '',
      }))
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }

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
    // 선택된 밴드 초기화
    setSelectedBands([])

    // 플랫폼 변경 시 채널 관련 필드 초기화
    setFormData((prev) => ({
      ...prev,
      platform,
      channelKey: '',
      name: '',
      coverUrl: '',
    }))

    // 밴드 플랫폼 선택 시 밴드 목록 조회
    if (platform === 'BAND') {
      fetchBandList()
    }
  }

  // 밴드 선택 핸들러 (다중 선택)
  const handleBandSelect = (band: BandInfo) => {
    setSelectedBands((prev) => {
      const isSelected = prev.some((b) => b.bandKey === band.bandKey)
      if (isSelected) {
        return prev.filter((b) => b.bandKey !== band.bandKey)
      } else {
        return [...prev, band]
      }
    })
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

  // 전체 선택/해제 핸들러 (필터링된 목록 기준)
  const handleSelectAllBands = (filteredList: BandInfo[]) => {
    if (selectedBands.length === filteredList.length) {
      setSelectedBands([])
    } else {
      setSelectedBands([...filteredList])
    }
  }


  // API 설정된 플랫폼만 필터링 (등록 모드), 수정 모드에서는 전체
  const availablePlatforms = isEditMode
    ? PLATFORM_OPTIONS.filter((p) => p.kinds.includes(formData.kind))
    : PLATFORM_OPTIONS.filter((p) => p.kinds.includes(formData.kind) && configuredPlatforms.includes(p.value))

  // 이미 등록된 채널 키를 제외한 밴드 목록 (현재 선택된 kind에 해당하는 채널만 필터링)
  const currentKindChannelKeys = formData.kind === 'WHOLESALE'
    ? existingChannelKeys.wholesale
    : existingChannelKeys.retail
  const filteredBandList = bandList.filter((band) => !currentKindChannelKeys.includes(band.bandKey))

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
            {isLoadingApiSettings ? (
              <div className="flex items-center justify-center py-4 text-gray-500">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                플랫폼 설정 확인 중...
              </div>
            ) : availablePlatforms.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">
                      {formData.kind === 'WHOLESALE' ? '도매 채널' : '소매 채널'}에 사용 가능한 플랫폼이 없습니다.
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      API 설정 페이지에서 플랫폼 연동을 먼저 완료해주세요.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        router.push('/admin/settings/api')
                      }}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      API 설정 페이지로 이동
                    </button>
                  </div>
                </div>
              </div>
            ) : (
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
            )}
          </div>
        )}

        {/* 밴드 선택 (등록 시, 플랫폼이 BAND일 때만) */}
        {!isEditMode && formData.platform === 'BAND' && (
          <div>
            {/* 도매 채널: 다중 선택 방식 */}
            {formData.kind === 'WHOLESALE' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    밴드 선택 <span className="text-red-500">*</span>
                    {selectedBands.length > 0 && (
                      <span className="ml-2 text-purple-600">({selectedBands.length}개 선택됨)</span>
                    )}
                  </label>
                  {filteredBandList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectAllBands(filteredBandList)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      {selectedBands.length === filteredBandList.length ? '전체 해제' : '전체 선택'}
                    </button>
                  )}
                </div>
                {errors.channelKey && selectedBands.length === 0 && (
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
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">{bandError}</p>
                        {bandError.includes('API 설정') ? (
                          <div className="mt-3">
                            <p className="text-xs text-red-600 mb-2">
                              Band API 연동을 위해 먼저 Access Token을 설정해야 합니다.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                onClose()
                                router.push('/admin/settings/api')
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              API 설정 페이지로 이동
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={fetchBandList}
                            className="mt-2 inline-flex items-center gap-1 text-sm text-red-700 hover:text-red-800 font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            다시 시도
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : filteredBandList.length === 0 ? (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <p className="text-sm text-gray-500">{bandList.length === 0 ? '등록된 밴드가 없습니다.' : '등록 가능한 밴드가 없습니다. (모든 밴드가 이미 등록됨)'}</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg h-[450px] overflow-y-auto">
                    <div className="grid grid-cols-1 gap-2 p-2">
                      {filteredBandList.map((band) => {
                        const isSelected = selectedBands.some((b) => b.bandKey === band.bandKey)
                        return (
                          <button
                            key={band.bandKey}
                            type="button"
                            onClick={() => handleBandSelect(band)}
                            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                              isSelected
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
                            {isSelected && (
                              <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 소매 채널: 다중 선택 */}
            {formData.kind === 'RETAIL' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    밴드 선택 <span className="text-red-500">*</span>
                    {selectedBands.length > 0 && (
                      <span className="ml-2 text-purple-600">({selectedBands.length}개 선택됨)</span>
                    )}
                  </label>
                  {filteredBandList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectAllBands(filteredBandList)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      {selectedBands.length === filteredBandList.length ? '전체 해제' : '전체 선택'}
                    </button>
                  )}
                </div>
                {errors.channelKey && selectedBands.length === 0 && (
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
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">{bandError}</p>
                        {bandError.includes('API 설정') ? (
                          <div className="mt-3">
                            <p className="text-xs text-red-600 mb-2">
                              Band API 연동을 위해 먼저 Access Token을 설정해야 합니다.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                onClose()
                                router.push('/admin/settings/api')
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              API 설정 페이지로 이동
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={fetchBandList}
                            className="mt-2 inline-flex items-center gap-1 text-sm text-red-700 hover:text-red-800 font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            다시 시도
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : filteredBandList.length === 0 ? (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <p className="text-sm text-gray-500">
                      {bandList.length === 0 ? '등록된 밴드가 없습니다.' : '모든 밴드가 이미 등록되어 있습니다.'}
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg h-[450px] overflow-y-auto">
                    <div className="grid grid-cols-1 gap-2 p-2">
                      {filteredBandList.map((band) => {
                        const isSelected = selectedBands.some((b) => b.bandKey === band.bandKey)
                        return (
                          <button
                            key={band.bandKey}
                            type="button"
                            onClick={() => handleBandSelect(band)}
                            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                              isSelected
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
                            {isSelected && (
                              <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              채널명 <span className="text-red-500">*</span>
            </label>
            <Input
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
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          취소
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting
            ? '처리 중...'
            : isEditMode
            ? '수정'
            : '등록'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
