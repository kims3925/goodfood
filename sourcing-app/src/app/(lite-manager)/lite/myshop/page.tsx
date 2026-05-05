/**
 * Lite My Shop — 추천 상품 풀 + 직접 선택 + 업로드 (F5, C2)
 * 철학: "전체 자동 업로드" 절대 금지 — 셀러가 직접 5~10개 선택해야 학습됨
 */
'use client'

import { useEffect, useMemo, useState } from 'react'

interface RecommendedProduct {
  id: number
  name: string
  description: string | null
  categoryId: string | null
  thumbnailUrl: string | null
  price: number | null
  priceRange: number | { min: number; max: number }
  wholesalePrice: number | null
  marginPct: number | null
  channel: { id: number; name: string } | null
  alreadyListed: boolean
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

const REASON_TAGS = ['💰 가격 좋음', '📈 마진 좋음', '🌸 시즌 상품', '⭐ 인기 예감', '🎯 잘 모르겠음']

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '-'
  return Math.round(n).toLocaleString('ko-KR')
}

function priceLabel(pr: RecommendedProduct['priceRange'], single: number | null): string {
  if (typeof pr === 'number') return `₩${formatPrice(pr)}`
  return `₩${formatPrice(pr.min)} ~ ₩${formatPrice(pr.max)}`
}

const RECOMMENDED_MIN = 5
const RECOMMENDED_MAX = 10

