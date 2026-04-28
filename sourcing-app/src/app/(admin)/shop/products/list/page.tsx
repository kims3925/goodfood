'use client'

/**
 * /shop/products/list — 쇼핑몰 상품 관리 (카테고리별 + 쇼핑몰별 필터)
 *
 * 기능:
 *  - 카테고리 탭 (SEA/AGR/MEA/MKT/PRC/HLT/ETC + 전체)
 *  - 쇼핑몰별 필터
 *  - 검색 (이름/설명)
 *  - 페이지 사이즈 (20/50/100)
 *  - 편집(/sourcing/product/detail/[id]) / 쇼핑몰 보기 / 쇼핑몰 제거 / 일괄 제거
 *
 * 옛 메뉴 두 개("상품 관리" + "카테고리")를 통합. 카테고리 탭이 페이지 안에서
 * 동작하므로 별도 카테고리 페이지 불필요.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Search, Package, ExternalLink, Trash2, Edit3, Filter, RefreshCw } from 'lucide-react'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import { CATEGORY_LIST, type CategoryCode } from '@/modules/category/category.keywords'

interface Variant {
  id: number
  optionSummary: string | null
  wholesalePrice: number | null
  price: number | null
}

interface ShopRef {
  id: number
  name: string
  subdomain: string | null
}

interface Product {
  id: number
  name: string
  description?: string | null
  categoryId?: string | null
  thumbnailUrl: string | null
  shippingFee: number | null
  bundleShippingType: 'NONE' | 'INCLUDED' | 'SEPARATE' | null
  createdAt: string
  variants: Variant[]
  shopProducts: Array<{
    id: number
    shopId: number
    publishedAt: string | null
    shop: ShopRef
  }>
}

interface Shop {
  id: number
  name: string
  subdomain: string | null
}

type PageSize = 20 | 50 | 100
type CategoryFilter = 'all' | CategoryCode

export default function ShopProductsListPage() {
  const toast = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [filterShopId, setFilterShopId] = useState<number | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ ids: number[]; isBulk: boolean } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // 페이지 사이즈 + 현재 페이지
  const [pageSize, setPageSize] = useState<PageSize>(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  // 카테고리별 카운트 (탭 옆에 N개 표시용)
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})

  // 쇼핑몰 목록 로드
  const loadShops = useCallback(async () => {
    try {
      const res = await fetch('/api/shop?isActive=true&limit=100')
      const data = await res.json()
      if (data.success) setShops(data.data || [])
    } catch (e) {
      console.error('쇼핑몰 조회 실패:', e)
    }
  }, [])

  // 모든 상품 로드 (publishStatus 무필터) — 카테고리/쇼핑몰/검색은 클라이언트에서 필터
  // 카테고리 페이지에 보이던 상품 + 쇼핑몰 발행 상품 모두 포함.
  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '2000', page: '1' })
      const res = await fetch(`/api/product?${params}`)
      const data = await res.json()
      if (data.success) {
        let raw = (data.data || []) as any[]

        // 카테고리별 카운트 (전체 기준 — 검색/쇼핑몰 필터 적용 전)
        const counts: Record<string, number> = { all: raw.length }
        for (const c of CATEGORY_LIST) counts[c.code] = 0
        for (const p of raw) {
          const code = p.categoryId
          if (code && counts[code] !== undefined) counts[code]++
        }
        setCategoryCounts(counts)

        // 카테고리 필터
        if (filterCategory !== 'all') {
          raw = raw.filter((p) => p.categoryId === filterCategory)
        }
        // 쇼핑몰 필터 — 'all' 이면 모든 상품, 특정 쇼핑몰 선택 시 그 쇼핑몰에 발행된 것만
        if (filterShopId !== 'all') {
          raw = raw.filter(
            (p) => Array.isArray(p.shopProducts) && p.shopProducts.some((sp: any) => sp.shopId === filterShopId)
          )
        }
        // 검색
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase()
          raw = raw.filter(
            (p) => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
          )
        }
        setTotalCount(raw.length)
        setProducts(raw as Product[])
      } else {
        setProducts([])
        setTotalCount(0)
      }
    } catch (e) {
      console.error('상품 조회 실패:', e)
      setProducts([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [filterShopId, filterCategory, searchTerm])

  useEffect(() => {
    loadShops()
  }, [loadShops])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // 필터/검색/페이지 사이즈 변경 시 1페이지로
  useEffect(() => {
    setCurrentPage(1)
  }, [filterShopId, filterCategory, searchTerm, pageSize])

  // 클라이언트 측 페이지네이션 — products 는 필터된 전체, 화면엔 page 단위만 표시
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize))
  const paginatedProducts = useMemo(
    () => products.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [products, currentPage, pageSize]
  )

  // 변형상품 첫 행 가격 표시용 (대표 가격)
  const firstVariantPrice = (p: Product) => {
    const v = p.variants?.[0]
    if (!v) return null
    const ship =
      p.bundleShippingType === 'INCLUDED' ? 0 : p.shippingFee || 0
    const final = (v.price || 0) + ship
    return { wholesale: v.wholesalePrice, margin: v.price, ship, final }
  }

  const formatPrice = (n: number | null | undefined) =>
    n == null ? '-' : '₩' + n.toLocaleString()

  // 일괄 제거 확인 모달
  const requestBulkDelete = () => {
    if (selectedIds.size === 0) {
      toast.error('상품을 선택해주세요.')
      return
    }
    setDeleteTarget({ ids: Array.from(selectedIds), isBulk: true })
    setShowDeleteConfirm(true)
  }

  // 단일 제거 확인 모달
  const requestSingleDelete = (productId: number) => {
    setDeleteTarget({ ids: [productId], isBulk: false })
    setShowDeleteConfirm(true)
  }

  // 실제 삭제 실행 — 쇼핑몰에서만 제거 (Product 자체는 유지, 다른 쇼핑몰/밴드 발행은 그대로)
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    let success = 0
    let fail = 0
    for (const productId of deleteTarget.ids) {
      try {
        const res = await fetch(`/api/shop/publish?productId=${productId}&type=shop`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (data.success) success++
        else fail++
      } catch {
        fail++
      }
    }
    setIsDeleting(false)
    setShowDeleteConfirm(false)
    setDeleteTarget(null)
    setSelectedIds(new Set())
    if (success > 0) toast.success(`${success}건 쇼핑몰에서 제거 완료`)
    if (fail > 0) toast.error(`${fail}건 제거 실패`)
    loadProducts()
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    // 현재 페이지 항목만 토글 — 보이는 것만 선택/해제
    const pageIds = paginatedProducts.map((p) => p.id)
    const allSelected = pageIds.every((id) => selectedIds.has(id)) && pageIds.length > 0
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of pageIds) next.delete(id)
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of pageIds) next.add(id)
        return next
      })
    }
  }

  // (totalCount 는 setTotalCount 로 직접 관리)

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">상품 관리</h1>
          <span className="text-sm text-slate-500">카테고리별 / 쇼핑몰별 조회 · 편집 · 삭제</span>
        </div>
        <button
          onClick={loadProducts}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
        >
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      {/* 카테고리 탭 */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filterCategory === 'all'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            전체 <span className="ml-1 opacity-70 text-xs">{categoryCounts['all'] || 0}</span>
          </button>
          {CATEGORY_LIST.map((c) => (
            <button
              key={c.code}
              onClick={() => setFilterCategory(c.code)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                filterCategory === c.code
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="mr-1">{c.emoji}</span>
              {c.name}
              <span className="ml-1 opacity-70 text-xs">{categoryCounts[c.code] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <span className="text-sm text-slate-600">쇼핑몰</span>
            <select
              value={filterShopId}
              onChange={(e) =>
                setFilterShopId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))
              }
              className="px-2 py-1.5 border border-slate-200 rounded-md text-sm"
            >
              <option value="all">전체</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 min-w-[240px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <Input
              type="text"
              placeholder="상품명/설명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <span className="text-sm text-slate-500">
            총 <strong className="text-slate-900">{totalCount}</strong>건
          </span>

          {/* 페이지 사이즈 선택 */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-slate-500 mr-1">페이지당</span>
            {([20, 50, 100] as PageSize[]).map((size) => (
              <button
                key={size}
                onClick={() => setPageSize(size)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  pageSize === size
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {size}개
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 다중 선택 액션 바 */}
      {selectedIds.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-amber-900">
            <strong>{selectedIds.size}개</strong> 상품 선택됨
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 rounded-md"
            >
              선택 해제
            </button>
            <button
              onClick={requestBulkDelete}
              className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center gap-1"
            >
              <Trash2 size={12} /> 일괄 쇼핑몰 제거
            </button>
          </div>
        </div>
      )}

      {/* 상품 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12">
            <Loading />
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Package size={48} className="mx-auto mb-3 opacity-30" />
            <p>쇼핑몰에 발행된 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="w-10 py-2 px-3">
                    <input
                      type="checkbox"
                      checked={
                        paginatedProducts.length > 0 &&
                        paginatedProducts.every((p) => selectedIds.has(p.id))
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left py-2 px-3 font-medium">상품명</th>
                  <th className="text-left py-2 px-3 font-medium">발행 쇼핑몰</th>
                  <th className="text-right py-2 px-3 font-medium w-24">도매원가</th>
                  <th className="text-right py-2 px-3 font-medium w-24">마진조정가</th>
                  <th className="text-right py-2 px-3 font-medium w-24">배송비</th>
                  <th className="text-right py-2 px-3 font-medium w-24">판매가</th>
                  <th className="text-center py-2 px-3 font-medium w-32">동작</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProducts.map((p) => {
                  const fv = firstVariantPrice(p)
                  const checked = selectedIds.has(p.id)
                  return (
                    <tr key={p.id} className={checked ? 'bg-blue-50/50' : 'hover:bg-slate-50'}>
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(p.id)}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Link
                          href={`/sourcing/product/detail/${p.id}`}
                          className="text-slate-900 hover:text-blue-600 font-medium line-clamp-1 max-w-[360px]"
                        >
                          {p.name}
                        </Link>
                        {p.variants.length > 1 && (
                          <span className="ml-2 text-xs text-slate-400">
                            +{p.variants.length - 1}옵션
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {p.shopProducts.map((sp) => (
                            <span
                              key={sp.id}
                              className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs"
                            >
                              {sp.shop.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500 tabular-nums">
                        {formatPrice(fv?.wholesale ?? null)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700 tabular-nums">
                        {formatPrice(fv?.margin ?? null)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500 tabular-nums">
                        {p.bundleShippingType === 'INCLUDED' ? (
                          <span className="text-emerald-600 text-xs">포함</span>
                        ) : fv && fv.ship > 0 ? (
                          `+${formatPrice(fv.ship)}`
                        ) : (
                          formatPrice(0)
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-blue-700 font-semibold tabular-nums">
                        {formatPrice(fv?.final ?? null)}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/sourcing/product/detail/${p.id}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
                            title="편집"
                          >
                            <Edit3 size={14} />
                          </Link>
                          {p.shopProducts[0]?.shop.subdomain && (
                            <a
                              href={`/${p.shopProducts[0].shop.subdomain}/product/${p.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md"
                              title="쇼핑몰에서 보기"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => requestSingleDelete(p.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                            title="쇼핑몰에서 제거"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                <span className="text-xs text-slate-500">
                  {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, products.length)} / {products.length}건
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ‹
                  </button>
                  <span className="px-3 text-xs text-slate-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setDeleteTarget(null)
        }}
        onConfirm={confirmDelete}
        title="쇼핑몰에서 제거"
        message={
          deleteTarget?.isBulk
            ? `선택한 ${deleteTarget.ids.length}개 상품을 쇼핑몰에서 제거하시겠습니까?\n\n` +
              `※ Product 자체는 유지됩니다. 다른 쇼핑몰/소매밴드 발행은 영향받지 않습니다.`
            : `이 상품을 쇼핑몰에서 제거하시겠습니까?\n\n` +
              `※ Product 자체는 유지됩니다. 다른 쇼핑몰/소매밴드 발행은 영향받지 않습니다.`
        }
        confirmText="쇼핑몰에서 제거"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
