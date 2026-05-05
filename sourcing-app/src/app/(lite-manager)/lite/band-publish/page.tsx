/**
 * Lite Band — 내 Band 자동 발행 결과
 *
 * 자동 발행 cron이 본인 Band에 게시한 상품 목록 표시.
 * 각 항목 → 실제 Band 게시글 URL 링크.
 */
'use client'

import { useEffect, useState } from 'react'
import { Rocket, ExternalLink, AlertTriangle, Check, Calendar } from 'lucide-react'

interface PublishItem {
  id: number
  product: { name: string; thumbnailUrl: string | null; price: any } | null
  postKey: string | null
  publishedAt: string | null
  isActive: boolean
  bandUrl: string | null
  channelName: string
}

interface RecentLog {
  publishedAt: string
  count: number
  status: string
  errorMessage: string | null
}

function formatPrice(n: any) {
  const num = typeof n === 'string' ? Number(n) : n
  if (!Number.isFinite(num)) return '-'
  return Math.round(num).toLocaleString('ko-KR')
}

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
}

export default function LiteBandPublishPage() {
  const [items, setItems] = useState<PublishItem[]>([])
  const [logs, setLogs] = useState<RecentLog[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/lite/band-publish/history', { credentials: 'include' }).then(
        (r) => r.json()
      )
      if (res.success) {
        setItems(res.data.items || [])
        setLogs(res.data.recentLogs || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="w-6 h-6 text-purple-500" /> Band 발행 결과
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          매일 자동 발행 cron이 본인 Band에 게시한 상품 이력을 확인합니다.
        </p>
      </header>

      {/* 최근 자동 발행 실행 로그 */}
      {logs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">최근 자동 발행 실행</h2>
          <div className="space-y-1">
            {logs.map((l, i) => (
              <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-gray-100 last:border-0">
                <Calendar className="w-3 h-3 text-gray-400" />
                <span className="text-gray-700">
                  {new Date(l.publishedAt).toLocaleString('ko-KR')}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-700'}`}>
                  {l.status}
                </span>
                <span className="text-gray-700">{l.count}개 등록</span>
                {l.errorMessage && (
                  <span className="text-orange-600 truncate flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {l.errorMessage}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="text-center text-gray-500 py-12">로딩 중...</div>}

      {!loading && items.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600">아직 Band에 발행된 상품이 없습니다.</p>
          <p className="text-xs text-gray-500 mt-1">
            <a href="/lite/channel" className="text-blue-600 hover:underline">
              내 Band 채널
            </a>{' '}
            에서 세션 쿠키를 먼저 등록해 주세요.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`bg-white border rounded-lg overflow-hidden ${
              item.isActive ? 'border-gray-200' : 'border-gray-300 opacity-60'
            }`}
          >
            {item.product?.thumbnailUrl ? (
              <img
                src={item.product.thumbnailUrl}
                alt={item.product.name}
                className="w-full h-40 object-cover"
              />
            ) : (
              <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                이미지 없음
              </div>
            )}
            <div className="p-3">
              <div className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[2.5em]">
                {item.product?.name}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-blue-600 font-bold text-sm">
                  ₩{formatPrice(item.product?.price)}
                </div>
                <div className="text-[10px] text-gray-400">
                  {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('ko-KR') : ''}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    item.postKey
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {item.postKey ? (
                    <>
                      <Check className="w-3 h-3" /> 게시됨
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" /> 게시 실패
                    </>
                  )}
                </span>
                {item.bandUrl && (
                  <a
                    href={item.bandUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Band <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
