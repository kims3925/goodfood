/**
 * 어드민 — 결제·청구 관리 (기본형)
 *
 * 매니저별 SubscriptionPlan + UserSubscription.status + 다음 결제일.
 * 수동 결제 처리(POST /api/admin/billing/[managerId]/mark-paid) — 오프라인 입금 등 인지 시 사용.
 *
 * 실제 결제 게이트웨이(토스/스트라이프) 연동 및 환불은 미구현 — 후속 작업.
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { CreditCard, Search, RefreshCw, CheckCircle2, AlertCircle, ArrowUpDown } from 'lucide-react'

interface BillingRow {
  id: number
  email: string
  name: string | null
  companyName: string | null
  subscription: {
    id: number
    status: string
    periodStart: string
    periodEnd: string
    paymentMethod: string | null
    cancelAtPeriodEnd: boolean
    cancelledAt: string | null
    planSlug: string
    planName: string
    priceMonthly: number
  } | null
  overdue: boolean
}

interface PlanRow {
  id: number
  slug: string
  name: string
  priceMonthly: number
}

export default function AdminBillingPage() {
  const [rows, setRows] = useState<BillingRow[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<number | null>(null)
  const [planModal, setPlanModal] = useState<{ row: BillingRow; planId: number | null; extendDays: number } | null>(
    null
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/admin/billing', window.location.origin)
      if (search) url.searchParams.set('q', search)
      if (statusFilter) url.searchParams.set('status', statusFilter)
      const res = await fetch(url.toString(), { credentials: 'include' }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '조회 실패')
      setRows(res.data || [])
      setPlans(res.plans || [])
    } catch (e: any) {
      setError(e?.message || '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  async function handleMarkPaid(row: BillingRow, planId?: number | null, extendDays: number = 30) {
    if (!confirm(`${row.email} 의 결제를 수동 완료 처리하시겠습니까? (+${extendDays}일 연장)`)) return
    setActionId(row.id)
    try {
      const res = await fetch(`/api/admin/billing/${row.id}/mark-paid`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extendDays, planId }),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error)
      alert('결제 처리 완료')
      setPlanModal(null)
      await load()
    } catch (e: any) {
      alert(e?.message || '실패')
    } finally {
      setActionId(null)
    }
  }

  function statusBadge(s: string | null) {
    if (!s) return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">미가입</span>
    const map: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-700',
      TRIALING: 'bg-blue-100 text-blue-700',
      PAST_DUE: 'bg-red-100 text-red-700',
      CANCELLED: 'bg-gray-200 text-gray-600',
      EXPIRED: 'bg-orange-100 text-orange-700',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs ${map[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>
    )
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-600" />
            결제 관리
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            매니저별 구독 상태와 결제 이력을 관리합니다. 오프라인 입금은 수동 처리 가능합니다.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 새로고침
        </button>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이메일 / 이름 / 회사명"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput.trim())}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">전체 상태</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="TRIALING">TRIALING</option>
          <option value="PAST_DUE">PAST_DUE (미납)</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="NONE">구독 없음</option>
        </select>
        <button
          onClick={() => setSearch(searchInput.trim())}
          className="px-3 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg"
        >
          검색
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">매니저</th>
              <th className="px-4 py-3 text-left">플랜</th>
              <th className="px-4 py-3 text-right">월 요금</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-left">다음 결제일</th>
              <th className="px-4 py-3 text-left">결제 수단</th>
              <th className="px-4 py-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  매니저가 없습니다.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.overdue ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.name || r.email}</div>
                    <div className="text-xs text-gray-500">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.subscription?.planName ?? <span className="text-gray-400">(없음)</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {r.subscription ? `₩${r.subscription.priceMonthly.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">{statusBadge(r.subscription?.status ?? null)}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.subscription?.periodEnd ? (
                      <span className={r.overdue ? 'text-red-600 font-medium' : ''}>
                        {new Date(r.subscription.periodEnd).toLocaleDateString('ko-KR')}
                        {r.overdue && ' (미납)'}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{r.subscription?.paymentMethod ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() =>
                          setPlanModal({
                            row: r,
                            planId: plans.find((p) => p.slug === r.subscription?.planSlug)?.id ?? plans[0]?.id ?? null,
                            extendDays: 30,
                          })
                        }
                        disabled={actionId === r.id}
                        className="px-2 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded flex items-center gap-1 disabled:opacity-50"
                        title="플랜 변경/결제 처리"
                      >
                        <ArrowUpDown className="w-3 h-3" /> 변경
                      </button>
                      <button
                        onClick={() => handleMarkPaid(r, null, 30)}
                        disabled={actionId === r.id}
                        className="px-2 py-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded flex items-center gap-1 disabled:opacity-50"
                        title="현재 플랜 +30일 연장"
                      >
                        <CheckCircle2 className="w-3 h-3" /> 입금 확인
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {planModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold">플랜 변경 / 결제 처리</h2>
              <p className="text-xs text-gray-500 mt-1">
                {planModal.row.email} ({planModal.row.name})
              </p>
            </div>
            <div className="p-5 space-y-4">
              <label className="block text-xs font-medium text-gray-700">
                <span className="block mb-1">플랜</span>
                <select
                  value={planModal.planId ?? ''}
                  onChange={(e) =>
                    setPlanModal({ ...planModal, planId: e.target.value ? Number(e.target.value) : null })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₩{p.priceMonthly.toLocaleString()}/월)
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-700">
                <span className="block mb-1">연장 일수 (0 = 그대로)</span>
                <input
                  type="number"
                  min={0}
                  max={366}
                  value={planModal.extendDays}
                  onChange={(e) =>
                    setPlanModal({ ...planModal, extendDays: Math.max(0, Math.min(366, Number(e.target.value))) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </label>
              <div className="text-xs text-gray-600 bg-yellow-50 p-3 rounded border border-yellow-200">
                ⚠️ 결제 게이트웨이 연동 없이 상태만 변경합니다. 실제 결제 금액 청구는 별도로 진행해야 합니다.
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setPlanModal(null)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                취소
              </button>
              <button
                onClick={() => handleMarkPaid(planModal.row, planModal.planId, planModal.extendDays)}
                disabled={actionId === planModal.row.id}
                className="px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded disabled:opacity-50"
              >
                {actionId === planModal.row.id ? '처리 중...' : '결제 처리'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
