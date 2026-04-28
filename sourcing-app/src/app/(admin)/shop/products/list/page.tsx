'use client'

/**
 * /shop/products/list — 쇼핑몰에 발행된 상품 관리 페이지
 *
 * 기능:
 *  - 쇼핑몰별 필터 (전체 / 특정 쇼핑몰)
 *  - 상품 검색 (이름/설명)
 *  - 변형상품 가격(마진조정가 / 배송비 / 판매가) 한 번에 조회
 *  - 행별 [편집] 버튼 → /sourcing/product/detail/[id] 로 이동 (기존 편집 UI 재사용)
 *  - 행별 [쇼핑몰에서 제거] 버튼 → DELETE /api/shop/publish?productId=X&type=shop
 *  - 다중선택 → 일괄 제거
 *
 * 편집은 기존 product detail 페이지 재사용 (이미 모든 필드 편집 가능):
 *  - 상품명, 설명, 도매가, 판매가, 옵션, 변형상품, 배송비, 카테고리 등
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Search, Package, ExternalLink, Trash2, Edit3, Filter, RefreshCw } from 'lucide-react'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

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

export default function ShopProductsListPage() {
  const toast = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [filterShopId, setFilterShopId] = useState<number | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ ids: number[]; isBulk: boolean } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  // 발행된 상품 로드
  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ publishStatus: 'published', limit: '500', page: '1' })
      const res = await fetch(`/api/product?${params}`)
      const data = await res.json()
      if (data.success) {
        // 응답에서 shopProducts 가 직접 안 올 수 있어 별도 조회 필요할 수도. 일단 그대로.
        let raw = (data.data || []) as any[]
        // 쇼핑몰에 발행된 항목만 필터 (shopProducts.length > 0)
        raw = raw.filter((p) => Array.isArray(p.shopProducts) && p.shopProducts.length > 0)
        if (filterShopId !== 'all') {
          raw = raw.filter((p) => p.shopProducts.some((sp: any) => sp.shopId === filterShopId))
        }
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase()
          raw = raw.filter(
            (p) => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
          )
        }
        setProducts(raw as Product[])
      } else {
        setProducts([])
      }
    } catch (e) {
      console.error('상품 조회 실패:', e)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [filterShopId, searchTerm])

  useEffect(() => {
    loadShops()
  }, [loadShops])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

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
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
    }
  }

  const totalCount = useMemo(() => products.length, [products])

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">상품 관리</h1>
          <span className="text-sm text-slate-500">쇼핑몰 발행 상품 편집/삭제</span>
        </div>
        <button
          onClick={loadProducts}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
        >
          <RefreshCw size={14} /> 새로고침
        </button>
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
                      checked={selectedIds.size > 0 && selectedIds.size === products.length}
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
                {products.map((p) => {
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
