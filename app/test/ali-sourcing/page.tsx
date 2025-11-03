'use client'

import { useState } from 'react'

interface Product {
  id: string
  title: string
  price: number
  imageUrl: string
  productUrl: string
  rating?: number
  orders?: number
  shippingPrice?: number
}

export default function AliSourcingTestPage() {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState('')

  const handleSearch = async () => {
    if (!keyword.trim()) {
      setError('검색어를 입력해주세요')
      return
    }

    setLoading(true)
    setError('')
    setProducts([])

    try {
      const response = await fetch('/api/ali-sourcing/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '검색 실패')
      }

      setProducts(data.products || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            알리익스프레스 소싱 테스트
          </h1>
          <p className="text-gray-600">
            알리익스프레스에서 상품을 검색하고 소싱할 수 있는 기능을 테스트합니다.
          </p>
        </div>

        {/* 검색 영역 */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <div className="flex gap-4">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="상품명을 입력하세요 (예: bluetooth earphones)"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none"
              disabled={loading}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? '검색 중...' : '검색'}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* 결과 영역 */}
        {loading && (
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">알리익스프레스에서 상품을 검색하는 중...</p>
          </div>
        )}

        {!loading && products.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              검색 결과 ({products.length}개)
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="overflow-hidden rounded-lg bg-white shadow transition hover:shadow-lg"
                >
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-image.png'
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="mb-2 line-clamp-2 text-sm font-medium text-gray-900">
                      {product.title}
                    </h3>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-lg font-bold text-blue-600">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.shippingPrice !== undefined && (
                        <span className="text-xs text-gray-500">
                          배송비: ${product.shippingPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {product.rating && (
                      <div className="mb-2 flex items-center gap-2 text-xs text-gray-600">
                        <span>⭐ {product.rating.toFixed(1)}</span>
                        {product.orders && <span>주문: {product.orders}+</span>}
                      </div>
                    )}
                    <a
                      href={product.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full rounded-lg bg-gray-100 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-200"
                    >
                      상품 보기
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && products.length === 0 && keyword && (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <p className="text-gray-600">검색 결과가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
