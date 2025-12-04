'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ShoppingCart, Sparkles, Package } from 'lucide-react'
import { useCartNotification } from '@/contexts/CartNotificationContext'
import { useChannel } from '@/contexts/ChannelContext'

interface Product {
  id: string
  publishedProductId?: string
  title: string
  description?: string
  originalPrice: number
  salePrice: number
  discount: number
  images: string[]
  category: string
  rating?: number
  reviews?: number
  stock?: number
  isTimeSale?: boolean
  isBest?: boolean
  isNew?: boolean
}

export default function StorePage() {
  const { showNotification } = useCartNotification()
  const { channel } = useChannel()
  const [channelProducts, setChannelProducts] = useState<Product[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const cardsPerView = 4
  const totalSlides = Math.max(1, Math.ceil(featuredProducts.length / cardsPerView))

  useEffect(() => {
    loadChannelProducts()
  }, [channel?.id])

  // 자동 슬라이드 (3초마다)
  useEffect(() => {
    if (featuredProducts.length === 0) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides)
    }, 3000)
    return () => clearInterval(timer)
  }, [featuredProducts.length, totalSlides])

  const loadChannelProducts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/shop/sections?limit=50')
      const data = await response.json()

      if (data.success) {
        // 채널 상품 설정
        const products = data.channelProducts || []
        setChannelProducts(products)

        // 이미지가 있는 상품을 추천 상품으로 사용 (최대 12개)
        const productsWithImages = products.filter((p: Product) => p.images && p.images.length > 0).slice(0, 12)
        setFeaturedProducts(productsWithImages.length > 0 ? productsWithImages : products.slice(0, 12))
      }
    } catch (error) {
      console.error('Failed to load channel products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatPrice = (price: number) => price.toLocaleString()
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % totalSlides)
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides)

  const handleAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!product.publishedProductId) {
      return
    }

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishedProductId: product.publishedProductId,
          quantity: 1,
        }),
      })

      const data = await response.json()
      if (data.success) {
        // 알림 버블 표시
        showNotification({
          title: product.title,
          image: product.images?.[0] || '/images/placeholder.png',
          quantity: 1,
          isExisting: data.isExisting,
        })
      }
    } catch (error) {
      console.error('장바구니 추가 오류:', error)
    }
  }

  // 채널 테마 정보
  const bannerUrl = channel?.theme?.bannerUrl
  const channelName = channel?.displayName || channel?.name
  const primaryColor = channel?.theme?.primaryColor || '#FF6B6B'

  return (
    <div className="bg-white min-h-screen">
      {/* 채널 배너 섹션 */}
      {bannerUrl && (
        <section className="w-full">
          <div className="relative w-full aspect-[4/1] md:aspect-[5/1] lg:aspect-[6/1] overflow-hidden">
            <img
              src={bannerUrl}
              alt={`${channelName || '쇼핑몰'} 배너`}
              className="w-full h-full object-cover"
            />
          </div>
        </section>
      )}

      {/* Featured Products Carousel - 추천 상품 캐러셀 */}
      {featuredProducts.length > 0 && (
        <section className="py-6 md:py-10 bg-gradient-to-b from-amber-50 via-orange-50/50 to-white">
          <div className="kurly-container">
            <div className="flex items-center justify-center gap-2 mb-4 md:mb-6">
              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">추천 상품</h2>
              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
            </div>
            <div className="relative">
              {/* Left Arrow */}
              <button
                onClick={prevSlide}
                className="absolute -left-2 md:left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 md:w-10 md:h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
              </button>

              {/* Carousel Container */}
              <div className="overflow-hidden mx-8 md:mx-12">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {Array.from({ length: totalSlides }).map((_, slideIndex) => (
                    <div key={slideIndex} className="w-full flex-shrink-0 flex gap-2 md:gap-4 px-1 md:px-2">
                      {featuredProducts
                        .slice(slideIndex * cardsPerView, (slideIndex + 1) * cardsPerView)
                        .map((product, productIndex) => (
                          <div key={`${slideIndex}-${productIndex}-${product.id}`} className="w-[140px] sm:w-[160px] md:w-[180px] lg:w-[220px] flex-shrink-0">
                            <Link href={`/product/${product.id}`} className="block group">
                              <div className="relative aspect-[220/280] rounded-lg overflow-hidden bg-gray-100">
                                <img
                                  src={product.images[0] || '/placeholder.jpg'}
                                  alt={product.title}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                                <button
                                  onClick={(e) => handleAddToCart(product, e)}
                                  className="absolute bottom-2 right-2 w-7 h-7 md:w-9 md:h-9 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
                                  title="장바구니 담기"
                                >
                                  <ShoppingCart className="w-3 h-3 md:w-4 md:h-4 text-gray-700" />
                                </button>
                                {product.discount > 0 && (
                                  <span className="absolute top-2 left-2 px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs font-bold text-white rounded bg-amber-500">
                                    {product.discount}%
                                  </span>
                                )}
                              </div>
                              <div className="mt-2">
                                <h4 className="text-xs md:text-sm font-medium text-gray-900 line-clamp-2 min-h-[32px] md:min-h-[40px]">
                                  {product.title}
                                </h4>
                                <div className="flex items-center gap-1 md:gap-2 mt-1">
                                  {product.discount > 0 && (
                                    <span className="text-xs md:text-sm font-bold text-amber-600">
                                      {product.discount}%
                                    </span>
                                  )}
                                  <span className="text-xs md:text-sm font-bold text-gray-900">
                                    {formatPrice(product.salePrice)}원
                                  </span>
                                </div>
                                {product.originalPrice > product.salePrice && (
                                  <p className="text-[10px] md:text-xs text-gray-400 line-through">
                                    {formatPrice(product.originalPrice)}원
                                  </p>
                                )}
                              </div>
                            </Link>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Arrow */}
              <button
                onClick={nextSlide}
                className="absolute -right-2 md:right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 md:w-10 md:h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
              </button>

              {/* Slide Indicators */}
              <div className="flex justify-center gap-1.5 md:gap-2 mt-3 md:mt-4">
                {Array.from({ length: totalSlides }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-colors ${
                      currentSlide === index ? 'bg-amber-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 채널 상품 그리드 */}
      <section className="py-8 md:py-12 bg-white">
        <div className="kurly-container">
          {/* 섹션 헤더 */}
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 md:w-6 md:h-6 text-rose-500" />
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">전체 상품</h2>
              {channelProducts.length > 0 && (
                <span className="text-sm text-gray-500">({channelProducts.length}개)</span>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2 border-rose-500"></div>
            </div>
          ) : channelProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {channelProducts.map((product) => (
                <Link
                  key={`product-${product.publishedProductId || product.id}`}
                  href={`/product/${product.id}`}
                  className="group block"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 hover:border-rose-400 transition-all hover:shadow-lg">
                    <img
                      src={product.images[0] || '/placeholder.jpg'}
                      alt={product.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <button
                      onClick={(e) => handleAddToCart(product, e)}
                      className="absolute bottom-2 right-2 w-8 h-8 md:w-9 md:h-9 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
                      title="장바구니 담기"
                    >
                      <ShoppingCart className="w-4 h-4 text-gray-700" />
                    </button>
                    {product.discount > 0 && (
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] md:text-xs font-bold text-white rounded bg-rose-500">
                        {product.discount}%
                      </span>
                    )}
                    {product.isNew && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] md:text-xs font-bold text-white rounded bg-blue-500">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="mt-2 md:mt-3">
                    <h4 className="text-xs md:text-sm font-medium text-gray-900 line-clamp-2 min-h-[32px] md:min-h-[40px]">
                      {product.title}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      {product.discount > 0 && (
                        <span className="text-xs md:text-sm font-bold text-rose-500">
                          {product.discount}%
                        </span>
                      )}
                      <span className="text-sm md:text-base font-bold text-gray-900">
                        {formatPrice(product.salePrice)}원
                      </span>
                    </div>
                    {product.originalPrice > product.salePrice && (
                      <p className="text-[10px] md:text-xs text-gray-400 line-through mt-0.5">
                        {formatPrice(product.originalPrice)}원
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Package className="w-12 h-12 md:w-16 md:h-16 mb-4 text-gray-300" />
              <p className="text-sm md:text-base">등록된 상품이 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">관리자에게 문의해주세요</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
