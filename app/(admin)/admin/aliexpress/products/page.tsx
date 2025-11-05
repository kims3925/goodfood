'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Filter, Package, DollarSign, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

interface AliExpressProduct {
  id: string
  productId: string
  productTitle: string
  productImage: string
  productUrl: string
  originalPrice: number
  salePrice: number
  discount: number
  currency: string
  rating?: number
  totalOrders?: number
  shippingPrice?: number
  // AI 분석 결과
  hookingTitle?: string
  productCategory: string
  extractedPrice?: number
  adjustedPrice?: number
  policyApplied: boolean
  status: string
  createdAt: string
}

function ProductsContent() {
  const searchParams = useSearchParams()
  const sourcingId = searchParams.get('sourcingId')

  const [products, setProducts] = useState<AliExpressProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadProducts()
  }, [sourcingId, statusFilter, categoryFilter, currentPage])

  const loadProducts = async () => {
    try {
      setIsLoading(true)

      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20'
      })

      if (sourcingId) params.append('sourcingId', sourcingId)
      if (statusFilter !== 'ALL') params.append('status', statusFilter)
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter)

      const response = await fetch(`/api/aliexpress/products?${params}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.products || [])
        setTotalPages(data.pagination?.totalPages || 1)
      } else {
        console.error('상품 로드 실패:', data.error)
        setProducts([])
      }
    } catch (error) {
      console.error('상품 로드 실패:', error)
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredProducts = products.filter(product =>
    product.productTitle.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const categoryMap: Record<string, string> = {
    SEAFOOD: '수산',
    LIVESTOCK: '축산',
    AGRICULTURAL: '농산',
    PROCESSED: '가공품',
    OTHER: '기타'
  }

  const statusMap: Record<string, string> = {
    PENDING: '대기중',
    CONFIRMED: '소싱확정',
    REJECTED: '제외'
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Package className="w-8 h-8 text-orange-500" />
              AliExpress 수집 상품
            </h1>
            <p className="text-gray-600 mt-2">
              {sourcingId ? '특정 소싱의 수집 상품' : '전체 수집 상품'} 목록입니다.
            </p>
          </div>
          <Link
            href="/admin/aliexpress"
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← 소싱 관리로
          </Link>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">총 상품</p>
                <p className="text-2xl font-bold text-gray-800">{products.length}</p>
              </div>
              <Package className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">소싱 확정</p>
                <p className="text-2xl font-bold text-green-600">
                  {products.filter(p => p.status === 'CONFIRMED').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">평균 가격</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${products.length > 0
                    ? (products.reduce((sum, p) => sum + p.salePrice, 0) / products.length).toFixed(2)
                    : 0
                  }
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">정책 적용</p>
                <p className="text-2xl font-bold text-purple-600">
                  {products.filter(p => p.policyApplied).length}
                </p>
              </div>
              <Filter className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* 필터 및 검색 */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="상품명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="ALL">전체 상태</option>
            <option value="PENDING">대기중</option>
            <option value="CONFIRMED">소싱확정</option>
            <option value="REJECTED">제외</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="ALL">전체 카테고리</option>
            <option value="SEAFOOD">수산</option>
            <option value="LIVESTOCK">축산</option>
            <option value="AGRICULTURAL">농산</option>
            <option value="PROCESSED">가공품</option>
            <option value="OTHER">기타</option>
          </select>
        </div>
      </div>

      {/* 상품 그리드 */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
          로딩 중...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
          {searchTerm ? '검색 결과가 없습니다.' : '수집된 상품이 없습니다.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                {/* 상품 이미지 */}
                <div className="relative h-48 bg-gray-100">
                  <img
                    src={product.productImage}
                    alt={product.productTitle}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      product.status === 'CONFIRMED'
                        ? 'bg-green-100 text-green-700'
                        : product.status === 'REJECTED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {statusMap[product.status] || product.status}
                    </span>
                  </div>
                  {product.discount > 0 && (
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-bold">
                        -{product.discount}%
                      </span>
                    </div>
                  )}
                </div>

                {/* 상품 정보 */}
                <div className="p-4">
                  <div className="mb-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {categoryMap[product.productCategory] || '기타'}
                    </span>
                  </div>

                  <h3 className="font-medium text-gray-800 text-sm mb-2 line-clamp-2">
                    {product.hookingTitle || product.productTitle}
                  </h3>

                  <div className="space-y-1 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">원가</span>
                      <span className="text-sm font-medium text-gray-700">
                        ${product.salePrice.toFixed(2)}
                      </span>
                    </div>
                    {product.extractedPrice && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">환산가</span>
                        <span className="text-sm font-medium text-blue-600">
                          {product.extractedPrice.toLocaleString()}원
                        </span>
                      </div>
                    )}
                    {product.adjustedPrice && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">판매가</span>
                        <span className="text-sm font-bold text-green-600">
                          {product.adjustedPrice.toLocaleString()}원
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 평점 및 주문 */}
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                    {product.rating && (
                      <span>⭐ {product.rating.toFixed(1)}</span>
                    )}
                    {product.totalOrders && (
                      <span>{product.totalOrders.toLocaleString()} orders</span>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex gap-2">
                    <a
                      href={product.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 text-xs font-medium transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      AliExpress
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                이전
              </button>
              <span className="px-4 py-2 text-gray-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function AliExpressProductsPage() {
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <ProductsContent />
    </Suspense>
  )
}
