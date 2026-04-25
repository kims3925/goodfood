'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CATEGORY_LIST, type CategoryCode } from '@/modules/category/category.keywords'
import type { CategorySummary } from '../../digest/_components/CategoryTabs'

export interface AdFetchedProduct {
  id: number
  name: string
  description: string | null
  categoryId: string | null
  thumbnailUrl: string | null
  price: number | null
  createdAt?: string | null
  channel?: { id: number; name: string; orderDeadline?: string | null } | null
  variants: { id: number; optionSummary: string | null; price: number }[]
  images: { url: string; sortOrder: number }[]
  shopProducts: { id: number; shopId: number | null; shopName?: string | null; shopSubdomain?: string | null }[]
}

export interface WholesaleChannel {
  id: number
  name: string
}

/**
 * 광고/콜라주 페이지에서 공유하는 상품 로드 훅.
 * /api/publish/digest GET을 재활용 (categoryId + daysWithin + channelId 필터).
 */
export function useAdProducts(initialCategory: CategoryCode = 'SEA') {
  const [activeCategory, setActiveCategory] = useState<CategoryCode>(initialCategory)
  const [categories, setCategories] = useState<CategorySummary[]>(
    CATEGORY_LIST.map((c) => ({ code: c.code, name: c.name, emoji: c.emoji, label: c.label, count: 0 }))
  )
  const [products, setProducts] = useState<AdFetchedProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState<'today' | '3d' | '7d' | 'all'>('today')

  // 도매방(도매 채널) 필터 — null이면 전체
  const [wholesaleChannels, setWholesaleChannels] = useState<WholesaleChannel[]>([])
  const [wholesaleChannelId, setWholesaleChannelId] = useState<number | null>(null)

  // 도매 채널 목록 1회 로드
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/channel?kind=WHOLESALE&limit=100')
        const data = await res.json()
        if (!cancelled && data.success) {
          setWholesaleChannels(
            (data.data || []).map((ch: any) => ({ id: ch.id, name: ch.name }))
          )
        }
      } catch (err) {
        console.warn('[useAdProducts] 도매 채널 로드 실패', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const reload = useCallback(
    async (
      code: CategoryCode = activeCategory,
      df: typeof dateFilter = dateFilter,
      chId: number | null = wholesaleChannelId
    ) => {
      setIsLoading(true)
      try {
        const qs = new URLSearchParams({ categoryId: code })
        if (df === 'today') qs.set('daysWithin', '1')
        else if (df === '3d') qs.set('daysWithin', '3')
        else if (df === '7d') qs.set('daysWithin', '7')
        if (chId != null) qs.set('channelId', String(chId))
        const res = await fetch(`/api/publish/digest?${qs.toString()}`)
        const data = await res.json()
        if (data.success) {
          setProducts(data.data.products as AdFetchedProduct[])
          setCategories(data.data.categories as CategorySummary[])
        }
      } finally {
        setIsLoading(false)
      }
    },
    [activeCategory, dateFilter, wholesaleChannelId]
  )

  useEffect(() => {
    reload(activeCategory, dateFilter, wholesaleChannelId)
  }, [activeCategory, dateFilter, wholesaleChannelId, reload])

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  return {
    activeCategory,
    setActiveCategory,
    dateFilter,
    setDateFilter,
    categories,
    products,
    productMap,
    isLoading,
    reload,
    wholesaleChannels,
    wholesaleChannelId,
    setWholesaleChannelId,
  }
}
