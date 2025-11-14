'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Clock, TrendingUp, Star, ShoppingCart, Heart, Share2 } from 'lucide-react'

export default function StorePage() {
  const [products, setProducts] = useState<any[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [timeLeft, setTimeLeft] = useState({ hours: 23, minutes: 59, seconds: 59 })
  const [isLoading, setIsLoading] = useState(true)
  const [storeSettings, setStoreSettings] = useState<any>({
    bannerImages: [],
    categories: [],
    showTimeSale: false,
    showBestProducts: false
  })

  useEffect(() => {
    loadProducts()
    loadStoreSettings()
    // 타이머 시작
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 }
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 }
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 }
        } else {
          return { hours: 23, minutes: 59, seconds: 59 }
        }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/shop/products')
      const data = await response.json()

      if (data.success) {
        setProducts(data.products || [])
      } else {
        setProducts(getMockData())
      }
    } catch (error) {
      console.error('Failed to load products:', error)
      setProducts(getMockData())
    } finally {
      setIsLoading(false)
    }
  }

  const loadStoreSettings = async () => {
    try {
      const response = await fetch('/api/shop/settings')
      const data = await response.json()

      if (data.success && data.settings) {
        setStoreSettings(data.settings)
      }
    } catch (error) {
      console.error('Failed to load store settings:', error)
    }
  }

  const getMockData = () => [
    {
      id: '1',
      title: '[500g 2,900원] 택배비보다 싼!! 가마솥 사골 도가니탕 2종',
      originalPrice: 4900,
      salePrice: 2900,
      discount: 41,
      images: ['https://via.placeholder.com/300x300/FF6B6B/FFFFFF?text=도가니탕'],
      category: '육류',
      rating: 4.8,
      reviews: 234,
      isTimeSale: true,
      isBest: true,
    },
    {
      id: '2',
      title: '[총 5마리 4900원!!] 구룡포직송!! 반건조 피데기오징어',
      originalPrice: 7900,
      salePrice: 4900,
      discount: 38,
      images: ['https://via.placeholder.com/300x300/4ECDC4/FFFFFF?text=오징어'],
      category: '수산물',
      rating: 4.7,
      reviews: 189,
      isTimeSale: true,
    },
    {
      id: '3',
      title: '(무료배송) 900개 한정!! 전라도 수제 총각김치 2kg',
      originalPrice: 18900,
      salePrice: 11900,
      discount: 37,
      images: ['https://via.placeholder.com/300x300/F7B731/FFFFFF?text=총각김치'],
      category: '김치/반찬',
      rating: 4.9,
      reviews: 567,
      isBest: true,
    },
    {
      id: '4',
      title: '[5kg 덤증정] 전라도식 수제 포기김치 총 10kg (haccp 인증)',
      originalPrice: 56900,
      salePrice: 39900,
      discount: 30,
      images: ['https://via.placeholder.com/300x300/95E1D3/FFFFFF?text=포기김치'],
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
      images: ['https://via.placeholder.com/300x300/FF6B6B/FFFFFF?text=홍로사과'],
      category: '과일',
      rating: 4.6,
      reviews: 123,
      isNew: true,
    },
    {
      id: '6',
      title: '반값!! 50% 파격세일!! 전라도 알배기겉절이김치',
      originalPrice: 13800,
      salePrice: 6900,
      discount: 50,
      images: ['https://via.placeholder.com/300x300/4ECDC4/FFFFFF?text=겉절이'],
      category: '김치/반찬',
      rating: 4.7,
      reviews: 89,
      isTimeSale: true,
    },
  ]

  // 동적 배너 데이터 - 설정에서 가져오거나 기본값 사용
  const banners = storeSettings.bannerImages?.filter((banner: any) => banner.url) || [
    { id: 1, image: 'https://via.placeholder.com/800x400/FF6B6B/FFFFFF?text=오늘의+특가', link: '/store?filter=sale', title: '오늘의 특가' },
    { id: 2, image: 'https://via.placeholder.com/800x400/4ECDC4/FFFFFF?text=신상품+입고', link: '/store?filter=new', title: '신상품 입고' },
    { id: 3, image: 'https://via.placeholder.com/800x400/F7B731/FFFFFF?text=베스트+상품', link: '/store?filter=best', title: '베스트 상품' },
  ]

  // 동적 카테고리 데이터 - 설정에서 가져오거나 기본값 사용
  const categories = storeSettings.categories?.filter((cat: any) => cat.enabled) || [
    { name: '육류', icon: '🥩', color: 'bg-red-50' },
    { name: '수산물', icon: '🐟', color: 'bg-blue-50' },
    { name: '채소', icon: '🥬', color: 'bg-green-50' },
    { name: '과일', icon: '🍎', color: 'bg-orange-50' },
    { name: '김치', icon: '🥢', color: 'bg-yellow-50' },
    { name: '가공품', icon: '📦', color: 'bg-purple-50' },
    { name: '특가', icon: '⚡', color: 'bg-pink-50' },
    { name: '더보기', icon: '➕', color: 'bg-gray-50' },
  ]

  const formatPrice = (price: number) => {
    return price.toLocaleString()
  }

  const handleAddToCart = async (product: any, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    try {
      // 세션 ID 생성
      let sessionId = localStorage.getItem('sessionId')
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2)
        localStorage.setItem('sessionId', sessionId)
      }

      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          productId: product.id,
          quantity: 1
        })
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

  const handleAddToWishlist = (product: any, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    alert(`"${product.title}" 상품이 찜 목록에 추가되었습니다.`)
  }

  const handleShare = (product: any, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const shareText = `${product.title}\n${formatPrice(product.salePrice)}원\n${window.location.origin}/store/product/${product.id}`
    navigator.clipboard.writeText(shareText)
    alert('상품 링크가 복사되었습니다!')
  }

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length)
  }

  return (
    <div className="bg-gray-50 max-w-md mx-auto min-h-screen">
      {/* Hero Banner Carousel */}
      <section className="relative overflow-hidden bg-white">
        <div className="relative h-48">
          <div className="flex transition-transform duration-300" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
            {banners.map((banner: any, index: number) => (
              <Link key={banner.id || index} href={banner.link} className="w-full flex-shrink-0">
                <img src={banner.url || banner.image} alt={banner.title || ""} className="w-full h-48 object-cover" />
              </Link>
            ))}
          </div>
          <button onClick={prevSlide} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow-md">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={nextSlide} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow-md">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {banners.map((_: any, index: number) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-colors ${currentSlide === index ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Category Icons */}
      <section className="bg-white py-4 border-b">
        <div className="px-4">
          <div className="grid grid-cols-4 gap-4">
            {categories.map((category: any, index: number) => (
              <Link
                key={category.name}
                href={`/store?category=${category.name}`}
                className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className={`w-12 h-12 ${category.color} rounded-full flex items-center justify-center text-2xl`}>
                  {category.icon}
                </div>
                <span className="text-xs text-gray-700">{category.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Time Sale Section */}
      {storeSettings.showTimeSale && (
      <section className="bg-gradient-to-r from-red-500 to-orange-500 py-6">
        <div className="px-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-white animate-pulse" />
              <h2 className="text-xl font-bold text-white">⚡ 타임특가</h2>
              <div className="flex items-center gap-1 bg-black/20 rounded px-2 py-1">
                <span className="text-white font-mono text-sm">
                  {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                </span>
              </div>
            </div>
            <Link href="/store?filter=sale" className="text-white text-sm">더보기 &gt;</Link>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {products.filter(p => p.isTimeSale).slice(0, 4).map((product) => (
              <Link
                key={product.id}
                href={`/store/product/${product.id}`}
                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-square">
                  <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                    {product.discount}% OFF
                  </span>
                  <div className="absolute top-2 right-2 flex flex-col gap-1">
                    <button 
                      onClick={(e) => handleAddToWishlist(product, e)}
                      className="bg-white/90 p-1.5 rounded-full shadow hover:bg-white"
                    >
                      <Heart className="h-4 w-4 text-gray-600" />
                    </button>
                    <button 
                      onClick={(e) => handleShare(product, e)}
                      className="bg-white/90 p-1.5 rounded-full shadow hover:bg-white"
                    >
                      <Share2 className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">{product.title}</h3>
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="h-3 w-3 text-yellow-400 fill-current" />
                    <span className="text-xs text-gray-600">{product.rating} ({product.reviews})</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-gray-500 line-through">{formatPrice(product.originalPrice)}원</p>
                      <p className="text-base font-bold text-gray-900">{formatPrice(product.salePrice)}원</p>
                    </div>
                    <button 
                      onClick={(e) => handleAddToCart(product, e)}
                      className="bg-red-500 text-white p-2 rounded hover:bg-red-600 transition-colors"
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Best Products */}
      {storeSettings.showBestProducts && (
      <section className="py-6 bg-white">
        <div className="px-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">베스트 상품</h2>
            </div>
            <Link href="/store?filter=best" className="text-blue-600 text-sm">더보기 &gt;</Link>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {products.filter(p => p.isBest).map((product, index) => (
              <Link
                key={product.id}
                href={`/store/product/${product.id}`}
                className="bg-white rounded-lg overflow-hidden border hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-square">
                  <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                    BEST {index + 1}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-sm text-gray-900 line-clamp-2 mb-1">{product.title}</h3>
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="h-3 w-3 text-yellow-400 fill-current" />
                    <span className="text-xs text-gray-600">{product.rating}</span>
                  </div>
                  <div>
                    <span className="text-xs text-red-500 font-bold">{product.discount}%</span>
                    <span className="text-sm font-bold text-gray-900 ml-1">{formatPrice(product.salePrice)}원</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* All Products Grid */}
      <section className="py-6 bg-gray-50">
        <div className="px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">오늘의 추천상품</h2>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/store/product/${product.id}`}
                  className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                >
                  <div className="relative aspect-square">
                    <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                    {product.discount > 0 && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                        -{product.discount}%
                      </span>
                    )}
                    {product.isNew && (
                      <span className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <span className="text-xs text-gray-500">{product.category}</span>
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mt-1 mb-2">{product.title}</h3>
                    <div className="flex items-center gap-1 mb-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-3 w-3 ${i < Math.floor(product.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-600">({product.reviews})</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        {product.originalPrice > product.salePrice && (
                          <p className="text-xs text-gray-500 line-through">{formatPrice(product.originalPrice)}원</p>
                        )}
                        <p className="text-base font-bold text-gray-900">{formatPrice(product.salePrice)}원</p>
                      </div>
                      <button 
                        onClick={(e) => handleAddToCart(product, e)}
                        className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition-colors"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Floating Action Button */}
      <button className="fixed bottom-20 right-4 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-30">
        <ShoppingCart className="h-6 w-6" />
      </button>
    </div>
  )
}
