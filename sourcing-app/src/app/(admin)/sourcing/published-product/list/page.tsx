'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trash2, Store, Package, CheckCircle } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'
import ThumbnailImage from '@/components/ui/ThumbnailImage'

interface Channel {
  id: number
  name: string
  coverUrl: string | null
  platform: string
}

interface PublishedChannel {
  publishId: number
  channelId: number | null
  channelName: string | null
  channelCoverUrl: string | null
  platform: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

interface PublishedProductGroup {
  productId: number
  product: {
    id: number
    name: string
    thumbnailUrl: string | null
    collectedProduct: {
      post: {
        channel: {
          id: number
          name: string
          platform: string
        }
      }
    } | null
  }
  publishedChannels: PublishedChannel[]
  latestPublishedAt: string | null
  createdAt: string
}

// 발행상품 이미지 URL 가져오기
const getPublishedProductThumbnailUrl = (productGroup: PublishedProductGroup): string | null => {
  return productGroup.product?.thumbnailUrl || null
}

export default function PublishedProductListPage() {
  const router = useRouter()
  const toast = useToast()
  const [products, setProducts] = useState<PublishedProductGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [query, setQuery] = useState('')

  // Filter states
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  // Selection states
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // Delete confirm modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadChannels()
  }, [])

  const loadChannels = async () => {
    try {
      const response = await fetch('/api/channel?kind=RETAIL&limit=100')
      const data = await response.json()
      if (data.success) {
        setChannels(data.data)
      }
    } catch (error) {
      console.error('채널 목록 조회 실패:', error)
    }
  }

  // 데이터 조회 함수 (page 파라미터를 받아서 사용)
  const fetchProducts = useCallback(async (page: number) => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      })

      if (query) params.append('search', query)
      if (selectedChannelId) params.append('channelId', selectedChannelId)

      const response = await fetch(`/api/published-product?${params.toString()}`)

      // HTTP 상태 코드 체크
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류' }))

        if (response.status === 401) {
          toast.error('로그인이 필요합니다.')
          console.error('인증 오류:', errorData)
          return
        }

        if (response.status === 500) {
          toast.error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
          console.error('서버 오류:', errorData)
          return
        }

        toast.error(errorData.error || '발행상품 목록을 불러오는데 실패했습니다.')
        console.error('API 오류:', errorData)
        return
      }

      const data = await response.json()

      if (data.success) {
        setProducts(data.data || [])
        setTotalItems(data.total || 0)
        setTotalPages(Math.ceil((data.total || 0) / itemsPerPage))
        setCurrentPage(page)

        // 데이터가 없어도 에러가 아니므로 조용히 처리 (토스트 없음)
        if (data.total === 0) {
          console.log('조회된 발행상품이 없습니다.')
        }
      } else {
        // success: false인 경우
        toast.error(data.error || '발행상품 목록을 불러오는데 실패했습니다.')
        console.error('API 응답 오류:', data)
      }
    } catch (error) {
      console.error('발행상품 목록 조회 실패:', error)
      toast.error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannelId, query, itemsPerPage])

  // 필터 변경 시 1페이지로 리셋하여 조회
  useEffect(() => {
    fetchProducts(1)
  }, [fetchProducts])

  // 새로고침용 함수
  const loadProducts = () => {
    fetchProducts(currentPage)
  }

  const handlePageChange = (page: number) => {
    fetchProducts(page)
  }

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([])
      setSelectAll(false)
    } else {
      // 모든 상품의 모든 publishId를 선택
      const allIds = products.flatMap((p) => p.publishedChannels.map((ch) => ch.publishId))
      setSelectedIds(allIds)
      setSelectAll(true)
    }
  }

  const handleToggleSelection = (productGroup: PublishedProductGroup) => {
    // 해당 상품의 모든 publishId
    const productPublishIds = productGroup.publishedChannels.map((ch) => ch.publishId)

    setSelectedIds((prev) => {
      // 이 상품의 publishId가 하나라도 선택되어 있는지 확인
      const isAnySelected = productPublishIds.some((id) => prev.includes(id))

      let newSelection: number[]
      if (isAnySelected) {
        // 선택 해제: 이 상품의 모든 publishId를 제거
        newSelection = prev.filter((id) => !productPublishIds.includes(id))
      } else {
        // 선택: 이 상품의 모든 publishId를 추가
        newSelection = [...prev, ...productPublishIds]
      }

      // 전체 선택 체크박스 상태 업데이트
      const allPublishIds = products.flatMap((p) => p.publishedChannels.map((ch) => ch.publishId))
      setSelectAll(newSelection.length === allPublishIds.length && allPublishIds.length > 0)

      return newSelection
    })
  }

  const isProductSelected = (productGroup: PublishedProductGroup) => {
    const productPublishIds = productGroup.publishedChannels.map((ch) => ch.publishId)
    return productPublishIds.every((id) => selectedIds.includes(id))
  }

  const handleDeleteProduct = (id: number) => {
    setDeleteTargetId(id)
    setShowDeleteConfirm(true)
  }

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      return
    }
    setDeleteTargetId(null)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    try {
      if (deleteTargetId !== null) {
        // 단일 삭제
        const response = await fetch(`/api/published-product?id=${deleteTargetId}`, {
          method: 'DELETE',
        })

        const data = await response.json().catch(() => ({ error: '알 수 없는 오류' }))

        if (!response.ok) {
          if (response.status === 404) {
            toast.error('발행상품을 찾을 수 없습니다.')
            console.error('발행상품 미존재:', data)
            return
          }

          // 주문/문의가 있어서 삭제 불가한 경우
          if (data.reason) {
            toast.error(data.reason)
          } else {
            toast.error(data.error || '발행상품 삭제에 실패했습니다.')
          }
          console.error('삭제 API 오류:', data)
          return
        }

        if (data.success) {
          toast.success('발행상품이 삭제되었습니다.')
          loadProducts()
        } else {
          // 주문/문의가 있어서 삭제 불가한 경우
          if (data.reason) {
            toast.error(data.reason)
          } else {
            toast.error(data.error || '발행상품 삭제에 실패했습니다.')
          }
          console.error('삭제 응답 오류:', data)
        }
      } else {
        // 일괄 삭제
        let successCount = 0
        let failCount = 0
        let blockedCount = 0

        for (const id of selectedIds) {
          try {
            const response = await fetch(`/api/published-product?id=${id}`, {
              method: 'DELETE',
            })

            const data = await response.json().catch(() => ({ error: '알 수 없는 오류' }))

            if (!response.ok) {
              // 주문/문의가 있어서 삭제 불가한 경우
              if (data.reason) {
                blockedCount++
              } else {
                failCount++
              }
              console.error(`발행상품 삭제 실패 (ID: ${id}):`, data)
              continue
            }

            if (data.success) {
              successCount++
            } else {
              if (data.reason) {
                blockedCount++
              } else {
                failCount++
              }
              console.error(`발행상품 삭제 실패 (ID: ${id}):`, data)
            }
          } catch (error) {
            failCount++
            console.error(`발행상품 삭제 오류 (ID: ${id}):`, error)
          }
        }

        setSelectedIds([])
        setSelectAll(false)
        loadProducts()

        if (successCount > 0 && failCount === 0 && blockedCount === 0) {
          toast.success(`${successCount}개의 발행상품이 삭제되었습니다.`)
        } else if (blockedCount > 0) {
          toast.warning(`${successCount}개 삭제 성공, ${blockedCount}개는 주문/문의가 있어 삭제가 불가능합니다.`)
        } else if (successCount > 0 && failCount > 0) {
          toast.warning(`${successCount}개 삭제 성공, ${failCount}개 삭제 실패`)
        } else {
          toast.error('발행상품 삭제에 실패했습니다.')
        }
      }
    } catch (error) {
      console.error('발행상품 삭제 실패:', error)
      toast.error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
    }
  }

  const getChannelBadges = (productGroup: PublishedProductGroup) => {
    if (!productGroup.publishedChannels || productGroup.publishedChannels.length === 0) {
      return <span className="text-gray-400 text-sm">발행 채널 없음</span>
    }

    return (
      <div className="flex flex-wrap gap-1.5">
        {productGroup.publishedChannels.map((channel) => (
          <span
            key={channel.publishId}
            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium"
            title={channel.channelName || '알 수 없음'}
          >
            <Store size={12} />
            {channel.channelName || '알 수 없음'}
          </span>
        ))}
      </div>
    )
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\. /g, '.').replace(/\.$/, '')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">발행상품 관리</h1>
          <p className="text-gray-600">
            소매 채널 또는 쇼핑몰에 발행된 상품 목록을 관리합니다. 발행 상태를 확인하고 재발행하거나 삭제할 수 있습니다.
          </p>
        </div>

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Package size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 발행상품</p>
                <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">발행 채널 수</p>
                <p className="text-2xl font-bold text-green-600">{channels.length}</p>
              </div>
            </div>
          </div>
          {/* 선택 삭제 카드 */}
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
              {/* 왼쪽: 채널 필터 */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
                <button
                  onClick={() => { setSelectedChannelId(''); setCurrentPage(1) }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    !selectedChannelId
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  전체
                </button>
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => { setSelectedChannelId(channel.id.toString()); setCurrentPage(1) }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      selectedChannelId === channel.id.toString()
                        ? 'bg-white shadow-sm text-purple-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {channel.coverUrl ? (
                      <img
                        src={channel.coverUrl}
                        alt={channel.name}
                        className="w-5 h-5 rounded object-cover"
                      />
                    ) : (
                      <Store size={14} />
                    )}
                    <span className="max-w-[100px] truncate">{channel.name}</span>
                  </button>
                ))}
              </div>

              {/* 오른쪽: 검색창 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  type="text"
                  placeholder="상품명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setQuery(e.target.value) }}
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
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[4%]">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 cursor-pointer"
                      disabled={products.length === 0}
                    />
                  </TableHead>
                  <TableHead className="w-[32%]">상품명</TableHead>
                  <TableHead className="w-[16%]">발행 채널</TableHead>
                  <TableHead className="w-[16%]">생성일시</TableHead>
                  <TableHead className="w-[16%]">수정일시</TableHead>
                  <TableHead className="w-[16%]">발행일시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 데이터 행 */}
                {products.map((productGroup) => (
                  <TableRow
                    key={productGroup.productId}
                    className="hover:bg-gray-50 cursor-pointer h-[72px]"
                    onClick={() => {
                      const firstPublishId = productGroup.publishedChannels[0]?.publishId
                      if (firstPublishId) {
                        router.push(`/published-product/${firstPublishId}`)
                      }
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isProductSelected(productGroup)}
                        onChange={() => handleToggleSelection(productGroup)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ThumbnailImage
                          src={getPublishedProductThumbnailUrl(productGroup)}
                          alt={productGroup.product?.name || '상품'}
                          size="md"
                          rounded="lg"
                          fallbackIcon="package"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900 text-base truncate">
                            {productGroup.product?.name || '상품 정보 없음'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getChannelBadges(productGroup)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 whitespace-nowrap">
                        {formatDateTime(productGroup.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 whitespace-nowrap">
                        {formatDateTime(productGroup.publishedChannels[0]?.updatedAt || null)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 whitespace-nowrap">
                        {formatDateTime(productGroup.latestPublishedAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
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
        title="발행상품 삭제"
        message={
          deleteTargetId !== null
            ? '이 발행상품을 삭제하시겠습니까? 외부 플랫폼에서는 수동으로 삭제해야 합니다.'
            : `선택한 ${selectedIds.length}개의 발행상품을 삭제하시겠습니까?`
        }
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
