'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Package, Search, Trash2, Eye, Calendar, Tag, ChevronLeft, ChevronRight, CheckCircle, Settings, X, Filter, ArrowLeft, RefreshCw, Share2 } from 'lucide-react'

interface RetailPost {
  id: string
  title: string
  price: number
  shippingFee?: number | null
  status: string
  viewCount: number
  likeCount: number
  commentCount: number
  publishedAt: string
  createdAt: string
  bandName: string
  bandKey: string
  productTitle: string
  firstImage?: string | null
  images: string[]
  productImages: string[]
}

interface RetailBand {
  id: string
  bandKey: string
  bandName: string
  description?: string
  memberCount: number
  isActive: boolean
  createdAt: string
}

export default function RetailPostsPage() {
  const [posts, setPosts] = useState<RetailPost[]>([])
  const [retailBands, setRetailBands] = useState<RetailBand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedBand, setSelectedBand] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedPosts, setSelectedPosts] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    loadRetailBands()
  }, [])

  useEffect(() => {
    loadPosts()
  }, [selectedBand, statusFilter, currentPage, itemsPerPage])

  const loadRetailBands = async () => {
    try {
      const response = await fetch('/api/retail/bands')
      const data = await response.json()

      if (data.success) {
        setRetailBands(data.bands || [])
      }
    } catch (error) {
      console.error('Failed to load retail bands:', error)
    }
  }

  const loadPosts = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(selectedBand !== 'all' && { bandId: selectedBand }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      })

      const response = await fetch(`/api/retail/posts?${params}`)
      const data = await response.json()

      if (data.success) {
        setPosts(data.posts || [])
        setTotalCount(data.pagination?.totalCount || 0)
        setTotalPages(data.pagination?.totalPages || 0)
      }
    } catch (error) {
      console.error('Failed to load posts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 필터링된 게시물 목록 (검색어)
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          post.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          post.bandName.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })
  }, [posts, searchTerm])

  const handlePostToggle = (postId: string) => {
    setSelectedPosts(prev =>
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    )
  }

  const handleSelectAll = () => {
    const allPostIds = filteredPosts.map(post => post.id)
    setSelectedPosts(prev =>
      prev.length === allPostIds.length ? [] : allPostIds
    )
  }

  const handleDeleteSelectedPosts = async () => {
    if (selectedPosts.length === 0) {
      alert('삭제할 게시물을 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${selectedPosts.length}개의 게시물을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      setIsDeleting(true)
      const response = await fetch('/api/retail/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds: selectedPosts }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`${selectedPosts.length}개 게시물이 삭제되었습니다.`)
        setSelectedPosts([])
        loadPosts()
      } else {
        alert('게시물 삭제에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      alert('게시물 삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR') + '원'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">발행됨</span>
      case 'DELETED':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">삭제됨</span>
      case 'FAILED':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">실패</span>
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/retail/publish" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">소매밴드 게시물 관리</h1>
            </div>
            <button
              onClick={loadPosts}
              className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              <RefreshCw className="w-4 h-4" />
              새로고침
            </button>
          </div>
          <p className="text-gray-600">소매밴드에 등록된 게시물을 관리하고 삭제할 수 있습니다.</p>
        </div>

        {/* 하위 메뉴 네비게이션 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <nav className="flex space-x-6">
            <Link
              href="/retail/publish"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4" />
              소매밴드 발행
            </Link>
            <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
              <Package className="w-4 h-4" />
              소매밴드 게시물 관리
            </div>
          </nav>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* 밴드 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">밴드 선택</label>
              <select
                value={selectedBand}
                onChange={(e) => {
                  setSelectedBand(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">전체 밴드</option>
                {retailBands.map(band => (
                  <option key={band.id} value={band.id}>
                    {band.bandName} ({band.memberCount.toLocaleString()}명)
                  </option>
                ))}
              </select>
            </div>

            {/* 상태 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">전체</option>
                <option value="PUBLISHED">발행됨</option>
                <option value="DELETED">삭제됨</option>
                <option value="FAILED">실패</option>
              </select>
            </div>

            {/* 페이지당 개수 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">페이지당 개수</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value))
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={50}>50개</option>
                <option value={100}>100개</option>
                <option value={300}>300개</option>
              </select>
            </div>

            {/* 검색 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="게시물 제목, 상품명, 밴드명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              총 {totalCount.toLocaleString()}개의 게시물 ({filteredPosts.length.toLocaleString()}개 표시)
            </div>
            <button
              onClick={handleDeleteSelectedPosts}
              disabled={selectedPosts.length === 0 || isDeleting}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? '삭제 중...' : `선택삭제 (${selectedPosts.length})`}
            </button>
          </div>
        </div>

        {/* 게시물 목록 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
              <p className="text-gray-500">게시물 목록을 불러오는 중...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">등록된 게시물이 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedPosts.length === filteredPosts.length && filteredPosts.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        이미지
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        게시물 정보
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        가격
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        밴드
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        통계
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상태
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        등록일
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedPosts.includes(post.id)}
                            onChange={() => handlePostToggle(post.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {post.firstImage ? (
                            <img
                              src={post.firstImage}
                              alt={post.title}
                              className="w-16 h-16 object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%236b7280"%3E이미지%3C/text%3E%3C/svg%3E'
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {post.title}
                            </div>
                            <div className="text-sm text-gray-500 truncate mt-1">
                              원본: {post.productTitle}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatPrice(post.price)}
                          </div>
                          {post.shippingFee && post.shippingFee > 0 && (
                            <div className="text-sm text-gray-500">
                              배송비: {formatPrice(post.shippingFee)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {post.bandName}
                          </div>
                          <div className="text-sm text-gray-500 font-mono">
                            {post.bandKey}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            조회 {post.viewCount.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            좋아요 {post.likeCount} · 댓글 {post.commentCount}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(post.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(post.publishedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      총 {totalCount.toLocaleString()}개 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalCount)}개 표시
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        이전
                      </button>
                      <span className="text-sm text-gray-700">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        다음
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}