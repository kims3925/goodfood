'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Package, Trash2, Plus, ChevronDown, ChevronRight, ChevronUp, Boxes, CheckCircle, Clock } from 'lucide-react'
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

type ChannelPlatform = 'BAND' | 'NAVER_CAFE' | 'ALIEXPRESS'

interface Channel {
  id: number
  name: string
  coverUrl: string | null
  platform?: string
}

const PLATFORM_LABELS: Record<string, string> = {
  'BAND': '밴드',
  'NAVER_CAFE': '네이버 카페',
  'ALIEXPRESS': '알리익스프레스',
  'OTHER': '기타',
}

// DB에서 가져온 가격 정책 인터페이스
interface PricingPolicyItem {
  id: number
  name: string
  description: string | null
  content: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}


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
    platform?: string
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
    optionSummary: string | null
    price: number | null
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

  // 상품 등록 모달 states
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [modalStep, setModalStep] = useState<'pricing' | 'select' | 'transforming'>('pricing')
  const [pricingPolicies, setPricingPolicies] = useState<PricingPolicyItem[]>([])
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(null)
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false)
  const [expandedPolicyIds, setExpandedPolicyIds] = useState<number[]>([]) // 펼쳐진 정책 ID
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([]) // 실제 존재하는 플랫폼 목록
  const [availablePosts, setAvailablePosts] = useState<AvailablePost[]>([])
  const [allAvailablePosts, setAllAvailablePosts] = useState<AvailablePost[]>([]) // 전체 게시물 (플랫폼 필터링 전)
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([]) // 다중 선택
  const [selectedPosts, setSelectedPosts] = useState<AvailablePost[]>([]) // 다중 선택된 게시물들
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0) // 현재 처리 중인 인덱스
  const [expandedPostIds, setExpandedPostIds] = useState<number[]>([]) // 펼쳐진 게시물 ID

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
    setModalStep('pricing')
    setSelectedPolicyId(null)
    setSelectedPlatform('')
    setAvailablePlatforms([])
    setSelectedPostIds([])
    setSelectedPosts([])
    setCurrentProcessingIndex(0)
    setExpandedPostIds([])
    setExpandedPolicyIds([])
    await loadPricingPolicies()
  }

  // 가격 정책 목록 로드 (활성화된 정책만)
  const loadPricingPolicies = async () => {
    setIsLoadingPolicies(true)
    try {
      const response = await fetch('/api/policy?limit=100')
      const data = await response.json()
      if (data.success) {
        // 활성화된 정책만 필터링
        const activePolicies = data.data.filter((p: PricingPolicyItem) => p.isActive)
        setPricingPolicies(activePolicies)
        // 첫 번째 정책을 기본 선택
        if (activePolicies.length > 0) {
          setSelectedPolicyId(activePolicies[0].id)
        }
      }
    } catch (error) {
      console.error('가격 정책 목록 조회 실패:', error)
      toast.error('가격 정책을 불러오는데 실패했습니다.')
    } finally {
      setIsLoadingPolicies(false)
    }
  }

  // 정책 펼치기/접기 토글
  const handleTogglePolicyExpand = (policyId: number) => {
    setExpandedPolicyIds((prev) =>
      prev.includes(policyId)
        ? prev.filter((id) => id !== policyId)
        : [...prev, policyId]
    )
  }

  // 가격 정책 설정 후 게시물 선택 단계로 이동
  const handlePricingNext = async () => {
    if (!selectedPolicyId) {
      toast.error('가격 정책을 선택해주세요.')
      return
    }
    setModalStep('select')
    await loadAvailablePosts()
  }

  const loadAvailablePosts = async () => {
    setIsLoadingPosts(true)
    setAvailablePosts([])
    setAvailablePlatforms([])
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
        setAllAvailablePosts(filtered)

        // 고유한 플랫폼 목록 추출
        const platforms = [...new Set(filtered.map((post: AvailablePost) => post.channel.platform).filter(Boolean))] as string[]
        setAvailablePlatforms(platforms)

        // 첫 번째 플랫폼 선택 및 필터링
        if (platforms.length > 0) {
          const firstPlatform = platforms[0]
          setSelectedPlatform(firstPlatform)
          const platformFiltered = filtered.filter((post: AvailablePost) =>
            post.channel.platform === firstPlatform
          )
          setAvailablePosts(platformFiltered)
        } else {
          setAvailablePosts(filtered)
        }
      }
    } catch (error) {
      console.error('게시물 목록 조회 실패:', error)
      toast.error('게시물 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoadingPosts(false)
    }
  }

  // 플랫폼 선택 핸들러
  const handlePlatformSelect = (platform: string) => {
    setSelectedPlatform(platform)
    // 플랫폼 변경 시 선택 상태 초기화
    setSelectedPostIds([])
    setSelectedPosts([])
    setExpandedPostIds([])

    // 이미 로드된 전체 게시물에서 플랫폼별로 필터링
    const platformFiltered = allAvailablePosts.filter((post: AvailablePost) =>
      post.channel.platform === platform
    )
    setAvailablePosts(platformFiltered)
  }

  // 게시물 선택/해제 토글 (다중 선택)
  const handleTogglePostSelect = (post: AvailablePost) => {
    const isCurrentlySelected = selectedPostIds.includes(post.id)

    if (isCurrentlySelected) {
      // 선택 해제
      setSelectedPostIds(prev => prev.filter(id => id !== post.id))
      setSelectedPosts(prev => prev.filter(p => p.id !== post.id))
    } else {
      // 선택 추가 (중복 방지)
      setSelectedPostIds(prev => prev.includes(post.id) ? prev : [...prev, post.id])
      setSelectedPosts(prev => prev.some(p => p.id === post.id) ? prev : [...prev, post])
    }
  }

  // 전체 선택/해제
  const handleSelectAllPosts = () => {
    const allPostIds = availablePosts.map(post => post.id)
    const isAllSelected = allPostIds.length > 0 && allPostIds.every(id => selectedPostIds.includes(id))

    if (isAllSelected) {
      // 현재 플랫폼의 게시물만 선택 해제
      setSelectedPostIds(prev => prev.filter(id => !allPostIds.includes(id)))
      setSelectedPosts(prev => prev.filter(p => !allPostIds.includes(p.id)))
    } else {
      // 현재 플랫폼의 게시물 전체 선택
      setSelectedPostIds(prev => Array.from(new Set([...prev, ...allPostIds])))
      setSelectedPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id))
        const newPosts = availablePosts.filter(p => !existingIds.has(p.id))
        return [...prev, ...newPosts]
      })
    }
  }

  // 전체 선택 여부 확인
  const isAllPostsSelected = availablePosts.length > 0 &&
    availablePosts.every(post => selectedPostIds.includes(post.id))

  // 게시물 펼치기/접기 토글
  const handleTogglePostExpand = (postId: number) => {
    setExpandedPostIds((prev) =>
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId]
    )
  }

  const handleTransform = async () => {
    if (selectedPostIds.length === 0) {
      toast.error('게시물을 선택해주세요.')
      return
    }

    setModalStep('transforming')
    setCurrentProcessingIndex(0)

    // 선택된 모든 게시물을 순차적으로 처리
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < selectedPosts.length; i++) {
      setCurrentProcessingIndex(i + 1)
      const post = selectedPosts[i]

      try {
        // 선택된 정책의 content 가져오기
        const selectedPolicy = pricingPolicies.find(p => p.id === selectedPolicyId)

        // AI 변환 (가격 정책 포함)
        const response = await fetch('/api/product/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: post.id,
            policyContent: selectedPolicy?.content,
          }),
        })

        const data = await response.json()

        if (data.success) {
          const draft = data.draft as ProductDraft & { shippingFee?: number; shippingInfo?: string }

          // 바로 상품 등록
          const saveResponse = await fetch('/api/collected-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postId: post.id,
              name: draft.name,
              description: draft.description,
              price: draft.price,
              currency: 'KRW',
              rawMetadata: {
                ...draft,
                // shipping 객체로 정리 (product-create.ts와 호환)
                shipping: {
                  shippingFee: draft.shippingFee ?? null,
                  shippingInfo: draft.shippingInfo ?? null,
                },
              },
            }),
          })

          const saveData = await saveResponse.json()

          if (saveData.success) {
            successCount++
          } else {
            failCount++
            console.error(`상품 등록 실패 (${post.title}):`, saveData.error)
          }
        } else {
          failCount++
          console.error(`AI 변환 실패 (${post.title}):`, data.error)
        }
      } catch (error) {
        failCount++
        console.error(`처리 실패 (${post.title}):`, error)
      }
    }

    // 완료 처리
    if (successCount > 0) {
      toast.success(`${successCount}개 상품이 등록되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`)
      setShowRegisterModal(false)
      loadProducts()
    } else {
      toast.error('상품 등록에 실패했습니다.')
      // 실패 시 선택 상태 초기화
      setSelectedPostIds([])
      setSelectedPosts([])
      setExpandedPostIds([])
      setModalStep('select')
    }
  }

  const handleCloseRegisterModal = () => {
    setShowRegisterModal(false)
    setModalStep('pricing')
    setSelectedPolicyId(null)
    setPricingPolicies([])
    setSelectedPlatform('BAND')
    setSelectedPostIds([])
    setSelectedPosts([])
    setCurrentProcessingIndex(0)
    setAvailablePosts([])
    setAllAvailablePosts([])
    setExpandedPostIds([])
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

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Package size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 수집상품</p>
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
                <p className="text-sm text-gray-500">변환완료</p>
                <p className="text-2xl font-bold text-green-600">{products.filter(p => (p.products?.length || 0) > 0).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock size={24} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">미변환</p>
                <p className="text-2xl font-bold text-yellow-600">{products.filter(p => (p.products?.length || 0) === 0).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Boxes size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">채널 수</p>
                <p className="text-2xl font-bold text-blue-600">{channels.length}</p>
              </div>
            </div>
          </div>
          {/* 수집 상품 등록 카드 */}
          <button
            onClick={handleOpenRegisterModal}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Plus size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">수집 상품</p>
                <p className="text-lg font-bold text-blue-600">등록하기</p>
              </div>
            </div>
          </button>
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
              {/* 왼쪽: 변환상태 필터 + 출처 채널 필터 */}
              <div className="flex items-center gap-3 overflow-x-auto">
                {/* 변환상태 필터 */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
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
                  <TableHead className="w-[40%]">상품명 / 게시물</TableHead>
                  <TableHead className="w-[20%]">출처 채널</TableHead>
                  <TableHead className="w-[20%]">변환상태</TableHead>
                  <TableHead className="w-[16%]">수집일시</TableHead>
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
                            {product.description || '-'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-gray-600 truncate">
                        {product.post?.channel?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>{getProductStatusSummary(product)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 whitespace-nowrap">
                        {new Date(product.createdAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        }).replace(/\. /g, '-').replace(/\.$/, '')}{' '}
                        {new Date(product.createdAt).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false,
                        })}
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

      {/* 수집 상품 등록 모달 */}
      <Modal
        isOpen={showRegisterModal}
        onClose={handleCloseRegisterModal}
        title={
          modalStep === 'pricing'
            ? '수집 상품 등록 - 가격 정책 설정'
            : modalStep === 'select'
            ? '수집 상품 등록 - 게시물 선택'
            : '수집 상품 등록 - AI 분석 중'
        }
        size="2xl"
      >
        {/* Step 0: 가격 정책 선택 */}
        {modalStep === 'pricing' && (
          <div className="space-y-5">
            {/* 헤더 영역 */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <p className="text-gray-600">
                  AI 상품 변환에 사용할 가격 정책을 선택해주세요.
                </p>
              </div>
              {pricingPolicies.length > 0 && (
                <span className="px-3 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded-full">
                  {pricingPolicies.length}개 정책
                </span>
              )}
            </div>

            {/* 가격 정책 목록 */}
            <div className="h-[480px] overflow-hidden">
              {isLoadingPolicies ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <Loading />
                  <p className="text-center text-gray-600 mt-4">
                    가격 정책을 불러오는 중...
                  </p>
                </div>
              ) : pricingPolicies.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <Package size={40} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">등록된 가격 정책이 없습니다</h3>
                  <p className="text-gray-500 text-center text-sm">
                    환경 설정 &gt; 자동화 설정에서<br />
                    가격 정책을 먼저 등록해주세요.
                  </p>
                </div>
              ) : (
                <div className="h-full overflow-y-auto pr-1">
                  <div className="space-y-3">
                    {pricingPolicies.map((policy) => {
                      const isSelected = selectedPolicyId === policy.id
                      const isExpanded = expandedPolicyIds.includes(policy.id)
                      return (
                        <div
                          key={policy.id}
                          className={`
                            relative rounded-xl transition-all duration-200 border-2 overflow-hidden
                            ${isSelected
                              ? 'border-blue-500 bg-blue-50/50 shadow-md shadow-blue-100'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                            }
                          `}
                        >
                          {/* 카드 헤더 (클릭하여 선택) */}
                          <div
                            className={`p-4 cursor-pointer transition-colors ${
                              isSelected ? 'hover:bg-blue-100/50' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => setSelectedPolicyId(policy.id)}
                          >
                            <div className="flex items-center gap-3">
                              {/* 선택 체크박스 */}
                              <div className={`
                                w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                                ${isSelected
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                                }
                              `}>
                                {isSelected && (
                                  <CheckCircle size={14} className="text-white" />
                                )}
                              </div>

                              {/* 정책 정보 */}
                              <div className="flex-1 min-w-0">
                                <h4 className={`font-semibold text-base ${
                                  isSelected ? 'text-blue-900' : 'text-gray-900'
                                }`}>
                                  {policy.name}
                                </h4>
                                {policy.description && (
                                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                                    {policy.description}
                                  </p>
                                )}
                              </div>

                              {/* 펼치기/접기 버튼 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTogglePolicyExpand(policy.id)
                                }}
                                className={`
                                  p-1.5 rounded-lg transition-colors flex-shrink-0
                                  ${isSelected
                                    ? 'hover:bg-blue-200/50 text-blue-600'
                                    : 'hover:bg-gray-200 text-gray-400'
                                  }
                                `}
                              >
                                {isExpanded ? (
                                  <ChevronUp size={20} />
                                ) : (
                                  <ChevronDown size={20} />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* 펼쳐진 내용 */}
                          {isExpanded && (
                            <div className={`
                              px-4 pb-4 border-t
                              ${isSelected ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'}
                            `}>
                              <div className={`
                                mt-3 p-4 rounded-lg text-sm leading-relaxed
                                ${isSelected ? 'bg-white' : 'bg-gray-50'}
                              `}>
                                <p className="text-gray-700 whitespace-pre-wrap">
                                  {policy.content}
                                </p>
                              </div>
                              <div className="flex items-center justify-end mt-3">
                                <span className="text-xs text-gray-400">
                                  수정일: {new Date(policy.updatedAt).toLocaleDateString('ko-KR')}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                {selectedPolicyId && (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-blue-500" />
                    <span className="text-blue-600 font-medium">
                      {pricingPolicies.find(p => p.id === selectedPolicyId)?.name}
                    </span>
                    선택됨
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleCloseRegisterModal}>
                  취소
                </Button>
                <Button
                  variant="primary"
                  onClick={handlePricingNext}
                  disabled={!selectedPolicyId || pricingPolicies.length === 0}
                >
                  다음 단계
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: 게시물 선택 (다중 선택) */}
        {modalStep === 'select' && (
          <div className="flex flex-col h-[700px]">
            {/* 플랫폼 선택 탭 - 고정 */}
            <div className="flex-shrink-0 pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                플랫폼 선택
              </label>
              <div className="flex flex-wrap gap-2">
                {availablePlatforms.map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => handlePlatformSelect(platform)}
                    disabled={isLoadingPosts}
                    className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      selectedPlatform === platform
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    } ${isLoadingPosts ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {PLATFORM_LABELS[platform] || platform}
                  </button>
                ))}
                {availablePlatforms.length === 0 && !isLoadingPosts && (
                  <span className="text-sm text-gray-500">등록된 플랫폼이 없습니다</span>
                )}
              </div>
            </div>

            {/* 게시물 목록 영역 - 스크롤 가능 */}
            <div className="flex-1 min-h-0 border border-gray-200 rounded-lg overflow-hidden">
              {isLoadingPosts ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <Loading />
                  <p className="text-center text-gray-600 mt-4">
                    {PLATFORM_LABELS[selectedPlatform] || selectedPlatform} 게시물을 불러오는 중...
                  </p>
                </div>
              ) : availablePosts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <Package size={48} className="text-gray-300" />
                  <div className="text-center mt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">변환 가능한 게시물이 없습니다</h3>
                    <p className="text-gray-600">게시물 관리에서 먼저 게시물을 추가해주세요.</p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* 전체 선택 버튼 헤더 */}
                  <div className="flex-shrink-0 p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      총 {availablePosts.length}개 게시물
                    </span>
                    <button
                      onClick={handleSelectAllPosts}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        isAllPostsSelected
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isAllPostsSelected ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>
                  {/* 게시물 목록 */}
                  <div className="flex-1 overflow-y-auto p-2">
                  <div className="space-y-2">
                    {availablePosts.map((post) => {
                      const isSelected = selectedPostIds.includes(post.id)
                      const isExpanded = expandedPostIds.includes(post.id)
                      return (
                        <div
                          key={post.id}
                          className={`
                            border rounded-lg transition-colors
                            ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200'
                            }
                          `}
                        >
                          {/* 간략 정보 */}
                          <div
                            className={`p-4 cursor-pointer transition-colors ${
                              isSelected
                                ? 'hover:bg-blue-100'
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => handleTogglePostSelect(post)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {post.images?.[0] && (
                                  <img
                                    src={post.images[0].url}
                                    alt=""
                                    className="w-16 h-16 rounded object-cover flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-gray-900 truncate">{post.title}</h4>
                                  <p className="text-sm text-gray-500 mt-1">
                                    {post.channel.name} · {post.author || '알 수 없음'}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTogglePostExpand(post.id)
                                }}
                                className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                              >
                                {isExpanded ? (
                                  <ChevronUp size={20} className="text-gray-400" />
                                ) : (
                                  <ChevronDown size={20} className="text-gray-400" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* 상세 정보 (확장 시) */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-gray-200">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {post.content}
                                  </p>
                                </div>
                                {post.images && post.images.length > 0 && (
                                  <div>
                                    <div className="flex gap-2 mt-1 overflow-x-auto">
                                      {post.images.slice(0, 4).map((img, idx) => (
                                        <img
                                          key={idx}
                                          src={img.url}
                                          alt={`이미지 ${idx + 1}`}
                                          className="w-20 h-20 rounded object-cover flex-shrink-0"
                                        />
                                      ))}
                                      {post.images.length > 4 && (
                                        <div className="w-20 h-20 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                                          <span className="text-xs text-gray-600">+{post.images.length - 4}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-gray-400">
                                    출처: {post.channel.name}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleTogglePostExpand(post.id)
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                  >
                                    <ChevronUp size={16} />
                                    접기
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  </div>
                </div>
              )}
            </div>

            {/* 선택 정보 및 Footer - 하단 고정 */}
            <div className="flex-shrink-0 pt-4 flex items-center justify-between border-t border-gray-200 mt-4">
              <p className="text-sm text-gray-500">
                {selectedPostIds.length > 0
                  ? `${selectedPostIds.length}개 게시물 선택됨`
                  : `전체 ${availablePosts.length}개 게시물`}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => {
                  // 이전 단계로 돌아갈 때 선택 상태 초기화
                  setSelectedPostIds([])
                  setSelectedPosts([])
                  setExpandedPostIds([])
                  setModalStep('pricing')
                }}>
                  이전
                </Button>
                <Button
                  variant="primary"
                  onClick={handleTransform}
                  disabled={selectedPostIds.length === 0}
                >
                  {selectedPostIds.length > 0
                    ? `선택한 상품 등록`
                    : '게시물 선택'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: AI 변환 중 (진행 상황 표시) */}
        {modalStep === 'transforming' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                AI가 게시물을 분석하고 있습니다...
              </h3>
              <p className="text-gray-600 mb-4">잠시만 기다려주세요.</p>
              {/* 진행 상황 */}
              <div className="text-sm text-blue-600 font-medium">
                {currentProcessingIndex} / {selectedPosts.length} 처리 중
              </div>
              <div className="w-64 h-2 bg-gray-200 rounded-full mt-2 mx-auto">
                <div
                  className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${(currentProcessingIndex / selectedPosts.length) * 100}%` }}
                />
              </div>
              {selectedPosts[currentProcessingIndex - 1] && (
                <p className="text-xs text-gray-500 mt-2 truncate max-w-xs">
                  {selectedPosts[currentProcessingIndex - 1].title}
                </p>
              )}
            </div>
          </div>
        )}

      </Modal>
    </div>
  )
}
