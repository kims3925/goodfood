/**
 * 어드민 — 라이트 셀러 관리
 * - 라이트 셀러 + 쇼핑몰 + 자동 발행 설정을 한 화면에서 생성/수정/조회
 * - 라이트 셀러 = User.mode='lite' + 1개 Shop + LiteAutoPublishConfig
 */
'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Zap, KeyRound, Phone, Mail, Search } from 'lucide-react'

interface ShopInfo {
  id: number
  name: string
  subdomain: string
  ownerName: string | null
  managerName: string | null
  managerPhone: string | null
  managerEmail: string | null
  adminLoginId: string | null
  isActive: boolean
}

interface ConfigInfo {
  publishHour: number
  publishMinute: number
  dailyCount: number
  isActive: boolean
  lastRunAt: string | null
}

interface SellerRow {
  id: number
  email: string
  name: string | null
  phone: string | null
  liteStartAt: string | null
  proStartAt: string | null
  createdAt: string
  shops: ShopInfo[]
  liteAutoPublishConfig: ConfigInfo | null
}

const EMPTY_FORM = {
  email: '',
  password: '',
  name: '',
  phone: '',
  shopName: '',
  subdomain: '',
  ownerName: '',
  managerName: '',
  managerPhone: '',
  managerEmail: '',
  contactPhone: '',
  contactEmail: '',
  businessNumber: '',
  bankName: '',
  bankAccount: '',
  accountHolder: '',
  adminLoginId: '',
  adminLoginPassword: '',
  publishHour: 10,
  publishMinute: 0,
  dailyCount: 20,
  isActive: true,
}

