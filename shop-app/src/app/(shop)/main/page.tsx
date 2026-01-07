'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ShoppingCart, Sparkles, Package, Search, X } from 'lucide-react'
import { useCartNotification } from '@/contexts/CartNotificationContext'
import { useShop } from '@/contexts/ShopContext'
import { useShopUrl } from '@/hooks/useShopUrl'

interface Product {
  id: number
  publishedProductId?: number
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
  const { shop } = useShop()
  const { getApiPath, getPath } = useShopUrl()
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get('search') || ''

  const [shopProducts, setShopProducts] = useState<Product[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [cardsPerView, setCardsPerView] = useState(2)

  // 화면 크기에 따라 cardsPerView 조정
  useEffect(() => {
    const updateCardsPerView = () => {
      const width = window.innerWidth
      if (width < 640) {
        setCardsPerView(2)  // 모바일: 2개
      } else if (width < 768) {
        setCardsPerView(3)  // sm: 3개
      } else if (width < 1024) {
        setCardsPerView(4)  // md: 4개
      } else {
        setCardsPerView(4)  // lg 이상: 4개
      }
    }

    updateCardsPerView()
    window.addEventListener('resize', updateCardsPerView)
    return () => window.removeEventListener('resize', updateCardsPerView)
  }, [])

  const totalSlides = Math.max(1, Math.ceil(featuredProducts.length / cardsPerView))

  // cardsPerView 변경 시 currentSlide가 범위를 초과하지 않도록 조정
  useEffect(() => {
    if (currentSlide >= totalSlides) {
      setCurrentSlide(Math.max(0, totalSlides - 1))
    }
  }, [cardsPerView, totalSlides, currentSlide])

  const loadShopProducts = useCallback(async () => {
    try {
      setIsLoading(true)
      // 검색어가 있으면 API에 전달
      const apiUrl = searchQuery
        ? getApiPath(`/api/shop/sections?limit=50&search=${encodeURIComponent(searchQuery)}`)
        : getApiPath('/api/shop/sections?limit=50')
      const response = await fetch(apiUrl)
      const data = await response.json()

      if (data.success) {
        // Shop 상품 설정 (products 우선, channelProducts는 하위 호환)
        const products = data.products || data.channelProducts || []
        setShopProducts(products)

        // 검색 모드가 아닐 때만 추천 상품 설정
        if (!searchQuery) {
          // 이미지가 있는 상품을 추천 상품으로 사용 (최대 12개)
          const productsWithImages = products.filter((p: Product) => p.images && p.images.length > 0).slice(0, 12)
          setFeaturedProducts(productsWithImages.length > 0 ? productsWithImages : products.slice(0, 12))
        } else {
          setFeaturedProducts([]) // 검색 모드에서는 추천 상품 숨김
        }
      }
    } catch (error) {
      console.error('Failed to load shop products:', error)
    } finally {
      setIsLoading(false)
    }
  }, [getApiPath, searchQuery])

  useEffect(() => {
    loadShopProducts()
  }, [shop?.id, loadShopProducts])

  // 자동 슬라이드 (3초마다)
  useEffect(() => {
    if (featuredProducts.length === 0) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides)
    }, 3000)
    return () => clearInterval(timer)
  }, [featuredProducts.length, totalSlides])

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
      const response = await fetch(getApiPath('/api/cart'), {
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

  // Shop 테마 정보
  const bannerUrl = shop?.theme?.bannerUrl
  const shopName = shop?.name
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'

  return (
    <div className="bg-white min-h-screen">
      {/* 채널 배너 섹션 */}
      {bannerUrl && (
        <section className="w-full">
          <div className="relative w-full aspect-[4/1] md:aspect-[5/1] lg:aspect-[6/1] overflow-hidden">
            <Image
              src={bannerUrl}
              alt={`${shopName || '쇼핑몰'} 배너`}
              fill
              sizes="100vw"
              className="object-cover"
              priority
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
                aria-label="이전 슬라이드"
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
                            <Link href={getPath(`/product/${product.id}`)} className="block group">
                              <div className="relative aspect-[220/280] rounded-lg overflow-hidden bg-gray-100">
                                <Image
                                  src={product.images[0] || '/placeholder.jpg'}
                                  alt={product.title}
                                  fill
                                  sizes="(max-width: 640px) 140px, (max-width: 768px) 160px, (max-width: 1024px) 180px, 220px"
                                  className="object-cover transition-transform group-hover:scale-105"
                                />
                                <button
                                  onClick={(e) => handleAddToCart(product, e)}
                                  className="absolute bottom-1 right-1 w-10 h-10 md:w-11 md:h-11 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
                                  aria-label="장바구니 담기"
                                >
                                  <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
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
                                  <p className="text-[10px] md:text-xs text-gray-500 line-through">
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
                aria-label="다음 슬라이드"
                className="absolute -right-2 md:right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 md:w-10 md:h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
              </button>

              {/* Slide Indicators */}
              <div className="flex justify-center gap-1 md:gap-1.5 mt-3 md:mt-4">
                {Array.from({ length: totalSlides }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    aria-label={`슬라이드 ${index + 1}`}
                    className="p-2 -m-1"
                  >
                    <span className={`block w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-colors ${
                      currentSlide === index ? 'bg-amber-500' : 'bg-gray-300'
                    }`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Shop 상품 그리드 */}
      <section className="py-8 md:py-12 bg-white">
        <div className="kurly-container">
          {/* 섹션 헤더 */}
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div className="flex items-center gap-2">
              {searchQuery ? (
                <>
                  <Search className="w-5 h-5 md:w-6 md:h-6 text-rose-500" />
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                    &apos;{searchQuery}&apos; 검색 결과
                  </h2>
                  <span className="text-sm text-gray-500 ml-2">
                    ({shopProducts.length}개)
                  </span>
                </>
              ) : (
                <>
                  <Package className="w-5 h-5 md:w-6 md:h-6 text-rose-500" />
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">전체 상품</h2>
                </>
              )}
            </div>
            {searchQuery && (
              <Link
                href={getPath('/main')}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
                검색 초기화
              </Link>
            )}
          </div>

          {isLoading ? (
            /* 스켈레톤 UI - 실제 상품 그리드와 동일한 레이아웃 */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square rounded-xl bg-gray-200" />
                  <div className="mt-2 md:mt-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : shopProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {shopProducts.map((product, index) => (
                <Link
                  key={`product-${product.publishedProductId || product.id}`}
                  href={getPath(`/product/${product.id}`)}
                  className="group block"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 hover:border-rose-400 transition-all hover:shadow-lg">
                    <Image
                      src={product.images[0] || '/placeholder.jpg'}
                      alt={product.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      className="object-cover transition-transform group-hover:scale-105"
                      priority={index < 4}
                    />
                    <button
                      onClick={(e) => handleAddToCart(product, e)}
                      className="absolute bottom-1 right-1 w-10 h-10 md:w-11 md:h-11 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
                      aria-label="장바구니 담기"
                    >
                      <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
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
                      <p className="text-[10px] md:text-xs text-gray-500 line-through mt-0.5">
                        {formatPrice(product.originalPrice)}원
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              {searchQuery ? (
                <>
                  <Search className="w-12 h-12 md:w-16 md:h-16 mb-4 text-gray-300" />
                  <p className="text-sm md:text-base">&apos;{searchQuery}&apos;에 대한 검색 결과가 없습니다</p>
                  <p className="text-xs text-gray-500 mt-1">다른 검색어로 시도해보세요</p>
                  <Link
                    href={getPath('/main')}
                    className="mt-4 px-4 py-2 text-sm text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
                  >
                    전체 상품 보기
                  </Link>
                </>
              ) : (
                <>
                  <Package className="w-12 h-12 md:w-16 md:h-16 mb-4 text-gray-300" />
                  <p className="text-sm md:text-base">등록된 상품이 없습니다</p>
                  <p className="text-xs text-gray-500 mt-1">관리자에게 문의해주세요</p>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
