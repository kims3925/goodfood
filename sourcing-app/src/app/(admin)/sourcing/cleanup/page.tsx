'use client'

/**
 * 상품 삭제 관리 (/sourcing/cleanup)
 *
 * 에이전트 자동삭제(content-expiry cron, 2026-05-04 비활성) 대신 매니저가 메뉴에서
 * 조건(기간·카테고리·원본소실)을 정해 미리보기 → 남길/삭제할 상품을 직접 선택 → 실행.
 *  - 대상: 소매밴드(ChannelProduct)·쇼핑몰(ShopProduct) 발행물만. 도매밴드는 건드리지 않음.
 *  - 상시상품(COM)은 기본 제외.
 *  - 삭제는 soft-delete(가역) + 옵션으로 소매밴드 실제 글 삭제(Playwright).
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Trash2,
  Search,
  RefreshCw,
  AlertTriangle,
  Upload,
  ShoppingBag,
  CheckCircle2,
} from 'lucide-react'
import { CATEGORY_LIST } from '@/modules/category/category.keywords'

interface PreviewRow {
  productId: number
  name: string
  categoryId: string | null
  reason: 'expired' | 'missing_source'
  retailPublishes: {
    channelProductId: number
    channelId?: number
    channelName: string
    publishedAt: string | null
    hasBandPost: boolean
  }[]
  shopPublishes: {
    shopProductId: number
    shopName: string
    publishedAt: string | null
  }[]
}

interface PreviewSummary {
  productCount: number
  totalMatched: number
  truncated: boolean
  retailPublishCount: number
  shopPublishCount: number
  bandPostCount: number
}

interface RetailChannel {
  id: number
  name: string
}

function daysAgoStr(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmt(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function CleanupPage() {
  // ── 조건 ──
  const [cutoffDate, setCutoffDate] = useState(daysAgoStr(7))
  const [targetRetail, setTargetRetail] = useState(true)
  const [targetShop, setTargetShop] = useState(true)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]) // 빈 배열 = 전체
  const [includeCom, setIncludeCom] = useState(false) // 상시상품(COM) 포함 여부 — 기본 제외
  const [includeMissingSource, setIncludeMissingSource] = useState(false)
  const [channelId, setChannelId] = useState<number | null>(null)
  const [channels, setChannels] = useState<RetailChannel[]>([])

  // ── 미리보기 결과 ──
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [summary, setSummary] = useState<PreviewSummary | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set()) // productId
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewDone, setPreviewDone] = useState(false)

  // ── 실행 ──
  const [deleteBandPosts, setDeleteBandPosts] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [execProgress, setExecProgress] = useState<string | null>(null)
  const [execResult, setExecResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/channel?kind=RETAIL&limit=100')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) {
          setChannels(j.data.filter((c: any) => c.isActive !== false).map((c: any) => ({ id: c.id, name: c.name })))
        }
      })
      .catch(() => {})
  }, [])

  const toggleCategory = (code: string) => {
    setSelectedCategories((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const runPreview = async () => {
    setIsLoading(true)
    setError(null)
    setExecResult(null)
    try {
      const res = await fetch('/api/sourcing/cleanup/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cutoffDate,
          targets: { retail: targetRetail, shop: targetShop },
          categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
          excludeCom: !includeCom,
          channelIds: channelId ? [channelId] : undefined,
          includeMissingSource,
          limit: 500,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '미리보기 실패')
      setRows(json.data)
      setSummary(json.summary)
      setSelected(new Set(json.data.map((r: PreviewRow) => r.productId))) // 기본 전체 선택
      setPreviewDone(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleRow = (productId: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.productId)), [rows, selected])
  const selStats = useMemo(() => {
    const retail = selectedRows.reduce((s, r) => s + r.retailPublishes.length, 0)
    const shop = selectedRows.reduce((s, r) => s + r.shopPublishes.length, 0)
    const band = selectedRows.reduce((s, r) => s + r.retailPublishes.filter((rp) => rp.hasBandPost).length, 0)
    return { retail, shop, band }
  }, [selectedRows])

  const runExecute = async () => {
    if (selectedRows.length === 0) return
    const bandNote = deleteBandPosts
      ? `\n소매밴드 실제 게시글 ${selStats.band}건도 삭제됩니다 (되돌릴 수 없음).`
      : '\n(소매밴드 실제 글은 남고, DB 발행기록만 내려갑니다 — 가역)'
    if (
      !window.confirm(
        `선택한 상품 ${selectedRows.length}개의 발행물을 삭제합니다.\n` +
          `- 소매밴드 발행기록 ${selStats.retail}건\n- 쇼핑몰 발행 ${selStats.shop}건${bandNote}\n\n진행할까요?`
      )
    )
      return

    setIsExecuting(true)
    setExecResult(null)
    setError(null)
    try {
      const channelProductIds = selectedRows.flatMap((r) => r.retailPublishes.map((rp) => rp.channelProductId))
      const shopProductIds = selectedRows.flatMap((r) => r.shopPublishes.map((sp) => sp.shopProductId))

      let shopDeleted = 0
      let channelDeleted = 0
      let bandDeleted = 0
      let bandFailed = 0

      // 1차 호출: DB soft-delete 전체 + 밴드 실삭제 1배치
      setExecProgress('삭제 실행 중...')
      const res = await fetch('/api/sourcing/cleanup/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelProductIds, shopProductIds, deleteBandPosts }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '삭제 실행 실패')
      shopDeleted += json.result.shopProducts.softDeleted
      channelDeleted += json.result.channelProducts.softDeleted
      bandDeleted += json.result.bandPosts.deleted
      bandFailed += json.result.bandPosts.failed

      // 밴드 실삭제 잔여분: soft-delete 는 끝났으므로 재호출 불필요 — 잔여는 안내만.
      // (execute 는 deletedAt null 만 다시 잡으므로 같은 ID 재호출은 no-op)
      const remaining = json.result.remainingBandPosts || 0

      setExecResult(
        `완료 — 쇼핑몰 ${shopDeleted}건 / 소매밴드 발행기록 ${channelDeleted}건 내림` +
          (deleteBandPosts
            ? ` / 밴드 실제글 삭제 ${bandDeleted}건${bandFailed > 0 ? `, 실패 ${bandFailed}건` : ''}` +
              (remaining > 0
                ? ` (시간 제한으로 ${remaining}건의 밴드 글은 다음 실행에서 — 미리보기를 다시 돌려 진행하세요)`
                : '')
            : '')
      )
      setExecProgress(null)
      // 목록 갱신
      await runPreview()
    } catch (e: any) {
      setError(e.message)
      setExecProgress(null)
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Trash2 className="h-8 w-8 text-red-500" />
            <h1 className="text-3xl font-bold text-gray-900">상품 삭제 관리</h1>
          </div>
          <p className="text-gray-600">
            기간·카테고리 조건으로 오래된 발행 상품을 찾아 <strong>남길 것과 삭제할 것을 직접 선택</strong>해 정리합니다.
            소매밴드·쇼핑몰 발행물만 대상이며 <strong>도매밴드 글은 건드리지 않습니다</strong>. 상시상품(COM)은 기본 제외됩니다.
          </p>
        </div>

        {/* 조건 패널 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">기준일 (이전 발행분 대상)</span>
            <input
              type="date"
              value={cutoffDate}
              onChange={(e) => setCutoffDate(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setCutoffDate(daysAgoStr(d))}
                className={`text-xs px-2.5 py-1.5 rounded-md ${
                  cutoffDate === daysAgoStr(d) ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {d}일 이전
              </button>
            ))}

            <span className="text-sm font-medium text-gray-700 ml-4">대상</span>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={targetRetail} onChange={(e) => setTargetRetail(e.target.checked)} />
              <Upload size={13} className="text-green-600" /> 소매밴드
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={targetShop} onChange={(e) => setTargetShop(e.target.checked)} />
              <ShoppingBag size={13} className="text-blue-600" /> 쇼핑몰
            </label>

            <select
              value={channelId ?? ''}
              onChange={(e) => setChannelId(e.target.value ? parseInt(e.target.value) : null)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            >
              <option value="">소매밴드 전체</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">카테고리</span>
            <button
              onClick={() => setSelectedCategories([])}
              className={`text-xs px-2.5 py-1.5 rounded-md ${
                selectedCategories.length === 0 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            {CATEGORY_LIST.map((cat) => (
              <button
                key={cat.code}
                onClick={() => toggleCategory(cat.code)}
                className={`text-xs px-2.5 py-1.5 rounded-md ${
                  selectedCategories.includes(cat.code)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
            <button
              onClick={() => toggleCategory('NULL')}
              className={`text-xs px-2.5 py-1.5 rounded-md ${
                selectedCategories.includes('NULL') ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📦 미분류
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-5 pt-1 border-t border-gray-100">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" checked={includeCom} onChange={(e) => setIncludeCom(e.target.checked)} />
              상시상품(COM)도 포함
              <span className="text-xs text-gray-400">(기본 보호됨)</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeMissingSource}
                onChange={(e) => setIncludeMissingSource(e.target.checked)}
              />
              도매 원본 소실·품절(모니터링 감지) 상품 포함
              <span className="text-xs text-gray-400">(기준일 무관)</span>
            </label>

            <button
              onClick={runPreview}
              disabled={isLoading || (!targetRetail && !targetShop)}
              className="ml-auto flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
              미리보기
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={15} /> {error}
          </div>
        )}
        {execResult && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 size={15} /> {execResult}
          </div>
        )}

        {/* 미리보기 결과 */}
        {previewDone && summary && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">
                대상 상품 {summary.productCount.toLocaleString()}개
                {summary.truncated && (
                  <span className="text-amber-600 text-xs ml-1">
                    (전체 {summary.totalMatched.toLocaleString()}개 중 500개만 표시 — 실행 후 다시 미리보기)
                  </span>
                )}
              </span>
              <span className="text-gray-500 text-xs">
                소매밴드 발행 {summary.retailPublishCount}건 · 쇼핑몰 발행 {summary.shopPublishCount}건 · 밴드 실제글 {summary.bandPostCount}건
              </span>
              <span className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setSelected(new Set(rows.map((r) => r.productId)))}
                  className="text-xs text-blue-600 underline"
                >
                  전체 선택
                </button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 underline">
                  전체 해제
                </button>
              </span>
            </div>

            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-3 py-2 w-10">삭제</th>
                    <th className="px-3 py-2 min-w-[220px]">상품명</th>
                    <th className="px-3 py-2">카테고리</th>
                    <th className="px-3 py-2">사유</th>
                    <th className="px-3 py-2 min-w-[170px]">소매밴드 발행</th>
                    <th className="px-3 py-2 min-w-[150px]">쇼핑몰 발행</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                        조건에 맞는 상품이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const isSel = selected.has(row.productId)
                      return (
                        <tr
                          key={row.productId}
                          className={`cursor-pointer ${isSel ? 'bg-red-50/40' : 'hover:bg-gray-50 opacity-70'}`}
                          onClick={() => toggleRow(row.productId)}
                        >
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={isSel} readOnly />
                          </td>
                          <td className="px-3 py-2">
                            <span className={isSel ? 'text-gray-900' : 'text-gray-500 line-through-none'}>
                              {row.name}
                            </span>
                            {!isSel && <span className="ml-1 text-[10px] text-green-600">(남김)</span>}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">{row.categoryId ?? '미분류'}</td>
                          <td className="px-3 py-2">
                            {row.reason === 'missing_source' ? (
                              <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">원본 소실</span>
                            ) : (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">기간 만료</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {row.retailPublishes.map((rp) => (
                                <span
                                  key={rp.channelProductId}
                                  className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded"
                                  title={rp.hasBandPost ? '밴드 실제 글 있음' : '발행기록만'}
                                >
                                  {rp.channelName} {fmt(rp.publishedAt)}{rp.hasBandPost ? ' 📝' : ''}
                                </span>
                              ))}
                              {row.retailPublishes.length === 0 && <span className="text-xs text-gray-300">—</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {row.shopPublishes.map((sp) => (
                                <span
                                  key={sp.shopProductId}
                                  className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded"
                                >
                                  {sp.shopName} {fmt(sp.publishedAt)}
                                </span>
                              ))}
                              {row.shopPublishes.length === 0 && <span className="text-xs text-gray-300">—</span>}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 실행 바 */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-700">
                선택 <strong className="text-red-600">{selectedRows.length}</strong>개 상품 — 소매밴드 {selStats.retail}건 / 쇼핑몰 {selStats.shop}건
              </span>
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={deleteBandPosts}
                  onChange={(e) => setDeleteBandPosts(e.target.checked)}
                />
                소매밴드 <strong>실제 게시글</strong>도 삭제 ({selStats.band}건, 되돌릴 수 없음)
              </label>
              <span className="text-xs text-gray-400">미체크 시 DB 발행기록만 내림(가역)</span>
              <button
                onClick={runExecute}
                disabled={isExecuting || selectedRows.length === 0}
                className="ml-auto flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {execProgress || `선택 ${selectedRows.length}개 삭제`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
