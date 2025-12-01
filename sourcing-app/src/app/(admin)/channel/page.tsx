'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Search, RefreshCw, Trash2, Edit, Store, ExternalLink } from 'lucide-react'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ChannelFormModal from '@/components/channel/ChannelFormModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'
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

const KIND_OPTIONS = [
  { value: '', label: '전체 유형' },
  { value: 'WHOLESALE', label: '도매(소싱)' },
  { value: 'RETAIL', label: '소매(판매)' },
]

const PLATFORM_OPTIONS = [
  { value: '', label: '전체 플랫폼' },
  { value: 'BAND', label: '밴드' },
  { value: 'NAVER_CAFE', label: '네이버 카페' },
  { value: 'ALIEXPRESS', label: '알리익스프레스' },
  { value: 'SMARTSTORE', label: '스마트스토어' },
  { value: 'COUPANG', label: '쿠팡' },
  { value: 'SHOP', label: '쇼핑몰' },
  { value: 'CUSTOM', label: '커스텀' },
]

export default function ChannelListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()

  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter states
  const [selectedKind, setSelectedKind] = useState<string>(searchParams.get('kind') || '')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  // Selection states
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // Modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)

  useEffect(() => {
    loadChannels()
  }, [currentPage, selectedKind, selectedPlatform])

  const loadChannels = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })

      if (searchTerm) params.append('search', searchTerm)
      if (selectedKind) params.append('kind', selectedKind)
      if (selectedPlatform) params.append('platform', selectedPlatform)

      const response = await fetch(`/api/channel?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setChannels(data.data)
        setTotalItems(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)
      } else {
        toast.error('채널 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('채널 목록 조회 실패:', error)
      toast.error('채널 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    loadChannels()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

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

  const handleDeleteChannel = (id: number) => {
    setDeleteTargetId(id)
    setShowDeleteConfirm(true)
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
      WHOLESALE: { label: '도매(소싱)', color: 'bg-blue-100 text-blue-800' },
      RETAIL: { label: '소매(판매)', color: 'bg-green-100 text-green-800' },
    }
    const kindInfo = kindMap[kind] || { label: kind, color: 'bg-gray-100 text-gray-800' }
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
      SHOP: '쇼핑몰',
      CUSTOM: '커스텀',
    }
    return platformMap[platform] || platform
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        활성
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        비활성
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">채널 관리</h1>
          <p className="text-gray-600">
            소싱(도매) 채널과 판매(소매) 채널을 통합 관리합니다. 밴드, 쇼핑몰 등 다양한 플랫폼의 채널을 등록하고 관리할 수 있습니다.
          </p>
        </div>

        {/* 탭 필터 */}
        <div className="mb-6 flex gap-2">
          <Button
            variant={selectedKind === '' ? 'primary' : 'secondary'}
            onClick={() => {
              setSelectedKind('')
              setCurrentPage(1)
            }}
          >
            전체
          </Button>
          <Button
            variant={selectedKind === 'WHOLESALE' ? 'primary' : 'secondary'}
            onClick={() => {
              setSelectedKind('WHOLESALE')
              setCurrentPage(1)
            }}
          >
            도매(소싱) 채널
          </Button>
          <Button
            variant={selectedKind === 'RETAIL' ? 'primary' : 'secondary'}
            onClick={() => {
              setSelectedKind('RETAIL')
              setCurrentPage(1)
            }}
          >
            소매(판매) 채널
          </Button>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <Input
                    type="text"
                    placeholder="채널명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <select
                  value={selectedPlatform}
                  onChange={(e) => {
                    setSelectedPlatform(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={loadChannels}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  새로고침
                </Button>
                <Button variant="primary" onClick={() => setShowAddModal(true)}>
                  <Plus size={16} />
                  채널 등록
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0}
                >
                  <Trash2 size={16} />
                  선택 삭제 ({selectedIds.length})
                </Button>
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
                  <TableHead className="w-[25%]">채널명</TableHead>
                  <TableHead className="w-[12%]">유형</TableHead>
                  <TableHead className="w-[12%]">플랫폼</TableHead>
                  <TableHead className="w-[15%]">채널키</TableHead>
                  <TableHead className="w-[10%]">상태</TableHead>
                  <TableHead className="w-[12%]">생성일</TableHead>
                  <TableHead className="w-[10%]">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.length === 0 ? (
                  <TableEmpty message="등록된 채널이 없습니다." />
                ) : (
                  channels.map((channel) => (
                    <TableRow
                      key={channel.id}
                      className="hover:bg-gray-50"
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
                      <TableCell>{getKindBadge(channel.kind)}</TableCell>
                      <TableCell>
                        <span className="text-gray-600">{getPlatformLabel(channel.platform)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500 text-sm font-mono truncate block max-w-[150px]">
                          {channel.channelKey}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(channel.isActive)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {new Date(channel.createdAt).toLocaleDateString('ko-KR', {
                            year: '2-digit',
                            month: '2-digit',
                            day: '2-digit',
                          }).replace(/\. /g, '.').replace(/\.$/, '')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {channel.formUrl && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => window.open(channel.formUrl!, '_blank')}
                              title="주문폼 열기"
                            >
                              <ExternalLink size={14} />
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingChannel(channel)
                              setShowEditModal(true)
                            }}
                            title="수정"
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteChannel(channel.id)}
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
          />
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

      {/* 채널 등록/수정 모달 */}
      <ChannelFormModal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false)
          setShowEditModal(false)
          setEditingChannel(null)
        }}
        onSuccess={loadChannels}
        channel={editingChannel}
      />
    </div>
  )
}
