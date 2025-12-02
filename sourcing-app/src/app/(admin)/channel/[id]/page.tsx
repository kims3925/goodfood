'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Store, Save, Trash2, Edit, X, Calendar, Link2, CreditCard, Building2, User, Power, Globe, Tag } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

interface Channel {
  id: number
  userId: number
  apiConfigId: number | null
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
}

const PLATFORM_LABELS: { [key: string]: string } = {
  BAND: '밴드',
  NAVER_CAFE: '네이버 카페',
  ALIEXPRESS: '알리익스프레스',
  SMARTSTORE: '스마트스토어',
  COUPANG: '쿠팡',
  SHOP: '쇼핑몰',
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

  // 수정 가능한 필드
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [coverUrl, setCoverUrl] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankName, setBankName] = useState('')

  useEffect(() => {
    loadChannel()
  }, [id])

  const loadChannel = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/channel/${id}`)
      const data = await response.json()

      if (data.success) {
        const ch = data.data
        setChannel(ch)
        setName(ch.name || '')
        setIsActive(ch.isActive)
        setCoverUrl(ch.coverUrl || '')
        setAccountHolder(ch.accountHolder || '')
        setBankAccount(ch.bankAccount || '')
        setBankName(ch.bankName || '')
      } else {
        toast.error('채널을 불러오는데 실패했습니다.')
        router.push('/channel')
      }
    } catch (error) {
      console.error('채널 조회 실패:', error)
      toast.error('채널을 불러오는데 실패했습니다.')
      router.push('/channel')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('채널명을 입력해주세요.')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/channel/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          isActive,
          coverUrl: coverUrl || null,
          accountHolder: accountHolder || null,
          bankAccount: bankAccount || null,
          bankName: bankName || null,
        }),
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

            {/* 정산 정보 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CreditCard size={18} className="text-emerald-600" />
                  </div>
                  <span className="font-semibold text-slate-900">정산 정보</span>
                  {channel.kind === 'WHOLESALE' && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      도매 전용
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6">
                {isEditMode ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          <span className="flex items-center gap-1.5">
                            <User size={14} className="text-slate-400" />
                            예금주
                          </span>
                        </label>
                        <Input
                          type="text"
                          value={accountHolder}
                          onChange={(e) => setAccountHolder(e.target.value)}
                          placeholder="홍길동"
                          className="!rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          <span className="flex items-center gap-1.5">
                            <Building2 size={14} className="text-slate-400" />
                            은행명
                          </span>
                        </label>
                        <Input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="국민은행"
                          className="!rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          <span className="flex items-center gap-1.5">
                            <CreditCard size={14} className="text-slate-400" />
                            계좌번호
                          </span>
                        </label>
                        <Input
                          type="text"
                          value={bankAccount}
                          onChange={(e) => setBankAccount(e.target.value)}
                          placeholder="123-456-789012"
                          className="!rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="text-amber-500 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                      </div>
                      <p className="text-sm text-amber-800">
                        도매 채널의 경우 정산 정보를 입력하면 정산 관리에서 사용할 수 있습니다.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
                        <User size={18} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">예금주</p>
                        <p className="font-medium text-slate-900">{channel.accountHolder || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
                        <Building2 size={18} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">은행명</p>
                        <p className="font-medium text-slate-900">{channel.bankName || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
                        <CreditCard size={18} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">계좌번호</p>
                        <p className="font-medium text-slate-900 font-mono">{channel.bankAccount || '-'}</p>
                      </div>
                    </div>
                  </div>
                )}
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
