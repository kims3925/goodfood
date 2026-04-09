'use client'

import { useState, useEffect, useCallback } from 'react'
import { Store, Loader2, ExternalLink, Search, Save, X, Edit2, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import Pagination from '@/components/ui/Pagination'
import ThumbnailImage from '@/components/ui/ThumbnailImage'

interface Shop {
  id: number
  name: string
  subdomain: string
  isActive: boolean
}

interface ProductVariant {
  id: number
  optionSummary: string | null
  price: number
  wholesalePrice: number | null
}

interface ShopProduct {
  id: number
  productId: number | null
  product: {
    id: number
    name: string
    description: string | null
    thumbnailUrl: string | null
    price: number | null
    wholesalePrice: number | null
    shippingFee: number | null
    bundleShippingType: string
    variants: ProductVariant[]
  } | null
  shop: {
    id: number
    name: string
  }
}

// 수정 중인 상품 데이터
interface EditingProduct {
  productId: number
  name: string
  price: string
  shippingFee: string
  variants: Array<{
    id: number
    optionSummary: string | null
    price: string
  }>
}

export default function MyShopPage() {
  const toast = useToast()
  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // 상품 목록
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  // 수정 상태
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingData, setEditingData] = useState<EditingProduct | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  // 쇼핑몰 목록 로드
  useEffect(() => {
    fetch('/api/shop')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.length > 0) {
          setShops(data.data)
          setSelectedShopId(data.data[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // 상품 목록 로드
  const fetchProducts = useCallback(async (page: number) => {
    if (!selectedShopId) return
    setIsLoadingProducts(true)
    try {
      const params = new URLSearchParams({
        shopId: selectedShopId.toString(),
        page: page.toString(),
        limit: itemsPerPage.toString(),
      })
      if (query) params.append('search', query)

      const res = await fetch(`/api/shop-product?${params}`)
      const data = await res.json()

      if (data.success) {
        setShopProducts(data.data)
        setTotalItems(data.pagination.total)
        setTotalPages(data.pagination.totalPages)
        setCurrentPage(page)
      }
    } catch {
      toast.error('상품 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoadingProducts(false)
    }
  }, [selectedShopId, query, itemsPerPage, toast])

  useEffect(() => {
    if (selectedShopId) {
      fetchProducts(1)
    }
  }, [fetchProducts, selectedShopId])

  // 검색 핸들러
  const handleSearch = () => {
    setQuery(searchTerm)
    setCurrentPage(1)
  }

  // 수정 시작
  const startEdit = (sp: ShopProduct) => {
    if (!sp.product) return
    setEditingId(sp.product.id)
    setEditingData({
      productId: sp.product.id,
      name: sp.product.name,
      price: sp.product.price?.toString() || '',
      shippingFee: sp.product.shippingFee?.toString() || '',
      variants: sp.product.variants.map(v => ({
        id: v.id,
        optionSummary: v.optionSummary,
        price: v.price.toString(),
      })),
    })
    // 자동으로 variant 영역 확장
    setExpandedIds(prev => new Set(prev).add(sp.product!.id))
  }

  // 수정 취소
  const cancelEdit = () => {
    setEditingId(null)
    setEditingData(null)
  }

  // 저장
  const saveEdit = async () => {
    if (!editingData) return
    setIsSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: editingData.name,
        price: editingData.price ? parseInt(editingData.price) : null,
        shippingFee: editingData.shippingFee ? parseInt(editingData.shippingFee) : null,
      }

      if (editingData.variants.length > 0) {
        body.variants = editingData.variants.map(v => ({
          id: v.id,
          price: parseInt(v.price) || 0,
        }))
      }

      const res = await fetch(`/api/product/${editingData.productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('상품이 수정되었습니다.')
        setEditingId(null)
        setEditingData(null)
        fetchProducts(currentPage)
      } else {
        toast.error(data.error || '상품 수정에 실패했습니다.')
      }
    } catch {
      toast.error('상품 수정 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  // variant 펼치기/접기
  const toggleExpand = (productId: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined) return '-'
    return `₩${price.toLocaleString()}`
  }

  const shopBaseUrl = process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'https://shop.abcpharm.net'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (shops.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <Store className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">등록된 쇼핑몰이 없습니다</h2>
        <p className="text-gray-500 mb-4">쇼핑몰 관리에서 쇼핑몰을 먼저 등록해주세요.</p>
        <a href="/shop/store/list" className="text-blue-600 hover:underline text-sm">
          쇼핑몰 관리로 이동 →
        </a>
      </div>
    )
  }

  const selectedShop = shops.find(s => s.id === selectedShopId)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">내 쇼핑몰</h1>
            <p className="text-gray-500 text-sm mt-1">진열 상품을 직접 수정할 수 있습니다.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* 쇼핑몰 선택 */}
            {shops.length > 1 && (
              <select
                value={selectedShopId || ''}
                onChange={e => { setSelectedShopId(Number(e.target.value)); setCurrentPage(1) }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {shops.map(shop => (
                  <option key={shop.id} value={shop.id}>{shop.name}</option>
                ))}
              </select>
            )}
            {selectedShop && (
              <a
                href={`${shopBaseUrl}/${selectedShop.subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink size={14} />
                쇼핑몰 보기
              </a>
            )}
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">진열 상품</p>
                <p className="text-xl font-bold text-gray-900">{totalItems}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Store size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">쇼핑몰</p>
                <p className="text-xl font-bold text-green-600">{selectedShop?.name || '-'}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${selectedShop?.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Store size={20} className={selectedShop?.isActive ? 'text-green-600' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-xs text-gray-500">상태</p>
                <p className={`text-xl font-bold ${selectedShop?.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                  {selectedShop?.isActive ? '운영중' : '비활성'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 검색 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="상품명으로 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              검색
            </button>
          </div>
        </div>

        {/* 상품 목록 */}
        {isLoadingProducts ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : shopProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">진열된 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shopProducts.map(sp => {
              if (!sp.product) return null
              const product = sp.product
              const isEditing = editingId === product.id
              const isExpanded = expandedIds.has(product.id)
              const hasVariants = product.variants.length > 0

              return (
                <div
                  key={sp.id}
                  className={`bg-white rounded-lg shadow-sm border transition-colors ${
                    isEditing ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'
                  }`}
                >
                  {/* 메인 행 */}
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* 썸네일 */}
                      <ThumbnailImage
                        src={product.thumbnailUrl}
                        alt={product.name}
                        size="md"
                        rounded="lg"
                        fallbackIcon="package"
                      />

                      {/* 상품 정보 */}
                      <div className="flex-1 min-w-0">
                        {isEditing && editingData ? (
                          /* 수정 모드 */
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">상품명</label>
                              <input
                                type="text"
                                value={editingData.name}
                                onChange={e => setEditingData({ ...editingData, name: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <label className="text-xs text-gray-500 mb-1 block">판매가</label>
                                <input
                                  type="number"
                                  value={editingData.price}
                                  onChange={e => setEditingData({ ...editingData, price: e.target.value })}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="0"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-xs text-gray-500 mb-1 block">배송비</label>
                                <input
                                  type="number"
                                  value={editingData.shippingFee}
                                  onChange={e => setEditingData({ ...editingData, shippingFee: e.target.value })}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* 읽기 모드 */
                          <div>
                            <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2">{product.name}</h3>
                            <div className="flex items-center gap-4 mt-1.5">
                              <span className="text-sm font-semibold text-gray-900">{formatPrice(product.price)}</span>
                              {product.shippingFee !== null && product.shippingFee !== undefined && (
                                <span className="text-xs text-gray-400">배송비 {formatPrice(product.shippingFee)}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={cancelEdit}
                              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                              title="취소"
                            >
                              <X size={18} />
                            </button>
                            <button
                              onClick={saveEdit}
                              disabled={isSaving}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Save size={14} />
                              {isSaving ? '저장중...' : '저장'}
                            </button>
                          </>
                        ) : (
                          <>
                            {hasVariants && (
                              <button
                                onClick={() => toggleExpand(product.id)}
                                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                title={isExpanded ? '옵션 접기' : '옵션 펼치기'}
                              >
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </button>
                            )}
                            <button
                              onClick={() => startEdit(sp)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                            >
                              <Edit2 size={14} />
                              수정
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Variant 영역 */}
                  {hasVariants && isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="text-xs text-gray-500 mb-2 font-medium">옵션별 가격</p>
                      <div className="space-y-1.5">
                        {isEditing && editingData ? (
                          editingData.variants.map((v, idx) => (
                            <div key={v.id} className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-gray-600 truncate flex-1">
                                {v.optionSummary || `옵션 ${idx + 1}`}
                              </span>
                              <input
                                type="number"
                                value={v.price}
                                onChange={e => {
                                  const newVariants = [...editingData.variants]
                                  newVariants[idx] = { ...newVariants[idx], price: e.target.value }
                                  setEditingData({ ...editingData, variants: newVariants })
                                }}
                                className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          ))
                        ) : (
                          product.variants.map((v, idx) => (
                            <div key={v.id} className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-gray-600 truncate flex-1">
                                {v.optionSummary || `옵션 ${idx + 1}`}
                              </span>
                              <span className="font-medium text-gray-900">{formatPrice(v.price)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={(page) => fetchProducts(page)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
