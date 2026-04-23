'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import Loading from '@/components/ui/Loading'
import { buildDigest, type DigestProduct } from '@/modules/publish/digest-builder.service'
import { CATEGORY_LIST, type CategoryCode } from '@/modules/category/category.keywords'
import CategoryTabs, { type CategorySummary } from './_components/CategoryTabs'
import DigestProductList, { type DigestProductItem } from './_components/DigestProductList'
import DigestPreview from './_components/DigestPreview'
import DigestPublishBar from './_components/DigestPublishBar'
import DigestProgressModal, { type DigestProgressItem } from './_components/DigestProgressModal'

interface FetchedProduct {
  id: number
  name: string
  description: string | null
  categoryId: string | null
  thumbnailUrl: string | null
  price: number | null
  createdAt?: string | null
  lastDigestPublishedAt?: string | null
  channel?: {
    id: number
    name: string
    platform?: string
    kind?: string
    orderDeadline?: string | null
  } | null
  variants: { id: number; optionSummary: string | null; price: number }[]
  images: { url: string; sortOrder: number }[]
  shopProducts: {
    id: number
    shopId: number | null
    shopName?: string | null
    shopSubdomain?: string | null
  }[]
}

interface Channel {
  id: number
  name: string
}

const SHOP_DOMAIN = (process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'shop.abcpharm.net').replace(/\/$/, '')

