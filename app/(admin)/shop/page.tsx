'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart, Package, Search, Filter, Heart, Share, ChevronRight, Store } from 'lucide-react'

export default function ShopPage() {
  const [products, setProducts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/shop/products')
      const data = await response.json()

      if (data.success) {
        setProducts(data.products || [])
      } else {
        // 에러시 임시 데이터
        setProducts(getMockData())
      }
    } catch (error) {
      console.error('Failed to load products:', error)
      setProducts(getMockData())
    } finally {
      setIsLoading(false)
    }
  }

  const getMockData = () => [
    {
      id: '1',
      title: '프리미엄 한우 세트 1++ 등급',
      description: '최고급 1++ 한우로 구성된 프리미엄 선물세트입니다.',
      originalPrice: 50000,
      salePrice: 65000,
      discount: 30,
      images: ['https://via.placeholder.com/300x300/FF6B6B/FFFFFF?text=한우세트'],
      category: '육류',
      stock: 47,
      orders: 3,
      rating: 4.8,
      reviews: 12,
    },
    {
      id: '2',
      title: '유기농 과일 선물세트',
      description: '100% 유기농 인증을 받은 신선한 과일로 구성된 건강한 선물세트입니다.',
      originalPrice: 30000,
      salePrice: 39000,
      discount: 30,
      images: ['https://via.placeholder.com/300x300/4ECDC4/FFFFFF?text=과일세트'],
      category: '과일',
      stock: 95,
      orders: 5,
      rating: 4.6,
      reviews: 8,
    },
    {
      id: '3',
      title: '수제 마카롱 12구 세트',
      description: '파티시에가 직접 만든 수제 마카롱 12구 세트. 다양한 맛으로 구성되어 있습니다.',
      originalPrice: 25000,
      salePrice: 32000,
      discount: 28,
      images: ['https://via.placeholder.com/300x300/F7B731/FFFFFF?text=마카롱'],
      category: '디저트',
      stock: 0,
      orders: 30,
      rating: 4.9,
      reviews: 45,
    },
    {
      id: '4',
      title: '친환경 계란 30구',
      description: '무항생제 인증 받은 건강한 계란',
      originalPrice: 8000,
      salePrice: 10000,
      discount: 25,
      images: ['https://via.placeholder.com/300x300/95E1D3/FFFFFF?text=계란'],
      category: '농산',
      stock: 120,
      orders: 15,
      rating: 4.7,
      reviews: 23,
    },
  ]

  const categories = ['all', '육류', '수산', '농산', '과일', '디저트', '가공품']

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const formatPrice = (price: number) => {
    return price.toLocaleString()
  }

  const handleAddToCart = (product: any) => {
    alert(`"${product.title}" 상품이 장바구니에 추가되었습니다.`)
  }

  const handleShare = (product: any) => {
    const shareText = `🎁 ${product.title}\n💰 ${formatPrice(product.salePrice)}원\n🔗 ${window.location.origin}/shop/product/${product.id}`
    navigator.clipboard.writeText(shareText)
    alert('상품 링크가 복사되었습니다!')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Store className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Band Auto Shop</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="상품 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              <button className="relative p-2 rounded-lg hover:bg-gray-100">
                <ShoppingCart className="h-6 w-6 text-gray-700" />
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  0
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Category Filter */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-4 overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category === 'all' ? '전체' : category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">전체 상품</p>
            <p className="text-2xl font-bold text-gray-900">{products.length}개</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">오늘의 특가</p>
            <p className="text-2xl font-bold text-red-600">15개</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">신규 상품</p>
            <p className="text-2xl font-bold text-green-600">8개</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">총 주문</p>
            <p className="text-2xl font-bold text-blue-600">53건</p>
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
                {/* Product Image */}
                <div className="relative aspect-square">
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                  {product.discount > 0 && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
                      -{product.discount}%
                    </span>
                  )}
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <span className="bg-white text-gray-900 px-4 py-2 rounded-lg font-bold">
                        품절
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => handleShare(product)}
                    className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:shadow-lg"
                  >
                    <Share className="h-4 w-4 text-gray-600" />
                  </button>
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <div className="mb-2">
                    <span className="text-xs text-gray-500">{product.category}</span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                    {product.title}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                    {product.description}
                  </p>

                  {/* Rating */}
                  <div className="flex items-center gap-1 mb-3">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.floor(product.rating)
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                          viewBox="0 0 20 20"
                        >
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">
                      {product.rating} ({product.reviews})
                    </span>
                  </div>

                  {/* Price */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">
                        {formatPrice(product.salePrice)}원
                      </span>
                      {product.originalPrice > product.salePrice && (
                        <span className="text-sm text-gray-500 line-through">
                          {formatPrice(product.originalPrice)}원
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      재고: {product.stock}개 | 판매: {product.orders}건
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="text-sm">장바구니</span>
                    </button>
                    <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      <Heart className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredProducts.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">검색 결과가 없습니다.</p>
          </div>
        )}
      </main>
    </div>
  )
}
