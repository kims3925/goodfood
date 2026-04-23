'use client'

import { CheckCircle, Clock, Package } from 'lucide-react'

export interface DigestProductItem {
  id: number
  name: string
  price: number | null
  thumbnailUrl: string | null
  images: { url: string; sortOrder: number }[]
  createdAt?: string | null
  lastDigestPublishedAt?: string | null
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

interface Props {
  products: DigestProductItem[]
  selectedIds: number[]
  onToggle: (id: number) => void
  onSelectAll: (ids: number[]) => void
  maxProducts?: number
}

export default function DigestProductList({ products, selectedIds, onToggle, onSelectAll, maxProducts = 20 }: Props) {
  const allVisibleIds = products.map((p) => p.id)
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id))

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectAll([])
    } else {
      onSelectAll(allVisibleIds.slice(0, maxProducts))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          상품 선택 <span className="text-gray-500">({products.length}개 / 최대 {maxProducts})</span>
        </h3>
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          {allSelected ? '전체 해제' : `상위 ${maxProducts}개 선택`}
        </button>
      </div>

      {products.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500 border border-dashed rounded-lg">
          해당 카테고리의 발행 가능 상품이 없습니다.
        </div>
      )}

      <ul className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {products.map((product) => {
          const orderIdx = selectedIds.indexOf(product.id)
          const isSelected = orderIdx !== -1
          const thumb = product.thumbnailUrl || product.images?.[0]?.url || null
          return (
            <li key={product.id}>
              <label
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(product.id)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                />
                {isSelected && (
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center flex-shrink-0">
                    {orderIdx + 1}
                  </span>
                )}
                <div className="w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package size={20} className="text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={product.name}>
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {product.price ? `${product.price.toLocaleString()}원~` : '가격 미설정'}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    <span className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                      이미지 {product.images?.length || 0}장
                    </span>
                    {product.createdAt && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600" title="소싱 등록일">
                        <Clock size={10} />
                        {formatShortDate(product.createdAt)}
                      </span>
                    )}
                    {product.lastDigestPublishedAt && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700" title="마지막 종합발행 시각">
                        <CheckCircle size={10} />
                        종합발행 {formatShortDate(product.lastDigestPublishedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
