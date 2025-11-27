'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Star } from 'lucide-react'

interface Review {
  id: number
  rating: number
  title: string | null
  content: string
  images: string | null
  createdAt: string
  product: {
    id: number
    name: string
    thumbnailUrl: string | null
  }
}

export default function ReviewsPage() {
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) {
      fetchReviews()
    }
  }, [session])

  const fetchReviews = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/mypage/reviews')
      const data = await response.json()

      if (data.success) {
        setReviews(data.reviews)
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="kurly-container py-12">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B] mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="kurly-container py-12">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">상품 후기</h1>
        <p className="text-gray-600">작성한 후기를 확인하세요</p>
      </div>

      {/* 리뷰 목록 */}
      {reviews.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg">
          <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">작성한 후기가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white border border-gray-200 rounded-lg p-6"
            >
              {/* 상품 정보 */}
              <div className="flex gap-4 mb-4 pb-4 border-b border-gray-100">
                <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                  {review.product.thumbnailUrl ? (
                    <img
                      src={review.product.thumbnailUrl}
                      alt={review.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Star className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{review.product.name}</h3>
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
              {review.images && (
                <div className="flex gap-2 flex-wrap">
                  {JSON.parse(review.images).map((img: string, idx: number) => (
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
    </div>
  )
}
