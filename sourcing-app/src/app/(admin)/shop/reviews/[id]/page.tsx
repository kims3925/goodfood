'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft,
  Star,
  User,
  Store,
  Package,
  MessageSquare,
  Eye,
  EyeOff,
  Calendar,
  ShoppingBag,
  ImageOff,
  AlertCircle,
  X,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import { formatPhoneNumber } from '@/modules/utils/phoneUtils'

interface ReviewDetail {
  id: number
  rating: number
  title: string | null
  content: string
  images: string[] | null
  isVisible: boolean
  createdAt: string
  updatedAt: string
  user: {
    id: number
    name: string | null
    email: string
    phone: string | null
  }
  orderItem: {
    id: number
    productName: string
    optionSummary: string | null
    thumbnailUrl: string | null
    quantity: number
    unitPrice: number
    totalPrice: number
    order: {
      id: number
      orderNumber: string
      status: string
      createdAt: string
      deliveredAt: string | null
      shop: {
        id: number
        name: string
        subdomain: string
      } | null
    } | null
  } | null
}

export default function ReviewDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [review, setReview] = useState<ReviewDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const res = await fetch(`/api/admin/reviews/${params.id}`)
        const result = await res.json()
        if (result.success) {
          setReview(result.data)
        } else {
          setError(result.error || '리뷰를 불러오는데 실패했습니다')
        }
      } catch {
        setError('리뷰를 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    if (params.id) fetchReview()
  }, [params.id])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }

  const formatPrice = (price: number) => `${price.toLocaleString()}원`

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={18}
          className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
        />
      ))}
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error || !review) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="text-red-500" size={48} />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">리뷰를 찾을 수 없습니다</h3>
                <p className="text-gray-600">{error}</p>
              </div>
              <Button variant="primary" onClick={() => router.push('/shop/reviews')}>
                목록으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/shop/reviews')}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">리뷰 상세</h1>
            <p className="text-sm text-gray-500 font-mono">#{review.id}</p>
          </div>
        </div>

        {/* 리뷰 정보 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare size={20} />
              리뷰 정보
            </h2>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* 평점 */}
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
                {renderStars(review.rating)}
                <span>{review.rating}점</span>
              </span>
              {/* 공개 상태 */}
              {review.isVisible ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700">
                  <Eye size={16} />
                  공개
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                  <EyeOff size={16} />
                  비공개
                </span>
              )}
              {/* 쇼핑몰 */}
              {review.orderItem?.order?.shop && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                  <Store size={16} />
                  {review.orderItem.order.shop.name}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">작성자</p>
                <p className="font-medium text-gray-900">{review.user.name || review.user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">작성일</p>
                <p className="font-medium text-gray-900">{formatDate(review.createdAt)}</p>
              </div>
              {review.orderItem?.order && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">주문번호</p>
                  <p
                    className="font-medium text-blue-600 font-mono cursor-pointer hover:underline"
                    onClick={() => router.push(`/shop/order/detail/${review.orderItem?.order?.id}?source=SHOPPING_MALL`)}
                  >
                    {review.orderItem.order.orderNumber}
                  </p>
                </div>
              )}
              {review.user.phone && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">연락처</p>
                  <p className="font-medium text-gray-900">{formatPhoneNumber(review.user.phone)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 리뷰 내용 + 상품 정보 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 리뷰 내용 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Star size={20} />
                  리뷰 내용
                </h2>
              </div>
              <div className="p-4">
                {review.title && (
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{review.title}</h3>
                )}
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{review.content}</p>

                {/* 이미지 */}
                {review.images && review.images.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500 mb-3">첨부 이미지 ({review.images.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {review.images.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImage(image)}
                          className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
                        >
                          <img src={image} alt={`이미지 ${index + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 주문 상품 */}
            {review.orderItem && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Package size={20} />
                    주문 상품
                  </h2>
                </div>
                <div className="p-4">
                  <div className="flex gap-4">
                    {review.orderItem.thumbnailUrl ? (
                      <Image
                        src={review.orderItem.thumbnailUrl}
                        alt={review.orderItem.productName}
                        width={80}
                        height={80}
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <ImageOff size={24} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 mb-1">{review.orderItem.productName}</h3>
                      {review.orderItem.optionSummary && (
                        <p className="text-sm text-gray-500 mb-1">{review.orderItem.optionSummary}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-medium text-gray-900">{formatPrice(review.orderItem.totalPrice)}</p>
                      <p className="text-sm text-gray-500">
                        {formatPrice(review.orderItem.unitPrice)} x {review.orderItem.quantity}개
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 작성자 정보 + 주문 정보 */}
          <div className="space-y-6">
            {/* 작성자 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <User size={20} />
                  작성자 정보
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-sm text-gray-500">이름</p>
                  <p className="font-medium text-gray-900">{review.user.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">이메일</p>
                  <p className="font-medium text-gray-900">{review.user.email}</p>
                </div>
                {review.user.phone && (
                  <div>
                    <p className="text-sm text-gray-500">연락처</p>
                    <p className="font-medium text-gray-900">{formatPhoneNumber(review.user.phone)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 주문 정보 */}
            {review.orderItem?.order && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <ShoppingBag size={20} />
                    주문 정보
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">주문번호</p>
                    <p className="font-medium text-gray-900 font-mono">
                      {review.orderItem.order.orderNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">주문일</p>
                    <p className="font-medium text-gray-900">{formatDate(review.orderItem.order.createdAt)}</p>
                  </div>
                  {review.orderItem.order.deliveredAt && (
                    <div>
                      <p className="text-sm text-gray-500">배송완료일</p>
                      <p className="font-medium text-gray-900">{formatDate(review.orderItem.order.deliveredAt)}</p>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-100">
                    <Button
                      variant="secondary"
                      onClick={() => router.push(`/shop/order/detail/${review.orderItem?.order?.id}?source=SHOPPING_MALL`)}
                      className="w-full"
                    >
                      주문 상세 보기
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 이미지 모달 */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={selectedImage}
            alt="리뷰 이미지"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
