'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Lock, Plus, Pencil, Trash2, ExternalLink, Package } from 'lucide-react'
import Loading from '@/components/ui/Loading'
import {
  CATEGORY_LIST,
  CATEGORY_MAP,
  type CategoryCode,
} from '@/modules/category/category.keywords'

interface CategoryStat {
  code: CategoryCode
  name: string
  emoji: string
  label?: string
  count: number
}

interface FetchedProduct {
  id: number
  name: string
  categoryId: string | null
  thumbnailUrl: string | null
  price: number | null
  createdAt?: string | null
  channel?: { id: number; name: string } | null
  shopProducts?: { id: number; shopName?: string | null; shopSubdomain?: string | null }[]
}

const SHOP_DOMAIN = (process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'shop.abcpharm.net').replace(/\/$/, '')

/**
 * 쇼핑몰 > 카테고리 (조회 전용)
 *
 * 현재 7개 고정 카테고리(SEA/AGR/MEA/MKT/PRC/HLT/ETC)는 코드 상수로 관리되며,
 * AI 분류기/발행 파이프라인 전반이 같은 상수를 전제로 동작한다.
 * 추가/수정/삭제는 DB Category 모델 이관 이후 제공 예정. 본 페이지는 그 전까지
 * 매니저가 카테고리별 상품 현황을 파악하는 용도로만 사용.
 */
export default function ShopCategoryListPage() {
  const [categories, setCategories] = useState<CategoryStat[]>(
    CATEGORY_LIST.map((c) => ({ code: c.code, name: c.name, emoji: c.emoji, label: c.label, count: 0 }))
  )
  const [active, setActive] = useState<CategoryCode>('SEA')
  const [products, setProducts] = useState<FetchedProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [disabledNoticeOpen, setDisabledNoticeOpen] = useState(false)

  const activeMeta = CATEGORY_MAP[active]

  // 카테고리별 상품 로드 (digest GET 재활용: 분포 + 상품 리스트 제공)
  const load = async (code: CategoryCode) => {
    setIsLoading(true)
    try {
      const qs = new URLSearchParams({ categoryId: code })
      const res = await fetch(`/api/publish/digest?${qs.toString()}`)
      const data = await res.json()
      if (data.success) {
        setProducts(data.data.products as FetchedProduct[])
        setCategories(data.data.categories as CategoryStat[])
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load(active)
  }, [active])

  const totalProducts = useMemo(
    () => categories.reduce((sum, c) => sum + c.count, 0),
    [categories]
  )

  const DisabledActionButton = ({
    icon: Icon,
    label,
  }: {
    icon: typeof Plus
    label: string
  }) => (
    <button
      type="button"
      onClick={() => setDisabledNoticeOpen(true)}
      title="카테고리 CRUD는 DB 모델 이관 이후 제공 예정"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-400 text-xs font-medium cursor-not-allowed hover:bg-gray-200"
    >
      <Icon size={14} />
      {label}
      <Lock size={11} />
    </button>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">카테고리</h1>
          <p className="mt-1 text-sm text-gray-600">
            쇼핑몰에 노출되는 {categories.length}개 카테고리와 카테고리별 상품 현황입니다.
            전체 상품 {totalProducts.toLocaleString()}개.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DisabledActionButton icon={Plus} label="카테고리 추가" />
          <DisabledActionButton icon={Pencil} label="이름/이모지 수정" />
          <DisabledActionButton icon={Trash2} label="삭제" />
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
        <Lock size={14} className="mt-0.5 flex-shrink-0" />
        <div>
          현재 카테고리는 <code className="px-1 bg-amber-100 rounded">category.keywords.ts</code> 코드 상수로 관리되며
          AI 자동 분류기·발행 파이프라인 전반에서 참조됩니다. 추가/수정/삭제 기능은 DB
          <code className="px-1 bg-amber-100 rounded">Category</code>/<code className="px-1 bg-amber-100 rounded">CategoryKeyword</code>
          모델 이관 이후 별도 릴리스에서 제공됩니다. 지금은 조회와 카테고리별 상품 확인만 가능합니다.
        </div>
      </div>

      {/* 카테고리 카드 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {categories.map((c) => {
          const isActive = c.code === active
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => setActive(c.code)}
              className={`flex flex-col items-center gap-1 p-4 rounded-xl border transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-200'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="text-3xl" aria-hidden="true">
                {c.emoji}
              </span>
              <span className={`text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                {c.name}
              </span>
              <span className={`text-xs ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                {c.count.toLocaleString()}개
              </span>
            </button>
          )
        })}
      </div>

      {/* 선택된 카테고리의 상품 리스트 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xl">{activeMeta.emoji}</span>
            <h2 className="text-base font-bold text-gray-900">
              {activeMeta.name}
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({products.length}건)
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link
              href={`/sourcing/publish?categoryId=${active}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
            >
              <ExternalLink size={12} /> 발행 페이지 필터 열기
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12">
            <Loading />
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-sm text-gray-500">
            <Package size={28} className="text-gray-300" />
            {activeMeta.name} 카테고리에 등록된 상품이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">상품</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">가격</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">도매 채널</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">쇼핑몰</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">관리</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const firstShop = p.shopProducts?.[0]
                  const shopUrl = firstShop?.shopSubdomain
                    ? `https://${SHOP_DOMAIN}/${firstShop.shopSubdomain}/product/${p.id}`
                    : null
                  return (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500 text-xs">{p.id}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          {p.thumbnailUrl ? (
                            <div className="relative w-10 h-10 rounded-md overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-50">
                              <Image
                                src={p.thumbnailUrl}
                                alt=""
                                fill
                                sizes="40px"
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-gray-100 flex-shrink-0" />
                          )}
                          <span className="text-gray-900 line-clamp-2" title={p.name}>
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                        {typeof p.price === 'number' ? `${p.price.toLocaleString()}원` : '-'}
                      </td>
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                        {p.channel?.name ?? '-'}
                      </td>
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                        {firstShop?.shopName ? (
                          shopUrl ? (
                            <a
                              href={shopUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              {firstShop.shopName}
                              <ExternalLink size={11} />
                            </a>
                          ) : (
                            firstShop.shopName
                          )
                        ) : (
                          <span className="text-gray-400">미연동</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/sourcing/product/list?search=${encodeURIComponent(p.name)}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          가공상품
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CRUD 비활성 안내 모달 */}
      {disabledNoticeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDisabledNoticeOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-2">카테고리 편집은 아직 제공되지 않습니다</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              현재 카테고리 체계는 코드 상수(<code className="px-1 bg-gray-100 rounded text-xs">category.keywords.ts</code>)
              로 관리되며, AI 자동 분류기의 키워드 사전·발행 파이프라인·쇼핑몰 카테고리 페이지가
              모두 동일한 상수를 전제로 동작합니다.
            </p>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              추가/수정/삭제 기능은 DB 이관(<code className="px-1 bg-gray-100 rounded text-xs">Category</code>,{' '}
              <code className="px-1 bg-gray-100 rounded text-xs">CategoryKeyword</code> 모델 신설)과 분류 로직 개편이 완료된
              후 별도 릴리스에서 제공됩니다.
            </p>
            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setDisabledNoticeOpen(false)}
                className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
