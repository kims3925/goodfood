'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Package, ShoppingCart } from 'lucide-react'
import { useShopUrl } from '@/hooks/useShopUrl'
import { useCartNotification } from '@/contexts/CartNotificationContext'
import type { CategoryCode } from '@/lib/categories'

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
  isNew?: boolean
}

interface Props {
  categoryCode: CategoryCode
  categoryMeta: { name: string; label: string; emoji: string; color: string }
}

export default function CategoryClient({ categoryCode, categoryMeta }: Props) {
  const { getApiPath, getPath } = useShopUrl()
  const { showNotification } = useCartNotification()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const url = getApiPath(`/api/shop/products?category=${encodeURIComponent(categoryCode)}&limit=200`)
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setProducts(data.products || [])
      }
    } catch (err) {
      console.error('카테고리 상품 로드 실패:', err)
    } finally {
      setIsLoading(false)
    }
  }, [getApiPath, categoryCode])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const formatPrice = useCallback((price: number) => price.toLocaleString(), [])

  const handleAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!product.shopProductId) return
    try {
      const res = await fetch(getApiPath('/api/cart'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopProductId: product.shopProductId, quantity: 1 }),
      })
      const data = await res.json()
      if (data.success) {
        showNotification({
          title: product.title,
          image: product.images?.[0] || '/images/placeholder.png',
          quantity: 1,
          isExisting: data.isExisting,
        })
      }
    } catch (err) {
      console.error('장바구니 추가 오류:', err)
    }
  }

  return (
    <div className="bg-white min-h-screen">
      <section className="py-6 md:py-10 bg-gradient-to-b from-rose-50 via-amber-50/40 to-white">
        <div className="kurly-container">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl md:text-4xl">{categoryMeta.emoji}</span>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{categoryMeta.name}</h1>
            <span className="text-sm text-gray-500 ml-1">{products.length}개 상품</span>
          </div>
          <p className="text-sm text-gray-600">{categoryMeta.label}</p>
        </div>
      </section>

      <section className="py-6 md:py-10 bg-white">
        <div className="kurly-container">
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square rounded-xl bg-gray-200" />
                  <div className="mt-2 md:mt-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
              {products.map((product, index) => (
                <Link
                  key={`product-${product.shopProductId || product.id}`}
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
                      priority={index < 6}
                    />
                    <button
                      onClick={(e) => handleAddToCart(product, e)}
                      className="absolute bottom-1 right-1 w-10 h-10 md:w-11 md:h-11 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
                      aria-label="장바구니 담기"
                    >
                      <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
                    </button>
                  </div>
                  <div className="mt-2 md:mt-3">
                    <h4 className="text-xs md:text-sm font-medium text-gray-900 line-clamp-2 min-h-[32px] md:min-h-[40px]">
                      {product.title}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm md:text-base font-bold text-gray-900">
                        {formatPrice(product.salePrice)}원
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Package className="w-12 h-12 md:w-16 md:h-16 mb-4 text-gray-300" />
              <p className="text-sm md:text-base">{categoryMeta.name} 카테고리 상품이 없습니다</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
