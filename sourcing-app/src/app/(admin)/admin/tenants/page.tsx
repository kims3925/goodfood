/**
 * 어드민 — 매니저(테넌트) 목록·관리
 *
 * GBand SaaS 멀티테넌트 운영자(ABC Group Tech) 가 사용하는 매니저 관리 페이지.
 * - role='MANAGER' 사용자 목록 + 사용 통계
 * - 활성/비활성 토글, 임시 비밀번호 발급
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Building2, Search, RefreshCw, Power, KeyRound, AlertCircle } from 'lucide-react'

interface TenantRow {
  id: number
  email: string
  name: string | null
  phone: string | null
  companyName: string | null
  mode: string
  isActive: boolean
  createdAt: string
  signupCompletedAt: string | null
  stats: {
    staffCount: number
    channelCount: number
    shopCount: number
    productCount: number
    ordersThisMonth: number
  }
  subscription: {
    status: string
    planSlug: string | null
    planName: string | null
    periodEnd: string | null
  } | null
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/admin/tenants', window.location.origin)
      if (search) url.searchParams.set('q', search)
      url.searchParams.set('page', String(page))
      url.searchParams.set('pageSize', '20')
      const res = await fetch(url.toString(), { credentials: 'include' }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '조회 실패')
      setTenants(res.data || [])
      setPagination(res.pagination)
    } catch (e: any) {
      setError(e?.message || '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    load()
  }, [load])

  async function handleToggleActive(t: TenantRow) {
    if (!confirm(`${t.email} 를 ${t.isActive ? '비활성화' : '활성화'} 하시겠습니까?`)) return
    setActionId(t.id)
    try {
      const res = await fetch(`/api/admin/tenants/${t.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !t.isActive }),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error)
      await load()
    } catch (e: any) {
      alert(e?.message || '실패')
    } finally {
      setActionId(null)
    }
  }

  async function handleResetPassword(t: TenantRow) {
    if (!confirm(`${t.email} 의 임시 비밀번호를 발급하시겠습니까?`)) return
    setActionId(t.id)
    try {
      const res = await fetch(`/api/admin/tenants/${t.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetPassword: true }),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error)
      const temp = res.data?.tempPassword
      if (temp) {
        alert(`임시 비밀번호:\n\n${temp}\n\n매니저에게 안전한 채널로 전달하세요.`)
      } else {
        alert('비밀번호가 변경되었습니다.')
      }
    } catch (e: any) {
      alert(e?.message || '실패')
    } finally {
      setActionId(null)
    }
  }

  function statusBadge(status: string | null | undefined) {
    if (!status) return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">미가입</span>
    const map: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-700',
      TRIALING: 'bg-blue-100 text-blue-700',
      PAST_DUE: 'bg-red-100 text-red-700',
      CANCELLED: 'bg-gray-200 text-gray-600',
      EXPIRED: 'bg-orange-100 text-orange-700',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    )
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            테넌트(매니저) 관리
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            GBand SaaS 매니저(테넌트) 계정과 사용 통계를 한 곳에서 관리합니다.
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
            placeholder="이메일 / 이름 / 회사명 / 휴대폰"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1)
                setSearch(searchInput.trim())
              }
            }}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={() => {
            setPage(1)
            setSearch(searchInput.trim())
          }}
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
              <th className="px-4 py-3 text-right">스태프</th>
              <th className="px-4 py-3 text-right">채널</th>
              <th className="px-4 py-3 text-right">쇼핑몰</th>
              <th className="px-4 py-3 text-right">상품</th>
              <th className="px-4 py-3 text-right">이번달 주문</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            )}
            {!loading && tenants.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  매니저가 없습니다.
                </td>
              </tr>
            )}
            {!loading &&
              tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="block hover:bg-indigo-50/40 -mx-2 px-2 py-1 rounded transition-colors"
                    >
                      <div className="font-medium text-indigo-700 hover:text-indigo-800 hover:underline">
                        {t.name || t.email}
                      </div>
                      <div className="text-xs text-gray-500">{t.email}</div>
                      {t.companyName && (
                        <div className="text-xs text-gray-400 mt-0.5">{t.companyName}</div>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {t.subscription?.planName ?? '(없음)'}
                    {t.subscription?.periodEnd && (
                      <div className="text-gray-400 mt-0.5">
                        ~{new Date(t.subscription.periodEnd).toLocaleDateString('ko-KR')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{t.stats.staffCount}</td>
                  <td className="px-4 py-3 text-right">{t.stats.channelCount}</td>
                  <td className="px-4 py-3 text-right">{t.stats.shopCount}</td>
                  <td className="px-4 py-3 text-right">{t.stats.productCount}</td>
                  <td className="px-4 py-3 text-right">{t.stats.ordersThisMonth}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          t.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {t.isActive ? '활성' : '비활성'}
                      </span>
                      {statusBadge(t.subscription?.status)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => handleToggleActive(t)}
                        disabled={actionId === t.id}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1 disabled:opacity-50"
                        title={t.isActive ? '비활성화' : '활성화'}
                      >
                        <Power className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleResetPassword(t)}
                        disabled={actionId === t.id}
                        className="px-2 py-1 text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded flex items-center gap-1 disabled:opacity-50"
                        title="임시 비밀번호 발급"
                      >
                        <KeyRound className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="text-gray-500">
            총 {pagination.total} 건 (페이지 {pagination.page} / {pagination.totalPages})
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              이전
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
