'use client'

/**
 * 어드민 — 도매밴드 카탈로그 관리 (2026-06-11)
 *
 * 플랫폼 계정(예: jins3925@naver.com)으로 확보해 둔 소싱 도매밴드를 가등록하는 페이지.
 * 매니저는 소싱앱 "채널 관리 > 도매밴드 카탈로그" 에서 이 목록을 보고 선택 연결한다.
 *
 * 등록 방법:
 *  1) 내 채널에서 가져오기 — 어드민 본인 소유 도매(BAND) 채널 선택 (세션 출처 자동 연결, 권장)
 *  2) 수동 입력 — bandKey/이름 직접 입력 (세션 출처 없음 — 연결돼도 수집은 세션 등록 후 동작)
 */

import { useState, useEffect, useCallback } from 'react'
import { Boxes, Plus, Trash2, Power, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'

interface CatalogRow {
  id: number
  bandKey: string
  bandNo: number | null
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
  sourceChannelId: number | null
  connectedCount: number
  sourceHasSession: boolean
  sourceSessionAccount: string | null
}

interface MyChannel {
  id: number
  name: string
  channelKey: string
}

export default function AdminWholesaleCatalogPage() {
  const [rows, setRows] = useState<CatalogRow[]>([])
  const [myChannels, setMyChannels] = useState<MyChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 등록 폼
  const [mode, setMode] = useState<'channel' | 'manual'>('channel')
  const [selectedChannelId, setSelectedChannelId] = useState('')
  const [manualBandKey, setManualBandKey] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualBandNo, setManualBandNo] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [catalogRes, channelRes] = await Promise.all([
        fetch('/api/admin/wholesale-catalog', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/channel?kind=WHOLESALE&platform=BAND&limit=200', {
          credentials: 'include',
        }).then((r) => r.json()),
      ])
      if (!catalogRes.success) throw new Error(catalogRes.error || '카탈로그 조회 실패')
      setRows(catalogRes.data || [])
      if (channelRes.success) {
        setMyChannels(
          (channelRes.data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            channelKey: c.channelKey,
          }))
        )
      }
    } catch (e: any) {
      setError(e?.message || '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate() {
    if (mode === 'channel' && !selectedChannelId) {
      alert('등록할 채널을 선택해 주세요.')
      return
    }
    if (mode === 'manual' && (!manualBandKey.trim() || !manualName.trim())) {
      alert('bandKey 와 이름을 입력해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      const body =
        mode === 'channel'
          ? { channelId: Number(selectedChannelId), description: description.trim() || null }
          : {
              bandKey: manualBandKey.trim(),
              name: manualName.trim(),
              bandNo: manualBandNo.trim() || null,
              description: description.trim() || null,
            }
      const res = await fetch('/api/admin/wholesale-catalog', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '등록 실패')
      setSelectedChannelId('')
      setManualBandKey('')
      setManualName('')
      setManualBandNo('')
      setDescription('')
      await load()
    } catch (e: any) {
      alert(e?.message || '등록 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(row: CatalogRow) {
    setActionId(row.id)
    try {
      const res = await fetch(`/api/admin/wholesale-catalog/${row.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !row.isActive }),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error)
      await load()
    } catch (e: any) {
      alert(e?.message || '실패')
    } finally {
      setActionId(null)
    }
  }

  async function handleDelete(row: CatalogRow) {
    if (
      !confirm(
        `[${row.name}] 을(를) 카탈로그에서 제거하시겠습니까?\n이미 연결된 매니저 채널(${row.connectedCount}개)은 그대로 유지됩니다.`
      )
    )
      return
    setActionId(row.id)
    try {
      const res = await fetch(`/api/admin/wholesale-catalog/${row.id}`, {
        method: 'DELETE',
        credentials: 'include',
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error)
      await load()
    } catch (e: any) {
      alert(e?.message || '실패')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Boxes size={22} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">도매밴드 카탈로그</h1>
            <p className="text-sm text-gray-500">
              플랫폼이 확보한 소싱 도매밴드를 가등록하면 매니저가 선택해 연결할 수 있습니다.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>

      {/* 등록 폼 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4 mb-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              checked={mode === 'channel'}
              onChange={() => setMode('channel')}
            />
            내 채널에서 가져오기 (권장 — 세션 출처 자동 연결)
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" checked={mode === 'manual'} onChange={() => setMode('manual')} />
            수동 입력
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'channel' ? (
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[260px]"
            >
              <option value="">— 내 도매(BAND) 채널 선택 —</option>
              {myChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.channelKey})
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                value={manualBandKey}
                onChange={(e) => setManualBandKey(e.target.value)}
                placeholder="bandKey (채널 키)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48"
              />
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="도매밴드 이름"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48"
              />
              <input
                value={manualBandNo}
                onChange={(e) => setManualBandNo(e.target.value)}
                placeholder="bandNo (숫자, 선택)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
              />
            </>
          )}
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택 — 매니저에게 표시)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
          />
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus size={16} />
            {submitting ? '등록 중…' : '가등록'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* 목록 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">도매밴드</th>
              <th className="text-left px-4 py-3 font-medium">bandKey / bandNo</th>
              <th className="text-center px-4 py-3 font-medium">세션 출처</th>
              <th className="text-center px-4 py-3 font-medium">연결 매니저</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className="text-center px-4 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  불러오는 중…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  가등록된 도매밴드가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.name}</p>
                    {row.description && (
                      <p className="text-xs text-gray-500">{row.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {row.bandKey}
                    {row.bandNo != null && <span className="text-gray-400"> / {row.bandNo}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.sourceHasSession ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                        <CheckCircle2 size={14} />
                        {row.sourceSessionAccount || '세션 있음'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                        <AlertCircle size={14} />
                        세션 없음
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{row.connectedCount}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {row.isActive ? '노출' : '숨김'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleToggleActive(row)}
                        disabled={actionId === row.id}
                        title={row.isActive ? '숨기기' : '노출하기'}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-50"
                      >
                        <Power size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        disabled={actionId === row.id}
                        title="카탈로그에서 제거"
                        className="p-1.5 rounded hover:bg-red-50 text-red-500 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
