'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Star, Package, X, Pencil } from 'lucide-react'

interface WritableItem {
  orderItemId: number
  orderId: number
  orderNumber: string
  deliveredAt: string | null
  productPublishId: number
  productName: string
  optionSummary: string | null
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  product: {
    id: number
    name: string
    thumbnailUrl: string | null
  } | null
}

interface WrittenReview {
  id: number
  orderItemId: number
  orderId: number
  orderNumber: string | null
  rating: number
  title: string | null
  content: string
  images: string[] | null
  createdAt: string
  product: {
    id: number
    name: string
    thumbnailUrl: string | null
  }
  orderItem: {
    productName: string
    optionSummary: string | null
    thumbnailUrl: string | null
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function ReviewsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'writable' | 'written'>('writable')
  const [writableItems, setWritableItems] = useState<WritableItem[]>([])
  const [writtenReviews, setWrittenReviews] = useState<WrittenReview[]>([])
  const [loading, setLoading] = useState(true)
  const [writablePagination, setWritablePagination] = useState<Pagination | null>(null)
  const [writtenPagination, setWrittenPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // 리뷰 작성 모달
  const [showWriteModal, setShowWriteModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<WritableItem | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewContent, setReviewContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 탭별 카운트
  const [writableCount, setWritableCount] = useState(0)
  const [writtenCount, setWrittenCount] = useState(0)

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session) {
      router.push('/auth/login?callbackUrl=/mypage/reviews')
      return
    }
    fetchCounts()
  }, [session, sessionStatus])

