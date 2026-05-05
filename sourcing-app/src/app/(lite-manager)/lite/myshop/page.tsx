/**
 * Lite My Shop v2 — 자동 등록된 상품 관리
 * 어드민이 매일 자동 발행한 상품을 라이트 셀러가 활성/비활성으로 관리.
 * "직접 선택" 흐름은 폐기. 어드민 자동 발행만 운영.
 */
'use client'

import { useEffect, useState } from 'react'
import { Power, ExternalLink, RefreshCw, Calendar } from 'lucide-react'

interface ProductInfo {
  name: string
  description: string | null
  categoryId: string | null
  thumbnailUrl: string | null
  price: number | string | null
  shippingFee: number | null
}

interface ShopProductRow {
  id: number
  productId: number | null
  publishedAt: string | null
  active: boolean
  product: ProductInfo | null
}

interface ShopInfo {
  id: number
  name: string
  subdomain: string
}

interface ConfigInfo {
  publishHour: number
  publishMinute: number
  dailyCount: number
  isActive: boolean
}

interface LastLog {
  publishedAt: string
  count: number
  status: string
}

const CATEGORY_FILTERS = [
  { code: 'all', label: '전체', emoji: '📦' },
  { code: 'SEA', label: '수산', emoji: '🐟' },
  { code: 'AGR', label: '농산', emoji: '🥬' },
  { code: 'MEA', label: '축산', emoji: '🥩' },
  { code: 'MKT', label: '밀키트', emoji: '🍱' },
  { code: 'PRC', label: '가공', emoji: '🫙' },
  { code: 'HLT', label: '건강', emoji: '💊' },
  { code: 'ETC', label: '기타', emoji: '📦' },
]

function formatPrice(n: number | string | null | undefined): string {
  if (n == null) return '-'
  const num = typeof n === 'string' ? Number(n) : n
  if (!Number.isFinite(num)) return '-'
  return Math.round(num).toLocaleString('ko-KR')
}

export default function LiteMyShopPage() {
  const [shop, setShop] = useState<ShopInfo | null>(null)
  const [items, setItems] = useState<ShopProductRow[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 })
  const [config, setConfig] = useState<ConfigInfo | null>(null)
  const [lastLog, setLastLog] = useState<LastLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')

  async function load() {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (showInactive) qs.set('showInactive', '1')
      if (categoryFilter !== 'all') qs.set('categoryId', categoryFilter)
      const res = await fetch(`/api/lite/my-products?${qs.toString()}`, {
        credentials: 'include',
      }).then((r) => r.json())
      if (res.success) {
        setShop(res.data.shop)
        setItems(res.data.items || [])
        setStats(res.data.stats || { total: 0, active: 0, inactive: 0 })
        setConfig(res.data.config || null)
        setLastLog(res.data.lastAutoPublish || null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [showInactive, categoryFilter])

  async function toggle(spId: number, nextActive: boolean) {
    const res = await fetch('/api/lite/my-products', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopProductId: spId, active: nextActive }),
    }).then((r) => r.json())
    if (res.success) {
      setItems((prev) =>
        prev.map((i) => (i.id === spId ? { ...i, active: nextActive } : i))
      )
      setStats((s) => ({
        total: s.total,
        active: nextActive ? s.active + 1 : s.active - 1,
        inactive: nextActive ? s.inactive - 1 : s.inactive + 1,
      }))
    } else alert(res.error || '실패')
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          🛍️ 내 쇼핑몰 상품
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          매일 자동으로 등록되는 상품을 활성/비활성으로 관리하세요. 비활성된 상품은 쇼핑몰에서
          숨겨집니다.
        </p>
      </header>

      {!shop && !loading && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600">쇼핑몰이 아직 발급되지 않았습니다.</p>
          <p className="text-xs text-gray-500 mt-1">
            관리자에게 문의해 주세요. (어드민 → 라이트 셀러 발급)
          </p>
        </div>
      )}

      {shop && (
        <>
          {/* 쇼핑몰 정보 카드 */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-90">내 쇼핑몰</div>
                <div className="text-2xl font-bold mt-1">{shop.name}</div>
                <div className="text-xs opacity-80 mt-1">/{shop.subdomain}</div>
              </div>
              <a
                href={`http://${shop.subdomain}.${typeof window !== 'undefined' ? window.location.host.replace(/^[^.]+\./, '') : 'snsauto.kr'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> 쇼핑몰 열기
              </a>
            </div>
          </div>

          {/* 자동 발행 정보 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label="등록 상품" value={`${stats.active}개`} highlight />
            <Stat label="비활성" value={`${stats.inactive}개`} />
            <Stat
              label="다음 자동 발행"
              value={
                config?.isActive
                  ? `매일 ${String(config.publishHour).padStart(2, '0')}:${String(config.publishMinute).padStart(2, '0')}`
                  : 'OFF'
              }
            />
            <Stat
              label="마지막 발행"
              value={
                lastLog
                  ? `${new Date(lastLog.publishedAt).toLocaleDateString('ko-KR')} (${lastLog.count}개)`
                  : '없음'
              }
            />
          </div>

          {/* 필터 */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {CATEGORY_FILTERS.map((c) => (
              <button
                key={c.code}
                onClick={() => setCategoryFilter(c.code)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  categoryFilter === c.code
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
            <label className="ml-auto inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              비활성 상품도 보기
            </label>
            <button
              onClick={load}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> 새로고침
            </button>
          </div>

          {loading && <div className="text-center text-gray-500 py-12">로딩 중...</div>}

          {!loading && items.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-600">등록된 상품이 없습니다.</p>
              <p className="text-xs text-gray-500 mt-1">
                매일{' '}
                {config
                  ? `${String(config.publishHour).padStart(2, '0')}:${String(config.publishMinute).padStart(2, '0')}`
                  : '오전 10시'}
                에 자동으로 새 상품이 등록됩니다.
              </p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((it) => (
                <ProductCard key={it.id} row={it} onToggle={(active) => toggle(it.id, active)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ProductCard({
  row,
  onToggle,
}: {
  row: ShopProductRow
  onToggle: (active: boolean) => void
}) {
  const p = row.product
  if (!p) return null
  return (
    <div
      className={`bg-white rounded-lg border overflow-hidden ${
        row.active ? 'border-gray-200' : 'border-gray-300 opacity-60'
      }`}
    >
      {p.thumbnailUrl ? (
        <img src={p.thumbnailUrl} alt={p.name} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
          이미지 없음
        </div>
      )}
      <div className="p-3">
        <div className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[2.5em]">
          {p.name}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="text-blue-600 font-bold">₩{formatPrice(p.price)}</div>
          {row.publishedAt && (
            <div className="text-[10px] text-gray-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(row.publishedAt).toLocaleDateString('ko-KR')}
            </div>
          )}
        </div>
        <button
          onClick={() => onToggle(!row.active)}
          className={`mt-3 w-full px-3 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 ${
            row.active
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          <Power className="w-3 h-3" />
          {row.active ? '활성 (쇼핑몰 노출)' : '비활성 (숨김)'}
        </button>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg p-3 border ${
        highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
      }`}
    >
      <div className="text-xs text-gray-600">{label}</div>
      <div
        className={`text-lg font-bold mt-0.5 ${highlight ? 'text-blue-700' : 'text-gray-900'}`}
      >
        {value}
      </div>
    </div>
  )
}
