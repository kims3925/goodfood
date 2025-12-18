'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Star,
  Calendar,
  Search,
  MessageSquare,
  Store,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import Loading from '@/components/ui/Loading'

interface ReviewUser {
  id: number
  name: string | null
  email: string
}

interface ReviewOrderItem {
  id: number
  productName: string
  optionSummary: string | null
  thumbnailUrl: string | null
  order: {
    id: number
    orderNumber: string
    shop: {
      id: number
      name: string
    } | null
  } | null
}

interface Review {
  id: number
  rating: number
  title: string | null
  content: string
  images: string[] | null
  isVisible: boolean
  createdAt: string
  user: ReviewUser
  orderItem: ReviewOrderItem | null
}

interface Shop {
  id: number
  name: string
}

interface ReviewData {
  reviews: Review[]
  shops: Shop[]
  stats: {
    totalReviews: number
    averageRating: number
    monthlyReviews: number
    filteredCount: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function ReviewListPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReviewData | null>(null)

  // 필터 상태
  const [shopId, setShopId] = useState('')
  const [rating, setRating] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (shopId) params.set('shopId', shopId)
      if (rating) params.set('rating', rating)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (search) params.set('search', search)
      params.set('page', page.toString())
      params.set('limit', '20')

      const res = await fetch(`/api/admin/reviews?${params}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('리뷰 데이터 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [shopId, rating, startDate, endDate, search, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const resetFilters = () => {
    setShopId('')
    setRating('')
    setStartDate('')
    setEndDate('')
    setSearch('')
    setSearchInput('')
    setPage(1)
  }

  const hasFilters = shopId || rating || startDate || endDate || search

  // 별점 렌더링
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">리뷰 관리</h1>
          <p className="text-gray-600">
            고객들이 작성한 상품 리뷰를 확인합니다.
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <MessageSquare size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 리뷰</p>
                <p className="text-2xl font-bold text-gray-900">{data?.stats.totalReviews || 0}건</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Star size={24} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">평균 평점</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-yellow-600">{data?.stats.averageRating || 0}</p>
                  <span className="text-gray-400">/ 5</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">이번 달 리뷰</p>
                <p className="text-2xl font-bold text-green-600">{data?.stats.monthlyReviews || 0}건</p>
              </div>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <RefreshCw size={24} className={`text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">데이터</p>
                <p className="text-lg font-bold text-gray-600">새로고침</p>
              </div>
            </div>
          </button>
        </div>

        {/* 필터 영역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* 쇼핑몰 필터 */}
            <div className="flex items-center gap-2">
              <Store size={16} className="text-gray-400" />
              <select
                value={shopId}
                onChange={(e) => { setShopId(e.target.value); setPage(1) }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 쇼핑몰</option>
                {data?.shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>{shop.name}</option>
                ))}
              </select>
            </div>

            {/* 평점 필터 */}
            <div className="flex items-center gap-2">
              <Star size={16} className="text-gray-400" />
              <select
                value={rating}
                onChange={(e) => { setRating(e.target.value); setPage(1) }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 평점</option>
                <option value="5">5점</option>
                <option value="4">4점</option>
                <option value="3">3점</option>
                <option value="2">2점</option>
                <option value="1">1점</option>
              </select>
            </div>

            {/* 날짜 범위 */}
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 검색 */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="리뷰 내용 검색"
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
              >
                검색
              </button>
            </div>

            {/* 필터 초기화 */}
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X size={14} />
                필터 초기화
              </button>
            )}
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <Loading />
          </div>
        ) : data && data.reviews.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* 검색 결과 요약 */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                총 <span className="font-semibold text-gray-900">{data.pagination.total}</span>개의 리뷰
              </p>
            </div>

            {/* 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">No.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">쇼핑몰</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">평점</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">리뷰 제목</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작성자</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작성일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.reviews.map((review, index) => (
                    <tr
                      key={review.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => window.location.href = `/shop/reviews/detail/${review.id}`}
                    >
                      <td className="px-4 py-3 text-sm text-center text-gray-500">
                        {(data.pagination.page - 1) * data.pagination.limit + index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {review.orderItem?.thumbnailUrl ? (
                            <img
                              src={review.orderItem.thumbnailUrl}
                              alt={review.orderItem.productName}
                              className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Store size={16} className="text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {review.orderItem?.productName || '-'}
                            </p>
                            {review.orderItem?.optionSummary && (
                              <p className="text-xs text-gray-500">
                                {review.orderItem.optionSummary}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {review.orderItem?.order?.shop?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {renderStars(review.rating)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900 truncate max-w-[250px]">
                          {review.title || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {review.user.name || review.user.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(review.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {data.pagination.totalPages > 1 && (
              <div className="px-4 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {data.pagination.page} / {data.pagination.totalPages} 페이지
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                    disabled={page === data.pagination.totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">리뷰가 없습니다</h3>
            <p className="text-gray-500">
              {hasFilters ? '검색 조건에 맞는 리뷰가 없습니다.' : '아직 작성된 리뷰가 없습니다.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