export default function AdminLiteSellersPage() {
  const [sellers, setSellers] = useState<SellerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/lite/sellers', { credentials: 'include' }).then((r) => r.json())
      if (res.success) setSellers(res.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setErrMsg(null)
    setModalOpen(true)
  }

  function openEdit(s: SellerRow) {
    const shop = s.shops[0]
    const cfg = s.liteAutoPublishConfig
    setEditingId(s.id)
    setForm({
      email: s.email,
      password: '',
      name: s.name || '',
      phone: s.phone || '',
      shopName: shop?.name || '',
      subdomain: shop?.subdomain || '',
      ownerName: shop?.ownerName || '',
      managerName: shop?.managerName || '',
      managerPhone: shop?.managerPhone || '',
      managerEmail: shop?.managerEmail || '',
      contactPhone: '',
      contactEmail: '',
      businessNumber: '',
      bankName: '',
      bankAccount: '',
      accountHolder: '',
      adminLoginId: shop?.adminLoginId || '',
      adminLoginPassword: '',
      publishHour: cfg?.publishHour ?? 10,
      publishMinute: cfg?.publishMinute ?? 0,
      dailyCount: cfg?.dailyCount ?? 20,
      isActive: cfg?.isActive ?? true,
    })
    setErrMsg(null)
    setModalOpen(true)
  }

  async function handleSave() {
    setErrMsg(null)
    setSaving(true)
    try {
      const url = editingId
        ? `/api/admin/lite/sellers/${editingId}`
        : '/api/admin/lite/sellers'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then((r) => r.json())
      if (!res.success) {
        setErrMsg(res.error || '저장 실패')
        return
      }
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number, email: string) {
    if (!confirm(`라이트 셀러 ${email} 비활성화? (소프트 삭제)`)) return
    const res = await fetch(`/api/admin/lite/sellers/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    }).then((r) => r.json())
    if (res.success) await load()
    else alert(res.error || '실패')
  }

  async function handleManualRun(userId: number) {
    if (!confirm('지금 즉시 자동 발행 실행? (오늘 미실행 시에만 동작)')) return
    const res = await fetch(`/api/admin/lite/auto-publish/${userId}/run`, {
      method: 'POST',
      credentials: 'include',
    }).then((r) => r.json())
    if (res.success) {
      alert(`발행 ${res.data?.count ?? 0}개 완료`)
      await load()
    } else alert(res.error || '실패')
  }

  const filtered = sellers.filter(
    (s) =>
      !search ||
      s.email.includes(search) ||
      (s.name || '').includes(search) ||
      s.shops.some((sh) => sh.subdomain.includes(search) || sh.name.includes(search))
  )

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            라이트 셀러 관리
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            라이트 셀러 계정 + 쇼핑몰 + 자동 발행 설정을 한 곳에서 관리합니다.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> 신규 셀러 + 쇼핑몰 발급
        </button>
      </header>

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="이메일 / 이름 / 쇼핑몰 / URL"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {loading && <div className="text-center text-gray-500 py-12">로딩 중...</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">
          라이트 셀러가 없습니다. 우측 상단에서 신규 발급하세요.
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map((s) => {
          const shop = s.shops[0]
          const cfg = s.liteAutoPublishConfig
          return (
            <div
              key={s.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{shop?.name || '(쇼핑몰 없음)'}</span>
                  {shop?.subdomain && (
                    <a
                      href={`http://${shop.subdomain}.${typeof window !== 'undefined' ? window.location.host.replace(/^[^.]+\./, '') : 'snsauto.kr'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      /{shop.subdomain}
                    </a>
                  )}
                </div>
                <div className="text-xs text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1">
                  <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</div>
                  <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone || '-'}</div>
                  <div className="flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />ID: {shop?.adminLoginId || '-'}
                  </div>
                  <div>관리자: {shop?.managerName || s.name || '-'}</div>
                </div>
                {cfg && (
                  <div className="mt-2 text-xs flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded-full ${
                        cfg.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      자동발행 {cfg.isActive ? 'ON' : 'OFF'}
                    </span>
                    <span className="text-gray-700">
                      매일 {String(cfg.publishHour).padStart(2, '0')}:
                      {String(cfg.publishMinute).padStart(2, '0')} · {cfg.dailyCount}개
                    </span>
                    {cfg.lastRunAt && (
                      <span className="text-gray-500">
                        마지막: {new Date(cfg.lastRunAt).toLocaleString('ko-KR')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => openEdit(s)}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" /> 수정
                </button>
                <button
                  onClick={() => handleManualRun(s.id)}
                  className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" /> 즉시 발행
                </button>
                <button
                  onClick={() => handleDelete(s.id, s.email)}
                  className="px-3 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> 비활성화
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {modalOpen && (
        <SellerFormModal
          form={form}
          setForm={setForm}
          editing={editingId !== null}
          saving={saving}
          errMsg={errMsg}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function SellerFormModal({
  form,
  setForm,
  editing,
  saving,
  errMsg,
  onClose,
  onSave,
}: {
  form: typeof EMPTY_FORM
  setForm: (f: typeof EMPTY_FORM) => void
  editing: boolean
  saving: boolean
  errMsg: string | null
  onClose: () => void
  onSave: () => void
}) {
  function set<K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) {
    setForm({ ...form, [k]: v })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold">{editing ? '라이트 셀러 수정' : '신규 라이트 셀러 발급'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {errMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {errMsg}
            </div>
          )}

          <Section title="🔐 로그인 계정 (라이트 셀러)">
            <Field label="이메일 *" disabled={editing}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                disabled={editing}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm disabled:bg-gray-100"
              />
            </Field>
            <Field label={editing ? '비밀번호 (변경 시만 입력)' : '비밀번호 *'}>
              <input
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                autoComplete="new-password"
              />
            </Field>
            <Field label="이름">
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
            <Field label="휴대폰">
              <input
                type="text"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
          </Section>

          <Section title="🛍️ 쇼핑몰 정보">
            <Field label="쇼핑몰 이름 *">
              <input
                type="text"
                value={form.shopName}
                onChange={(e) => set('shopName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="우리 쇼핑몰"
              />
            </Field>
            <Field label="URL 주소 (subdomain) *" disabled={editing}>
              <input
                type="text"
                value={form.subdomain}
                onChange={(e) => set('subdomain', e.target.value.toLowerCase())}
                disabled={editing}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                placeholder="myshop (3-63자 영소문자/숫자/하이픈)"
              />
            </Field>
            <Field label="개설자 이름">
              <input
                type="text"
                value={form.ownerName}
                onChange={(e) => set('ownerName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
            <Field label="사업자등록번호">
              <input
                type="text"
                value={form.businessNumber}
                onChange={(e) => set('businessNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
          </Section>

          <Section title="👤 관리자 인적사항">
            <Field label="관리자 이름">
              <input
                type="text"
                value={form.managerName}
                onChange={(e) => set('managerName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
            <Field label="관리자 휴대폰">
              <input
                type="text"
                value={form.managerPhone}
                onChange={(e) => set('managerPhone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
            <Field label="관리자 이메일">
              <input
                type="email"
                value={form.managerEmail}
                onChange={(e) => set('managerEmail', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
          </Section>

          <Section title="🔑 쇼핑몰 관리자 로그인 (라이트 셀러 구분용 보안)">
            <Field label="관리자 ID *">
              <input
                type="text"
                value={form.adminLoginId}
                onChange={(e) => set('adminLoginId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="셀러별 고유 ID"
                autoComplete="off"
              />
            </Field>
            <Field label={editing ? '관리자 비밀번호 (변경 시만 입력)' : '관리자 비밀번호 *'}>
              <input
                type="password"
                value={form.adminLoginPassword}
                onChange={(e) => set('adminLoginPassword', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                autoComplete="new-password"
              />
            </Field>
          </Section>

          <Section title="💰 정산 계좌">
            <Field label="은행명">
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => set('bankName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
            <Field label="계좌번호">
              <input
                type="text"
                value={form.bankAccount}
                onChange={(e) => set('bankAccount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
            <Field label="예금주">
              <input
                type="text"
                value={form.accountHolder}
                onChange={(e) => set('accountHolder', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
          </Section>

          <Section title="⚡ 자동 발행 설정 (가공상품 풀에서 매일 자동 등록)">
            <Field label="발행 시각 (KST 시:분)">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={form.publishHour}
                  onChange={(e) => set('publishHour', Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <span>:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={form.publishMinute}
                  onChange={(e) => set('publishMinute', Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
            </Field>
            <Field label="일일 발행 개수">
              <input
                type="number"
                min={1}
                max={100}
                value={form.dailyCount}
                onChange={(e) => set('dailyCount', Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
            <Field label="활성화">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => set('isActive', e.target.checked)}
                />
                자동 발행 ON
              </label>
            </Field>
          </Section>
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            취소
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
          >
            {saving ? '저장 중...' : editing ? '수정 저장' : '셀러 + 쇼핑몰 생성'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  disabled,
  children,
}: {
  label: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`block text-xs font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
      <span className="block mb-1">{label}</span>
      {children}
    </label>
  )
}
