'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, AlertCircle, Package } from 'lucide-react'
import Modal, { ModalFooter } from '../ui/Modal'
import Button from '../ui/Button'
import Loading from '../ui/Loading'

interface Post {
  id: number
  title: string
  content: string
  wholesaleBand: {
    id: number
    name: string
    bandKey: string
  }
  images: Array<{
    imageUrl: string
  }>
  createdAt: string
}

interface PostSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onPostSelected: (postId: number) => void
  onMultiplePostsSelected?: (postIds: number[]) => void // 다중 선택 콜백
}

export default function PostSelectionModal({
  isOpen,
  onClose,
  onPostSelected,
  onMultiplePostsSelected,
}: PostSelectionModalProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([]) // 다중 선택으로 변경
  const [expandedPostIds, setExpandedPostIds] = useState<number[]>([])
  const [expandedBandKeys, setExpandedBandKeys] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      loadPosts()
    }
  }, [isOpen])

  const loadPosts = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // 게시물 목록 조회 (limit=0으로 전체 조회)
      const response = await fetch('/api/post?limit=0')
      const data = await response.json()

      if (!data.success) {
        setError(data.error || '게시물을 불러오는데 실패했습니다.')
        return
      }

      if (!data.data || data.data.length === 0) {
        setError('게시물이 없습니다. 게시물을 먼저 수집해주세요.')
        return
      }

      // 상품이 없는 게시물만 필터링 시도
      // Product 테이블이 아직 없으면 모든 게시물 표시
      try {
        const postsWithoutProduct = await Promise.all(
          data.data.map(async (post: Post) => {
            try {
              const productResponse = await fetch(`/api/product?postId=${post.id}`)
              if (!productResponse.ok) {
                // Product API 실패 시 (테이블이 없을 때) 게시물 포함
                return post
              }
              const productData = await productResponse.json()
              return productData.data?.length === 0 ? post : null
            } catch {
              // 에러 발생 시 게시물 포함
              return post
            }
          })
        )

        const filteredPosts = postsWithoutProduct.filter((p): p is Post => p !== null)
        setPosts(filteredPosts)

        if (filteredPosts.length === 0) {
          setError('상품으로 등록할 수 있는 게시물이 없습니다.')
        }
      } catch {
        // 필터링 전체 실패 시 모든 게시물 표시
        setPosts(data.data)
      }
    } catch (err) {
      console.error('게시물 로드 실패:', err)
      setError('게시물을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleExpand = (postId: number) => {
    setExpandedPostIds((prev) =>
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId]
    )
  }

  const handleToggleBandExpand = (bandKey: string) => {
    setExpandedBandKeys((prev) =>
      prev.includes(bandKey)
        ? prev.filter((key) => key !== bandKey)
        : [...prev, bandKey]
    )
  }

  // 게시물 선택/해제 토글
  const handleToggleSelect = (postId: number) => {
    setSelectedPostIds(prev =>
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    )
  }

  // 밴드 전체 선택/해제
  const handleToggleBandSelect = (bandPosts: Post[]) => {
    const bandPostIds = bandPosts.map(p => p.id)
    const allSelected = bandPostIds.every(id => selectedPostIds.includes(id))

    if (allSelected) {
      // 모두 선택되어 있으면 해제
      setSelectedPostIds(prev => prev.filter(id => !bandPostIds.includes(id)))
    } else {
      // 하나라도 선택 안 되어 있으면 모두 선택
      setSelectedPostIds(prev => [...new Set([...prev, ...bandPostIds])])
    }
  }

  const handleConfirm = () => {
    if (selectedPostIds.length === 0) return

    if (onMultiplePostsSelected && selectedPostIds.length > 0) {
      onMultiplePostsSelected(selectedPostIds)
    } else if (selectedPostIds.length === 1) {
      onPostSelected(selectedPostIds[0])
    }
  }

  // 밴드별로 게시물 그룹화
  const groupedPosts = posts.reduce((acc, post) => {
    const bandKey = post.wholesaleBand.bandKey
    if (!acc[bandKey]) {
      acc[bandKey] = {
        band: post.wholesaleBand,
        posts: [],
      }
    }
    acc[bandKey].posts.push(post)
    return acc
  }, {} as Record<string, { band: { id: number; name: string; bandKey: string }; posts: Post[] }>)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="게시물 선택"
      size="2xl"
    >
      {isLoading ? (
        <div className="py-12">
          <Loading />
          <p className="text-center text-gray-600 mt-4">게시물을 불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="py-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="text-yellow-500" size={48} />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">게시물이 없습니다</h3>
              <p className="text-gray-600">{error}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-[calc(75vh-12rem)]">
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 게시물을 선택하면 AI가 자동으로 상품 정보를 생성합니다.
              <strong className="ml-1">여러 게시물을 선택하여 한 번에 등록할 수 있습니다.</strong>
            </p>
          </div>

          {/* 선택된 게시물 수 표시 */}
          {selectedPostIds.length > 0 && (
            <div className="mb-4 p-2 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
              <span className="text-sm text-purple-800 font-medium">
                {selectedPostIds.length}개 게시물 선택됨
              </span>
              <button
                onClick={() => setSelectedPostIds([])}
                className="text-sm text-purple-600 hover:text-purple-800 underline"
              >
                선택 해제
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-3">
              {Object.entries(groupedPosts).map(([bandKey, group]) => {
                const isBandExpanded = expandedBandKeys.includes(bandKey)
                const bandPostIds = group.posts.map(p => p.id)
                const selectedInBand = bandPostIds.filter(id => selectedPostIds.includes(id)).length
                const allBandSelected = selectedInBand === group.posts.length
                return (
                  <div key={bandKey} className="border rounded-lg bg-white">
                    {/* 밴드 헤더 */}
                    <div
                      className="p-3 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleToggleBandExpand(bandKey)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* 밴드 전체 선택 체크박스 */}
                          <input
                            type="checkbox"
                            checked={allBandSelected && group.posts.length > 0}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleToggleBandSelect(group.posts)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 cursor-pointer rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          {isBandExpanded ? (
                            <ChevronDown size={20} className="text-gray-600" />
                          ) : (
                            <ChevronRight size={20} className="text-gray-600" />
                          )}
                          <h3 className="font-semibold text-gray-900">{group.band.name}</h3>
                          <span className="text-sm text-gray-500">
                            ({selectedInBand > 0 ? `${selectedInBand}/` : ''}{group.posts.length}개)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 밴드별 게시물 목록 */}
                    {isBandExpanded && (
                      <div className="p-2 space-y-2">
                        {group.posts.map((post) => {
                          const isExpanded = expandedPostIds.includes(post.id)
                          const isSelected = selectedPostIds.includes(post.id)
                          return (
                            <div
                              key={post.id}
                              className={`
                                border rounded-lg transition-colors cursor-pointer
                                ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}
                              `}
                              onClick={() => handleToggleSelect(post.id)}
                            >
                              {/* 간략 정보 */}
                              <div className="p-4">
                                <div className="flex items-start gap-4">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelect(post.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-1 w-4 h-4 cursor-pointer rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-gray-900">{post.title}</h4>
                                        <p className="text-sm text-gray-500 mt-1">
                                          {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                                        </p>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleToggleExpand(post.id)
                                        }}
                                        className="flex-shrink-0"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown size={20} className="text-gray-400" />
                                        ) : (
                                          <ChevronRight size={20} className="text-gray-400" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* 상세 정보 (확장 시) */}
                              {isExpanded && (
                                <div className="px-4 pb-4 pt-2 border-t border-gray-200">
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                                        {post.content}
                                      </p>
                                    </div>
                                    {post.images && post.images.length > 0 && (
                                      <div>
                                        <div className="flex gap-2 overflow-x-auto">
                                          {post.images.slice(0, 4).map((img, idx) => (
                                            <img
                                              key={idx}
                                              src={img.imageUrl}
                                              alt={`이미지 ${idx + 1}`}
                                              className="w-20 h-20 rounded object-cover flex-shrink-0"
                                            />
                                          ))}
                                          {post.images.length > 4 && (
                                            <div className="w-20 h-20 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                                              <span className="text-xs text-gray-600">
                                                +{post.images.length - 4}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleToggleExpand(post.id)
                                      }}
                                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                    >
                                      <ChevronUp size={16} />
                                      접기
                                    </button>
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

          <ModalFooter className="mt-4">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={selectedPostIds.length === 0}
            >
              <Package size={16} />
              {'상품 생성'
              }
            </Button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  )
}
