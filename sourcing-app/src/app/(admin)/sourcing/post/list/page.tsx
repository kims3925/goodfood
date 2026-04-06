'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Trash2, AlertCircle, ChevronDown, ChevronRight, ChevronUp, FileText, Store, Package } from 'lucide-react'
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
      const params = new URLSearchParams({ platform, todayOnly: 'true' })

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
  }, [])

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

        {/* 수집상품리스트 헤더 */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">수집상품리스트</h2>
          <p className="text-gray-500 text-sm mt-1">
            소싱처에서 수집한 게시물중 AI가공이 안된 상품을 관리합니다.
          </p>
        </div>

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* AI로가공하기 카드 */}
          <button
            onClick={() => router.push('/sourcing/product/list?tab=raw&openRegister=true')}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-pointer text-left min-h-[44px]"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                <Package size={20} className="sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">AI로</p>
                <p className="text-base sm:text-lg font-bold text-purple-600">가공하기</p>
              </div>
            </div>
          </button>
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
          {/* 게시물 삭제 카드 */}
          <button
            onClick={handleDeleteSelectedPosts}
            disabled={selectedPostIds.length === 0}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 text-left transition-colors min-h-[44px] ${
              selectedPostIds.length > 0
                ? 'hover:border-red-300 hover:bg-red-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-2 sm:p-3 rounded-lg ${selectedPostIds.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Trash2 size={20} className={`sm:w-6 sm:h-6 ${selectedPostIds.length > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">선택 삭제</p>
                <p className={`text-base sm:text-lg font-bold ${selectedPostIds.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {selectedPostIds.length}개
                </p>
              </div>
            </div>
          </button>
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
                { mode: 'SETTINGS' as AddMode, label: '조건 설정', icon: '⚙️' },
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

          {/* 조건 설정 모드 */}
          {addMode === 'SETTINGS' && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 rounded-lg p-5 space-y-4">
                <h4 className="text-sm font-semibold text-gray-900">수집 조건 설정</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">수집 기간</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">최근</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={filterDays}
                      onChange={e => setFilterDays(Number(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center"
                    />
                    <span className="text-sm text-gray-600">일</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">밴드 수집 시 해당 기간 내 게시물만 가져옵니다.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">상품 검색 키워드</label>
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    placeholder="키워드를 입력하세요 (예: 해산물, 전복)"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">입력한 키워드가 포함된 게시물만 수집합니다.</p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => {
                    toast.success(`조건 저장: 최근 ${filterDays}일${filterSearch ? `, 키워드: ${filterSearch}` : ''}`)
                    setAddMode('BAND')
                    loadPostsByPlatform('BAND')
                  }}
                >
                  조건 저장 후 밴드 수집으로 이동
                </Button>
              </div>
            </div>
          )}

          {/* 밴드 수집 모드 */}
          {addMode === 'BAND' && (
          <>
          {/* 날짜 안내 */}
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle size={20} className="text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              <span className="font-medium">최근 {filterDays}일</span> 작성된 게시물을 표시합니다.
              {filterSearch && <span className="ml-1">(키워드: {filterSearch})</span>}
            </p>
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
                  const allChannelSelected = channelPostKeys.length > 0 && selectedInChannel === channelPostKeys.length
                  const someChannelSelected = selectedInChannel > 0 && selectedInChannel < channelPostKeys.length
                  return (
                    <div key={channelKey} className="border rounded-lg bg-white">
                      {/* 채널 헤더 */}
                      <div className="p-4 bg-gray-50 border-b flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={allChannelSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someChannelSelected
                          }}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleToggleChannelSelectAll(channelKey, channelPostKeys)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 cursor-pointer"
                        />
                        <div
                          className="flex-1 flex items-center justify-between cursor-pointer hover:bg-gray-100 rounded -m-1 p-1 transition-colors"
                          onClick={() => handleToggleChannelExpand(channelKey)}
                        >
                          <div className="flex items-center gap-3">
                            {isChannelExpanded ? (
                              <ChevronDown size={22} className="text-gray-600" />
                            ) : (
                              <ChevronRight size={22} className="text-gray-600" />
                            )}
                            {group.channel.coverUrl ? (
                              <img
                                src={group.channel.coverUrl}
                                alt={group.channel.name}
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <Store size={20} className="text-gray-400" />
                              </div>
                            )}
                            <h3 className="font-semibold text-gray-900 text-base">{group.channel.name}</h3>
                            <span className="text-sm text-gray-500">
                              ({selectedInChannel > 0 ? `${selectedInChannel}/` : ''}{group.posts.length}개)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 채널별 게시물 목록 */}
                      {isChannelExpanded && (
                        <div className="p-2 space-y-2">
                          {group.posts.map((post) => {
                            const isExpanded = expandedPostKeys.includes(post.post_key)
                            return (
                              <div
                                key={post.post_key}
                                className={`
                                  border rounded-lg transition-colors
                                  ${
                                    selectedPostKeys.includes(post.post_key)
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200'
                                  }
                                `}
                              >
                                {/* 간략 정보 */}
                                <div
                                  className={`p-4 cursor-pointer transition-colors ${
                                    selectedPostKeys.includes(post.post_key)
                                      ? 'hover:bg-blue-100'
                                      : 'hover:bg-gray-50'
                                  }`}
                                  onClick={() => handleToggleModalPostSelection(post.post_key)}
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-gray-900 truncate">{post.title}</h4>
                                      <p className="text-sm text-gray-500 mt-1">
                                        작성자: {post.author || '알 수 없음'}
                                        {post.created_at && (
                                          <span className="ml-2 text-gray-400">
                                            · {new Date(post.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleToggleExpand(post.post_key)
                                      }}
                                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown size={20} className="text-gray-400" />
                                      ) : (
                                        <ChevronRight size={20} className="text-gray-400" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* 상세 정보 (확장 시) */}
                                {isExpanded && (
                                  <div className="px-4 pb-4 pt-2 border-t border-gray-200 relative">
                                    <div className="space-y-3">
                                      <div>
                                        <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                                          {post.content}
                                        </p>
                                      </div>
                                      {post.images && post.images.length > 0 && (
                                        <div>
                                          <div className="flex gap-2 mt-1 overflow-x-auto">
                                            {post.images.slice(0, 4).map((img, idx) => (
                                              <img
                                                key={idx}
                                                src={img}
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
                                          게시물 ID: {post.post_key}
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleToggleExpand(post.post_key)
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
                      )}
                    </div>
                  )
                    })}
                </div>
              </div>
            )}
          </div>
          </>
          )}

        </div>
      </Modal>

      {/* 게시물 등록 로딩 오버레이 */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-4">
              {/* 스피너 */}
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />

              {/* 진행 상황 */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  게시물을 등록하고 있습니다...
                </h3>
                <p className="text-gray-600">
                  {currentIndex}/{totalCount}개 등록 중...
                </p>
                {failedCount > 0 && (
                  <p className="text-sm text-red-500 mt-2">
                    (실패: {failedCount}개)
                  </p>
                )}
              </div>

              {/* 진행률 바 */}
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${totalCount > 0 ? (currentIndex / totalCount) * 100 : 0}%` }}
                />
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
        onConfirm={deleteTargetId !== null ? confirmDeletePost : confirmDeleteSelectedPosts}
        title="게시물 삭제"
        message={
          deleteTargetId !== null
            ? '이 게시물을 삭제하시겠습니까?'
            : `선택한 ${selectedPostIds.length}개의 게시물을 삭제하시겠습니까?`
        }
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
