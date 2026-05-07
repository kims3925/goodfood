/**
 * 어드민 — 쇼핑몰 발행 (Lite/Pro 통합)
 *
 * 셀러를 선택하고 라이트/프로 모드를 골라 쇼핑몰을 발행한다.
 * - Lite: maxShops=1 강제, 1:1 원칙
 * - Pro:  maxShops 어드민 입력 (>=1)
 *
 * 발행 시 Shop + ShopTheme + (라이트면) LiteAutoPublishConfig 까지 자동 생성.
 * adminLoginId/Password 자동생성 → 1회 노출 → 어드민이 셀러에게 전달.
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShoppingBag,
  Search,
  Sparkles,
  Rocket,
  Copy,
  Check,
  ArrowLeft,
} from 'lucide-react'

interface UserRow {
  id: number
  email: string
  name: string | null
  phone: string | null
  mode: string
  maxShops: number
  deletedAt: string | null
  shops: Array<{ id: number; name: string; subdomain: string }>
}

type Mode = 'lite' | 'lite_band' | 'pro'

interface PublishResult {
  user: { id: number; email: string; name: string | null; mode: string; maxShops: number }
  shop: { id: number; name: string; subdomain: string }
  credentials: { adminLoginId: string; adminLoginPassword: string }
}

export default function AdminShopsPublishPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [mode, setMode] = useState<Mode>('lite')
  const [shopName, setShopName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [maxShops, setMaxShops] = useState(1)
  const [managerName, setManagerName] = useState('')
  const [managerPhone, setManagerPhone] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [adminLoginId, setAdminLoginId] = useState('')
  const [adminLoginPassword, setAdminLoginPassword] = useState('')
  const [publishHour, setPublishHour] = useState(10)
  const [publishMinute, setPublishMinute] = useState(0)
  const [dailyCount, setDailyCount] = useState(20)
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [result, setResult] = useState<PublishResult | null>(null)
  const [copied, setCopied] = useState<'id' | 'pw' | null>(null)

  async function loadUsers() {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      const res = await fetch(`/api/admin/users/sellers?${qs.toString()}`, {
        credentials: 'include',
      }).then((r) => r.json())
      if (res.success) setUsers(res.data.users || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectUser(u: UserRow) {
    setSelectedUser(u)
    // 사용자의 현재 mode 와 정보를 기본값으로 채움
    if (u.mode === 'lite' || u.mode === 'lite_band') {
      setMode(u.mode as Mode)
      setMaxShops(1)
    } else {
      setMode('pro')
      setMaxShops(Math.max(1, u.maxShops || 1))
    }
    setShopName('')
    setSubdomain('')
    setOwnerName(u.name || '')
    setManagerName(u.name || '')
    setManagerPhone(u.phone || '')
    setManagerEmail(u.email || '')
    setAdminLoginId('')
    setAdminLoginPassword('')
    setErrMsg(null)
    setResult(null)
  }

  async function handlePublish() {
    if (!selectedUser) return
    if (!shopName.trim() || !subdomain.trim()) {
      setErrMsg('쇼핑몰 이름과 URL 주소는 필수입니다.')
      return
    }
    setErrMsg(null)
    setSaving(true)
    try {
      const body: any = {
        userId: selectedUser.id,
        mode,
        shopName: shopName.trim(),
        subdomain: subdomain.trim().toLowerCase(),
        ownerName: ownerName || undefined,
        managerName: managerName || undefined,
        managerPhone: managerPhone || undefined,
        managerEmail: managerEmail || undefined,
      }
      if (mode === 'pro') body.maxShops = maxShops
      if (adminLoginId.trim()) body.adminLoginId = adminLoginId.trim()
      if (adminLoginPassword.trim()) body.adminLoginPassword = adminLoginPassword
      if (mode === 'lite' || mode === 'lite_band') {
        body.publishHour = publishHour
        body.publishMinute = publishMinute
        body.dailyCount = dailyCount
      }

      const res = await fetch('/api/admin/shops/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json())

      if (!res.success) {
        setErrMsg(res.error || '발행 실패')
        return
      }
      setResult(res.data)
      await loadUsers()
    } finally {
      setSaving(false)
    }
  }

  function copyToClipboard(text: string, kind: 'id' | 'pw') {
    navigator.clipboard.writeText(text)
    setCopied(kind)
    setTimeout(() => setCopied(null), 1500)
  }

  function resetForm() {
    setResult(null)
    setSelectedUser(null)
    setShopName('')
    setSubdomain('')
  }

  const filtered = users.filter((u) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name || '').toLowerCase().includes(q) ||
      u.shops.some((s) => s.name.toLowerCase().includes(q) || s.subdomain.includes(q))
    )
  })

  const isLite = mode === 'lite' || mode === 'lite_band'
  const currentShopCount = selectedUser?.shops.length || 0
  const allowedMax = isLite ? 1 : maxShops
  const willExceed = selectedUser && currentShopCount >= allowedMax

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-500" />
            쇼핑몰 발행
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            셀러를 선택하고 라이트/프로 모드를 골라 쇼핑몰을 발행합니다. 발행 시 매니저(자동발행
            설정)도 함께 자동 생성됩니다.
          </p>
        </div>
        <Link
          href="/admin/users/sellers"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> 셀러 관리로
        </Link>
      </header>

      {result && (
        <div className="mb-6 bg-green-50 border-2 border-green-300 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-green-900">발행 완료!</h2>
          </div>
          <div className="text-sm text-green-900 space-y-1 mb-4">
            <div>
              <strong>{result.shop.name}</strong> 쇼핑몰이 <code className="bg-white px-1 rounded">/{result.shop.subdomain}</code> 으로 생성되었습니다.
            </div>
            <div>
              모드: <strong>{result.user.mode}</strong> · 한도: <strong>{result.user.maxShops}</strong>개
            </div>
          </div>

          <div className="bg-white rounded p-4 border border-green-200 space-y-2">
            <div className="text-xs text-gray-600 font-semibold mb-2">
              ⚠️ 아래 자격증명은 한 번만 표시됩니다. 셀러에게 전달하세요.
            </div>
            <div className="flex items-center justify-between gap-2 bg-gray-50 px-3 py-2 rounded">
              <div>
                <div className="text-[10px] text-gray-500">관리자 ID</div>
                <code className="font-mono text-sm">{result.credentials.adminLoginId}</code>
              </div>
              <button
                onClick={() => copyToClipboard(result.credentials.adminLoginId, 'id')}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded flex items-center gap-1"
              >
                {copied === 'id' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied === 'id' ? '복사됨' : '복사'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 bg-gray-50 px-3 py-2 rounded">
              <div>
                <div className="text-[10px] text-gray-500">관리자 비밀번호</div>
                <code className="font-mono text-sm">{result.credentials.adminLoginPassword}</code>
              </div>
              <button
                onClick={() => copyToClipboard(result.credentials.adminLoginPassword, 'pw')}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded flex items-center gap-1"
              >
                {copied === 'pw' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied === 'pw' ? '복사됨' : '복사'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm"
            >
              새로 발행
            </button>
            <Link
              href="/admin/users/sellers"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              셀러 목록 보기
            </Link>
          </div>
        </div>
      )}

      {!result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 좌: 셀러 선택 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="font-semibold mb-3">1. 셀러 선택</h2>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="이메일 / 이름 / 쇼핑몰 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>

            <div className="max-h-[500px] overflow-y-auto border border-gray-100 rounded">
              {loading && (
                <div className="text-center text-gray-500 py-8 text-sm">로딩 중...</div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="text-center text-gray-500 py-8 text-sm">
                  조건에 맞는 사용자가 없습니다.
                </div>
              )}
              {!loading &&
                filtered.map((u) => {
                  const isSelected = selectedUser?.id === u.id
                  const usage = u.shops.length
                  const max = u.mode === 'lite' || u.mode === 'lite_band' ? 1 : u.maxShops
                  return (
                    <button
                      key={u.id}
                      onClick={() => selectUser(u)}
                      className={`w-full text-left px-3 py-2 border-b border-gray-100 text-sm hover:bg-gray-50 ${
                        isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {u.name || '(이름 없음)'} <span className="text-xs text-gray-500">{u.email}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            mode={u.mode} · 쇼핑몰 {usage}/{max}개
                          </div>
                        </div>
                        {usage >= max && (
                          <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded">
                            한도 초과
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>

          {/* 우: 발행 폼 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="font-semibold mb-3">2. 쇼핑몰 발행</h2>

            {!selectedUser && (
              <div className="text-center text-gray-500 py-12 text-sm">
                좌측에서 셀러를 선택하세요.
              </div>
            )}

            {selectedUser && (
              <div className="space-y-4">
                <div className="bg-gray-50 px-3 py-2 rounded text-sm">
                  <div className="font-medium">{selectedUser.name || '(이름 없음)'}</div>
                  <div className="text-xs text-gray-600">{selectedUser.email}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    현재 보유 쇼핑몰: <strong>{selectedUser.shops.length}개</strong>
                  </div>
                </div>

                {/* 모드 선택 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">트랙 선택</label>
                  <div className="grid grid-cols-3 gap-2">
                    <ModeButton
                      active={mode === 'lite'}
                      onClick={() => {
                        setMode('lite')
                        setMaxShops(1)
                      }}
                      icon={<Sparkles className="w-4 h-4" />}
                      label="✨ Lite"
                      desc="쇼핑몰만 (1:1)"
                    />
                    <ModeButton
                      active={mode === 'lite_band'}
                      onClick={() => {
                        setMode('lite_band')
                        setMaxShops(1)
                      }}
                      icon={<Sparkles className="w-4 h-4" />}
                      label="📡 Lite Band"
                      desc="쇼핑몰+밴드 (1:1)"
                    />
                    <ModeButton
                      active={mode === 'pro'}
                      onClick={() => setMode('pro')}
                      icon={<Rocket className="w-4 h-4" />}
                      label="🚀 Pro"
                      desc="다중 쇼핑몰 가능"
                    />
                  </div>
                </div>

                {/* maxShops (Pro 전용) */}
                {mode === 'pro' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      최대 쇼핑몰 수 (Pro 한도)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={maxShops}
                      onChange={(e) => setMaxShops(Math.max(1, Number(e.target.value) || 1))}
                      className="w-32 px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      유료 등급에 맞춰 차등 적용. 추후 어드민에서 변경 가능.
                    </p>
                  </div>
                )}

                {willExceed && (
                  <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                    ⚠️ 현재 {currentShopCount}개 보유 중 / 한도 {allowedMax}개. 발행하려면 한도를 늘리세요.
                  </div>
                )}

                {/* 쇼핑몰 정보 */}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="쇼핑몰 이름 *">
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="우리 쇼핑몰"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </Field>
                  <Field label="URL 주소 (subdomain) *">
                    <input
                      type="text"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                      placeholder="myshop (3-63자)"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </Field>
                  <Field label="개설자 이름">
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </Field>
                  <Field label="관리자 이름">
                    <input
                      type="text"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </Field>
                  <Field label="관리자 휴대폰">
                    <input
                      type="text"
                      value={managerPhone}
                      onChange={(e) => setManagerPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </Field>
                  <Field label="관리자 이메일">
                    <input
                      type="email"
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </Field>
                </div>

                {/* 자격증명 (선택) */}
                <details className="border border-gray-200 rounded p-2">
                  <summary className="cursor-pointer text-xs text-gray-700">
                    🔑 관리자 ID/비밀번호 직접 지정 (비워두면 자동 생성)
                  </summary>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Field label="관리자 ID (선택)">
                      <input
                        type="text"
                        value={adminLoginId}
                        onChange={(e) => setAdminLoginId(e.target.value)}
                        placeholder="자동 생성: subdomain-xxxx"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="관리자 비밀번호 (선택)">
                      <input
                        type="text"
                        value={adminLoginPassword}
                        onChange={(e) => setAdminLoginPassword(e.target.value)}
                        placeholder="자동 생성: 12자 랜덤"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        autoComplete="new-password"
                      />
                    </Field>
                  </div>
                </details>

                {/* 자동 발행 설정 (Lite 전용) */}
                {isLite && (
                  <div className="border border-gray-200 rounded p-3 bg-blue-50/30">
                    <div className="text-xs font-semibold text-gray-700 mb-2">
                      ⚡ 자동 발행 설정 (Lite/Lite Band 전용)
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span>매일</span>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={publishHour}
                        onChange={(e) => setPublishHour(Number(e.target.value))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded"
                      />
                      <span>:</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={publishMinute}
                        onChange={(e) => setPublishMinute(Number(e.target.value))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded"
                      />
                      <span>(KST)에</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={dailyCount}
                        onChange={(e) => setDailyCount(Number(e.target.value))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded"
                      />
                      <span>개 자동 등록</span>
                    </div>
                  </div>
                )}

                {errMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                    {errMsg}
                  </div>
                )}

                <button
                  onClick={handlePublish}
                  disabled={saving || !!willExceed}
                  className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '발행 중...' : '🚀 쇼핑몰 발행'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
  desc,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-2 rounded-lg border-2 transition-colors ${
        active
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-gray-200 bg-white hover:border-indigo-200'
      }`}
    >
      <div className="flex items-center gap-1 font-semibold text-xs">
        {icon} {label}
      </div>
      <div className="text-[10px] text-gray-600 mt-1">{desc}</div>
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-gray-700">
      <span className="block mb-1">{label}</span>
      {children}
    </label>
  )
}
