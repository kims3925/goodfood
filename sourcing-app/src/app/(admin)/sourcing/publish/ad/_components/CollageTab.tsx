'use client'

import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import Loading from '@/components/ui/Loading'
import Button from '@/components/ui/Button'
import { CATEGORY_MAP, type CategoryCode } from '@/modules/category/category.keywords'
import CategoryTabs from '../../digest/_components/CategoryTabs'
import DigestProductList from '../../digest/_components/DigestProductList'
import DigestSettingsPanel, {
  gridSizeToCount,
  gridSizeToColsRows,
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
  } = useAdProducts('SEA')

  // 다중 카테고리 상태 — 체크박스로 선택, 카테고리별 상품 선택을 별도 Map으로 유지.
  // 탭을 전환해도 다른 카테고리의 선택 상태가 유지된다.
  const [checkedCategories, setCheckedCategories] = useState<Set<CategoryCode>>(new Set(['SEA']))
  const [selectedByCategory, setSelectedByCategory] = useState<Map<CategoryCode, number[]>>(
    new Map()
  )

  // 현재 활성 탭의 선택 목록 (읽기용)
  const selectedIds = useMemo(
    () => selectedByCategory.get(activeCategory) ?? [],
    [selectedByCategory, activeCategory]
  )

  const [collageSettings, setCollageSettings] = useState<CollageSettingsValue>({
    collageTitle: '',
    topBadgeText: '',
    gridSize: '3x4',
    removeBackground: true,
  })
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannels, setSelectedChannels] = useState<number[]>([])
  const [isPublishing, setIsPublishing] = useState(false)

  // 진행 모달 — (카테고리 × 채널) 각 발행의 실시간 상태
  const [progressItems, setProgressItems] = useState<DigestProgressItem[]>([])
  const [progressOpen, setProgressOpen] = useState(false)

  const expectedCount = gridSizeToCount(collageSettings.gridSize)
  const collageDefaultTitle = `오늘의${CATEGORY_MAP[activeCategory].name}추천`

  // 발행 대상 카테고리 요약 (체크된 것들의 선택 진행도)
  const categorySummary = useMemo(() => {
    return Array.from(checkedCategories).map((code) => {
      const count = selectedByCategory.get(code)?.length ?? 0
      return {
        code,
        name: CATEGORY_MAP[code].name,
        emoji: CATEGORY_MAP[code].emoji,
        count,
        ok: count === expectedCount,
      }
    })
  }, [checkedCategories, selectedByCategory, expectedCount])

  const allCategoriesReady =
    categorySummary.length > 0 && categorySummary.every((c) => c.ok)

  // 현재 탭의 쇼핑몰 카테고리 링크 (설정 패널 미리보기용)
  const shopCategoryUrl = useMemo(() => {
    const firstSelected = selectedIds.map((id) => productMap.get(id)).find(Boolean)
    const subdomain = firstSelected?.shopProducts[0]?.shopSubdomain
    return subdomain ? `https://${SHOP_DOMAIN}/${subdomain}/category/${activeCategory}` : undefined
  }, [selectedIds, productMap, activeCategory])

  // 채널 로드
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
      next.set(activeCategory, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])
      return next
    })
  }

  const setAllSelectedForActive = (ids: number[]) => {
    setSelectedByCategory((prev) => {
      const next = new Map(prev)
      next.set(activeCategory, ids)
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
    if (!allCategoriesReady) {
      const failing = categorySummary
        .filter((c) => !c.ok)
        .map((c) => `${c.name}(${c.count}/${expectedCount})`)
        .join(', ')
      toast.error(`선택 부족: ${failing || '체크된 카테고리 없음'}`)
      return
    }
    if (selectedChannels.length === 0) {
      toast.error('발행할 소매밴드를 선택하세요.')
      return
    }
    const totalPublish = categorySummary.length * selectedChannels.length
    if (
      !window.confirm(
        `카테고리 ${categorySummary.length}개 × 밴드 ${selectedChannels.length}개 = ${totalPublish}건을 발행합니다.\n각 카테고리는 개별 콜라주 포스터 1장으로 발행됩니다.\n계속할까요?`
      )
    ) {
      return
    }

    const activeChannels = channels.filter((c) => selectedChannels.includes(c.id))

    // 진행 모달 초기화: (카테고리 × 채널) 모든 조합을 pending 상태로
    const initialItems: DigestProgressItem[] = []
    for (const cat of categorySummary) {
      for (const ch of activeChannels) {
        initialItems.push({
          channelId: ch.id,
          channelName: ch.name,
          categoryCode: cat.code,
          categoryLabel: `${cat.emoji} ${cat.name}`,
          status: 'pending',
        })
      }
    }
    setProgressItems(initialItems)
    setProgressOpen(true)
    setIsPublishing(true)

    try {
      const { cols, rows } = gridSizeToColsRows(collageSettings.gridSize)

      for (let catIdx = 0; catIdx < categorySummary.length; catIdx++) {
        const cat = categorySummary[catIdx]
        const productIds = selectedByCategory.get(cat.code) ?? []

        for (let chIdx = 0; chIdx < activeChannels.length; chIdx++) {
          const channelId = activeChannels[chIdx].id
          const itemIdx = catIdx * activeChannels.length + chIdx

          // publishing 상태로 표시
          setProgressItems((prev) => {
            const next = [...prev]
            next[itemIdx] = { ...next[itemIdx], status: 'publishing' }
            return next
          })

          try {
            const res = await fetch('/api/publish/digest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                categoryId: cat.code,
                productIds,
                channelId,
                publishMode: 'collage',
                collageOptions: {
                  title: collageSettings.collageTitle.trim() || undefined,
                  gridCols: cols,
                  gridRows: rows,
                  removeBackground: collageSettings.removeBackground,
                  topBadgeText: collageSettings.topBadgeText.trim() || undefined,
                },
              }),
            })
            const data = await res.json()
            const ok = data.result?.status === 'SUCCESS'
            setProgressItems((prev) => {
              const next = [...prev]
              next[itemIdx] = {
                ...next[itemIdx],
                status: ok ? 'success' : 'failed',
                message: data.result?.message || data.error,
              }
              return next
            })
          } catch (err: any) {
            setProgressItems((prev) => {
              const next = [...prev]
              next[itemIdx] = {
                ...next[itemIdx],
                status: 'failed',
                message: err?.message || '요청 오류',
              }
              return next
            })
          }
        }
      }

      // 발행 완료 후 선택만 초기화. 진행 모달은 사용자가 닫을 때까지 유지.
      setSelectedByCategory(new Map())
      setSelectedChannels([])

      const successCount = initialItems.length
      const finalFailed = progressItems.filter((i) => i.status === 'failed').length
      if (finalFailed === 0) toast.success(`${successCount}건 발행 완료`)
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
          💡 카테고리 버튼의 체크박스로 발행 대상을 선택하고, 탭 클릭으로 해당 카테고리 상품을 고르세요.
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
      </div>

      <DigestSettingsPanel
        value={collageSettings}
        onChange={setCollageSettings}
        shopCategoryUrl={shopCategoryUrl}
        defaultTitle={collageDefaultTitle}
      />

      {/* 발행 대상 요약 */}
      {categorySummary.length > 0 && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs font-semibold text-blue-900 mb-2">
            📌 발행 대상 카테고리 ({categorySummary.length}개) · 각 {expectedCount}개 선택 필요
          </div>
          <div className="flex flex-wrap gap-2">
            {categorySummary.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setActiveCategory(c.code)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  c.ok
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                } ${c.code === activeCategory ? 'ring-2 ring-blue-400' : ''}`}
              >
                {c.emoji} {c.name} {c.count}/{expectedCount}
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
          <span className={`font-bold ${allCategoriesReady ? 'text-blue-600' : 'text-amber-600'}`}>
            {categorySummary.length}개 카테고리
          </span>
          <span className="mx-2">·</span>
          현재 탭{' '}
          <span
            className={`font-bold ${
              selectedIds.length === expectedCount ? 'text-emerald-600' : 'text-gray-700'
            }`}
          >
            {selectedIds.length}/{expectedCount}
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
            disabled={!allCategoriesReady || selectedChannels.length === 0 || isPublishing}
            loading={isPublishing}
            onClick={handlePublish}
            className="ml-2"
          >
            🖼️{' '}
            {allCategoriesReady
              ? `콜라주 발행 (${categorySummary.length}×${selectedChannels.length}건)`
              : `선택 부족`}
          </Button>
        </div>
      </div>

      <DigestProgressModal
        isOpen={progressOpen}
        items={progressItems}
        digestTitle={
          collageSettings.collageTitle.trim() ||
          (categorySummary.length > 0
            ? categorySummary.map((c) => `오늘의${c.name}추천`).join(' · ')
            : collageDefaultTitle)
        }
        productCount={categorySummary.reduce((sum, c) => sum + c.count, 0)}
        imageCount={categorySummary.length}
        onClose={() => setProgressOpen(false)}
        canClose={!isPublishing}
      />
    </div>
  )
}
