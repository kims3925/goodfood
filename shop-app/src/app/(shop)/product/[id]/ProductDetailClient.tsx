'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Heart, Share2, Minus, Plus, Star, ChevronDown } from 'lucide-react'
import { useCartNotification } from '@/contexts/CartNotificationContext'
import { useShopUrl } from '@/hooks/useShopUrl'

export default function ProductDetailClient() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { showNotification, refreshCartCount } = useCartNotification()
  const { getPath, getApiPath } = useShopUrl()
  const bandId = searchParams.get('bandId')
  const [product, setProduct] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState<any>(null)
  const [selectedBundleQty, setSelectedBundleQty] = useState(1) // 합배송 선택 수량
  const [activeTab, setActiveTab] = useState('detail')
  const [isLoading, setIsLoading] = useState(true)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)

  // 리뷰 관련 상태
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewStats, setReviewStats] = useState<{
    totalCount: number
    averageRating: number
    ratingCounts: Record<number, number>
  } | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewPage, setReviewPage] = useState(1)
  const [reviewTotalPages, setReviewTotalPages] = useState(1)
  const [reviewSortBy, setReviewSortBy] = useState('recent')

  useEffect(() => {
    loadProduct()
  }, [params.id, bandId])

  useEffect(() => {
    if (session && product) {
      checkWishlistStatus()
    }
  }, [session, product])

  // 리뷰 탭 활성화 시 리뷰 로드
  useEffect(() => {
    if (activeTab === 'review' && product) {
      loadReviews()
    }
  }, [activeTab, product, reviewPage, reviewSortBy])

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      const apiUrl = bandId
        ? getApiPath(`/api/shop/products/${params.id}?bandId=${bandId}`)
        : getApiPath(`/api/shop/products/${params.id}`)
      const response = await fetch(apiUrl)
      const data = await response.json()

      if (data.success) {
        setProduct(data.product)
        // 첫 번째 variant를 기본 선택
        if (data.product.variants && data.product.variants.length > 0) {
          setSelectedVariant(data.product.variants[0])
        }
      } else {
        console.error('Failed to load product:', data.error)
        setProduct(null)
      }
    } catch (error) {
      console.error('Failed to load product:', error)
      setProduct(null)
    } finally {
      setIsLoading(false)
    }
  }

  const checkWishlistStatus = async () => {
    if (!session) return

    try {
      const response = await fetch(getApiPath('/api/mypage/wishlist'))
      const data = await response.json()

      if (data.success) {
        const isInWishlist = data.wishlists.some(
          (item: any) => item.product.id === parseInt(params.id as string)
        )
        setIsWishlisted(isInWishlist)
      }
    } catch (error) {
      console.error('Failed to check wishlist status:', error)
    }
  }

  // 리뷰 로드 함수
  const loadReviews = async () => {
    if (!product?.publishedProductId) return

    try {
      setReviewsLoading(true)
      const response = await fetch(
        getApiPath(`/api/shop/products/${product.publishedProductId}/reviews?page=${reviewPage}&limit=5&sortBy=${reviewSortBy}`)
      )
      const data = await response.json()

      if (data.success) {
        setReviews(data.reviews)
        setReviewStats(data.stats)
        setReviewTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to load reviews:', error)
    } finally {
      setReviewsLoading(false)
    }
  }

  // 별점 렌더링 헬퍼
  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClass = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const handleToggleWishlist = async () => {
    if (!session) {
      window.location.href = getPath('/auth/login')
      return
    }

    if (wishlistLoading) return

    // productId를 숫자로 확실하게 변환
    const idParam = Array.isArray(params.id) ? params.id[0] : params.id
    const productIdNum = typeof idParam === 'string' ? parseInt(idParam) : idParam
    if (isNaN(productIdNum)) {
      return
    }

    try {
      setWishlistLoading(true)

      if (isWishlisted) {
        // 찜 해제 - 먼저 찜 목록에서 해당 상품의 wishlist ID를 찾아야 함
        const response = await fetch(getApiPath('/api/mypage/wishlist'))
        const data = await response.json()

        if (data.success) {
          const wishlistItem = data.wishlists.find(
            (item: any) => item.product.id === productIdNum
          )

          if (wishlistItem) {
            const deleteResponse = await fetch(getApiPath(`/api/mypage/wishlist/${wishlistItem.id}`), {
              method: 'DELETE',
            })
            const deleteData = await deleteResponse.json()

            if (deleteData.success) {
              setIsWishlisted(false)
            }
          }
        }
      } else {
        // 찜 추가
        console.log('[Wishlist] Adding product:', productIdNum)

        const response = await fetch(getApiPath('/api/mypage/wishlist'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: productIdNum }),
        })

        const data = await response.json()
        console.log('[Wishlist] Add response:', data)

        if (data.success) {
          setIsWishlisted(true)
        } else {
          console.error('[Wishlist] Error:', data.error)
        }
      }
    } catch (error) {
      console.error('[Wishlist] Failed to toggle wishlist:', error)
    } finally {
      setWishlistLoading(false)
    }
  }

  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null || isNaN(price)) {
      return '0'
    }
    return price.toLocaleString()
  }

  const handleQuantityChange = (type: 'increase' | 'decrease') => {
    if (type === 'increase') {
      setQuantity(prev => prev + 1)
    } else {
      setQuantity(prev => Math.max(1, prev - 1))
    }
  }

  const handleAddToCart = async () => {
    if (!product?.publishedProductId || !selectedVariant || product.isSoldOut) {
      return
    }

    try {
      // 세션 ID 생성 (실제로는 세션 관리 라이브러리 사용)
      let sessionId = localStorage.getItem('sessionId')
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2)
        localStorage.setItem('sessionId', sessionId)
      }

      const cartData = {
        sessionId,
        publishedProductId: product.publishedProductId,
        variantId: selectedVariant.id,
        quantity
      }

      const response = await fetch(getApiPath('/api/cart'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cartData)
      })

      const data = await response.json()

      if (data.success) {
        // 장바구니 수량 업데이트
        await refreshCartCount()

        // 알림 버블 표시
        showNotification({
          title: product.title,
          image: product.images?.[0] || '/images/placeholder.png',
          quantity: quantity,
          isExisting: data.isExisting // API에서 이미 담긴 상품인지 여부 반환
        })
      }
    } catch (error) {
      console.error('장바구니 추가 오류:', error)
    }
  }

  const handleBuyNow = () => {
    // publishedProductId와 variantId를 체크아웃 페이지로 전달
    if (!product?.publishedProductId || !selectedVariant || product.isSoldOut) {
      return
    }
    // 비회원도 바로구매 가능 (checkout 페이지에서 비회원 주문 처리)
    const checkoutUrl = getPath(`/checkout?publishedProductId=${product.publishedProductId}&variantId=${selectedVariant.id}&quantity=${quantity}`)
    window.location.href = checkoutUrl
  }

  const handleShare = () => {
    const currentPrice = selectedVariant?.price || 0
    const shareText = `${product.title}\n${formatPrice(currentPrice)}원\n${window.location.href}`
    navigator.clipboard.writeText(shareText)
  }

  // 선택된 variant의 가격
  const currentPrice = selectedVariant?.price || 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B]"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-gray-500 mb-4">상품을 찾을 수 없습니다.</p>
        <Link href={getPath('/main')} className="text-blue-600 hover:underline">쇼핑몰 홈으로 돌아가기</Link>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 bg-white border-b md:hidden">
        <div className="flex items-center justify-between p-4">
          <Link href={getPath('/main')} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-sm font-medium flex-1 text-center line-clamp-1 px-2">
            {product.title}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleWishlist}
              disabled={wishlistLoading}
              className="p-1"
            >
              <Heart
                className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-700'}`}
              />
            </button>
            <button onClick={handleShare} className="p-1">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1050px] mx-auto px-4 py-4 md:py-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Product Images - 고정 너비 */}
          <div className="w-full lg:w-[430px] flex-shrink-0 space-y-3">
            <div className="relative w-full h-[430px] bg-white rounded-lg overflow-hidden border border-gray-200">
              <Image
                src={product.images[selectedImage]}
                alt={product.title}
                fill
                sizes="430px"
                className="object-cover"
                priority
              />
            </div>
            {/* 썸네일 이미지 - 4열 고정 그리드 */}
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(0, 4).map((image: string, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                    selectedImage === index ? 'border-[#FF6B6B]' : 'border-gray-200'
                  }`}
                >
                  <Image src={image} alt="" fill sizes="100px" className="object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex-1 space-y-6">
            {/* Category & Title */}
            <div>
              <span className="inline-block px-2 py-1 text-xs font-medium text-[#FF6B6B] bg-[#FFF5F5] rounded-md mb-3">
                {product.category}
              </span>
              <h1 className="text-2xl font-bold text-gray-900 leading-snug mb-2">{product.title}</h1>
              <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
            </div>


            {/* Option & Quantity Selection */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              {/* Variant 선택 */}
              {product.variants && product.variants.length > 1 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">옵션 선택</label>
                    <span className="text-lg font-bold text-gray-900">{formatPrice(currentPrice)}원</span>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedVariant?.id || ''}
                      onChange={(e) => {
                        const variant = product.variants.find((v: any) => v.id === parseInt(e.target.value))
                        setSelectedVariant(variant)
                        setQuantity(1)
                      }}
                      className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-3.5 pr-10 text-gray-900 bg-gray-50 hover:border-gray-300 focus:border-[#FF6B6B] focus:ring-2 focus:ring-[#FF6B6B]/20 outline-none transition-all cursor-pointer"
                    >
                      {product.variants.map((variant: any) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.optionSummary} - {formatPrice(variant.price)}원
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* 단일 옵션일 때 가격 표시 */}
              {product.variants && product.variants.length === 1 && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">상품 가격</p>
                    <p className="text-xs text-gray-500 mt-0.5">{product.variants[0].optionSummary}</p>
                  </div>
                  <span className="text-xl font-bold text-gray-900">{formatPrice(currentPrice)}원</span>
                </div>
              )}

              {/* 합배송 옵션 or 일반 수량 선택 */}
              {product.bundleOptions && product.bundleOptions.length > 0 ? (
                // 합배송 가능 상품: 드롭다운 선택
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">수량 선택 (합배송)</label>
                    {(() => {
                      const opt = product.bundleOptions.find((o: any) => o.qty === selectedBundleQty)
                      return opt?.discount > 0 && (
                        <span className="text-sm text-[#FF6B6B] font-medium">-{formatPrice(opt.discount)}원 할인</span>
                      )
                    })()}
                  </div>
                  <div className="relative">
                    <select
                      value={selectedBundleQty}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value)
                        setSelectedBundleQty(qty)
                        setQuantity(qty)
                      }}
                      className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-3.5 pr-10 text-gray-900 bg-gray-50 hover:border-gray-300 focus:border-[#FF6B6B] focus:ring-2 focus:ring-[#FF6B6B]/20 outline-none transition-all cursor-pointer"
                    >
                      {product.bundleOptions.map((option: any) => (
                        <option key={option.qty} value={option.qty}>
                          {option.label} - {formatPrice(option.totalPrice)}원
                          {option.discount > 0 ? ` (배송비 -${formatPrice(option.discount)}원)` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              ) : (
                // 일반 상품: 수량 선택
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <label className="text-sm font-medium text-gray-700">수량</label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                    <button
                      onClick={() => handleQuantityChange('decrease')}
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors"
                    >
                      <Minus className="h-4 w-4 text-gray-600" />
                    </button>
                    <span className="w-14 text-center font-semibold text-gray-900">{quantity}</span>
                    <button
                      onClick={() => handleQuantityChange('increase')}
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors"
                    >
                      <Plus className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Price Summary */}
            <div className="bg-gradient-to-r from-[#FFF5F5] to-[#FFF0F0] rounded-xl p-5">
              {product.bundleOptions && product.bundleOptions.length > 0 ? (
                // 합배송 가격 표시
                (() => {
                  const bundleOption = product.bundleOptions.find((opt: any) => opt.qty === selectedBundleQty)
                  return (
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">
                          {bundleOption?.label || `${selectedBundleQty}개`}
                        </p>
                        <p className="text-sm font-medium text-gray-600">총 상품금액</p>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-bold text-[#FF6B6B]">
                          {formatPrice(bundleOption?.totalPrice || currentPrice * quantity)}
                        </span>
                        <span className="text-lg text-[#FF6B6B] ml-1">원</span>
                        {bundleOption?.discount > 0 && (
                          <p className="text-sm text-[#FF6B6B] font-medium mt-1">
                            배송비 할인 -{formatPrice(bundleOption.discount)}원
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()
              ) : (
                // 일반 가격 표시
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">
                      {formatPrice(currentPrice)}원 × {quantity}개
                    </p>
                    <p className="text-sm font-medium text-gray-600">총 상품금액</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-bold text-[#FF6B6B]">{formatPrice(currentPrice * quantity)}</span>
                    <span className="text-lg text-[#FF6B6B] ml-1">원</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleToggleWishlist}
                disabled={wishlistLoading}
                className="w-14 h-14 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center justify-center flex-shrink-0 transition-colors"
              >
                <Heart
                  className={`h-6 w-6 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                />
              </button>
              {product.isSoldOut ? (
                // 품절 상태
                <button
                  disabled
                  className="flex-[2] h-14 rounded-xl font-semibold text-base bg-gray-200 text-gray-500 cursor-not-allowed"
                >
                  품절된 상품입니다
                </button>
              ) : (
                // 정상 판매 상태
                <>
                  <button
                    onClick={handleAddToCart}
                    disabled={!selectedVariant}
                    className={`flex-1 h-14 rounded-xl font-semibold text-base transition-all ${
                      selectedVariant
                        ? 'bg-white border-2 border-[#FF6B6B] text-[#FF6B6B] hover:bg-[#FFF5F5]'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    장바구니
                  </button>
                  <button
                    onClick={handleBuyNow}
                    disabled={!selectedVariant}
                    className={`flex-1 h-14 rounded-xl font-semibold text-base transition-all ${
                      selectedVariant
                        ? 'bg-[#FF6B6B] text-white hover:bg-[#FF5252] shadow-lg shadow-[#FF6B6B]/25'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    구매하기
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 bg-white rounded-lg">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('detail')}
              className={`flex-1 py-4 text-sm font-medium ${
                activeTab === 'detail'
                  ? 'text-[#FF6B6B] border-b-2 border-[#FF6B6B]'
                  : 'text-gray-500'
              }`}
            >
              상품설명
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`flex-1 py-4 text-sm font-medium ${
                activeTab === 'review'
                  ? 'text-[#FF6B6B] border-b-2 border-[#FF6B6B]'
                  : 'text-gray-500'
              }`}
            >
              리뷰 {reviewStats && reviewStats.totalCount > 0 && `(${reviewStats.totalCount})`}
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-4 text-sm font-medium ${
                activeTab === 'info'
                  ? 'text-[#FF6B6B] border-b-2 border-[#FF6B6B]'
                  : 'text-gray-500'
              }`}
            >
              문의
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'detail' && (
              <div className="space-y-4">
                <p className="text-gray-700">{product.description}</p>
                {product.detailImages && product.detailImages.map((image: string, index: number) => (
                  <div key={index} className="relative w-full">
                    <Image src={image} alt="" width={800} height={800} sizes="100vw" className="w-full h-auto rounded-lg" />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'review' && (
              <div className="space-y-6">
                {/* 리뷰 통계 */}
                {reviewStats && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                      {/* 평균 별점 */}
                      <div className="flex flex-col items-center">
                        <span className="text-4xl font-bold text-gray-900">
                          {reviewStats.averageRating.toFixed(1)}
                        </span>
                        <div className="mt-2">{renderStars(Math.round(reviewStats.averageRating), 'lg')}</div>
                        <span className="text-sm text-gray-500 mt-1">
                          {reviewStats.totalCount}개의 리뷰
                        </span>
                      </div>

                      {/* 별점 분포 */}
                      <div className="flex-1">
                        {[5, 4, 3, 2, 1].map((rating) => {
                          const count = reviewStats.ratingCounts[rating] || 0
                          const percentage = reviewStats.totalCount > 0
                            ? (count / reviewStats.totalCount) * 100
                            : 0
                          return (
                            <div key={rating} className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-500 w-6">{rating}점</span>
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-yellow-400 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 정렬 옵션 */}
                <div className="flex justify-end">
                  <select
                    value={reviewSortBy}
                    onChange={(e) => {
                      setReviewSortBy(e.target.value)
                      setReviewPage(1)
                    }}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="recent">최신순</option>
                    <option value="rating_high">별점 높은순</option>
                    <option value="rating_low">별점 낮은순</option>
                  </select>
                </div>

                {/* 리뷰 목록 */}
                {reviewsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6B6B]"></div>
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">아직 작성된 리뷰가 없습니다.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {reviews.map((review) => (
                      <div key={review.id} className="py-5">
                        {/* 리뷰 헤더 */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {renderStars(review.rating, 'sm')}
                            <span className="text-sm font-medium text-gray-700">
                              {review.user.name}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {formatDate(review.createdAt)}
                          </span>
                        </div>

                        {/* 옵션 정보 */}
                        {review.optionSummary && (
                          <p className="text-xs text-gray-400 mb-2">
                            옵션: {review.optionSummary}
                          </p>
                        )}

                        {/* 리뷰 제목 */}
                        {review.title && (
                          <h4 className="font-medium text-gray-900 mb-2">
                            {review.title}
                          </h4>
                        )}

                        {/* 리뷰 내용 */}
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {review.content}
                        </p>

                        {/* 리뷰 이미지 */}
                        {review.images && review.images.length > 0 && (
                          <div className="flex gap-2 mt-3 overflow-x-auto">
                            {review.images.map((reviewImage: string, idx: number) => (
                              <div key={idx} className="relative w-20 h-20 flex-shrink-0">
                                <Image
                                  src={reviewImage}
                                  alt={`리뷰 이미지 ${idx + 1}`}
                                  fill
                                  sizes="80px"
                                  className="object-cover rounded-lg"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 페이지네이션 */}
                {reviewTotalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <button
                      onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                      disabled={reviewPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      이전
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-600">
                      {reviewPage} / {reviewTotalPages}
                    </span>
                    <button
                      onClick={() => setReviewPage((p) => Math.min(reviewTotalPages, p + 1))}
                      disabled={reviewPage === reviewTotalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      다음
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'info' && (
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <h3 className="font-medium mb-2">배송 안내</h3>
                  <ul className="space-y-1 text-gray-600">
                    {product.shippingInfo?.defaultShippingFee > 0 && (
                      <li>• 배송비: {formatPrice(product.shippingInfo.defaultShippingFee)}원
                        {product.shippingInfo?.freeShippingAmount > 0 &&
                          ` (${formatPrice(product.shippingInfo.freeShippingAmount)}원 이상 무료배송)`}
                      </li>
                    )}
                    <li>• 배송기간: 결제 후 2-3일 이내</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium mb-2">교환/환불 안내</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>• 상품 수령 후 7일 이내 교환/환불 가능</li>
                    <li>• 단순 변심의 경우 왕복 배송비 구매자 부담</li>
                    <li>• 상품 하자의 경우 무료 교환/환불</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Fixed Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-4 lg:hidden z-40">
        <div className="flex gap-3">
          <button
            onClick={handleToggleWishlist}
            disabled={wishlistLoading}
            className="w-12 h-12 border border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0"
          >
            <Heart
              className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
            />
          </button>
          {product.isSoldOut ? (
            // 품절 상태
            <button
              disabled
              className="flex-[2] h-12 rounded-xl font-semibold bg-gray-200 text-gray-500 cursor-not-allowed"
            >
              품절된 상품입니다
            </button>
          ) : (
            // 정상 판매 상태
            <>
              <button
                onClick={handleAddToCart}
                disabled={!selectedVariant}
                className={`flex-1 h-12 rounded-xl font-semibold transition-all ${
                  selectedVariant
                    ? 'bg-white border-2 border-[#FF6B6B] text-[#FF6B6B]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                장바구니
              </button>
              <button
                onClick={handleBuyNow}
                disabled={!selectedVariant}
                className={`flex-1 h-12 rounded-xl font-semibold transition-all ${
                  selectedVariant
                    ? 'bg-[#FF6B6B] text-white shadow-lg shadow-[#FF6B6B]/25'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                구매하기
              </button>
            </>
          )}
        </div>
      </div>

      {/* 모바일에서 하단 고정바 영역 확보 */}
      <div className="h-20 lg:hidden"></div>
    </div>
  )
}
