'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useToast } from '@/components/ui/Toast'
import Loading from '@/components/ui/Loading'
import Button from '@/components/ui/Button'
import { CATEGORY_MAP, type CategoryCode } from '@/modules/category/category.keywords'
import CategoryTabs from '../../digest/_components/CategoryTabs'
import DigestProductList from '../../digest/_components/DigestProductList'
import DigestSettingsPanel, {
  getGridDims,
  TARGET_MIN,
  TARGET_MAX,
  type CollageSettingsValue,
} from '../../digest/_components/DigestSettingsPanel'
import DigestProgressModal, {
  type DigestProgressItem,
} from '../../digest/_components/DigestProgressModal'
import { useAdProducts, type AdFetchedProduct } from '../_hooks/useAdProducts'

const SHOP_DOMAIN = (process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'shop.abcpharm.net').replace(/\/$/, '')

interface Channel {
  id: number
  name: string
}

/** 셀별 overlay 설정 — 이미지 위 추가 문구 배지 */
type OverlayColor = 'red' | 'yellow' | 'blue'
interface Overlay {
  overlayText: string
  overlayColor: OverlayColor
}

/** 선택된 상품 1건 — 순서 보존용 flat 리스트에 쓰임 */
interface SelectedItem {
  id: number
  categoryCode: CategoryCode
}

const OVERLAY_MAX_LEN = 20
const OVERLAY_DEFAULTS: Overlay = { overlayText: '', overlayColor: 'red' }

