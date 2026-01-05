'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Heart, Share2, Minus, Plus, Star, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCartNotification, dispatchCartUpdate } from '@/contexts/CartNotificationContext'
import { useShopUrl } from '@/hooks/useShopUrl'

export default function ProductDetailClient() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { showNotification } = useCartNotification()
  const { getPath, getApiPath } = useShopUrl()
  const bandId = searchParams.get('bandId')
  const [product, setProduct] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const thumbnailContainerRef = useRef<HTMLDivElement>(null)

  // 섹션별 ref (Sticky Tabs + Scroll Spy)
  const tabsRef = useRef<HTMLDivElement>(null)
  const detailSectionRef = useRef<HTMLDivElement>(null)
  const reviewSectionRef = useRef<HTMLDivElement>(null)
  const infoSectionRef = useRef<HTMLDivElement>(null)

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

  const loadProduct = useCallback(async () => {
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
  }, [params.id, bandId, getApiPath])

  const checkWishlistStatus = useCallback(async () => {
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
  }, [session, params.id, getApiPath])

  // 리뷰 로드 함수
  const loadReviews = useCallback(async () => {
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
  }, [product?.publishedProductId, reviewPage, reviewSortBy, getApiPath])

  useEffect(() => {
    loadProduct()
  }, [loadProduct])

  useEffect(() => {
    if (session && product) {
      checkWishlistStatus()
    }
  }, [session, product, checkWishlistStatus])

  // 리뷰 섹션이 보이면 리뷰 로드
  useEffect(() => {
    if (activeTab === 'review' && product) {
      loadReviews()
    }
  }, [activeTab, product, loadReviews])

  // Scroll Spy: 스크롤 위치에 따라 활성 탭 변경
  useEffect(() => {
    const handleScroll = () => {
      // StoreLayout 헤더 높이 계산 (유틸리티 바 32px 포함)
      const windowWidth = window.innerWidth
      let storeHeaderHeight = 96 // 64 + 32 (유틸리티 바)
      if (windowWidth >= 1024) {
        storeHeaderHeight = 132 // 100 + 32
      } else if (windowWidth >= 768) {
        storeHeaderHeight = 112 // 80 + 32
      }
      const tabsHeight = 56
      const scrollPosition = window.scrollY + storeHeaderHeight + tabsHeight + 50

      // 각 섹션의 위치 확인해서 활성 탭 결정
      const sections = [
        { id: 'detail', ref: detailSectionRef },
        { id: 'review', ref: reviewSectionRef },
        { id: 'info', ref: infoSectionRef },
      ]

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section.ref.current) {
          const sectionTop = section.ref.current.offsetTop
          if (scrollPosition >= sectionTop) {
            setActiveTab(section.id)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 탭 클릭 시 해당 섹션으로 스크롤 이동
  const scrollToSection = (sectionId: string) => {
    const sectionRefs: Record<string, React.RefObject<HTMLDivElement>> = {
      detail: detailSectionRef,
      review: reviewSectionRef,
      info: infoSectionRef,
    }

    const targetRef = sectionRefs[sectionId]
    if (targetRef?.current) {
      // StoreLayout 헤더 높이 (유틸리티 바 32px 포함): 모바일 96px, md 112px, lg 132px
      const windowWidth = window.innerWidth
      let storeHeaderHeight = 96 // 64 + 32 (유틸리티 바)
      if (windowWidth >= 1024) {
        storeHeaderHeight = 132 // 100 + 32
      } else if (windowWidth >= 768) {
        storeHeaderHeight = 112 // 80 + 32
      }
      const tabsHeight = 56 // 탭 높이
      const headerOffset = storeHeaderHeight + tabsHeight + 16 // 여유 공간
      const elementPosition = targetRef.current.offsetTop
      const offsetPosition = elementPosition - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  // 이미지 전환 시 썸네일 스크롤
  useEffect(() => {
    if (thumbnailContainerRef.current && product?.images) {
      const container = thumbnailContainerRef.current
      const thumbnailWidth = 80 + 8 // 썸네일 너비 + gap
      const scrollPosition = selectedImage * thumbnailWidth - (container.clientWidth / 2) + (thumbnailWidth / 2)
      container.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth'
      })
    }
  }, [selectedImage, product?.images])

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

      // 합배송 상품인 경우 묶음 단위로 분리
      const bundleMaxQty = product.bundleMaxQty || (activeBundleOptions?.length || 0)
      const hasBundleOptionsForCart = activeBundleOptions && activeBundleOptions.length > 0 && bundleMaxQty > 1

      if (hasBundleOptionsForCart && quantity > 0) {
        // 묶음 단위로 분리해서 장바구니에 추가
        const fullBundles = Math.floor(quantity / bundleMaxQty)
        const remainder = quantity % bundleMaxQty
        const cartItems: { quantity: number }[] = []

        // 풀번들 추가
        for (let i = 0; i < fullBundles; i++) {
          cartItems.push({ quantity: bundleMaxQty })
        }

        // 나머지 수량 추가
        if (remainder > 0) {
          cartItems.push({ quantity: remainder })
        }

        // 각 묶음을 개별 장바구니 아이템으로 추가
        let totalAdded = 0
        for (const item of cartItems) {
          const cartData = {
            sessionId,
            publishedProductId: product.publishedProductId,
            variantId: selectedVariant.id,
            quantity: item.quantity,
            isBundleItem: true // 묶음 상품 표시
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
            totalAdded += item.quantity
          }
        }

        if (totalAdded > 0) {
          dispatchCartUpdate()
          showNotification({
            title: product.title,
            image: product.images?.[0] || '/images/placeholder.png',
            quantity: totalAdded,
            isExisting: false
          })
        }
      } else {
        // 일반 상품: 기존 로직
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
          dispatchCartUpdate()
          showNotification({
            title: product.title,
            image: product.images?.[0] || '/images/placeholder.png',
            quantity: quantity,
            isExisting: data.isExisting
          })
        }
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

  // 선택된 variant 가격으로 bundleOptions 동적 계산
  const calculatedBundleOptions = (() => {
    if (!product || !selectedVariant) return null

    const bundleMaxQty = product.bundleMaxQty || 1
    const shippingFee = product.shippingFee || 0
    const bundleUnit = selectedVariant.bundleUnit || 1

    // 합배송 조건: bundleMaxQty > 1 && shippingFee > 0
    if (bundleMaxQty <= 1 || shippingFee <= 0) return null

    // 합배송 타입으로 할인형 vs 배송비형 구분
    // INCLUDED: 배송비 포함형 (할인) - 소매가에 배송비 포함, 합배송 시 할인
    // SEPARATE: 배송비 별도형 (절약) - 소매가 + 배송비, 합배송 시 배송비 절약
    const isBundleDiscount = product.bundleShippingType === 'INCLUDED'

    // 선택된 variant의 원가
    const basePrice = selectedVariant.price || 0
    // 배송비형: 원가 = 상품가 - 배송비 (배송비가 별도)
    // 할인형: 원가 = 상품가 (배송비가 이미 포함)
    const originalPrice = isBundleDiscount
      ? basePrice
      : (selectedVariant.originalPrice || (basePrice - shippingFee) || 0)

    // 합배송 표시용 최대 수량 (1묶음 완성까지)
    // 예: 2박스 옵션(bundleUnit=2), bundleMaxQty=4 → 최대 2개까지만 표시
    const maxDisplayQty = Math.floor(bundleMaxQty / bundleUnit) || 1

    const options = []
    for (let qty = 1; qty <= maxDisplayQty; qty++) {
      const totalBundleUnits = qty * bundleUnit // 실제 박스 수
      const shippingCount = Math.ceil(totalBundleUnits / bundleMaxQty) // 배송/할인 횟수

      let totalPrice: number
      let discount: number

      if (isBundleDiscount) {
        // 할인형: 첫 번째 수량은 배송비 포함, 2번째 수량부터 할인
        // 할인 개수 = 수량 - 배송 횟수 (첫 번째 수량 제외)
        const discountCount = Math.max(0, qty - shippingCount)
        totalPrice = (originalPrice * qty) - (shippingFee * discountCount)
        discount = shippingFee * discountCount // 할인 금액
      } else {
        // 배송비형: 합배송 시 배송비는 횟수만큼
        // 총액 = (원가 * 수량) + (배송비 * 횟수)
        totalPrice = (originalPrice * qty) + (shippingFee * shippingCount)
        const fullPrice = basePrice * qty // 배송비를 매번 내는 경우의 가격
        discount = fullPrice - totalPrice // 절약 금액
      }

      // 라벨: bundleUnit > 1이면 박스 수도 표시
      const isComplete = totalBundleUnits === bundleMaxQty
      let label: string
      if (bundleUnit > 1) {
        label = isComplete
          ? `${qty}개 (${totalBundleUnits}박스) - 최대할인`
          : `${qty}개 (${totalBundleUnits}박스)`
      } else {
        label = isComplete
          ? `${qty}개 묶음 - 최대할인`
          : (qty === 1 ? '1개' : `${qty}개 묶음`)
      }

      options.push({
        qty,
        totalPrice,
        discount,
        unitPrice: Math.round(totalPrice / qty),
        label,
        isBundleDiscount,
        bundleUnit,
        totalBundleUnits,
      })
    }
    return options
  })()

  // 실제 사용할 bundleOptions (동적 계산 우선, 없으면 API에서 받은 것 사용)
  const activeBundleOptions = calculatedBundleOptions || product?.bundleOptions || null
  const hasBundleOptions = activeBundleOptions && activeBundleOptions.length > 0

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
            <div className="relative w-full h-[430px] bg-white rounded-lg overflow-hidden border border-gray-200 group">
              {/* 이미지 컨테이너 (애니메이션) */}
              <div className="relative w-full h-full">
                {product.images.map((image: string, index: number) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                      selectedImage === index
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-105'
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`${product.title} - ${index + 1}`}
                      fill
                      sizes="430px"
                      className="object-cover"
                      priority={index === 0}
                    />
                  </div>
                ))}
              </div>

              {/* 이전/다음 버튼 */}
              {product.images.length > 1 && (
                <>
                  {/* 이전 버튼 */}
                  <button
                    onClick={() => setSelectedImage(prev => prev === 0 ? product.images.length - 1 : prev - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 z-10"
                    aria-label="이전 이미지"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-700" />
                  </button>

                  {/* 다음 버튼 */}
                  <button
                    onClick={() => setSelectedImage(prev => prev === product.images.length - 1 ? 0 : prev + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 z-10"
                    aria-label="다음 이미지"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-700" />
                  </button>

                  {/* 이미지 인디케이터 (하단 점) */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    {product.images.map((_: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          selectedImage === index
                            ? 'bg-[#FF6B6B] w-6'
                            : 'bg-white/70 hover:bg-white'
                        }`}
                        aria-label={`이미지 ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* 이미지 카운터 */}
              {product.images.length > 1 && (
                <div className="absolute top-3 right-3 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full z-10">
                  {selectedImage + 1} / {product.images.length}
                </div>
              )}
            </div>

            {/* 썸네일 이미지 - 가로 스크롤 */}
            <div
              ref={thumbnailContainerRef}
              className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
              style={{ scrollbarWidth: 'thin' }}
            >
              {product.images.map((image: string, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    selectedImage === index
                      ? 'border-[#FF6B6B] ring-2 ring-[#FF6B6B]/30 scale-105'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Image src={image} alt="" fill sizes="80px" className="object-cover" />
                  {/* 선택된 썸네일 오버레이 */}
                  {selectedImage === index && (
                    <div className="absolute inset-0 bg-[#FF6B6B]/10" />
                  )}
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
              <h1 className="text-2xl font-bold text-gray-900 leading-snug">{product.title}</h1>
            </div>


            {/* Option & Quantity Selection */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              {/* Variant 선택 */}
              {product.variants && product.variants.length > 1 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-gray-800">옵션 선택</label>
                    <div className="text-right">
                      <span className="text-xl font-bold text-[#FF6B6B]">{formatPrice(currentPrice)}</span>
                      <span className="text-sm text-gray-500 ml-0.5">원</span>
                    </div>
                  </div>

                  {/* 옵션 버튼 그리드 (5개 이하일 때) */}
                  {product.variants.length <= 5 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {product.variants.map((variant: any) => (
                        <button
                          key={variant.id}
                          onClick={() => {
                            setSelectedVariant(variant)
                            setQuantity(1)
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                            selectedVariant?.id === variant.id
                              ? 'border-[#FF6B6B] bg-[#FFF5F5]'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedVariant?.id === variant.id
                                ? 'border-[#FF6B6B]'
                                : 'border-gray-300'
                            }`}>
                              {selectedVariant?.id === variant.id && (
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B]" />
                              )}
                            </div>
                            <span className={`font-medium ${
                              selectedVariant?.id === variant.id ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {variant.optionSummary}
                            </span>
                          </div>
                          <span className={`font-bold ${
                            selectedVariant?.id === variant.id ? 'text-[#FF6B6B]' : 'text-gray-900'
                          }`}>
                            {formatPrice(variant.price)}원
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* 드롭다운 (6개 이상일 때) */
                    <div className="relative">
                      <select
                        value={selectedVariant?.id || ''}
                        onChange={(e) => {
                          const variant = product.variants.find((v: any) => v.id === parseInt(e.target.value))
                          setSelectedVariant(variant)
                          setQuantity(1)
                        }}
                        className="w-full appearance-none border-2 border-gray-200 rounded-xl px-4 py-3.5 pr-10 text-gray-900 bg-white hover:border-gray-300 focus:border-[#FF6B6B] focus:ring-2 focus:ring-[#FF6B6B]/20 outline-none transition-all cursor-pointer font-medium"
                      >
                        {product.variants.map((variant: any) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.optionSummary} - {formatPrice(variant.price)}원
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  )}
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

              {/* 합배송 할인 안내 */}
              {hasBundleOptions && (() => {
                const bundleMaxQty = product.bundleMaxQty || activeBundleOptions.length
                const isUnlimited = bundleMaxQty >= 999
                const shippingFee = product.shippingFee || 0
                const maxDiscount = activeBundleOptions[activeBundleOptions.length - 1]?.discount || 0

                return (
                  <div className="bg-[#FFF5F5] rounded-lg px-3 py-2.5">
                    <p className="text-sm text-[#FF6B6B] font-medium">
                      {isUnlimited
                        ? `2개 이상 묶음 구매 할인, 개당 ${formatPrice(shippingFee)}원 할인`
                        : `${bundleMaxQty}개 묶음 구매 할인`
                      }
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isUnlimited
                        ? `수량 제한 없이 개당 ${formatPrice(shippingFee)}원씩 할인`
                        : `묶음 당 최대 ${formatPrice(maxDiscount)}원 할인`
                      }
                    </p>
                  </div>
                )
              })()}

              {/* 수량 선택 - 통일된 레이아웃 */}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">수량</label>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* 수량 조절 버튼 */}
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
                </div>
              </div>
            </div>

            {/* Price Summary */}
            <div className="bg-gradient-to-r from-[#FFF5F5] to-[#FFF0F0] rounded-xl p-5">
              {activeBundleOptions && activeBundleOptions.length > 0 ? (
                // 합배송 가격 표시 (bundleUnit 고려해서 계산)
                (() => {
                  const bundleMaxQty = product.bundleMaxQty || activeBundleOptions.length
                  const bundleUnit = selectedVariant?.bundleUnit || 1
                  const isBundleDiscount = activeBundleOptions[0]?.isBundleDiscount || false
                  const shippingFee = product.shippingFee || 0
                  const basePrice = selectedVariant?.price || 0

                  // bundleUnit을 고려한 총 박스 수 계산
                  const totalBundleUnits = quantity * bundleUnit
                  const fullBundles = Math.floor(totalBundleUnits / bundleMaxQty)
                  const remainder = totalBundleUnits % bundleMaxQty

                  // 배송비/할인 횟수 (ceil)
                  const shippingCount = fullBundles + (remainder > 0 ? 1 : 0)

                  // 총 가격 계산
                  let totalPrice: number
                  let totalSavings: number

                  if (isBundleDiscount) {
                    // 할인형: 첫 번째 수량은 배송비 포함, 2번째 수량부터 할인
                    // 할인 개수 = 수량 - 배송 횟수 (첫 번째 수량 제외)
                    const discountCount = Math.max(0, quantity - shippingCount)
                    totalPrice = (basePrice * quantity) - (shippingFee * discountCount)
                    totalSavings = shippingFee * discountCount
                  } else {
                    // 배송비형: (원가 × 수량) + (배송비 × 횟수)
                    const originalPrice = basePrice - shippingFee
                    totalPrice = (originalPrice * quantity) + (shippingFee * shippingCount)
                    // 절약액 = (매번 배송비 낼 경우) - (실제 배송비)
                    totalSavings = (shippingFee * quantity) - (shippingFee * shippingCount)
                  }

                  // 박스 수 표시 텍스트
                  const bundleText = bundleUnit > 1
                    ? `${quantity}개 (${totalBundleUnits}박스)`
                    : `${quantity}개`

                  return (
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">
                          {bundleText}
                          {totalBundleUnits >= bundleMaxQty && (
                            <span className="text-[#FF6B6B] ml-1">
                              ({Math.floor(totalBundleUnits / bundleMaxQty)}묶음 완성!)
                            </span>
                          )}
                        </p>
                        <p className="text-sm font-medium text-gray-600">총 상품금액</p>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-bold text-[#FF6B6B]">
                          {formatPrice(totalPrice)}
                        </span>
                        <span className="text-lg text-[#FF6B6B] ml-1">원</span>
                        {totalSavings > 0 && (
                          <p className="text-sm text-green-600 font-medium mt-1">
                            {formatPrice(totalSavings)}원 할인!
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

        {/* Sticky Tabs - StoreLayout 헤더 아래에 고정 */}
        <div
          ref={tabsRef}
          className="mt-8 bg-white sticky top-24 md:top-28 lg:top-[132px] z-40 shadow-sm"
        >
          <div className="flex border-b max-w-[1050px] mx-auto">
            <button
              onClick={() => scrollToSection('detail')}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'detail'
                  ? 'text-[#FF6B6B] border-b-2 border-[#FF6B6B]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              상품설명
            </button>
            <button
              onClick={() => scrollToSection('review')}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'review'
                  ? 'text-[#FF6B6B] border-b-2 border-[#FF6B6B]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              리뷰 {reviewStats && reviewStats.totalCount > 0 && `(${reviewStats.totalCount})`}
            </button>
            <button
              onClick={() => scrollToSection('info')}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'info'
                  ? 'text-[#FF6B6B] border-b-2 border-[#FF6B6B]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              문의
            </button>
          </div>
        </div>

        {/* 상품설명 섹션 */}
        <div ref={detailSectionRef} className="bg-white rounded-lg mt-4 p-4">
          <div id="section-detail" className="space-y-6">
            {/* 상품 설명 */}
            {product.description && (
              <div className="rounded-2xl overflow-hidden p-5">
                    <h2 className="text-[32px] font-bold text-[#121212] mb-4">{product.title}</h2>
                    <div className="text-[#121212] text-[16px] leading-7">
                          {(() => {
                            const lines = product.description.split('\n')
                            let currentListType: 'number' | 'bullet' | null = null
                            let listItems: { key: number; content: string; num?: string }[] = []
                            const elements: React.ReactNode[] = []

                            const flushList = () => {
                              if (listItems.length > 0) {
                                if (currentListType === 'number') {
                                  elements.push(
                                    <ol key={`list-${elements.length}`} className="my-4 space-y-3">
                                      {listItems.map((item) => (
                                        <li key={item.key} className="flex items-start gap-3">
                                          <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                                            {item.num}
                                          </span>
                                          <span className="flex-1 pt-0.5 font-medium text-[#121212]">{item.content}</span>
                                        </li>
                                      ))}
                                    </ol>
                                  )
                                } else {
                                  elements.push(
                                    <ul key={`list-${elements.length}`} className="my-3 space-y-2 bg-[#f6f6f6] rounded-xl p-4">
                                      {listItems.map((item) => (
                                        <li key={item.key} className="flex items-start gap-2">
                                          <span className="flex-shrink-0 w-1.5 h-1.5 bg-green-500 rounded-full mt-2.5"></span>
                                          <span className="flex-1 text-[#121212]">{item.content}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )
                                }
                                listItems = []
                                currentListType = null
                              }
                            }

                            lines.forEach((line: string, idx: number) => {
                              const trimmed = line.trim()

                              // 숫자 목록 (1. 2. 3. 등)
                              const numberMatch = trimmed.match(/^([0-9]+)\.\s*(.+)/)
                              if (numberMatch) {
                                if (currentListType !== 'number') {
                                  flushList()
                                  currentListType = 'number'
                                }
                                listItems.push({ key: idx, num: numberMatch[1], content: numberMatch[2] })
                                return
                              }

                              // 글머리 기호 (•, -, *, ✓, ✔, >, ·)
                              const bulletMatch = trimmed.match(/^[•\-\*✓✔\>·]\s*(.+)/)
                              if (bulletMatch) {
                                if (currentListType !== 'bullet') {
                                  flushList()
                                  currentListType = 'bullet'
                                }
                                listItems.push({ key: idx, content: bulletMatch[1] })
                                return
                              }

                              // 목록이 아닌 경우 기존 목록 출력
                              flushList()

                              // 빈 줄
                              if (!trimmed) {
                                elements.push(<div key={idx} className="h-4" />)
                                return
                              }

                              // 강조 표현 (【】, 「」, ※, ★, ☆, ■, □, ▶, ▷)
                              if (/^[【「※★☆■□▶▷]/.test(trimmed)) {
                                elements.push(
                                  <div key={idx} className="my-3 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                                    <p className="font-bold text-amber-800">{trimmed}</p>
                                  </div>
                                )
                                return
                              }

                              // 대괄호로 감싸진 제목 [제목]
                              const bracketMatch = trimmed.match(/^\[(.+)\]$/)
                              if (bracketMatch) {
                                elements.push(
                                  <div key={idx} className="mt-5 mb-3">
                                    <span className="inline-block bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm font-bold">
                                      {bracketMatch[1]}
                                    </span>
                                  </div>
                                )
                                return
                              }

                              // 이모지로 시작하는 줄 (강조)
                              if (/^[\u{1F300}-\u{1F9FF}]/u.test(trimmed)) {
                                elements.push(
                                  <p key={idx} className="my-2 font-medium text-[#121212] text-base">
                                    {trimmed}
                                  </p>
                                )
                                return
                              }

                              // 일반 텍스트
                              elements.push(
                                <p key={idx} className="mb-2 text-[#121212]">
                                  {trimmed}
                                </p>
                              )
                            })

                            // 마지막 목록 출력
                            flushList()

                            return elements
                          })()}
                    </div>
                  </div>
                )}

            {/* 상세 이미지 */}
            {product.detailImages && product.detailImages.length > 0 && (
              <div className="space-y-4">
                {product.detailImages.map((image: string, index: number) => (
                  <div key={index} className="relative w-[80%] mx-auto rounded-xl overflow-hidden shadow-sm">
                    <Image src={image} alt="" width={640} height={640} sizes="80vw" className="w-full h-auto" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 리뷰 섹션 */}
        <div ref={reviewSectionRef} className="bg-white rounded-lg mt-4 p-4">
          <div id="section-review" className="space-y-6">
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
        </div>

        {/* 문의 섹션 */}
        <div ref={infoSectionRef} className="bg-white rounded-lg mt-4 p-4 mb-8">
          <div id="section-info" className="space-y-4 text-sm text-gray-700">
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

      {/* TOP 버튼 */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-24 lg:bottom-8 right-4 lg:right-8 w-12 h-12 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all z-50 group"
        aria-label="맨 위로 이동"
      >
        <svg
          className="w-5 h-5 text-gray-600 group-hover:text-[#FF6B6B] transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </div>
  )
}
