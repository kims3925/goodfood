/**
 * /admin/bank-transactions — 은행 거래내역 관리 + 수동 입력 페이지 (Phase 4)
 *
 * - 거래내역 목록 (페이지네이션, 미매칭 필터)
 * - 수동 거래내역 등록 (자동 매칭 시도 → 결과 표시)
 * - "미매칭 일괄 재시도" 버튼
 */
'use client'

import { useEffect, useState } from 'react'

interface BankTransaction {
  id: number
  bankAccountId: number
  transactionDate: string
  amount: string
  senderName: string | null
  description: string | null
  matchedOrderId: number | null
  matchedAt: string | null
  bankAccount: { bankName: string; accountNumber: string; accountHolder: string } | null
}

interface BankAccount {
  id: number
  bankName: string
  accountNumber: string
  accountHolder: string
  isActive: boolean
}

export default function BankTransactionsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [rows, setRows] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyUnmatched, setOnlyUnmatched] = useState(false)
  const [accountFilter, setAccountFilter] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    bankAccountId: 0,
    transactionDate: new Date().toISOString().slice(0, 16),
    amount: 0,
    senderName: '',
    description: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastMatchResult, setLastMatchResult] = useState<any>(null)

  async function loadAccounts() {
    const res = await fetch('/api/admin/bank-account', { credentials: 'include' })
    const json = await res.json()
    if (json.success) {
      const acts = (json.data || []).filter((a: any) => !a.deletedAt)
      setAccounts(acts)
      if (acts.length > 0 && !form.bankAccountId) {
        setForm((f) => ({ ...f, bankAccountId: acts[0].id }))
      }
    }
  }

  async function loadTransactions() {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (onlyUnmatched) qs.set('unmatched', '1')
      if (accountFilter) qs.set('accountId', accountFilter)
      const res = await fetch(`/api/admin/bank-transactions?${qs.toString()}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success) setRows(json.data.rows || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    loadTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyUnmatched, accountFilter])

  async function handleCreate() {
    if (!form.bankAccountId || !form.amount) {
      setError('통장과 금액은 필수입니다.')
      return
    }
    setBusy(true)
    setError(null)
    setLastMatchResult(null)
    try {
      const res = await fetch('/api/admin/bank-transactions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: form.bankAccountId,
          transactionDate: new Date(form.transactionDate).toISOString(),
          amount: Number(form.amount),
          senderName: form.senderName.trim() || null,
          description: form.description.trim() || null,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || '등록 실패')
        return
      }
      setLastMatchResult(json.data)
      setForm({
        ...form,
        amount: 0,
        senderName: '',
        description: '',
      })
      await loadTransactions()
    } finally {
      setBusy(false)
    }
  }

  async function handleRetryUnmatched() {
    const res = await fetch('/api/admin/bank-transactions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retryUnmatched' }),
    })
    const json = await res.json()
    if (json.success) {
      const matched = (json.data.results || []).filter((r: any) => r.matchedOrderId).length
      alert(`재시도 완료: ${matched}건 매칭`)
      await loadTransactions()
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold">은행 거래내역</h1>
          <p className="text-sm text-gray-500 mt-1">
            입금 거래내역을 수동 등록하면 같은 금액의 PENDING 외부주문과 자동 매칭합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="text-sm px-3 py-2 border rounded hover:bg-gray-50"
            onClick={handleRetryUnmatched}
          >
            미매칭 일괄 재시도
          </button>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? '취소' : '+ 거래내역 등록'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border rounded p-4 mb-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">통장</label>
              <select
                className="w-full border rounded p-2 text-sm"
                value={form.bankAccountId}
                onChange={(e) =>
                  setForm({ ...form, bankAccountId: Number(e.target.value) })
                }
              >
                {accounts.length === 0 && <option value={0}>(통장 없음)</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bankName} {a.accountNumber}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">거래일시</label>
              <input
                type="datetime-local"
                className="w-full border rounded p-2 text-sm"
                value={form.transactionDate}
                onChange={(e) =>
                  setForm({ ...form, transactionDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">금액 (입금=양수)</label>
              <input
                type="number"
                className="w-full border rounded p-2 text-sm"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">발신자명</label>
              <input
                className="w-full border rounded p-2 text-sm"
                value={form.senderName}
                onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                placeholder="입금자"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">설명 (선택)</label>
            <input
              className="w-full border rounded p-2 text-sm"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
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
            {busy ? '등록 + 매칭 중...' : '등록 + 자동 매칭'}
          </button>
          {lastMatchResult && (
            <div
              className={`text-sm rounded p-2 ${
                lastMatchResult.matchedOrderId
                  ? 'bg-green-50 border border-green-300 text-green-800'
                  : 'bg-yellow-50 border border-yellow-300 text-yellow-800'
              }`}
            >
              {lastMatchResult.matchedOrderId
                ? `✓ 매칭 완료 → 주문 #${lastMatchResult.matchedOrderNumber || lastMatchResult.matchedOrderId}`
                : `매칭 안됨: ${lastMatchResult.reason}`}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 mb-3 items-center text-sm">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={onlyUnmatched}
            onChange={(e) => setOnlyUnmatched(e.target.checked)}
          />
          미매칭만
        </label>
        <select
          className="border rounded p-1 text-sm"
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
        >
          <option value="">전체 통장</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.bankName} {a.accountNumber}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">거래일시</th>
              <th className="p-3">통장</th>
              <th className="p-3 text-right">금액</th>
              <th className="p-3">발신자</th>
              <th className="p-3">설명</th>
              <th className="p-3">매칭</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  거래내역이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const amount = Number(r.amount)
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 text-xs text-gray-600">
                      {new Date(r.transactionDate).toLocaleString('ko-KR')}
                    </td>
                    <td className="p-3 text-xs">
                      {r.bankAccount
                        ? `${r.bankAccount.bankName} ${r.bankAccount.accountNumber}`
                        : `#${r.bankAccountId}`}
                    </td>
                    <td
                      className={`p-3 text-right font-mono ${
                        amount > 0 ? 'text-blue-700' : 'text-red-700'
                      }`}
                    >
                      {amount.toLocaleString('ko-KR')}
                    </td>
                    <td className="p-3">{r.senderName || '—'}</td>
                    <td className="p-3 text-xs text-gray-600">{r.description || ''}</td>
                    <td className="p-3 text-xs">
                      {r.matchedOrderId ? (
                        <span className="text-green-700">
                          ✓ 주문 #{r.matchedOrderId}
                        </span>
                      ) : amount > 0 ? (
                        <span className="text-gray-400">미매칭</span>
                      ) : (
                        <span className="text-gray-300">출금</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
