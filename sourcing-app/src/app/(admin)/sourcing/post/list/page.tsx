'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Trash2, AlertCircle, ChevronDown, ChevronRight, ChevronUp, FileText, Store, Package, Send, ArrowLeft } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'

type ChannelPlatform = 'BAND' | 'NAVER_CAFE' | 'ALIEXPRESS'

interface Channel {
  id: number
  name: string
  channelKey: string
  coverUrl: string | null
  kind: string
  platform: string
  _count?: {
    posts: number
  }
}

interface PostImage {
  id: number
  url: string
  sortOrder: number
}

interface Post {
  id: number
  userId: number
  channelId: number
  externalId: string
  title: string
  content: string
  author: string | null
  createdAt: string
  updatedAt: string
  channel: {
    id: number
    name: string
    channelKey: string
    coverUrl: string | null
  }
  images: PostImage[]
}

interface ProcessedProduct {
  id: number
  name: string
  thumbnailUrl: string | null
  price: number | null
  wholesalePrice: number | null
  createdAt: string
  channel: {
    id: number
    name: string
    coverUrl: string | null
  } | null
  variants: Array<{ id: number; price: number }>
}

interface AvailablePost {
  post_key: string
  title: string
  content: string
  author: string
  created_at: number | null
  images: string[]
  comments: Array<{
    comment_key: string
    author: string
    content: string
  }>
  channel: {
    id: number
    name: string
    channelKey: string
    coverUrl: string | null
  }
}

const PLATFORM_OPTIONS: { value: ChannelPlatform; label: string }[] = [
  { value: 'BAND', label: '밴드' },
]

type AddMode = 'BAND' | 'URL' | 'MANUAL' | 'SETTINGS'

