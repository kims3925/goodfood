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

/**
 * 광고/콜라주 페이지에서 공유하는 상품 로드 훅.
 * /api/publish/digest GET을 재활용 (categoryId + daysWithin 필터).
 */
export function useAdProducts(initialCategory: CategoryCode = 'SEA') {
  const [activeCategory, setActiveCategory] = useState<CategoryCode>(initialCategory)
  const [categories, setCategories] = useState<CategorySummary[]>(
    CATEGORY_LIST.map((c) => ({ code: c.code, name: c.name, emoji: c.emoji, label: c.label, count: 0 }))
  )
  const [products, setProducts] = useState<AdFetchedProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState<'today' | '3d' | '7d' | 'all'>('today')

  const reload = useCallback(
    async (code: CategoryCode = activeCategory, df: typeof dateFilter = dateFilter) => {
      setIsLoading(true)
      try {
        const qs = new URLSearchParams({ categoryId: code })
        if (df === 'today') qs.set('daysWithin', '1')
        else if (df === '3d') qs.set('daysWithin', '3')
        else if (df === '7d') qs.set('daysWithin', '7')
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
    [activeCategory, dateFilter]
  )

  useEffect(() => {
    reload(activeCategory, dateFilter)
  }, [activeCategory, dateFilter, reload])

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
  }
}
