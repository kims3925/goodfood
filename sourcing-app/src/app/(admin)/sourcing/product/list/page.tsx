'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Loading from '@/components/ui/Loading'
import ProcessedProductTab from './_components/ProcessedProductTab'

function ProductListPageContent() {
  const searchParams = useSearchParams()

  // autoOpenRegister: collected-product 리다이렉트에서 넘어올 때
  const [autoOpenRegister] = useState(
    searchParams.get('openRegister') === 'true'
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">가공상품</h1>
          <p className="text-gray-600">
            AI로 변환한 상품을 관리하고 판매 상태를 설정합니다.
          </p>
        </div>

        {/* 콘텐츠 */}
        <ProcessedProductTab
          autoOpenRegister={autoOpenRegister}
        />
      </div>
    </div>
  )
}

export default function ProductListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loading /></div>}>
      <ProductListPageContent />
    </Suspense>
  )
}
