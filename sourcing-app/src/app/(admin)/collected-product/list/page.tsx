'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, RefreshCw, Package, Trash2, Filter, X, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import Button from '@/components/ui/Button'
import Modal, { ModalFooter } from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'
import ThumbnailImage from '@/components/ui/ThumbnailImage'

interface Channel {
  id: number
  name: string
  coverUrl: string | null
  platform?: string
}

type SourcePlatform = 'BAND' | 'ALIEXPRESS' | 'NAVER_CAFE' | 'SMARTSTORE' | 'COUPANG' | 'CUSTOM'

const PLATFORM_LABELS: Record<SourcePlatform, string> = {
  BAND: 'Band',
  ALIEXPRESS: 'Ali',
  NAVER_CAFE: '네이버카페',
  SMARTSTORE: '스마트스토어',
  COUPANG: '쿠팡',
  CUSTOM: '기타',
}

// 밴드 로고 아이콘
const BandIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  </svg>
)

interface AvailablePost {
  id: number
  title: string
  content: string
  author: string | null
  channel: {
    id: number
    name: string
    channelKey: string
    coverUrl: string | null
  }
  images: Array<{
    id: number
    url: string
  }>
}

interface ProductDraft {
  name: string
  description: string
  categoryId: string | null
  price: number | null
  currency: string
  options: Array<{
    groupName: string
    values: string[]
  }>
  variants: Array<{
    sku: string | null
    optionSummary: string | null
    price: number | null
    stock: number
  }>
}

interface CollectedProduct {
  id: number
  userId: number
  postId: number
  name: string | null
  description: string | null
  currency: string
  price: number | null
  wholesalePrice: number | null
  rawMetadata: any
  createdAt: string
  updatedAt: string
  post: {
    id: number
    title: string
    channel: {
      id: number
      name: string
      coverUrl: string | null
    }
    images: Array<{
      id: number
      url: string
      sortOrder: number
    }>
  }
  products: Array<{
    id: number
    name: string
    status: string
  }>
}

