'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORY_MAP, CATEGORY_CODES, type CategoryCode } from '@/lib/categories'
import { useShopUrl } from '@/hooks/useShopUrl'

/**
 * 쇼핑몰 헤더 하단 카테고리 네비게이션.
 *
 * - 8개 카테고리(SEA/AGR/MEA/MKT/PRC/HLT/COM/ETC)를 가로 스크롤 바로 노출
 * - 현재 활성 카테고리는 강조 색상 처리 (/[slug]/category/[code] 경로일 때)
 * - 기존 /category/[code] 페이지로 라우팅
 */
export default function CategoryNav() {
  const { getPath } = useShopUrl()
  const pathname = usePathname()

  const activeCode: CategoryCode | null = (() => {
    const m = pathname?.match(/\/category\/([A-Z]+)(?:$|\/|\?)/)
    if (!m) return null
    const code = m[1]
    return (CATEGORY_CODES as readonly string[]).includes(code) ? (code as CategoryCode) : null
  })()

  return (
    <nav aria-label="카테고리" className="border-b border-gray-200 bg-white">
      <div className="kurly-container">
        <ul className="flex gap-1 overflow-x-auto py-2 -mx-2 px-2 sm:mx-0 sm:px-0">
          {CATEGORY_CODES.map((code) => {
            const cat = CATEGORY_MAP[code]
            const isActive = activeCode === code
            return (
              <li key={code} className="flex-shrink-0">
                <Link
                  href={getPath(`/category/${code}`)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-abc-coral text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {cat.emoji}
                  </span>
                  <span className="font-medium">{cat.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
