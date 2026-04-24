'use client'

import { useState } from 'react'
import { Image as ImageIcon, MessageCircle } from 'lucide-react'
import CollageTab from './_components/CollageTab'
import KakaoAdTab from './_components/KakaoAdTab'

type AdTab = 'collage' | 'kakao'

const TABS: Array<{ value: AdTab; label: string; icon: any; desc: string }> = [
  { value: 'collage', label: '🖼️ 콜라주 발행', icon: ImageIcon, desc: '12개 상품을 배경 제거된 포스터 1장으로 합성해 소매밴드에 발행' },
  { value: 'kakao', label: '📱 카톡 광고 발행', icon: MessageCircle, desc: 'AI가 카드별 카피 자동 생성 → 720×1280 PNG → ZIP 다운로드' },
]

export default function AdPage() {
  const [tab, setTab] = useState<AdTab>('collage')
  const activeMeta = TABS.find((t) => t.value === tab)!

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">광고</h1>
          <p className="text-sm text-gray-600 mt-1">{activeMeta.desc}</p>
        </div>

        <div className="mb-5 border-b border-gray-200 flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.value
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'collage' && <CollageTab />}
        {tab === 'kakao' && <KakaoAdTab />}
      </div>
    </div>
  )
}