export default function CollectedProductListPage() {
  const router = useRouter()
  const toast = useToast()
  const [products, setProducts] = useState<CollectedProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [query, setQuery] = useState('')

  // Filter states
  const [showFilters, setShowFilters] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [availablePlatforms, setAvailablePlatforms] = useState<SourcePlatform[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [selectedSourcePlatform, setSelectedSourcePlatform] = useState<string>('')
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

  // 상품 등록 모달 states
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [modalStep, setModalStep] = useState<'select' | 'transforming' | 'edit'>('select')
  const [availablePosts, setAvailablePosts] = useState<AvailablePost[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null)
  const [selectedPost, setSelectedPost] = useState<AvailablePost | null>(null)
  const [transformedDraft, setTransformedDraft] = useState<ProductDraft | null>(null)
  const [editableData, setEditableData] = useState({
    name: '',
    description: '',
    price: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [expandedChannelKeys, setExpandedChannelKeys] = useState<string[]>([])

  useEffect(() => {
    loadChannels()
    loadAvailablePlatforms()
  }, [])

  const loadChannels = async () => {
    try {
      const response = await fetch('/api/channel?kind=WHOLESALE&limit=100')
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
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/collected-product?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data)
        setTotalItems(data.total || 0)
        setTotalPages(Math.ceil((data.total || 0) / itemsPerPage))
        setCurrentPage(page)
      } else {
        toast.error('수집상품 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('수집상품 목록 조회 실패:', error)
      toast.error('수집상품 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannelId, selectedSourcePlatform, startDate, endDate, query, itemsPerPage])

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
    setStartDate('')
    setEndDate('')
    setSearchTerm('')
    setQuery('')
  }

  const hasActiveFilters = selectedChannelId || selectedSourcePlatform || startDate || endDate || Boolean(query)

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
      const allIds = products.map((p) => p.id)
      setSelectedIds(allIds)
      setSelectAll(true)
    }
  }

  const handleToggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((pid) => pid !== id)
        : [...prev, id]
      setSelectAll(newSelection.length === products.length)
      return newSelection
    })
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
        const response = await fetch(`/api/collected-product?id=${deleteTargetId}`, {
          method: 'DELETE',
        })
        const data = await response.json()

        if (data.success) {
          toast.success('수집상품이 삭제되었습니다.')
          loadProducts()
        } else {
          toast.error('수집상품 삭제에 실패했습니다.')
        }
      } else {
        // 일괄 삭제
        let successCount = 0
        for (const id of selectedIds) {
          try {
            const response = await fetch(`/api/collected-product?id=${id}`, {
              method: 'DELETE',
            })
            const data = await response.json()
            if (data.success) successCount++
          } catch (error) {
            console.error(`수집상품 삭제 실패 (ID: ${id}):`, error)
          }
        }

        setSelectedIds([])
        setSelectAll(false)
        loadProducts()

        if (successCount > 0) {
          toast.success(`${successCount}개의 수집상품이 삭제되었습니다.`)
        } else {
          toast.error('수집상품 삭제에 실패했습니다.')
        }
      }
    } catch (error) {
      console.error('수집상품 삭제 실패:', error)
      toast.error('수집상품 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
    }
  }

  // =============================================
  // 상품 등록 모달 핸들러
  // =============================================

  const handleOpenRegisterModal = async () => {
    setShowRegisterModal(true)
    setModalStep('select')
    setSelectedPostId(null)
    setSelectedPost(null)
    setTransformedDraft(null)
    setEditableData({ name: '', description: '', price: '' })
    setExpandedChannelKeys([])
    await loadAvailablePosts()
  }

  const loadAvailablePosts = async () => {
    setIsLoadingPosts(true)
    try {
      // 아직 수집상품으로 변환되지 않은 게시물만 조회
      const response = await fetch('/api/post?limit=100')
      const data = await response.json()

      if (data.success) {
        // 이미 수집상품이 있는 게시물 ID 목록 조회
        const collectedResponse = await fetch('/api/collected-product?limit=1000')
        const collectedData = await collectedResponse.json()
        const usedPostIds = new Set(
          collectedData.data?.map((cp: any) => cp.postId) || []
        )

        // 아직 사용되지 않은 게시물만 필터링
        const filtered = data.data.filter((post: any) => !usedPostIds.has(post.id))
        setAvailablePosts(filtered)
      }
    } catch (error) {
      console.error('게시물 목록 조회 실패:', error)
      toast.error('게시물 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoadingPosts(false)
    }
  }

  const handleSelectPost = (post: AvailablePost) => {
    setSelectedPostId(post.id)
    setSelectedPost(post)
  }

  const handleToggleChannelExpand = (channelKey: string) => {
    setExpandedChannelKeys((prev) =>
      prev.includes(channelKey)
        ? prev.filter((key) => key !== channelKey)
        : [...prev, channelKey]
    )
  }

  // 채널별로 게시물 그룹화
  const groupedAvailablePosts = availablePosts.reduce((acc, post) => {
    const channelKey = post.channel.channelKey
    if (!acc[channelKey]) {
      acc[channelKey] = {
        channel: post.channel,
        posts: [],
      }
    }
    acc[channelKey].posts.push(post)
    return acc
  }, {} as Record<string, { channel: AvailablePost['channel']; posts: AvailablePost[] }>)

  const handleTransform = async () => {
    if (!selectedPostId || !selectedPost) {
      toast.error('게시물을 선택해주세요.')
      return
    }

    setModalStep('transforming')

    try {
      const response = await fetch('/api/product/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: selectedPostId }),
      })

      const data = await response.json()

      if (data.success) {
        const draft = data.draft as ProductDraft
        setTransformedDraft(draft)
        setEditableData({
          name: draft.name || '',
          description: draft.description || '',
          price: draft.price?.toString() || '',
        })
        setModalStep('edit')
      } else {
        toast.error(data.error || 'AI 변환에 실패했습니다.')
        setModalStep('select')
      }
    } catch (error) {
      console.error('AI 변환 실패:', error)
      toast.error('AI 변환 중 오류가 발생했습니다.')
      setModalStep('select')
    }
  }

  const handleSaveProduct = async () => {
    if (!selectedPostId) return

    setIsSaving(true)

    try {
      const response = await fetch('/api/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: selectedPostId,
          name: editableData.name,
          description: editableData.description,
          price: editableData.price ? parseInt(editableData.price) : null,
          currency: 'KRW',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('상품이 등록되었습니다.')
        setShowRegisterModal(false)
        loadProducts()
      } else {
        toast.error(data.error || '상품 등록에 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 등록 실패:', error)
      toast.error('상품 등록 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCloseRegisterModal = () => {
    setShowRegisterModal(false)
    setModalStep('select')
    setSelectedPostId(null)
    setSelectedPost(null)
    setTransformedDraft(null)
    setEditableData({ name: '', description: '', price: '' })
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  const getProductStatusSummary = (collectedProduct: CollectedProduct) => {
    const productCount = collectedProduct.products?.length || 0
    if (productCount === 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          미변환
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        변환완료
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">수집상품 관리</h1>
          <p className="text-gray-600">
            도매 채널 게시물에서 추출한 원본 상품 정보를 관리합니다. 수집상품을 상품으로 변환하여 판매에 활용할 수 있습니다.
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
                    placeholder="상품명 또는 게시물 제목으로 검색..."
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
                  variant="primary"
                  onClick={handleOpenRegisterModal}
                >
                  <Plus size={16} />
                  상품 등록
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0}
                >
                  <Trash2 size={16} />
                  선택 삭제
                </Button>
              </div>
            </div>

            {/* 두 번째 줄: 플랫폼 필터 버튼 */}
            {availablePlatforms.length > 0 && (
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setSelectedSourcePlatform('')}
                  className={`
                    inline-flex items-center justify-center min-w-[52px] px-3 py-1.5 text-sm font-medium rounded-md border transition-colors
                    ${!selectedSourcePlatform
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
                      onClick={() => setSelectedSourcePlatform(platform)}
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
              </div>
            )}
          </div>

          {/* 필터 영역 */}
          {showFilters && (
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-4 items-end">
                {/* 채널 필터 */}
                <div className="w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-1">출처 채널</label>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => {
                      setSelectedChannelId(e.target.value)
                      setCurrentPage(1)
                    }}
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
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  />
                </div>

                <div className="w-40">
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setCurrentPage(1)
                    }}
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
                        onClick={() => {
                          setSelectedChannelId('')
                          setCurrentPage(1)
                        }}
                        className="hover:text-purple-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  {startDate && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      시작일: {startDate}
                      <button
                        onClick={() => {
                          setStartDate('')
                          setCurrentPage(1)
                        }}
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
                        onClick={() => {
                          setEndDate('')
                          setCurrentPage(1)
                        }}
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
                    />
                  </TableHead>
                  <TableHead className="w-[36%]">상품명 / 게시물</TableHead>
                  <TableHead className="w-[16%]">출처 채널</TableHead>
                  <TableHead className="w-[14%]">가격</TableHead>
                  <TableHead className="w-[16%]">변환상태</TableHead>
                  <TableHead className="w-[14%]">수집일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 데이터 행 */}
                {products.map((product) => (
                  <TableRow
                    key={product.id}
                    className="hover:bg-gray-50 cursor-pointer h-[72px]"
                    onClick={() => router.push(`/collected-product/${product.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(product.id)}
                        onChange={() => handleToggleSelection(product.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.post?.images?.[0]?.url ? (
                          <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <Image
                              src={product.post.images[0].url}
                              alt={product.name || product.post.title}
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
                            {product.name || '(상품명 미추출)'}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {product.post?.title}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-gray-600 truncate">
                        {product.post?.channel?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium text-gray-900">
                          {formatPrice(product.price)}
                        </div>
                        {product.wholesalePrice && (
                          <div className="text-xs text-gray-500">
                            도매 {formatPrice(product.wholesalePrice)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getProductStatusSummary(product)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 whitespace-nowrap">
                        {new Date(product.createdAt).toLocaleDateString('ko-KR', {
                          year: '2-digit',
                          month: '2-digit',
                          day: '2-digit',
                        }).replace(/\. /g, '.').replace(/\.$/, '')}
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
        title="수집상품 삭제"
        message={
          deleteTargetId !== null
            ? '이 수집상품을 삭제하시겠습니까? 연결된 상품이 있는 경우 연결이 해제됩니다.'
            : `선택한 ${selectedIds.length}개의 수집상품을 삭제하시겠습니까?`
        }
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* 상품 등록 모달 */}
      <Modal
        isOpen={showRegisterModal}
        onClose={handleCloseRegisterModal}
        title={
          modalStep === 'select'
            ? '상품 등록 - 게시물 선택'
            : modalStep === 'transforming'
            ? '상품 등록 - AI 분석 중'
            : '상품 등록 - 정보 수정'
        }
        size="2xl"
      >
        {/* Step 1: 게시물 선택 */}
        {modalStep === 'select' && (
          <div className="flex flex-col h-[calc(70vh-8rem)]">
            {isLoadingPosts ? (
              <div className="flex-1 flex items-center justify-center">
                <Loading />
              </div>
            ) : availablePosts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <Package size={48} className="mb-4 text-gray-300" />
                <p>변환 가능한 게시물이 없습니다.</p>
                <p className="text-sm mt-2">게시물 관리에서 먼저 게시물을 추가해주세요.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {Object.entries(groupedAvailablePosts).map(([channelKey, group]) => {
                    const isExpanded = expandedChannelKeys.includes(channelKey)
                    return (
                      <div key={channelKey} className="border rounded-lg">
                        {/* 채널 헤더 */}
                        <div
                          className="p-3 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleToggleChannelExpand(channelKey)}
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown size={20} className="text-gray-600" />
                            ) : (
                              <ChevronRight size={20} className="text-gray-600" />
                            )}
                            {group.channel.coverUrl && (
                              <img
                                src={group.channel.coverUrl}
                                alt={group.channel.name}
                                className="w-8 h-8 rounded object-cover"
                              />
                            )}
                            <span className="font-semibold">{group.channel.name}</span>
                            <span className="text-sm text-gray-500">({group.posts.length}개)</span>
                          </div>
                        </div>

                        {/* 게시물 목록 */}
                        {isExpanded && (
                          <div className="p-2 space-y-2">
                            {group.posts.map((post) => (
                              <div
                                key={post.id}
                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                  selectedPostId === post.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => handleSelectPost(post)}
                              >
                                <div className="flex items-start gap-3">
                                  {post.images?.[0] && (
                                    <img
                                      src={post.images[0].url}
                                      alt=""
                                      className="w-16 h-16 rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 truncate">
                                      {post.title}
                                    </h4>
                                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                                      {post.content?.substring(0, 100)}...
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <ModalFooter>
                  <Button variant="secondary" onClick={handleCloseRegisterModal}>
                    취소
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleTransform}
                    disabled={!selectedPostId}
                  >
                    AI 변환
                  </Button>
                </ModalFooter>
              </>
            )}
          </div>
        )}

        {/* Step 2: AI 변환 중 */}
        {modalStep === 'transforming' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                AI가 게시물을 분석하고 있습니다...
              </h3>
              <p className="text-gray-600">잠시만 기다려주세요.</p>
            </div>
          </div>
        )}

        {/* Step 3: 결과 수정 */}
        {modalStep === 'edit' && (
          <div className="flex flex-col h-[calc(70vh-8rem)]">
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* 원본 게시물 정보 */}
              {selectedPost && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">원본 게시물</h4>
                  <div className="flex items-start gap-3">
                    {selectedPost.images?.[0] && (
                      <img
                        src={selectedPost.images[0].url}
                        alt=""
                        className="w-20 h-20 rounded object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium">{selectedPost.title}</p>
                      <p className="text-sm text-gray-500">{selectedPost.channel.name}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 상품 정보 수정 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상품명 *
                  </label>
                  <Input
                    type="text"
                    value={editableData.name}
                    onChange={(e) => setEditableData({ ...editableData, name: e.target.value })}
                    placeholder="상품명을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상품 설명
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={6}
                    value={editableData.description}
                    onChange={(e) => setEditableData({ ...editableData, description: e.target.value })}
                    placeholder="상품 설명을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    판매가 (원)
                  </label>
                  <Input
                    type="number"
                    value={editableData.price}
                    onChange={(e) => setEditableData({ ...editableData, price: e.target.value })}
                    placeholder="판매가를 입력하세요"
                  />
                </div>

                {/* AI 분석 옵션 정보 (읽기 전용) */}
                {transformedDraft?.options && transformedDraft.options.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      AI 추출 옵션
                    </label>
                    <div className="p-3 bg-gray-50 rounded-md">
                      {transformedDraft.options.map((opt, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">{opt.groupName}:</span>{' '}
                          {opt.values.join(', ')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <ModalFooter>
              <Button variant="secondary" onClick={() => setModalStep('select')}>
                이전
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveProduct}
                disabled={!editableData.name || isSaving}
              >
                {isSaving ? '등록 중...' : '등록'}
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  )
}
