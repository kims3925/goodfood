'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Trash2, RefreshCw, Package, Sparkles, Filter, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import PostSelectionModal from '@/components/product/PostSelectionModal'
import PolicySelectionModal from '@/components/product/PolicySelectionModal'
import ProductFormModal from '@/components/product/ProductFormModal'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'
import ThumbnailImage from '@/components/ui/ThumbnailImage'

interface Channel {
  id: number
  name: string
  coverUrl: string | null
}

interface ProductImage {
  id: number
  url: string
  sortOrder: number
}

interface Product {
  id: number
  collectedProductId: number | null
  name: string
  description: string | null
  thumbnailUrl: string | null
  price: number | null
  currency: string
  createdAt: string
  images?: ProductImage[]
  collectedProduct?: {
    post?: {
      title: string
      channel: {
        id: number
        name: string
        coverUrl: string | null
      }
      images: Array<{
        url: string
      }>
    }
  } | null
  publishedChannelIds?: number[]
  publishedProducts?: Array<{
    id: number
    channelId: number | null
    channel?: {
      id: number
      name: string
    } | null
    status: 'PENDING' | 'SUCCESS' | 'FAILED'
  }>
  variants: Array<{
    id: number
    price: number
    stock: number
  }>
  // 발행 상태
  publishStatus?: {
    channel: boolean
    shoppingMall: boolean
  }
  publishSummary?: string
}

// 상품 이미지 URL 가져오기 (product_image 우선, 없으면 수집상품 이미지)
const getProductThumbnailUrl = (product: Product): string | null => {
  // 1. product_image 테이블에서 첫 번째 이미지
  if (product.images && product.images.length > 0) {
    return product.images[0].url
  }
  // 2. thumbnailUrl 필드 (기존 호환성)
  if (product.thumbnailUrl) {
    return product.thumbnailUrl
  }
  // 3. 수집상품의 게시물 이미지
  if (product.collectedProduct?.post?.images?.[0]?.url) {
    return product.collectedProduct.post.images[0].url
  }
  return null
}

