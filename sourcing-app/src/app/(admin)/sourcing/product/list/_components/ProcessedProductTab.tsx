'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Trash2, Package, Boxes, CheckCircle, Clock, ShoppingCart, AlertTriangle, Archive, Eye, ChevronDown, ChevronUp, Info, Send, ExternalLink } from 'lucide-react'
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
import { scheduleDelayedPublish, formatScheduledTime } from '@/lib/delayed-publish'

interface Channel {
  id: number
  name: string
  coverUrl: string | null
  platform?: string
}

interface ProductImage {
  id: number
  url: string
}

interface Product {
  id: number
  channelId: number | null
  name: string
  description: string | null
  thumbnailUrl: string | null
  wholesalePrice: number | null
  price: number | null
  currency: string
  createdAt: string
  isActive: boolean
  categoryId?: string | null
  republishedAt?: string | null
  images?: ProductImage[]
  channel?: {
    id: number
    name: string
    coverUrl: string | null
    platform?: string
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
  }>
  publishSummary?: string
}

interface CollectedProduct {
  id: number
  userId: number
  postId: number
  name: string | null
  description: string | null
  currency: string
  isConverted: boolean
  createdAt: string
  rawMetadata: {
    wholesalePrice?: number | null
    price?: number | null
    options?: Array<{
      groupName: string
      values: string[]
    }>
    variants?: Array<{
      optionSummary?: string
      wholesalePrice?: number
      price?: number
    }>
    shipping?: {
      shippingFee?: number
      shippingInfo?: string
    }
  } | null
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
    }>
  }
  products: Array<{
    id: number
    name: string
  }>
}

interface ProcessedProductTabProps {
  onStatsLoaded?: (stats: { total: number; published: number; unpublished: number }) => void
  autoOpenRegister?: boolean
  publishStatus?: 'unpublished' | 'published'
}

