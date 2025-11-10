'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Package, Search, Edit3, Trash2, Plus, Eye, DollarSign, Calendar, Tag, Download, ChevronLeft, ChevronRight, CheckCircle, Share2, Settings, X } from 'lucide-react'

interface Product {
  id: string
  title: string
  originalPrice: number
  salePrice: number
  description: string
  status: string
  sourceType?: string | null
  sourceId?: string | null
  createdAt: string
  updatedAt: string

  // AI 분석 결과 및 추가 정보
  images?: string
  hookingTitle?: string | null
  hookingContent?: string | null
  detailedContent?: string | null
  productCategory?: string | null

  // 가격 관련 정보
  shippingFee?: number | null
  priceInfo?: string | null

  // 특이사항 및 메타데이터
  specialNotes?: string | null
  hasDeadline?: boolean
  deadlineInfo?: string | null
  isAvailable?: boolean
  unavailableReason?: string | null

  // 소싱 정보
  wholesaleBandName?: string | null
  author?: string | null
  originalCreatedAt?: string | null

  // 쇼핑몰 등록 상태
  isRegisteredToShop?: boolean

  // 소매밴드 등록 상태
  isRegisteredToRetail?: boolean
}

export default function RetailPublishPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedRetailBands, setSelectedRetailBands] = useState<string[]>([])
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showBandSelector, setShowBandSelector] = useState(false)
  const [bandApiSettings, setBandApiSettings] = useState({
    clientId: '',
    clientSecret: '',
    accessToken: ''
  })
  const [retailBands, setRetailBands] = useState<any[]>([])
  const [bandSearchTerm, setBandSearchTerm] = useState('')
  const [isSearchingBands, setIsSearchingBands] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const itemsPerPage = 10

  useEffect(() => {
    loadProducts()
    loadRetailBands()
  }, [])

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/products')
      const data = await response.json()

      if (data.success) {
        // 쇼핑몰에 등록된 상품들만 필터링 (소매밴드 등록 대상)
        const shopProducts = data.products.filter((product: Product) =>
          product.status === 'ACTIVE' || product.isRegisteredToShop
        )
        setProducts(shopProducts)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadRetailBands = async () => {
    try {
      const response = await fetch('/api/retail/bands')
      const data = await response.json()

      if (data.success) {
        setRetailBands(data.bands || [])
      }
    } catch (error) {
      console.error('Failed to load retail bands:', error)
    }
  }

  // 필터링된 상품 목록
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.hookingTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === 'all' ||
                          (statusFilter === 'registered' && product.isRegisteredToRetail) ||
                          (statusFilter === 'pending' && !product.isRegisteredToRetail)

      const matchesCategory = categoryFilter === 'all' || product.productCategory === categoryFilter

      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [products, searchTerm, statusFilter, categoryFilter])

  // 페이지네이션
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage)

  const handleSelectProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const handleSelectAll = () => {
    if (selectedProducts.length === paginatedProducts.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(paginatedProducts.map(p => p.id))
    }
  }

  const handlePublishToRetail = async () => {
    if (selectedProducts.length === 0) {
      alert('소매밴드에 등록할 상품을 선택해주세요.')
      return
    }

    if (selectedRetailBands.length === 0) {
      alert('등록할 소매밴드를 선택해주세요.')
      setShowBandSelector(true)
      return
    }

    if (!confirm(`선택한 ${selectedProducts.length}개 상품을 ${selectedRetailBands.length}개 소매밴드에 발행하시겠습니까?`)) {
      return
    }

    try {
      setIsPublishing(true)

      const response = await fetch('/api/retail/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds: selectedProducts,
          retailBandIds: selectedRetailBands,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message || `${data.stats.successCount}건의 게시물이 발행되었습니다.`)
        setSelectedProducts([])
        setSelectedRetailBands([])
        setShowBandSelector(false)
        loadProducts()
      } else {
        alert('소매밴드 등록에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to publish to retail:', error)
      alert('소매밴드 등록 중 오류가 발생했습니다.')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleSelectRetailBand = (bandId: string) => {
    setSelectedRetailBands(prev =>
      prev.includes(bandId)
        ? prev.filter(id => id !== bandId)
        : [...prev, bandId]
    )
  }

  const handleSelectAllRetailBands = () => {
    if (selectedRetailBands.length === retailBands.filter(b => b.isActive).length) {
      setSelectedRetailBands([])
    } else {
      setSelectedRetailBands(retailBands.filter(b => b.isActive).map(b => b.id))
    }
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString() + '원'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  const getStatusBadge = (product: Product) => {
    if (product.isRegisteredToRetail) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">소매밴드 등록됨</span>
    }
    return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">등록 대기</span>
  }

  const getShopUrl = (productId: string) => {
    return `${window.location.origin}/store/product/${productId}`
  }

  // 밴드 API 설정 저장
  const handleSaveBandApiSettings = async () => {
    try {
      const response = await fetch('/api/band/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bandApiSettings),
      })

      const data = await response.json()
      if (data.success) {
        alert('밴드 API 설정이 저장되었습니다.')
      } else {
        alert('설정 저장에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to save band API settings:', error)
      alert('설정 저장 중 오류가 발생했습니다.')
    }
  }

  // 내 관리하는 밴드 검색
  const handleSearchMyBands = async () => {
    if (!bandApiSettings.accessToken) {
      alert('먼저 밴드 API 설정을 완료해주세요.')
      return
    }

    try {
      setIsSearchingBands(true)
      const response = await fetch('/api/band/my-bands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: bandApiSettings.accessToken,
          searchTerm: bandSearchTerm
        }),
      })

      const data = await response.json()
      if (data.success) {
        setRetailBands(data.bands || [])
      } else {
        alert('밴드 검색에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to search bands:', error)
      alert('밴드 검색 중 오류가 발생했습니다.')
    } finally {
      setIsSearchingBands(false)
    }
  }

  // 소매밴드 추가
  const handleAddRetailBand = async (band: any) => {
    try {
      const response = await fetch('/api/retail/bands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bandKey: band.band_key,
          bandName: band.name,
          description: band.description,
          memberCount: band.member_count
        }),
      })

      const data = await response.json()
      if (data.success) {
        alert(`"${band.name}" 밴드가 소매밴드로 추가되었습니다.`)
        // 추가된 밴드를 목록에서 제거
        setRetailBands(prev => prev.filter(b => b.band_key !== band.band_key))
      } else {
        alert('소매밴드 추가에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to add retail band:', error)
      alert('소매밴드 추가 중 오류가 발생했습니다.')
    }
  }

  // 선택된 상품들을 삭제하는 함수
  const handleDeleteSelectedProducts = async () => {
    if (selectedProducts.length === 0) {
      alert('삭제할 상품을 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${selectedProducts.length}개의 상품을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      setIsDeleting(true)

      const response = await fetch('/api/products/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds: selectedProducts
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message || `${selectedProducts.length}개 상품이 삭제되었습니다.`)
        setSelectedProducts([])
        loadProducts()
      } else {
        alert('상품 삭제에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to delete products:', error)
      alert('상품 삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">소매밴드 포스팅</h1>
          <p className="text-gray-600">쇼핑몰에 등록된 상품을 소매밴드에 게시합니다.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/settings/retail"
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            환경설정
          </Link>
          {selectedProducts.length > 0 && (
            <>
              <button
                onClick={() => setShowBandSelector(!showBandSelector)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  selectedRetailBands.length > 0
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Package className="w-4 h-4" />
                {selectedRetailBands.length > 0
                  ? `밴드 선택됨 (${selectedRetailBands.length})`
                  : '밴드 선택'}
              </button>
              <button
                onClick={handlePublishToRetail}
                disabled={isPublishing || selectedRetailBands.length === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                {isPublishing ? '등록 중...' : `소매밴드 발행 (${selectedProducts.length})`}
              </button>
              <button
                onClick={handleDeleteSelectedProducts}
                disabled={isDeleting || selectedProducts.length === 0}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? '삭제 중...' : `선택 삭제 (${selectedProducts.length})`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 하위 메뉴 네비게이션 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <nav className="flex space-x-6">
          <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
            <Share2 className="w-4 h-4" />
            소매밴드 발행
          </div>
          <Link
            href="/retail/publish/manage"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Package className="w-4 h-4" />
            소매밴드 게시물 관리
          </Link>
        </nav>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="상품명, 제목, 설명 검색"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">등록 상태</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">전체</option>
              <option value="pending">등록 대기</option>
              <option value="registered">등록 완료</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">전체</option>
              <option value="수산물">수산물</option>
              <option value="축산물">축산물</option>
              <option value="농산물">농산물</option>
              <option value="가공품">가공품</option>
              <option value="기타">기타</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              총 {filteredProducts.length}개 상품
            </div>
          </div>
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === paginatedProducts.length && paginatedProducts.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-900">상품 정보</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-900">카테고리</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-900">가격</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-900">상태</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-900">등록일</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-900">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedProducts.map((product) => {
                const images = product.images ? JSON.parse(product.images) : []
                const firstImage = images[0] || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAxNkMyMC42ODYzIDE2IDE4IDE4LjY4NjMgMTggMjJDMTggMjUuMzEzNyAyMC42ODYzIDI4IDI0IDI4QzI3LjMxMzcgMjggMzAgMjUuMzEzNyAzMCAyMkMzMCAxOC42ODYzIDI3LjMxMzcgMTYgMjQgMTZaIiBmaWxsPSIjOUM4NEZGIi8+CjxwYXRoIGQ9Ik0xNSAzM0wxOCAzMEwyNCAzNkwzMCAzMEwzMyAzM1YzNkgxNVYzM1oiIGZpbGw9IiM5Qzg0RkYiLz4KPHN2Zz4K'

                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <img
                          src={firstImage}
                          alt={product.title}
                          className="w-12 h-12 object-cover rounded"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAxNkMyMC42ODYzIDE2IDE4IDE4LjY4NjMgMTggMjJDMTggMjUuMzEzNyAyMC42ODYzIDI4IDI0IDI4QzI3LjMxMzcgMjggMzAgMjUuMzEzNyAzMCAyMkMzMCAxOC42ODYzIDI3LjMxMzcgMTYgMjQgMTZaIiBmaWxsPSIjOUM4NEZGIi8+CjxwYXRoIGQ9Ik0xNSAzM0wxOCAzMEwyNCAzNkwzMCAzMEwzMyAzM1YzNkgxNVYzM1oiIGZpbGw9IiM5Qzg0RkYiLz4KPHN2Zz4K'
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                            {product.hookingTitle || product.title}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {product.wholesaleBandName && `출처: ${product.wholesaleBandName}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        {product.productCategory || '미분류'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{formatPrice(product.salePrice)}</div>
                        {product.originalPrice !== product.salePrice && (
                          <div className="text-xs text-gray-500 line-through">{formatPrice(product.originalPrice)}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(product)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(product.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setViewingProduct(product)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        상세보기
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              총 {filteredProducts.length}개 중 {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredProducts.length)}개 표시
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 상품 상세보기 모달 */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">상품 상세보기</h2>
              <button
                onClick={() => setViewingProduct(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 왼쪽: 상품 이미지 */}
                <div>
                  {viewingProduct.images && (() => {
                    const images = JSON.parse(viewingProduct.images)
                    return images.length > 0 ? (
                      <div className="space-y-3">
                        <img
                          src={images[0]}
                          alt={viewingProduct.title}
                          className="w-full h-64 object-cover rounded-lg"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAxNkMyMC42ODYzIDE2IDE4IDE4LjY4NjMgMTggMjJDMTggMjUuMzEzNyAyMC42ODYzIDI4IDI0IDI4QzI3LjMxMzcgMjggMzAgMjUuMzEzNyAzMCAyMkMzMCAxOC42ODYzIDI3LjMxMzcgMTYgMjQgMTZaIiBmaWxsPSIjOUM4NEZGIi8+CjxwYXRoIGQ9Ik0xNSAzM0wxOCAzMEwyNCAzNkwzMCAzMEwzMyAzM1YzNkgxNVYzM1oiIGZpbGw9IiM5Qzg0RkYiLz4KPHN2Zz4K'
                          }}
                        />
                        {images.length > 1 && (
                          <div className="grid grid-cols-4 gap-2">
                            {images.slice(1, 5).map((img: string, idx: number) => (
                              <img
                                key={idx}
                                src={img}
                                alt={`${viewingProduct.title} ${idx + 2}`}
                                className="w-full h-16 object-cover rounded"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAxNkMyMC42ODYzIDE2IDE4IDE4LjY4NjMgMTggMjJDMTggMjUuMzEzNyAyMC42ODYzIDI4IDI0IDI4QzI3LjMxMzcgMjggMzAgMjUuMzEzNyAzMCAyMkMzMCAxOC42ODYzIDI3LjMxMzcgMTYgMjQgMTZaIiBmaWxsPSIjOUM4NEZGIi8+CjxwYXRoIGQ9Ik0xNSAzM0wxOCAzMEwyNCAzNkwzMCAzMEwzMyAzM1YzNkgxNVYzM1oiIGZpbGw9IiM5Qzg0RkYiLz4KPHN2Zz4K'
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-gray-400">이미지 없음</span>
                      </div>
                    )
                  })()}
                </div>

                {/* 오른쪽: 상품 정보 */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {viewingProduct.hookingTitle || viewingProduct.title}
                    </h3>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        {viewingProduct.productCategory || '미분류'}
                      </span>
                      {getStatusBadge(viewingProduct)}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">가격 정보</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">판매가:</span>
                        <span className="font-semibold text-lg">{formatPrice(viewingProduct.salePrice)}</span>
                      </div>
                      {viewingProduct.originalPrice !== viewingProduct.salePrice && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">원가:</span>
                          <span className="text-gray-500 line-through">{formatPrice(viewingProduct.originalPrice)}</span>
                        </div>
                      )}
                      {viewingProduct.shippingFee && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">배송비:</span>
                          <span>{formatPrice(viewingProduct.shippingFee)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {viewingProduct.hookingContent && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="font-medium text-gray-900 mb-2">후킹 내용</h4>
                      <p className="text-gray-700 whitespace-pre-wrap">{viewingProduct.hookingContent}</p>
                    </div>
                  )}

                  {viewingProduct.detailedContent && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="font-medium text-gray-900 mb-2">상품 상세 정보</h4>
                      <p className="text-gray-700 whitespace-pre-wrap">{viewingProduct.detailedContent}</p>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">쇼핑몰/소매밴드 최종 게시 내용</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <p className="font-medium">{viewingProduct.hookingTitle || viewingProduct.title}</p>
                      {viewingProduct.hookingContent && (
                        <p className="text-gray-700">{viewingProduct.hookingContent}</p>
                      )}
                      <div className="text-lg font-bold text-blue-600">
                        {formatPrice(viewingProduct.salePrice)}
                      </div>
                      <div className="mt-3 p-2 bg-blue-50 rounded border-l-4 border-blue-400">
                        <p className="text-sm text-blue-800 font-medium">🛒 쇼핑몰 링크</p>
                        <p className="text-sm text-blue-600 break-all">
                          {getShopUrl(viewingProduct.id)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {(viewingProduct.wholesaleBandName || viewingProduct.author) && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="font-medium text-gray-900 mb-2">소싱 정보</h4>
                      <div className="space-y-1 text-sm">
                        {viewingProduct.wholesaleBandName && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">출처:</span>
                            <span>{viewingProduct.wholesaleBandName}</span>
                          </div>
                        )}
                        {viewingProduct.author && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">작성자:</span>
                            <span>{viewingProduct.author}</span>
                          </div>
                        )}
                        {viewingProduct.originalCreatedAt && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">원본 게시일:</span>
                            <span>{formatDate(viewingProduct.originalCreatedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setViewingProduct(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  닫기
                </button>
                {!viewingProduct.isRegisteredToRetail && (
                  <button
                    onClick={() => {
                      setSelectedProducts([viewingProduct.id])
                      setViewingProduct(null)
                      handlePublishToRetail()
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    소매밴드등록
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 환경설정 모달 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">환경설정</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* 밴드 API 설정 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">밴드 API</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={bandApiSettings.clientId}
                      onChange={(e) => setBandApiSettings(prev => ({ ...prev, clientId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="밴드 API Client ID를 입력하세요"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      value={bandApiSettings.clientSecret}
                      onChange={(e) => setBandApiSettings(prev => ({ ...prev, clientSecret: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="밴드 API Client Secret을 입력하세요"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Access Token
                    </label>
                    <input
                      type="password"
                      value={bandApiSettings.accessToken}
                      onChange={(e) => setBandApiSettings(prev => ({ ...prev, accessToken: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="밴드 API Access Token을 입력하세요"
                    />
                  </div>
                  <button
                    onClick={handleSaveBandApiSettings}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    밴드 API 설정 저장
                  </button>
                </div>
              </div>

              {/* 소매밴드 설정 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">소매밴드 설정</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={bandSearchTerm}
                      onChange={(e) => setBandSearchTerm(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="내가 관리하는 밴드명으로 검색"
                    />
                    <button
                      onClick={handleSearchMyBands}
                      disabled={isSearchingBands || !bandApiSettings.accessToken}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSearchingBands ? '검색 중...' : '밴드 검색'}
                    </button>
                  </div>

                  {!bandApiSettings.accessToken && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 text-sm">
                        밴드 검색을 위해서는 먼저 밴드 API 설정을 완료해주세요.
                      </p>
                    </div>
                  )}

                  {/* 검색된 밴드 목록 */}
                  {retailBands.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">검색된 밴드 목록</h4>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {retailBands.map((band) => (
                          <div key={band.band_key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900">{band.name}</h5>
                              <p className="text-sm text-gray-600">{band.description}</p>
                              <p className="text-xs text-gray-500">멤버 수: {band.member_count?.toLocaleString() || 'N/A'}명</p>
                            </div>
                            <button
                              onClick={() => handleAddRetailBand(band)}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                            >
                              추가
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isSearchingBands && (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                      <span className="ml-2 text-gray-600">밴드 검색 중...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 소매밴드 선택 모달 */}
      {showBandSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">소매밴드 선택</h2>
              <button
                onClick={() => setShowBandSelector(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {retailBands.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 mb-2">등록된 소매밴드가 없습니다</p>
                  <p className="text-sm text-gray-500 mb-4">환경설정에서 소매밴드를 먼저 등록해주세요</p>
                  <Link
                    href="/admin/settings/retail"
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    소매밴드 등록하기
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      발행할 소매밴드를 선택하세요 ({selectedRetailBands.length}/{retailBands.filter(b => b.isActive).length}개 선택됨)
                    </p>
                    <button
                      onClick={handleSelectAllRetailBands}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {selectedRetailBands.length === retailBands.filter(b => b.isActive).length ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {retailBands.map((band) => (
                      <div
                        key={band.id}
                        onClick={() => band.isActive && handleSelectRetailBand(band.id)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedRetailBands.includes(band.id)
                            ? 'border-blue-500 bg-blue-50'
                            : band.isActive
                            ? 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                            : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900">{band.bandName}</h3>
                              {selectedRetailBands.includes(band.id) && (
                                <CheckCircle className="w-5 h-5 text-blue-600" />
                              )}
                              {!band.isActive && (
                                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">비활성</span>
                              )}
                            </div>
                            {band.description && (
                              <p className="text-sm text-gray-600 mb-1">{band.description}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              멤버 수: {band.memberCount?.toLocaleString() || '0'}명
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowBandSelector(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => setShowBandSelector(false)}
                disabled={selectedRetailBands.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                선택 완료 ({selectedRetailBands.length}개)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}