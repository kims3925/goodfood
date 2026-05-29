/**
 * 어드민 — 매니저(테넌트) 상세
 *
 * `/admin/tenants` 목록에서 매니저 이름 클릭 시 진입. 기본 정보 인라인 편집,
 * 활성/비활성 토글, 임시 비밀번호 발급, 구독·사용 통계 표시.
 *
 * 데이터 소스: GET /api/admin/tenants/[id]
 * 수정 액션: PATCH /api/admin/tenants/[id] (isActive, resetPassword, name, phone, companyName)
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  Edit3,
  KeyRound,
  Mail,
  Package,
  Phone,
  Power,
  RefreshCw,
  Save,
  ShoppingBag,
  Store,
  Users,
  X,
} from 'lucide-react'

interface TenantDetail {
  id: number
  email: string
  name: string | null
  phone: string | null
  companyName: string | null
  businessNumber: string | null
  mode: string
  role: string
  createdAt: string
  signupCompletedAt: string | null
  deletedAt: string | null
  _count: {
    channels: number
    shops: number
    products: number
    orders: number
  }
  subscription: {
    status: string
    periodStart: string | null
    periodEnd: string | null
    plan: { slug: string; name: string; priceMonthly: number } | null
  } | null
}

interface EditForm {
  name: string
  phone: string
  companyName: string
}

const SUBSCRIPTION_STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  TRIALING: 'bg-blue-100 text-blue-700',
  PAST_DUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-200 text-gray-600',
  EXPIRED: 'bg-orange-100 text-orange-700',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('ko-KR')
  } catch {
    return iso
  }
}

function formatKrw(value: number | null | undefined): string {
  if (value == null) return '-'
  return `₩${value.toLocaleString('ko-KR')}`
}

export default function AdminTenantDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const tenantId = params?.id

  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<'toggle' | 'reset' | 'save' | null>(null)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditForm>({ name: '', phone: '', companyName: '' })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, { credentials: 'include' }).then((r) =>
        r.json()
      )
      if (!res.success) throw new Error(res.error || '조회 실패')
      const data = res.data as TenantDetail
      setTenant(data)
      setForm({
        name: data.name ?? '',
        phone: data.phone ?? '',
        companyName: data.companyName ?? '',
      })
    } catch (e: any) {
      setError(e?.message || '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    load()
  }, [load])

  async function handleToggleActive() {
    if (!tenant) return
    const next = tenant.deletedAt !== null
    if (!confirm(`${tenant.email} 를 ${next ? '활성화' : '비활성화'} 하시겠습니까?`)) return
    setAction('toggle')
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error)
      await load()
    } catch (e: any) {
      alert(e?.message || '실패')
    } finally {
      setAction(null)
    }
  }

  async function handleResetPassword() {
    if (!tenant) return
    if (!confirm(`${tenant.email} 의 임시 비밀번호를 발급하시겠습니까?`)) return
    setAction('reset')
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
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
      setAction(null)
    }
  }

  async function handleSave() {
    if (!tenant) return
    setAction('save')
    try {
      const payload: Record<string, string> = {}
      if (form.name !== (tenant.name ?? '')) payload.name = form.name
      if (form.phone !== (tenant.phone ?? '')) payload.phone = form.phone
      if (form.companyName !== (tenant.companyName ?? '')) payload.companyName = form.companyName

      if (Object.keys(payload).length === 0) {
        setEditing(false)
        return
      }

      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error)
      setEditing(false)
      await load()
    } catch (e: any) {
      alert(e?.message || '저장 실패')
    } finally {
      setAction(null)
    }
  }

  function cancelEdit() {
    if (!tenant) return
    setForm({
      name: tenant.name ?? '',
      phone: tenant.phone ?? '',
      companyName: tenant.companyName ?? '',
    })
    setEditing(false)
  }

  const isActive = tenant?.deletedAt === null
  const planName = tenant?.subscription?.plan?.name ?? null
  const subStatus = tenant?.subscription?.status ?? null

  return (
    <div>
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/admin/tenants')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            title="목록으로"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2 min-w-0">
              <Building2 className="w-6 h-6 text-indigo-600 flex-shrink-0" />
              <span className="truncate">{tenant?.name || tenant?.email || '매니저 상세'}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1 truncate">{tenant?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg flex items-center gap-2 disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 새로고침
        </button>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading && !tenant && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500">
          로딩 중...
        </div>
      )}

      {tenant && (
        <div className="space-y-6">
          {/* 상태 + 액션 바 */}
          <section className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {isActive ? '활성' : '비활성'}
              </span>
              {subStatus && (
                <span
                  className={`px-3 py-1 rounded-full text-xs ${
                    SUBSCRIPTION_STATUS_STYLE[subStatus] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  구독: {subStatus}
                </span>
              )}
              <span className="px-3 py-1 rounded-full text-xs bg-indigo-50 text-indigo-700">
                mode: {tenant.mode}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleToggleActive}
                disabled={action !== null}
                className={`px-3 py-2 text-sm rounded-lg flex items-center gap-2 disabled:opacity-50 ${
                  isActive
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <Power className="w-4 h-4" />
                {isActive ? '비활성화' : '활성화'}
              </button>
              <button
                onClick={handleResetPassword}
                disabled={action !== null}
                className="px-3 py-2 text-sm bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" /> 임시 비밀번호 발급
              </button>
            </div>
          </section>

          {/* 통계 KPI */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={<Users className="w-5 h-5" />} label="채널" value={tenant._count.channels} />
            <KpiCard icon={<Store className="w-5 h-5" />} label="쇼핑몰" value={tenant._count.shops} />
            <KpiCard
              icon={<Package className="w-5 h-5" />}
              label="등록 상품"
              value={tenant._count.products}
            />
            <KpiCard
              icon={<ShoppingBag className="w-5 h-5" />}
              label="누적 주문"
              value={tenant._count.orders}
            />
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            {/* 기본 정보 + 인라인 편집 */}
            <section className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">기본 정보</h2>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-2.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> 편집
                  </button>
                ) : (
                  <div className="flex gap-1">
                    <button
                      onClick={handleSave}
                      disabled={action === 'save'}
                      className="px-2.5 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded flex items-center gap-1 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" /> 저장
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={action === 'save'}
                      className="px-2.5 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center gap-1 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> 취소
                    </button>
                  </div>
                )}
              </div>
              <dl className="space-y-3 text-sm">
                <Field icon={<Mail className="w-4 h-4 text-gray-400" />} label="이메일">
                  <span className="text-gray-900">{tenant.email}</span>
                </Field>
                <Field icon={<Users className="w-4 h-4 text-gray-400" />} label="이름">
                  {editing ? (
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    <span className="text-gray-900">{tenant.name || '-'}</span>
                  )}
                </Field>
                <Field icon={<Building2 className="w-4 h-4 text-gray-400" />} label="회사명">
                  {editing ? (
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    <span className="text-gray-900">{tenant.companyName || '-'}</span>
                  )}
                </Field>
                <Field icon={<Phone className="w-4 h-4 text-gray-400" />} label="휴대폰">
                  {editing ? (
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    <span className="text-gray-900">{tenant.phone || '-'}</span>
                  )}
                </Field>
                <Field icon={<Building2 className="w-4 h-4 text-gray-400" />} label="사업자번호">
                  <span className="text-gray-900">{tenant.businessNumber || '-'}</span>
                </Field>
              </dl>
            </section>

            {/* 가입 + 구독 */}
            <section className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">가입 / 구독</h2>
              <dl className="space-y-3 text-sm">
                <Field icon={<Calendar className="w-4 h-4 text-gray-400" />} label="가입일">
                  <span className="text-gray-900">{formatDate(tenant.createdAt)}</span>
                </Field>
                <Field icon={<Calendar className="w-4 h-4 text-gray-400" />} label="가입 완료">
                  <span className="text-gray-900">{formatDate(tenant.signupCompletedAt)}</span>
                </Field>
                <Field icon={<CreditCard className="w-4 h-4 text-gray-400" />} label="플랜">
                  <span className="text-gray-900">
                    {planName ? (
                      <>
                        {planName}
                        {tenant.subscription?.plan?.priceMonthly != null && (
                          <span className="text-gray-500 ml-2">
                            ({formatKrw(tenant.subscription.plan.priceMonthly)} / 월)
                          </span>
                        )}
                      </>
                    ) : (
                      '(미가입)'
                    )}
                  </span>
                </Field>
                <Field icon={<Calendar className="w-4 h-4 text-gray-400" />} label="구독 기간">
                  <span className="text-gray-900">
                    {tenant.subscription?.periodStart
                      ? `${formatDateOnly(tenant.subscription.periodStart)} ~ ${formatDateOnly(
                          tenant.subscription.periodEnd
                        )}`
                      : '-'}
                  </span>
                </Field>
              </dl>
            </section>
          </div>

          <p className="text-xs text-gray-400 text-center">
            테넌트 ID: {tenant.id} · 후속 페이지: 스태프 목록, 사용량(/admin/usage), 결제(/admin/billing)
            는 별도 화면에서 확인하세요.
          </p>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold text-gray-900">{value.toLocaleString('ko-KR')}</div>
      </div>
    </div>
  )
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3">
      <dt className="flex items-center gap-2 text-gray-500">
        {icon}
        <span>{label}</span>
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
