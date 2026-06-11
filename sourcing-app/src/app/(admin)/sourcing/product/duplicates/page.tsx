'use client'

/**
 * 중복상품 후보 관리 (B2B 공급몰 전환 STEP 2-3, 2026-06-11)
 *
 * 제목 유사도 기반으로 감지된 중복 후보 쌍을 확인하고
 * 무시(중복 아님) 또는 신규 상품 비활성(중복 제거)을 선택한다.
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Copy, RefreshCw, AlertCircle, Check, EyeOff, ExternalLink } from 'lucide-react'
import ThumbnailImage from '@/components/ui/ThumbnailImage'

interface ProductSummary {
  id: number
  name: string
  thumbnailUrl: string | null
  isActive: boolean
  createdAt: string
  channel: { id: number; name: string } | null
}

interface DuplicateRow {
  id: number
  method: string
  similarity: number
  resolved: boolean
  createdAt: string
  product: ProductSummary
  dupProduct: ProductSummary
}

export default function ProductDuplicatesPage() {
  const [rows, setRows] = useState<DuplicateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<number | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/product/duplicates?resolved=${showResolved ? 'all' : 'false'}`, {
        credentials: 'include',
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '조회 실패')
      setRows(res.data || [])
    } catch (e: any) {
      setError(e?.message || '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [showResolved])

  useEffect(() => {
    load()
  }, [load])

  async function handleAction(id: number, action: 'ignore' | 'deactivate') {
    if (action === 'deactivate' && !confirm('신규 상품을 비활성화할까요? (쇼핑몰 노출 중단, 복원 가능)')) {
      return
    }
    setActionId(id)
    try {
      const res = await fetch('/api/product/duplicates', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '처리 실패')
      await load()
    } catch (e: any) {
      alert(e?.message || '처리 실패')
    } finally {
      setActionId(null)
    }
  }

  function ProductCard({ p, label }: { p: ProductSummary; label: string }) {
    return (
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
          {p.thumbnailUrl ? (
            <ThumbnailImage src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Copy size={20} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-400">{label}</span>
            {!p.isActive && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-200 text-gray-500">비활성</span>
            )}
          </div>
          <Link
            href={`/sourcing/product/detail/${p.id}`}
            className="text-sm font-medium text-gray-900 hover:text-purple-600 line-clamp-1"
          >
            {p.name}
          </Link>
          <p className="text-xs text-gray-400">
            #{p.id} · {p.channel?.name || '채널 없음'} · {new Date(p.createdAt).toLocaleDateString('ko-KR')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Copy className="text-purple-600" size={24} />
              중복상품 후보
            </h1>
            <p className="text-sm text-gray-500">
              제목 유사도 85% 이상으로 감지된 상품 쌍입니다. 중복이면 신규 상품을 비활성화하세요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
                className="rounded border-gray-300"
              />
              처리됨 포함
            </label>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-gray-400">불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            <Copy size={40} className="mx-auto mb-3 text-gray-300" />
            중복 후보가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`bg-white rounded-xl border p-4 ${
                  row.resolved ? 'border-gray-200 opacity-60' : 'border-amber-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <ProductCard p={row.product} label="신규" />
                  <div className="flex flex-col items-center px-2">
                    <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold whitespace-nowrap">
                      유사도 {(row.similarity * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1">{row.method}</span>
                  </div>
                  <ProductCard p={row.dupProduct} label="기존" />

                  <div className="flex items-center gap-2 lg:flex-col lg:items-stretch">
                    {row.resolved ? (
                      <span className="flex items-center gap-1 text-xs text-gray-400 justify-center">
                        <Check size={14} /> 처리됨
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleAction(row.id, 'deactivate')}
                          disabled={actionId === row.id}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg flex items-center gap-1 justify-center disabled:opacity-50"
                        >
                          <EyeOff size={13} />
                          신규 비활성
                        </button>
                        <button
                          onClick={() => handleAction(row.id, 'ignore')}
                          disabled={actionId === row.id}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg flex items-center gap-1 justify-center disabled:opacity-50"
                        >
                          <Check size={13} />
                          중복 아님
                        </button>
                      </>
                    )}
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