export default function DigestPublishPage() {
  const toast = useToast()

  const [activeCategory, setActiveCategory] = useState<CategoryCode>('SEA')
  const [categories, setCategories] = useState<CategorySummary[]>(
    CATEGORY_LIST.map((c) => ({ code: c.code, name: c.name, emoji: c.emoji, label: c.label, count: 0 }))
  )
  const [products, setProducts] = useState<FetchedProduct[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [headerText, setHeaderText] = useState('')
  const [footerText, setFooterText] = useState('')
  const [maxImagesPerProduct, setMaxImagesPerProduct] = useState(1)

  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannels, setSelectedChannels] = useState<number[]>([])
  const [isPublishing, setIsPublishing] = useState(false)

  // 발행 진행 상태
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressItems, setProgressItems] = useState<DigestProgressItem[]>([])

  // 상품 필터 (카테고리 아래)
  const [wholesaleFilter, setWholesaleFilter] = useState<number | 'all'>('all')
  const [deadlineFilter, setDeadlineFilter] = useState<string | 'all'>('all')

  // ─── Load products + categories for a given category ───────────────────
  const loadCategory = useCallback(
    async (code: CategoryCode) => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/publish/digest?categoryId=${code}`)
        const data = await res.json()
        if (data.success) {
          setProducts(data.data.products as FetchedProduct[])
          setCategories(data.data.categories as CategorySummary[])
          setSelectedIds([]) // 카테고리 바뀌면 선택 초기화
        } else {
          toast.error(data.error || '상품을 불러오지 못했습니다.')
        }
      } catch (err) {
        console.error('[digest] load 실패', err)
        toast.error('상품 로드 중 오류가 발생했습니다.')
      } finally {
        setIsLoading(false)
      }
    },
    [toast]
  )

  useEffect(() => {
    loadCategory(activeCategory)
  }, [activeCategory, loadCategory])

  // ─── Load retail channels once ─────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/channel?kind=RETAIL&limit=100')
        const data = await res.json()
        if (data.success) {
          const list = (data.data || []).map((ch: any) => ({ id: ch.id, name: ch.name }))
          setChannels(list)
        }
      } catch (err) {
        console.warn('[digest] channel load 실패', err)
      }
    })()
  }, [])

  // ─── Derived state: selected product objects in order ──────────────────
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const digestProducts: DigestProduct[] = useMemo(() => {
    return selectedIds
      .map((id) => productMap.get(id))
      .filter((p): p is FetchedProduct => !!p)
      .map((p) => {
        const firstShop = p.shopProducts[0]
        const shopProductUrl = firstShop?.shopSubdomain
          ? `https://${SHOP_DOMAIN}/${firstShop.shopSubdomain}/product/${p.id}`
          : undefined
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          variants: p.variants.map((v) => ({ optionSummary: v.optionSummary || '', price: v.price })),
          images: p.images,
          shopProductUrl,
        }
      })
  }, [selectedIds, productMap])

  const preview = useMemo(
    () =>
      buildDigest({
        category: activeCategory,
        products: digestProducts,
        headerText,
        footerText,
        maxImagesPerProduct,
      }),
    [activeCategory, digestProducts, headerText, footerText, maxImagesPerProduct]
  )

  // ─── Handlers ───────────────────────────────────────────────────────────
  const toggleProduct = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }
  const toggleChannel = (id: number) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handlePublish = async () => {
    if (selectedIds.length === 0 || selectedChannels.length === 0) return

    // 진행 모달 초기화 — 선택한 채널마다 pending 행 생성
    const initItems: DigestProgressItem[] = selectedChannels.map((channelId) => {
      const ch = channels.find((c) => c.id === channelId)
      return {
        channelId,
        channelName: ch?.name || `채널 ${channelId}`,
        status: 'pending',
      }
    })
    setProgressItems(initItems)
    setProgressOpen(true)
    setIsPublishing(true)

    let totalSuccess = 0
    let totalFailed = 0

    try {
      for (const channelId of selectedChannels) {
        // publishing 상태로
        setProgressItems((prev) =>
          prev.map((p) => (p.channelId === channelId ? { ...p, status: 'publishing' } : p))
        )

        try {
          const res = await fetch('/api/publish/digest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categoryId: activeCategory,
              productIds: selectedIds,
              channelId,
              headerText,
              footerText,
              maxImagesPerProduct,
            }),
          })
          const data = await res.json()
          const result = data.result || {}
          const status: 'success' | 'failed' =
            result.status === 'SUCCESS' ? 'success' : 'failed'

          setProgressItems((prev) =>
            prev.map((p) =>
              p.channelId === channelId
                ? { ...p, status, message: result.message || (status === 'failed' ? data.error : undefined) }
                : p
            )
          )
          if (status === 'success') totalSuccess++
          else totalFailed++
        } catch (err: any) {
          setProgressItems((prev) =>
            prev.map((p) =>
              p.channelId === channelId
                ? { ...p, status: 'failed', message: err?.message || '네트워크 오류' }
                : p
            )
          )
          totalFailed++
        }
      }

      if (totalSuccess > 0) {
        toast.success(`${totalSuccess}개 밴드에 종합 발행 완료`)
      }
      if (totalFailed > 0) {
        toast.error(`${totalFailed}개 밴드 발행 실패`)
      }
      // 발행 후 상태 초기화 + 상품 목록 새로고침 (lastDigestPublishedAt 반영)
      setSelectedIds([])
      setSelectedChannels([])
      loadCategory(activeCategory)
    } finally {
      setIsPublishing(false)
    }
  }

  // 도매방(WHOLESALE) 옵션 추출
  const wholesaleOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; count: number }>()
    for (const p of products) {
      if (!p.channel?.id) continue
      const existing = map.get(p.channel.id)
      if (existing) {
        existing.count++
      } else {
        map.set(p.channel.id, { id: p.channel.id, name: p.channel.name, count: 1 })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [products])

  // 마감시간 옵션 추출 ("(미설정)"도 한 카테고리로)
  const deadlineOptions = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      const key = p.channel?.orderDeadline?.trim() || '(미설정)'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  }, [products])

  // 필터 적용된 상품
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (wholesaleFilter !== 'all' && p.channel?.id !== wholesaleFilter) return false
      if (deadlineFilter !== 'all') {
        const key = p.channel?.orderDeadline?.trim() || '(미설정)'
        if (key !== deadlineFilter) return false
      }
      return true
    })
  }, [products, wholesaleFilter, deadlineFilter])

  const productItems: DigestProductItem[] = filteredProducts.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    thumbnailUrl: p.thumbnailUrl,
    images: p.images,
    createdAt: p.createdAt,
    lastDigestPublishedAt: p.lastDigestPublishedAt,
    channel: p.channel
      ? { id: p.channel.id, name: p.channel.name, orderDeadline: p.channel.orderDeadline || null }
      : null,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">종합 발행</h1>
          <p className="text-sm text-gray-600 mt-1">
            카테고리별 상품을 묶어 하나의 밴드 게시글로 발행합니다. (최대 20개 상품 / 총 20장 이미지)
          </p>
        </div>

        <div className="mb-4">
          <CategoryTabs categories={categories} active={activeCategory} onChange={setActiveCategory} />
        </div>

        {/* 도매방 / 마감시간 필터 */}
        {(wholesaleOptions.length > 0 || deadlineOptions.length > 0) && (
          <div className="mb-4 space-y-2 bg-white border border-gray-200 rounded-lg p-3">
            {wholesaleOptions.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 flex-shrink-0">🏪 도매방:</span>
                <button
                  type="button"
                  onClick={() => setWholesaleFilter('all')}
                  className={`text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                    wholesaleFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체 ({products.length})
                </button>
                {wholesaleOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setWholesaleFilter(opt.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                      wholesaleFilter === opt.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={opt.name}
                  >
                    {opt.name} ({opt.count})
                  </button>
                ))}
              </div>
            )}
            {deadlineOptions.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 flex-shrink-0">⏰ 마감시간:</span>
                <button
                  type="button"
                  onClick={() => setDeadlineFilter('all')}
                  className={`text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                    deadlineFilter === 'all' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                {deadlineOptions.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setDeadlineFilter(opt.label)}
                    className={`text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                      deadlineFilter === opt.label ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label} ({opt.count})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="py-20">
            <Loading />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-3/5">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <DigestProductList
                  products={productItems}
                  selectedIds={selectedIds}
                  onToggle={toggleProduct}
                  onSelectAll={setSelectedIds}
                />
              </div>
            </div>
            <div className="w-full lg:w-2/5 lg:sticky lg:top-4 lg:self-start">
              <DigestPreview
                preview={preview}
                headerText={headerText}
                footerText={footerText}
                onHeaderChange={setHeaderText}
                onFooterChange={setFooterText}
                maxImagesPerProduct={maxImagesPerProduct}
                onMaxImagesChange={setMaxImagesPerProduct}
              />
            </div>
          </div>
        )}
      </div>

      <DigestPublishBar
        selectedCount={selectedIds.length}
        imageCount={preview.imageUrls.length}
        channels={channels}
        selectedChannels={selectedChannels}
        onToggleChannel={toggleChannel}
        onPublish={handlePublish}
        isPublishing={isPublishing}
      />

      <DigestProgressModal
        isOpen={progressOpen}
        items={progressItems}
        digestTitle={preview.title}
        productCount={preview.productCount}
        imageCount={preview.imageUrls.length}
        canClose={!isPublishing}
        onClose={() => setProgressOpen(false)}
      />
    </div>
  )
}
