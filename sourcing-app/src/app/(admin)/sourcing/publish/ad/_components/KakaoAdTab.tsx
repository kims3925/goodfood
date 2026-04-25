'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import Loading from '@/components/ui/Loading'
import Button from '@/components/ui/Button'
import { Sparkles } from 'lucide-react'
import CategoryTabs from '../../digest/_components/CategoryTabs'
import DigestProductList from '../../digest/_components/DigestProductList'
import { useAdProducts } from '../_hooks/useAdProducts'
import KakaoAdPreviewModal, { type KakaoAdCard } from './KakaoAdPreviewModal'

export type AdTitleColor = 'red' | 'blue' | 'green' | 'auto'

const MIN_SELECT = 1
const MAX_SELECT = 10
const RECOMMENDED = 6

export default function KakaoAdTab() {
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

  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [forceTitleColor, setForceTitleColor] = useState<AdTitleColor>('auto')
  const [enableBanner, setEnableBanner] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewCards, setPreviewCards] = useState<KakaoAdCard[]>([])
  const [previewBatchId, setPreviewBatchId] = useState<number | null>(null)
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null)

  useEffect(() => {
    setSelectedIds([])
  }, [activeCategory])

  const toggleProduct = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_SELECT) {
        toast.error(`최대 ${MAX_SELECT}개까지 선택할 수 있습니다.`)
        return prev
      }
      return [...prev, id]
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

  const handleGenerate = async () => {
    if (selectedIds.length < MIN_SELECT) {
      toast.error('상품을 1개 이상 선택하세요.')
      return
    }
    if (selectedIds.length > MAX_SELECT) {
      toast.error(`최대 ${MAX_SELECT}개까지 가능합니다.`)
      return
    }
    setIsGenerating(true)
    setGenerationStartedAt(Date.now())
    try {
      const res = await fetch('/api/ad/kakao/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: selectedIds,
          options: {
            forceTitleColor: forceTitleColor === 'auto' ? undefined : forceTitleColor,
            enableBanner,
          },
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || '광고 카드 생성에 실패했습니다.')
        return
      }
      setPreviewCards(data.cards as KakaoAdCard[])
      setPreviewBatchId(data.batch?.id ?? null)
      setPreviewOpen(true)
      toast.success(`광고 카드 ${data.cards.length}장 생성 완료 (${data.batch?.totalDurationSec}초)`)
    } catch (err: any) {
      toast.error(err?.message || '네트워크 오류')
    } finally {
      setIsGenerating(false)
      setGenerationStartedAt(null)
    }
  }

  const elapsed = generationStartedAt ? Math.round((Date.now() - generationStartedAt) / 1000) : 0

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

      <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3">
        <div className="text-xs font-semibold text-gray-700 mb-2">⚙️ 광고 옵션</div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">타이틀 색상:</span>
            {(['auto', 'red', 'blue', 'green'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForceTitleColor(c)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  forceTitleColor === c
                    ? c === 'red'
                      ? 'bg-red-500 text-white'
                      : c === 'blue'
                      ? 'bg-blue-600 text-white'
                      : c === 'green'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {c === 'auto' ? '자동' : c === 'red' ? '🔴 빨강' : c === 'blue' ? '🔵 파랑' : '🟢 녹색'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={enableBanner}
              onChange={(e) => setEnableBanner(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <span>강조 배너 (셀링키워드 있을 때만)</span>
          </label>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          💡 권장 {RECOMMENDED}개 / 최소 {MIN_SELECT}개 / 최대 {MAX_SELECT}개. AI(Claude Haiku)가 카드별 타이틀·본문을 자동 생성합니다.
        </p>
      </div>

      {isLoading ? (
        <div className="py-12"><Loading /></div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <DigestProductList
            products={productItems as any}
            selectedIds={selectedIds}
            onToggle={toggleProduct}
            onSelectAll={(ids) => setSelectedIds(ids.slice(0, MAX_SELECT))}
          />
        </div>
      )}

      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 py-3 -mx-4 sm:-mx-6 lg:-mx-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-30">
        <div className="text-sm text-gray-700">
          선택: <span className={`font-bold ${selectedIds.length > MAX_SELECT ? 'text-red-600' : 'text-blue-600'}`}>{selectedIds.length}</span>
          <span className="text-gray-400">/{MAX_SELECT}</span>
          {selectedIds.length === RECOMMENDED && (
            <span className="ml-2 text-xs text-emerald-600 font-medium">✨ 권장 개수</span>
          )}
          {isGenerating && (
            <span className="ml-3 text-xs text-blue-600">AI 생성 중… {elapsed}초 경과</span>
          )}
        </div>
        <Button
          variant="primary"
          disabled={selectedIds.length < MIN_SELECT || selectedIds.length > MAX_SELECT || isGenerating}
          loading={isGenerating}
          onClick={handleGenerate}
        >
          <Sparkles size={16} />
          🎨 광고 카드 생성 ({selectedIds.length}장)
        </Button>
      </div>

      <KakaoAdPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        cards={previewCards}
        batchId={previewBatchId}
        onCardUpdated={(updated) =>
          setPreviewCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        }
      />
    </div>
  )
}
