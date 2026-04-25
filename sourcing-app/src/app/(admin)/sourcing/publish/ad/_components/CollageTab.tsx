'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { useAdProducts } from '../_hooks/useAdProducts'

const SHOP_DOMAIN = (process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'shop.abcpharm.net').replace(/\/$/, '')

interface Channel {
  id: number
  name: string
}

export default function CollageTab() {
  const toast = useToast()
  const {
    activeCategory,
    setActiveCategory,
    dateFilter,
    setDateFilter,
    categories,
    products,
    productMap,
    isLoading,
    wholesaleChannels,
    wholesaleChannelId,
    setWholesaleChannelId,
  } = useAdProducts('SEA')

  // 다중 카테고리 — 체크박스로 발행 풀에 포함할 카테고리들 선택.
  // 각 카테고리 상품을 활성 탭에서 체크해 누적 선택하고, 최종적으로 모든 체크된
  // 카테고리 선택분을 합쳐 targetCount개로 **통합 포스터 1장**을 만든다.
  const [checkedCategories, setCheckedCategories] = useState<Set<CategoryCode>>(new Set(['SEA']))
  const [selectedByCategory, setSelectedByCategory] = useState<Map<CategoryCode, number[]>>(
    new Map()
  )

  // 현재 활성 탭의 선택 목록 (읽기용)
  const selectedIds = useMemo(
    () => selectedByCategory.get(activeCategory) ?? [],
    [selectedByCategory, activeCategory]
  )

  // 체크된 모든 카테고리 상품 선택을 합친 통합 선택 리스트 (카테고리 순, 그 안에서 추가 순)
  const totalSelectedIds = useMemo(() => {
    const ids: number[] = []
    for (const cat of checkedCategories) {
      for (const id of selectedByCategory.get(cat) ?? []) ids.push(id)
    }
    return ids
  }, [checkedCategories, selectedByCategory])

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

  // 진행 모달 — 채널별 발행 실시간 상태
  const [progressItems, setProgressItems] = useState<DigestProgressItem[]>([])
  const [progressOpen, setProgressOpen] = useState(false)

  const { cols: gridCols, rows: gridRows, count: expectedCount } = getGridDims(collageSettings)
  const outOfRange = expectedCount < TARGET_MIN || expectedCount > TARGET_MAX
  const totalCount = totalSelectedIds.length
  const countMatches = totalCount === expectedCount

  const collageDefaultTitle = `오늘의${CATEGORY_MAP[activeCategory].name}추천`

  // 체크된 카테고리 요약 (카운트만 표시 — 카테고리별 정원 강제 없음)
  const categorySummary = useMemo(() => {
    return Array.from(checkedCategories).map((code) => ({
      code,
      name: CATEGORY_MAP[code].name,
      emoji: CATEGORY_MAP[code].emoji,
      count: selectedByCategory.get(code)?.length ?? 0,
    }))
  }, [checkedCategories, selectedByCategory])

  const canPublish =
    !outOfRange && countMatches && totalCount > 0 && selectedChannels.length > 0

  // 현재 활성 카테고리 기준 쇼핑몰 URL (설정 패널 미리보기용)
  const shopCategoryUrl = useMemo(() => {
    const firstSelected = selectedIds.map((id) => productMap.get(id)).find(Boolean)
    const subdomain = firstSelected?.shopProducts[0]?.shopSubdomain
    return subdomain ? `https://${SHOP_DOMAIN}/${subdomain}/category/${activeCategory}` : undefined
  }, [selectedIds, productMap, activeCategory])

  // 소매 밴드(발행 대상 채널) 로드
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

  const toggleProduct = (id: number) => {
    setSelectedByCategory((prev) => {
      const next = new Map(prev)
      const cur = next.get(activeCategory) ?? []
      if (cur.includes(id)) {
        next.set(activeCategory, cur.filter((x) => x !== id))
        return next
      }
      // 합산 상한(expectedCount) 체크
      let total = 0
      for (const cat of checkedCategories) {
        total += cat === activeCategory ? cur.length : (prev.get(cat)?.length ?? 0)
      }
      if (total >= expectedCount) {
        toast.error(`최대 ${expectedCount}개까지 선택할 수 있습니다 (현재 ${total}개).`)
        return prev
      }
      next.set(activeCategory, [...cur, id])
      return next
    })
  }

  const setAllSelectedForActive = (ids: number[]) => {
    setSelectedByCategory((prev) => {
      const next = new Map(prev)
      let totalExcludingActive = 0
      for (const cat of checkedCategories) {
        if (cat === activeCategory) continue
        totalExcludingActive += prev.get(cat)?.length ?? 0
      }
      const remaining = Math.max(0, expectedCount - totalExcludingActive)
      next.set(activeCategory, ids.slice(0, remaining))
      return next
    })
  }

  const toggleCategoryChecked = (code: CategoryCode) => {
    setCheckedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const toggleChannel = (id: number) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
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
    // 통합 포스터의 주 카테고리 — 첫 번째 체크된 카테고리를 메타용으로 사용
    const primaryCategory =
      Array.from(checkedCategories)[0] ?? activeCategory

    // 진행 모달 초기화 (채널별 1행)
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

      setSelectedByCategory(new Map())
      setSelectedChannels([])

      const finalFailed = initialItems.length > 0
        ? progressItems.filter((it) => it.status === 'failed').length
        : 0
      if (finalFailed === 0) toast.success(`${activeChannels.length}건 발행 완료`)
    } finally {
      setIsPublishing(false)
    }
  }

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
          💡 카테고리 버튼 체크박스로 여러 카테고리를 한 포스터에 섞을 수 있고, 탭 클릭으로 해당 카테고리 상품을 선택합니다.
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
              countMatches ? 'text-emerald-600' : totalCount > expectedCount ? 'text-red-600' : 'text-amber-600'
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