export default function ProcessedProductTab({ onStatsLoaded, autoOpenRegister, publishStatus }: ProcessedProductTabProps) {
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
  const [itemsPerPage, setItemsPerPage] = useState<20 | 50 | 100>(20)

  // Stats states (전체 통계)
  const [stats, setStats] = useState({ total: 0, published: 0, unpublished: 0 })

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

  // 수정 모달 상태
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    wholesalePrice: '',
    price: '',
    shippingFee: '',
    variants: [] as Array<{ id: number; optionSummary: string; price: number; wholesalePrice: number | null }>,
  })
  const [isEditSaving, setIsEditSaving] = useState(false)

  // 자동발행 상태
  const [isAutoPublishing, setIsAutoPublishing] = useState(false)
  const [showAutoPublishConfirm, setShowAutoPublishConfirm] = useState(false)
  // 자동발행 모드 선택 (개별/종합/둘다)
  const [autoPublishMode, setAutoPublishMode] = useState<{ individual: boolean; digest: boolean }>({
    individual: true,
    digest: false,
  })
  // 자동발행 지연 (분). 0 = 즉시.
  const [autoPublishDelayMinutes, setAutoPublishDelayMinutes] = useState<number>(0)
  // 예약된 자동발행 취소 핸들러. 예약이 활성 동안 set.
  const [pendingAutoPublishCancel, setPendingAutoPublishCancel] = useState<{
    cancel: () => void
    scheduledAt: number
  } | null>(null)
  // 자동발행 — 발행 대상(소매밴드/쇼핑몰) 다중선택. 재발행 모달과 동일 패턴.
  const [autoPublishAvailableChannels, setAutoPublishAvailableChannels] = useState<{ id: number; name: string }[]>([])
  const [autoPublishAvailableShops, setAutoPublishAvailableShops] = useState<{ id: number; name: string }[]>([])
  const [autoPublishSelectedChannelIds, setAutoPublishSelectedChannelIds] = useState<Set<number>>(new Set())
  const [autoPublishSelectedShopIds, setAutoPublishSelectedShopIds] = useState<Set<number>>(new Set())

  // 발행 방식 선택 모달
  const [showPublishMethodModal, setShowPublishMethodModal] = useState(false)

  // 발행된 상품 삭제 차단 모달 states
  const [showPublishedWarning, setShowPublishedWarning] = useState(false)
  const [publishedProductNames, setPublishedProductNames] = useState<string[]>([])

  // CollectedProduct 등록 모달 states
  const [showCollectedProductModal, setShowCollectedProductModal] = useState(false)
  const [collectedProducts, setCollectedProducts] = useState<CollectedProduct[]>([])
  const [isLoadingCollected, setIsLoadingCollected] = useState(false)
  const [selectedCollectedIds, setSelectedCollectedIds] = useState<number[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [convertingProgress, setConvertingProgress] = useState({ current: 0, total: 0 })

  // 모달 탭 상태 ('collected' | 'manual')
  const [modalTab, setModalTab] = useState<'collected' | 'manual'>('collected')

  // 모달 내 도매처 필터 상태
  const [modalChannelFilter, setModalChannelFilter] = useState<string>('')

  // 정책 자동 적용 관련 상태
  const [channelPolicyMap, setChannelPolicyMap] = useState<Map<number, { policyId: number; content: string } | null>>(new Map())

  // 직접 등록 폼 상태
  const [manualForm, setManualForm] = useState({
    name: '',
    description: '',
    wholesalePrice: '',
    price: '',
    shippingFee: '',
    shippingInfo: '',
  })
  const [isSubmittingManual, setIsSubmittingManual] = useState(false)

  // 일괄 비활성화 관련 상태
  const [showDeactivateSection, setShowDeactivateSection] = useState(false)
  const [deactivateDays, setDeactivateDays] = useState<number>(3)
  const [customDays, setCustomDays] = useState<string>('')
  const [deactivatePreview, setDeactivatePreview] = useState<{
    count: number
    products: Array<{ id: number; name: string; thumbnailUrl: string | null; createdAt: string; channel?: { id: number; name: string } | null }>
    cutoffDate: string
    days: number
  } | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)

  const loadChannels = useCallback(async () => {
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
  }, [toast])

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  // CollectedProduct 등록 관련 함수들
  const handleOpenCollectedProductModal = async () => {
    setShowCollectedProductModal(true)
    setSelectedCollectedIds([])
    setModalTab('collected')
    setModalChannelFilter('')
    setManualForm({
      name: '',
      description: '',
      wholesalePrice: '',
      price: '',
      shippingFee: '',
      shippingInfo: '',
    })
    await loadCollectedProducts('')
  }

  const loadCollectedProducts = async (channelId?: string) => {
    setIsLoadingCollected(true)
    try {
      // 가공상품으로 변환된 적 없는 수집상품 조회
      const params = new URLSearchParams({
        limit: '1000',
        excludeConverted: 'true',
      })
      if (channelId) {
        params.append('channelId', channelId)
      }
      const response = await fetch(`/api/collected-product?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setCollectedProducts(data.data)
      }
    } catch (error) {
      console.error('수집상품 목록 조회 실패:', error)
      toast.error('수집상품 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoadingCollected(false)
    }
  }

  // 모달 내 도매처 필터 변경 핸들러
  const handleModalChannelFilterChange = async (channelId: string) => {
    setModalChannelFilter(channelId)
    setSelectedCollectedIds([])
    await loadCollectedProducts(channelId)
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
          // rawMetadata에서 options, variants, shipping, 가격 추출
          // rawMetadata가 문자열이면 JSON 파싱
          let rawMetadata = selectedCP.rawMetadata as any
          if (typeof rawMetadata === 'string') {
            try {
              rawMetadata = JSON.parse(rawMetadata)
            } catch {
              rawMetadata = null
            }
          }

          // 가격 추출: rawMetadata 직접 → pricing 객체 → variants 첫 번째 항목 순서로 fallback
          const wholesalePrice = rawMetadata?.wholesalePrice
            ?? rawMetadata?.pricing?.wholesalePrice
            ?? rawMetadata?.variants?.[0]?.wholesalePrice
            ?? null
          const price = rawMetadata?.price
            ?? rawMetadata?.pricing?.price
            ?? rawMetadata?.variants?.[0]?.price
            ?? null

          // 가격 정보 validation
          if (wholesalePrice === null || wholesalePrice === undefined) {
            toast.error(`"${selectedCP.name || selectedCP.post.title}" 상품의 도매가 정보가 없습니다.`)
            failCount++
            continue
          }
          if (price === null || price === undefined) {
            toast.error(`"${selectedCP.name || selectedCP.post.title}" 상품의 판매가 정보가 없습니다.`)
            failCount++
            continue
          }

          const options = rawMetadata?.options?.flatMap((opt: { groupName: string; values: string[] }) =>
            opt.values.map((value: string) => ({
              groupName: opt.groupName,
              value,
            }))
          ) || []
          const variants = rawMetadata?.variants?.map((v: { optionSummary?: string; wholesalePrice?: number; price?: number }) => ({
            optionSummary: v.optionSummary || null,
            price: v.price ?? price ?? 0,
            wholesalePrice: v.wholesalePrice ?? wholesalePrice ?? null,
          })) || []
          // shipping 객체 또는 직접 shippingFee/shippingInfo 필드 둘 다 지원
          const shipping = rawMetadata?.shipping || {
            shippingFee: rawMetadata?.shippingFee ?? null,
            shippingInfo: rawMetadata?.shippingInfo ?? null,
          }

          const response = await fetch('/api/product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postId: selectedCP.postId,
              channelId: selectedCP.post?.channel?.id || null,
              name: selectedCP.name || selectedCP.post.title || '상품명 미지정',
              description: selectedCP.description || '',
              wholesalePrice,
              price,
              currency: selectedCP.currency || 'KRW',
              shippingFee: typeof shipping.shippingFee === 'number' ? shipping.shippingFee : undefined,
              shippingInfo: typeof shipping.shippingInfo === 'string' ? shipping.shippingInfo : undefined,
              options,
              variants,
            }),
          })

          const data = await response.json()

          if (data.success) {
            successCount++
          } else {
            toast.error(`"${selectedCP.name || selectedCP.post.title}" 등록 실패: ${data.error || '알 수 없는 오류'}`)
            failCount++
          }
        } catch (error) {
          toast.error(`"${selectedCP.name || selectedCP.post.title}" 등록 중 오류 발생`)
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
    setModalTab('collected')
    setManualForm({
      name: '',
      description: '',
      wholesalePrice: '',
      price: '',
      shippingFee: '',
      shippingInfo: '',
    })
  }

  // 직접 등록 핸들러
  const handleManualSubmit = async () => {
    if (!manualForm.name.trim()) {
      toast.error('상품명을 입력해주세요.')
      return
    }

    setIsSubmittingManual(true)
    try {
      const response = await fetch('/api/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualForm.name.trim(),
          description: manualForm.description.trim() || null,
          wholesalePrice: manualForm.wholesalePrice ? parseInt(manualForm.wholesalePrice) : null,
          price: manualForm.price ? parseInt(manualForm.price) : null,
          shippingFee: manualForm.shippingFee ? parseInt(manualForm.shippingFee) : null,
          shippingInfo: manualForm.shippingInfo.trim() || null,
          currency: 'KRW',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('상품이 등록되었습니다.')
        handleCloseCollectedProductModal()
        loadProducts()
      } else {
        toast.error(data.error || '상품 등록에 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 등록 실패:', error)
      toast.error('상품 등록 중 오류가 발생했습니다.')
    } finally {
      setIsSubmittingManual(false)
    }
  }

  // 일괄 비활성화 미리보기
  const handleDeactivatePreview = async () => {
    const days = customDays ? parseInt(customDays) : deactivateDays
    if (!days || days < 1) {
      toast.error('유효한 기간을 입력해주세요.')
      return
    }

    setIsLoadingPreview(true)
    try {
      const response = await fetch(`/api/product/deactivate?days=${days}`)
      const data = await response.json()

      if (data.success) {
        setDeactivatePreview(data.data)
        if (data.data.count === 0) {
          toast.info('비활성화 대상 상품이 없습니다.')
        }
      } else {
        toast.error(data.error || '미리보기 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('미리보기 조회 실패:', error)
      toast.error('미리보기 조회 중 오류가 발생했습니다.')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // 일괄 비활성화 실행
  const handleDeactivateExecute = async () => {
    const days = customDays ? parseInt(customDays) : deactivateDays
    if (!days || days < 1) {
      toast.error('유효한 기간을 입력해주세요.')
      return
    }

    setIsDeactivating(true)
    try {
      const response = await fetch('/api/product/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success(data.message || `${data.data.deactivatedCount}개 상품이 비활성화되었습니다.`)
        setDeactivatePreview(null)
        setShowDeactivateConfirm(false)
        loadProducts()
      } else {
        toast.error(data.error || '일괄 비활성화에 실패했습니다.')
      }
    } catch (error) {
      console.error('일괄 비활성화 실패:', error)
      toast.error('일괄 비활성화 중 오류가 발생했습니다.')
    } finally {
      setIsDeactivating(false)
    }
  }

  // 기간 선택 변경
  const handleDaysChange = (days: number) => {
    setDeactivateDays(days)
    setCustomDays('')
    setDeactivatePreview(null)
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
      if (publishStatus) params.append('publishStatus', publishStatus)

      const response = await fetch(`/api/product?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data)
        setTotalItems(data.total || 0)
        setTotalPages(Math.ceil((data.total || 0) / itemsPerPage))
        setCurrentPage(page)
        // 전체 통계 설정
        if (data.stats) {
          setStats(data.stats)
          onStatsLoaded?.(data.stats)
        }
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
  }, [selectedChannelId, query, itemsPerPage, publishStatus])

  // 필터 변경 시 1페이지로 리셋하여 조회
  useEffect(() => {
    fetchProducts(1)
  }, [fetchProducts])

  // autoOpenRegister prop으로 게시물 선택 모달 자동 열기
  useEffect(() => {
    if (autoOpenRegister) {
      setShowPostSelectionModal(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenRegister])

  // 새로고침용 함수
  const loadProducts = () => {
    fetchProducts(currentPage)
  }

  const handlePageChange = (page: number) => {
    fetchProducts(page)
  }

  // 채널별 활성 정책 조회 헬퍼 함수
  const fetchPolicyByChannelId = async (channelId: number): Promise<{ policyId: number; content: string } | null> => {
    try {
      const response = await fetch(`/api/policy?channelId=${channelId}&limit=100`)
      const data = await response.json()
      if (data.success && data.data?.length > 0) {
        // 활성화된 정책 중 첫 번째 반환
        const activePolicy = data.data.find((p: any) => p.isActive)
        if (activePolicy) {
          return { policyId: activePolicy.id, content: activePolicy.content }
        }
      }
      return null
    } catch (error) {
      console.error(`채널 ${channelId} 정책 조회 실패:`, error)
      return null
    }
  }

  // 게시물 목록에서 채널 ID 추출 헬퍼 함수
  const fetchPostsChannelInfo = async (postIds: number[]): Promise<Map<number, number>> => {
    const postChannelMap = new Map<number, number>() // postId -> channelId
    try {
      for (const postId of postIds) {
        const response = await fetch(`/api/post/${postId}`)
        const data = await response.json()
        if (data.success && data.data?.channel?.id) {
          postChannelMap.set(postId, data.data.channel.id)
        }
      }
    } catch (error) {
      console.error('게시물 채널 정보 조회 실패:', error)
    }
    return postChannelMap
  }

  // 단일 게시물 선택 (하위 호환성)
  const handlePostSelected = async (postId: number) => {
    await handleMultiplePostsSelected([postId])
  }

  // 다중 게시물 선택 처리 - 정책 자동 적용
  const handleMultiplePostsSelected = async (postIds: number[]) => {
    setShowPostSelectionModal(false)

    // 로딩 표시
    setIsGenerating(true)
    setGeneratingProgress({ current: 0, total: postIds.length })

    try {
      // 1. 게시물별 채널 정보 조회
      const postChannelMap = await fetchPostsChannelInfo(postIds)

      // 2. 고유 채널 ID 추출
      const uniqueChannelIds = [...new Set(postChannelMap.values())]

      // 3. 각 채널별 활성 정책 조회
      const newChannelPolicyMap = new Map<number, { policyId: number; content: string } | null>()
      for (const channelId of uniqueChannelIds) {
        const policy = await fetchPolicyByChannelId(channelId)
        newChannelPolicyMap.set(channelId, policy)
      }
      setChannelPolicyMap(newChannelPolicyMap)

      // 4. 정책 없는 채널 확인
      const channelsWithoutPolicy = uniqueChannelIds.filter(id => !newChannelPolicyMap.get(id))

      if (channelsWithoutPolicy.length > 0) {
        // 정책이 없는 채널이 있으면 정책 선택 모달 표시
        setIsGenerating(false)
        setPendingPostIds(postIds)
        setShowPolicyModal(true)
        return
      }

      // 5. 모든 채널에 정책이 있으면 바로 AI 생성 시작
      await startAIGenerationWithAutoPolicy(postIds, postChannelMap, newChannelPolicyMap)
    } catch (error) {
      console.error('정책 자동 적용 실패:', error)
      setIsGenerating(false)
      // 실패 시 수동 정책 선택으로 폴백
      setPendingPostIds(postIds)
      setShowPolicyModal(true)
    }
  }

  // 자동 정책으로 AI 생성 시작
  const startAIGenerationWithAutoPolicy = async (
    postIds: number[],
    postChannelMap: Map<number, number>,
    policyMap: Map<number, { policyId: number; content: string } | null>
  ) => {
    setSelectedPostIds(postIds)
    setGeneratingProgress({ current: 0, total: postIds.length })

    try {
      const drafts: any[] = []

      // 각 게시물에 대해 AI 상품 생성 (해당 채널의 정책 사용)
      for (let i = 0; i < postIds.length; i++) {
        const postId = postIds[i]
        const channelId = postChannelMap.get(postId)
        const policy = channelId ? policyMap.get(channelId) : null
        const policyContent = policy?.content || null

        // 마지막 사용 정책 저장 (추가 상품 선택 시 재사용)
        if (policyContent && i === 0) {
          setLastUsedPolicyContent(policyContent)
        }

        setGeneratingProgress({ current: i + 1, total: postIds.length })

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
              channelId,
              policyApplied: !!policyContent,
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
              channelId,
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
            channelId,
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
    }
  }

  // 정책 선택 모달에서 선택 시 - 수동 정책 선택 (오버라이드)
  const handleChangePolicyRequest = () => {
    // 현재 선택된 게시물들을 대기열에 저장
    setPendingPostIds(selectedPostIds)
    // 기존 drafts 초기화 (새 정책으로 다시 생성되므로)
    setProductDrafts([])
    // 추가 모드 해제
    setIsAddingMore(false)
    // ProductFormModal 닫기
    setShowProductFormModal(false)
    // 정책 선택 모달 열기
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

  // 상품이 소매밴드에 발행된 적이 있는지 확인
  const hasPublishHistory = (product: Product): boolean => {
    return product.publishedProducts?.some(pp => pp.channelId !== null) || false
  }

  const handleDeleteProduct = (id: number) => {
    const product = products.find(p => p.id === id)
    if (product && hasPublishHistory(product)) {
      setPublishedProductNames([product.name])
      setShowPublishedWarning(true)
      return
    }
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

    // 발행된 상품이 있는지 확인
    const publishedProducts = products.filter(
      p => selectedProductIds.includes(p.id) && hasPublishHistory(p)
    )

    if (publishedProducts.length > 0) {
      setPublishedProductNames(publishedProducts.map(p => p.name))
      setShowPublishedWarning(true)
      return
    }

    setDeleteTargetId(null) // 일괄 삭제 모드
    setShowDeleteConfirm(true)
  }

  // 선택 상품 자동발행 — 재발행 모달과 동일하게 채널/쇼핑몰 목록을 먼저 조회 후 모달 오픈
  const handleAutoPublish = async () => {
    if (selectedProductIds.length === 0) return
    try {
      const [channelRes, shopRes] = await Promise.all([
        fetch('/api/channel?kind=RETAIL&limit=100', { credentials: 'include' }),
        fetch('/api/shop?isActive=true&limit=100', { credentials: 'include' }),
      ])
      const channelData = await channelRes.json()
      const shopData = await shopRes.json()
      const retailChannels: { id: number; name: string }[] = channelData.success ? channelData.data : []
      const allShops: { id: number; name: string; isActive: boolean }[] = shopData.success ? (shopData.data || []) : []
      const activeShops = allShops.filter((s) => s.isActive !== false)

      if (retailChannels.length === 0 && activeShops.length === 0) {
        toast.error('등록된 소매밴드 또는 쇼핑몰이 없습니다.')
        return
      }

      setAutoPublishAvailableChannels(retailChannels)
      setAutoPublishAvailableShops(activeShops.map((s) => ({ id: s.id, name: s.name })))
      // 기본값: 전체 선택 (자동발행은 통상 모든 채널에 발행하는 게 의도이므로)
      setAutoPublishSelectedChannelIds(new Set(retailChannels.map((c) => c.id)))
      setAutoPublishSelectedShopIds(new Set(activeShops.map((s) => s.id)))
      setShowAutoPublishConfirm(true)
    } catch (err: any) {
      toast.error(`채널/쇼핑몰 조회 실패: ${err?.message || '알 수 없음'}`)
    }
  }

  const confirmAutoPublish = async () => {
    setShowAutoPublishConfirm(false)

    if (!autoPublishMode.individual && !autoPublishMode.digest) {
      toast.error('개별발행 또는 종합발행 중 하나 이상을 선택하세요.')
      return
    }

    // 지연 발행 분기: delayMinutes > 0 → setTimeout 으로 예약
    const delay = Math.max(0, Math.floor(autoPublishDelayMinutes || 0))
    if (delay > 0) {
      const scheduledAt = Date.now() + delay * 60 * 1000
      const summary = `${selectedProductIds.length}개 상품`
      const cancel = scheduleDelayedPublish(
        delay,
        () => {
          setPendingAutoPublishCancel(null)
          void runAutoPublishNow()
        },
        { jobKey: 'auto-publish', jobLabel: '자동발행', payloadSummary: summary }
      )
      setPendingAutoPublishCancel({ cancel, scheduledAt })
      toast.success(
        `${delay}분 후 자동발행 예약됨 (${formatScheduledTime(scheduledAt)}) — 탭을 닫으면 취소됩니다.`
      )
      return
    }

    await runAutoPublishNow()
  }

  const runAutoPublishNow = async () => {
    setIsAutoPublishing(true)

    let bandSuccessCount = 0
    let bandFailCount = 0
    let shopSuccessCount = 0
    let shopFailCount = 0
    let shopSkippedCount = 0
    const errorMessages: string[] = []

    // 종합발행 결과 집계
    let digestSuccessCount = 0
    let digestFailCount = 0
    let digestPostCount = 0 // 생성된 게시글 수

    try {
      // 1) 모달에서 사용자가 체크한 채널/쇼핑몰만 대상 (재발행 모달과 동일 패턴).
      // handleAutoPublish 시점에 fetched된 목록을 그대로 사용.
      const retailChannels = autoPublishAvailableChannels.filter((c) =>
        autoPublishSelectedChannelIds.has(c.id)
      )
      const activeShops = autoPublishAvailableShops.filter((s) =>
        autoPublishSelectedShopIds.has(s.id)
      )

      console.log('[자동발행] 선택된 채널:', retailChannels.length, '쇼핑몰:', activeShops.length)

      if (retailChannels.length === 0 && activeShops.length === 0) {
        toast.error('발행할 대상(소매밴드 또는 쇼핑몰)을 1개 이상 선택해주세요.')
        setIsAutoPublishing(false)
        return
      }


      // 2) 개별발행 (선택 시) — 각 상품을 모든 소매밴드 + 모든 쇼핑몰에 발행
      if (autoPublishMode.individual) {
      for (const productId of selectedProductIds) {
        // 2-1) 소매밴드 발행 (Playwright 템플릿)
        for (const channel of retailChannels) {
          try {
            const res = await fetch('/api/publish/template/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productId, channelId: channel.id }),
            })
            const data = await res.json()
            if (data.success || data.publishId) {
              bandSuccessCount++
            } else {
              bandFailCount++
              if (data.error) errorMessages.push(`[밴드:${channel.name}] ${data.error}`)
            }
          } catch (err) {
            bandFailCount++
            errorMessages.push(`[밴드:${channel.name}] 네트워크 오류`)
          }
        }

        // 2-2) 쇼핑몰 발행 (Shop별 ShopProduct 생성)
        for (const shop of activeShops) {
          try {
            const res = await fetch('/api/shop/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productIds: [productId], shopId: shop.id }),
            })
            const data = await res.json()
            console.log(`[자동발행] shopId=${shop.id} (${shop.name}) 응답:`, data)

            if (data.success && data.summary) {
              shopSuccessCount += data.summary.success || 0
              shopSkippedCount += data.summary.skipped || 0
              shopFailCount += data.summary.failed || 0
              if (data.summary.failed > 0 && data.results) {
                data.results
                  .filter((r: any) => r.status === 'FAILED')
                  .forEach((r: any) => errorMessages.push(`[쇼핑몰:${shop.name}] ${r.message || '발행 실패'}`))
              }
            } else {
              // success: false 또는 summary 없음
              shopFailCount++
              const errMsg = data.error || data.message || '알 수 없는 오류'
              errorMessages.push(`[쇼핑몰:${shop.name}] ${errMsg}`)
            }
          } catch (err: any) {
            shopFailCount++
            errorMessages.push(`[쇼핑몰:${shop.name}] ${err?.message || '네트워크 오류'}`)
          }
        }
      }
      } // end if (autoPublishMode.individual)

      // 3) 종합발행 (선택 시) — 개별발행 완료 후 실행
      //    카테고리별로 그룹화 → 20개씩 청크 → 각 청크를 각 채널에 POST /api/publish/digest
      if (autoPublishMode.digest && retailChannels.length > 0) {
        const CHUNK_SIZE = 20
        // 선택 상품 → 카테고리별 그룹핑
        const byCategory: Record<string, number[]> = {}
        for (const pid of selectedProductIds) {
          const p = products.find((x) => x.id === pid)
          const cat = (p?.categoryId && /^(SEA|AGR|MEA|MKT|PRC|HLT|ETC)$/.test(p.categoryId)) ? p.categoryId : 'ETC'
          if (!byCategory[cat]) byCategory[cat] = []
          byCategory[cat].push(pid)
        }

        for (const [category, ids] of Object.entries(byCategory)) {
          for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE)
            digestPostCount++
            for (const channel of retailChannels) {
              try {
                const res = await fetch('/api/publish/digest', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    categoryId: category,
                    productIds: chunk,
                    channelId: channel.id,
                    maxImagesPerProduct: 4,
                  }),
                })
                const data = await res.json()
                if (data.success && data.result?.status === 'SUCCESS') {
                  digestSuccessCount++
                } else {
                  digestFailCount++
                  const msg = data.result?.message || data.error || '종합발행 실패'
                  errorMessages.push(`[종합:${channel.name}/${category}] ${msg}`)
                }
              } catch (err: any) {
                digestFailCount++
                errorMessages.push(`[종합:${channel.name}/${category}] ${err?.message || '네트워크 오류'}`)
              }
            }
          }
        }
      }
    } catch (err: any) {
      toast.error(`자동발행 중 오류: ${err?.message || '알 수 없는 오류'}`)
    } finally {
      setIsAutoPublishing(false)
      setSelectedProductIds([])
      setSelectAll(false)
      loadProducts()

      const totalSuccess = bandSuccessCount + shopSuccessCount + digestSuccessCount
      const totalFail = bandFailCount + shopFailCount + digestFailCount
      if (totalSuccess > 0) {
        const parts: string[] = []
        if (autoPublishMode.individual) {
          parts.push(`소매밴드 ${bandSuccessCount}`)
          parts.push(`쇼핑몰 ${shopSuccessCount}`)
        }
        if (autoPublishMode.digest) {
          parts.push(`종합 ${digestSuccessCount}건/${digestPostCount}게시글`)
        }
        toast.success(`발행 완료: ${parts.join(', ')}${shopSkippedCount > 0 ? ` (이미 발행 ${shopSkippedCount}건)` : ''}`)
      }
      if (totalFail > 0) {
        // 첫 번째 에러 메시지를 사용자에게 표시
        const firstError = errorMessages[0] || ''
        toast.error(`발행 실패 ${totalFail}건: ${firstError}`)
        console.error('[자동발행] 전체 실패 목록:', errorMessages)
      }
    }
  }

  // 선택 상품 수동발행 → 가공상품발행 페이지로 이동
  const handleManualPublish = () => {
    if (selectedProductIds.length === 0) return
    const ids = selectedProductIds.join(',')
    router.push(`/sourcing/publish?productIds=${ids}`)
  }

  // 수정 모달 열기
  const openEditModal = (product: Product) => {
    setEditingProduct(product)
    setEditForm({
      name: product.name || '',
      description: product.description || '',
      wholesalePrice: product.wholesalePrice != null ? String(product.wholesalePrice) : '',
      price: product.price != null ? String(product.price) : '',
      shippingFee: '',
      variants: product.variants?.map(v => ({
        id: v.id,
        optionSummary: (v as any).optionSummary || '',
        price: v.price,
        wholesalePrice: (v as any).wholesalePrice ?? null,
      })) || [],
    })
    setShowEditModal(true)
  }

  // 수정 저장만
  const handleEditSave = async () => {
    if (!editingProduct) return
    setIsEditSaving(true)
    try {
      const res = await fetch(`/api/product/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          wholesalePrice: editForm.wholesalePrice ? Number(editForm.wholesalePrice) : undefined,
          price: editForm.price ? Number(editForm.price) : undefined,
          shippingFee: editForm.shippingFee ? Number(editForm.shippingFee) : undefined,
          variants: editForm.variants.map(v => ({
            id: v.id,
            price: v.price,
            wholesalePrice: v.wholesalePrice,
            optionSummary: v.optionSummary,
          })),
        }),
      })
      if (!res.ok) throw new Error('수정 실패')
      toast.success('상품이 수정되었습니다.')
      setShowEditModal(false)
      setEditingProduct(null)
      loadProducts()
    } catch (err) {
      toast.error('상품 수정에 실패했습니다.')
    } finally {
      setIsEditSaving(false)
    }
  }

  // 수정발행: 저장 → 기존 발행 삭제 → 재발행
  const handleEditAndRepublish = async () => {
    if (!editingProduct) return
    setIsEditSaving(true)
    try {
      // Step 1: 수정 저장
      const saveRes = await fetch(`/api/product/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          wholesalePrice: editForm.wholesalePrice ? Number(editForm.wholesalePrice) : undefined,
          price: editForm.price ? Number(editForm.price) : undefined,
          shippingFee: editForm.shippingFee ? Number(editForm.shippingFee) : undefined,
          variants: editForm.variants.map(v => ({
            id: v.id,
            price: v.price,
            wholesalePrice: v.wholesalePrice,
            optionSummary: v.optionSummary,
          })),
        }),
      })
      if (!saveRes.ok) throw new Error('수정 저장 실패')

      // Step 2: 기존 발행 삭제 (soft-delete)
      await fetch(`/api/shop/publish?productId=${editingProduct.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      // Step 3: 재발행 (발행 API 호출)
      const publishRes = await fetch('/api/shop/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productIds: [editingProduct.id] }),
      })
      if (!publishRes.ok) throw new Error('재발행 실패')

      toast.success('수정발행이 완료되었습니다.')
      setShowEditModal(false)
      setEditingProduct(null)
      loadProducts()
    } catch (err: any) {
      toast.error(err.message || '수정발행에 실패했습니다.')
    } finally {
      setIsEditSaving(false)
    }
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


  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  return (
    <>
        {/* 페이지 크기 선택 툴바 */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">상품보기</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {([20, 50, 100] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setItemsPerPage(size)
                    setCurrentPage(1)
                  }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    itemsPerPage === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {size}개
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 일괄 비활성화 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          {/* 헤더 (토글) */}
          <button
            onClick={() => setShowDeactivateSection(!showDeactivateSection)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Archive size={20} className="text-orange-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">일괄 비활성화</h3>
                <p className="text-sm text-gray-500">오래된 미발행 상품을 일괄 비활성화합니다</p>
              </div>
            </div>
            {showDeactivateSection ? (
              <ChevronUp size={20} className="text-gray-400" />
            ) : (
              <ChevronDown size={20} className="text-gray-400" />
            )}
          </button>

          {/* 콘텐츠 (펼침) */}
          {showDeactivateSection && (
            <div className="border-t border-gray-200 p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* 왼쪽: 기간 선택 + 버튼 */}
                <div className="lg:w-80 flex-shrink-0 space-y-4">
                  {/* 기간 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      기간 선택 (해당 기간 이전 생성)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3].map((days) => (
                        <button
                          key={days}
                          onClick={() => handleDaysChange(days)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                            deactivateDays === days && !customDays
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {days}일
                        </button>
                      ))}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="직접"
                          value={customDays}
                          onChange={(e) => {
                            setCustomDays(e.target.value)
                            setDeactivatePreview(null)
                          }}
                          className="w-20 min-h-[44px]"
                          min={1}
                        />
                        <span className="text-sm text-gray-500">일</span>
                      </div>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={handleDeactivatePreview}
                      disabled={isLoadingPreview}
                      className="min-h-[44px]"
                    >
                      <Eye size={16} className="mr-1" />
                      {isLoadingPreview ? '조회 중...' : '미리보기'}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (!deactivatePreview || deactivatePreview.count === 0) {
                          toast.error('먼저 미리보기를 실행해주세요.')
                          return
                        }
                        setShowDeactivateConfirm(true)
                      }}
                      disabled={!deactivatePreview || deactivatePreview.count === 0 || isDeactivating}
                      className="min-h-[44px] bg-orange-500 hover:bg-orange-600"
                    >
                      <Archive size={16} className="mr-1" />
                      {isDeactivating ? '처리 중...' : '비활성화'}
                    </Button>
                  </div>
                </div>

                {/* 오른쪽: 미리보기 결과 */}
                <div className="flex-1 min-w-0">
                  {deactivatePreview ? (
                    <div className="h-full p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} className="text-orange-600 flex-shrink-0" />
                        <span className="font-medium text-orange-800 text-sm">
                          대상: {deactivatePreview.count}개
                        </span>
                        <span className="text-xs text-orange-600">
                          ({new Date(deactivatePreview.cutoffDate).toLocaleDateString('ko-KR')} 이전)
                        </span>
                      </div>
                      {deactivatePreview.products.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {deactivatePreview.products.slice(0, 8).map((product) => (
                            <div key={product.id} className="flex items-center gap-2 p-1.5 bg-white rounded border border-orange-100">
                              {product.thumbnailUrl ? (
                                <Image
                                  src={product.thumbnailUrl}
                                  alt={product.name}
                                  width={32}
                                  height={32}
                                  className="rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                                  <Package size={14} className="text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 truncate">{product.name}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {product.channel?.name || '채널 없음'} · {new Date(product.createdAt).toLocaleDateString('ko-KR')}
                                </p>
                              </div>
                            </div>
                          ))}
                          {deactivatePreview.count > 8 && (
                            <p className="text-xs text-orange-600 text-center py-1">
                              외 {deactivatePreview.count - 8}개 상품...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
                      <p className="text-sm text-gray-400">미리보기를 클릭하면 대상 상품이 표시됩니다</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 자동 비활성화 설정 (추후 지원) */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-3 opacity-50">
                  <input
                    type="checkbox"
                    disabled
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <div>
                    <span className="text-sm text-gray-700">자동 비활성화 활성화</span>
                    <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">추후 지원</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-8">
                  설정된 기간 이상 된 미발행 상품을 매일 자동으로 비활성화합니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 자동발행 예약 안내 (대기 중) */}
        {pendingAutoPublishCancel && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3 flex items-center justify-between">
            <span className="text-sm text-amber-900">
              ⏳ <strong>{formatScheduledTime(pendingAutoPublishCancel.scheduledAt)}</strong> 에 자동발행 예약됨
              <span className="ml-2 text-xs text-amber-700">(탭 닫으면 취소)</span>
            </span>
            <button
              onClick={() => {
                pendingAutoPublishCancel.cancel()
                setPendingAutoPublishCancel(null)
                toast.success('예약된 자동발행이 취소되었습니다.')
              }}
              className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium"
            >
              예약 취소
            </button>
          </div>
        )}

        {/* 액션 바 (고정) */}
        <div className="bg-gray-900 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3 flex-wrap">
          {selectedProductIds.length > 0 ? (
            <span className="text-sm font-medium text-gray-300">
              {selectedProductIds.length}개 선택됨
            </span>
          ) : (
            <span className="text-sm text-gray-400">
              상품을 선택해주세요
            </span>
          )}
          <div className="w-px h-5 bg-gray-600" />
          {selectedProductIds.length > 0 && (
            <button
              onClick={() => { setSelectedProductIds([]); setSelectAll(false) }}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              선택 해제
            </button>
          )}
          <button
            onClick={() => {
              // 미발행 상품(channelProducts/shopProducts 없음)만 전체 선택
              const unpublishedIds = products
                .filter(p => {
                  const isPublished = (p.publishedChannelIds && p.publishedChannelIds.length > 0)
                    || (p.publishedProducts && p.publishedProducts.length > 0)
                  return !isPublished
                })
                .map(p => p.id)
              if (unpublishedIds.length === 0) {
                toast.info('현재 페이지에 미발행 상품이 없습니다.')
                return
              }
              setSelectedProductIds(unpublishedIds)
              setSelectAll(unpublishedIds.length === products.length)
              toast.success(`미발행 상품 ${unpublishedIds.length}개 선택됨`)
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Clock size={15} />
            미발행선택
          </button>
          <button
            onClick={() => {
              if (selectedProductIds.length === 0) { toast.error('먼저 상품을 선택해주세요.'); return }
              handleDeleteSelected()
            }}
            disabled={isAutoPublishing}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            <Trash2 size={15} />
            삭제
          </button>
          <button
            onClick={() => {
              if (selectedProductIds.length === 0) { toast.error('먼저 상품을 선택해주세요.'); return }
              setShowPublishMethodModal(true)
            }}
            disabled={isAutoPublishing}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            <Send size={15} />
            {isAutoPublishing ? '발행 중...' : '상품발행하기'}
          </button>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <div className="flex flex-col gap-3 sm:gap-4">
              {/* 검색창 - 모바일에서 상단 배치 */}
              <div className="relative w-full sm:w-auto sm:hidden">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  type="text"
                  placeholder="상품명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setQuery(e.target.value) }}
                  className="pl-10 w-full min-h-[44px]"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
                {/* 왼쪽: 출처 채널 필터 */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto w-full sm:w-auto max-w-full min-w-0 scrollbar-hide sm:scrollbar-thin">
                  <button
                    onClick={() => { setSelectedChannelId(''); setCurrentPage(1) }}
                    className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[36px] sm:min-h-[32px] ${
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
                      className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-1.5 whitespace-nowrap min-h-[36px] sm:min-h-[32px] ${
                        selectedChannelId === channel.id.toString()
                          ? 'bg-white shadow-sm text-purple-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {channel.coverUrl ? (
                        <img
                          src={channel.coverUrl}
                          alt={channel.name}
                          className="w-4 h-4 sm:w-5 sm:h-5 rounded object-cover"
                        />
                      ) : (
                        <Boxes size={14} />
                      )}
                      <span className="max-w-[60px] sm:max-w-[100px] truncate">{channel.name}</span>
                    </button>
                  ))}
                </div>

                {/* 오른쪽: 검색창 - 데스크톱 */}
                <div className="relative hidden sm:block">
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
          </div>

          {/* 테이블/카드 뷰 */}
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Package size={48} className="mx-auto mb-4 text-gray-300" />
              <p>등록된 상품이 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 모바일 카드 뷰 */}
              <div className="lg:hidden">
                {/* 전체 선택 헤더 */}
                <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
                  <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleToggleSelectAll}
                      className="w-5 h-5 cursor-pointer rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">전체 선택</span>
                  </label>
                  {selectedProductIds.length > 0 && (
                    <span className="text-sm text-purple-600 font-medium">
                      {selectedProductIds.length}개 선택됨
                    </span>
                  )}
                </div>

                {/* 카드 목록 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className={`bg-white border rounded-lg overflow-hidden transition-all ${
                        selectedProductIds.includes(product.id)
                          ? 'border-purple-500 ring-1 ring-purple-500'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className="p-3 cursor-pointer"
                        onClick={() => router.push(`/product/detail/${product.id}`)}
                      >
                        <div className="flex gap-3">
                          {/* 체크박스 */}
                          <div
                            className="flex items-start pt-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(product.id)}
                              onChange={() => handleToggleSelection(product.id)}
                              className="w-5 h-5 cursor-pointer rounded border-gray-300"
                            />
                          </div>

                          {/* 이미지 */}
                          {product.thumbnailUrl ? (
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              <Image
                                src={product.thumbnailUrl}
                                alt={product.name}
                                fill
                                sizes="64px"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <Package size={24} className="text-gray-400" />
                            </div>
                          )}

                          {/* 상품 정보 */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                              {product.name}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {product.channel?.name || '-'}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              {(() => {
                                const isPublished = (product.publishedChannelIds && product.publishedChannelIds.length > 0)
                                  || (product.publishedProducts && product.publishedProducts.length > 0)
                                const isRepublished = !!product.republishedAt
                                if (isPublished && isRepublished) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                      <CheckCircle size={11} />
                                      재발행완료
                                    </span>
                                  )
                                }
                                return isPublished ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    <CheckCircle size={11} />
                                    발행완료
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                    <Clock size={11} />
                                    미발행
                                  </span>
                                )
                              })()}
                              <span className="text-xs text-gray-500">
                                {new Date(product.createdAt).toLocaleDateString('ko-KR')}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* 수정 버튼 */}
                        <div className="pt-2 border-t border-gray-100 mt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openEditModal(product)}
                            className="w-full px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors"
                          >
                            수정
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 데스크톱 테이블 뷰 */}
              <div className="hidden lg:block">
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
                      <TableHead className="w-[32%]">상품명</TableHead>
                      <TableHead className="w-[15%]">출처 채널</TableHead>
                      <TableHead className="w-[15%]">발행상태</TableHead>
                      <TableHead className="w-[16%]">생성일시</TableHead>
                      <TableHead className="w-[10%]">작업</TableHead>
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
                            {product.channel?.name || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const isPublished = (product.publishedChannelIds && product.publishedChannelIds.length > 0)
                              || (product.publishedProducts && product.publishedProducts.length > 0)
                            const isRepublished = !!product.republishedAt
                            if (isPublished && isRepublished) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  <CheckCircle size={12} />
                                  재발행완료
                                </span>
                              )
                            }
                            return isPublished ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <CheckCircle size={12} />
                                발행완료
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                <Clock size={12} />
                                미발행
                              </span>
                            )
                          })()}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600 whitespace-nowrap">
                            {new Date(product.createdAt).toLocaleString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            }).replace(/\. /g, '-').replace(/\.$/, '').replace(/-(\d{2}:\d{2})$/, ' $1')}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openEditModal(product)}
                            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors"
                          >
                            수정
                          </button>
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
                {generatingProgress.total > 0 && (
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
                  도매처 가격 정책을 자동 적용하여 상품 정보를 추출 중입니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 발행 방식 선택 모달 */}
      {showPublishMethodModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">상품발행하기</h3>
            <p className="text-sm text-gray-500 mb-6">
              선택한 {selectedProductIds.length}개 상품의 발행 방식을 선택하세요.
            </p>

            <button
              onClick={() => {
                setShowPublishMethodModal(false)
                handleAutoPublish()
              }}
              className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors mb-3 text-left"
            >
              <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <Send size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">자동발행</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  등록된 모든 소매밴드 + 쇼핑몰에 동시 일괄 발행합니다.
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                setShowPublishMethodModal(false)
                handleManualPublish()
              }}
              className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors mb-5 text-left"
            >
              <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                <ExternalLink size={18} className="text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">수동발행</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  채널을 직접 선택하여 발행 상세 설정이 가능합니다.
                </p>
              </div>
            </button>

            <button
              onClick={() => setShowPublishMethodModal(false)}
              className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 자동발행 대상 선택 모달 — 재발행 대상 선택과 동일 레이아웃 */}
      {showAutoPublishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAutoPublishConfirm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
              <h3 className="text-lg font-bold text-gray-900">🚀 발행 대상 선택</h3>
              <p className="text-xs text-gray-600 mt-1">
                선택한 <strong>{selectedProductIds.length}개</strong> 상품을 어디에 발행할지 고르세요.
                밴드/쇼핑몰 각각 다중 선택 가능. 1개 이상 선택해야 발행됩니다.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* 발행 모드 (개별/종합) */}
              <div>
                <span className="text-sm font-semibold text-gray-800 mb-2 block">📦 발행 모드</span>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    autoPublishMode.individual ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={autoPublishMode.individual}
                      onChange={(e) => setAutoPublishMode((prev) => ({ ...prev, individual: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">개별발행</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        각 상품별로 독립된 게시글 작성.
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    autoPublishMode.digest ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={autoPublishMode.digest}
                      onChange={(e) => setAutoPublishMode((prev) => ({ ...prev, digest: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">
                        종합발행
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          (카테고리별 20개씩 묶어 1게시글 / {selectedProductIds.length > 0 ? Math.ceil(selectedProductIds.length / 20) : 0}개 예상)
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        SEA/AGR/... 카테고리별로 자동 분류 후 20개 단위로 카드 이미지 게시글 발행.
                      </p>
                    </div>
                  </label>
                </div>
                {autoPublishMode.individual && autoPublishMode.digest && (
                  <div className="mt-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                    ℹ️ 둘 다 선택하면 <b>개별발행 → 종합발행</b> 순서로 실행됩니다.
                  </div>
                )}
              </div>

              {/* 소매밴드 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    🟦 소매밴드 ({autoPublishSelectedChannelIds.size}/{autoPublishAvailableChannels.length})
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setAutoPublishSelectedChannelIds(
                          new Set(autoPublishAvailableChannels.map((c) => c.id))
                        )
                      }
                      className="text-xs px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700"
                    >
                      전체 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoPublishSelectedChannelIds(new Set())}
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      선택 취소
                    </button>
                  </div>
                </div>
                {autoPublishAvailableChannels.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2">등록된 소매밴드가 없습니다.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {autoPublishAvailableChannels.map((ch) => {
                      const checked = autoPublishSelectedChannelIds.has(ch.id)
                      return (
                        <label
                          key={ch.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                            checked
                              ? 'bg-blue-50 border-blue-400 text-blue-900'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setAutoPublishSelectedChannelIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(ch.id)) next.delete(ch.id)
                                else next.add(ch.id)
                                return next
                              })
                            }
                            className="w-4 h-4 rounded border-gray-300 text-blue-600"
                          />
                          <span className="truncate">{ch.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 쇼핑몰 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    🛍️ 쇼핑몰 ({autoPublishSelectedShopIds.size}/{autoPublishAvailableShops.length})
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setAutoPublishSelectedShopIds(
                          new Set(autoPublishAvailableShops.map((s) => s.id))
                        )
                      }
                      className="text-xs px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700"
                    >
                      전체 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoPublishSelectedShopIds(new Set())}
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      선택 취소
                    </button>
                  </div>
                </div>
                {autoPublishAvailableShops.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2">활성 쇼핑몰이 없습니다.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {autoPublishAvailableShops.map((sh) => {
                      const checked = autoPublishSelectedShopIds.has(sh.id)
                      return (
                        <label
                          key={sh.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                            checked
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setAutoPublishSelectedShopIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(sh.id)) next.delete(sh.id)
                                else next.add(sh.id)
                                return next
                              })
                            }
                            className="w-4 h-4 rounded border-gray-300 text-emerald-600"
                          />
                          <span className="truncate">{sh.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 space-y-3">
              {/* 발행 지연 입력 */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-700">⏱️</span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={autoPublishDelayMinutes}
                  onChange={(e) => setAutoPublishDelayMinutes(parseInt(e.target.value || '0', 10) || 0)}
                  className="w-16 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                />
                <span className="text-gray-700">분 후 자동발행</span>
                <span className="text-xs text-gray-400">(0 = 즉시)</span>
                {autoPublishDelayMinutes > 0 && (
                  <span className="ml-auto text-[11px] text-amber-700">
                    ⚠️ 탭 닫으면 예약 취소
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-600">
                  예정: 밴드 {autoPublishSelectedChannelIds.size}개 + 쇼핑몰 {autoPublishSelectedShopIds.size}개
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAutoPublishConfirm(false)}
                    className="px-4 py-2 rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 text-sm"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={confirmAutoPublish}
                    disabled={
                      (!autoPublishMode.individual && !autoPublishMode.digest) ||
                      (autoPublishSelectedChannelIds.size === 0 && autoPublishSelectedShopIds.size === 0)
                    }
                    className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {autoPublishDelayMinutes > 0 ? `${autoPublishDelayMinutes}분 후 발행 예약` : '발행 시작'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ��제 확인 모달 */}
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

      {/* 일괄 비활성화 확인 모달 */}
      <ConfirmModal
        isOpen={showDeactivateConfirm}
        onClose={() => setShowDeactivateConfirm(false)}
        onConfirm={handleDeactivateExecute}
        title="일괄 비활성화"
        message={`${deactivatePreview?.count || 0}개의 미발행 상품을 비활성화하시겠습니까? 비활성화된 상품은 쇼핑몰에서 더 이상 표시되지 않습니다.`}
        confirmText="비활성화"
        variant="danger"
        isLoading={isDeactivating}
      />

      {/* 발행된 상품 삭제 차단 경고 모달 */}
      <Modal
        isOpen={showPublishedWarning}
        onClose={() => {
          setShowPublishedWarning(false)
          setPublishedProductNames([])
        }}
        title="삭제 불가"
        size="md"
      >
        <div className="flex flex-col items-center py-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            발행된 상품은 삭제할 수 없습니다
          </h3>
          <p className="text-sm text-gray-600 text-center mb-4">
            소매밴드에 발행된 기록이 있는 상품은 주문 관리 및 데이터 무결성을 위해 삭제할 수 없습니다.
          </p>
          {publishedProductNames.length > 0 && (
            <div className="w-full bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-xs text-gray-500 mb-2">발행 기록이 있는 상품:</p>
              <ul className="space-y-1">
                {publishedProductNames.map((name, idx) => (
                  <li key={idx} className="text-sm text-gray-700 truncate">
                    • {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={() => {
              setShowPublishedWarning(false)
              setPublishedProductNames([])
            }}
          >
            확인
          </Button>
        </ModalFooter>
      </Modal>

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
          onChangePolicyRequest={handleChangePolicyRequest}
        />
      )}

      {/* 수집상품 선택 모달 */}
      <Modal
        isOpen={showCollectedProductModal}
        onClose={handleCloseCollectedProductModal}
        title="상품 등록"
        size="4xl"
      >
        <div className="flex flex-col h-[calc(80vh-8rem)]">
          {/* 탭 버튼 */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              onClick={() => setModalTab('collected')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                modalTab === 'collected'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              수집상품 선택
            </button>
            <button
              onClick={() => setModalTab('manual')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                modalTab === 'manual'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              직접 등록
            </button>
          </div>

          {/* 탭 콘텐츠 */}
          {modalTab === 'collected' ? (
            // 수집상품 선택 탭
            <>
              {/* 오늘 날짜 안내 */}
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                <Info size={18} className="text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <span className="font-medium">오늘 (KST 기준)</span> 수집된 상품만 표시됩니다.
                </p>
              </div>

              {/* 도매처 필터 */}
              <div className="mb-3 flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => handleModalChannelFilterChange('')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    !modalChannelFilter
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  전체
                </button>
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => handleModalChannelFilterChange(channel.id.toString())}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      modalChannelFilter === channel.id.toString()
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
                          {cp.post?.images?.[0]?.url ? (
                            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              <Image
                                src={cp.post.images[0].url}
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
                              {cp.rawMetadata?.price && (
                                <span className="text-sm font-medium text-gray-900">
                                  ₩{cp.rawMetadata.price.toLocaleString()}
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
            </>
          ) : (
            // 직접 등록 탭
            <>
              <div className="flex-1 overflow-y-auto space-y-4 px-1">
                {/* 상품명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상품명 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={manualForm.name}
                    onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="상품명을 입력하세요"
                  />
                </div>

                {/* 설명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상품 설명
                  </label>
                  <textarea
                    value={manualForm.description}
                    onChange={(e) => setManualForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="상품 설명을 입력하세요"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* 가격 정보 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      도매가 (원)
                    </label>
                    <Input
                      type="number"
                      value={manualForm.wholesalePrice}
                      onChange={(e) => setManualForm(prev => ({ ...prev, wholesalePrice: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      판매가 (원)
                    </label>
                    <Input
                      type="number"
                      value={manualForm.price}
                      onChange={(e) => setManualForm(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* 배송 정보 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      배송비 (원)
                    </label>
                    <Input
                      type="number"
                      value={manualForm.shippingFee}
                      onChange={(e) => setManualForm(prev => ({ ...prev, shippingFee: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      배송 정보
                    </label>
                    <Input
                      value={manualForm.shippingInfo}
                      onChange={(e) => setManualForm(prev => ({ ...prev, shippingInfo: e.target.value }))}
                      placeholder="예: 무료배송, 3일 이내 출고"
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  * 옵션, 변형(사이즈/색상 등), 이미지는 상품 등록 후 상세 페이지에서 추가할 수 있습니다.
                </p>
              </div>

              <ModalFooter>
                <Button variant="secondary" onClick={handleCloseCollectedProductModal}>
                  취소
                </Button>
                <Button
                  variant="primary"
                  onClick={handleManualSubmit}
                  disabled={isSubmittingManual || !manualForm.name.trim()}
                >
                  {isSubmittingManual ? '등록 중...' : '상품 등록'}
                </Button>
              </ModalFooter>
            </>
          )}
        </div>
      </Modal>

      {/* 수정 모달 */}
      {showEditModal && editingProduct && (
        <Modal
          isOpen={showEditModal}
          onClose={() => { setShowEditModal(false); setEditingProduct(null) }}
          title="상품 수정"
          size="lg"
        >
          <div className="space-y-4 p-4">
            {/* 상품명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품명</label>
              <Input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="상품명"
              />
            </div>

            {/* 상품 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품 설명</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="상품 설명"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 가격 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">도매가 (원)</label>
                <Input
                  type="number"
                  value={editForm.wholesalePrice}
                  onChange={(e) => setEditForm(prev => ({ ...prev, wholesalePrice: e.target.value }))}
                  placeholder="도매가"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">판매가 (원)</label>
                <Input
                  type="number"
                  value={editForm.price}
                  onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="판매가"
                />
              </div>
            </div>

            {/* 배송비 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">배송비 (원, 0=무료)</label>
              <Input
                type="number"
                value={editForm.shippingFee}
                onChange={(e) => setEditForm(prev => ({ ...prev, shippingFee: e.target.value }))}
                placeholder="0"
              />
            </div>

            {/* 옵션별 가격 */}
            {editForm.variants.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">옵션별 가격</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {editForm.variants.map((variant, idx) => (
                    <div key={variant.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className="text-xs text-gray-600 flex-1 truncate">{variant.optionSummary || `옵션 ${idx + 1}`}</span>
                      <input
                        type="number"
                        value={variant.price}
                        onChange={(e) => {
                          const newVariants = [...editForm.variants]
                          newVariants[idx] = { ...newVariants[idx], price: Number(e.target.value) }
                          setEditForm(prev => ({ ...prev, variants: newVariants }))
                        }}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-xs text-right"
                        placeholder="판매가"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditingProduct(null) }}>
              취소
            </Button>
            <Button
              variant="secondary"
              onClick={handleEditSave}
              disabled={isEditSaving || !editForm.name.trim()}
            >
              {isEditSaving ? '저장 중...' : '저장만'}
            </Button>
            <Button
              variant="primary"
              onClick={handleEditAndRepublish}
              disabled={isEditSaving || !editForm.name.trim()}
            >
              {isEditSaving ? '처리 중...' : '수정발행'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  )
}
