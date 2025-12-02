'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Store, Save, Trash2, ExternalLink, Edit, X } from 'lucide-react'
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
  formUrl: string | null
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
  const [formUrl, setFormUrl] = useState('')
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
        setFormUrl(ch.formUrl || '')
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
          formUrl: formUrl || null,
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
      setFormUrl(channel.formUrl || '')
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
      second: '2-digit',
      hour12: false,
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!channel) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => router.push('/channel')}>
              <ArrowLeft size={16} />
              목록으로
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">채널 상세</h1>
          </div>
          <div className="flex gap-2">
            {isEditMode ? (
              <>
                <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>
                  <X size={16} />
                  취소
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                  <Save size={16} />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={() => setIsEditMode(true)}>
                  <Edit size={16} />
                  수정
                </Button>
                <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={16} />
                  삭제
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
          {/* 기본 정보 (읽기 전용) */}
          <div className="lg:col-span-1 flex">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">채널 정보</h2>
                {isEditMode ? (
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                      isActive ? 'bg-purple-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                ) : (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    channel.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {channel.isActive ? '활성' : '비활성'}
                  </span>
                )}
              </div>

              {/* 커버 이미지 */}
              <div className="mb-6">
                {channel.coverUrl ? (
                  <img
                    src={channel.coverUrl}
                    alt={channel.name}
                    className="w-full aspect-video rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-full aspect-video rounded-lg bg-gray-200 flex items-center justify-center">
                    <Store size={48} className="text-gray-400" />
                  </div>
                )}
              </div>

              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">유형</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    channel.kind === 'WHOLESALE'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {KIND_LABELS[channel.kind] || channel.kind}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">플랫폼</label>
                  <p className="text-gray-900">{PLATFORM_LABELS[channel.platform] || channel.platform}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">채널키</label>
                  <p className="text-gray-900 font-mono text-sm break-all">{channel.channelKey}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">생성일</label>
                  <p className="text-gray-900 text-sm">{formatDateTimeKST(channel.createdAt)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">수정일</label>
                  <p className="text-gray-900 text-sm">{formatDateTimeKST(channel.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 수정 가능한 필드 */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* 기본 설정 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 설정</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">채널명 {isEditMode && '*'}</label>
                  {isEditMode ? (
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="채널명을 입력하세요"
                    />
                  ) : (
                    <p className="text-gray-900">{channel.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">커버 이미지 URL</label>
                  {isEditMode ? (
                    <Input
                      type="text"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  ) : (
                    <p className="text-gray-900 break-all">{channel.coverUrl || '-'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 주문폼 설정 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">주문폼 설정</h2>
                {channel.formUrl && !isEditMode && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.open(channel.formUrl!, '_blank')}
                  >
                    <ExternalLink size={14} />
                    주문폼 열기
                  </Button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">주문폼 URL</label>
                {isEditMode ? (
                  <>
                    <Input
                      type="text"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://..."
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      소매 채널의 경우 주문폼 URL을 입력하면 목록에서 바로 열 수 있습니다.
                    </p>
                  </>
                ) : (
                  <p className="text-gray-900 break-all">{channel.formUrl || '-'}</p>
                )}
              </div>
            </div>

            {/* 정산 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">정산 정보</h2>
              {isEditMode ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">예금주</label>
                      <Input
                        type="text"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        placeholder="예금주명"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">은행명</label>
                      <Input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="은행명"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">계좌번호</label>
                      <Input
                        type="text"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        placeholder="계좌번호"
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-500">
                    도매 채널의 경우 정산 정보를 입력하면 정산 관리에서 사용할 수 있습니다.
                  </p>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">예금주</label>
                    <p className="text-gray-900">{channel.accountHolder || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">은행명</label>
                    <p className="text-gray-900">{channel.bankName || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">계좌번호</label>
                    <p className="text-gray-900">{channel.bankAccount || '-'}</p>
                  </div>
                </div>
              )}
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
