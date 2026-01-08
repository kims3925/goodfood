'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, Trophy, Medal, Award, Sparkles } from 'lucide-react'
import { useCartNotification } from '@/contexts/CartNotificationContext'
import { useShopUrl } from '@/hooks/useShopUrl'

interface PopularProduct {
  id: number
  shopProductId?: number
  title: string
  description?: string
  originalPrice: number
  salePrice: number
  discount: number
  images: string[]
  category: string
  rank: number
  totalOrdered: number
}

interface Product {
  id: number
  shopProductId?: number
  title: string
  description?: string
  originalPrice: number
  salePrice: number
  discount: number
  images: string[]
  category: string
}

export default function PopularProductsPage() {
  const { showNotification } = useCartNotification()
  const { getApiPath, getPath } = useShopUrl()

  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([])
  const [generalProducts, setGeneralProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true)

      // 인기상품 (10개 제한)과 일반상품을 병렬로 불러오기
      const [popularRes, generalRes] = await Promise.all([
        fetch(getApiPath('/api/shop/popular?limit=10')),
        fetch(getApiPath('/api/shop/sections?limit=50')),
      ])

      const popularData = await popularRes.json()
      const generalData = await generalRes.json()

      if (popularData.success) {
        setPopularProducts(popularData.products || [])
      }

      if (generalData.success) {
        const allProducts = generalData.products || generalData.channelProducts || []
        // 인기상품 ID 목록
        const popularIds = new Set(
          (popularData.products || []).map((p: PopularProduct) => p.shopProductId)
        )
        // 인기상품에 없는 일반상품만 필터링
        const filteredProducts = allProducts.filter(
          (p: Product) => !popularIds.has(p.shopProductId)
        )
        setGeneralProducts(filteredProducts)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setIsLoading(false)
    }
  }, [getApiPath])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const formatPrice = (price: number) => price.toLocaleString()

  const handleAddToCart = async (product: PopularProduct | Product, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!product.shopProductId) {
      return
    }

    try {
      const response = await fetch(getApiPath('/api/cart'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopProductId: product.shopProductId,
          quantity: 1,
        }),
      })

      const data = await response.json()
      if (data.success) {
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

  // 순위별 메달 컴포넌트
  const RankBadge = ({ rank }: { rank: number }) => {
    if (rank === 1) {
      return (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full shadow-lg">
          <Trophy className="w-4 h-4 text-white" />
          <span className="text-xs font-bold text-white">1위</span>
        </div>
      )
    }
    if (rank === 2) {
      return (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full shadow-lg">
          <Medal className="w-4 h-4 text-white" />
          <span className="text-xs font-bold text-white">2위</span>
        </div>
      )
    }
    if (rank === 3) {
      return (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-600 to-amber-700 rounded-full shadow-lg">
          <Award className="w-4 h-4 text-white" />
          <span className="text-xs font-bold text-white">3위</span>
        </div>
      )
    }
    return (
      <div className="absolute top-2 left-2 z-10 flex items-center justify-center w-7 h-7 bg-gray-800/80 rounded-full shadow">
        <span className="text-xs font-bold text-white">{rank}</span>
      </div>
    )
  }

  // 상품 카드 컴포넌트
  const ProductCard = ({
    product,
    showRank = false,
    priority = false,
  }: {
    product: PopularProduct | Product
    showRank?: boolean
    priority?: boolean
  }) => (
    <Link
      href={getPath(`/product/${product.id}`)}
      className="group block"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 hover:border-rose-400 transition-all hover:shadow-lg">
        {/* 순위 뱃지 (인기상품만) */}
        {showRank && 'rank' in product && <RankBadge rank={product.rank} />}

        <Image
          src={product.images[0] || '/images/placeholder.png'}
          alt={product.title}
          fill
          sizes="(max-width: 640px) 33vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          className="object-cover transition-transform group-hover:scale-105"
          priority={priority}
        />
        <button
          onClick={(e) => handleAddToCart(product, e)}
          className="absolute bottom-1 right-1 w-10 h-10 md:w-11 md:h-11 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
          aria-label="장바구니 담기"
        >
          <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
        </button>
        {product.discount > 0 && (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] md:text-xs font-bold text-white rounded bg-rose-500">
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
  )

  return (
    <div className="bg-white min-h-screen">
      {/* 헤더 섹션 */}
      <section className="py-6 md:py-10 bg-gradient-to-b from-rose-50 via-orange-50/50 to-white">
        <div className="kurly-container">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-6 h-6 md:w-7 md:h-7 text-amber-500" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">인기상품 TOP 10</h1>
          </div>
          <p className="text-center text-sm md:text-base text-gray-500">
            주문량이 많은 인기 상품을 만나보세요
          </p>
        </div>
      </section>

      {/* 인기상품 TOP 10 */}
      <section className="py-6 md:py-8 bg-white">
        <div className="kurly-container">
          {isLoading ? (
            /* 스켈레톤 UI */
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
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
          ) : popularProducts.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
              {popularProducts.map((product, index) => (
                <ProductCard
                  key={`popular-${product.shopProductId || product.id}`}
                  product={product}
                  showRank={true}
                  priority={index < 6}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Trophy className="w-12 h-12 md:w-16 md:h-16 mb-4 text-gray-300" />
              <p className="text-sm md:text-base">아직 주문된 상품이 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">첫 주문의 주인공이 되어보세요!</p>
              <Link
                href={getPath('/main')}
                className="mt-4 px-4 py-2 text-sm text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
              >
                상품 둘러보기
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 이 상품은 어떠세요? - 일반 상품 */}
      {!isLoading && generalProducts.length > 0 && (
        <section className="py-8 md:py-12 bg-gray-50">
          <div className="kurly-container">
            {/* 구분선 및 문구 */}
            <div className="flex items-center justify-center gap-3 mb-6 md:mb-8">
              <div className="flex-1 h-px bg-gray-300" />
              <div className="flex items-center gap-2 px-4">
                <Sparkles className="w-5 h-5 text-rose-400" />
                <h2 className="text-lg md:text-xl font-bold text-gray-800">
                  이런 상품은 어때요?
                </h2>
                <Sparkles className="w-5 h-5 text-rose-400" />
              </div>
              <div className="flex-1 h-px bg-gray-300" />
            </div>

            {/* 일반 상품 그리드 */}
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
              {generalProducts.map((product) => (
                <ProductCard
                  key={`general-${product.shopProductId || product.id}`}
                  product={product}
                  showRank={false}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
