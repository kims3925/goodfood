'use client'

import { useState } from 'react'
import { List, CheckCircle, XCircle, Clock, TrendingUp, Calendar, ExternalLink } from 'lucide-react'

export default function RetailStatusPage() {
  const [dateFilter, setDateFilter] = useState('today')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all')

  // 임시 데이터 - 발행 이력
  const publishHistory = [
    {
      id: '1',
      productName: '프리미엄 한우 세트',
      bandName: '맘카페 공구밴드',
      publishedAt: '2025-01-19 10:30',
      status: 'success',
      viewCount: 234,
      clickCount: 12,
      postUrl: 'https://band.us/band/12345/post/67890',
    },
    {
      id: '2',
      productName: '유기농 과일 선물세트',
      bandName: '건강식품 밴드',
      publishedAt: '2025-01-19 09:15',
      status: 'success',
      viewCount: 189,
      clickCount: 8,
      postUrl: 'https://band.us/band/12345/post/67891',
    },
    {
      id: '3',
      productName: '수제 마카롱 세트',
      bandName: '디저트 러버 밴드',
      publishedAt: '2025-01-19 08:45',
      status: 'failed',
      error: '밴드 API 오류',
      postUrl: null,
    },
    {
      id: '4',
      productName: '프리미엄 꽃게 세트',
      bandName: '지역 특산품 밴드',
      publishedAt: '2025-01-19 07:30',
      status: 'pending',
      postUrl: null,
    },
  ]

  const performanceStats = {
    totalViews: 1234,
    totalClicks: 89,
    avgCTR: 7.2,
    topPerforming: '프리미엄 한우 세트',
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            성공
          </span>
        )
      case 'failed':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            실패
          </span>
        )
      case 'pending':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            대기
          </span>
        )
      default:
        return null
    }
  }

  const filteredHistory = publishHistory.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    // 실제로는 날짜 필터링도 구현
    return true
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <List className="w-6 h-6 text-purple-600" />
          발행 현황
        </h1>
        <p className="mt-2 text-gray-600">소매밴드 포스팅 발행 이력과 성과를 확인합니다</p>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">총 조회수</p>
              <p className="text-2xl font-bold text-gray-900">{performanceStats.totalViews.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">총 클릭수</p>
              <p className="text-2xl font-bold text-gray-900">{performanceStats.totalClicks}</p>
            </div>
            <ExternalLink className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">평균 CTR</p>
              <p className="text-2xl font-bold text-gray-900">{performanceStats.avgCTR}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div>
            <p className="text-sm text-gray-600">최고 성과</p>
            <p className="text-sm font-bold text-gray-900 mt-1">{performanceStats.topPerforming}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Date Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                dateFilter === 'today'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              오늘
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                dateFilter === 'week'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              이번주
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                dateFilter === 'month'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              이번달
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                statusFilter === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setStatusFilter('success')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                statusFilter === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              성공
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                statusFilter === 'failed'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              실패
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                statusFilter === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              대기
            </button>
          </div>
        </div>
      </div>

      {/* Publish History Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상품명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  밴드
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  발행 시간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  성과
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredHistory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">{item.bandName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-600">{item.publishedAt}</p>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(item.status)}
                    {item.status === 'failed' && item.error && (
                      <p className="text-xs text-red-600 mt-1">{item.error}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {item.status === 'success' && (
                      <div className="text-sm">
                        <p className="text-gray-600">
                          조회 <span className="font-medium text-gray-900">{item.viewCount}</span>
                        </p>
                        <p className="text-gray-600">
                          클릭 <span className="font-medium text-gray-900">{item.clickCount}</span>
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {item.postUrl && (
                      <a
                        href={item.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        보기
                      </a>
                    )}
                    {item.status === 'failed' && (
                      <button className="inline-flex items-center gap-1 px-3 py-1 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors">
                        재시도
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}