export default function CollageTab() {
  const toast = useToast()
  const {
    activeCategory,
    setActiveCategory,
    dateFilter,
    setDateFilter,
    categories,
    products,
    isLoading,
    wholesaleChannels,
    wholesaleChannelId,
    setWholesaleChannelId,
  } = useAdProducts('SEA')

  // 다중 카테고리 체크박스 — 발행 풀에 포함시킬 카테고리들
  const [checkedCategories, setCheckedCategories] = useState<Set<CategoryCode>>(new Set(['SEA']))

  // 선택 상품을 flat 리스트로 순서 유지. 추가/삭제/재정렬 모두 이 상태를 직접 수정.
  // 탭 전환 간에도 다른 카테고리 선택이 유지된다.
  const [orderedSelected, setOrderedSelected] = useState<SelectedItem[]>([])

  // 탭 전환 시 다른 카테고리 상품 정보를 잃지 않도록 id별 상품 캐시
  const [productInfoCache, setProductInfoCache] = useState<Map<number, AdFetchedProduct>>(new Map())

  // 셀별 overlay(추가 문구/색상) 편집 상태. productId 기준.
  const [overlayByProduct, setOverlayByProduct] = useState<Map<number, Overlay>>(new Map())

  const [collageSettings, setCollageSettings] = useState<CollageSettingsValue>({
    collageTitle: '',
    topBadgeText: '',
    gridSize: '3x4',
    targetCount: 12,
    removeBackground: true,
  })
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannels, setSelectedChannels] = useState<number[]>([])
  const [isPublishing, setIsPublishing] = useState(false)

  const [progressItems, setProgressItems] = useState<DigestProgressItem[]>([])
  const [progressOpen, setProgressOpen] = useState(false)

  const { cols: gridCols, rows: gridRows, count: expectedCount } = getGridDims(collageSettings)
  const outOfRange = expectedCount < TARGET_MIN || expectedCount > TARGET_MAX
  const totalCount = orderedSelected.length
  const countMatches = totalCount === expectedCount
  const canPublish =
    !outOfRange && countMatches && totalCount > 0 && selectedChannels.length > 0

  const collageDefaultTitle = `오늘의${CATEGORY_MAP[activeCategory].name}추천`

  // 활성 탭 전용: 현재 탭에서 선택된 id들 (DigestProductList 체크 표시용)
  const selectedIds = useMemo(
    () =>
      orderedSelected.filter((x) => x.categoryCode === activeCategory).map((x) => x.id),
    [orderedSelected, activeCategory]
  )

  const totalSelectedIds = useMemo(
    () => orderedSelected.map((x) => x.id),
    [orderedSelected]
  )

  const categorySummary = useMemo(
    () =>
      Array.from(checkedCategories).map((code) => ({
        code,
        name: CATEGORY_MAP[code].name,
        emoji: CATEGORY_MAP[code].emoji,
        count: orderedSelected.filter((x) => x.categoryCode === code).length,
      })),
    [checkedCategories, orderedSelected]
  )

  // products가 로드될 때마다 캐시 누적 — 다른 탭에서 선택한 상품도 미리보기에서 정보 노출
  useEffect(() => {
    if (products.length === 0) return
    setProductInfoCache((prev) => {
      const next = new Map(prev)
      for (const p of products) next.set(p.id, p)
      return next
    })
  }, [products])

  const shopCategoryUrl = useMemo(() => {
    const firstSelected = selectedIds.map((id) => productInfoCache.get(id)).find(Boolean)
    const subdomain = firstSelected?.shopProducts[0]?.shopSubdomain
    return subdomain ? `https://${SHOP_DOMAIN}/${subdomain}/category/${activeCategory}` : undefined
  }, [selectedIds, productInfoCache, activeCategory])

  // 소매 채널 로드 (발행 대상)
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/channel?kind=RETAIL&limit=100')
        const data = await res.json()
        if (data.success) {
          setChannels((data.data || []).map((ch: any) => ({ id: ch.id, name: ch.name })))
        }
      } catch (err) {
        console.warn('[ad/collage] channel load 실패', err)
      }
    })()
  }, [])

  // ─── 상태 변경 핸들러 ─────────────────────────────────────
  const toggleProduct = (id: number) => {
    setOrderedSelected((prev) => {
      const existingIdx = prev.findIndex((x) => x.id === id)
      if (existingIdx >= 0) {
        return prev.filter((_, i) => i !== existingIdx)
      }
      if (prev.length >= expectedCount) {
        toast.error(`최대 ${expectedCount}개까지 선택할 수 있습니다 (현재 ${prev.length}개).`)
        return prev
      }
      return [...prev, { id, categoryCode: activeCategory }]
    })
  }

  const setAllSelectedForActive = (ids: number[]) => {
    setOrderedSelected((prev) => {
      const others = prev.filter((x) => x.categoryCode !== activeCategory)
      const remaining = Math.max(0, expectedCount - others.length)
      const activeNew = ids.slice(0, remaining).map((id) => ({ id, categoryCode: activeCategory }))
      return [...others, ...activeNew]
    })
  }

  const toggleCategoryChecked = (code: CategoryCode) => {
    setCheckedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
        // 해제 시 해당 카테고리 선택/오버레이 정리
        setOrderedSelected((cur) => cur.filter((x) => x.categoryCode !== code))
      } else {
        next.add(code)
      }
      return next
    })
  }

  const toggleChannel = (id: number) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const moveSelectedAt = (flatIdx: number, delta: -1 | 1) => {
    setOrderedSelected((prev) => {
      const newIdx = flatIdx + delta
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[flatIdx], next[newIdx]] = [next[newIdx], next[flatIdx]]
      return next
    })
  }

  const removeSelectedAt = (flatIdx: number) => {
    setOrderedSelected((prev) => prev.filter((_, i) => i !== flatIdx))
  }

  const updateOverlay = (productId: number, patch: Partial<Overlay>) => {
    setOverlayByProduct((prev) => {
      const next = new Map(prev)
      const cur = next.get(productId) ?? OVERLAY_DEFAULTS
      next.set(productId, { ...cur, ...patch })
      return next
    })
  }

  const productItems = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    thumbnailUrl: p.thumbnailUrl,
    images: p.images,
    createdAt: p.createdAt,
    lastDigestPublishedAt: undefined,
    channel: p.channel
      ? { id: p.channel.id, name: p.channel.name, orderDeadline: p.channel.orderDeadline || null }
      : null,
  }))

  const buildCellOverridesPayload = () => {
    const out: Array<{ productId: number; overlayText: string; overlayColor: OverlayColor }> = []
    for (const item of orderedSelected) {
      const ov = overlayByProduct.get(item.id)
      if (ov && ov.overlayText.trim()) {
        out.push({
          productId: item.id,
          overlayText: ov.overlayText.trim(),
          overlayColor: ov.overlayColor,
        })
      }
    }
    return out
  }

  const handlePublish = async () => {
    if (!canPublish) {
      if (totalCount === 0) toast.error('상품을 선택하세요.')
      else if (totalCount < expectedCount)
        toast.error(`선택 부족: ${totalCount}/${expectedCount}개`)
      else if (totalCount > expectedCount)
        toast.error(`선택 초과: ${totalCount}/${expectedCount}개`)
      else if (selectedChannels.length === 0) toast.error('발행할 소매밴드를 선택하세요.')
      return
    }
    if (
      !window.confirm(
        `상품 ${totalCount}개를 콜라주 포스터 1장으로 밴드 ${selectedChannels.length}개에 발행합니다.\n계속할까요?`
      )
    ) {
      return
    }

    const activeChannels = channels.filter((c) => selectedChannels.includes(c.id))
    const primaryCategory = Array.from(checkedCategories)[0] ?? activeCategory
    const cellOverrides = buildCellOverridesPayload()

    const initialItems: DigestProgressItem[] = activeChannels.map((ch) => ({
      channelId: ch.id,
      channelName: ch.name,
      categoryCode: primaryCategory,
      categoryLabel:
        categorySummary.length > 1
          ? `${categorySummary.map((c) => c.emoji).join('')} 혼합`
          : `${CATEGORY_MAP[primaryCategory].emoji} ${CATEGORY_MAP[primaryCategory].name}`,
      status: 'pending',
    }))
    setProgressItems(initialItems)
    setProgressOpen(true)
    setIsPublishing(true)

    try {
      for (let i = 0; i < activeChannels.length; i++) {
        const channelId = activeChannels[i].id

        setProgressItems((prev) => {
          const next = [...prev]
          next[i] = { ...next[i], status: 'publishing' }
          return next
        })

        try {
          const res = await fetch('/api/publish/digest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categoryId: primaryCategory,
              productIds: totalSelectedIds,
              channelId,
              publishMode: 'collage',
              collageOptions: {
                title: collageSettings.collageTitle.trim() || undefined,
                gridCols,
                gridRows,
                removeBackground: collageSettings.removeBackground,
                topBadgeText: collageSettings.topBadgeText.trim() || undefined,
                cellOverrides: cellOverrides.length > 0 ? cellOverrides : undefined,
              },
            }),
          })
          const data = await res.json()
          const ok = data.result?.status === 'SUCCESS'
          setProgressItems((prev) => {
            const next = [...prev]
            next[i] = {
              ...next[i],
              status: ok ? 'success' : 'failed',
              message: data.result?.message || data.error,
            }
            return next
          })
        } catch (err: any) {
          setProgressItems((prev) => {
            const next = [...prev]
            next[i] = {
              ...next[i],
              status: 'failed',
              message: err?.message || '요청 오류',
            }
            return next
          })
        }
      }

      // 발행 완료 — 선택과 overlay 정리
      setOrderedSelected([])
      setOverlayByProduct(new Map())
      setSelectedChannels([])
    } finally {
      setIsPublishing(false)
    }
  }

  // ─── 미리보기 그리드: 한 행에 최대 gridCols(최대 4) 컬럼 ─────────
  const previewColsClass = (() => {
    const c = Math.min(4, Math.max(1, gridCols))
    return {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-2 sm:grid-cols-3',
      4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
    }[c]
  })()

  return (
    <div>
      <div className="mb-3">
        <CategoryTabs
          categories={categories}
          active={activeCategory}
          onChange={setActiveCategory}
          checked={checkedCategories}
          onToggleChecked={toggleCategoryChecked}
        />
        <p className="mt-1 text-[11px] text-gray-500">
          💡 카테고리 체크박스로 여러 카테고리를 한 포스터에 섞을 수 있고, 탭 클릭으로 해당 카테고리 상품을 선택합니다.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap bg-white border border-gray-200 rounded-lg p-3">
        <span className="text-xs text-gray-500">📅 날짜:</span>
        {(['today', '3d', '7d', 'all'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setDateFilter(opt)}
            className={`text-xs px-2.5 py-1.5 rounded-md transition-colors ${
              dateFilter === opt ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt === 'today' ? '🔥 오늘 상품' : opt === '3d' ? '최근 3일' : opt === '7d' ? '최근 7일' : '전체'}
          </button>
        ))}
        <span className="mx-2 h-4 w-px bg-gray-200" aria-hidden="true" />
        <span className="text-xs text-gray-500">🛒 도매방:</span>
        <select
          value={wholesaleChannelId ?? ''}
          onChange={(e) => setWholesaleChannelId(e.target.value ? Number(e.target.value) : null)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체 ({wholesaleChannels.length}개)</option>
          {wholesaleChannels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>
      </div>

      <DigestSettingsPanel
        value={collageSettings}
        onChange={setCollageSettings}
        shopCategoryUrl={shopCategoryUrl}
        defaultTitle={collageDefaultTitle}
        mode="count"
      />

      {/* 발행 대상 요약 */}
      {categorySummary.length > 0 && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs font-semibold text-blue-900 mb-2">
            📌 발행 대상 카테고리 ({categorySummary.length}개) · 합산 {totalCount}/{expectedCount}개
          </div>
          <div className="flex flex-wrap gap-2">
            {categorySummary.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setActiveCategory(c.code)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  c.count > 0
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } ${c.code === activeCategory ? 'ring-2 ring-blue-400' : ''}`}
              >
                {c.emoji} {c.name} {c.count}개
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 셀 미리보기 + overlay 편집 ─── */}
      {orderedSelected.length > 0 && (
        <div className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">
                🎨 포스터 배치 미리보기 · 셀별 추가문구 편집
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                순서대로 {gridCols} × {gridRows} 배치 · 부족한 자리는 빈 칸으로 렌더
              </p>
            </div>
            <span className="text-xs text-gray-600">
              {orderedSelected.length}/{expectedCount}개
            </span>
          </div>

          <div className={`grid ${previewColsClass} gap-3`}>
            {orderedSelected.map((item, idx) => {
              const info = productInfoCache.get(item.id)
              const ov = overlayByProduct.get(item.id) ?? OVERLAY_DEFAULTS
              const thumb = info?.thumbnailUrl || info?.images?.[0]?.url
              const isFirst = idx === 0
              const isLast = idx === orderedSelected.length - 1
              const overlayBg =
                ov.overlayColor === 'yellow'
                  ? 'bg-amber-400 text-gray-900'
                  : ov.overlayColor === 'blue'
                  ? 'bg-blue-600 text-white'
                  : 'bg-red-600 text-white'
              return (
                <div
                  key={`${item.id}-${idx}`}
                  className="relative bg-gray-50 border border-gray-200 rounded-lg p-2"
                >
                  {/* 순서 뱃지 */}
                  <span className="absolute -top-2 -left-2 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow">
                    {idx + 1}
                  </span>
                  {/* 카테고리 이모지 */}
                  <span
                    className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-sm shadow-sm"
                    title={CATEGORY_MAP[item.categoryCode].name}
                  >
                    {CATEGORY_MAP[item.categoryCode].emoji}
                  </span>

                  {/* 컨트롤 행 */}
                  <div className="flex justify-end gap-1 mb-1">
                    <button
                      type="button"
                      onClick={() => moveSelectedAt(idx, -1)}
                      disabled={isFirst}
                      title="위로"
                      className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSelectedAt(idx, +1)}
                      disabled={isLast}
                      title="아래로"
                      className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSelectedAt(idx)}
                      title="제외"
                      className="px-1.5 py-0.5 text-xs text-red-500 hover:text-red-700"
                    >
                      ✖
                    </button>
                  </div>

                  {/* 썸네일 + overlay 미리보기 */}
                  <div className="aspect-square bg-white rounded overflow-hidden relative border border-gray-100">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt=""
                        fill
                        sizes="160px"
                        className="object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        #{item.id}
                      </div>
                    )}
                    {ov.overlayText && (
                      <div
                        className={`absolute top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shadow max-w-[90%] overflow-hidden text-ellipsis ${overlayBg}`}
                      >
                        {ov.overlayText}
                      </div>
                    )}
                  </div>

                  <p
                    className="mt-2 text-xs font-medium text-gray-800 line-clamp-1"
                    title={info?.name}
                  >
                    {info?.name ?? `상품 #${item.id}`}
                  </p>
                  {typeof info?.price === 'number' && (
                    <p className="text-[11px] text-gray-500">{info.price.toLocaleString()}원</p>
                  )}

                  {/* overlay 편집 */}
                  <input
                    type="text"
                    placeholder="추가 문구 (예: 한정특가)"
                    maxLength={OVERLAY_MAX_LEN}
                    value={ov.overlayText}
                    onChange={(e) => updateOverlay(item.id, { overlayText: e.target.value })}
                    className="mt-2 w-full text-[11px] px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="mt-1 flex items-center gap-1">
                    {(['red', 'yellow', 'blue'] as const).map((c) => {
                      const active = ov.overlayColor === c
                      const bg =
                        c === 'red' ? 'bg-red-500' : c === 'yellow' ? 'bg-amber-400' : 'bg-blue-500'
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateOverlay(item.id, { overlayColor: c })}
                          className={`w-5 h-5 rounded-full border-2 ${bg} ${
                            active ? 'border-gray-800' : 'border-gray-300 hover:border-gray-500'
                          }`}
                          aria-label={`overlay ${c}`}
                          title={`색상: ${c}`}
                        />
                      )
                    })}
                    {ov.overlayText && (
                      <button
                        type="button"
                        onClick={() => updateOverlay(item.id, { overlayText: '' })}
                        className="ml-auto text-[10px] text-gray-400 hover:text-gray-600"
                      >
                        지우기
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {/* 남는 셀 표시 */}
            {Array.from({
              length: Math.max(0, expectedCount - orderedSelected.length),
            }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-square border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400"
              >
                #{orderedSelected.length + i + 1} 빈 칸
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-12">
          <Loading />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <DigestProductList
            products={productItems as any}
            selectedIds={selectedIds}
            onToggle={toggleProduct}
            onSelectAll={setAllSelectedForActive}
          />
        </div>
      )}

      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 py-3 -mx-4 sm:-mx-6 lg:-mx-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-30">
        <div className="text-sm text-gray-700">
          현재 탭 <span className="font-bold text-gray-800">{selectedIds.length}개</span>
          <span className="mx-2">·</span>
          합산 선택:{' '}
          <span
            className={`font-bold ${
              countMatches
                ? 'text-emerald-600'
                : totalCount > expectedCount
                ? 'text-red-600'
                : 'text-amber-600'
            }`}
          >
            {totalCount}
          </span>
          <span className="text-gray-400">/{expectedCount}</span>
          <span className="ml-2 text-xs text-gray-500">
            (자동 {gridCols}×{gridRows})
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">발행 밴드:</span>
          {channels.length === 0 && (
            <span className="text-xs text-gray-400">등록된 소매밴드 없음</span>
          )}
          {channels.map((ch) => {
            const active = selectedChannels.includes(ch.id)
            return (
              <button
                key={ch.id}
                onClick={() => toggleChannel(ch.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {ch.name}
              </button>
            )
          })}
          <Button
            variant="primary"
            disabled={!canPublish || isPublishing}
            loading={isPublishing}
            onClick={handlePublish}
            className="ml-2"
          >
            🖼️{' '}
            {canPublish
              ? `콜라주 발행 (${totalCount}개 → 포스터 1장 × ${selectedChannels.length}밴드)`
              : totalCount < expectedCount
              ? `선택 부족 (${totalCount}/${expectedCount})`
              : totalCount > expectedCount
              ? `선택 초과 (${totalCount}/${expectedCount})`
              : '밴드 선택 필요'}
          </Button>
        </div>
      </div>

      <DigestProgressModal
        isOpen={progressOpen}
        items={progressItems}
        digestTitle={
          collageSettings.collageTitle.trim() ||
          (categorySummary.length > 1
            ? categorySummary.map((c) => c.name).join(' · ') + ' 추천'
            : collageDefaultTitle)
        }
        productCount={totalCount}
        imageCount={1}
        onClose={() => setProgressOpen(false)}
        canClose={!isPublishing}
      />
    </div>
  )
}
