'use client'

/**
 * 도매밴드 카탈로그 (매니저용, 2026-06-11)
 *
 * 플랫폼(어드민)이 미리 확보·가등록해 둔 소싱 도매밴드 목록.
 * 매니저는 [연결] 버튼만 누르면 본인 소유 도매(WHOLESALE) 채널이 자동 생성되고,
 * 플랫폼 세션이 복사되어 별도 API 설정·밴드 가입 없이 바로 수집이 가능하다.
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Boxes, Check, Link2, AlertCircle } from 'lucide-react'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

interface CatalogEntry {
  id: number
  bandKey: string
  bandNo: number | null
  name: string
  description: string | null
  coverUrl: string | null
  isConnected: boolean
  sessionAvailable: boolean
}

export default function WholesaleCatalogPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingId, setConnectingId] = useState<number | null>(null)
  const { showToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/wholesale-catalog', { credentials: 'include' }).then((r) =>
        r.json()
      )
      if (!res.success) throw new Error(res.error || '조회 실패')
      setEntries(res.data || [])
    } catch (e: any) {
      showToast(e?.message || '카탈로그 조회에 실패했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  async function handleConnect(entry: CatalogEntry) {
    if (entry.isConnected) return
    if (!confirm(`[${entry.name}] 도매밴드를 내 소싱 채널로 연결하시겠습니까?`)) return
    setConnectingId(entry.id)
    try {
      const res = await fetch(`/api/wholesale-catalog/${entry.id}/connect`, {
        method: 'POST',
        credentials: 'include',
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '연결 실패')
      showToast(`[${entry.name}] 채널이 연결되었습니다.`, 'success')
      await load()
    } catch (e: any) {
      showToast(e?.message || '연결에 실패했습니다.', 'error')
    } finally {
      setConnectingId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/sourcing/channel/list"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          title="채널 관리로 돌아가기"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="p-2 bg-emerald-100 rounded-lg">
          <Boxes size={22} className="text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">도매밴드 카탈로그</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6 ml-1">
        플랫폼이 확보해 둔 소싱 도매밴드입니다. [연결]하면 내 도매 채널로 자동 등록되어 바로 상품
        수집이 가능합니다.
      </p>

      {loading ? (
        <Loading />
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-gray-500">
          등록된 도매밴드가 아직 없습니다. 관리자에게 문의해 주세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-4"
            >
              {entry.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.coverUrl}
                  alt={entry.name}
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Boxes size={24} className="text-emerald-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{entry.name}</p>
                {entry.description && (
                  <p className="text-sm text-gray-500 truncate">{entry.description}</p>
                )}
                {!entry.sessionAvailable && !entry.isConnected && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                    <AlertCircle size={12} />
                    플랫폼 세션 준비 중 — 연결은 가능하나 수집은 세션 등록 후 동작
                  </p>
                )}
              </div>
              {entry.isConnected ? (
                <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium flex-shrink-0">
                  <Check size={16} />
                  연결됨
                </span>
              ) : (
                <button
                  onClick={() => handleConnect(entry)}
                  disabled={connectingId === entry.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex-shrink-0"
                >
                  <Link2 size={16} />
                  {connectingId === entry.id ? '연결 중…' : '연결'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
