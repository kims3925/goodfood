'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Store, Save, Trash2, Edit, X, Calendar, Link2, CreditCard, Building2, User, Power, Globe, Tag, Palette, Mail, Phone, Truck, ShoppingCart, Image, FileText, KeyRound, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

interface ChannelTheme {
  id: number
  channelId: number
  primaryColor: string | null
  secondaryColor: string | null
  logoUrl: string | null
  faviconUrl: string | null
  bannerUrl: string | null
  footerText: string | null
}

interface Shop {
  id: number
  name: string
  subdomain: string
  isActive: boolean
}

interface Channel {
  id: number
  userId: number
  kind: 'WHOLESALE' | 'RETAIL'
  platform: string
  channelKey: string
  name: string
  coverUrl: string | null
  isActive: boolean
  accountHolder: string | null
  bankAccount: string | null
  bankName: string | null
  createdAt: string
  updatedAt: string
  // Shop 연결
  shopId: number | null
  shop: Shop | null
  // 도메인 멀티채널 쇼핑몰 필드
  subdomain: string | null
  displayName: string | null
  freeShippingAmount: number | null
  defaultShippingFee: number | null
  contactPhone: string | null
  contactEmail: string | null
  theme: ChannelTheme | null
  // BAND 채널용 네이버 계정 정보
  naverId?: string | null
}

const PLATFORM_LABELS: { [key: string]: string } = {
  BAND: '밴드',
  NAVER_CAFE: '네이버 카페',
  ALIEXPRESS: '알리익스프레스',
  SMARTSTORE: '스마트스토어',
  COUPANG: '쿠팡',
  CUSTOM: '커스텀',
}

const KIND_LABELS: { [key: string]: string } = {
  WHOLESALE: '도매(소싱)',
  RETAIL: '소매(판매)',
}

