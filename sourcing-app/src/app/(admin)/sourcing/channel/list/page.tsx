'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
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
  ArrowUp,
  ArrowDown,
  GripVertical,
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
  sortOrder: number
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

  // 순서 변경
  const [isReordering, setIsReordering] = useState(false)

  const handleMoveChannel = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= channels.length) return

    const newChannels = [...channels]
    const temp = newChannels[index]
    newChannels[index] = newChannels[targetIndex]
    newChannels[targetIndex] = temp
    setChannels(newChannels)

    // API 호출로 순서 저장
    setIsReordering(true)
    try {
      const orderedIds = newChannels.map(c => c.id)
      const res = await fetch('/api/channel/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error('순서 변경에 실패했습니다.')
        loadChannels()
      }
    } catch {
      toast.error('순서 변경에 실패했습니다.')
      loadChannels()
    } finally {
      setIsReordering(false)
    }
  }

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

  // 활성/비활성 토글 핸들러
  const handleToggleActive = async (channelId: number, currentActive: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/channel/${channelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })
      const data = await response.json()
      if (data.success) {
        setChannels((prev) =>
          prev.map((c) => (c.id === channelId ? { ...c, isActive: !currentActive } : c))
        )
        toast.success(`채널이 ${!currentActive ? '활성화' : '비활성화'}되었습니다.`)
      } else {
        toast.error(data.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('채널 상태 변경 실패:', error)
      toast.error('상태 변경 중 오류가 발생했습니다.')
    }
  }

  const getStatusToggle = (channelId: number, isActive: boolean) => {
    return (
      <button
        type="button"
        onClick={(e) => handleToggleActive(channelId, isActive, e)}
        className={`relative inline-flex items-center gap-2 cursor-pointer ${
          isActive ? 'text-green-700' : 'text-gray-500'
        }`}
        title={isActive ? '클릭하여 비활성화' : '클릭하여 활성화'}
      >
        <span
          className={`relative inline-block w-9 h-5 rounded-full transition-colors ${
            isActive ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
              isActive ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </span>
        <span className="text-xs font-medium">{isActive ? '활성' : '비활성'}</span>
      </button>
    )
  }

  // 통계
  const wholesaleCount = channels.filter((c) => c.kind === 'WHOLESALE').length
  const retailCount = channels.filter((c) => c.kind === 'RETAIL').length
  const activeCount = channels.filter((c) => c.isActive).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* 헤더 */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">채널 관리</h1>
          <p className="text-sm sm:text-base text-gray-600">
            소싱(도매) 채널과 판매(소매) 채널을 통합 관리합니다.
          </p>
        </div>

        {/* 통계 및 액션 카드 - PC: 6열, 모바일: 2열 */}
        {/* PC 버전 */}
        <div className="hidden md:grid md:grid-cols-6 gap-4 mb-6">
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
          {/* 도매밴드 카탈로그 카드 — 플랫폼 가등록 도매밴드에서 선택 연결 */}
          <Link
            href="/sourcing/channel/catalog"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-emerald-300 hover:bg-emerald-50 transition-colors cursor-pointer text-left block"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Boxes size={24} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">도매밴드</p>
                <p className="text-lg font-bold text-emerald-600">카탈로그에서 연결</p>
              </div>
            </div>
          </Link>
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

        {/* 모바일 버전 - 통계 카드만 2열 */}
        <div className="md:hidden grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Globe size={20} className="text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">전체</p>
                <p className="text-xl font-bold text-gray-900">{totalItems}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Boxes size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">도매</p>
                <p className="text-xl font-bold text-blue-600">{wholesaleCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <ShoppingCart size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">소매</p>
                <p className="text-xl font-bold text-green-600">{retailCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Store size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">활성</p>
                <p className="text-xl font-bold text-purple-600">{activeCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-20 md:mb-6">
          <div className="p-3 md:p-4 border-b border-gray-200">
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center justify-between">
              {/* 왼쪽: 도매/소매 필터 */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => { setSelectedKind('ALL'); setCurrentPage(1) }}
                  className={`px-2.5 md:px-3 py-2 min-h-[40px] md:min-h-[36px] rounded-md text-xs md:text-sm font-medium transition-colors ${
                    selectedKind === 'ALL'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => { setSelectedKind('WHOLESALE'); setCurrentPage(1) }}
                  className={`px-2.5 md:px-3 py-2 min-h-[40px] md:min-h-[36px] rounded-md text-xs md:text-sm font-medium transition-colors flex items-center gap-1 ${
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
                  className={`px-2.5 md:px-3 py-2 min-h-[40px] md:min-h-[36px] rounded-md text-xs md:text-sm font-medium transition-colors flex items-center gap-1 ${
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
              <div className="relative w-full md:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  type="text"
                  placeholder="채널명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full md:w-64 min-h-[44px] md:min-h-[40px]"
                />
              </div>
            </div>
          </div>

          {/* 테이블/카드 뷰 */}
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : channels.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              등록된 채널이 없습니다.
            </div>
          ) : (
            <>
              {/* 데스크탑: 테이블 뷰 */}
              <div className="hidden md:block">
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
                    {channels.map((channel, index) => (
                      <TableRow
                        key={channel.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/channel/detail/${channel.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(channel.id)}
                            onChange={() => handleToggleSelection(channel.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <div className="flex flex-col">
                              <button
                                onClick={() => handleMoveChannel(index, 'up')}
                                disabled={index === 0 || isReordering}
                                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => handleMoveChannel(index, 'down')}
                                disabled={index === channels.length - 1 || isReordering}
                                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <ArrowDown size={14} />
                              </button>
                            </div>
                            <span className="text-gray-400 text-xs ml-1">
                              {(currentPage - 1) * itemsPerPage + index + 1}
                            </span>
                          </div>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>{getStatusToggle(channel.id, channel.isActive)}</TableCell>
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
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 모바일: 카드 뷰 */}
              <div className="md:hidden divide-y divide-gray-100">
                {/* 모바일 전체 선택 */}
                <label className="px-4 py-3 bg-gray-50 flex items-center gap-3 cursor-pointer min-h-[48px]">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleToggleSelectAll}
                    className="w-5 h-5 cursor-pointer rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-600 flex-1">
                    {selectAll ? '전체 해제' : '전체 선택'}
                  </span>
                  {selectedIds.length > 0 && (
                    <span className="text-sm font-medium text-blue-600">
                      {selectedIds.length}개 선택
                    </span>
                  )}
                </label>
                {channels.map((channel, index) => (
                  <div
                    key={channel.id}
                    className={`p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                      selectedIds.includes(channel.id) ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => router.push(`/channel/detail/${channel.id}`)}
                  >
                    <div className="flex items-start gap-3">
                      {/* 체크박스 */}
                      <div
                        className="flex items-center justify-center min-w-[32px] min-h-[32px] -ml-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(channel.id)}
                          onChange={() => handleToggleSelection(channel.id)}
                          className="w-5 h-5 cursor-pointer rounded border-gray-300"
                        />
                      </div>

                      {/* 이미지 */}
                      {channel.coverUrl ? (
                        <img
                          src={channel.coverUrl}
                          alt={channel.name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <Store size={24} className="text-gray-400" />
                        </div>
                      )}

                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1" onClick={(e) => e.stopPropagation()}>
                          <span className="font-semibold text-gray-900 truncate">{channel.name}</span>
                          {getStatusToggle(channel.id, channel.isActive)}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getKindBadge(channel.kind)}
                          <span className="text-xs text-gray-500">{getPlatformLabel(channel.platform)}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDateTimeKST(channel.createdAt).split(' ')[0]}
                        </p>
                      </div>

                      {/* 순서 */}
                      <div className="flex flex-col items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleMoveChannel(index, 'up')}
                          disabled={index === 0 || isReordering}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <span className="text-xs text-gray-400">#{(currentPage - 1) * itemsPerPage + index + 1}</span>
                        <button
                          onClick={() => handleMoveChannel(index, 'down')}
                          disabled={index === channels.length - 1 || isReordering}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 md:px-4 py-3 border-t border-gray-200">
              <p className="text-xs md:text-sm text-gray-600">
                <span className="hidden md:inline">총 {totalItems}개 중 </span>
                {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalItems)}
                <span className="md:hidden">/{totalItems}</span>
                <span className="hidden md:inline">개</span>
              </p>
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 md:p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-xs md:text-sm text-gray-600 min-w-[60px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 md:p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 모바일 하단 플로팅 액션 버튼 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex gap-2 z-50">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-medium active:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          채널 등록
        </button>
        {selectedIds.length > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-lg font-medium active:bg-red-700 transition-colors"
          >
            <Trash2 size={20} />
            <span>{selectedIds.length}</span>
          </button>
        )}
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
