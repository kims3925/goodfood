'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Store, Save, Trash2, Edit, X, Calendar, Link2, Power, Globe, Image as ImageIcon, Key, CheckCircle, XCircle, Clock } from 'lucide-react'
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
  // 도매방 전용 (지침서 Phase 1) + 주문 마감시간
  minSourcingPrice: number | null
  maxSourcingPrice: number | null
  orderDeadline: string | null
  // 소매 채널 전용: 발행글 푸터 이미지 (모든 게시글 이미지 맨 마지막 자동 첨부)
  footerImageUrl: string | null
  // 다단계 발행: 발행 대상 가격 tier (RETAIL=소매가 / WHOLESALE=도매가, 가족도매방밴드)
  publishPriceTier: 'WHOLESALE' | 'RETAIL' | null
  // 밴드 발행 방식 (RETAIL): COMPOSE(기본, AI 본문작성) / CROSSPOST(원본 도매글 공유)
  bandPublishMethod?: 'COMPOSE' | 'CROSSPOST' | string | null
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

  // 세션 상태
  const [sessionStatus, setSessionStatus] = useState<{
    hasSession: boolean
    isValid: boolean
    expiresAt: string | null
  } | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(false)

  // 수정 가능한 필드
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [coverUrl, setCoverUrl] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankName, setBankName] = useState('')

  // 도매방 전용: 취급 가격 범위 (Phase 1) + 주문 마감시간
  const [minSourcingPrice, setMinSourcingPrice] = useState<string>('')
  const [maxSourcingPrice, setMaxSourcingPrice] = useState<string>('')
  const [orderDeadline, setOrderDeadline] = useState<string>('')

  // 다단계 발행: 발행 대상 가격 tier (RETAIL 채널 전용 토글)
  const [publishPriceTier, setPublishPriceTier] = useState<'WHOLESALE' | 'RETAIL'>('RETAIL')

  // 밴드 발행 방식 (RETAIL 채널 전용 토글): COMPOSE(기본) / CROSSPOST(원본 공유)
  const [bandPublishMethod, setBandPublishMethod] = useState<'COMPOSE' | 'CROSSPOST'>('COMPOSE')

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

  // 발행글 푸터 이미지 (RETAIL 채널 전용)
  const [isUploadingFooter, setIsUploadingFooter] = useState(false)


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

  // 세션 상태 로드
  const loadSessionStatus = useCallback(async () => {
    setIsLoadingSession(true)
    try {
      const response = await fetch(`/api/channel/${id}/band-session`)
      const data = await response.json()
      if (data.success) {
        setSessionStatus(data.data)
      }
    } catch (error) {
      console.error('세션 상태 로드 실패:', error)
    } finally {
      setIsLoadingSession(false)
    }
  }, [id])

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
        // Phase 1 / 마감시간
        setMinSourcingPrice(ch.minSourcingPrice != null ? String(ch.minSourcingPrice) : '')
        setMaxSourcingPrice(ch.maxSourcingPrice != null ? String(ch.maxSourcingPrice) : '')
        setOrderDeadline(ch.orderDeadline || '')
        // 다단계 발행: 가격 tier (기본 RETAIL)
        setPublishPriceTier(ch.publishPriceTier === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL')
        // 밴드 발행 방식 (기본 COMPOSE)
        setBandPublishMethod(ch.bandPublishMethod === 'CROSSPOST' ? 'CROSSPOST' : 'COMPOSE')
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
      } else {
        console.error('[ChannelPage] API 에러:', data.error)
        toast.error(data.error || '채널을 불러오는데 실패했습니다.')
        router.push('/sourcing/channel/list')
      }
    } catch (error) {
      console.error('[ChannelPage] 예외 발생:', error)
      toast.error('채널을 불러오는데 실패했습니다.')
      router.push('/sourcing/channel/list')
    } finally {
      setIsLoading(false)
    }
  }, [id, router, toast])

  useEffect(() => {
    loadChannel()
    loadShops()
    loadSessionStatus()
  }, [loadChannel, loadShops, loadSessionStatus])

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
        orderDeadline: orderDeadline || null,
      }

      // 도매방(WHOLESALE) 전용: 취급 가격 범위
      if (channel?.kind === 'WHOLESALE') {
        updateData.minSourcingPrice = minSourcingPrice === '' ? null : parseInt(minSourcingPrice.replace(/[^0-9]/g, ''), 10) || null
        updateData.maxSourcingPrice = maxSourcingPrice === '' ? null : parseInt(maxSourcingPrice.replace(/[^0-9]/g, ''), 10) || null
      }

      // 소매 채널인 경우 Shop 연결 + 발행 가격 tier (다단계 발행)
      if (channel?.kind === 'RETAIL') {
        updateData.shopId = selectedShopId || null
        updateData.publishPriceTier = publishPriceTier
        updateData.bandPublishMethod = bandPublishMethod
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
        router.push('/sourcing/channel/list')
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

  // 발행글 푸터 이미지 업로드 (RETAIL 채널 전용)
  const handleFooterImageUpload = async (file: File) => {
    if (!channel) return
    setIsUploadingFooter(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/channel/${channel.id}/footer-image`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (data.success && data.data?.url) {
        setChannel({ ...channel, footerImageUrl: data.data.url })
        toast.success('푸터 이미지가 등록되었습니다.')
      } else {
        toast.error(data.error || '푸터 이미지 업로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('푸터 이미지 업로드 실패:', error)
      toast.error('푸터 이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setIsUploadingFooter(false)
    }
  }

  const handleFooterImageDelete = async () => {
    if (!channel) return
    if (!confirm('푸터 이미지를 해제하시겠습니까? (파일은 보존됩니다)')) return
    try {
      const res = await fetch(`/api/channel/${channel.id}/footer-image`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setChannel({ ...channel, footerImageUrl: null })
        toast.success('푸터 이미지가 해제되었습니다.')
      } else {
        toast.error(data.error || '푸터 이미지 해제에 실패했습니다.')
      }
    } catch (error) {
      console.error('푸터 이미지 해제 실패:', error)
      toast.error('푸터 이미지 해제 중 오류가 발생했습니다.')
    }
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
                onClick={() => router.push('/sourcing/channel/list')}
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
                  {/* 활성화 토글 (조회/편집 모드 모두 작동) */}
                  <button
                    type="button"
                    onClick={async () => {
                      const next = !isActive
                      setIsActive(next)
                      // 조회 모드에서는 즉시 서버 저장
                      if (!isEditMode && channel) {
                        try {
                          const response = await fetch(`/api/channel/${channel.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ isActive: next }),
                          })
                          const data = await response.json()
                          if (data.success) {
                            setChannel({ ...channel, isActive: next })
                            toast.success(`채널이 ${next ? '활성화' : '비활성화'}되었습니다.`)
                          } else {
                            setIsActive(!next) // 롤백
                            toast.error(data.error || '상태 변경에 실패했습니다.')
                          }
                        } catch {
                          setIsActive(!next) // 롤백
                          toast.error('상태 변경 중 오류가 발생했습니다.')
                        }
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-sm ${
                      isActive
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-slate-400 text-white hover:bg-slate-500'
                    }`}
                    title={isActive ? '클릭하여 비활성화' : '클릭하여 활성화'}
                  >
                    <Power size={16} />
                    {isActive ? '활성' : '비활성'}
                  </button>
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

                    {/* 세션 정보 (소매 밴드만) */}
                    {channel.kind === 'RETAIL' && channel.platform === 'BAND' && (
                      <div className="bg-slate-50 rounded-xl p-4 mt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Key size={14} className="text-slate-400" />
                          <span className="text-slate-400 text-xs font-medium">밴드 세션</span>
                        </div>
                        {isLoadingSession ? (
                          <div className="flex items-center gap-2 text-slate-500 text-xs">
                            <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                            로드 중...
                          </div>
                        ) : sessionStatus ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {sessionStatus.hasSession ? (
                                sessionStatus.isValid ? (
                                  <div className="flex items-center gap-1.5 text-emerald-600">
                                    <CheckCircle size={14} />
                                    <span className="text-xs font-medium">저장됨</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-amber-600">
                                    <Clock size={14} />
                                    <span className="text-xs font-medium">만료됨</span>
                                  </div>
                                )
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1.5 text-slate-400">
                                    <XCircle size={14} />
                                    <span className="text-xs font-medium">없음</span>
                                  </div>
                                  <a
                                    href="/sourcing/guide/band-session"
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium rounded-lg transition-colors w-fit"
                                  >
                                    <Key size={12} />
                                    세션 저장하는 법
                                  </a>
                                </div>
                              )}
                            </div>
                            {sessionStatus.expiresAt && (
                              <p className="text-slate-500 text-xs">
                                {sessionStatus.isValid ? '만료: ' : '만료일: '}
                                {formatDateTimeKST(sessionStatus.expiresAt)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-400 text-xs">정보 없음</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 오른쪽: 상세 설정 */}
                  <div className={`lg:col-span-8 flex flex-col gap-6 ${channel.kind === 'WHOLESALE' ? 'justify-center' : ''}`}>
                    {/* 도매방 전용: 취급 가격 범위 + 주문 마감시간 (Phase 1) */}
                    {channel.kind === 'WHOLESALE' && (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-base">💰</span>
                          <span className="text-sm font-semibold text-slate-700">취급 가격 범위 (수집 단계 필터)</span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                            도매방
                          </span>
                        </div>
                        {isEditMode ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-slate-600 mb-1">최소 취급가</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={minSourcingPrice}
                                  onChange={(e) => setMinSourcingPrice(e.target.value)}
                                  placeholder="없음"
                                  className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-600 mb-1">최대 취급가</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={maxSourcingPrice}
                                  onChange={(e) => setMaxSourcingPrice(e.target.value)}
                                  placeholder="없음"
                                  className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                                />
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              본문에서 추출한 가격이 이 범위 밖이면 수집에서 제외됩니다.
                              빈 값이면 해당 방향 무제한. 가격 추출 실패 시 안전하게 통과.
                            </p>
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">주문 마감시간 (선택)</label>
                              <input
                                type="text"
                                value={orderDeadline}
                                onChange={(e) => setOrderDeadline(e.target.value)}
                                placeholder="예: 오후 3시 / 14:00"
                                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">취급 범위</span>
                              <span className="font-medium text-slate-900">
                                {channel.minSourcingPrice != null
                                  ? Number(channel.minSourcingPrice).toLocaleString() + '원'
                                  : '하한 없음'}
                                {' ~ '}
                                {channel.maxSourcingPrice != null
                                  ? Number(channel.maxSourcingPrice).toLocaleString() + '원'
                                  : '상한 없음'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">주문 마감</span>
                              <span className="font-medium text-slate-900">
                                {channel.orderDeadline || '미설정'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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

                    {/* 발행 가격 tier (다단계 발행) — RETAIL 채널 전용 */}
                    {channel.kind === 'RETAIL' && (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-base">🏷️</span>
                          <span className="text-sm font-semibold text-slate-700">발행 가격 기준</span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                            다단계 발행
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-3">
                          이 밴드에 상품을 발행할 때 본문에 표기할 가격 기준입니다.
                          <br />
                          <b>소매가</b>: 마진을 적용한 판매가 + 쇼핑몰 주문 링크 (일반 소매밴드).
                          <br />
                          <b>도매가</b>: 소스 도매가 그대로(마진 0) + 쇼핑몰 링크 숨김 (가족도매방밴드).
                        </p>
                        {isEditMode ? (
                          <div className="flex gap-2">
                            {(['RETAIL', 'WHOLESALE'] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setPublishPriceTier(t)}
                                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                                  publishPriceTier === t
                                    ? 'bg-amber-500 text-white border-amber-500'
                                    : 'bg-white text-slate-600 border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                {t === 'RETAIL' ? '💰 소매가 (기본)' : '🏷️ 도매가 (가족도매방)'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-amber-100">
                            <span className="text-lg">{channel.publishPriceTier === 'WHOLESALE' ? '🏷️' : '💰'}</span>
                            <div>
                              <p className="font-medium text-slate-900">
                                {channel.publishPriceTier === 'WHOLESALE' ? '도매가 발행 (가족도매방)' : '소매가 발행 (기본)'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {channel.publishPriceTier === 'WHOLESALE'
                                  ? '소스 도매가 그대로 발행 · 쇼핑몰 링크 없음'
                                  : '마진 적용 판매가 + 쇼핑몰 주문 링크'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 밴드 발행 방식 (크로스포스트) — RETAIL 채널 전용 */}
                    {channel.kind === 'RETAIL' && (
                      <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-base">🔄</span>
                          <span className="text-sm font-semibold text-slate-700">밴드 발행 방식</span>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            소매 채널
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-3">
                          이 밴드에 상품을 발행할 때 사용할 방식입니다.
                          <br />
                          <b>작성 방식</b>: 기존과 동일. AI가 본문을 새로 작성해 발행.
                          <br />
                          <b>공유 방식</b>: 원본 도매글을 그대로 공유(영상·디자인 보존) + 판매가·쇼핑몰 링크만 편집.
                          원본글을 못 찾으면 자동으로 작성 방식으로 발행됩니다.
                        </p>
                        {isEditMode ? (
                          <div className="flex gap-2">
                            {(['COMPOSE', 'CROSSPOST'] as const).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setBandPublishMethod(m)}
                                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                                  bandPublishMethod === m
                                    ? 'bg-purple-500 text-white border-purple-500'
                                    : 'bg-white text-slate-600 border-purple-200 hover:bg-purple-100'
                                }`}
                              >
                                {m === 'COMPOSE' ? '✍️ 작성 방식 (기본)' : '🔄 공유 방식'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-purple-100">
                            <span className="text-lg">{channel.bandPublishMethod === 'CROSSPOST' ? '🔄' : '✍️'}</span>
                            <div>
                              <p className="font-medium text-slate-900">
                                {channel.bandPublishMethod === 'CROSSPOST' ? '공유 방식 (원본 보존)' : '작성 방식 (기본)'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {channel.bandPublishMethod === 'CROSSPOST'
                                  ? '원본 도매글을 "다른 밴드에 올리기"로 공유 · 영상/디자인 보존'
                                  : 'AI가 새 글을 작성하여 발행'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 발행글 푸터 이미지 (RETAIL 채널 전용) */}
                    {channel.kind === 'RETAIL' && (
                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-base">📎</span>
                          <span className="text-sm font-semibold text-slate-700">발행글 푸터 이미지</span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            소매 채널
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-3">
                          이 채널에 발행되는 모든 상품의 이미지 맨 마지막에 자동 첨부됩니다.
                          (밴드 이용 안내사항, 주문방법, 교환환불, 사업자 정보 등)
                        </p>
                        {channel.footerImageUrl ? (
                          <div className="space-y-3">
                            <div className="rounded-lg overflow-hidden bg-white border border-emerald-100">
                              <img
                                src={channel.footerImageUrl}
                                alt="발행글 푸터 이미지"
                                className="w-full max-h-80 object-contain"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="inline-flex items-center gap-2 px-3 py-2 bg-white text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-emerald-50 transition-colors">
                                <ImageIcon size={14} />
                                {isUploadingFooter ? '업로드 중...' : '변경'}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={isUploadingFooter}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) handleFooterImageUpload(f)
                                    e.target.value = ''
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={handleFooterImageDelete}
                                disabled={isUploadingFooter}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                                삭제
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-emerald-600 transition-colors disabled:opacity-50">
                            <ImageIcon size={16} />
                            {isUploadingFooter ? '업로드 중...' : '푸터 이미지 등록'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={isUploadingFooter}
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handleFooterImageUpload(f)
                                e.target.value = ''
                              }}
                            />
                          </label>
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
                          <ImageIcon size={16} className="text-slate-500" />
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
