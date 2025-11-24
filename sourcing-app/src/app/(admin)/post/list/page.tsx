'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Edit3, Trash2, RefreshCw, AlertCircle, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal, { ModalFooter } from '@/components/ui/Modal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'

interface Post {
  id: number
  userId: number
  wholesaleBandId: number
  externalId: string
  title: string
  content: string
  originalContent: string
  author: string | null
  publishedAt: string | null
  status: string
  createdAt: string
  wholesaleBand: {
    name: string
    bandKey: string
    coverUrl: string | null
  }
}

interface AvailablePost {
  post_key: string
  title: string
  content: string
  author: string
  published_at: string
  images: string[]
  comments: Array<{
    comment_key: string
    author: string
    content: string
    published_at: string
  }>
  band: {
    id: number
    name: string
    bandKey: string
  }
}

export default function PostsManagePage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  // 게시물 선택 삭제 관련 상태
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([])
  const [selectAllPosts, setSelectAllPosts] = useState(false)

  // 게시물 추가 모달 관련 상태
  const [availablePosts, setAvailablePosts] = useState<AvailablePost[]>([])
  const [selectedPostKeys, setSelectedPostKeys] = useState<string[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [selectAll, setSelectAll] = useState(false)
  const [expandedPostKeys, setExpandedPostKeys] = useState<string[]>([])
  const [expandedBandKeys, setExpandedBandKeys] = useState<string[]>([])

  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/post?search=${searchTerm}`)
      const data = await response.json()

      if (data.success) {
        setPosts(data.data)
      }
    } catch (error) {
      console.error('게시물 목록 조회 실패:', error)
      alert('게시물 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    loadPosts()
  }

  const handleOpenAddModal = async () => {
    setIsLoadingPosts(true)
    setApiError(null)
    setAvailablePosts([])
    setSelectedPostKeys([])
    setSelectAll(false)
    setExpandedPostKeys([])
    setExpandedBandKeys([])
    setShowAddModal(true)

    try {
      // TODO: 실제로는 userId를 세션에서 가져와야 함
      const response = await fetch('/api/post/available?userId=1')
      const data = await response.json()

      if (data.success) {
        setAvailablePosts(data.data)
      } else {
        setApiError(data.error || '게시물 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('게시물 API 조회 실패:', error)
      setApiError('게시물 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoadingPosts(false)
    }
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

  const handleToggleBandExpand = (bandKey: string) => {
    setExpandedBandKeys((prev) =>
      prev.includes(bandKey)
        ? prev.filter((key) => key !== bandKey)
        : [...prev, bandKey]
    )
  }

  // 밴드별로 게시물 그룹화
  const groupedPosts = availablePosts.reduce((acc, post) => {
    const bandKey = post.band.bandKey
    if (!acc[bandKey]) {
      acc[bandKey] = {
        band: post.band,
        posts: [],
      }
    }
    acc[bandKey].posts.push(post)
    return acc
  }, {} as Record<string, { band: { id: number; name: string; bandKey: string }; posts: AvailablePost[] }>)

  const handleAddSelectedPosts = async () => {
    if (selectedPostKeys.length === 0) {
      alert('추가할 게시물을 선택해주세요.')
      return
    }

    try {
      // TODO: 실제로는 userId를 세션에서 가져와야 함
      const selectedPosts = availablePosts.filter((post) =>
        selectedPostKeys.includes(post.post_key)
      )

      for (const post of selectedPosts) {
        await fetch('/api/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 1, // 임시 값
            wholesaleBandId: post.band.id, // 게시물의 출처 밴드 ID
            externalId: post.post_key,
            title: post.title,
            content: post.content,
            originalContent: post.content,
            author: post.author,
            publishedAt: post.published_at,
            comments: post.comments || [], // 댓글 추가
            images: post.images || [], // 이미지 추가
          }),
        })
      }

      alert(`${selectedPosts.length}개의 게시물이 등록되었습니다.`)
      setShowAddModal(false)
      setSelectedPostKeys([])
      setExpandedPostKeys([])
      setExpandedBandKeys([])
      loadPosts()
    } catch (error) {
      console.error('게시물 등록 실패:', error)
      alert('게시물 등록에 실패했습니다.')
    }
  }


  const handleDeletePost = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/post?id=${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        alert('게시물이 삭제되었습니다.')
        loadPosts()
      } else {
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('게시물 삭제 실패:', error)
      alert('게시물 삭제에 실패했습니다.')
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
  const handleDeleteSelectedPosts = async () => {
    if (selectedPostIds.length === 0) {
      alert('삭제할 게시물을 선택해주세요.')
      return
    }

    if (!confirm(`선택한 ${selectedPostIds.length}개의 게시물을 삭제하시겠습니까?`)) {
      return
    }

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

      if (failCount === 0) {
        alert(`${successCount}개의 게시물이 삭제되었습니다.`)
      } else {
        alert(`${successCount}개 삭제 성공, ${failCount}개 삭제 실패`)
      }

      setSelectedPostIds([])
      setSelectAllPosts(false)
      loadPosts()
    } catch (error) {
      console.error('게시물 일괄 삭제 실패:', error)
      alert('게시물 삭제에 실패했습니다.')
    }
  }


  const truncateText = (text: string, maxLength: number = 20) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...'
    }
    return text
  }

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      COLLECTED: { label: '수집됨', color: 'bg-blue-100 text-blue-800' },
      ANALYZING: { label: 'AI 분석중', color: 'bg-yellow-100 text-yellow-800' },
      ANALYZED: { label: 'AI 분석완료', color: 'bg-green-100 text-green-800' },
      MODIFIED: { label: '수정됨', color: 'bg-purple-100 text-purple-800' },
      READY: { label: '발행준비', color: 'bg-indigo-100 text-indigo-800' },
      PUBLISHED: { label: '발행완료', color: 'bg-gray-100 text-gray-800' },
      FAILED: { label: '실패', color: 'bg-red-100 text-red-800' },
    }

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">게시물 관리</h1>
          <p className="text-gray-600">
            도매밴드에서 수집한 게시물을 관리합니다. AI 분석 및 가공을 통해 발행할 수 있습니다.
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
                    placeholder="제목으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={loadPosts}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  새로고침
                </Button>
                <Button variant="primary" onClick={handleOpenAddModal}>
                  <Plus size={16} />
                  게시물 추가
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteSelectedPosts}
                  disabled={selectedPostIds.length === 0}
                >
                  <Trash2 size={16} />
                  선택 삭제 ({selectedPostIds.length})
                </Button>
              </div>
            </div>
          </div>

          {/* 테이블 */}
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[5%]">
                    <input
                      type="checkbox"
                      checked={selectAllPosts}
                      onChange={handleToggleSelectAllPosts}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-[20%]">출처 밴드</TableHead>
                  <TableHead className="w-[10%]">작성자</TableHead>
                  <TableHead className="w-[22%]">제목</TableHead>
                  <TableHead className="w-[10%]">상태</TableHead>
                  <TableHead className="w-[12%]">수집일</TableHead>
                  <TableHead className="w-[10%]">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.length === 0 ? (
                  <TableEmpty message="수집된 게시물이 없습니다." colSpan={7} />
                ) : (
                  posts.map((post) => (
                    <TableRow
                      key={post.id}
                      className="hover:bg-gray-50"
                    >
                      <TableCell className="w-[5%]">
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
                        className="w-[20%] cursor-pointer"
                        onClick={() => router.push(`/post/detail/${post.id}`)}
                      >
                        <div className="flex items-center gap-2">
                          {post.wholesaleBand.coverUrl ? (
                            <img
                              src={post.wholesaleBand.coverUrl}
                              alt={post.wholesaleBand.name}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-400 text-xs">No</span>
                            </div>
                          )}
                          <div className="text-sm min-w-0 flex-1">
                            <div className="font-medium text-gray-900 truncate">{post.wholesaleBand.name}</div>
                            <div className="text-gray-500 text-xs truncate">{post.wholesaleBand.bandKey}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell
                        className="w-[10%] cursor-pointer"
                        onClick={() => router.push(`/post/detail/${post.id}`)}
                      >
                        <span className="text-gray-600 text-sm">{post.author || '-'}</span>
                      </TableCell>
                      <TableCell
                        className="w-[22%] cursor-pointer"
                        onClick={() => router.push(`/post/detail/${post.id}`)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900">
                            {truncateText(post.title, 30)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell
                        className="w-[10%] cursor-pointer"
                        onClick={() => router.push(`/post/detail/${post.id}`)}
                      >
                        {getStatusBadge(post.status)}
                      </TableCell>
                      <TableCell
                        className="w-[12%] cursor-pointer"
                        onClick={() => router.push(`/post/detail/${post.id}`)}
                      >
                        <span className="text-gray-600 text-sm">
                          {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </TableCell>
                      <TableCell className="w-[10%]">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePost(post.id)
                            }}
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
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
        title="게시물 추가"
        size="2xl"
      >
        {isLoadingPosts ? (
          <div className="py-12">
            <Loading />
            <p className="text-center text-gray-600 mt-4">도매밴드 게시물을 불러오는 중...</p>
          </div>
        ) : apiError ? (
          <div className="py-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="text-red-500" size={48} />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">게시물 조회 오류</h3>
                <p className="text-gray-600 mb-4">{apiError}</p>
              </div>
            </div>
          </div>
        ) : availablePosts.length === 0 ? (
          <div className="py-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="text-yellow-500" size={48} />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">게시물이 없습니다</h3>
                <p className="text-gray-600">도매밴드에서 수집할 수 있는 게시물이 없습니다.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(75vh-12rem)]">
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">전체선택</span>
                </div>
                <p className="text-sm text-gray-600">
                  선택: {selectedPostKeys.length}개 / 전체: {availablePosts.length}개
                </p>
              </div>

              {/* 밴드별 그룹 */}
              <div className="space-y-3">
                {Object.entries(groupedPosts).map(([bandKey, group]) => {
                  const isBandExpanded = expandedBandKeys.includes(bandKey)
                  return (
                    <div key={bandKey} className="border rounded-lg bg-white">
                      {/* 밴드 헤더 */}
                      <div
                        className="p-3 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleToggleBandExpand(bandKey)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isBandExpanded ? (
                              <ChevronDown size={20} className="text-gray-600" />
                            ) : (
                              <ChevronRight size={20} className="text-gray-600" />
                            )}
                            <h3 className="font-semibold text-gray-900">{group.band.name}</h3>
                            <span className="text-sm text-gray-500">({group.posts.length}개)</span>
                          </div>
                        </div>
                      </div>

                      {/* 밴드별 게시물 목록 */}
                      {isBandExpanded && (
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
                                  className="p-4 cursor-pointer hover:bg-gray-50"
                                  onClick={() => handleToggleExpand(post.post_key)}
                                >
                                  <div className="flex items-start gap-4">
                                    <input
                                      type="checkbox"
                                      checked={selectedPostKeys.includes(post.post_key)}
                                      onChange={(e) => {
                                        e.stopPropagation()
                                        handleToggleModalPostSelection(post.post_key)
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                          <h4 className="font-medium text-gray-900 truncate">{post.title}</h4>
                                          <p className="text-sm text-gray-500 mt-1">
                                            작성자: {post.author || '알 수 없음'} • {new Date(post.published_at).toLocaleDateString('ko-KR')}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {isExpanded ? (
                                            <ChevronDown size={20} className="text-gray-400" />
                                          ) : (
                                            <ChevronRight size={20} className="text-gray-400" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
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
            <ModalFooter className="mt-0 pt-2 pb-2">
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
                disabled={selectedPostKeys.length === 0}
              >
                선택한 게시물 추가 ({selectedPostKeys.length})
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  )
}
