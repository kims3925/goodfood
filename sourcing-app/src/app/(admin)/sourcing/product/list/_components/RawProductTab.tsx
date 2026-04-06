'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Search, Package, Trash2, Plus, ChevronDown, ChevronRight, ChevronUp, Boxes, CheckCircle, AlertCircle, ExternalLink, RefreshCw, XCircle, Info, Sparkles } from 'lucide-react'
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

// DB에서 가져온 가격 정책 인터페이스 (채널 정보 포함)
interface PricingPolicyItem {
  id: number
  name: string
  description: string | null
  content: string
  isActive: boolean
  channelId: number
  channel: {
    id: number
    name: string
    kind: string
  }
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
  isConverted: boolean
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
}

interface RawProductTabProps {
  onSwitchToProcessed?: () => void
  onTotalLoaded?: (total: number) => void
  autoOpenRegister?: boolean
}

export default function RawProductTab({ onSwitchToProcessed, onTotalLoaded, autoOpenRegister }: RawProductTabProps) {
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
  const itemsPerPage = 20

  // Selection states
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // 선택 상품 일괄 AI 가공 상태
  const [isDirectAiProcessing, setIsDirectAiProcessing] = useState(false)
  const [directAiProgress, setDirectAiProgress] = useState({ current: 0, total: 0, failed: 0 })
  const [showDirectAiConfirm, setShowDirectAiConfirm] = useState(false)

  // Delete confirm modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 상품 등록 모달 states
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [modalStep, setModalStep] = useState<'pricing' | 'select' | 'transforming' | 'result' | 'error'>('select')

  // 에러 상태
  const [errorState, setErrorState] = useState<{
    type: 'network' | 'no_policy' | 'no_posts' | 'no_selectable' | 'transform_failed' | null
    message: string
    details?: string
  }>({ type: null, message: '' })

  // 정책 관련 (채널별 매핑)
  const [pricingPolicies, setPricingPolicies] = useState<PricingPolicyItem[]>([])
  const [channelPolicyMap, setChannelPolicyMap] = useState<Map<number, PricingPolicyItem>>(new Map())
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(null)
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false)
  const [expandedPolicyIds, setExpandedPolicyIds] = useState<number[]>([])

  // 플랫폼/게시물 관련
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([])
  const [availablePosts, setAvailablePosts] = useState<AvailablePost[]>([])
  const [allAvailablePosts, setAllAvailablePosts] = useState<AvailablePost[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([])
  const [selectedPosts, setSelectedPosts] = useState<AvailablePost[]>([])
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0)
  const [expandedPostIds, setExpandedPostIds] = useState<number[]>([])

  // 변환 결과 상태
  const [transformResult, setTransformResult] = useState<{
    success: number
    failed: number
    failedItems: Array<{
      title: string
      error: string
      imageUrl?: string
      channelName?: string
    }>
  }>({ success: 0, failed: 0, failedItems: [] })

  // 시간 측정 상태
  const [transformStartTime, setTransformStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState<number>(0)

  // 경과 시간 업데이트 (1초마다)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    if (modalStep === 'transforming' && transformStartTime) {
      intervalId = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - transformStartTime) / 1000))
      }, 1000)
    }
    // 'result' 모드에서는 시간 유지, 'select'로 돌아가면 초기화
    if (modalStep === 'select' || modalStep === 'pricing') {
      setElapsedTime(0)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [modalStep, transformStartTime])

  // 시간 포맷팅 함수
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`
  }

  // 정책이 있는 게시물만 필터링된 목록
  const postsWithPolicy = useMemo(() => {
    return availablePosts.filter(post => channelPolicyMap.has(post.channel.id))
  }, [availablePosts, channelPolicyMap])

  const postsWithoutPolicy = useMemo(() => {
    return availablePosts.filter(post => !channelPolicyMap.has(post.channel.id))
  }, [availablePosts, channelPolicyMap])

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
        excludeConverted: 'true',
      })

      if (query) params.append('search', query)
      if (selectedChannelId) params.append('channelId', selectedChannelId)

      const response = await fetch(`/api/collected-product?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data)
        const total = data.total || 0
        setTotalItems(total)
        setTotalPages(Math.ceil(total / itemsPerPage))
        setCurrentPage(page)
        onTotalLoaded?.(total)
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

  // autoOpenRegister prop으로 등록 모달 자동 열기
  useEffect(() => {
    if (autoOpenRegister) {
      handleOpenRegisterModal()
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
  // 선택 상품 직접 AI 가공 (모달 없이)
  // =============================================

  const handleDirectAiProcess = () => {
    if (selectedIds.length === 0) return
    setShowDirectAiConfirm(true)
  }

  const confirmDirectAiProcess = async () => {
    setShowDirectAiConfirm(false)
    setIsDirectAiProcessing(true)

    // 선택된 수집상품에서 postId 추출
    const selectedProducts = products.filter(p => selectedIds.includes(p.id))
    const total = selectedProducts.length
    setDirectAiProgress({ current: 0, total, failed: 0 })

    let successCount = 0
    let failCount = 0

    // 채널별 정책 조회
    const policyMap = new Map<number, string>()
    try {
      const policyRes = await fetch('/api/policy?limit=100')
      const policyData = await policyRes.json()
      if (policyData.success) {
        for (const p of policyData.data) {
          if (p.isActive && !policyMap.has(p.channelId)) {
            policyMap.set(p.channelId, p.content)
          }
        }
      }
    } catch {
      // 정책 없이 진행
    }

    for (let i = 0; i < selectedProducts.length; i++) {
      const cp = selectedProducts[i]
      const channelId = cp.post?.channel?.id
      const policyContent = channelId ? policyMap.get(channelId) : undefined

      setDirectAiProgress(prev => ({ ...prev, current: i + 1 }))

      try {
        // AI 생성
        const aiRes = await fetch('/api/product/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: cp.postId, policyContent }),
        })
        const aiData = await aiRes.json()

        if (aiData.success) {
          const draft = aiData.draft
          // collected-product 저장
          const saveRes = await fetch('/api/collected-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postId: cp.postId,
              name: draft.name,
              description: draft.description,
              price: draft.price,
              currency: 'KRW',
              rawMetadata: {
                ...draft,
                shipping: {
                  shippingFee: draft.shippingFee ?? null,
                  shippingInfo: draft.shippingInfo ?? null,
                },
              },
            }),
          })
          const saveData = await saveRes.json()
          if (saveData.success) {
            successCount++
          } else {
            failCount++
            setDirectAiProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
          }
        } else {
          failCount++
          setDirectAiProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
        }
      } catch {
        failCount++
        setDirectAiProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
      }
    }

    setIsDirectAiProcessing(false)
    setSelectedIds([])
    setSelectAll(false)
    loadProducts()

    if (successCount > 0) toast.success(`${successCount}개 상품이 AI 가공되었습니다.`)
    if (failCount > 0) toast.error(`${failCount}개 가공에 실패했습니다.`)

    if (successCount > 0 && onSwitchToProcessed) {
      onSwitchToProcessed()
    }
  }

  // =============================================
  // 상품 등록 모달 핸들러
  // =============================================

  const handleOpenRegisterModal = async () => {
    setShowRegisterModal(true)
    setSelectedPolicyId(null)
    setSelectedPlatform('')
    setAvailablePlatforms([])
    setSelectedPostIds([])
    setSelectedPosts([])
    setCurrentProcessingIndex(0)
    setExpandedPostIds([])
    setExpandedPolicyIds([])
    setPricingPolicies([])
    setChannelPolicyMap(new Map())
    setErrorState({ type: null, message: '' })
    setTransformResult({ success: 0, failed: 0, failedItems: [] })

    // 가격 정책 자동 선택 및 게시물 선택 단계로 바로 이동
    await loadPricingPoliciesAndProceed()
  }

  // 가격 정책 자동 선택 및 게시물 선택 단계로 이동
  const loadPricingPoliciesAndProceed = async () => {
    setModalStep('select')
    setIsLoadingPosts(true)
    setErrorState({ type: null, message: '' })

    try {
      // 1. 가격 정책 로드 (채널 정보 포함)
      const policyResponse = await fetch('/api/policy?limit=100')

      if (!policyResponse.ok) {
        throw new Error(`정책 API 오류: ${policyResponse.status}`)
      }

      const policyData = await policyResponse.json()

      if (!policyData.success) {
        throw new Error(policyData.error || '정책 로드 실패')
      }

      const activePolicies = policyData.data.filter((p: PricingPolicyItem) => p.isActive)
      setPricingPolicies(activePolicies)

      // 활성화된 정책이 없는 경우
      if (activePolicies.length === 0) {
        setErrorState({
          type: 'no_policy',
          message: '활성화된 가격 정책이 없습니다',
          details: '자동화 설정에서 가격 정책을 먼저 등록해주세요.'
        })
        setModalStep('error')
        setIsLoadingPosts(false)
        return
      }

      // 채널ID -> 정책 매핑 생성
      const policyMap = new Map<number, PricingPolicyItem>()
      activePolicies.forEach((policy: PricingPolicyItem) => {
        if (!policyMap.has(policy.channelId)) {
          policyMap.set(policy.channelId, policy)
        }
      })
      setChannelPolicyMap(policyMap)

      // 2. 게시물 목록 로드
      await loadAvailablePosts(policyMap)
    } catch (error) {
      console.error('데이터 로드 실패:', error)
      setErrorState({
        type: 'network',
        message: '데이터를 불러오는데 실패했습니다',
        details: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.'
      })
      setModalStep('error')
    } finally {
      setIsLoadingPosts(false)
    }
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

  const loadAvailablePosts = async (policyMap?: Map<number, PricingPolicyItem>) => {
    setIsLoadingPosts(true)
    setAvailablePosts([])
    setAvailablePlatforms([])

    const currentPolicyMap = policyMap || channelPolicyMap

    try {
      const response = await fetch('/api/post?limit=100&todayOnly=true')

      if (!response.ok) {
        throw new Error(`게시물 API 오류: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '게시물 로드 실패')
      }

      // 이미 수집상품이 있는 게시물 ID 목록 조회
      const collectedResponse = await fetch('/api/collected-product?limit=1000')
      const collectedData = await collectedResponse.json()
      const usedPostIds = new Set(
        collectedData.data?.map((cp: any) => cp.postId) || []
      )

      // 아직 사용되지 않은 게시물만 필터링
      const filtered = data.data.filter((post: any) => !usedPostIds.has(post.id))
      setAllAvailablePosts(filtered)

      // 게시물이 없는 경우
      if (filtered.length === 0) {
        setErrorState({
          type: 'no_posts',
          message: '변환 가능한 게시물이 없습니다',
          details: '모든 게시물이 이미 수집상품으로 변환되었거나, 등록된 게시물이 없습니다.'
        })
        setModalStep('error')
        return
      }

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

        // 선택 가능한 게시물(정책 있는)이 전체적으로 없는 경우 체크
        const allSelectablePosts = filtered.filter((post: AvailablePost) =>
          currentPolicyMap.has(post.channel.id)
        )
        if (allSelectablePosts.length === 0) {
          setErrorState({
            type: 'no_selectable',
            message: '선택 가능한 게시물이 없습니다',
            details: '모든 게시물의 출처 채널에 가격 정책이 등록되어 있지 않습니다. 채널별로 가격 정책을 등록해주세요.'
          })
          setModalStep('error')
          return
        }
      } else {
        setAvailablePosts(filtered)
      }
    } catch (error) {
      console.error('게시물 목록 조회 실패:', error)
      setErrorState({
        type: 'network',
        message: '게시물 목록을 불러오는데 실패했습니다',
        details: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.'
      })
      setModalStep('error')
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

  // 게시물 선택/해제 토글 (정책 있는 게시물만)
  const handleTogglePostSelect = (post: AvailablePost) => {
    // 정책이 없는 채널의 게시물은 선택 불가
    if (!channelPolicyMap.has(post.channel.id)) {
      toast.error(`"${post.channel.name}" 채널에 가격 정책이 없습니다. 자동화 설정에서 정책을 등록해주세요.`)
      return
    }

    const isCurrentlySelected = selectedPostIds.includes(post.id)

    if (isCurrentlySelected) {
      setSelectedPostIds(prev => prev.filter(id => id !== post.id))
      setSelectedPosts(prev => prev.filter(p => p.id !== post.id))
    } else {
      setSelectedPostIds(prev => [...prev, post.id])
      setSelectedPosts(prev => [...prev, post])
    }
  }

  // 전체 선택/해제 (정책 있는 게시물만)
  const handleSelectAllPosts = () => {
    const selectablePostIds = postsWithPolicy.map(post => post.id)
    const isAllSelected = selectablePostIds.length > 0 &&
      selectablePostIds.every(id => selectedPostIds.includes(id))

    if (isAllSelected) {
      setSelectedPostIds(prev => prev.filter(id => !selectablePostIds.includes(id)))
      setSelectedPosts(prev => prev.filter(p => !selectablePostIds.includes(p.id)))
    } else {
      setSelectedPostIds(prev => Array.from(new Set([...prev, ...selectablePostIds])))
      setSelectedPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id))
        const newPosts = postsWithPolicy.filter(p => !existingIds.has(p.id))
        return [...prev, ...newPosts]
      })
    }
  }

  // 전체 선택 여부 확인
  const isAllPostsSelected = postsWithPolicy.length > 0 &&
    postsWithPolicy.every(post => selectedPostIds.includes(post.id))

  // 게시물에 해당하는 정책 가져오기
  const getPolicyForPost = (post: AvailablePost) => {
    return channelPolicyMap.get(post.channel.id)
  }

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
    setTransformResult({ success: 0, failed: 0, failedItems: [] })
    setTransformStartTime(Date.now())
    setElapsedTime(0)

    let successCount = 0
    let failedCount = 0
    const failedItems: Array<{ title: string; error: string; imageUrl?: string; channelName?: string }> = []

    for (let i = 0; i < selectedPosts.length; i++) {
      // 첫 번째가 아니면 30초 대기 (API 제한 대응)
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 30000))
      }

      setCurrentProcessingIndex(i + 1)
      const post = selectedPosts[i]

      // 채널별 정책 자동 적용
      const policy = channelPolicyMap.get(post.channel.id)

      try {
        // AI 변환 (채널별 가격 정책 포함)
        const response = await fetch('/api/product/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: post.id,
            policyContent: policy?.content,
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
            failedCount++
            failedItems.push({
              title: post.title,
              error: saveData.error || '상품 등록 실패',
              imageUrl: post.images?.[0]?.url,
              channelName: post.channel.name,
            })
          }
        } else {
          failedCount++
          failedItems.push({
            title: post.title,
            error: data.error || 'AI 변환 실패',
            imageUrl: post.images?.[0]?.url,
            channelName: post.channel.name,
          })
        }
      } catch (error) {
        failedCount++
        failedItems.push({
          title: post.title,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          imageUrl: post.images?.[0]?.url,
          channelName: post.channel.name,
        })
      }
    }

    setTransformResult({ success: successCount, failed: failedCount, failedItems })

    // 결과 화면으로 이동
    setModalStep('result')
    loadProducts()
  }

  // 결과 화면에서 닫기
  const handleCloseResult = () => {
    setShowRegisterModal(false)
    setModalStep('select')
  }

  const handleCloseRegisterModal = () => {
    setShowRegisterModal(false)
    setModalStep('select')
    setSelectedPolicyId(null)
    setPricingPolicies([])
    setSelectedPlatform('')
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

  return (
    <>
        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 bg-gray-100 rounded-lg">
                <Package size={20} className="sm:w-6 sm:h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">수집상품</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalItems}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <Boxes size={20} className="sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">채널 수</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{channels.length}</p>
              </div>
            </div>
          </div>
          {/* 수집 상품 등록 카드 */}
          <button
            onClick={handleOpenRegisterModal}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer text-left min-h-[44px]"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <Plus size={20} className="sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">수집 상품</p>
                <p className="text-base sm:text-lg font-bold text-blue-600">등록하기</p>
              </div>
            </div>
          </button>
        </div>

        {/* 액션 바 (고정) */}
        <div className="bg-gray-900 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3 flex-wrap">
          {selectedIds.length > 0 ? (
            <span className="text-sm font-medium text-gray-300">
              {selectedIds.length}개 선택됨
            </span>
          ) : (
            <span className="text-sm text-gray-400">
              상품을 선택해주세요
            </span>
          )}
          <div className="w-px h-5 bg-gray-600" />
          {selectedIds.length > 0 && (
            <button
              onClick={() => { setSelectedIds([]); setSelectAll(false) }}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              선택 해제
            </button>
          )}
          <button
            onClick={() => {
              if (selectedIds.length === 0) { toast.error('먼저 상품을 선택해주세요.'); return }
              handleDeleteSelected()
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Trash2 size={15} />
            삭제
          </button>
          <button
            onClick={() => {
              if (selectedIds.length === 0) { toast.error('먼저 상품을 선택해주세요.'); return }
              handleDirectAiProcess()
            }}
            disabled={isDirectAiProcessing}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            <Sparkles size={15} />
            AI로 가공하기
          </button>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* 왼쪽: 변환상태 필터 + 출처 채널 필터 */}
              <div className="flex items-center gap-3 overflow-x-auto w-full lg:w-auto max-w-full min-w-0 scrollbar-hide lg:scrollbar-thin">
                {/* 변환상태 필터 */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
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

          {/* 목록 */}
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              수집된 상품이 없습니다.
            </div>
          ) : (
            <>
              {/* 모바일: 카드 뷰 */}
              <div className="lg:hidden p-3 space-y-3">
                {/* 전체 선택 */}
                <div className="flex items-center gap-2 px-1 pb-2 border-b border-gray-100">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleToggleSelectAll}
                    className="w-5 h-5 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">전체 선택</span>
                </div>
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {/* 상단: 체크박스 + 상태 배지 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleToggleSelection(product.id)
                          }}
                          className="w-5 h-5 cursor-pointer flex-shrink-0"
                        />
                        <span className="text-xs text-gray-500">
                          {new Date(product.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          }).replace(/\. /g, '-').replace(/\.$/, '')}
                        </span>
                      </div>
                      {product.isConverted ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle size={12} className="mr-1" />
                          변환완료
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          미변환
                        </span>
                      )}
                    </div>

                    {/* 출처 채널 배지 */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-100 text-purple-700 cursor-pointer"
                        onClick={() => router.push(`/sourcing/collected-product/detail/${product.id}`)}
                      >
                        {product.post?.channel?.coverUrl ? (
                          <img
                            src={product.post.channel.coverUrl}
                            alt={product.post.channel.name}
                            className="w-4 h-4 rounded object-cover"
                          />
                        ) : (
                          <Boxes size={12} />
                        )}
                        <span className="text-xs font-medium truncate max-w-[120px]">
                          {product.post?.channel?.name || '-'}
                        </span>
                      </div>
                    </div>

                    {/* 상품 정보 */}
                    <div
                      className="flex items-start gap-3 mb-3 cursor-pointer"
                      onClick={() => router.push(`/sourcing/collected-product/detail/${product.id}`)}
                    >
                      {product.post?.images?.[0]?.url ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          <Image
                            src={product.post.images[0].url}
                            alt={product.name || product.post.title}
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
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {product.name || '(상품명 미추출)'}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                          {product.description || '-'}
                        </p>
                      </div>
                    </div>

                    {/* 하단: 가격 정보 */}
                    <div
                      className="flex items-center justify-between pt-3 border-t border-gray-100 cursor-pointer"
                      onClick={() => router.push(`/sourcing/collected-product/detail/${product.id}`)}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500">도매가</span>
                        <span className="text-sm font-bold text-gray-900">
                          {product.wholesalePrice ? `${product.wholesalePrice.toLocaleString()}원` : '-'}
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>

              {/* 데스크톱: 테이블 뷰 */}
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
                      <TableHead className="w-[42%]">상품명 / 게시물</TableHead>
                      <TableHead className="w-[20%]">출처 채널</TableHead>
                      <TableHead className="w-[10%] text-center">변환상태</TableHead>
                      <TableHead className="w-[16%] text-center">수집일시</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow
                        key={product.id}
                        className="hover:bg-gray-50 cursor-pointer h-[72px]"
                        onClick={() => router.push(`/sourcing/collected-product/detail/${product.id}`)}
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
                          <div className="flex items-center gap-2">
                            {product.post?.channel?.coverUrl ? (
                              <img
                                src={product.post.channel.coverUrl}
                                alt={product.post.channel.name}
                                className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <span className="text-gray-400 text-xs">No</span>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-gray-900 truncate text-sm">
                                {product.post?.channel?.name || '-'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {product.isConverted ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              변환
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              미변환
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
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

      {/* AI 가공 확인 모달 */}
      <ConfirmModal
        isOpen={showDirectAiConfirm}
        onClose={() => setShowDirectAiConfirm(false)}
        onConfirm={confirmDirectAiProcess}
        title="AI로 가공하기"
        message={`선택한 ${selectedIds.length}개 수집상품을 AI로 가공합니다. 완료 후 가공완료 탭으로 이동합니다.`}
        confirmText="가공 시작"
        variant="info"
      />

      {/* AI 가공 진행 오버레이 */}
      {isDirectAiProcessing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-8 w-80 text-center shadow-2xl">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package size={24} className="text-purple-600 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">AI 가공 중...</h3>
            <p className="text-sm text-gray-500 mb-4">
              {directAiProgress.current} / {directAiProgress.total} 처리 중
              {directAiProgress.failed > 0 && (
                <span className="text-red-500 ml-2">({directAiProgress.failed}개 실패)</span>
              )}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${directAiProgress.total > 0 ? (directAiProgress.current / directAiProgress.total) * 100 : 0}%` }}
              />
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
          modalStep === 'select'
            ? '수집 상품 등록 - 게시물 선택'
            : modalStep === 'result'
            ? '수집 상품 등록 - 완료'
            : modalStep === 'error'
            ? '수집 상품 등록 - 오류'
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
            {/* 오늘 날짜 안내 */}
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <Info size={18} className="text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <span className="font-medium">오늘 (KST 기준)</span> 수집된 게시물만 표시됩니다.
              </p>
            </div>

            {/* 플랫폼 선택 탭 + 안내 메시지 - 고정 */}
            <div className="flex-shrink-0 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-wrap gap-2">
                  {availablePlatforms.map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => handlePlatformSelect(platform)}
                      disabled={isLoadingPosts}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
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
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <CheckCircle size={12} className="text-green-500" />
                  채널별 가격 정책이 자동 적용됩니다
                </span>
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
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-600">
                        총 {availablePosts.length}개
                      </span>
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle size={12} />
                        선택 가능 {postsWithPolicy.length}개
                      </span>
                      {postsWithoutPolicy.length > 0 && (
                        <span className="text-gray-400 flex items-center gap-1">
                          <XCircle size={12} />
                          정책 없음 {postsWithoutPolicy.length}개
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleSelectAllPosts}
                      disabled={postsWithPolicy.length === 0}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        postsWithPolicy.length === 0
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : isAllPostsSelected
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isAllPostsSelected ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>
                  {/* 게시물 목록 */}
                  <div className="flex-1 overflow-y-auto p-2">
                  <div className="space-y-1.5">
                    {availablePosts.map((post) => {
                      const isSelected = selectedPostIds.includes(post.id)
                      const isExpanded = expandedPostIds.includes(post.id)
                      const policy = getPolicyForPost(post)
                      const hasPolicy = !!policy
                      return (
                        <div
                          key={post.id}
                          className={`
                            border rounded-lg transition-colors overflow-hidden
                            ${isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : hasPolicy
                              ? 'border-gray-200 hover:border-gray-300'
                              : 'border-gray-200 bg-gray-50 opacity-60'
                            }
                          `}
                        >
                          {/* 간략 정보 */}
                          <div
                            className={`p-3 transition-colors ${
                              hasPolicy
                                ? isSelected
                                  ? 'cursor-pointer hover:bg-blue-100'
                                  : 'cursor-pointer hover:bg-gray-50'
                                : 'cursor-not-allowed'
                            }`}
                            onClick={() => hasPolicy && handleTogglePostSelect(post)}
                          >
                            <div className="flex items-center gap-3">
                              {/* 체크박스/정책 상태 표시 */}
                              <div className="flex-shrink-0">
                                {hasPolicy ? (
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                    isSelected
                                      ? 'bg-blue-500 border-blue-500'
                                      : 'border-gray-300 bg-white'
                                  }`}>
                                    {isSelected && <CheckCircle size={12} className="text-white" />}
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded border-2 border-gray-300 bg-gray-100 flex items-center justify-center">
                                    <XCircle size={12} className="text-gray-400" />
                                  </div>
                                )}
                              </div>

                              {/* 이미지 */}
                              {post.images?.[0] && (
                                <img
                                  src={post.images[0].url}
                                  alt=""
                                  className={`w-14 h-14 rounded object-cover flex-shrink-0 ${!hasPolicy ? 'grayscale' : ''}`}
                                />
                              )}

                              {/* 게시물 정보 */}
                              <div className="flex-1 min-w-0">
                                <h4 className={`font-medium truncate ${hasPolicy ? 'text-gray-900' : 'text-gray-500'}`}>
                                  {post.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-sm text-gray-500">
                                    {post.channel.name}
                                  </span>
                                  {hasPolicy ? (
                                    <span className="text-xs text-green-600 flex items-center gap-0.5">
                                      <CheckCircle size={10} />
                                      {policy.name}
                                    </span>
                                  ) : (
                                    <Link
                                      href="/sourcing/settings/prompt?tab=policy"
                                      className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-0.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink size={10} />
                                      정책 등록
                                    </Link>
                                  )}
                                </div>
                              </div>

                              {/* 펼치기 버튼 */}
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
                <Button variant="secondary" onClick={handleCloseRegisterModal}>
                  취소
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

              {/* 경과 시간 */}
              <div className="mt-4 text-sm text-gray-600">
                <span className="text-gray-400">경과 시간:</span>{' '}
                <span className="font-medium">{formatTime(elapsedTime)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 결과 화면 */}
        {modalStep === 'result' && (
          <div className="py-8 flex flex-col items-center">
            {/* 결과 아이콘 */}
            {transformResult.failed === 0 ? (
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                <CheckCircle size={40} className="text-green-500" />
              </div>
            ) : transformResult.success === 0 ? (
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
                <XCircle size={40} className="text-red-500" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mb-6">
                <AlertCircle size={40} className="text-yellow-500" />
              </div>
            )}

            {/* 결과 요약 */}
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {transformResult.failed === 0
                ? '모든 상품이 등록되었습니다'
                : transformResult.success === 0
                ? '상품 등록에 실패했습니다'
                : '일부 상품 등록에 실패했습니다'}
            </h3>

            {/* 성공/실패 통계 */}
            <div className="flex items-center gap-8 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{transformResult.success}</p>
                <p className="text-sm text-gray-500">성공</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{transformResult.failed}</p>
                <p className="text-sm text-gray-500">실패</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-700">{formatTime(elapsedTime)}</p>
                <p className="text-sm text-gray-500">소요 시간</p>
              </div>
            </div>

            {/* 실패 항목 상세 */}
            {transformResult.failedItems.length > 0 && (
              <div className="w-full max-w-lg mb-6 border border-red-200 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                  <span className="text-sm font-medium text-red-700">
                    실패 항목 ({transformResult.failedItems.length}개)
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-red-100">
                  {transformResult.failedItems.map((item, idx) => (
                    <div key={idx} className="px-4 py-3 flex gap-3">
                      {/* 썸네일 이미지 */}
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <Package size={20} className="text-gray-400" />
                        </div>
                      )}
                      {/* 상품 정보 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                        {item.channelName && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.channelName}</p>
                        )}
                        <p className="text-xs text-red-600 mt-1">{item.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 닫기 버튼 */}
            <Button variant="primary" onClick={handleCloseResult}>
              확인
            </Button>
          </div>
        )}

        {/* Step 4: 에러 화면 */}
        {modalStep === 'error' && (
          <div className="py-12 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
              <AlertCircle size={40} className="text-red-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {errorState.message}
            </h3>
            <p className="text-gray-500 text-center mb-6 max-w-md">
              {errorState.details}
            </p>

            {/* 변환 실패 상세 정보 */}
            {errorState.type === 'transform_failed' && transformResult.failedItems.length > 0 && (
              <div className="w-full max-w-md mb-6 border border-red-200 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                  <span className="text-sm font-medium text-red-700">실패 항목 상세</span>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {transformResult.failedItems.map((item, idx) => (
                    <div key={idx} className="px-4 py-2 border-b border-red-100 last:border-b-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{item.title}</p>
                      <p className="text-xs text-red-500 mt-0.5">{item.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {errorState.type === 'no_policy' && (
                <Link href="/sourcing/settings/prompt?tab=policy">
                  <Button variant="primary">
                    <ExternalLink size={16} />
                    정책 설정하기
                  </Button>
                </Link>
              )}
              {errorState.type === 'no_selectable' && (
                <Link href="/sourcing/settings/prompt?tab=policy">
                  <Button variant="primary">
                    <ExternalLink size={16} />
                    정책 설정하기
                  </Button>
                </Link>
              )}
              {(errorState.type === 'network' || errorState.type === 'transform_failed') && (
                <Button
                  variant="primary"
                  onClick={loadPricingPoliciesAndProceed}
                >
                  <RefreshCw size={16} />
                  다시 시도
                </Button>
              )}
              <Button variant="secondary" onClick={handleCloseRegisterModal}>
                닫기
              </Button>
            </div>
          </div>
        )}

      </Modal>
    </>
  )
}
