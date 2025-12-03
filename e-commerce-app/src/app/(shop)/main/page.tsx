'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ShoppingCart, Store, ArrowRight, BadgeCheck, Sparkles } from 'lucide-react'
import { useCartNotification } from '@/contexts/CartNotificationContext'

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

interface BandSection {
  id: string | number
  name: string
  coverUrl?: string | null
  formUrl?: string | null
  platform?: string // SHOP, BAND 등
  products: Product[]
}

export default function StorePage() {
  const { showNotification } = useCartNotification()
  const [retailSections, setRetailSections] = useState<BandSection[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const cardsPerView = 4
  const totalSlides = Math.max(1, Math.ceil(featuredProducts.length / cardsPerView))

  useEffect(() => {
    loadBandSections()
  }, [])

  // 자동 슬라이드 (3초마다)
  useEffect(() => {
    if (featuredProducts.length === 0) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides)
    }, 3000)
    return () => clearInterval(timer)
  }, [featuredProducts.length, totalSlides])

  const loadBandSections = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/shop/sections?limit=8')
      const data = await response.json()

      if (data.success) {
        setRetailSections(data.retailSections || [])
        // 모든 밴드 섹션의 상품을 모아서 추천 상품으로 사용
        const allProducts = (data.retailSections || []).flatMap((section: BandSection) => section.products)
        const productsWithImages = allProducts.filter((p: Product) => p.images && p.images.length > 0).slice(0, 12)
        setFeaturedProducts(productsWithImages.length > 0 ? productsWithImages : allProducts.slice(0, 12))
      }
    } catch (error) {
      console.error('Failed to load band sections:', error)
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

  return (
    <div className="bg-white min-h-screen">
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
                        .map((product) => (
                          <div key={product.id} className="w-[140px] sm:w-[160px] md:w-[180px] lg:w-[220px] flex-shrink-0">
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

      {/* Retail Band Sections - 소매밴드별 상품 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2 border-rose-500"></div>
        </div>
      ) : retailSections.length > 0 ? (
        <section className="py-8 md:py-12 bg-gradient-to-b from-rose-50/50 via-pink-50/30 to-white">
          <div className="kurly-container">
            {/* 섹션 헤더 */}
            <div className="flex items-center justify-center gap-2 mb-6 md:mb-8">
              <Store className="w-5 h-5 md:w-6 md:h-6 text-rose-500" />
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">판매 채널</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {retailSections.map((section) => (
                <BandProductSection
                  key={section.id}
                  band={section}
                  products={section.products}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Store className="w-10 h-10 md:w-12 md:h-12 mb-4 text-gray-300" />
          <p className="text-sm md:text-base">등록된 판매처가 없습니다</p>
        </div>
      )}

      {/* 자사몰 전체 상품 섹션 */}
      {!isLoading && (() => {
        const ownShopSection = retailSections.find(s => s.platform === 'SHOP')
        if (!ownShopSection || ownShopSection.products.length === 0) return null

        return (
          <section className="py-8 md:py-12 bg-gradient-to-b from-blue-50 to-white">
            <div className="kurly-container">
              {/* 섹션 헤더 */}
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
                    <BadgeCheck className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl md:text-2xl font-bold text-gray-900">{ownShopSection.name}</h2>
                      <span className="px-2 py-0.5 text-[10px] md:text-xs font-bold bg-yellow-400 text-yellow-900 rounded-full">
                        공식
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-gray-500 mt-0.5">자사 공식 상품을 만나보세요</p>
                  </div>
                </div>
                <Link
                  href={`/band/${ownShopSection.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs md:text-sm font-medium rounded-full hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md"
                >
                  <span>전체보기</span>
                  <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Link>
              </div>

              {/* 상품 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                {ownShopSection.products.map((product) => (
                  <Link
                    key={`own-${product.publishedProductId || product.id}`}
                    href={`/product/${product.id}?bandId=${ownShopSection.id}`}
                    className="group block"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border-2 border-transparent hover:border-blue-400 transition-all">
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
                      {/* 공식 배지 */}
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-full">
                        <BadgeCheck className="w-3 h-3" />
                        <span className="text-[9px] font-medium">공식</span>
                      </div>
                      {product.discount > 0 && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] md:text-xs font-bold text-white rounded bg-red-500">
                          {product.discount}%
                        </span>
                      )}
                    </div>
                    <div className="mt-2 md:mt-3">
                      <h4 className="text-xs md:text-sm font-medium text-gray-900 line-clamp-2 min-h-[32px] md:min-h-[40px]">
                        {product.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        {product.discount > 0 && (
                          <span className="text-xs md:text-sm font-bold text-red-500">
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
            </div>
          </section>
        )
      })()}
    </div>
  )
}

// Band Product Section Component - 밴드별 상품 섹션 (캐러셀)
function BandProductSection({
  band,
  products,
  onAddToCart,
}: {
  band: BandSection
  products: Product[]
  onAddToCart: (product: Product, e: React.MouseEvent) => void
}) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const displayProducts = products.slice(0, 5) // 5개만 표시
  const totalSlides = displayProducts.length
  const isOwnShop = band.platform === 'SHOP' // 자사 제품 여부

  // 자동 슬라이드 (4초마다)
  useEffect(() => {
    if (totalSlides <= 1) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides)
    }, 4000)
    return () => clearInterval(timer)
  }, [totalSlides])

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % totalSlides)
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides)

  const formatPrice = (price: number) => price.toLocaleString()
  const accentColor = isOwnShop ? '#5B7FFF' : '#F43F5E' // 자사 제품은 파란색, 일반 채널은 로즈 테마

  if (displayProducts.length === 0) return null

  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden flex flex-col ${
      isOwnShop
        ? 'border-2 border-blue-400 ring-2 ring-blue-100'
        : 'border border-gray-100'
    }`}>
      {/* Band Header */}
      <div
        className={`relative h-20 md:h-24 overflow-hidden ${
          isOwnShop
            ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500'
            : 'bg-gradient-to-r'
        }`}
        style={{
          backgroundImage: !isOwnShop && band.coverUrl ? `url(${band.coverUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: !isOwnShop && !band.coverUrl ? '#FFF1F2' : undefined
        }}
      >
        {!isOwnShop && <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />}
        {isOwnShop && (
          <>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTAtMThjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTE4IDBjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            <Sparkles className="absolute top-2 right-2 w-5 h-5 text-yellow-300 animate-pulse" />
          </>
        )}
        <div className="relative h-full flex items-center justify-between px-3 md:px-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div
              className={`w-10 h-10 md:w-12 md:h-12 rounded-full shadow-lg flex items-center justify-center ${
                isOwnShop
                  ? 'bg-white border-2 border-yellow-400'
                  : 'bg-white'
              }`}
              style={{ borderColor: isOwnShop ? undefined : accentColor, borderWidth: isOwnShop ? undefined : '2px' }}
            >
              {isOwnShop ? (
                <BadgeCheck className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
              ) : (
                <Store className="w-5 h-5 md:w-6 md:h-6" style={{ color: accentColor }} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base md:text-lg font-bold text-white">{band.name}</h3>
                {isOwnShop && (
                  <span className="px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold bg-yellow-400 text-yellow-900 rounded-full">
                    공식
                  </span>
                )}
              </div>
              <p className="text-[10px] md:text-xs text-white/80">
                {isOwnShop ? '자사 공식 상품' : `${products.length}개 상품`}
              </p>
            </div>
          </div>
          {isOwnShop && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full">
              <BadgeCheck className="w-3 h-3 text-yellow-300" />
            </div>
          )}
        </div>
      </div>

      {/* Products Carousel */}
      <div className="p-2 md:p-3 flex-1">
        <div className="relative">
          {/* Left Arrow */}
          {totalSlides > 1 && (
            <button
              onClick={prevSlide}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 md:w-8 md:h-8 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
            >
              <ChevronLeft className="w-3 h-3 md:w-4 md:h-4 text-gray-700" />
            </button>
          )}

          {/* Carousel Container */}
          <div className="overflow-hidden mx-6 md:mx-8">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {displayProducts.map((product) => (
                <div key={product.id} className="w-full flex-shrink-0 px-1">
                  <Link href={`/product/${product.id}?bandId=${band.id}`} className="block group/card">
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={product.images[0] || '/placeholder.jpg'}
                        alt={product.title}
                        className="w-full h-full object-cover transition-transform group-hover/card:scale-105"
                      />
                      <button
                        onClick={(e) => onAddToCart(product, e)}
                        className="absolute bottom-2 right-2 w-7 h-7 md:w-8 md:h-8 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-gray-50"
                        title="장바구니 담기"
                      >
                        <ShoppingCart className="w-3 h-3 md:w-4 md:h-4 text-gray-700" />
                      </button>
                      {product.discount > 0 && (
                        <span
                          className="absolute top-2 left-2 px-1 md:px-1.5 py-0.5 text-[10px] md:text-xs font-bold text-white rounded"
                          style={{ backgroundColor: accentColor }}
                        >
                          {product.discount}%
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 md:mt-2">
                      <h4 className="text-[11px] md:text-xs font-medium text-gray-900 line-clamp-2 min-h-[28px] md:min-h-[32px]">
                        {product.title}
                      </h4>
                      <div className="flex items-center gap-1 mt-0.5 md:mt-1">
                        {product.discount > 0 && (
                          <span className="text-[10px] md:text-xs font-bold" style={{ color: accentColor }}>
                            {product.discount}%
                          </span>
                        )}
                        <span className="text-[10px] md:text-xs font-bold text-gray-900">
                          {formatPrice(product.salePrice)}원
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Right Arrow */}
          {totalSlides > 1 && (
            <button
              onClick={nextSlide}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 md:w-8 md:h-8 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
            >
              <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-gray-700" />
            </button>
          )}

          {/* Slide Indicators */}
          {totalSlides > 1 && (
            <div className="flex justify-center gap-1 md:gap-1.5 mt-2 md:mt-3">
              {displayProducts.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full transition-colors ${
                    currentSlide === index
                      ? isOwnShop ? 'bg-blue-500' : 'bg-rose-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 바로가기 섹션 - 소매밴드 상품 목록 페이지로 이동 */}
      <Link
        href={`/band/${band.id}`}
        className={`flex items-center justify-center gap-1.5 md:gap-2 w-full py-2.5 md:py-3 text-white text-xs md:text-sm font-medium transition-colors ${
          isOwnShop
            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
            : 'bg-rose-500 hover:bg-rose-600'
        }`}
      >
        {isOwnShop && <BadgeCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />}
        <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
        {isOwnShop ? '공식 스토어 바로가기' : '바로가기'}
      </Link>
    </div>
  )
}