  useEffect(() => {
    if (session) {
      setCurrentPage(1)
      fetchData()
    }
  }, [activeTab, session])

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [currentPage])

  const fetchCounts = async () => {
    try {
      const [writableRes, writtenRes] = await Promise.all([
        fetch('/api/mypage/reviews?tab=writable&limit=1'),
        fetch('/api/mypage/reviews?tab=written&limit=1'),
      ])
      const [writableData, writtenData] = await Promise.all([
        writableRes.json(),
        writtenRes.json(),
      ])
      if (writableData.success) {
        setWritableCount(writableData.pagination.total)
      }
      if (writtenData.success) {
        setWrittenCount(writtenData.pagination.total)
      }
    } catch (error) {
      console.error('Failed to fetch counts:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('tab', activeTab)
      params.set('page', currentPage.toString())
      params.set('limit', '10')

      const response = await fetch(`/api/mypage/reviews?${params}`)
      const data = await response.json()

      if (data.success) {
        if (activeTab === 'writable') {
          setWritableItems(data.items)
          setWritablePagination(data.pagination)
        } else {
          setWrittenReviews(data.reviews)
          setWrittenPagination(data.pagination)
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const openWriteModal = (item: WritableItem) => {
    setSelectedItem(item)
    setReviewRating(5)
    setReviewTitle('')
    setReviewContent('')
    setShowWriteModal(true)
  }

  const closeWriteModal = () => {
    setShowWriteModal(false)
    setSelectedItem(null)
    setReviewRating(5)
    setReviewTitle('')
    setReviewContent('')
  }

  const handleSubmitReview = async () => {
    if (!selectedItem) return
    if (!reviewContent.trim()) {
      return
    }

    try {
      setSubmitting(true)
      const response = await fetch('/api/mypage/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderItemId: selectedItem.orderItemId,
          rating: reviewRating,
          title: reviewTitle.trim() || null,
          content: reviewContent.trim(),
          images: [],
        }),
      })

      const data = await response.json()

      if (data.success) {
        closeWriteModal()
        // 데이터 새로고침
        fetchCounts()
        fetchData()
      }
    } catch (error) {
      console.error('Failed to submit review:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const renderStars = (rating: number, interactive: boolean = false, onSelect?: (rating: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onSelect && onSelect(star)}
            className={interactive ? 'cursor-pointer' : 'cursor-default'}
            disabled={!interactive}
          >
            <Star
              className={`w-6 h-6 ${
                star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
              } ${interactive ? 'hover:text-yellow-400 transition-colors' : ''}`}
            />
          </button>
        ))}
      </div>
    )
  }

  const pagination = activeTab === 'writable' ? writablePagination : writtenPagination

  if (sessionStatus === 'loading' || (loading && writableItems.length === 0 && writtenReviews.length === 0)) {
    return (
      <div className="kurly-container py-12">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B] mx-auto"></div>
          <p className="mt-4 text-gray-600">후기 내역을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="kurly-container py-12">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">상품 후기</h1>
        <p className="text-gray-600">구매하신 상품의 후기를 작성하고 관리하세요</p>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => {
            setActiveTab('writable')
            setCurrentPage(1)
          }}
          className={`flex-1 py-4 text-center font-medium transition-colors relative ${
            activeTab === 'writable'
              ? 'text-[#FF6B6B]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          작성 가능한 후기
          <span className={`ml-2 px-2 py-0.5 rounded-full text-sm ${
            activeTab === 'writable'
              ? 'bg-[#FF6B6B] text-white'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {writableCount}
          </span>
          {activeTab === 'writable' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B6B]" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('written')
            setCurrentPage(1)
          }}
          className={`flex-1 py-4 text-center font-medium transition-colors relative ${
            activeTab === 'written'
              ? 'text-[#FF6B6B]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          작성한 후기
          <span className={`ml-2 px-2 py-0.5 rounded-full text-sm ${
            activeTab === 'written'
              ? 'bg-[#FF6B6B] text-white'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {writtenCount}
          </span>
          {activeTab === 'written' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B6B]" />
          )}
        </button>
      </div>

      {/* 로딩 오버레이 */}
      {loading && (
        <div className="fixed inset-0 bg-white/50 z-40 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6B6B]"></div>
        </div>
      )}

      {/* 작성 가능한 후기 탭 */}
      {activeTab === 'writable' && (
        <>
          {writableItems.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-lg">
              <Pencil className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">작성 가능한 후기가 없습니다</p>
              <p className="text-sm text-gray-500 mt-2">배송 완료된 상품의 후기를 작성할 수 있습니다</p>
            </div>
          ) : (
            <div className="space-y-4">
              {writableItems.map((item) => (
                <div
                  key={item.orderItemId}
                  className="bg-white border border-gray-200 rounded-lg p-6"
                >
                  <div className="flex gap-4 items-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">
                        {item.productName}
                      </h3>
                      {item.optionSummary && (
                        <p className="text-sm text-gray-500 mb-1">{item.optionSummary}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        배송완료: {formatDate(item.deliveredAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => openWriteModal(item)}
                      className="px-4 py-2 bg-[#FF6B6B] text-white rounded-md hover:bg-[#FF5252] transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <Pencil className="w-4 h-4" />
                      후기 작성
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 작성한 후기 탭 */}
      {activeTab === 'written' && (
        <>
          {writtenReviews.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-lg">
              <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">작성한 후기가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-6">
              {writtenReviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white border border-gray-200 rounded-lg p-6"
                >
                  {/* 상품 정보 */}
                  <div className="flex gap-4 mb-4 pb-4 border-b border-gray-100">
                    <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                      {review.orderItem?.thumbnailUrl || review.product.thumbnailUrl ? (
                        <img
                          src={review.orderItem?.thumbnailUrl || review.product.thumbnailUrl || ''}
                          alt={review.orderItem?.productName || review.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {review.orderItem?.productName || review.product.name}
                      </h3>
                      {review.orderItem?.optionSummary && (
                        <p className="text-sm text-gray-500">{review.orderItem.optionSummary}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(review.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* 평점 */}
                  <div className="mb-3">{renderStars(review.rating)}</div>

                  {/* 제목 */}
                  {review.title && (
                    <h4 className="font-semibold text-gray-900 mb-2">{review.title}</h4>
                  )}

                  {/* 내용 */}
                  <p className="text-gray-700 whitespace-pre-wrap mb-4">{review.content}</p>

                  {/* 이미지 */}
                  {review.images && review.images.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {review.images.map((img: string, idx: number) => (
                        <div key={idx} className="w-24 h-24 bg-gray-100 rounded-md overflow-hidden">
                          <img
                            src={img}
                            alt={`리뷰 이미지 ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 페이지네이션 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            이전
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter((page) => {
                return (
                  Math.abs(page - currentPage) <= 2 ||
                  page === 1 ||
                  page === pagination.totalPages
                )
              })
              .map((page, idx, arr) => {
                if (idx > 0 && page - arr[idx - 1] > 1) {
                  return (
                    <span key={`ellipsis-${page}`} className="px-2 text-gray-400">
                      ...
                    </span>
                  )
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-md transition-colors ${
                      currentPage === page
                        ? 'bg-[#FF6B6B] text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                )
              })}
          </div>
          <button
            onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={currentPage === pagination.totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            다음
          </button>
        </div>
      )}

      {/* 후기 작성 모달 */}
      {showWriteModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">후기 작성</h2>
              <button
                onClick={closeWriteModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-6">
              {/* 상품 정보 */}
              <div className="flex gap-4 mb-6 pb-6 border-b border-gray-100">
                <div className="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                  {selectedItem.thumbnailUrl ? (
                    <img
                      src={selectedItem.thumbnailUrl}
                      alt={selectedItem.productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{selectedItem.productName}</h3>
                  {selectedItem.optionSummary && (
                    <p className="text-sm text-gray-500">{selectedItem.optionSummary}</p>
                  )}
                </div>
              </div>

              {/* 평점 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  별점 <span className="text-red-500">*</span>
                </label>
                {renderStars(reviewRating, true, setReviewRating)}
                <p className="text-sm text-gray-500 mt-1">
                  {reviewRating === 5 && '아주 좋아요'}
                  {reviewRating === 4 && '맘에 들어요'}
                  {reviewRating === 3 && '보통이에요'}
                  {reviewRating === 2 && '그저 그래요'}
                  {reviewRating === 1 && '별로예요'}
                </p>
              </div>

              {/* 제목 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목 (선택)
                </label>
                <input
                  type="text"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="후기 제목을 입력해주세요"
                  maxLength={200}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none"
                />
              </div>

              {/* 내용 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  placeholder="상품에 대한 솔직한 후기를 남겨주세요"
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none resize-none"
                />
                <p className="text-sm text-gray-500 mt-1 text-right">
                  {reviewContent.length}/1000
                </p>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={closeWriteModal}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submitting || !reviewContent.trim()}
                className="flex-1 px-4 py-3 bg-[#FF6B6B] text-white rounded-md hover:bg-[#FF5252] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '작성 중...' : '작성 완료'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
