'use client'

/**
 * 어드민 — B2B 사업자 회원 승인 큐 (B2B 공급몰 전환 STEP 3-1, 2026-06-11)
 *
 * 쇼핑몰에서 신청한 사업자 인증을 승인/반려한다.
 * 승인 시 해당 회원에게 공급가(wholesalePrice)가 노출되고 공급가 주문이 가능해진다.
 */

import { useState, useEffect, useCallback } from 'react'
import { BadgeCheck, RefreshCw, AlertCircle, Check, X, Building2 } from 'lucide-react'

interface B2bUser {
  id: number
  email: string
  name: string | null
  phone: string | null
  companyName: string | null
  businessNumber: string | null
  b2bStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  b2bAppliedAt: string | null
  b2bApprovedAt: string | null
  b2bRejectReason: string | null
}

const TABS = [
  { value: 'PENDING', label: '승인 대기' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'REJECTED', label: '반려됨' },
  { value: 'all', label: '전체' },
]

export default function AdminB2bPage() {
  const [users, setUsers] = useState<B2bUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState('PENDING')
  const [actionId, setActionId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/b2b?status=${tab}`, { credentials: 'include' }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '조회 실패')
      setUsers(res.data || [])
    } catch (e: any) {
      setError(e?.message || '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  async function handleAction(userId: number, action: 'approve' | 'reject') {
    let rejectReason: string | null = null
    if (action === 'reject') {
      rejectReason = prompt('반려 사유를 입력하세요 (신청자에게 표시됩니다):')
      if (rejectReason === null) return
    } else if (!confirm('이 회원을 B2B 사업자로 승인할까요? 승인 즉시 공급가가 노출됩니다.')) {
      return
    }

    setActionId(userId)
    try {
      const res = await fetch('/api/admin/users/b2b', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, rejectReason }),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '처리 실패')
      await load()
    } catch (e: any) {
      alert(e?.message || '처리 실패')
    } finally {
      setActionId(null)
    }
  }

  const formatBizNo = (no: string | null) =>
    no && no.length === 10 ? `${no.slice(0, 3)}-${no.slice(3, 5)}-${no.slice(5)}` : no || '-'

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 rounded-xl">
            <BadgeCheck className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">B2B 사업자 승인</h1>
            <p className="text-sm text-gray-500">승인 시 해당 회원에게 도매 공급가가 노출됩니다</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-fit">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">불러오는 중...</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 text-gray-300" />
            해당 상태의 신청이 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-3 text-left">회원</th>
                <th className="px-4 py-3 text-left">상호 / 사업자번호</th>
                <th className="px-4 py-3 text-left">신청일</th>
                <th className="px-4 py-3 text-left">상태</th>
                <th className="px-4 py-3 text-right">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.name || '-'}</div>
                    <div className="text-xs text-gray-400">
                      {u.email}
                      {u.phone ? ` · ${u.phone}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{u.companyName || '-'}</div>
                    <div className="text-xs text-gray-400 font-mono">{formatBizNo(u.businessNumber)}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {u.b2bAppliedAt ? new Date(u.b2bAppliedAt).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        u.b2bStatus === 'PENDING'
                          ? 'bg-amber-100 text-amber-700'
                          : u.b2bStatus === 'APPROVED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {u.b2bStatus === 'PENDING' ? '대기' : u.b2bStatus === 'APPROVED' ? '승인' : '반려'}
                    </span>
                    {u.b2bStatus === 'REJECTED' && u.b2bRejectReason && (
                      <div className="text-[11px] text-red-400 mt-1 max-w-[200px] truncate">{u.b2bRejectReason}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.b2bStatus === 'PENDING' && (
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => handleAction(u.id, 'approve')}
                          disabled={actionId === u.id}
                          className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium rounded-lg flex items-center gap-1 disabled:opacity-50"
                        >
                          <Check size={13} /> 승인
                        </button>
                        <button
                          onClick={() => handleAction(u.id, 'reject')}
                          disabled={actionId === u.id}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg flex items-center gap-1 disabled:opacity-50"
                        >
                          <X size={13} /> 반려
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
