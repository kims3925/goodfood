'use client'

import { useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Loading from '@/components/ui/Loading'
import ProcessedProductTab from './_components/ProcessedProductTab'

type PublishTab = 'unpublished' | 'published'

function ProductListPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = (searchParams.get('tab') as PublishTab) || 'unpublished'

  // autoOpenRegister: collected-product 리다이렉트에서 넘어올 때
  const [autoOpenRegister] = useState(
    searchParams.get('openRegister') === 'true'
  )

  // 탭별 카운트
  const [unpublishedCount, setUnpublishedCount] = useState<number | null>(null)
  const [publishedCount, setPublishedCount] = useState<number | null>(null)

  const handleTabChange = useCallback((tab: PublishTab) => {
    const params = new URLSearchParams()
    params.set('tab', tab)
    router.push(`/sourcing/product/list?${params.toString()}`)
  }, [router])

  const handleStatsLoaded = useCallback((stats: { total: number; published: number; unpublished: number }) => {
    setUnpublishedCount(stats.unpublished)
    setPublishedCount(stats.published)
  }, [])

  const tabs: { key: PublishTab; label: string }[] = [
    { key: 'unpublished', label: '미발행' },
    { key: 'published', label: '발행완료' },
  ]

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

        {/* 탭 메뉴 */}
        <div className="flex border-b border-gray-200 mb-6">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.key
            const count = tab.key === 'unpublished' ? unpublishedCount : publishedCount
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  {count !== null && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium ${
                        isActive
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* 콘텐츠 */}
        <ProcessedProductTab
          autoOpenRegister={autoOpenRegister}
          publishStatus={currentTab}
          onStatsLoaded={handleStatsLoaded}
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
