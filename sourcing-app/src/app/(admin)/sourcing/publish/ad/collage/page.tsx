'use client'

import CollageTab from '../_components/CollageTab'

export default function CollagePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">콜라주</h1>
          <p className="text-sm text-gray-600 mt-1">
            상품 N개를 배경 제거된 포스터 1장으로 합성해 소매밴드에 발행
          </p>
        </div>
        <CollageTab />
      </div>
    </div>
  )
}
