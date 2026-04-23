'use client'

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
}

export default function CategoryTabs({ categories, active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {categories.map((cat) => {
        const isActive = active === cat.code
        return (
          <button
            key={cat.code}
            onClick={() => onChange(cat.code)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all min-h-[40px] ${
              isActive
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
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
