'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Package, ChevronDown, ChevronUp, CheckCircle, AlertCircle, ExternalLink, RefreshCw, XCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

const PLATFORM_LABELS: Record<string, string> = {
  'BAND': '밴드',
  'NAVER_CAFE': '네이버 카페',
  'ALIEXPRESS': '알리익스프레스',
  'OTHER': '기타',
}

// 채널 정보가 포함된 가격 정책
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

export default function CollectedProductModalTestPage() {
  const toast = useToast()

  // 상품 등록 모달 states
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [modalStep, setModalStep] = useState<'select' | 'transforming' | 'error'>('select')

  // 에러 상태
  const [errorState, setErrorState] = useState<{
    type: 'network' | 'no_policy' | 'no_posts' | 'no_selectable' | 'transform_failed' | null
    message: string
    details?: string
  }>({ type: null, message: '' })

  // 정책 관련 (채널별 매핑)
  const [pricingPolicies, setPricingPolicies] = useState<PricingPolicyItem[]>([])
  const [channelPolicyMap, setChannelPolicyMap] = useState<Map<number, PricingPolicyItem>>(new Map())

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
    failedItems: Array<{ title: string; error: string }>
  }>({ success: 0, failed: 0, failedItems: [] })

  // 정책이 있는 게시물만 필터링된 목록
  const postsWithPolicy = useMemo(() => {
    return availablePosts.filter(post => channelPolicyMap.has(post.channel.id))
  }, [availablePosts, channelPolicyMap])

  const postsWithoutPolicy = useMemo(() => {
    return availablePosts.filter(post => !channelPolicyMap.has(post.channel.id))
  }, [availablePosts, channelPolicyMap])

  // =============================================
  // 상품 등록 모달 핸들러
  // =============================================

  const handleOpenRegisterModal = async () => {
    setShowRegisterModal(true)
    setSelectedPlatform('')
    setAvailablePlatforms([])
    setSelectedPostIds([])
    setSelectedPosts([])
    setCurrentProcessingIndex(0)
    setExpandedPostIds([])
    setPricingPolicies([])
    setChannelPolicyMap(new Map())
    setErrorState({ type: null, message: '' })
    setTransformResult({ success: 0, failed: 0, failedItems: [] })

    await loadDataAndProceed()
  }

  // 정책 및 게시물 로드
  const loadDataAndProceed = async () => {
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

  const loadAvailablePosts = async (policyMap?: Map<number, PricingPolicyItem>) => {
    setIsLoadingPosts(true)
    setAvailablePosts([])
    setAvailablePlatforms([])

    const currentPolicyMap = policyMap || channelPolicyMap

    try {
      const response = await fetch('/api/post?limit=100')

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
    setSelectedPostIds([])
    setSelectedPosts([])
    setExpandedPostIds([])

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

  const isAllPostsSelected = postsWithPolicy.length > 0 &&
    postsWithPolicy.every(post => selectedPostIds.includes(post.id))

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

    let successCount = 0
    let failedCount = 0
    const failedItems: Array<{ title: string; error: string }> = []

    // 테스트용: 실제 API 호출 대신 시뮬레이션
    for (let i = 0; i < selectedPosts.length; i++) {
      const post = selectedPosts[i]
      const policy = channelPolicyMap.get(post.channel.id)

      console.log(`처리 중: ${post.title}`)
      console.log(`  - 채널: ${post.channel.name} (ID: ${post.channel.id})`)
      console.log(`  - 적용 정책: ${policy?.name || '없음'}`)

      try {
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        // 테스트용: 랜덤하게 일부 실패 시뮬레이션 (실제 구현 시 제거)
        // if (Math.random() < 0.2) {
        //   throw new Error('AI 변환 실패 (테스트)')
        // }

        successCount++
      } catch (error) {
        failedCount++
        failedItems.push({
          title: post.title,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        })
      }

      setCurrentProcessingIndex(i + 1)
    }

    setTransformResult({ success: successCount, failed: failedCount, failedItems })

    // 결과 처리
    if (failedCount === 0) {
      toast.success(`${successCount}개 상품 처리 완료`)
      setShowRegisterModal(false)
    } else if (successCount === 0) {
      // 전부 실패
      setErrorState({
        type: 'transform_failed',
        message: '상품 등록에 실패했습니다',
        details: `${failedCount}개 항목 모두 처리에 실패했습니다.`
      })
      setModalStep('error')
    } else {
      // 일부 실패
      toast.success(`${successCount}개 성공, ${failedCount}개 실패`)
      setShowRegisterModal(false)
    }
  }

  const handleCloseRegisterModal = () => {
    setShowRegisterModal(false)
    setModalStep('select')
    setPricingPolicies([])
    setChannelPolicyMap(new Map())
    setSelectedPlatform('')
    setSelectedPostIds([])
    setSelectedPosts([])
    setCurrentProcessingIndex(0)
    setAvailablePosts([])
    setAllAvailablePosts([])
    setExpandedPostIds([])
  }

  // 게시물에 해당하는 정책 가져오기
  const getPolicyForPost = (post: AvailablePost) => {
    return channelPolicyMap.get(post.channel.id)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">수집상품 모달 테스트</h1>
          <p className="text-gray-600">
            채널별 가격정책 자동 적용 테스트 페이지입니다.
          </p>
        </div>

        {/* 테스트 버튼 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">모달 열기 테스트</h2>
          <div className="flex gap-4">
            <Button variant="primary" onClick={handleOpenRegisterModal}>
              수집 상품 등록 모달 열기
            </Button>
          </div>
        </div>

        {/* 현재 상태 표시 */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">현재 상태</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">모달 열림:</span> {showRegisterModal ? 'Yes' : 'No'}</p>
            <p><span className="font-medium">현재 단계:</span> {modalStep}</p>
            <p><span className="font-medium">로드된 정책 수:</span> {pricingPolicies.length}</p>
            <p><span className="font-medium">채널-정책 매핑 수:</span> {channelPolicyMap.size}</p>
            <p><span className="font-medium">선택된 플랫폼:</span> {selectedPlatform || 'None'}</p>
            <p><span className="font-medium">정책 있는 게시물:</span> {postsWithPolicy.length}개</p>
            <p><span className="font-medium">정책 없는 게시물:</span> {postsWithoutPolicy.length}개</p>
            <p><span className="font-medium">선택된 게시물 수:</span> {selectedPostIds.length}</p>
          </div>

          {/* 채널별 정책 매핑 표시 */}
          {channelPolicyMap.size > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="font-medium mb-2">채널별 정책 매핑:</h3>
              <div className="space-y-1 text-sm">
                {Array.from(channelPolicyMap.entries()).map(([channelId, policy]) => (
                  <p key={channelId} className="text-gray-600">
                    <span className="font-medium">{policy.channel.name}</span> → {policy.name}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 수집 상품 등록 모달 */}
      <Modal
        isOpen={showRegisterModal}
        onClose={handleCloseRegisterModal}
        title={
          modalStep === 'select'
            ? '수집 상품 등록 - 게시물 선택'
            : '수집 상품 등록 - AI 분석 중'
        }
        size="2xl"
      >
        {/* 게시물 선택 */}
        {modalStep === 'select' && (
          <div className="flex flex-col h-[700px]">
            {/* 플랫폼 선택 탭 + 안내 메시지 */}
            <div className="flex-shrink-0 pb-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {availablePlatforms.map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => handlePlatformSelect(platform)}
                    disabled={isLoadingPosts}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
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
                채널별 가격정책 자동 적용
              </span>
            </div>

            {/* 게시물 목록 영역 */}
            <div className="flex-1 min-h-0 border border-gray-200 rounded-lg overflow-hidden">
              {isLoadingPosts ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <Loading />
                  <p className="text-center text-gray-600 mt-4">
                    게시물을 불러오는 중...
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
                  {/* 헤더 */}
                  <div className="flex-shrink-0 p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      총 {availablePosts.length}개 게시물
                      {postsWithoutPolicy.length > 0 && (
                        <span className="text-orange-600 ml-1">
                          (정책 없음: {postsWithoutPolicy.length}개)
                        </span>
                      )}
                    </span>
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
                      {isAllPostsSelected ? '전체 해제' : `전체 선택 (${postsWithPolicy.length}개)`}
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
                              border-2 rounded-lg transition-all overflow-hidden
                              ${!hasPolicy
                                ? 'border-orange-300 bg-orange-50'
                                : isSelected
                                ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                                : 'border-gray-200 hover:border-gray-300'
                              }
                            `}
                          >
                            {/* 정책 상태 배지 바 */}
                            <div className={`h-1 ${hasPolicy ? 'bg-green-500' : 'bg-orange-400'}`} />

                            {/* 간략 정보 */}
                            <div
                              className={`p-3 transition-colors ${
                                hasPolicy
                                  ? 'cursor-pointer hover:bg-gray-50'
                                  : 'cursor-not-allowed opacity-50'
                              } ${isSelected ? 'hover:bg-blue-100' : ''}`}
                              onClick={() => handleTogglePostSelect(post)}
                            >
                              <div className="flex items-start justify-between gap-4">
                                {/* 선택 체크박스 */}
                                <div className={`
                                  w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-all
                                  ${!hasPolicy
                                    ? 'border-orange-300 bg-orange-100'
                                    : isSelected
                                    ? 'border-blue-500 bg-blue-500'
                                    : 'border-gray-300 bg-white'
                                  }
                                `}>
                                  {isSelected && <CheckCircle size={16} className="text-white" />}
                                  {!hasPolicy && <AlertCircle size={14} className="text-orange-500" />}
                                </div>

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
                                    {/* 정책 정보 배지 */}
                                    {hasPolicy ? (
                                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                        <CheckCircle size={12} />
                                        {policy.name}
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                                          <AlertCircle size={12} />
                                          정책 미등록
                                        </span>
                                        <Link
                                          href="/sourcing/policy/new"
                                          target="_blank"
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-colors"
                                        >
                                          <ExternalLink size={10} />
                                          정책 등록
                                        </Link>
                                      </div>
                                    )}
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

                            {/* 상세 정보 */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-2 border-t border-gray-200">
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-5">
                                      {post.content}
                                    </p>
                                  </div>
                                  {post.images && post.images.length > 0 && (
                                    <div className="flex gap-2 overflow-x-auto">
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

            {/* Footer */}
            <div className="flex-shrink-0 pt-4 flex items-center justify-between border-t border-gray-200 mt-4">
              <p className="text-sm text-gray-500">
                {selectedPostIds.length > 0
                  ? `${selectedPostIds.length}개 게시물 선택됨`
                  : `선택 가능: ${postsWithPolicy.length}개`}
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

        {/* AI 변환 중 */}
        {modalStep === 'transforming' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                AI가 게시물을 분석하고 있습니다...
              </h3>
              <p className="text-gray-600 mb-4">각 채널의 가격 정책이 자동 적용됩니다.</p>
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
                <div className="mt-3 text-xs text-gray-500">
                  <p className="truncate max-w-xs">
                    {selectedPosts[currentProcessingIndex - 1].title}
                  </p>
                  <p className="text-green-600 mt-1">
                    정책: {getPolicyForPost(selectedPosts[currentProcessingIndex - 1])?.name}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 에러 화면 */}
        {modalStep === 'error' && (
          <div className="py-12 flex flex-col items-center">
            {/* 에러 아이콘 */}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
              errorState.type === 'no_policy' ? 'bg-orange-100' :
              errorState.type === 'no_posts' ? 'bg-gray-100' :
              errorState.type === 'no_selectable' ? 'bg-orange-100' :
              'bg-red-100'
            }`}>
              {errorState.type === 'network' || errorState.type === 'transform_failed' ? (
                <XCircle size={40} className="text-red-500" />
              ) : errorState.type === 'no_posts' ? (
                <Package size={40} className="text-gray-400" />
              ) : (
                <AlertCircle size={40} className="text-orange-500" />
              )}
            </div>

            {/* 에러 메시지 */}
            <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
              {errorState.message}
            </h3>
            <p className="text-gray-600 text-center mb-6 max-w-md">
              {errorState.details}
            </p>

            {/* 실패한 항목 목록 (변환 실패 시) */}
            {errorState.type === 'transform_failed' && transformResult.failedItems.length > 0 && (
              <div className="w-full max-w-md mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="text-sm font-medium text-red-800 mb-2">실패한 항목:</h4>
                <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                  {transformResult.failedItems.map((item, idx) => (
                    <li key={idx} className="truncate">
                      • {item.title}: {item.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex gap-3">
              {/* 정책 없음 에러 -> 정책 등록 페이지로 */}
              {(errorState.type === 'no_policy' || errorState.type === 'no_selectable') && (
                <Link
                  href="/sourcing/policy/new"
                  target="_blank"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink size={16} />
                  가격 정책 등록
                </Link>
              )}

              {/* 게시물 없음 에러 -> 게시물 관리 페이지로 */}
              {errorState.type === 'no_posts' && (
                <Link
                  href="/sourcing/post/list"
                  target="_blank"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink size={16} />
                  게시물 관리
                </Link>
              )}

              {/* 네트워크 에러 -> 다시 시도 */}
              {(errorState.type === 'network' || errorState.type === 'transform_failed') && (
                <button
                  onClick={loadDataAndProceed}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw size={16} />
                  다시 시도
                </button>
              )}

              <Button variant="secondary" onClick={handleCloseRegisterModal}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