export default function ChannelDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()
  const toast = useToast()

  const [channel, setChannel] = useState<Channel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Shop 목록
  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null)

  // 수정 가능한 필드
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [coverUrl, setCoverUrl] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankName, setBankName] = useState('')

  // 도메인 쇼핑몰 필드
  const [subdomain, setSubdomain] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [freeShippingAmount, setFreeShippingAmount] = useState<number | null>(null)
  const [defaultShippingFee, setDefaultShippingFee] = useState<number | null>(null)
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  // 테마 필드
  const [primaryColor, setPrimaryColor] = useState('')
  const [secondaryColor, setSecondaryColor] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [footerText, setFooterText] = useState('')

  // BAND 네이버 계정 관련 상태
  const [bandNaverId, setBandNaverId] = useState('')
  const [bandNaverPassword, setBandNaverPassword] = useState('')
  const [isBandSaving, setIsBandSaving] = useState(false)
  const [hasBandCredentials, setHasBandCredentials] = useState(false)

  // BAND 수동 세션 관련 상태
  const [bandSessionStatus, setBandSessionStatus] = useState<{
    hasSession: boolean
    isValid: boolean
    expiresAt: Date | null
  }>({ hasSession: false, isValid: false, expiresAt: null })
  const [isManualLoginStarting, setIsManualLoginStarting] = useState(false)
  const [manualLoginSessionId, setManualLoginSessionId] = useState<string | null>(null)
  const [manualLoginStatus, setManualLoginStatus] = useState<string>('idle') // idle, waiting, completed, failed

  // 쿠키 직접 입력 관련 상태
  const [showCookieInput, setShowCookieInput] = useState(false)
  const [cookieInputValue, setCookieInputValue] = useState('')
  const [isSavingCookie, setIsSavingCookie] = useState(false)

  // Shop URL 기본 주소 (경로 기반 라우팅)
  const shopBaseUrl = process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'http://localhost:3000'

  // Shop 목록 로드
  const loadShops = useCallback(async () => {
    try {
      const response = await fetch('/api/shop?limit=100')
      const data = await response.json()
      if (data.success) {
        setShops(data.data.filter((s: Shop) => s.isActive))
      }
    } catch (error) {
      console.error('Shop 목록 로드 실패:', error)
    }
  }, [])

  // BAND 네이버 계정 저장
  const handleSaveBandCredentials = async () => {
    if (!bandNaverId.trim() || !bandNaverPassword.trim()) {
      toast.error('네이버 ID와 비밀번호를 입력해주세요.')
      return
    }

    setIsBandSaving(true)
    try {
      const response = await fetch(`/api/channel/${id}/band-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naverId: bandNaverId,
          naverPassword: bandNaverPassword,
        }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success('네이버 계정 정보가 저장되었습니다.')
        setBandNaverPassword('') // 비밀번호 필드 초기화 (보안)
        setHasBandCredentials(true)
      } else {
        toast.error(data.error || '저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('BAND 계정 저장 실패:', error)
      toast.error('저장 중 오류가 발생했습니다.')
    } finally {
      setIsBandSaving(false)
    }
  }

  // BAND 네이버 계정 삭제
  const handleDeleteBandCredentials = async () => {
    setIsBandSaving(true)
    try {
      const response = await fetch(`/api/channel/${id}/band-login`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        toast.success('네이버 계정 정보가 삭제되었습니다.')
        setBandNaverId('')
        setBandNaverPassword('')
        setHasBandCredentials(false)
      } else {
        toast.error(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('BAND 계정 삭제 실패:', error)
      toast.error('삭제 중 오류가 발생했습니다.')
    } finally {
      setIsBandSaving(false)
    }
  }

  // BAND 세션 상태 로드
  const loadBandSessionStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/channel/${id}/band-session`)
      const data = await response.json()
      if (data.success && data.data) {
        setBandSessionStatus({
          hasSession: data.data.hasSession,
          isValid: data.data.isValid,
          expiresAt: data.data.expiresAt ? new Date(data.data.expiresAt) : null,
        })
      }
    } catch (error) {
      console.error('세션 상태 로드 실패:', error)
    }
  }, [id])

  // BAND 수동 로그인 시작
  const handleStartManualLogin = async () => {
    setIsManualLoginStarting(true)
    setManualLoginStatus('waiting')
    try {
      const response = await fetch(`/api/channel/${id}/band-session`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setManualLoginSessionId(data.data.sessionId)
        toast.success('브라우저가 열렸습니다. Band에 로그인해주세요.')

        // 로그인 완료 폴링 시작
        pollLoginStatus(data.data.sessionId)
      } else {
        toast.error(data.error || '브라우저 열기에 실패했습니다.')
        setManualLoginStatus('failed')
      }
    } catch (error) {
      console.error('수동 로그인 시작 실패:', error)
      toast.error('수동 로그인을 시작할 수 없습니다.')
      setManualLoginStatus('failed')
    } finally {
      setIsManualLoginStarting(false)
    }
  }

  // 로그인 상태 폴링
  const pollLoginStatus = async (sessionId: string) => {
    const maxAttempts = 60 // 5분 (5초 간격)
    let attempts = 0

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/channel/${id}/band-session?sessionId=${sessionId}`)
        const data = await response.json()

        if (data.success && data.data) {
          const status = data.data.status

          if (status === 'completed') {
            setManualLoginStatus('completed')
            setManualLoginSessionId(null)
            toast.success('세션이 저장되었습니다. 이제 이미지 발행이 가능합니다.')
            loadBandSessionStatus()
            return
          }

          if (status === 'failed' || status === 'cancelled') {
            setManualLoginStatus('failed')
            setManualLoginSessionId(null)
            toast.error(data.data.error || '로그인에 실패했습니다.')
            return
          }

          // 아직 대기 중
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 5000)
          } else {
            setManualLoginStatus('failed')
            setManualLoginSessionId(null)
            toast.error('로그인 시간이 초과되었습니다.')
          }
        }
      } catch (error) {
        console.error('상태 확인 실패:', error)
      }
    }

    // 첫 번째 체크는 10초 후에 시작
    setTimeout(checkStatus, 10000)
  }

  // BAND 세션 삭제
  const handleDeleteBandSession = async () => {
    try {
      const response = await fetch(`/api/channel/${id}/band-session`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        toast.success('세션이 삭제되었습니다.')
        setBandSessionStatus({ hasSession: false, isValid: false, expiresAt: null })
      } else {
        toast.error(data.error || '세션 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('세션 삭제 실패:', error)
      toast.error('세션 삭제 중 오류가 발생했습니다.')
    }
  }

  // 쿠키 직접 저장
  const handleSaveCookieDirect = async () => {
    if (!cookieInputValue.trim()) {
      toast.error('쿠키 JSON을 입력해주세요.')
      return
    }

    setIsSavingCookie(true)
    try {
      const response = await fetch(`/api/channel/${id}/band-session`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookieString: cookieInputValue }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success('세션 쿠키가 저장되었습니다.')
        setCookieInputValue('')
        setShowCookieInput(false)
        loadBandSessionStatus()
      } else {
        toast.error(data.error || '쿠키 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('쿠키 저장 실패:', error)
      toast.error('쿠키 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSavingCookie(false)
    }
  }

  const loadChannel = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log('[ChannelPage] API 호출:', `/api/channel/${id}`)
      const response = await fetch(`/api/channel/${id}`)
      console.log('[ChannelPage] 응답 상태:', response.status)
      const data = await response.json()
      console.log('[ChannelPage] 응답 데이터:', data)

      if (data.success) {
        const ch = data.data
        setChannel(ch)
        setName(ch.name || '')
        setIsActive(ch.isActive)
        setCoverUrl(ch.coverUrl || '')
        setAccountHolder(ch.accountHolder || '')
        setBankAccount(ch.bankAccount || '')
        setBankName(ch.bankName || '')
        // Shop 연결
        setSelectedShopId(ch.shopId || null)
        // 도메인 쇼핑몰 필드
        setSubdomain(ch.subdomain || '')
        setDisplayName(ch.displayName || '')
        setFreeShippingAmount(ch.freeShippingAmount)
        setDefaultShippingFee(ch.defaultShippingFee)
        setContactPhone(ch.contactPhone || '')
        setContactEmail(ch.contactEmail || '')
        // 테마 필드
        if (ch.theme) {
          setPrimaryColor(ch.theme.primaryColor || '')
          setSecondaryColor(ch.theme.secondaryColor || '')
          setLogoUrl(ch.theme.logoUrl || '')
          setFaviconUrl(ch.theme.faviconUrl || '')
          setBannerUrl(ch.theme.bannerUrl || '')
          setFooterText(ch.theme.footerText || '')
        } else {
          // 테마가 없으면 초기화
          setPrimaryColor('')
          setSecondaryColor('')
          setLogoUrl('')
          setFaviconUrl('')
          setBannerUrl('')
          setFooterText('')
        }
        // BAND 네이버 계정 정보
        if (ch.naverId) {
          setBandNaverId(ch.naverId)
          setHasBandCredentials(true)
        }
      } else {
        console.error('[ChannelPage] API 에러:', data.error)
        toast.error(data.error || '채널을 불러오는데 실패했습니다.')
        router.push('/channel')
      }
    } catch (error) {
      console.error('[ChannelPage] 예외 발생:', error)
      toast.error('채널을 불러오는데 실패했습니다.')
      router.push('/channel')
    } finally {
      setIsLoading(false)
    }
  }, [id, router, toast])

  useEffect(() => {
    loadChannel()
    loadShops()
    loadBandSessionStatus()
  }, [loadChannel, loadShops, loadBandSessionStatus])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('채널명을 입력해주세요.')
      return
    }

    setIsSaving(true)
    try {
      // 기본 데이터
      const updateData: Record<string, any> = {
        name,
        isActive,
        coverUrl: coverUrl || null,
        accountHolder: accountHolder || null,
        bankAccount: bankAccount || null,
        bankName: bankName || null,
      }

      // 소매 채널인 경우 Shop 연결
      if (channel?.kind === 'RETAIL') {
        updateData.shopId = selectedShopId || null
      }

      // 소매 밴드인 경우 쇼핑몰/테마 필드 포함
      const isRetailBand = channel?.kind === 'RETAIL' && channel?.platform === 'BAND'
      if (isRetailBand) {
        updateData.subdomain = subdomain || null
        updateData.displayName = displayName || null
        updateData.freeShippingAmount = freeShippingAmount || null
        updateData.defaultShippingFee = defaultShippingFee || null
        updateData.contactPhone = contactPhone || null
        updateData.contactEmail = contactEmail || null
        updateData.theme = {
          primaryColor: primaryColor || null,
          secondaryColor: secondaryColor || null,
          logoUrl: logoUrl || null,
          faviconUrl: faviconUrl || null,
          bannerUrl: bannerUrl || null,
          footerText: footerText || null,
        }
      }

      const response = await fetch(`/api/channel/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
      const data = await response.json()

      if (data.success) {
        toast.success('채널이 수정되었습니다.')
        setChannel(data.data)
        setIsEditMode(false)
      } else {
        toast.error(data.error || '채널 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('채널 수정 실패:', error)
      toast.error('채널 수정에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/channel/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        toast.success('채널이 삭제되었습니다.')
        router.push('/channel')
      } else {
        toast.error(data.error || '채널 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('채널 삭제 실패:', error)
      toast.error('채널 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleCancelEdit = () => {
    if (channel) {
      setName(channel.name || '')
      setIsActive(channel.isActive)
      setCoverUrl(channel.coverUrl || '')
      setAccountHolder(channel.accountHolder || '')
      setBankAccount(channel.bankAccount || '')
      setBankName(channel.bankName || '')
      // Shop 연결 복원
      setSelectedShopId(channel.shopId || null)
      // 도메인 쇼핑몰 필드 복원
      setSubdomain(channel.subdomain || '')
      setDisplayName(channel.displayName || '')
      setFreeShippingAmount(channel.freeShippingAmount)
      setDefaultShippingFee(channel.defaultShippingFee)
      setContactPhone(channel.contactPhone || '')
      setContactEmail(channel.contactEmail || '')
      // 테마 필드 복원
      if (channel.theme) {
        setPrimaryColor(channel.theme.primaryColor || '')
        setSecondaryColor(channel.theme.secondaryColor || '')
        setLogoUrl(channel.theme.logoUrl || '')
        setFaviconUrl(channel.theme.faviconUrl || '')
        setBannerUrl(channel.theme.bannerUrl || '')
        setFooterText(channel.theme.footerText || '')
      } else {
        setPrimaryColor('')
        setSecondaryColor('')
        setLogoUrl('')
        setFaviconUrl('')
        setBannerUrl('')
        setFooterText('')
      }
    }
    setIsEditMode(false)
  }

  const formatDateTimeKST = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const getKindBadge = (kind: string) => {
    const isWholesale = kind === 'WHOLESALE'
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
        isWholesale
          ? 'bg-blue-50 text-blue-700'
          : 'bg-emerald-50 text-emerald-700'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isWholesale ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
        {KIND_LABELS[kind] || kind}
      </span>
    )
  }

  const getStatusBadge = (isActive: boolean) => {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
        isActive
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-600'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
        {isActive ? '활성' : '비활성'}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!channel) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 상단 네비게이션 바 */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/channel')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="font-medium">목록</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-slate-200"></div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-slate-400 text-sm">채널</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700 text-sm font-medium truncate max-w-[200px]">
                  {channel.name}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="!px-4 !py-2"
                  >
                    <X size={16} />
                    <span className="hidden sm:inline">취소</span>
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="!px-4 !py-2"
                  >
                    <Save size={16} />
                    {isSaving ? '저장중...' : '저장'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setIsEditMode(true)}
                    className="!px-4 !py-2"
                  >
                    <Edit size={16} />
                    <span className="hidden sm:inline">수정</span>
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="!px-4 !py-2"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">삭제</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 2컬럼 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 채널 정보 카드 - 전체 통합 */}
          <div className="lg:col-span-12">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* 헤더 영역 */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 rounded-xl">
                      <Store size={22} className="text-blue-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg text-slate-900">채널 정보</h2>
                      <p className="text-sm text-slate-500">채널의 기본 정보와 설정을 관리합니다</p>
                    </div>
                  </div>
                  {/* 활성화 토글 */}
                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={() => setIsActive(!isActive)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-sm ${
                        isActive
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-slate-400 text-white hover:bg-slate-500'
                      }`}
                    >
                      <Power size={16} />
                      {isActive ? '활성' : '비활성'}
                    </button>
                  ) : (
                    getStatusBadge(channel.isActive)
                  )}
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* 왼쪽: 커버 이미지 & 기본 정보 */}
                  <div className="lg:col-span-4">
                    {/* 채널명 */}
                    <div className="flex items-start justify-between gap-3 mb-5">
                      <div className="flex-1 min-w-0">
                        {isEditMode ? (
                          <Input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="채널명을 입력하세요"
                            className="!text-lg !font-bold !rounded-xl"
                          />
                        ) : (
                          <h1 className="text-xl font-bold text-slate-900 truncate">{channel.name}</h1>
                        )}
                      </div>
                      {getKindBadge(channel.kind)}
                    </div>

                    {/* 커버 이미지 */}
                    <div className="rounded-xl overflow-hidden mb-5">
                      {channel.coverUrl ? (
                        <img
                          src={channel.coverUrl}
                          alt={channel.name}
                          className="w-full aspect-video object-cover"
                        />
                      ) : (
                        <div className="w-full aspect-video bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                          <Store size={48} className="text-slate-400" />
                        </div>
                      )}
                    </div>

                    {/* 날짜 정보 */}
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar size={14} className="text-slate-400" />
                          <div>
                            <p className="text-slate-400 text-xs">생성일</p>
                            <p className="text-slate-600 text-xs">{formatDateTimeKST(channel.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar size={14} className="text-slate-400" />
                          <div>
                            <p className="text-slate-400 text-xs">수정일</p>
                            <p className="text-slate-600 text-xs">{formatDateTimeKST(channel.updatedAt)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 오른쪽: 상세 설정 */}
                  <div className={`lg:col-span-8 flex flex-col gap-6 ${channel.kind === 'WHOLESALE' ? 'justify-center' : ''}`}>
                    {/* Shop 연결 (소매 채널만) - 맨 위에 배치 */}
                    {channel.kind === 'RETAIL' && (
                      <div className="p-4 bg-indigo-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <Store size={16} className="text-indigo-600" />
                          <span className="text-sm font-semibold text-slate-700">Shop 연결</span>
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                            소매 채널
                          </span>
                        </div>
                        {isEditMode ? (
                          <>
                            <select
                              value={selectedShopId || ''}
                              onChange={(e) => setSelectedShopId(e.target.value ? parseInt(e.target.value) : null)}
                              className="w-full px-4 py-3 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                            >
                              <option value="">Shop을 선택하세요</option>
                              {shops.map((shop) => (
                                <option key={shop.id} value={shop.id}>
                                  {shop.name} ({shopBaseUrl}/{shop.subdomain})
                                </option>
                              ))}
                            </select>
                            <p className="mt-2 text-xs text-slate-500">
                              이 채널에서 발행할 때 연결될 Shop을 선택합니다.
                            </p>
                          </>
                        ) : (
                          <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-indigo-100">
                            <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-lg">
                              <Store size={18} className="text-indigo-600" />
                            </div>
                            <div>
                              {channel.shop ? (
                                <>
                                  <p className="font-medium text-slate-900">{channel.shop.name}</p>
                                  <p className="text-sm text-indigo-600 font-mono">{shopBaseUrl}/{channel.shop.subdomain}</p>
                                </>
                              ) : (
                                <p className="text-slate-400">연결된 Shop이 없습니다</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 채널 메타 정보 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-sm">
                          <Globe size={18} className="text-slate-500" />
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">플랫폼</p>
                          <p className="font-semibold text-slate-900">{PLATFORM_LABELS[channel.platform] || channel.platform}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-sm">
                          <Link2 size={18} className="text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-500 text-xs">채널키</p>
                          <p className="font-mono text-sm text-slate-700 truncate">{channel.channelKey}</p>
                        </div>
                      </div>
                    </div>

                    {/* 커버 이미지 URL */}
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Image size={16} className="text-slate-500" />
                          커버 이미지 URL
                        </div>
                      </label>
                      {isEditMode ? (
                        <>
                          <Input
                            type="text"
                            value={coverUrl}
                            onChange={(e) => setCoverUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            className="!rounded-xl !bg-white"
                          />
                          <p className="mt-2 text-xs text-slate-500">
                            채널 목록과 상세 페이지에 표시되는 대표 이미지입니다.
                          </p>
                        </>
                      ) : (
                        <p className="text-slate-700 text-sm break-all font-mono bg-white rounded-lg p-3 border border-slate-100">
                          {channel.coverUrl || '(설정되지 않음)'}
                        </p>
                      )}
                    </div>

                    {/* BAND 플랫폼 네이버 계정 정보 섹션 (소매 채널만) */}
                    {channel.platform === 'BAND' && channel.kind === 'RETAIL' && (
                      <div className="p-4 bg-green-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <KeyRound size={16} className="text-green-600" />
                          <span className="text-sm font-semibold text-slate-700">네이버 계정 정보 (이미지 발행용)</span>
                          {hasBandCredentials && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              <CheckCircle size={12} />
                              저장됨
                            </span>
                          )}
                        </div>

                        {/* 계정 정보 입력 폼 */}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-slate-600 mb-1">네이버 ID</label>
                            <Input
                              type="text"
                              value={bandNaverId}
                              onChange={(e) => setBandNaverId(e.target.value)}
                              placeholder="네이버 아이디"
                              className="!rounded-lg !bg-white"
                              disabled={isBandSaving}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-600 mb-1">네이버 비밀번호</label>
                            <Input
                              type="password"
                              value={bandNaverPassword}
                              onChange={(e) => setBandNaverPassword(e.target.value)}
                              placeholder={hasBandCredentials ? '(변경 시에만 입력)' : '비밀번호'}
                              className="!rounded-lg !bg-white"
                              disabled={isBandSaving}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              onClick={handleSaveBandCredentials}
                              disabled={isBandSaving || !bandNaverId.trim() || (!hasBandCredentials && !bandNaverPassword.trim())}
                              className="flex-1 !py-2.5"
                            >
                              {isBandSaving ? (
                                <>
                                  <Loader2 size={16} className="animate-spin" />
                                  저장 중...
                                </>
                              ) : (
                                <>
                                  <Save size={16} />
                                  {hasBandCredentials ? '계정 정보 수정' : '계정 정보 저장'}
                                </>
                              )}
                            </Button>
                            {hasBandCredentials && (
                              <Button
                                variant="secondary"
                                onClick={handleDeleteBandCredentials}
                                disabled={isBandSaving}
                                className="!py-2.5"
                              >
                                <Trash2 size={16} />
                                삭제
                              </Button>
                            )}
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          이미지를 포함한 발행을 위해 네이버 계정 정보가 필요합니다.
                          발행 시점에 자동으로 로그인하여 이미지를 업로드합니다.
                        </p>
                      </div>
                    )}

                    {/* BAND 수동 세션 관리 섹션 - RETAIL 채널만 표시 (도매 채널은 세션 불필요) */}
                    {channel.platform === 'BAND' && channel.kind === 'RETAIL' && (
                      <div className="p-4 bg-purple-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <KeyRound size={16} className="text-purple-600" />
                          <span className="text-sm font-semibold text-slate-700">Band 세션 관리 (2FA 계정용)</span>
                          {bandSessionStatus.hasSession && bandSessionStatus.isValid && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              <CheckCircle size={12} />
                              유효
                            </span>
                          )}
                          {bandSessionStatus.hasSession && !bandSessionStatus.isValid && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              <AlertCircle size={12} />
                              만료됨
                            </span>
                          )}
                        </div>

                        {/* 세션 상태 표시 */}
                        {bandSessionStatus.hasSession ? (
                          <div className="mb-3 p-3 bg-white rounded-lg border border-purple-100">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-700">
                                  세션 상태: {bandSessionStatus.isValid ? '유효함' : '만료됨'}
                                </p>
                                {bandSessionStatus.expiresAt && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    만료 예정: {bandSessionStatus.expiresAt.toLocaleString('ko-KR')}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="secondary"
                                onClick={handleDeleteBandSession}
                                className="!py-1.5 !px-3 !text-xs"
                              >
                                <Trash2 size={14} />
                                삭제
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mb-3 p-3 bg-white rounded-lg border border-purple-100">
                            <p className="text-sm text-slate-500">저장된 세션이 없습니다.</p>
                          </div>
                        )}

                        {/* 수동 로그인 버튼 */}
                        <Button
                          variant="primary"
                          onClick={handleStartManualLogin}
                          disabled={isManualLoginStarting || manualLoginStatus === 'waiting'}
                          className="w-full !py-2.5 !bg-purple-600 hover:!bg-purple-700"
                        >
                          {isManualLoginStarting ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              브라우저 열기...
                            </>
                          ) : manualLoginStatus === 'waiting' ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              로그인 대기 중...
                            </>
                          ) : (
                            <>
                              <KeyRound size={16} />
                              수동 로그인으로 세션 등록
                            </>
                          )}
                        </Button>

                        <p className="mt-3 text-xs text-slate-500">
                          2단계 인증이 설정된 네이버 계정은 이 방법을 사용하세요.
                          버튼을 클릭하면 브라우저가 열리고, 직접 로그인하면 세션이 자동 저장됩니다.
                        </p>

                        {/* 쿠키 직접 입력 섹션 */}
                        <div className="mt-4 pt-4 border-t border-purple-200">
                          <button
                            type="button"
                            onClick={() => setShowCookieInput(!showCookieInput)}
                            className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                          >
                            <FileText size={14} />
                            {showCookieInput ? '쿠키 직접 입력 닫기' : '쿠키 직접 입력 (서버용)'}
                          </button>

                          {showCookieInput && (
                            <div className="mt-3 space-y-3">
                              {/* 쿠키 추출 방법 */}
                              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-xs text-green-800 font-medium mb-2">쿠키 추출 방법:</p>
                                <ol className="text-xs text-green-700 space-y-1 list-decimal list-inside mb-2">
                                  <li>Chrome으로 <a href="https://band.us" target="_blank" rel="noopener noreferrer" className="underline font-medium">band.us</a>에 로그인</li>
                                  <li>F12 → Console 탭에서 아래 명령어 실행:</li>
                                </ol>
                                <div className="p-2 bg-gray-800 rounded text-xs text-green-400 font-mono break-all">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const script = `copy(JSON.stringify(await cookieStore.getAll()))`
                                      navigator.clipboard.writeText(script)
                                      toast.success('클립보드에 복사됨! band.us 콘솔에 붙여넣기 후 Enter')
                                    }}
                                    className="text-left hover:text-green-300 w-full"
                                    title="클릭하여 복사"
                                  >
                                    copy(JSON.stringify(await cookieStore.getAll())) <span className="text-yellow-400">[클릭하여 복사]</span>
                                  </button>
                                </div>
                                <p className="text-xs text-green-600 mt-2">3. 아래 입력창에 Ctrl+V로 붙여넣기</p>
                              </div>

                              <textarea
                                value={cookieInputValue}
                                onChange={(e) => setCookieInputValue(e.target.value)}
                                placeholder='[{"name": "...", "value": "...", "domain": ".band.us", ...}]'
                                className="w-full h-24 p-3 text-xs font-mono border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white resize-none"
                              />

                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  onClick={handleSaveCookieDirect}
                                  disabled={isSavingCookie || !cookieInputValue.trim()}
                                  className="flex-1 !py-2 !bg-purple-600 hover:!bg-purple-700"
                                >
                                  {isSavingCookie ? (
                                    <>
                                      <Loader2 size={14} className="animate-spin" />
                                      저장 중...
                                    </>
                                  ) : (
                                    <>
                                      <Save size={14} />
                                      쿠키 저장
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setCookieInputValue('')
                                    setShowCookieInput(false)
                                  }}
                                  className="!py-2"
                                >
                                  취소
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="채널 삭제"
        message="이 채널을 삭제하시겠습니까? 관련된 게시물과 발행 상품 데이터도 함께 삭제됩니다."
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
