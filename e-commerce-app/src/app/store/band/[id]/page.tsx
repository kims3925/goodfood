'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Store,
  ShoppingCart,
  ChevronLeft,
  SlidersHorizontal,
  X,
  ArrowUpDown,
} from 'lucide-react'
import { useCartNotification } from '@/contexts/CartNotificationContext'

interface Product {
  id: string
  productPublishId?: string
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
}

interface BandInfo {
  id: number
  name: string
  coverUrl?: string | null
  formUrl?: string | null
}

interface PriceRange {
  min: number
  max: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const sortOptions = [
  { value: 'latest', label: '최신순' },
  { value: 'price_asc', label: '가격 낮은순' },
  { value: 'price_desc', label: '가격 높은순' },
  { value: 'discount', label: '할인율순' },
]

export default function BandProductsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showNotification } = useCartNotification()
  const bandId = params.id as string

  const [band, setBand] = useState<BandInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 100000 })
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)

  // 필터 상태
  const [selectedPriceFilter, setSelectedPriceFilter] = useState<string>('all')
  const [sort, setSort] = useState<string>('latest')
  const [currentPage, setCurrentPage] = useState(1)

  // 가격 범위에 따라 동적으로 필터 생성
  const generatePriceFilters = () => {
    const { min, max } = priceRange
    const range = max - min
    const filters = [{ value: 'all', label: '전체', min: 0, max: 0 }]

    if (range <= 0) return filters

    // 가격 범위를 4등분하여 필터 생성
    const step = Math.ceil(range / 4 / 1000) * 1000 // 1000원 단위로 반올림
    const formatLabel = (price: number) => {
      if (price >= 10000) return `${(price / 10000).toFixed(price % 10000 === 0 ? 0 : 1)}만원`
      return `${price.toLocaleString()}원`
    }

    let currentMin = Math.floor(min / 1000) * 1000
    for (let i = 0; i < 4; i++) {
      const rangeMin = currentMin
      const rangeMax = i === 3 ? max : currentMin + step

      if (rangeMin < max) {
        if (i === 0 && rangeMin === 0) {
          filters.push({
            value: `range-${i}`,
            label: `${formatLabel(rangeMax)} 이하`,
            min: 0,
            max: rangeMax,
          })
        } else if (i === 3) {
          filters.push({
            value: `range-${i}`,
            label: `${formatLabel(rangeMin)} 이상`,
            min: rangeMin,
            max: 0,
          })
        } else {
          filters.push({
            value: `range-${i}`,
            label: `${formatLabel(rangeMin)} ~ ${formatLabel(rangeMax)}`,
            min: rangeMin,
            max: rangeMax,
          })
        }
      }
      currentMin = rangeMax
    }

    return filters
  }

  const priceFilters = generatePriceFilters()

  useEffect(() => {
    loadProducts()
  }, [bandId, sort, currentPage, selectedPriceFilter])

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const queryParams = new URLSearchParams()
      queryParams.set('page', currentPage.toString())
      queryParams.set('sort', sort)

      const selectedFilter = priceFilters.find(f => f.value === selectedPriceFilter)
      if (selectedFilter && selectedFilter.min > 0) queryParams.set('minPrice', selectedFilter.min.toString())
      if (selectedFilter && selectedFilter.max > 0) queryParams.set('maxPrice', selectedFilter.max.toString())

      const response = await fetch(`/api/shop/bands/${bandId}?${queryParams.toString()}`)
      const data = await response.json()

      if (data.success) {
        setBand(data.band)
        setProducts(data.products)
        setPriceRange(data.priceRange)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePriceFilterSelect = (filterValue: string) => {
    setSelectedPriceFilter(filterValue)
    setCurrentPage(1)
    setIsMobileFilterOpen(false)
  }

  const handleAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!product.productPublishId) {
      alert('상품 정보가 올바르지 않습니다. 상품 상세페이지에서 추가해주세요.')
      return
    }

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productPublishId: product.productPublishId,
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
      } else {
        alert(`장바구니 추가 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('장바구니 추가 오류:', error)
      alert('장바구니 추가 중 오류가 발생했습니다.')
    }
  }

  const formatPrice = (price: number) => price.toLocaleString()

  // 필터 사이드바 컴포넌트
  const FilterSidebar = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`${isMobile ? '' : 'sticky top-4'}`}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">가격대</h3>
          {isMobile && (
            <button onClick={() => setIsMobileFilterOpen(false)}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* 가격 필터 버튼 */}
        <div className="space-y-2">
          {priceFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => handlePriceFilterSelect(filter.value)}
              className={`w-full py-2.5 px-3 text-left text-sm rounded-lg transition-colors ${
                selectedPriceFilter === filter.value
                  ? 'bg-[#FF6B6B] text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 헤더 */}
      {band && (
        <div className="kurly-container py-4">
          <div
            className="relative h-40 bg-gradient-to-r overflow-hidden rounded-xl"
            style={{
              backgroundImage: band.coverUrl ? `url(${band.coverUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: band.coverUrl ? undefined : '#FFF0F0',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/30" />
            <div className="relative h-full px-6 flex items-center">
              <Link
                href="/main"
                className="absolute top-4 left-4 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">돌아가기</span>
              </Link>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center border-2 border-[#FF6B6B]">
                  <Store className="w-8 h-8 text-[#FF6B6B]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{band.name}</h1>
                  <p className="text-sm text-white/80">{pagination.total}개 상품</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div className="kurly-container py-6">
        <div className="flex gap-6">
          {/* 왼쪽 필터 (데스크탑) */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <FilterSidebar />
          </div>

          {/* 오른쪽 상품 목록 */}
          <div className="flex-1">
            {/* 정렬 및 필터 버튼 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {/* 모바일 필터 버튼 */}
                <button
                  onClick={() => setIsMobileFilterOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  필터
                </button>

                <span className="text-sm text-gray-500">
                  총 {pagination.total}개 상품
                </span>
              </div>

              {/* 정렬 */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-gray-400" />
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 상품 그리드 */}
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B]"></div>
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.map((product) => (
                    <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                      <Link href={`/store/product/${product.id}?bandId=${bandId}`} className="block group">
                        <div className="relative aspect-square overflow-hidden bg-gray-100">
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
                        <div className="p-3">
                          <h4 className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[40px]">
                            {product.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-2">
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
                            <p className="text-xs text-gray-400 line-through mt-1">
                              {formatPrice(product.originalPrice)}원
                            </p>
                          )}
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>

                {/* 페이지네이션 */}
                {pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      이전
                    </button>
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                      .filter((p) => Math.abs(p - currentPage) <= 2 || p === 1 || p === pagination.totalPages)
                      .map((page, idx, arr) => (
                        <span key={page}>
                          {idx > 0 && arr[idx - 1] !== page - 1 && (
                            <span className="px-2 text-gray-400">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`px-4 py-2 rounded-lg text-sm ${
                              currentPage === page
                                ? 'bg-[#FF6B6B] text-white'
                                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        </span>
                      ))}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={currentPage === pagination.totalPages}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Store className="w-12 h-12 mb-4 text-gray-300" />
                <p>상품이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 모바일 필터 모달 */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 lg:hidden">
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white overflow-y-auto">
            <div className="p-4">
              <FilterSidebar isMobile />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