export default function PostsManagePage() {
  const router = useRouter()
  const toast = useToast()
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  // 채널(소싱처) 필터 관련 상태
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  // 게시물 선택 삭제 관련 상태
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([])
  const [selectAllPosts, setSelectAllPosts] = useState(false)

  // 삭제 확인 모달 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // AI 가공 진행 상태
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0, failed: 0 })
  const [showAiConfirm, setShowAiConfirm] = useState(false)

  // 2단계 뷰: 'collecting' = 수집 게시물, 'processed' = 가공 완료 상품
  const [viewMode, setViewMode] = useState<'collecting' | 'processed'>('collecting')
  const [processedProducts, setProcessedProducts] = useState<ProcessedProduct[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishProgress, setPublishProgress] = useState({ current: 0, total: 0, failed: 0 })

  // 게시물 추가 모달 관련 상태
  const [selectedPlatform, setSelectedPlatform] = useState<ChannelPlatform>('BAND')
  const [availablePosts, setAvailablePosts] = useState<AvailablePost[]>([])
  const [selectedPostKeys, setSelectedPostKeys] = useState<string[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [selectAll, setSelectAll] = useState(false)
  const [expandedPostKeys, setExpandedPostKeys] = useState<string[]>([])
  const [expandedChannelKeys, setExpandedBandKeys] = useState<string[]>([])
  const [platformDataLoaded, setPlatformDataLoaded] = useState<Record<ChannelPlatform, boolean>>({
    BAND: false,
    NAVER_CAFE: false,
    ALIEXPRESS: false,
  })

  // 게시물 등록 진행 상태
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)

  // 추가 모드 상태
  const [addMode, setAddMode] = useState<AddMode>('BAND')

  // URL 수집 폼
  const [urlInput, setUrlInput] = useState('')
  const [urlSubmitting, setUrlSubmitting] = useState(false)
  const [urlResult, setUrlResult] = useState<{ success: boolean; message: string } | null>(null)

  // 직접 등록 폼
  const [manualForm, setManualForm] = useState({
    title: '',
    content: '',
    price: '',
    images: [] as string[],
    channelId: '',
  })

  // 조건 설정
  const [filterDays, setFilterDays] = useState(1)
  const [filterSearch, setFilterSearch] = useState('')

  // 채널 목록 로드
  const loadChannels = useCallback(async () => {
    try {
      setIsLoadingChannels(true)
      const response = await fetch('/api/channel?limit=100&kind=WHOLESALE')
      const data = await response.json()

      if (data.success) {
        setChannels(data.data || [])
      } else {
        console.error('채널 조회 실패:', data.error)
        setChannels([])
      }
    } catch (error) {
      console.error('채널 목록 조회 실패:', error)
      setChannels([])
    } finally {
      setIsLoadingChannels(false)
    }
  }, [])

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  const loadPosts = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        search: searchTerm,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })
      if (selectedChannelId) {
        params.set('channelId', selectedChannelId.toString())
      }
      const response = await fetch(`/api/post?${params}`)
      const data = await response.json()

      if (data.success) {
        setPosts(data.data || [])
        setTotalItems(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)
      } else {
        console.error('게시물 조회 실패:', data.error)
        setPosts([])
        setTotalItems(0)
        setTotalPages(1)
      }
    } catch (error) {
      console.error('게시물 목록 조회 실패:', error)
      setPosts([])
      setTotalItems(0)
      setTotalPages(1)
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, selectedChannelId, searchTerm, itemsPerPage])

  useEffect(() => {
    setSelectedPostIds([])
    setSelectAllPosts(false)
    loadPosts()
  }, [loadPosts])

  const handleChannelFilter = (channelId: number | null) => {
    setSelectedChannelId(channelId)
    setCurrentPage(1)
    // 필터 변경 시 선택 상태 초기화
    setSelectedPostIds([])
    setSelectAllPosts(false)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // 페이지 이동 시 선택 상태 초기화
    setSelectedPostIds([])
    setSelectAllPosts(false)
  }

  // 플랫폼별 게시물 로드 함수 (오늘 날짜만 - KST 기준)
  const loadPostsByPlatform = useCallback(async (platform: ChannelPlatform) => {
    setIsLoadingPosts(true)
    setApiError(null)
    setAvailablePosts([])
    setSelectedPostKeys([])
    setSelectAll(false)
    setExpandedPostKeys([])
    setExpandedBandKeys([])

    try {
      const params = new URLSearchParams({ platform })
      if (filterDays) params.set('days', filterDays.toString())
      if (filterSearch) params.set('search', filterSearch)

      const response = await fetch(`/api/post/available?${params}`)
      const data = await response.json()

      if (data.success) {
        setAvailablePosts(data.data)
        setPlatformDataLoaded(prev => ({ ...prev, [platform]: true }))
      } else {
        setApiError(data.error || '게시물 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('게시물 API 조회 실패:', error)
      setApiError('게시물 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoadingPosts(false)
    }
  }, [filterDays, filterSearch])

  // 플랫폼 선택 핸들러
  const handlePlatformSelect = (platform: ChannelPlatform) => {
    setSelectedPlatform(platform)
    // 플랫폼 변경 시 선택 상태 초기화
    setSelectedPostKeys([])
    setSelectAll(false)
    setExpandedPostKeys([])
    setExpandedBandKeys([])
    // 해당 플랫폼의 게시물 로드
    loadPostsByPlatform(platform)
  }

  const handleOpenAddModal = async () => {
    // 모달 상태 초기화
    setSelectedPlatform('BAND')
    setAvailablePosts([])
    setSelectedPostKeys([])
    setSelectAll(false)
    setExpandedPostKeys([])
    setExpandedBandKeys([])
    setApiError(null)
    setPlatformDataLoaded({
      BAND: false,
      NAVER_CAFE: false,
      ALIEXPRESS: false,
    })
    setShowAddModal(true)

    // 기본 플랫폼(BAND)의 게시물 로드
    loadPostsByPlatform('BAND')
  }

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedPostKeys([])
      setSelectAll(false)
    } else {
      const allPostKeys = availablePosts.map(post => post.post_key)
      setSelectedPostKeys(allPostKeys)
      setSelectAll(true)
    }
  }

  const handleToggleModalPostSelection = (postKey: string) => {
    setSelectedPostKeys((prev) => {
      const newSelection = prev.includes(postKey)
        ? prev.filter((key) => key !== postKey)
        : [...prev, postKey]

      // 전체선택 상태 업데이트
      setSelectAll(newSelection.length === availablePosts.length)
      return newSelection
    })
  }

  const handleToggleExpand = (postKey: string) => {
    setExpandedPostKeys((prev) =>
      prev.includes(postKey)
        ? prev.filter((key) => key !== postKey)
        : [...prev, postKey]
    )
  }

  const handleToggleChannelExpand = (bandKey: string) => {
    setExpandedBandKeys((prev) =>
      prev.includes(bandKey)
        ? prev.filter((key) => key !== bandKey)
        : [...prev, bandKey]
    )
  }

  // 채널별 전체선택/해제 핸들러
  const handleToggleChannelSelectAll = (channelKey: string, channelPostKeys: string[]) => {
    const allSelected = channelPostKeys.every(key => selectedPostKeys.includes(key))

    if (allSelected) {
      // 해당 채널의 게시물만 선택 해제
      setSelectedPostKeys(prev => prev.filter(key => !channelPostKeys.includes(key)))
    } else {
      // 해당 채널의 게시물 전체 선택 (중복 제거)
      setSelectedPostKeys(prev => {
        const newSelection = new Set([...prev, ...channelPostKeys])
        return Array.from(newSelection)
      })
    }

    // 전체선택 상태 업데이트
    setSelectAll(false)
  }

  // 채널별로 게시물 그룹화
  const groupedPosts = availablePosts.reduce((acc, post) => {
    const channelKey = post.channel.channelKey
    if (!acc[channelKey]) {
      acc[channelKey] = {
        channel: post.channel,
        posts: [],
      }
    }
    acc[channelKey].posts.push(post)
    return acc
  }, {} as Record<string, { channel: { id: number; name: string; channelKey: string; coverUrl: string | null }; posts: AvailablePost[] }>)

  const handleAddSelectedPosts = async () => {
    if (selectedPostKeys.length === 0) {
      return
    }

    // TODO: 실제로는 userId를 세션에서 가져와야 함
    const selectedPosts = availablePosts.filter((post) =>
      selectedPostKeys.includes(post.post_key)
    )

    // 진행 상태 초기화
    setIsSubmitting(true)
    setCurrentIndex(0)
    setTotalCount(selectedPosts.length)
    setFailedCount(0)

    let successCount = 0
    let failed = 0

    try {
      for (let i = 0; i < selectedPosts.length; i++) {
        const post = selectedPosts[i]
        setCurrentIndex(i + 1)

        try {
          const response = await fetch('/api/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelId: post.channel.id, // 게시물의 출처 채널 ID
              externalId: post.post_key,
              title: post.title,
              content: post.content,
              author: post.author,
              comments: post.comments || [], // 댓글 추가
              images: post.images || [], // 이미지 추가
            }),
          })

          const data = await response.json()
          if (data.success) {
            successCount++
          } else {
            failed++
            setFailedCount(prev => prev + 1)
          }
        } catch (error) {
          console.error(`게시물 등록 실패 (${post.post_key}):`, error)
          failed++
          setFailedCount(prev => prev + 1)
        }
      }

      setShowAddModal(false)
      setSelectedPostKeys([])
      setExpandedPostKeys([])
      setExpandedBandKeys([])
      loadPosts()
    } catch (error) {
      console.error('게시물 등록 중 오류:', error)
    } finally {
      setIsSubmitting(false)
      setCurrentIndex(0)
      setTotalCount(0)
      setFailedCount(0)
    }
  }


  const handleDeletePost = (id: number) => {
    setDeleteTargetId(id)
    setShowDeleteConfirm(true)
  }

  const confirmDeletePost = async () => {
    if (deleteTargetId === null) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/post?id=${deleteTargetId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('게시물이 삭제되었습니다.')
        loadPosts()
      } else {
        toast.error('게시물 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('게시물 삭제 실패:', error)
      toast.error('게시물 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
    }
  }

  // 전체 선택/해제
  const handleToggleSelectAllPosts = () => {
    if (selectAllPosts) {
      setSelectedPostIds([])
      setSelectAllPosts(false)
    } else {
      const allPostIds = posts.map(post => post.id)
      setSelectedPostIds(allPostIds)
      setSelectAllPosts(true)
    }
  }

  // 개별 게시물 선택/해제
  const handleTogglePostSelection = (postId: number) => {
    setSelectedPostIds((prev) => {
      const newSelection = prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId]

      setSelectAllPosts(newSelection.length === posts.length)
      return newSelection
    })
  }

  // 선택한 게시물 일괄 삭제
  const handleDeleteSelectedPosts = () => {
    if (selectedPostIds.length === 0) {
      return
    }
    setDeleteTargetId(null) // null means batch delete
    setShowDeleteConfirm(true)
  }

  const confirmDeleteSelectedPosts = async () => {
    setIsDeleting(true)
    try {
      let successCount = 0
      let failCount = 0

      for (const postId of selectedPostIds) {
        try {
          const response = await fetch(`/api/post?id=${postId}`, {
            method: 'DELETE',
          })

          const data = await response.json()

          if (data.success) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          console.error(`게시물 삭제 실패 (ID: ${postId}):`, error)
          failCount++
        }
      }

      setSelectedPostIds([])
      setSelectAllPosts(false)
      setShowDeleteConfirm(false)
      loadPosts()

      if (successCount > 0) {
        toast.success(`${successCount}개의 게시물이 삭제되었습니다.`)
      }
      if (failCount > 0) {
        toast.error(`${failCount}개의 게시물 삭제에 실패했습니다.`)
      }
    } catch (error) {
      console.error('게시물 일괄 삭제 실패:', error)
      toast.error('게시물 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }


  // 선택한 게시물 일괄 AI 가공
  const handleAiProcess = () => {
    if (selectedPostIds.length === 0) return
    setShowAiConfirm(true)
  }

  const confirmAiProcess = async () => {
    setShowAiConfirm(false)
    setIsAiProcessing(true)
    setAiProgress({ current: 0, total: selectedPostIds.length, failed: 0 })

    let successCount = 0
    let failCount = 0
    const createdProductIds: number[] = []

    // 1) 채널별 가격 정책 로드
    const policyMap = new Map<number, string>()
    try {
      const policyRes = await fetch('/api/policy?limit=100')
      if (policyRes.ok) {
        const policyData = await policyRes.json()
        for (const p of (policyData.data || [])) {
          if (p.isActive && !policyMap.has(p.channelId)) {
            policyMap.set(p.channelId, p.content)
          }
        }
      }
    } catch { /* 정책 없이 진행 */ }

    for (let i = 0; i < selectedPostIds.length; i++) {
      const postId = selectedPostIds[i]
      setAiProgress(prev => ({ ...prev, current: i + 1 }))

      try {
        // 게시물의 채널 정보로 정책 찾기
        const post = posts.find(p => p.id === postId)
        const policyContent = post?.channel?.id ? policyMap.get(post.channel.id) : undefined

        // 2) AI draft 생성
        const aiRes = await fetch('/api/product/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId, policyContent }),
        })
        const aiData = await aiRes.json()

        if (!aiData.success || !aiData.draft) {
          failCount++
          setAiProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
          continue
        }

        const draft = aiData.draft

        // 3) Product 생성 (POST /api/product)
        const variants = (draft.variants ?? []).map((v: any) => ({
          optionSummary: v.optionSummary,
          price: v.price ?? draft.price ?? 0,
          wholesalePrice: v.wholesalePrice ?? draft.wholesalePrice ?? null,
        }))

        const productRes = await fetch('/api/product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId,
            channelId: post?.channel?.id ?? null,
            name: draft.name,
            description: draft.description,
            wholesalePrice: draft.wholesalePrice ?? null,
            price: draft.price ?? null,
            options: draft.options ?? [],
            variants,
            shippingFee: draft.shipping?.shippingFee ?? draft.shippingFee ?? null,
            shippingInfo: draft.shipping?.shippingInfo ?? draft.shippingInfo ?? null,
            categoryId: draft.categoryId ?? null,
          }),
        })

        const productData = await productRes.json()

        if (productData.success && productData.data?.id) {
          successCount++
          createdProductIds.push(productData.data.id)
        } else {
          failCount++
          setAiProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
        }
      } catch {
        failCount++
        setAiProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
      }
    }

    setIsAiProcessing(false)
    setSelectedPostIds([])
    setSelectAllPosts(false)
    loadPosts()

    if (successCount > 0) {
      toast.success(`${successCount}개 상품이 AI 가공되었습니다.`)
      // 가공된 상품 로드 후 Stage 2 뷰로 전환
      await loadProcessedProducts(createdProductIds)
      setViewMode('processed')
    }
    if (failCount > 0) {
      toast.error(`${failCount}개 가공에 실패했습니다.`)
    }
  }

  // 가공 완료 상품 로드 (Stage 2)
  const loadProcessedProducts = useCallback(async (productIds: number[]) => {
    if (productIds.length === 0) return
    try {
      const response = await fetch(`/api/product?limit=50&page=1`)
      const data = await response.json()
      if (data.success) {
        const filtered = (data.data || []).filter((p: ProcessedProduct) =>
          productIds.includes(p.id)
        )
        setProcessedProducts(filtered)
      }
    } catch (error) {
      console.error('가공 상품 로드 실패:', error)
    }
  }, [])

  // 상품 발행 (Stage 2 → 소매밴드)
  const handlePublishProducts = async () => {
    if (selectedProductIds.length === 0) {
      toast.error('발행할 상품을 선택해주세요.')
      return
    }

    setIsPublishing(true)
    setPublishProgress({ current: 0, total: selectedProductIds.length, failed: 0 })

    let successCount = 0
    let failCount = 0

    // 소매밴드 채널 목록 조회
    let retailChannels: Array<{ id: number; name: string }> = []
    try {
      const chRes = await fetch('/api/channel?kind=RETAIL&limit=100')
      const chData = await chRes.json()
      retailChannels = chData.data || []
    } catch {
      toast.error('소매밴드 채널 조회에 실패했습니다.')
      setIsPublishing(false)
      return
    }

    if (retailChannels.length === 0) {
      toast.error('등록된 소매밴드 채널이 없습니다. 채널 관리에서 소매밴드를 등록해주세요.')
      setIsPublishing(false)
      return
    }

    for (let i = 0; i < selectedProductIds.length; i++) {
      const productId = selectedProductIds[i]
      setPublishProgress(prev => ({ ...prev, current: i + 1 }))

      let productSuccess = false

      for (const channel of retailChannels) {
        try {
          const res = await fetch('/api/publish/template/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId,
              channelId: channel.id,
              templateType: 'standard',
              showOrderLink: true,
            }),
          })
          const data = await res.json()
          if (data.success || res.ok) productSuccess = true
        } catch {
          // 채널별 실패는 무시하고 다음 채널 시도
        }
      }

      if (productSuccess) {
        successCount++
      } else {
        failCount++
        setPublishProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
      }
    }

    setIsPublishing(false)
    setSelectedProductIds([])

    if (successCount > 0) {
      toast.success(`${successCount}개 상품이 발행되었습니다.`)
      router.push('/sourcing/publish')
    }
    if (failCount > 0) {
      toast.error(`${failCount}개 발행에 실패했습니다.`)
    }
  }

  const truncateText = (text: string, maxLength: number = 20) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...'
    }
    return text
  }

  const formatDateTimeKST = (dateString: string) => {
    const date = new Date(dateString)
    const kstOffset = 9 * 60 * 60 * 1000
    const kstDate = new Date(date.getTime() + kstOffset)

    const year = kstDate.getUTCFullYear()
    const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(kstDate.getUTCDate()).padStart(2, '0')
    const hours = String(kstDate.getUTCHours()).padStart(2, '0')
    const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0')
    const seconds = String(kstDate.getUTCSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 상품소싱하기 버튼 */}
        <div className="mb-6">
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
          >
            <Plus size={18} />
            상품소싱하기
          </button>
        </div>

        {/* 뒤로가기 (Stage 2에서) */}
        {viewMode === 'processed' && (
          <button
            onClick={() => {
              setViewMode('collecting')
              setProcessedProducts([])
              setSelectedProductIds([])
            }}
            className="mb-4 flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            수집 게시물 목록으로 돌아가기
          </button>
        )}

        {/* 헤더 */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {viewMode === 'collecting' ? '수집상품리스트' : 'AI가공 완료 상품'}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {viewMode === 'collecting'
              ? '소싱처에서 수집한 게시물 원본 입니다. AI로 내판매에 가공하면 판매상품으로 변환됩니다.'
              : 'AI 가공이 완료된 상품입니다. 발행할 상품을 선택하고 \'상품발행하기\'를 클릭하세요.'
            }
          </p>
        </div>

        {viewMode === 'collecting' ? (<>
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 bg-gray-100 rounded-lg">
                <FileText size={20} className="sm:w-6 sm:h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">전체미가공게시물</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalItems}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                <Store size={20} className="sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">소싱처 수</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-600">{channels.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 액션 바 (고정) */}
        <div className="bg-gray-900 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3 flex-wrap">
          {viewMode === 'collecting' ? (
            <>
              {selectedPostIds.length > 0 ? (
                <span className="text-sm font-medium text-gray-300">
                  {selectedPostIds.length}개 선택됨
                </span>
              ) : (
                <span className="text-sm text-gray-400">
                  게시물을 선택해주세요
                </span>
              )}
              <div className="w-px h-5 bg-gray-600" />
              {selectedPostIds.length > 0 && (
                <button
                  onClick={() => { setSelectedPostIds([]); setSelectAllPosts(false) }}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  선택 해제
                </button>
              )}
              <button
                onClick={() => {
                  if (selectedPostIds.length === 0) { toast.error('먼저 게시물을 선택해주세요.'); return }
                  handleDeleteSelectedPosts()
                }}
                disabled={isAiProcessing}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                <Trash2 size={15} />
                삭제
              </button>
              <button
                onClick={() => {
                  if (selectedPostIds.length === 0) { toast.error('먼저 게시물을 선택해주세요.'); return }
                  handleAiProcess()
                }}
                disabled={isAiProcessing}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                <Package size={15} />
                {isAiProcessing
                  ? `AI 가공 중... (${aiProgress.current}/${aiProgress.total})`
                  : 'AI로 가공하기'
                }
              </button>
            </>
          ) : (
            <>
              {selectedProductIds.length > 0 ? (
                <span className="text-sm font-medium text-gray-300">
                  {selectedProductIds.length}개 상품 선택됨
                </span>
              ) : (
                <span className="text-sm text-gray-400">
                  발행할 상품을 선택해주세요
                </span>
              )}
              <div className="w-px h-5 bg-gray-600" />
              {selectedProductIds.length > 0 && (
                <button
                  onClick={() => setSelectedProductIds([])}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  선택 해제
                </button>
              )}
              <button
                onClick={handlePublishProducts}
                disabled={isPublishing || selectedProductIds.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                <Send size={15} />
                {isPublishing
                  ? `발행 중... (${publishProgress.current}/${publishProgress.total})`
                  : '상품발행하기'
                }
              </button>
            </>
          )}
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* 왼쪽: 소싱처 필터 */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto w-full lg:w-auto max-w-full min-w-0 scrollbar-hide lg:scrollbar-thin">
                <button
                  onClick={() => handleChannelFilter(null)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedChannelId === null
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  전체
                </button>
                {isLoadingChannels ? (
                  <span className="px-3 py-1.5 text-sm text-gray-400">로딩중...</span>
                ) : (
                  channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => handleChannelFilter(channel.id)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                        selectedChannelId === channel.id
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
                      <span className="max-w-[120px] truncate">{channel.name}</span>
                    </button>
                  ))
                )}
              </div>

              {/* 오른쪽: 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  type="text"
                  placeholder="제목으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>

          {/* 목록 */}
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : posts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              수집된 게시물이 없습니다.
            </div>
          ) : (
            <>
              {/* 모바일: 카드 뷰 */}
              <div className="lg:hidden p-3 space-y-3">
                {/* 전체 선택 */}
                <div className="flex items-center gap-2 px-1 pb-2 border-b border-gray-100">
                  <input
                    type="checkbox"
                    checked={selectAllPosts}
                    onChange={handleToggleSelectAllPosts}
                    className="w-5 h-5 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">전체 선택</span>
                </div>
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {/* 상단: 체크박스 + 날짜 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedPostIds.includes(post.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleTogglePostSelection(post.id)
                          }}
                          className="w-5 h-5 cursor-pointer flex-shrink-0"
                        />
                        <div
                          className="cursor-pointer"
                          onClick={() => router.push(`/sourcing/post/detail/${post.id}`)}
                        >
                          <span className="text-xs text-gray-500">
                            {formatDateTimeKST(post.createdAt)}
                          </span>
                        </div>
                      </div>
                      {/* 출처 밴드 배지 */}
                      <div
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-100 text-purple-700 cursor-pointer"
                        onClick={() => router.push(`/sourcing/post/detail/${post.id}`)}
                      >
                        {post.channel.coverUrl ? (
                          <img
                            src={post.channel.coverUrl}
                            alt={post.channel.name}
                            className="w-4 h-4 rounded object-cover"
                          />
                        ) : (
                          <Store size={12} />
                        )}
                        <span className="text-xs font-medium truncate max-w-[100px]">{post.channel.name}</span>
                      </div>
                    </div>

                    {/* 제목 */}
                    <div
                      className="mb-3 cursor-pointer"
                      onClick={() => router.push(`/sourcing/post/detail/${post.id}`)}
                    >
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {post.title}
                      </p>
                    </div>

                    {/* 하단: 작성자 */}
                    <div
                      className="flex items-center justify-between pt-3 border-t border-gray-100 cursor-pointer"
                      onClick={() => router.push(`/sourcing/post/detail/${post.id}`)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">작성자</span>
                        <span className="text-sm font-medium text-gray-900">{post.author || '-'}</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>

              {/* 데스크톱: 테이블 뷰 */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[4%]">
                        <input
                          type="checkbox"
                          checked={selectAllPosts}
                          onChange={handleToggleSelectAllPosts}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableHead>
                      <TableHead className="w-[32%]">제목</TableHead>
                      <TableHead className="w-[15%]">출처 밴드</TableHead>
                      <TableHead className="w-[13%]">작성자</TableHead>
                      <TableHead className="w-[18%]">생성일</TableHead>
                      <TableHead className="w-[18%]">수정일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((post) => (
                      <TableRow
                        key={post.id}
                        className="hover:bg-gray-50"
                      >
                        <TableCell className="w-[4%]">
                          <input
                            type="checkbox"
                            checked={selectedPostIds.includes(post.id)}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleTogglePostSelection(post.id)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell
                          className="w-[32%] cursor-pointer"
                          onClick={() => router.push(`/sourcing/post/detail/${post.id}`)}
                        >
                          <div className="font-medium text-gray-900 truncate">
                            {truncateText(post.title, 50)}
                          </div>
                        </TableCell>
                        <TableCell
                          className="w-[15%] cursor-pointer"
                          onClick={() => router.push(`/sourcing/post/detail/${post.id}`)}
                        >
                          <div className="flex items-center gap-2">
                            {post.channel.coverUrl ? (
                              <img
                                src={post.channel.coverUrl}
                                alt={post.channel.name}
                                className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <span className="text-gray-400 text-xs">No</span>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-gray-900 truncate text-sm">{post.channel.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          className="w-[13%] cursor-pointer"
                          onClick={() => router.push(`/sourcing/post/detail/${post.id}`)}
                        >
                          <span className="text-gray-600">{post.author || '-'}</span>
                        </TableCell>
                        <TableCell
                          className="w-[18%] cursor-pointer"
                          onClick={() => router.push(`/sourcing/post/detail/${post.id}`)}
                        >
                          <span className="text-gray-600 text-sm">
                            {formatDateTimeKST(post.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell
                          className="w-[18%] cursor-pointer"
                          onClick={() => router.push(`/sourcing/post/detail/${post.id}`)}
                        >
                          <span className="text-gray-600 text-sm">
                            {formatDateTimeKST(post.updatedAt)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
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
        </>) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {processedProducts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              가공된 상품이 없습니다.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.length === processedProducts.length && processedProducts.length > 0}
                      onChange={() => {
                        if (selectedProductIds.length === processedProducts.length) {
                          setSelectedProductIds([])
                        } else {
                          setSelectedProductIds(processedProducts.map(p => p.id))
                        }
                      }}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">이미지</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상품명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">소싱처</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">도매가</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">판매가</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">생성일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processedProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(product.id)}
                        onChange={() => {
                          setSelectedProductIds(prev =>
                            prev.includes(product.id)
                              ? prev.filter(id => id !== product.id)
                              : [...prev, product.id]
                          )
                        }}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {product.thumbnailUrl ? (
                        <img
                          src={product.thumbnailUrl}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                          <Package size={20} className="text-gray-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {product.channel?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {product.wholesalePrice
                        ? `${Number(product.wholesalePrice).toLocaleString()}원`
                        : '-'
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {product.price
                        ? `${product.price.toLocaleString()}원`
                        : <span className="text-orange-500">가격 미설정</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(product.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        )}
      </div>

      {/* 추가 모달 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setApiError(null)
          setAvailablePosts([])
          setSelectedPostKeys([])
          setSelectAll(false)
          setExpandedPostKeys([])
          setExpandedBandKeys([])
        }}
        title="상품소싱하기"
        size="4xl"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddModal(false)
                setApiError(null)
                setAvailablePosts([])
                setSelectedPostKeys([])
                setExpandedPostKeys([])
                setExpandedBandKeys([])
              }}
            >
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleAddSelectedPosts}
              disabled={selectedPostKeys.length === 0 || selectedPlatform !== 'BAND'}
            >
              선택한 게시물 추가 {selectedPostKeys.length > 0 && `(${selectedPostKeys.length}개)`}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* 수집 방법 선택 탭 */}
          <div>
            <div className="flex gap-2 border-b border-gray-200 pb-0">
              {[
                { mode: 'BAND' as AddMode, label: '밴드', icon: '📱' },
                { mode: 'URL' as AddMode, label: 'URL로 수집', icon: '🔗' },
                { mode: 'MANUAL' as AddMode, label: '직접 등록', icon: '✏️' },
              ].map(tab => (
                <button
                  key={tab.mode}
                  type="button"
                  onClick={() => {
                    setAddMode(tab.mode)
                    if (tab.mode === 'BAND') handlePlatformSelect('BAND')
                  }}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    addMode === tab.mode
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* URL 수집 모드 */}
          {addMode === 'URL' && (
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">상품 URL 입력</label>
                <p className="text-xs text-gray-500 mb-3">밴드 게시물 URL을 입력하면 자동으로 수집합니다.</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="https://band.us/band/..."
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button
                    variant="primary"
                    onClick={async () => {
                      if (!urlInput.trim()) return
                      setUrlSubmitting(true)
                      setUrlResult(null)
                      try {
                        const res = await fetch('/api/post/collect-url', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ url: urlInput.trim() }),
                        })
                        const data = await res.json()
                        if (data.success) {
                          setUrlResult({ success: true, message: '게시물이 수집되었습니다.' })
                          setUrlInput('')
                          loadPosts()
                        } else {
                          setUrlResult({ success: false, message: data.error || '수집에 실패했습니다.' })
                        }
                      } catch {
                        setUrlResult({ success: false, message: '네트워크 오류' })
                      } finally {
                        setUrlSubmitting(false)
                      }
                    }}
                    disabled={urlSubmitting || !urlInput.trim()}
                  >
                    {urlSubmitting ? '수집 중...' : '수집하기'}
                  </Button>
                </div>
                {urlResult && (
                  <div className={`mt-3 px-4 py-2 rounded-lg text-sm ${
                    urlResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {urlResult.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 직접 등록 모드 */}
          {addMode === 'MANUAL' && (
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">소싱처 선택 *</label>
                <select
                  value={manualForm.channelId}
                  onChange={e => setManualForm(p => ({ ...p, channelId: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">소싱처를 선택하세요</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상품명 *</label>
                <input
                  type="text"
                  value={manualForm.title}
                  onChange={e => setManualForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="상품명을 입력하세요"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상품 설명 *</label>
                <textarea
                  value={manualForm.content}
                  onChange={e => setManualForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="상품 상세 설명을 입력하세요"
                  rows={5}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">가격</label>
                <input
                  type="number"
                  value={manualForm.price}
                  onChange={e => setManualForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <Button
                variant="primary"
                className="w-full"
                onClick={async () => {
                  if (!manualForm.channelId || !manualForm.title || !manualForm.content) {
                    toast.error('소싱처, 상품명, 설명은 필수입니다.')
                    return
                  }
                  try {
                    const res = await fetch('/api/post', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        channelId: parseInt(manualForm.channelId),
                        externalId: `manual_${Date.now()}`,
                        title: manualForm.title,
                        content: manualForm.content,
                        author: '직접등록',
                      }),
                    })
                    const data = await res.json()
                    if (data.success) {
                      toast.success('게시물이 등록되었습니다.')
                      setManualForm({ title: '', content: '', price: '', images: [], channelId: '' })
                      loadPosts()
                      setShowAddModal(false)
                    } else {
                      toast.error(data.error || '등록에 실패했습니다.')
                    }
                  } catch {
                    toast.error('네트워크 오류')
                  }
                }}
              >
                게시물 직접 등록
              </Button>
            </div>
          )}

          {/* 밴드 수집 모드 */}
          {addMode === 'BAND' && (
          <>
          {/* 수집 조건 설정 + 조회 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">수집 기간</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-500">최근</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={filterDays}
                    onChange={e => setFilterDays(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center"
                  />
                  <span className="text-sm text-gray-500">일</span>
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">상품 검색 키워드</label>
                <input
                  type="text"
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  placeholder="키워드 입력 (예: 해산물, 전복)"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={() => loadPostsByPlatform('BAND')}
                disabled={isLoadingPosts}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoadingPosts ? '조회 중...' : '조회'}
              </button>
            </div>
          </div>

          {/* 게시물 목록 영역 - 고정 높이 */}
          <div className="h-[700px] overflow-hidden">
            {isLoadingPosts ? (
              <div className="h-full flex flex-col items-center justify-center">
                <Loading />
                <p className="text-center text-gray-600 mt-4">
                  밴드 게시물을 불러오는 중...
                </p>
              </div>
            ) : apiError ? (
              <div className="h-full flex flex-col items-center justify-center">
                <AlertCircle className="text-red-500" size={48} />
                <div className="text-center mt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">게시물 조회 오류</h3>
                  <p className="text-gray-600">{apiError}</p>
                </div>
              </div>
            ) : selectedPlatform !== 'BAND' ? (
              // BAND가 아닌 플랫폼은 준비 중 표시
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-sm">
                    {selectedPlatform === 'NAVER_CAFE' && '네이버 카페 연동 준비 중'}
                    {selectedPlatform === 'ALIEXPRESS' && '알리익스프레스 연동 준비 중'}
                  </p>
                  <p className="text-xs mt-1">API 설정 후 이용 가능합니다</p>
                </div>
              </div>
            ) : availablePosts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <AlertCircle className="text-yellow-500" size={48} />
                <div className="text-center mt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">게시물이 없습니다</h3>
                  <p className="text-gray-600">
                    밴드에서 수집할 수 있는 게시물이 없습니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col p-3">
                <p className="text-sm text-gray-600 mb-3 text-right">
                  선택: {selectedPostKeys.length}개 / 전체: {availablePosts.length}개
                </p>
                <div className="flex-1 overflow-y-auto space-y-3">
                {Object.entries(groupedPosts).map(([channelKey, group]) => {
                  const isChannelExpanded = expandedChannelKeys.includes(channelKey)
                  const channelPostKeys = group.posts.map(p => p.post_key)
                  const selectedInChannel = channelPostKeys.filter(key => selectedPostKeys.includes(key)).length
                  const allChannelS