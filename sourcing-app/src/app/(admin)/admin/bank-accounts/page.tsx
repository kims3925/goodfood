/**
 * /admin/bank-accounts — 셀러 은행통장 관리 페이지 (Phase 4)
 *
 * 목록 + 신규 등록 폼 + 행별 [활성 토글 / 동기화 / 삭제].
 * 실 API 연동은 미구현 — apiProvider=NONE 으로 수동 운영.
 */
'use client'

import { useEffect, useState } from 'react'

interface BankAccount {
  id: number
  bankName: string
  accountNumber: string
  accountHolder: string
  apiProvider: 'NONE' | 'TOSS' | 'KAKAOBANK' | 'KFTC' | 'CUSTOM'
  isActive: boolean
  lastSyncedAt: string | null
  createdAt: string
}

const PROVIDERS = ['NONE', 'TOSS', 'KAKAOBANK', 'KFTC', 'CUSTOM'] as const

export default function BankAccountsPage() {
  const [items, setItems] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    apiProvider: 'NONE' as (typeof PROVIDERS)[number],
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/bank-account', { credentials: 'include' })
      const json = await res.json()
      if (json.success) setItems(json.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate() {
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountHolder.trim()) {
      setError('은행명/계좌번호/예금주는 필수입니다.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/bank-account', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || '등록 실패')
        return
      }
      setForm({ bankName: '', accountNumber: '', accountHolder: '', apiProvider: 'NONE' })
      setShowForm(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleActive(id: number, current: boolean) {
    await fetch(`/api/admin/bank-account/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    await load()
  }

  async function handleDelete(id: number) {
    if (!confirm('이 통장을 삭제하시겠습니까? (soft delete)')) return
    await fetch(`/api/admin/bank-account/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    await load()
  }

  async function handleSync(id: number) {
    const res = await fetch(`/api/admin/bank-account/${id}/sync`, {
      method: 'POST',
      credentials: 'include',
    })
    const json = await res.json()
    alert(json?.data?.message || (json.success ? '동기화 완료' : json.error))
    await load()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold">은행통장 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            입금받을 통장을 등록하고, 거래내역을 동기화하여 PENDING 외부주문과 자동 매칭합니다.
          </p>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? '취소' : '+ 통장 등록'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded p-4 mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">은행명</label>
              <input
                className="w-full border rounded p-2 text-sm"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="예: 카카오뱅크"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">계좌번호</label>
              <input
                className="w-full border rounded p-2 text-sm"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">예금주</label>
              <input
                className="w-full border rounded p-2 text-sm"
                value={form.accountHolder}
                onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">API 연동 (미구현)</label>
              <select
                className="w-full border rounded p-2 text-sm"
                value={form.apiProvider}
                onChange={(e) =>
                  setForm({ ...form, apiProvider: e.target.value as any })
                }
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 text-sm rounded p-2">
              {error}
            </div>
          )}
          <button
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm px-4 py-2 rounded"
            onClick={handleCreate}
            disabled={busy}
          >
            {busy ? '등록 중...' : '등록'}
          </button>
        </div>
      )}

      <div className="bg-white border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">은행</th>
              <th className="p-3">계좌번호</th>
              <th className="p-3">예금주</th>
              <th className="p-3">API</th>
              <th className="p-3">상태</th>
              <th className="p-3">마지막 동기화</th>
              <th className="p-3 w-48"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  등록된 통장이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-3">{b.bankName}</td>
                  <td className="p-3 font-mono">{b.accountNumber}</td>
                  <td className="p-3">{b.accountHolder}</td>
                  <td className="p-3 text-xs text-gray-600">{b.apiProvider}</td>
                  <td className="p-3">
                    {b.isActive ? (
                      <span className="text-green-700">활성</span>
                    ) : (
                      <span className="text-gray-400">비활성</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {b.lastSyncedAt ? new Date(b.lastSyncedAt).toLocaleString('ko-KR') : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                        onClick={() => handleToggleActive(b.id, b.isActive)}
                      >
                        {b.isActive ? '비활성화' : '활성화'}
                      </button>
                      <button
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                        onClick={() => handleSync(b.id)}
                      >
                        동기화
                      </button>
                      <button
                        className="text-xs px-2 py-1 border rounded hover:bg-red-50 text-red-600"
                        onClick={() => handleDelete(b.id)}
                      >
                        삭제
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
