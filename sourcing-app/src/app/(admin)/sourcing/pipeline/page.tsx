'use client'

/**
 * 소싱 현황판 (/sourcing/pipeline)
 *
 * 수집 → AI가공 → 발행(소매밴드/쇼핑몰) 진행 단계를 게시물 단위로 한눈에 보여준다.
 * 이미 가공·발행된 기존 상품도 모두 포함 (post/list 는 미가공만 보여주는 것과 차별).
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  Search,
  RefreshCw,
  Package,
  Upload,
  Store,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  Circle,
} from 'lucide-react'

interface PipelineRow {
  postId: number
  title: string
  collectedAt: string
  sourceChannel: { id: number; name: string }
  sourceUrl: string | null
  product: { id: number; name: string; processedAt: string; isActive: boolean } | null
  retailPublishes: { channelName: string; publishedAt: string | null; postKey: string | null }[]
  shopPublishes: { shopName: string; publishedAt: string | null }[]
  stage: 'collected' | 'processed' | 'published'
}

interface Summary {
  total: number
  collected: number
  processed: number
  published: number
}

interface WholesaleChannel {
  id: number
  name: string
}

type StageFilter = 'all' | 'collected' | 'processed' | 'published'

const STAGE_TABS: { key: StageFilter; label: string; color: string; activeColor: string }[] = [
  { key: 'all', label: '전체', color: 'text-gray-600', activeColor: 'border-blue-500 bg-blue-50 text-blue-700' },
  { key: 'collected', label: '수집됨 (미가공)', color: 'text-gray-600', activeColor: 'border-amber-500 bg-amber-50 text-amber-700' },
  { key: 'processed', label: '가공완료 (미발행)', color: 'text-gray-600', activeColor: 'border-violet-500 bg-violet-50 text-violet-700' },
  { key: 'published', label: '발행완료', color: 'text-gray-600', activeColor: 'border-green-500 bg-green-50 text-green-700' },
]

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function SourcingPipelinePage() {
  const [rows, setRows] = useState<PipelineRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 필터 상태
  const [stage, setStage] = useState<StageFilter>('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [channelId, setChannelId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [channels, setChannels] = useState<WholesaleChannel[]>([])

  // 도매채널 목록 (필터 드롭다운)
  useEffect(() => {
    fetch('/api/channel?kind=WHOLESALE&limit=100')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) {
          setChannels(j.data.map((c: any) => ({ id: c.id, name: c.name })))
        }
      })
      .catch(() => {})
  }, [])

  const fetchRows = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        stage,
      })
      if (search) params.set('search', search)
      if (channelId) params.set('channelId', String(channelId))
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/sourcing/pipeline-status?${params.toString()}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '조회 실패')

      setRows(json.data)
      setSummary(json.summary)
      setTotalPages(json.pagination.totalPages)
      setTotal(json.pagination.total)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, stage, search, channelId, startDate, endDate])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const applySearch = () => {
    setPage(1)
    setSearch(searchInput.trim())
  }

  const changeStage = (s: StageFilter) => {
    setStage(s)
    setPage(1)
  }

  const summaryCount = (key: StageFilter): number => {
    if (!summary) return 0
    if (key === 'all') return summary.total
    return summary[key]
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">소싱 현황</h1>
            <button
              onClick={fetchRows}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>
          <p className="text-gray-600">
            도매밴드에서 수집된 게시물이 어디까지 진행됐는지(수집 → AI가공 → 소매밴드/쇼핑몰 발행) 한눈에 확인합니다.
            이미 가공·발행된 기존 상품도 모두 포함됩니다.
          </p>
        </div>

        {/* 단계 요약 카드 (클릭 = 필터) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {STAGE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => changeStage(tab.key)}
              className={`p-4 bg-white border-2 rounded-lg text-left transition-all ${
                stage === tab.key ? tab.activeColor : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`text-sm font-medium ${stage === tab.key ? '' : tab.color}`}>{tab.label}</div>
              <div className="text-2xl font-bold mt-1">{summaryCount(tab.key).toLocaleString()}</div>
            </button>
          ))}
        </div>

        {/* 필터 바 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                placeholder="원본 상품명 검색"
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-52 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={applySearch}
                className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                <Search size={14} />
              </button>
            </div>

            <select
              value={channelId ?? ''}
              onChange={(e) => {
                setChannelId(e.target.value ? parseInt(e.target.value) : null)
                setPage(1)
              }}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            >
              <option value="">도매채널 전체</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-1 text-sm text-gray-600">
              📅
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              />
              ~
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); setPage(1) }}
                  className="text-xs text-gray-500 underline ml-1"
                >
                  초기화
                </button>
              )}
            </div>

            <select
              value={limit}
              onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1) }}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm ml-auto"
            >
              <option value={20}>20개씩</option>
              <option value={50}>50개씩</option>
              <option value={100}>100개씩</option>
            </select>
          </div>
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm">{error}</div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-3 whitespace-nowrap">수집일</th>
                  <th className="px-4 py-3 whitespace-nowrap">도매채널</th>
                  <th className="px-4 py-3 min-w-[220px]">원본 상품명</th>
                  <th className="px-4 py-3 whitespace-nowrap">AI 가공</th>
                  <th className="px-4 py-3 min-w-[160px]">소매밴드 발행</th>
                  <th className="px-4 py-3 min-w-[160px]">쇼핑몰 발행</th>
                  <th className="px-4 py-3 whitespace-nowrap">바로가기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      <RefreshCw size={20} className="animate-spin inline-block mr-2" />
                      불러오는 중...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      조건에 맞는 게시물이 없습니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.postId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(row.collectedAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                          <Store size={11} />
                          {row.sourceChannel.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 line-clamp-2">{row.title}</div>
                        {row.product && row.product.name !== row.title && (
                          <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">가공명: {row.product.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.product ? (
                          <span className="inline-flex items-center gap-1 text-violet-700 text-xs font-medium">
                            <CheckCircle2 size={13} />
                            {formatDate(row.product.processedAt)}
                            {!row.product.isActive && (
                              <span className="text-gray-400 font-normal">(비활성)</span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                            <Circle size={12} />
                            미가공
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.retailPublishes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.retailPublishes.map((rp, i) => (
                              <span
                                key={i}
                                title={`발행: ${formatDate(rp.publishedAt)}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs"
                              >
                                <Upload size={10} />
                                {rp.channelName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.shopPublishes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.shopPublishes.map((sps, i) => (
                              <span
                                key={i}
                                title={`발행: ${formatDate(sps.publishedAt)}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs"
                              >
                                <ShoppingBag size={10} />
                                {sps.shopName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {row.product && (
                            <Link
                              href={`/sourcing/product/detail/${row.product.id}`}
                              className="text-blue-600 hover:underline text-xs inline-flex items-center gap-0.5"
                              title="가공상품 상세"
                            >
                              <Package size={12} />
                              상세
                            </Link>
                          )}
                          {row.sourceUrl && (
                            <a
                              href={row.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-500 hover:underline text-xs inline-flex items-center gap-0.5"
                              title="도매밴드 원본 글"
                            >
                              <ExternalLink size={12} />
                              원본
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm">
            <div className="text-gray-500">
              총 {total.toLocaleString()}건 · {page}/{totalPages} 페이지
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                이전
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
