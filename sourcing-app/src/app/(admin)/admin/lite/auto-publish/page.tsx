/**
 * 어드민 — 라이트 자동 발행 설정 (전체 셀러 한눈에)
 *
 * 라이트 셀러별 publishHour:publishMinute / dailyCount / isActive 일괄 표시.
 * 인라인 수정 후 저장 → /api/admin/lite/sellers/[id] PUT 호출.
 */
'use client'

import { useEffect, useState } from 'react'
import { Cog, Save, Zap, Power } from 'lucide-react'

interface Row {
  id: number
  email: string
  name: string | null
  shopName: string
  publishHour: number
  publishMinute: number
  dailyCount: number
  isActive: boolean
  lastRunAt: string | null
  dirty?: boolean
  saving?: boolean
}

export default function AdminLiteAutoPublishPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/lite/sellers', { credentials: 'include' }).then((r) => r.json())
      if (res.success) {
        const list: Row[] = (res.data || []).map((s: any) => ({
          id: s.id,
          email: s.email,
          name: s.name,
          shopName: s.shops?.[0]?.name || '(쇼핑몰 없음)',
          publishHour: s.liteAutoPublishConfig?.publishHour ?? 10,
          publishMinute: s.liteAutoPublishConfig?.publishMinute ?? 0,
          dailyCount: s.liteAutoPublishConfig?.dailyCount ?? 20,
          isActive: s.liteAutoPublishConfig?.isActive ?? true,
          lastRunAt: s.liteAutoPublishConfig?.lastRunAt ?? null,
        }))
        setRows(list)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function update(id: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch, dirty: true } : r))
    )
  }

  async function save(id: number) {
    const r = rows.find((x) => x.id === id)
    if (!r) return
    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, saving: true } : x)))
    try {
      const res = await fetch(`/api/admin/lite/sellers/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishHour: r.publishHour,
          publishMinute: r.publishMinute,
          dailyCount: r.dailyCount,
          isActive: r.isActive,
        }),
      }).then((x) => x.json())
      if (res.success) {
        setRows((prev) =>
          prev.map((x) => (x.id === id ? { ...x, dirty: false, saving: false } : x))
        )
      } else {
        alert(res.error || '저장 실패')
        setRows((prev) => prev.map((x) => (x.id === id ? { ...x, saving: false } : x)))
      }
    } catch (err: any) {
      alert(err?.message || '저장 실패')
      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, saving: false } : x)))
    }
  }

  async function runNow(id: number) {
    if (!confirm('지금 즉시 자동 발행 실행?')) return
    const res = await fetch(`/api/admin/lite/auto-publish/${id}/run`, {
      method: 'POST',
      credentials: 'include',
    }).then((r) => r.json())
    if (res.success) alert(`발행 ${res.data?.count ?? 0}개 완료`)
    else alert(res.error || '실패')
    await load()
  }

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Cog className="w-6 h-6 text-blue-500" /> 자동 발행 설정
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          라이트 셀러별 일일 자동 발행 시각/개수/활성화를 관리합니다. (KST 기준)
        </p>
      </header>

      {loading && <div className="text-center text-gray-500 py-12">로딩 중...</div>}

      {!loading && rows.length === 0 && (
        <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">
          라이트 셀러가 없습니다. 라이트 운영 → 라이트 셀러에서 발급하세요.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs">
              <tr className="text-left text-gray-700">
                <th className="px-3 py-2">셀러</th>
                <th className="px-3 py-2">쇼핑몰</th>
                <th className="px-3 py-2 text-center">활성</th>
                <th className="px-3 py-2 text-center">발행 시각</th>
                <th className="px-3 py-2 text-center">일일 개수</th>
                <th className="px-3 py-2">마지막 실행</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name || '-'}</div>
                    <div className="text-xs text-gray-500">{r.email}</div>
                  </td>
                  <td className="px-3 py-2">{r.shopName}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => update(r.id, { isActive: !r.isActive })}
                      className={`px-2 py-1 rounded text-xs flex items-center gap-1 mx-auto ${
                        r.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      {r.isActive ? 'ON' : 'OFF'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={r.publishHour}
                        onChange={(e) =>
                          update(r.id, { publishHour: clamp(e.target.value, 0, 23, 10) })
                        }
                        className="w-14 px-2 py-1 border border-gray-300 rounded text-center"
                      />
                      <span>:</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={r.publishMinute}
                        onChange={(e) =>
                          update(r.id, { publishMinute: clamp(e.target.value, 0, 59, 0) })
                        }
                        className="w-14 px-2 py-1 border border-gray-300 rounded text-center"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={r.dailyCount}
                      onChange={(e) =>
                        update(r.id, { dailyCount: clamp(e.target.value, 1, 100, 20) })
                      }
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {r.lastRunAt ? new Date(r.lastRunAt).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => save(r.id)}
                        disabled={!r.dirty || r.saving}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <Save className="w-3 h-3" />
                        {r.saving ? '저장 중' : '저장'}
                      </button>
                      <button
                        onClick={() => runNow(r.id)}
                        className="px-2 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3" /> 즉시
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function clamp(v: any, min: number, max: number, fallback: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}
