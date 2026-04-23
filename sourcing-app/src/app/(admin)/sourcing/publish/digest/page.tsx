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

interface FetchedProduct {
  id: number
  name: string
  description: string | null
  categoryId: string | null
  thumbnailUrl: string | null
  price: number | null
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
    setIsPublishing(true)
    try {
      const res = await fetch('/api/publish/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: activeCategory,
          productIds: selectedIds,
          channelIds: selectedChannels,
          headerText,
          footerText,
          maxImagesPerProduct,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || '발행 실패')
        return
      }
      const successes = (data.results || []).filter((r: any) => r.status === 'SUCCESS')
      const failures = (data.results || []).filter((r: any) => r.status === 'FAILED')
      if (successes.length > 0) {
        toast.success(`${successes.length}개 밴드에 종합 발행 완료 (상품 ${data.digest.productCount}개)`)
      }
      if (failures.length > 0) {
        console.error('[digest] 발행 실패:', failures)
        toast.error(`${failures.length}개 밴드 실패: ${failures[0].message || ''}`)
      }
      // 발행 후 상태 초기화
      setSelectedIds([])
      setSelectedChannels([])
      loadCategory(activeCategory)
    } catch (err: any) {
      console.error(err)
      toast.error(`발행 중 오류: ${err?.message || '알 수 없는 오류'}`)
    } finally {
      setIsPublishing(false)
    }
  }

  const productItems: DigestProductItem[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    thumbnailUrl: p.thumbnailUrl,
    images: p.images,
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
    </div>
  )
}