export default function LiteMyShop() {
  const [products, setProducts] = useState<RecommendedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Map<number, string>>(new Map()) // productId → reason tag
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    summary: { total: number; success: number; skipped: number; failed: number }
    shareText: string
    shopMainUrl: string | null
    error?: string
  } | null>(null)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const qs = new URLSearchParams({ limit: '20' })
    if (categoryFilter !== 'all') qs.set('categoryId', categoryFilter)

    fetch(`/api/lite/recommended-products?${qs.toString()}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) {
          setProducts(data.data.products || [])
        } else {
          setError(data.error || '조회 실패')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || '네트워크 오류')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [categoryFilter])

  const selectedCount = selected.size
  const canUpload = selectedCount >= RECOMMENDED_MIN && selectedCount <= RECOMMENDED_MAX
  const selectableProducts = useMemo(() => products.filter((p) => !p.alreadyListed), [products])

  const toggleSelect = (productId: number) => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.set(productId, '')
      }
      return next
    })
  }

  const setReason = (productId: number, reason: string) => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(productId)) next.set(productId, reason)
      return next
    })
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">마이샵</h1>
        <p className="text-sm text-gray-600 mt-1">
          추천 풀 {products.length}개 중 직접 {RECOMMENDED_MIN}~{RECOMMENDED_MAX}개를 골라 업로드하세요. (자동 업로드는 없습니다)
        </p>
      </header>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="text-sm font-semibold text-blue-900">💡 왜 직접 골라야 하나요?</div>
        <div className="text-xs text-blue-700 mt-1 leading-relaxed">
          상품 감각은 직접 골라봐야 생깁니다. 선택한 이유 태그를 남기면, 어떤 기준으로 골랐는지 다시 볼 수 있어요.
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c.code}
            onClick={() => setCategoryFilter(c.code)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              categoryFilter === c.code
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
            }`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center text-sm text-gray-500 py-12">
          추천 상품을 불러오는 중...
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-12 text-center">
          <div className="text-4xl mb-2">📭</div>
          <div className="text-sm font-medium text-gray-900">추천할 상품이 없습니다</div>
          <div className="text-xs text-gray-500 mt-1">잠시 후 다시 확인해주세요</div>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((p) => {
            const isSelected = selected.has(p.id)
            const isLocked = p.alreadyListed
            return (
              <article
                key={p.id}
                className={`bg-white rounded-lg border-2 overflow-hidden transition-colors ${
                  isLocked
                    ? 'border-gray-200 opacity-60'
                    : isSelected
                      ? 'border-blue-500 shadow-md'
                      : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="aspect-square bg-gray-100 relative">
                  {p.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnailUrl}
                      alt={p.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                      이미지 없음
                    </div>
                  )}
                  {isLocked && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-gray-900/80 text-white text-[10px] rounded">
                      이미 게재 중
                    </div>
                  )}
                  {p.marginPct !== null && p.marginPct >= 20 && !isLocked && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-green-600 text-white text-[10px] rounded font-semibold">
                      마진 {p.marginPct}%
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug" style={{ minHeight: '2.5rem' }}>
                    {p.name}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="text-base font-bold text-gray-900">
                      {priceLabel(p.priceRange, p.price)}
                    </div>
                    {p.channel && (
                      <div className="text-[10px] text-gray-400 truncate ml-2 max-w-[40%]">
                        {p.channel.name}
                      </div>
                    )}
                  </div>

                  {!isLocked && (
                    <button
                      onClick={() => toggleSelect(p.id)}
                      className={`mt-2 w-full py-1.5 rounded text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {isSelected ? '✓ 선택됨' : '선택'}
                    </button>
                  )}

                  {isSelected && !isLocked && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {REASON_TAGS.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setReason(p.id, tag)}
                          className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                            selected.get(p.id) === tag
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-blue-200'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Sticky 선택 바 */}
      {!loading && products.length > 0 && (
        <div className="mt-6 sticky bottom-4 bg-white border-2 border-gray-200 rounded-lg p-4 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm">
              <div className="font-semibold text-gray-900">
                선택: {selectedCount} / {RECOMMENDED_MAX}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {selectedCount < RECOMMENDED_MIN
                  ? `최소 ${RECOMMENDED_MIN}개 더 골라주세요 (${RECOMMENDED_MIN - selectedCount}개 부족)`
                  : selectedCount > RECOMMENDED_MAX
                    ? `최대 ${RECOMMENDED_MAX}개까지만 선택 가능합니다`
                    : '✅ 업로드 가능 — 카톡/밴드 공유 준비됨'}
              </div>
            </div>
            <button
              disabled={!canUpload}
              onClick={() => setUploadOpen(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                canUpload
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-white cursor-not-allowed'
              }`}
            >
              업로드 + 카톡/밴드 공유
            </button>
          </div>
        </div>
      )}

      {/* 업로드 모달 — C3 실구현 */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            {!uploadResult && (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-2">업로드 확인</h2>
                <p className="text-sm text-gray-600 mb-4">
                  {selectedCount}개 상품을 마이샵에 게재합니다. 게재 후 카톡/밴드 공유 텍스트가 자동 생성됩니다.
                </p>
                <div className="bg-gray-50 rounded p-3 text-xs space-y-1 mb-4 max-h-40 overflow-y-auto">
                  {Array.from(selected.entries()).map(([pid, reason]) => {
                    const p = products.find((x) => x.id === pid)
                    return (
                      <div key={pid} className="flex justify-between gap-2">
                        <span className="truncate">{p?.name}</span>
                        <span className="text-gray-400 shrink-0">{reason || '(이유 미선택)'}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    disabled={uploading}
                    onClick={() => setUploadOpen(false)}
                    className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    disabled={uploading}
                    onClick={async () => {
                      setUploading(true)
                      try {
                        const reasons: Record<number, string> = {}
                        Array.from(selected.entries()).forEach(([pid, r]) => {
                          if (r) reasons[pid] = r
                        })
                        const res = await fetch('/api/lite/products/upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            productIds: Array.from(selected.keys()),
                            reasons,
                          }),
                        })
                        const data = await res.json()
                        if (data.success) {
                          setUploadResult({
                            summary: data.summary,
                            shareText: data.shareText || '',
                            shopMainUrl: data.shop?.mainUrl || null,
                          })
                          // 게재 완료된 상품은 다시 안 뜨게 fetch 다시
                          setSelected(new Map())
                        } else {
                          setUploadResult({
                            summary: { total: 0, success: 0, skipped: 0, failed: 0 },
                            shareText: '',
                            shopMainUrl: null,
                            error: data.error || '업로드 실패',
                          })
                        }
                      } catch (err: any) {
                        setUploadResult({
                          summary: { total: 0, success: 0, skipped: 0, failed: 0 },
                          shareText: '',
                          shopMainUrl: null,
                          error: err?.message || '네트워크 오류',
                        })
                      } finally {
                        setUploading(false)
                      }
                    }}
                    className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploading ? '업로드 중...' : '업로드 + 공유 텍스트 생성'}
                  </button>
                </div>
              </>
            )}

            {uploadResult && uploadResult.error && (
              <>
                <h2 className="text-lg font-bold text-red-700 mb-2">업로드 실패</h2>
                <p className="text-sm text-red-700 mb-4">{uploadResult.error}</p>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setUploadResult(null)
                      setUploadOpen(false)
                    }}
                    className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  >
                    닫기
                  </button>
                </div>
              </>
            )}

            {uploadResult && !uploadResult.error && (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-2">✅ 업로드 완료</h2>
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-xl font-bold text-green-700">{uploadResult.summary.success}</div>
                    <div className="text-xs text-green-600">신규 게재</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xl font-bold text-gray-700">{uploadResult.summary.skipped}</div>
                    <div className="text-xs text-gray-500">이미 게재</div>
                  </div>
                  <div className="bg-red-50 rounded p-2">
                    <div className="text-xl font-bold text-red-700">{uploadResult.summary.failed}</div>
                    <div className="text-xs text-red-600">실패</div>
                  </div>
                </div>

                {uploadResult.shareText && (
                  <>
                    <div className="text-sm font-semibold text-gray-900 mb-2">📤 카톡/밴드 공유 텍스트</div>
                    <textarea
                      readOnly
                      value={uploadResult.shareText}
                      className="w-full h-48 text-xs p-2 bg-gray-50 border border-gray-200 rounded font-mono"
                      onFocus={(e) => e.target.select()}
                    />
                    <div className="mt-2 flex flex-col gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(uploadResult.shareText)
                            setShareCopied(true)
                            setTimeout(() => setShareCopied(false), 2000)
                          } catch {}
                        }}
                        className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        {shareCopied ? '✓ 복사됨!' : '📋 클립보드 복사'}
                      </button>
                      {uploadResult.shopMainUrl && (
                        <a
                          href={uploadResult.shopMainUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full px-4 py-2 bg-gray-100 text-gray-800 text-sm rounded text-center hover:bg-gray-200"
                        >
                          🛒 마이샵 보기
                        </a>
                      )}
                    </div>
                  </>
                )}

                <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-blue-700">
                  💡 카톡/밴드에 붙여넣어 자연스럽게 공유하세요. 자동 게시는 Lite 에서 지원하지 않아요 — 셀러님의 손이 닿아야 신뢰가 쌓입니다.
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setUploadResult(null)
                      setUploadOpen(false)
                      // 게재된 상품은 다시 fetch 해서 alreadyListed 반영
                      setCategoryFilter((c) => c)
                    }}
                    className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  >
                    닫기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