export default function ProductListPage() {
  const router = useRouter()
  const toast = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter states
  const [showFilters, setShowFilters] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  // Modal states
  const [showPostSelectionModal, setShowPostSelectionModal] = useState(false)
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [showProductFormModal, setShowProductFormModal] = useState(false)
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([]) // 다중 선택 지원
  const [pendingPostIds, setPendingPostIds] = useState<number[]>([]) // 정책 선택 대기 중인 게시물
  const [productDrafts, setProductDrafts] = useState<any[]>([]) // 다중 AI 결과
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0 })

  // 추가 상품 선택 모드 관련 상태
  const [isAddingMore, setIsAddingMore] = useState(false) // 추가 모드 여부
  const [lastUsedPolicyContent, setLastUsedPolicyContent] = useState<string | null>(null) // 마지막 사용 정책

  // Selection states
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // Delete confirm modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadChannels()
  }, [])

  useEffect(() => {
    loadProducts()
  }, [currentPage, selectedChannelId, startDate, endDate])

  const loadChannels = async () => {
    try {
      const response = await fetch('/api/channel?kind=WHOLESALE&limit=100')
      const data = await response.json()
      if (data.success) {
        setChannels(data.data)
      }
    } catch (error) {
      console.error('채널 목록 조회 실패:', error)
      toast.error('채널 목록을 불러오는데 실패했습니다.')
    }
  }

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })

      if (searchTerm) params.append('search', searchTerm)
      if (selectedChannelId) params.append('channelId', selectedChannelId)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/product?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data)
        setTotalItems(data.total || 0)
        setTotalPages(Math.ceil((data.total || 0) / itemsPerPage))
      } else {
        toast.error('상품 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 목록 조회 실패:', error)
      toast.error('상품 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearFilters = () => {
    setSelectedChannelId('')
    setStartDate('')
    setEndDate('')
    setSearchTerm('')
    setCurrentPage(1)
  }

  const hasActiveFilters = selectedChannelId || startDate || endDate

  const handleSearch = () => {
    setCurrentPage(1)
    loadProducts()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleOpenAddProductFlow = () => {
    setShowPostSelectionModal(true)
  }

  // 단일 게시물 선택 (하위 호환성)
  const handlePostSelected = async (postId: number) => {
    await handleMultiplePostsSelected([postId])
  }

  // 다중 게시물 선택 처리 - 정책 선택 모달로 이동
  const handleMultiplePostsSelected = async (postIds: number[]) => {
    setPendingPostIds(postIds)
    setShowPostSelectionModal(false)
    setShowPolicyModal(true)
  }

  // 정책 선택 후 AI 변환 시작
  const handlePolicySelected = async (policyId: number | null, policyContent: string | null) => {
    setShowPolicyModal(false)
    setSelectedPostIds(pendingPostIds)
    setIsGenerating(true)
    setGeneratingProgress({ current: 0, total: pendingPostIds.length })

    // 정책 내용 저장 (추가 상품 선택 시 재사용)
    setLastUsedPolicyContent(policyContent)

    try {
      const drafts: any[] = []

      // 각 게시물에 대해 AI 상품 생성
      for (let i = 0; i < pendingPostIds.length; i++) {
        const postId = pendingPostIds[i]
        setGeneratingProgress({ current: i + 1, total: pendingPostIds.length })

        try {
          const response = await fetch('/api/product/ai-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, policyContent }),
          })

          const data = await response.json()

          if (data.success) {
            drafts.push({
              postId,
              draft: data.draft,
            })
          } else {
            console.error(`게시물 ${postId} AI 생성 실패:`, data.error)
            // 실패한 게시물도 빈 draft로 추가 (사용자가 직접 입력 가능)
            drafts.push({
              postId,
              draft: {
                name: `게시물 ${postId} (AI 생성 실패)`,
                description: '',
                categoryId: '',
                price: '',
                options: [],
                variants: [],
              },
              error: data.error,
            })
          }
        } catch (error) {
          console.error(`게시물 ${postId} AI 생성 오류:`, error)
          drafts.push({
            postId,
            draft: {
              name: `게시물 ${postId} (AI 생성 오류)`,
              description: '',
              categoryId: '',
              price: '',
              wholesalePrice: '',
              options: [],
              variants: [],
            },
            error: '네트워크 오류',
          })
        }
      }

      if (drafts.length > 0) {
        if (isAddingMore) {
          // 추가 모드: 기존 drafts에 새 drafts 추가
          setProductDrafts(prev => [...prev, ...drafts])
          setIsAddingMore(false)
        } else {
          // 일반 모드: drafts 새로 설정
          setProductDrafts(drafts)
        }
        setShowProductFormModal(true)
      }
    } catch (error) {
      console.error('AI 상품 생성 실패:', error)
    } finally {
      setIsGenerating(false)
      setGeneratingProgress({ current: 0, total: 0 })
      setPendingPostIds([])
    }
  }

  // 추가 상품 선택 핸들러 (ProductFormModal에서 호출)
  const handleAddMorePosts = () => {
    setIsAddingMore(true)
    setShowProductFormModal(false) // 현재 폼 모달 잠시 닫기
    setShowPostSelectionModal(true) // 게시물 선택 모달 열기
  }

  // 추가 모드에서 게시물 선택 후 처리 (정책 선택 건너뛰고 바로 AI 가공)
  const handleAddMorePostsSelected = async (postIds: number[]) => {
    setShowPostSelectionModal(false)
    setIsGenerating(true)
    setGeneratingProgress({ current: 0, total: postIds.length })

    try {
      const drafts: any[] = []

      // 각 게시물에 대해 AI 상품 생성 (이전 정책 재사용)
      for (let i = 0; i < postIds.length; i++) {
        const postId = postIds[i]
        setGeneratingProgress({ current: i + 1, total: postIds.length })

        try {
          const response = await fetch('/api/product/ai-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, policyContent: lastUsedPolicyContent }),
          })

          const data = await response.json()

          if (data.success) {
            drafts.push({
              postId,
              draft: data.draft,
            })
          } else {
            console.error(`게시물 ${postId} AI 생성 실패:`, data.error)
            drafts.push({
              postId,
              draft: {
                name: `게시물 ${postId} (AI 생성 실패)`,
                description: '',
                categoryId: '',
                price: '',
                options: [],
                variants: [],
              },
              error: data.error,
            })
          }
        } catch (error) {
          console.error(`게시물 ${postId} AI 생성 오류:`, error)
          drafts.push({
            postId,
            draft: {
              name: `게시물 ${postId} (AI 생성 오류)`,
              description: '',
              categoryId: '',
              price: '',
              wholesalePrice: '',
              options: [],
              variants: [],
            },
            error: '네트워크 오류',
          })
        }
      }

      if (drafts.length > 0) {
        // 기존 drafts에 새 drafts 추가
        setProductDrafts(prev => [...prev, ...drafts])
        setShowProductFormModal(true)
      }
    } catch (error) {
      console.error('AI 상품 생성 실패:', error)
      // 에러 시에도 폼 모달 다시 열기
      setShowProductFormModal(true)
    } finally {
      setIsGenerating(false)
      setGeneratingProgress({ current: 0, total: 0 })
      setIsAddingMore(false)
    }
  }

  const handleProductSaved = () => {
    setShowProductFormModal(false)
    setProductDrafts([])
    setSelectedPostIds([])
    loadProducts()
  }

  // AI 재시도 핸들러
  const handleRetryAI = async (postId: number) => {
    setIsGenerating(true)
    setGeneratingProgress({ current: 1, total: 1 })

    try {
      const response = await fetch('/api/product/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, policyContent: lastUsedPolicyContent }),
      })

      const data = await response.json()

      // productDrafts에서 해당 postId의 draft 업데이트
      setProductDrafts(prev => prev.map(item => {
        if (item.postId === postId) {
          if (data.success) {
            return {
              postId,
              draft: data.draft,
              error: undefined, // 에러 제거
            }
          } else {
            return {
              ...item,
              error: data.error || 'AI 생성 실패',
            }
          }
        }
        return item
      }))
    } catch (error) {
      console.error(`게시물 ${postId} AI 재시도 오류:`, error)
    } finally {
      setIsGenerating(false)
      setGeneratingProgress({ current: 0, total: 0 })
    }
  }

  const handleDeleteProduct = (id: number) => {
    setDeleteTargetId(id)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteProduct = async () => {
    if (deleteTargetId === null && selectedProductIds.length === 0) return

    setIsDeleting(true)
    try {
      // 단일 삭제
      if (deleteTargetId !== null) {
        const response = await fetch(`/api/product?id=${deleteTargetId}`, {
          method: 'DELETE',
        })
        const data = await response.json()

        if (data.success) {
          toast.success('상품이 삭제되었습니다.')
          loadProducts()
        } else {
          toast.error('상품 삭제에 실패했습니다.')
        }
      } else {
        // 일괄 삭제
        let successCount = 0
        for (const id of selectedProductIds) {
          try {
            const response = await fetch(`/api/product?id=${id}`, {
              method: 'DELETE',
            })
            const data = await response.json()
            if (data.success) successCount++
          } catch (error) {
            console.error(`상품 삭제 실패 (ID: ${id}):`, error)
          }
        }

        setSelectedProductIds([])
        setSelectAll(false)
        loadProducts()

        if (successCount > 0) {
          toast.success(`${successCount}개의 상품이 삭제되었습니다.`)
        } else {
          toast.error('상품 삭제에 실패했습니다.')
        }
      }
    } catch (error) {
      console.error('상품 삭제 실패:', error)
      toast.error('상품 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
    }
  }

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedProductIds([])
      setSelectAll(false)
    } else {
      const allIds = products.map((p) => p.id)
      setSelectedProductIds(allIds)
      setSelectAll(true)
    }
  }

  const handleToggleSelection = (id: number) => {
    setSelectedProductIds((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((pid) => pid !== id)
        : [...prev, id]
      setSelectAll(newSelection.length === products.length)
      return newSelection
    })
  }

  const handleDeleteSelected = () => {
    if (selectedProductIds.length === 0) {
      return
    }
    setDeleteTargetId(null) // 일괄 삭제 모드
    setShowDeleteConfirm(true)
  }

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      COLLECTED: { label: '수집', color: 'bg-gray-100 text-gray-800' },
      ARCHIVED: { label: '보관', color: 'bg-yellow-100 text-yellow-800' },
    }

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  // 발행현황 배지
  const getPublishStatusBadge = (product: Product) => {
    if (!product.publishStatus) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          미발행
        </span>
      )
    }

    const { channel, shoppingMall } = product.publishStatus

    if (channel && shoppingMall) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          발행완료
        </span>
      )
    }

    if (channel || shoppingMall) {
      return (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            부분발행
          </span>
          <div className="flex gap-1">
            <span className={`inline-block w-2 h-2 rounded-full ${channel ? 'bg-green-500' : 'bg-gray-300'}`} title="채널" />
            <span className={`inline-block w-2 h-2 rounded-full ${shoppingMall ? 'bg-green-500' : 'bg-gray-300'}`} title="쇼핑몰" />
          </div>
        </div>
      )
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">상품 관리</h1>
          <p className="text-gray-600">
            도매채널에서 수집한 게시물을 AI로 변환한 상품을 관리합니다. 상품 정보를 수정하고 판매 상태를 관리할 수 있습니다.
          </p>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
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
                <Button variant="primary" onClick={handleOpenAddProductFlow}>
                  <Sparkles size={16} />
                  상품 등록
                </Button>

                <Button
                  variant="danger"
                  onClick={handleDeleteSelected}
                  disabled={selectedProductIds.length === 0}
                >
                  <Trash2 size={16} />
                  선택 삭제 ({selectedProductIds.length})
                </Button>
              </div>
            </div>
          </div>

          {/* 필터 영역 */}
          {showFilters && (
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-4 items-end">
                {/* 출처 채널 필터 */}
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
                  <TableHead className="w-[35%]">상품명</TableHead>
                  <TableHead className="w-[15%]">출처 채널</TableHead>
                  <TableHead className="w-[12%]">판매가</TableHead>
                  <TableHead className="w-[18%]">발행현황</TableHead>
                  <TableHead className="w-[12%] whitespace-nowrap">생성일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableEmpty message="등록된 상품이 없습니다." />
                ) : (
                  products.map((product) => (
                    <TableRow
                      key={product.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/product/detail/${product.id}`)}
                    >
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(product.id)}
                          onChange={() => handleToggleSelection(product.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ThumbnailImage
                            src={getProductThumbnailUrl(product)}
                            alt={product.name}
                            size="md"
                            rounded="lg"
                            fallbackIcon="package"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-900 text-base">{product.name}</div>
                            {product.description && (
                              <div className="text-sm text-gray-500 truncate mt-1">
                                {product.description.substring(0, 60)}...
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-gray-600 truncate">
                          {product.collectedProduct?.post?.channel?.name || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {formatPrice(product.price)}
                        </div>
                      </TableCell>
                      <TableCell>{getPublishStatusBadge(product)}</TableCell>
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

      {/* AI 상품 생성 중 로딩 오버레이 */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  AI가 상품 정보를 생성하고 있습니다...
                </h3>
                {generatingProgress.total > 1 && (
                  <div className="mb-3">
                    <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${(generatingProgress.current / generatingProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-purple-600 mt-2 font-medium">
                      {generatingProgress.current} / {generatingProgress.total} 게시물 처리 중
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  게시물을 분석하여 상품명, 옵션, 가격 등을 추출 중입니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setDeleteTargetId(null)
        }}
        onConfirm={confirmDeleteProduct}
        title="상품 삭제"
        message={
          deleteTargetId !== null
            ? '이 상품을 삭제하시겠습니까?'
            : `선택한 ${selectedProductIds.length}개의 상품을 삭제하시겠습니까?`
        }
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* 게시물 선택 모달 */}
      <PostSelectionModal
        isOpen={showPostSelectionModal}
        onClose={() => {
          setShowPostSelectionModal(false)
          // 추가 모드에서 취소 시 폼 모달 다시 열기
          if (productDrafts.length > 0) {
            setShowProductFormModal(true)
            setIsAddingMore(false)
          }
        }}
        onPostSelected={productDrafts.length > 0 ? (postId) => handleAddMorePostsSelected([postId]) : handlePostSelected}
        onMultiplePostsSelected={productDrafts.length > 0 ? handleAddMorePostsSelected : handleMultiplePostsSelected}
        excludePostIds={productDrafts.map(d => d.postId)}
      />

      {/* 정책 선택 모달 */}
      <PolicySelectionModal
        isOpen={showPolicyModal}
        onClose={() => {
          setShowPolicyModal(false)
          setPendingPostIds([])
        }}
        onPolicySelected={handlePolicySelected}
        selectedPostCount={pendingPostIds.length}
      />

      {/* 상품 정보 수정 모달 */}
      {productDrafts.length > 0 && (
        <ProductFormModal
          isOpen={showProductFormModal}
          onClose={() => {
            setShowProductFormModal(false)
            setProductDrafts([])
            setSelectedPostIds([])
            setLastUsedPolicyContent(null)
          }}
          postId={selectedPostIds[0]}
          initialData={productDrafts[0]?.draft}
          initialDrafts={productDrafts}
          onSaved={handleProductSaved}
          onAddMorePosts={handleAddMorePosts}
          onRetry={handleRetryAI}
        />
      )}
    </div>
  )
}
