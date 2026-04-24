'use client'

import { Check } from 'lucide-react'
import type { CategoryCode } from '@/modules/category/category.keywords'

export interface CategorySummary {
  code: CategoryCode
  name: string
  emoji: string
  label?: string
  count: number
}

interface Props {
  categories: CategorySummary[]
  active: CategoryCode
  onChange: (code: CategoryCode) => void
  /** 다중 선택: 체크된 카테고리 코드 집합 */
  checked?: Set<CategoryCode>
  /** 체크박스 토글 핸들러 (제공되면 체크박스 UI 활성화) */
  onToggleChecked?: (code: CategoryCode) => void
}

export default function CategoryTabs({
  categories,
  active,
  onChange,
  checked,
  onToggleChecked,
}: Props) {
  const multi = !!onToggleChecked
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {categories.map((cat) => {
        const isActive = active === cat.code
        const isChecked = checked?.has(cat.code) ?? false
        return (
          <button
            key={cat.code}
            onClick={() => onChange(cat.code)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all min-h-[40px] ${
              isActive
                ? 'bg-blue-600 text-white shadow-md'
                : isChecked
                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {multi && (
              <span
                role="checkbox"
                aria-checked={isChecked}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleChecked?.(cat.code)
                }}
                className={`inline-flex items-center justify-center w-5 h-5 rounded border cursor-pointer transition-colors ${
                  isChecked
                    ? isActive
                      ? 'bg-white border-white text-blue-600'
                      : 'bg-blue-600 border-blue-600 text-white'
                    : isActive
                    ? 'bg-white/20 border-white/60 text-transparent hover:bg-white/30'
                    : 'bg-white border-gray-300 text-transparent hover:border-blue-400'
                }`}
                title={isChecked ? '발행 제외' : '발행 포함'}
              >
                <Check size={14} strokeWidth={3} />
              </span>
            )}
            <span>{cat.emoji}</span>
            <span>{cat.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                isActive ? 'bg-white/20' : 'bg-white/60 text-gray-700'
              }`}
            >
              {cat.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
