'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, RefreshCw, Package, Trash2, Filter, X, Store } from 'lucide-react'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'
import Image from 'next/image'

// 밴드 로고 아이콘
const BandIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  </svg>
)

interface Channel {
  id: number
  name: string
  coverUrl: string | null
  platform: string
}

type SourcePlatform = 'BAND' | 'ALIEXPRESS' | 'NAVER_CAFE' | 'SMARTSTORE' | 'COUPANG' | 'SHOP' | 'CUSTOM'

const PLATFORM_LABELS: Record<SourcePlatform, string> = {
  BAND: 'Band',
  ALIEXPRESS: 'Ali',
  NAVER_CAFE: '네이버카페',
  SMARTSTORE: '스마트스토어',
  COUPANG: '쿠팡',
  SHOP: '쇼핑몰',
  CUSTOM: '기타',
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
  publishedChannels: Array<{
    publishId: number
    channelId: number | null
    channelName: string | null
    channelCoverUrl: string | null
    platform: string | null
    publishedAt: string | null
    createdAt: string
    updatedAt: string
  }>
  latestPublishedAt: string | null
  createdAt: string
}

export default function PublishedProductListPage() {
  const router = useRouter()
  const toast = useToast()
  const [products, setProducts] = useState<PublishedProductGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [query, setQuery] = useState('')

  // Filter states
  const [showFilters, setShowFilters] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [availablePlatforms, setAvailablePlatforms] = useState<SourcePlatform[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [selectedSourcePlatform, setSelectedSourcePlatform] = useState<string>('')
  const [onlyShoppingMall, setOnlyShoppingMall] = useState<boolean>(false)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

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
    loadAvailablePlatforms()
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

  const loadAvailablePlatforms = async () => {
    try {
      const response = await fetch('/api/channel?kind=WHOLESALE&limit=100')
      const data = await response.json()
      if (data.success && data.data) {
        const platforms = [...new Set(data.data.map((ch: { platform: string }) => ch.platform))] as SourcePlatform[]
        setAvailablePlatforms(platforms)
      }
    } catch (error) {
      console.error('소싱처 플랫폼 목록 조회 실패:', error)
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
      if (selectedSourcePlatform) params.append('sourcePlatform', selectedSourcePlatform)
      if (onlyShoppingMall) params.append('onlyShoppingMall', 'true')
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

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
  }, [selectedChannelId, selectedSourcePlatform, onlyShoppingMall, startDate, endDate, query, itemsPerPage])

  // 필터 변경 시 1페이지로 리셋하여 조회
  useEffect(() => {
    fetchProducts(1)
  }, [fetchProducts])

  // 새로고침용 함수
  const loadProducts = () => {
    fetchProducts(currentPage)
  }

  const handleClearFilters = () => {
    setSelectedChannelId('')
    setSelectedSourcePlatform('')
    setOnlyShoppingMall(false)
    setStartDate('')
    setEndDate('')
    setSearchTerm('')
    setQuery('')
  }

  const hasActiveFilters = selectedChannelId || selectedSourcePlatform || onlyShoppingMall || startDate || endDate || Boolean(query)

  const handleSearch = () => {
    if (query !== searchTerm) {
      setQuery(searchTerm)
    } else {
      fetchProducts(1)
    }
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

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류' }))

          if (response.status === 404) {
            toast.error('발행상품을 찾을 수 없습니다.')
            console.error('발행상품 미존재:', errorData)
            return
          }

          toast.error(errorData.error || '발행상품 삭제에 실패했습니다.')
          console.error('삭제 API 오류:', errorData)
          return
        }

        const data = await response.json()

        if (data.success) {
          toast.success('발행상품이 삭제되었습니다.')
          loadProducts()
        } else {
          toast.error(data.error || '발행상품 삭제에 실패했습니다.')
          console.error('삭제 응답 오류:', data)
        }
      } else {
        // 일괄 삭제
        let successCount = 0
        let failCount = 0

        for (const id of selectedIds) {
          try {
            const response = await fetch(`/api/published-product?id=${id}`, {
              method: 'DELETE',
            })

            if (!response.ok) {
              failCount++
              console.error(`발행상품 삭제 실패 (ID: ${id}), 상태 코드:`, response.status)
              continue
            }

            const data = await response.json()
            if (data.success) {
              successCount++
            } else {
              failCount++
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

        if (successCount > 0 && failCount === 0) {
          toast.success(`${successCount}개의 발행상품이 삭제되었습니다.`)
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
        {productGroup.publishedChannels.map((channel) => {
          const isShoppingMall = !channel.channelId

          if (isShoppingMall) {
            return (
              <span
                key={channel.publishId}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
              >
                <Store size={12} />
                쇼핑몰
              </span>
            )
          }

          return (
            <span
              key={channel.publishId}
              className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium"
              title={channel.channelName || '알 수 없음'}
            >
              <Store size={12} />
              {channel.channelName || '알 수 없음'}
            </span>
          )
        })}
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

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            {/* 첫 번째 줄: 검색창 + 액션 버튼 */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 items-center">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <Input
                    type="text"
                    placeholder="상품명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
                <Button
                  variant={showFilters || hasActiveFilters ? 'primary' : 'secondary'}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={16} />
                  필터
                  {hasActiveFilters && (
                    <span className="ml-1 bg-white text-purple-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                      !
                    </span>
                  )}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={loadProducts}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  새로고침
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

            {/* 두 번째 줄: 플랫폼 필터 버튼 */}
            {availablePlatforms.length > 0 && (
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => {
                    setSelectedSourcePlatform('')
                    setOnlyShoppingMall(false)
                  }}
                  className={`
                    inline-flex items-center justify-center min-w-[52px] px-3 py-1.5 text-sm font-medium rounded-md border transition-colors
                    ${!selectedSourcePlatform && !onlyShoppingMall
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  전체
                </button>
                {availablePlatforms.map((platform) => {
                  const isSelected = selectedSourcePlatform === platform
                  const isBand = platform === 'BAND'

                  return (
                    <button
                      key={platform}
                      onClick={() => {
                        setSelectedSourcePlatform(platform)
                        setOnlyShoppingMall(false)
                      }}
                      title={`소싱처: ${PLATFORM_LABELS[platform]}`}
                      className={`
                        inline-flex items-center justify-center gap-1.5 min-w-[52px] px-3 py-1.5 text-sm font-medium rounded-md border transition-colors
                        ${isBand
                          ? isSelected
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                          : isSelected
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      {isBand ? <BandIcon size={14} /> : null}
                      {PLATFORM_LABELS[platform]}
                    </button>
                  )
                })}
                {/* 쇼핑몰 필터 버튼 */}
                <button
                  onClick={() => {
                    setOnlyShoppingMall(!onlyShoppingMall)
                    if (!onlyShoppingMall) {
                      setSelectedSourcePlatform('')
                    }
                  }}
                  title="쇼핑몰에 발행된 상품만 표시"
                  className={`
                    inline-flex items-center justify-center gap-1.5 min-w-[72px] px-3 py-1.5 text-sm font-medium rounded-md border transition-colors
                    ${onlyShoppingMall
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                    }
                  `}
                >
                  <Store size={14} />
                  쇼핑몰
                </button>
              </div>
            )}
          </div>

          {/* 필터 영역 */}
          {showFilters && (
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-4 items-end">
                {/* 채널 필터 */}
                <div className="w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-1">발행 채널</label>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="">전체 채널</option>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id.toString()}>
                        {channel.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 날짜 필터 */}
                <div className="w-40">
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  />
                </div>

                <div className="w-40">
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  />
                </div>

                {/* 필터 초기화 버튼 */}
                {hasActiveFilters && (
                  <Button variant="secondary" onClick={handleClearFilters}>
                    <X size={16} />
                    필터 초기화
                  </Button>
                )}
              </div>

              {/* 활성 필터 태그 */}
              {hasActiveFilters && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedChannelId && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      채널: {channels.find(c => c.id.toString() === selectedChannelId)?.name}
                      <button
                        onClick={() => setSelectedChannelId('')}
                        className="hover:text-purple-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  {onlyShoppingMall && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      쇼핑몰만 표시
                      <button
                        onClick={() => setOnlyShoppingMall(false)}
                        className="hover:text-blue-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  {startDate && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      시작일: {startDate}
                      <button
                        onClick={() => setStartDate('')}
                        className="hover:text-purple-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  {endDate && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      종료일: {endDate}
                      <button
                        onClick={() => setEndDate('')}
                        className="hover:text-purple-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

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
                    onClick={() => router.push(`/product/${productGroup.productId}`)}
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
                        {productGroup.product?.thumbnailUrl ? (
                          <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <Image
                              src={productGroup.product.thumbnailUrl}
                              alt={productGroup.product.name}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <Package size={24} className="text-gray-400" />
                          </div>
                        )}
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
