'use client'

import KakaoAdTab from '../_components/KakaoAdTab'

export default function KakaoAdPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">카톡광고</h1>
          <p className="text-sm text-gray-600 mt-1">
            AI가 카드별 카피 자동 생성 → 720×1280 PNG → ZIP 다운로드
          </p>
        </div>
        <KakaoAdTab />
      </div>
    </div>
  )
}
