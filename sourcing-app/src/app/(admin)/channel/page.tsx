'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Search,
  Trash2,
  Store,
  Plus,
  ChevronLeft,
  ChevronRight,
  Globe,
  ShoppingCart,
  Boxes,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ChannelFormModal from '@/components/channel/ChannelFormModal'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

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
}

type ChannelKind = 'WHOLESALE' | 'RETAIL'

function ChannelListContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()

  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter states
  const [selectedKind, setSelectedKind] = useState<ChannelKind | 'ALL'>(
    (searchParams.get('kind') as ChannelKind) || 'ALL'
  )

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  // Selection states
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // Modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  // UTC+9 시간 포맷 함수 (hydration 안전)
  const formatDateTimeKST = (dateString: string) => {
    const date = new Date(dateString)
    // UTC 시간에 9시간(KST)을 더함
    const kstOffset = 9 * 60 * 60 * 1000
    const kstDate = new Date(date.getTime() + kstOffset)
    const yyyy = kstDate.getUTCFullYear()
    const mm = String(kstDate.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(kstDate.getUTCDate()).padStart(2, '0')
    const hh = String(kstDate.getUTCHours()).padStart(2, '0')
    const mi = String(kstDate.getUTCMinutes()).padStart(2, '0')
    const ss = String(kstDate.getUTCSeconds()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  }

  const loadChannels = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })

      if (searchTerm) params.append('search', searchTerm)
      if (selectedKind !== 'ALL') params.append('kind', selectedKind)

      const response = await fetch(`/api/channel?${params.toString()}`)

      if (!response.ok) {
        console.error('API 응답 실패:', response.status, response.statusText)
        toast.error('채널 목록을 불러오는데 실패했습니다.')
        return
      }

      const data = await response.json()

      if (data.success) {
        setChannels(data.data || [])
        setTotalItems(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)
      } else {
        console.error('API 응답 실패:', data.error)
        toast.error(data.error || '채널 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('채널 목록 조회 실패:', error)
      toast.error('채널 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, searchTerm, selectedKind, toast])

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([])
      setSelectAll(false)
    } else {
      const allIds = channels.map((c) => c.id)
      setSelectedIds(allIds)
      setSelectAll(true)
    }
  }

  const handleToggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((cid) => cid !== id)
        : [...prev, id]
      setSelectAll(newSelection.length === channels.length)
      return newSelection
    })
  }

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return
    setDeleteTargetId(null)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    try {
      if (deleteTargetId !== null) {
        const response = await fetch(`/api/channel?id=${deleteTargetId}`, {
          method: 'DELETE',
        })
        const data = await response.json()

        if (data.success) {
          toast.success('채널이 삭제되었습니다.')
          loadChannels()
        } else {
          toast.error('채널 삭제에 실패했습니다.')
        }
      } else {
        let successCount = 0
        for (const id of selectedIds) {
          try {
            const response = await fetch(`/api/channel?id=${id}`, {
              method: 'DELETE',
            })
            const data = await response.json()
            if (data.success) successCount++
          } catch (error) {
            console.error(`채널 삭제 실패 (ID: ${id}):`, error)
          }
        }

        setSelectedIds([])
        setSelectAll(false)
        loadChannels()

        if (successCount > 0) {
          toast.success(`${successCount}개의 채널이 삭제되었습니다.`)
        } else {
          toast.error('채널 삭제에 실패했습니다.')
        }
      }
    } catch (error) {
      console.error('채널 삭제 실패:', error)
      toast.error('채널 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
    }
  }

  const getKindBadge = (kind: string) => {
    const kindMap: { [key: string]: { label: string; color: string } } = {
      WHOLESALE: { label: '도매(소싱)', color: 'bg-blue-100 text-blue-700' },
      RETAIL: { label: '소매(판매)', color: 'bg-green-100 text-green-700' },
    }
    const kindInfo = kindMap[kind] || { label: kind, color: 'bg-gray-100 text-gray-700' }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${kindInfo.color}`}>
        {kindInfo.label}
      </span>
    )
  }

  const getPlatformLabel = (platform: string) => {
    const platformMap: { [key: string]: string } = {
      BAND: '밴드',
      NAVER_CAFE: '네이버 카페',
      ALIEXPRESS: '알리익스프레스',
      SMARTSTORE: '스마트스토어',
      COUPANG: '쿠팡',
      CUSTOM: '커스텀',
    }
    return platformMap[platform] || platform
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        활성
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        비활성
      </span>
    )
  }

  // 통계
  const wholesaleCount = channels.filter((c) => c.kind === 'WHOLESALE').length
  const retailCount = channels.filter((c) => c.kind === 'RETAIL').length
  const activeCount = channels.filter((c) => c.isActive).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">채널 관리</h1>
          <p className="text-gray-600">
            소싱(도매) 채널과 판매(소매) 채널을 통합 관리합니다.
          </p>
        </div>

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Globe size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 채널</p>
                <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Boxes size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">도매(소싱)</p>
                <p className="text-2xl font-bold text-blue-600">{wholesaleCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <ShoppingCart size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">소매(판매)</p>
                <p className="text-2xl font-bold text-green-600">{retailCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Store size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">활성 채널</p>
                <p className="text-2xl font-bold text-purple-600">{activeCount}</p>
              </div>
            </div>
          </div>
          {/* 채널 등록 카드 */}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Plus size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">채널</p>
                <p className="text-lg font-bold text-blue-600">등록하기</p>
              </div>
            </div>
          </button>
          {/* 채널 삭제 카드 */}
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.length === 0}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left transition-colors ${
              selectedIds.length > 0
                ? 'hover:border-red-300 hover:bg-red-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${selectedIds.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Trash2 size={24} className={selectedIds.length > 0 ? 'text-red-600' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-sm text-gray-500">선택 삭제</p>
                <p className={`text-lg font-bold ${selectedIds.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {selectedIds.length}개 선택됨
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* 왼쪽: 도매/소매 필터 */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => { setSelectedKind('ALL'); setCurrentPage(1) }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    selectedKind === 'ALL'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => { setSelectedKind('WHOLESALE'); setCurrentPage(1) }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                    selectedKind === 'WHOLESALE'
                      ? 'bg-white shadow-sm text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Boxes size={14} />
                  도매
                </button>
                <button
                  onClick={() => { setSelectedKind('RETAIL'); setCurrentPage(1) }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                    selectedKind === 'RETAIL'
                      ? 'bg-white shadow-sm text-green-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ShoppingCart size={14} />
                  소매
                </button>
              </div>

              {/* 검색창 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  type="text"
                  placeholder="채널명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>

          {/* 테이블 */}
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[4%]">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-[5%]">순서</TableHead>
                  <TableHead className="w-[26%]">채널명</TableHead>
                  <TableHead className="w-[12%]">플랫폼</TableHead>
                  <TableHead className="w-[12%]">유형</TableHead>
                  <TableHead className="w-[8%]">상태</TableHead>
                  <TableHead className="w-[16%]">생성일</TableHead>
                  <TableHead className="w-[16%]">수정일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.length === 0 ? (
                  <TableEmpty message="등록된 채널이 없습니다." />
                ) : (
                  channels.map((channel, index) => (
                    <TableRow
                      key={channel.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/channel/${channel.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(channel.id)}
                          onChange={() => handleToggleSelection(channel.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500 text-sm">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {channel.coverUrl ? (
                            <img
                              src={channel.coverUrl}
                              alt={channel.name}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <Store size={20} className="text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-900">{channel.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">{getPlatformLabel(channel.platform)}</span>
                      </TableCell>
                      <TableCell>{getKindBadge(channel.kind)}</TableCell>
                      <TableCell>{getStatusBadge(channel.isActive)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatDateTimeKST(channel.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatDateTimeKST(channel.updatedAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                총 {totalItems}개 중 {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalItems)}개
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setDeleteTargetId(null)
        }}
        onConfirm={confirmDelete}
        title="채널 삭제"
        message={
          deleteTargetId !== null
            ? '이 채널을 삭제하시겠습니까? 관련된 게시물과 발행 상품 데이터도 함께 삭제됩니다.'
            : `선택한 ${selectedIds.length}개의 채널을 삭제하시겠습니까?`
        }
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* 채널 등록 모달 */}
      <ChannelFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadChannels}
        channel={null}
      />
    </div>
  )
}

export default function ChannelListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loading /></div>}>
      <ChannelListContent />
    </Suspense>
  )
}
