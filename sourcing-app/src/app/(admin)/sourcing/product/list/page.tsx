'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Package } from 'lucide-react'
import Loading from '@/components/ui/Loading'
import RawProductTab from './_components/RawProductTab'
import ProcessedProductTab from './_components/ProcessedProductTab'

type TabKey = 'raw' | 'processed'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'raw', label: '미가공' },
  { key: 'processed', label: '가공완료' },
]

function ProductListPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = (searchParams.get('tab') as TabKey) || 'raw'

  // 탭별 카운트
  const [rawCount, setRawCount] = useState<number | null>(null)
  const [processedCount, setProcessedCount] = useState<number | null>(null)

  // autoOpenRegister: collected-product 리다이렉트에서 넘어올 때
  const [autoOpenRegister, setAutoOpenRegister] = useState(
    searchParams.get('openRegister') === 'true'
  )

  const handleTabChange = useCallback((tab: TabKey) => {
    const params = new URLSearchParams()
    params.set('tab', tab)
    router.push(`/sourcing/product/list?${params.toString()}`)
  }, [router])

  const handleRawTotalLoaded = useCallback((total: number) => {
    setRawCount(total)
  }, [])

  const handleProcessedStatsLoaded = useCallback((stats: { total: number }) => {
    setProcessedCount(stats.total)
  }, [])

  const handleSwitchToProcessed = useCallback(() => {
    handleTabChange('processed')
  }, [handleTabChange])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">가공상품</h1>
          <p className="text-gray-600">
            {currentTab === 'raw'
              ? '도매 채널 게시물에서 추출한 원본 상품 정보를 관리합니다.'
              : 'AI로 변환한 상품을 관리하고 판매 상태를 설정합니다.'}
          </p>
        </div>

        {/* 탭 헤더 */}
        <div className="flex border-b border-gray-200 mb-6">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.key
            const count = tab.key === 'raw' ? rawCount : processedCount
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

        {/* 탭 콘텐츠 */}
        {currentTab === 'raw' ? (
          <RawProductTab
            onSwitchToProcessed={handleSwitchToProcessed}
            onTotalLoaded={handleRawTotalLoaded}
            autoOpenRegister={autoOpenRegister}
          />
        ) : (
          <ProcessedProductTab
            onStatsLoaded={handleProcessedStatsLoaded}
          />
        )}
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
