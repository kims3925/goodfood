'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ShoppingCart, Store, ArrowRight } from 'lucide-react'

interface Product {
  id: string
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
  products: Product[]
}

export default function MainPage() {
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

    try {
      let sessionId = localStorage.getItem('sessionId')
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2)
        localStorage.setItem('sessionId', sessionId)
      }

      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          productId: product.id,
          quantity: 1,
        }),
      })

      const data = await response.json()
      if (data.success) {
        alert(`"${product.title}" 상품이 장바구니에 추가되었습니다.`)
      } else {
        alert(`장바구니 추가 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('장바구니 추가 오류:', error)
      alert('장바구니 추가 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Featured Products Carousel - 추천 상품 캐러셀 */}
      {featuredProducts.length > 0 && (
        <section className="py-10 bg-gradient-to-b from-[#FFF5F5] to-white">
          <div className="kurly-container">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">추천 상품</h2>
            <div className="relative">
              {/* Left Arrow */}
              <button
                onClick={prevSlide}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>

              {/* Carousel Container */}
              <div className="overflow-hidden mx-12">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {Array.from({ length: totalSlides }).map((_, slideIndex) => (
                    <div key={slideIndex} className="w-full flex-shrink-0 flex gap-4 px-2">
                      {featuredProducts
                        .slice(slideIndex * cardsPerView, (slideIndex + 1) * cardsPerView)
                        .map((product) => (
                          <div key={product.id} className="w-[220px] flex-shrink-0">
                            <Link href={`/store/product/${product.id}`} className="block group">
                              <div className="relative h-[280px] w-[220px] rounded-lg overflow-hidden bg-gray-100">
                                <img
                                  src={product.images[0] || '/placeholder.jpg'}
                                  alt={product.title}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                                <button
                                  onClick={(e) => handleAddToCart(product, e)}
                                  className="absolute bottom-2 right-2 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
                                  title="장바구니 담기"
                                >
                                  <ShoppingCart className="w-4 h-4 text-gray-700" />
                                </button>
                                {product.discount > 0 && (
                                  <span className="absolute top-2 left-2 px-2 py-1 text-xs font-bold text-white rounded bg-[#FF6B6B]">
                                    {product.discount}%
                                  </span>
                                )}
                              </div>
                              <div className="mt-2">
                                <h4 className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[40px]">
                                  {product.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  {product.discount > 0 && (
                                    <span className="text-sm font-bold text-[#FF6B6B]">
                                      {product.discount}%
                                    </span>
                                  )}
                                  <span className="text-sm font-bold text-gray-900">
                                    {formatPrice(product.salePrice)}원
                                  </span>
                                </div>
                                {product.originalPrice > product.salePrice && (
                                  <p className="text-xs text-gray-400 line-through">
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
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
              >
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>

              {/* Slide Indicators */}
              <div className="flex justify-center gap-2 mt-4">
                {Array.from({ length: totalSlides }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      currentSlide === index ? 'bg-[#FF6B6B]' : 'bg-gray-300'
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B]"></div>
        </div>
      ) : retailSections.length > 0 ? (
        <section className="py-10 bg-white">
          <div className="kurly-container">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <Store className="w-12 h-12 mb-4 text-gray-300" />
          <p>등록된 판매처가 없습니다</p>
        </div>
      )}
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
  const accentColor = '#FF6B6B'

  if (displayProducts.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      {/* Band Header */}
      <div
        className="relative h-24 bg-gradient-to-r overflow-hidden"
        style={{
          backgroundImage: band.coverUrl ? `url(${band.coverUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: band.coverUrl ? undefined : '#FFF0F0'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
        <div className="relative h-full flex items-center px-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center"
              style={{ borderColor: accentColor, borderWidth: '2px' }}
            >
              <Store className="w-6 h-6" style={{ color: accentColor }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{band.name}</h3>
              <p className="text-xs text-white/80">
                {products.length}개 상품
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Carousel */}
      <div className="p-3 flex-1">
        <div className="relative">
          {/* Left Arrow */}
          {totalSlides > 1 && (
            <button
              onClick={prevSlide}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700" />
            </button>
          )}

          {/* Carousel Container */}
          <div className="overflow-hidden mx-8">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {displayProducts.map((product) => (
                <div key={product.id} className="w-full flex-shrink-0 px-1">
                  <Link href={`/store/product/${product.id}?bandId=${band.id}`} className="block group/card">
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={product.images[0] || '/placeholder.jpg'}
                        alt={product.title}
                        className="w-full h-full object-cover transition-transform group-hover/card:scale-105"
                      />
                      <button
                        onClick={(e) => onAddToCart(product, e)}
                        className="absolute bottom-2 right-2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-gray-50"
                        title="장바구니 담기"
                      >
                        <ShoppingCart className="w-4 h-4 text-gray-700" />
                      </button>
                      {product.discount > 0 && (
                        <span
                          className="absolute top-2 left-2 px-1.5 py-0.5 text-xs font-bold text-white rounded"
                          style={{ backgroundColor: accentColor }}
                        >
                          {product.discount}%
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <h4 className="text-xs font-medium text-gray-900 line-clamp-2 min-h-[32px]">
                        {product.title}
                      </h4>
                      <div className="flex items-center gap-1 mt-1">
                        {product.discount > 0 && (
                          <span className="text-xs font-bold" style={{ color: accentColor }}>
                            {product.discount}%
                          </span>
                        )}
                        <span className="text-xs font-bold text-gray-900">
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
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4 text-gray-700" />
            </button>
          )}

          {/* Slide Indicators */}
          {totalSlides > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {displayProducts.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    currentSlide === index ? 'bg-[#FF6B6B]' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 바로가기 섹션 - 소매밴드 상품 목록 페이지로 이동 */}
      <Link
        href={`/store/band/${band.id}`}
        className="flex items-center justify-center gap-2 w-full py-3 bg-[#FF6B6B] text-white text-sm font-medium hover:bg-[#FF5252] transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        바로가기
      </Link>
    </div>
  )
}
