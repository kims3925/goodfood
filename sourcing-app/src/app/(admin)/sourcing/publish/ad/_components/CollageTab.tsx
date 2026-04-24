'use client'

import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import Loading from '@/components/ui/Loading'
import Button from '@/components/ui/Button'
import { CATEGORY_MAP } from '@/modules/category/category.keywords'
import CategoryTabs from '../../digest/_components/CategoryTabs'
import DigestProductList from '../../digest/_components/DigestProductList'
import DigestSettingsPanel, {
  gridSizeToCount,
  gridSizeToColsRows,
  type CollageSettingsValue,
} from '../../digest/_components/DigestSettingsPanel'
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

  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [collageSettings, setCollageSettings] = useState<CollageSettingsValue>({
    collageTitle: '',
    topBadgeText: '',
    gridSize: '3x4',
    removeBackground: true,
  })
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannels, setSelectedChannels] = useState<number[]>([])
  const [isPublishing, setIsPublishing] = useState(false)

  const expectedCount = gridSizeToCount(collageSettings.gridSize)
  const collageMismatch = selectedIds.length !== expectedCount
  const collageDefaultTitle = `오늘의${CATEGORY_MAP[activeCategory].name}추천`
  const shopCategoryUrl = useMemo(() => {
    const firstSelected = selectedIds.map((id) => productMap.get(id)).find(Boolean)
    const subdomain = firstSelected?.shopProducts[0]?.shopSubdomain
    return subdomain ? `https://${SHOP_DOMAIN}/${subdomain}/category/${activeCategory}` : undefined
  }, [selectedIds, productMap, activeCategory])

  // 카테고리 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIds([])
  }, [activeCategory])

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
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const toggleChannel = (id: number) => {
    setSelectedChannels((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
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
    if (collageMismatch) {
      toast.error(`정확히 ${expectedCount}개 상품을 선택하세요 (현재 ${selectedIds.length}개).`)
      return
    }
    if (selectedChannels.length === 0) {
      toast.error('발행할 소매밴드를 선택하세요.')
      return
    }
    if (!window.confirm(`${expectedCount}개 상품을 콜라주 포스터 1장으로 ${selectedChannels.length}개 밴드에 발행합니다.\n계속할까요?`)) {
      return
    }

    setIsPublishing(true)
    let success = 0
    let failed = 0

    try {
      for (const channelId of selectedChannels) {
        try {
          const { cols, rows } = gridSizeToColsRows(collageSettings.gridSize)
          const res = await fetch('/api/publish/digest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categoryId: activeCategory,
              productIds: selectedIds,
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
          if (ok) success++
          else failed++
        } catch (err: any) {
          failed++
        }
      }
      if (success > 0) toast.success(`${success}개 밴드에 콜라주 발행 완료`)
      if (failed > 0) toast.error(`${failed}개 밴드 발행 실패`)
      setSelectedIds([])
      setSelectedChannels([])
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div>
      <div className="mb-3">
        <CategoryTabs categories={categories} active={activeCategory} onChange={setActiveCategory} />
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

      {isLoading ? (
        <div className="py-12"><Loading /></div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <DigestProductList
            products={productItems as any}
            selectedIds={selectedIds}
            onToggle={toggleProduct}
            onSelectAll={setSelectedIds}
          />
        </div>
      )}

      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 py-3 -mx-4 sm:-mx-6 lg:-mx-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-30">
        <div className="text-sm text-gray-700">
          <span className={`font-bold ${collageMismatch ? 'text-red-600' : 'text-blue-600'}`}>
            {selectedIds.length}/{expectedCount}개
          </span> 선택 (콜라주 모드)
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">발행 밴드:</span>
          {channels.length === 0 && <span className="text-xs text-gray-400">등록된 소매밴드 없음</span>}
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
            disabled={collageMismatch || selectedChannels.length === 0 || isPublishing}
            loading={isPublishing}
            onClick={handlePublish}
            className="ml-2"
          >
            🖼️ {collageMismatch ? `${expectedCount}개 선택 필요` : `콜라주 발행 (${expectedCount}장 → 포스터 1장)`}
          </Button>
        </div>
      </div>
    </div>
  )
}
