'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Store, Save, Trash2, Edit, X, Calendar, Link2, CreditCard, Building2, User, Power, Globe, Tag, Palette, Mail, Phone, Truck, ShoppingCart, Image, FileText } from 'lucide-react'
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
  // 서브도메인 멀티채널 쇼핑몰 필드
  subdomain: string | null
  displayName: string | null
  freeShippingAmount: number | null
  defaultShippingFee: number | null
  contactPhone: string | null
  contactEmail: string | null
  theme: ChannelTheme | null
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

  // 서브도메인 쇼핑몰 필드
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
        // 서브도메인 쇼핑몰 필드
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
  }, [loadChannel, loadShops])

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
      // 서브도메인 쇼핑몰 필드 복원
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
          {/* 왼쪽: 채널 프로필 */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 space-y-6">
              {/* 프로필 카드 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* 커버 이미지 */}
                <div className="relative">
                  {channel.coverUrl ? (
                    <img
                      src={channel.coverUrl}
                      alt={channel.name}
                      className="w-full aspect-video object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                      <Store size={64} className="text-slate-400" />
                    </div>
                  )}
                  {/* 상태 오버레이 */}
                  <div className="absolute top-3 right-3">
                    {isEditMode ? (
                      <button
                        type="button"
                        onClick={() => setIsActive(!isActive)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-lg ${
                          isActive
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-slate-500 text-white hover:bg-slate-600'
                        }`}
                      >
                        <Power size={14} />
                        {isActive ? '활성' : '비활성'}
                      </button>
                    ) : (
                      getStatusBadge(channel.isActive)
                    )}
                  </div>
                </div>

                {/* 채널 기본 정보 */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
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

                  {/* 메타 정보 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center justify-center w-8 h-8 bg-slate-100 rounded-lg">
                        <Globe size={16} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">플랫폼</p>
                        <p className="font-medium text-slate-900">{PLATFORM_LABELS[channel.platform] || channel.platform}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center justify-center w-8 h-8 bg-slate-100 rounded-lg">
                        <Link2 size={16} className="text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-500 text-xs">채널키</p>
                        <p className="font-mono text-xs text-slate-700 truncate">{channel.channelKey}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 날짜 정보 */}
                <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100">
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
            </div>
          </div>

          {/* 오른쪽: 상세 설정 */}
          <div className="lg:col-span-8 space-y-6">
            {/* 기본 설정 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Tag size={18} className="text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-900">기본 설정</span>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* 커버 이미지 URL */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    커버 이미지 URL
                  </label>
                  {isEditMode ? (
                    <Input
                      type="text"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="!rounded-xl"
                    />
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-slate-700 text-sm break-all font-mono">
                        {channel.coverUrl || '(설정되지 않음)'}
                      </p>
                    </div>
                  )}
                  {isEditMode && (
                    <p className="mt-2 text-xs text-slate-500">
                      채널 목록과 상세 페이지에 표시되는 대표 이미지입니다.
                    </p>
                  )}
                </div>

              </div>
            </div>

            {/* Shop 연결 카드 (소매 채널만) */}
            {channel.kind === 'RETAIL' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Store size={18} className="text-indigo-600" />
                    </div>
                    <span className="font-semibold text-slate-900">Shop 연결</span>
                    <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                      소매 채널
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  {isEditMode ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          연결할 Shop 선택
                        </label>
                        <select
                          value={selectedShopId || ''}
                          onChange={(e) => setSelectedShopId(e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                        >
                          <option value="">Shop을 선택하세요</option>
                          {shops.map((shop) => (
                            <option key={shop.id} value={shop.id}>
                              {shop.name} ({shop.subdomain}.lvh.me)
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-slate-500">
                          이 채널에서 발행할 때 연결될 Shop을 선택합니다. 발행 시 이 Shop의 장바구니 링크가 댓글로 추가됩니다.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
                        <Store size={18} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">연결된 Shop</p>
                        {channel.shop ? (
                          <div>
                            <p className="font-medium text-slate-900">{channel.shop.name}</p>
                            <p className="text-sm text-indigo-600 font-mono">{channel.shop.subdomain}.lvh.me</p>
                          </div>
                        ) : (
                          <p className="text-slate-400">연결된 Shop이 없습니다</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
