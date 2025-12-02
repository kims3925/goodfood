'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Trash2, Package, Boxes, CheckCircle, Clock, ShoppingCart } from 'lucide-react'
import Image from 'next/image'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Modal, { ModalFooter } from '@/components/ui/Modal'
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
  platform?: string
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

interface CollectedProduct {
  id: number
  userId: number
  postId: number
  name: string | null
  description: string | null
  currency: string
  price: number | null
  wholesalePrice: number | null
  createdAt: string
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
      imageUrl: string
    }>
  }
  products: Array<{
    id: number
    name: string
  }>
}

export default function ProductListPage() {
  const router = useRouter()
  const toast = useToast()
  const [products, setProducts] = useState<Product[]>([])
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

  // CollectedProduct 등록 모달 states
  const [showCollectedProductModal, setShowCollectedProductModal] = useState(false)
  const [collectedProducts, setCollectedProducts] = useState<CollectedProduct[]>([])
  const [isLoadingCollected, setIsLoadingCollected] = useState(false)
  const [selectedCollectedIds, setSelectedCollectedIds] = useState<number[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [convertingProgress, setConvertingProgress] = useState({ current: 0, total: 0 })

  useEffect(() => {
    loadChannels()
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
      toast.error('채널 목록을 불러오는데 실패했습니다.')
    }
  }

  // CollectedProduct 등록 관련 함수들
  const handleOpenCollectedProductModal = async () => {
    setShowCollectedProductModal(true)
    setSelectedCollectedIds([])
    await loadCollectedProducts()
  }

  const loadCollectedProducts = async () => {
    setIsLoadingCollected(true)
    try {
      const response = await fetch('/api/collected-product?limit=1000')
      const data = await response.json()

      if (data.success) {
        // Product로 변환되지 않은 CollectedProduct만 필터링
        const unconverted = data.data.filter(
          (cp: CollectedProduct) => !cp.products || cp.products.length === 0
        )
        setCollectedProducts(unconverted)
      }
    } catch (error) {
      console.error('수집상품 목록 조회 실패:', error)
      toast.error('수집상품 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoadingCollected(false)
    }
  }

  const handleConvertToProduct = async () => {
    if (selectedCollectedIds.length === 0) {
      toast.error('수집상품을 선택해주세요.')
      return
    }

    setIsConverting(true)
    setConvertingProgress({ current: 0, total: selectedCollectedIds.length })

    let successCount = 0
    let failCount = 0

    try {
      for (let i = 0; i < selectedCollectedIds.length; i++) {
        const cpId = selectedCollectedIds[i]
        const selectedCP = collectedProducts.find(cp => cp.id === cpId)

        setConvertingProgress({ current: i + 1, total: selectedCollectedIds.length })

        if (!selectedCP) {
          failCount++
          continue
        }

        try {
          const response = await fetch('/api/product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collectedProductId: cpId,
              name: selectedCP.name || selectedCP.post.title || '상품명 미지정',
              description: selectedCP.description || '',
              price: selectedCP.price || null,
              currency: selectedCP.currency || 'KRW',
            }),
          })

          const data = await response.json()

          if (data.success) {
            successCount++
          } else {
            failCount++
          }
        } catch {
          failCount++
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount}개 상품이 등록되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`)
        setShowCollectedProductModal(false)
        setSelectedCollectedIds([])
        loadProducts()
      } else {
        toast.error('상품 등록에 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 등록 실패:', error)
      toast.error('상품 등록 중 오류가 발생했습니다.')
    } finally {
      setIsConverting(false)
      setConvertingProgress({ current: 0, total: 0 })
    }
  }

  const handleCloseCollectedProductModal = () => {
    setShowCollectedProductModal(false)
    setSelectedCollectedIds([])
  }

  // 수집상품 개별 선택/해제
  const handleToggleCollectedSelection = (id: number) => {
    setSelectedCollectedIds(prev =>
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    )
  }

  // 수집상품 전체 선택/해제
  const handleToggleCollectedSelectAll = () => {
    if (selectedCollectedIds.length === collectedProducts.length) {
      setSelectedCollectedIds([])
    } else {
      setSelectedCollectedIds(collectedProducts.map(cp => cp.id))
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

      const response = await fetch(`/api/product?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data)
        setTotalItems(data.total || 0)
        setTotalPages(Math.ceil((data.total || 0) / itemsPerPage))
        setCurrentPage(page)
      } else {
        toast.error('상품 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 목록 조회 실패:', error)
      toast.error('상품 목록을 불러오는데 실패했습니다.')
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

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Package size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 상품</p>
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
                <p className="text-sm text-gray-500">발행완료</p>
                <p className="text-2xl font-bold text-green-600">{products.filter(p => p.publishStatus?.channel || p.publishStatus?.shoppingMall).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock size={24} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">미발행</p>
                <p className="text-2xl font-bold text-yellow-600">{products.filter(p => !p.publishStatus?.channel && !p.publishStatus?.shoppingMall).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Boxes size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">출처 채널</p>
                <p className="text-2xl font-bold text-blue-600">{channels.length}</p>
              </div>
            </div>
          </div>
          {/* 상품 등록 카드 */}
          <button
            onClick={handleOpenCollectedProductModal}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Plus size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">상품</p>
                <p className="text-lg font-bold text-blue-600">등록하기</p>
              </div>
            </div>
          </button>
          {/* 선택 삭제 카드 */}
          <button
            onClick={handleDeleteSelected}
            disabled={selectedProductIds.length === 0}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left transition-colors ${
              selectedProductIds.length > 0
                ? 'hover:border-red-300 hover:bg-red-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${selectedProductIds.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Trash2 size={24} className={selectedProductIds.length > 0 ? 'text-red-600' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-sm text-gray-500">선택 삭제</p>
                <p className={`text-lg font-bold ${selectedProductIds.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {selectedProductIds.length}개 선택됨
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* 왼쪽: 출처 채널 필터 */}
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
                      <Boxes size={14} />
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
                    />
                  </TableHead>
                  <TableHead className="w-[36%]">상품명</TableHead>
                  <TableHead className="w-[16%]">출처 채널</TableHead>
                  <TableHead className="w-[14%]">판매가</TableHead>
                  <TableHead className="w-[16%]">발행현황</TableHead>
                  <TableHead className="w-[14%]">생성일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 데이터 행 */}
                {products.map((product) => (
                  <TableRow
                    key={product.id}
                    className="hover:bg-gray-50 cursor-pointer h-[72px]"
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
                        {product.thumbnailUrl ? (
                          <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <Image
                              src={product.thumbnailUrl}
                              alt={product.name}
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
                          <div className="font-semibold text-gray-900 text-base truncate">{product.name}</div>
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

      {/* 수집상품 선택 모달 */}
      <Modal
        isOpen={showCollectedProductModal}
        onClose={handleCloseCollectedProductModal}
        title="상품 등록 - 수집상품 선택"
        size="2xl"
      >
        <div className="flex flex-col h-[calc(70vh-8rem)]">
          {isLoadingCollected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isConverting ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-900 font-medium">상품 등록 중...</p>
              {convertingProgress.total > 1 && (
                <div className="mt-4 w-64">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${(convertingProgress.current / convertingProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2 text-center">
                    {convertingProgress.current} / {convertingProgress.total}
                  </p>
                </div>
              )}
            </div>
          ) : collectedProducts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <Package size={48} className="mb-4 text-gray-300" />
              <p>변환 가능한 수집상품이 없습니다.</p>
              <p className="text-sm mt-2">수집상품 관리에서 먼저 수집상품을 추가해주세요.</p>
            </div>
          ) : (
            <>
              {/* 전체 선택 헤더 */}
              <div className="flex items-center justify-between py-3 px-2 border-b border-gray-200 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCollectedIds.length === collectedProducts.length && collectedProducts.length > 0}
                    onChange={handleToggleCollectedSelectAll}
                    className="w-4 h-4 cursor-pointer rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">전체 선택</span>
                </label>
                {selectedCollectedIds.length > 0 && (
                  <span className="text-sm text-purple-600 font-medium">
                    {selectedCollectedIds.length}개 선택됨
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {collectedProducts.map((cp) => (
                  <div
                    key={cp.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedCollectedIds.includes(cp.id)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleToggleCollectedSelection(cp.id)}
                  >
                    <div className="flex items-start gap-3">
                      {cp.post?.images?.[0]?.imageUrl ? (
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          <Image
                            src={cp.post.images[0].imageUrl}
                            alt={cp.name || cp.post.title}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <Package size={24} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {cp.name || '(상품명 미추출)'}
                        </h4>
                        <p className="text-sm text-gray-500 truncate">
                          {cp.post?.title}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-sm text-gray-600">
                            {cp.post?.channel?.name}
                          </span>
                          {cp.price && (
                            <span className="text-sm font-medium text-gray-900">
                              ₩{cp.price.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <ModalFooter>
                <Button variant="secondary" onClick={handleCloseCollectedProductModal}>
                  취소
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConvertToProduct}
                  disabled={selectedCollectedIds.length === 0 || isConverting}
                >
                  {selectedCollectedIds.length > 0
                    ? `${selectedCollectedIds.length}개 상품 등록`
                    : '상품 등록'}
                </Button>
              </ModalFooter>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
