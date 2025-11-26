'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ShoppingCart, MessageCircle } from 'lucide-react'

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

interface CategorySection {
  name: string
  icon: string
  products: Product[]
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categorySections, setCategorySections] = useState<CategorySection[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])

  const categoryDefinitions = [
    { name: '육류', icon: '🥩' },
    { name: '수산물', icon: '🐟' },
    { name: '채소', icon: '🥬' },
    { name: '과일', icon: '🍎' },
    { name: '김치/반찬', icon: '🥢' },
    { name: '가공식품', icon: '📦' },
  ]

  // 한 번에 보여줄 카드 수
  const cardsPerView = 4
  const totalSlides = Math.max(1, Math.ceil(featuredProducts.length / cardsPerView))

  useEffect(() => {
    loadProducts()
  }, [])

  // 자동 슬라이드 (3초마다)
  useEffect(() => {
    if (featuredProducts.length === 0) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides)
    }, 3000)
    return () => clearInterval(timer)
  }, [featuredProducts.length, totalSlides])

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/shop/products?limit=100')
      const data = await response.json()

      if (data.success && data.products) {
        setProducts(data.products)
        groupByCategory(data.products)
        updateFeaturedProducts(data.products)
      } else {
        const mockData = getMockData()
        setProducts(mockData)
        groupByCategory(mockData)
        updateFeaturedProducts(mockData)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
      const mockData = getMockData()
      setProducts(mockData)
      groupByCategory(mockData)
      updateFeaturedProducts(mockData)
    } finally {
      setIsLoading(false)
    }
  }

  // 최신 상품으로 추천 상품 업데이트 (최대 12개)
  const updateFeaturedProducts = (products: Product[]) => {
    if (products.length === 0) return
    // 이미지가 있는 상품만 필터링 (최대 12개 - 3페이지 분량)
    const productsWithImages = products
      .filter(p => p.images && p.images.length > 0)
      .slice(0, 12)
    setFeaturedProducts(productsWithImages.length > 0 ? productsWithImages : products.slice(0, 12))
  }

  const groupByCategory = (products: Product[]) => {
    const sections: CategorySection[] = categoryDefinitions.map((cat) => ({
      name: cat.name,
      icon: cat.icon,
      products: products.filter((p) => {
        const productCategory = p.category?.toLowerCase() || ''
        const categoryName = cat.name.toLowerCase()
        return productCategory.includes(categoryName) ||
               categoryName.includes(productCategory) ||
               productCategory === categoryName
      }),
    })).filter((section) => section.products.length > 0)

    // If no matching categories, create a "전체 상품" section
    if (sections.length === 0 && products.length > 0) {
      sections.push({
        name: '추천 상품',
        icon: '✨',
        products: products.slice(0, 10),
      })
    }

    setCategorySections(sections)
  }

  const getMockData = (): Product[] => [
    {
      id: '1',
      title: '[500g 2,900원] 택배비보다 싼!! 가마솥 사골 도가니탕 2종',
      originalPrice: 4900,
      salePrice: 2900,
      discount: 41,
      images: ['https://via.placeholder.com/249x320/FF6B6B/FFFFFF?text=도가니탕'],
      category: '육류',
      rating: 4.8,
      reviews: 234,
    },
    {
      id: '2',
      title: '[총 5마리 4900원!!] 구룡포직송!! 반건조 피데기오징어',
      originalPrice: 7900,
      salePrice: 4900,
      discount: 38,
      images: ['https://via.placeholder.com/249x320/4ECDC4/FFFFFF?text=오징어'],
      category: '수산물',
      rating: 4.7,
      reviews: 189,
    },
    {
      id: '3',
      title: '(무료배송) 900개 한정!! 전라도 수제 총각김치 2kg',
      originalPrice: 18900,
      salePrice: 11900,
      discount: 37,
      images: ['https://via.placeholder.com/249x320/F7B731/FFFFFF?text=총각김치'],
      category: '김치/반찬',
      rating: 4.9,
      reviews: 567,
    },
    {
      id: '4',
      title: '[5kg 덤증정] 전라도식 수제 포기김치 총 10kg',
      originalPrice: 56900,
      salePrice: 39900,
      discount: 30,
      images: ['https://via.placeholder.com/249x320/95E1D3/FFFFFF?text=포기김치'],
      category: '김치/반찬',
      rating: 4.8,
      reviews: 412,
    },
    {
      id: '5',
      title: '[홍로사과 2kg 9900원] 기획특가!! 꿀먹은 경북 햇 홍로사과',
      originalPrice: 13900,
      salePrice: 9900,
      discount: 29,
      images: ['https://via.placeholder.com/249x320/FF6B6B/FFFFFF?text=홍로사과'],
      category: '과일',
      rating: 4.6,
      reviews: 123,
    },
    {
      id: '6',
      title: '반값!! 50% 파격세일!! 전라도 알배기겉절이김치',
      originalPrice: 13800,
      salePrice: 6900,
      discount: 50,
      images: ['https://via.placeholder.com/249x320/4ECDC4/FFFFFF?text=겉절이'],
      category: '김치/반찬',
      rating: 4.7,
      reviews: 89,
    },
    {
      id: '7',
      title: '제주 흑돼지 삼겹살 500g 특가',
      originalPrice: 25000,
      salePrice: 19900,
      discount: 20,
      images: ['https://via.placeholder.com/249x320/E74C3C/FFFFFF?text=삼겹살'],
      category: '육류',
      rating: 4.9,
      reviews: 321,
    },
    {
      id: '8',
      title: '싱싱한 활전복 10미 세트',
      originalPrice: 35000,
      salePrice: 28900,
      discount: 17,
      images: ['https://via.placeholder.com/249x320/3498DB/FFFFFF?text=전복'],
      category: '수산물',
      rating: 4.8,
      reviews: 156,
    },
  ]

  const formatPrice = (price: number) => price.toLocaleString()

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

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % totalSlides)
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides)

  return (
    <div className="bg-white">
      {/* 추천 상품 캐러셀 */}
      <section className="py-8 bg-gradient-to-r from-[#FFF5F5] to-[#FFF8F0]">
        <div className="kurly-container">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">✨ 최신 상품</h2>
            <div className="flex items-center gap-2">
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

          <div className="relative group">
            {/* 이전 버튼 */}
            {totalSlides > 1 && (
              <button
                onClick={prevSlide}
                className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
            )}

            {/* 상품 카드 슬라이더 */}
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {Array.from({ length: totalSlides }).map((_, slideIndex) => (
                  <div key={slideIndex} className="w-full flex-shrink-0">
                    <div className="grid grid-cols-4 gap-4">
                      {featuredProducts
                        .slice(slideIndex * cardsPerView, (slideIndex + 1) * cardsPerView)
                        .map((product) => (
                          <Link
                            key={product.id}
                            href={`/store/product/${product.id}`}
                            className="kurly-product-card block"
                          >
                            <div className="kurly-product-image">
                              <img
                                src={product.images[0] || 'https://via.placeholder.com/249x320/EEEEEE/999999?text=No+Image'}
                                alt={product.title}
                              />
                              <button
                                onClick={(e) => handleAddToCart(product, e)}
                                className="kurly-cart-btn"
                                title="장바구니 담기"
                              >
                                <ShoppingCart className="w-5 h-5" />
                              </button>
                            </div>
                            <div className="kurly-product-info">
                              <h3 className="kurly-product-name">{product.title}</h3>
                              <div className="kurly-product-price-row">
                                {product.discount > 0 && (
                                  <span className="kurly-discount-rate">{product.discount}%</span>
                                )}
                                <span className="kurly-sale-price">{formatPrice(product.salePrice)}원</span>
                              </div>
                              {product.originalPrice > product.salePrice && (
                                <p className="kurly-original-price">{formatPrice(product.originalPrice)}원</p>
                              )}
                            </div>
                          </Link>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 다음 버튼 */}
            {totalSlides > 1 && (
              <button
                onClick={nextSlide}
                className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
              >
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Category Sections */}
      <div className="kurly-container">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B]"></div>
          </div>
        ) : (
          <>
            {categorySections.map((section) => (
              <ProductSection
                key={section.name}
                title={`${section.icon} ${section.name}`}
                products={section.products}
                onAddToCart={handleAddToCart}
                moreLink={`/store?category=${encodeURIComponent(section.name)}`}
              />
            ))}

            {/* All Products Section */}
            {products.length > 0 && (
              <ProductSection
                title="🛒 전체 상품"
                products={products}
                onAddToCart={handleAddToCart}
                moreLink="/store?filter=all"
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Product Section Component with Horizontal Scroll
function ProductSection({
  title,
  products,
  onAddToCart,
  moreLink,
}: {
  title: string
  products: Product[]
  onAddToCart: (product: Product, e: React.MouseEvent) => void
  moreLink: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 520 // ~2 cards
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  useEffect(() => {
    checkScroll()
    const ref = scrollRef.current
    if (ref) {
      ref.addEventListener('scroll', checkScroll)
      return () => ref.removeEventListener('scroll', checkScroll)
    }
  }, [products])

  const formatPrice = (price: number) => price.toLocaleString()

  return (
    <section className="kurly-section">
      <div className="kurly-section-header">
        <h2 className="kurly-section-title">{title}</h2>
        <Link href={moreLink} className="kurly-section-more flex items-center gap-1">
          전체보기 <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="relative group">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
        )}

        {/* Products Container */}
        <div
          ref={scrollRef}
          className="kurly-scroll-container"
        >
          {products.map((product) => (
            <div key={product.id} className="kurly-scroll-item">
              <Link href={`/store/product/${product.id}`} className="kurly-product-card block">
                <div className="kurly-product-image">
                  <img
                    src={product.images[0] || 'https://via.placeholder.com/249x320/EEEEEE/999999?text=No+Image'}
                    alt={product.title}
                  />
                  {/* Cart Button */}
                  <button
                    onClick={(e) => onAddToCart(product, e)}
                    className="kurly-cart-btn"
                    title="장바구니 담기"
                  >
                    <ShoppingCart className="w-5 h-5" />
                  </button>
                </div>
                <div className="kurly-product-info">
                  <span className="kurly-delivery-badge">샛별배송</span>
                  <h3 className="kurly-product-name">{product.title}</h3>
                  <div className="kurly-product-price-row">
                    {product.discount > 0 && (
                      <span className="kurly-discount-rate">{product.discount}%</span>
                    )}
                    <span className="kurly-sale-price">{formatPrice(product.salePrice)}원</span>
                  </div>
                  {product.originalPrice > product.salePrice && (
                    <p className="kurly-original-price">{formatPrice(product.originalPrice)}원</p>
                  )}
                  {product.reviews && product.reviews > 0 && (
                    <div className="kurly-product-meta">
                      <MessageCircle className="w-3 h-3" />
                      <span>후기 {product.reviews}</span>
                    </div>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        )}
      </div>
    </section>
  )
}
