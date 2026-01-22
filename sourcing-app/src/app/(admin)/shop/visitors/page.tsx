'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Monitor,
  Smartphone,
  ShoppingBag,
  RefreshCw,
  Clock,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import Button from '@/components/ui/Button'

interface VisitorInfo {
  sessionId: string
  shopSlug: string
  currentPage: string
  productId?: number
  productName?: string
  device: 'mobile' | 'desktop'
  referrer?: string
  startedAt: string
  lastActiveAt: string
}

interface VisitorStats {
  total: number
  mobile: number
  desktop: number
  viewingProduct: number
}

interface VisitorsResponse {
  success: boolean
  data: {
    stats: VisitorStats
    visitors: VisitorInfo[]
    warning?: string
  }
}

export default function ShopVisitorsPage() {
  const [stats, setStats] = useState<VisitorStats>({
    total: 0,
    mobile: 0,
    desktop: 0,
    viewingProduct: 0,
  })
  const [visitors, setVisitors] = useState<VisitorInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)

  const loadVisitors = useCallback(async () => {
    try {
      const response = await fetch('/api/shop/visitors')
      const data: VisitorsResponse = await response.json()

      if (data.success) {
        setStats(data.data.stats)
        setVisitors(data.data.visitors)
        setWarning(data.data.warning || null)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('접속자 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 초기 로드 및 자동 새로고침
  useEffect(() => {
    loadVisitors()

    let interval: NodeJS.Timeout | null = null
    if (autoRefresh) {
      interval = setInterval(loadVisitors, 10000) // 10초마다 갱신
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, loadVisitors])

  // 체류 시간 계산
  const getDuration = (startedAt: string) => {
    const start = new Date(startedAt)
    const now = new Date()
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000)

    if (diff < 60) return `${diff}초`
    if (diff < 3600) return `${Math.floor(diff / 60)}분`
    return `${Math.floor(diff / 3600)}시간 ${Math.floor((diff % 3600) / 60)}분`
  }

  // 마지막 활동 시간
  const getLastActive = (lastActiveAt: string) => {
    const last = new Date(lastActiveAt)
    const now = new Date()
    const diff = Math.floor((now.getTime() - last.getTime()) / 1000)

    if (diff < 10) return '방금 전'
    if (diff < 60) return `${diff}초 전`
    return `${Math.floor(diff / 60)}분 전`
  }

  // 페이지 경로 포맷
  const formatPage = (page: string) => {
    if (page === '/') return '홈'
    if (page.includes('/products/')) return '상품 상세'
    if (page.includes('/cart')) return '장바구니'
    if (page.includes('/checkout')) return '결제'
    if (page.includes('/orders')) return '주문 내역'
    return page
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">실시간 접속자</h1>
          <p className="text-sm text-gray-500 mt-1">쇼핑몰에 현재 접속 중인 방문자</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            자동 새로고침
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadVisitors}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 경고 메시지 */}
      {warning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Redis 연결 필요</p>
            <p className="text-sm text-yellow-700 mt-1">{warning}</p>
            <p className="text-xs text-yellow-600 mt-2">
              환경변수 <code className="bg-yellow-100 px-1 rounded">REDIS_URL</code>을 설정하세요.
            </p>
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">총 접속자</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Monitor className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.desktop}</p>
              <p className="text-sm text-gray-500">데스크톱</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Smartphone className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.mobile}</p>
              <p className="text-sm text-gray-500">모바일</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.viewingProduct}</p>
              <p className="text-sm text-gray-500">상품 조회 중</p>
            </div>
          </div>
        </div>
      </div>

      {/* 마지막 업데이트 시간 */}
      {lastUpdated && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
        </p>
      )}

      {/* 접속자 목록 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-medium text-gray-900">접속자 상세</h2>
        </div>

        {visitors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>현재 접속 중인 방문자가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y">
            {visitors.map((visitor) => (
              <div
                key={visitor.sessionId}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* 디바이스 아이콘 */}
                  <div className="flex items-center gap-3">
                    {visitor.device === 'mobile' ? (
                      <Smartphone className="w-5 h-5 text-purple-500" />
                    ) : (
                      <Monitor className="w-5 h-5 text-green-500" />
                    )}

                    {/* 쇼핑몰 & 페이지 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {visitor.shopSlug}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-600">
                          {formatPage(visitor.currentPage)}
                        </span>
                      </div>

                      {/* 상품 정보 */}
                      {visitor.productName && (
                        <p className="text-sm text-blue-600 truncate mt-0.5">
                          {visitor.productName}
                        </p>
                      )}

                      {/* 유입 경로 */}
                      {visitor.referrer && (
                        <p className="text-xs text-gray-400 truncate mt-0.5 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          {new URL(visitor.referrer).hostname}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 시간 정보 */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 sm:ml-auto">
                    <span title="체류 시간">🕐 {getDuration(visitor.startedAt)}</span>
                    <span
                      title="마지막 활동"
                      className={`${
                        getLastActive(visitor.lastActiveAt) === '방금 전'
                          ? 'text-green-600'
                          : ''
                      }`}
                    >
                      {getLastActive(visitor.lastActiveAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
