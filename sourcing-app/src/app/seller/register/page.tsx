/**
 * 셀러 통합 가입 페이지 — /seller/register (public)
 *
 * 일반 회원가입(/register, 쇼핑몰 회원)과 분리. 셀러로 가입하면서
 * 동시에 본인 쇼핑몰을 발행한다. 가입 성공 시 자동 로그인 → /lite/dashboard.
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Store, Lock, Check, Copy } from 'lucide-react'

interface FormState {
  email: string
  password: string
  passwordConfirm: string
  name: string
  phone: string
  shopName: string
  subdomain: string
  ownerName: string
  businessNumber: string
  managerName: string
  managerPhone: string
  managerEmail: string
  bankName: string
  bankAccount: string
  accountHolder: string
  tosAgreed: boolean
  privacyAgreed: boolean
}

const EMPTY: FormState = {
  email: '',
  password: '',
  passwordConfirm: '',
  name: '',
  phone: '',
  shopName: '',
  subdomain: '',
  ownerName: '',
  businessNumber: '',
  managerName: '',
  managerPhone: '',
  managerEmail: '',
  bankName: '',
  bankAccount: '',
  accountHolder: '',
  tosAgreed: false,
  privacyAgreed: false,
}

export default function SellerRegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ loginId: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.password !== form.passwordConfirm) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.')
      return
    }
    if (!form.tosAgreed || !form.privacyAgreed) {
      setError('이용약관 및 개인정보처리방침 동의가 필요합니다.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/seller/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then((r) => r.json())

      if (!res.success) {
        setError(res.error || '가입에 실패했습니다.')
        return
      }
      setCredentials(res.data?.shopAdminCredentials || null)
    } catch (err: any) {
      setError(err?.message || '네트워크 오류')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyCredentials() {
    if (!credentials) return
    const text = `로그인 ID: ${credentials.loginId}\n비밀번호: ${credentials.password}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('복사 실패 — 직접 메모해 주세요.')
    }
  }

  // 가입 성공 후 화면
  if (credentials) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">가입 완료!</h1>
            <p className="text-sm text-gray-600 mt-2">
              셀러 회원가입과 쇼핑몰 발행이 동시에 처리되었습니다.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-yellow-900 mb-2 flex items-center gap-1">
              🔐 쇼핑몰 관리자 자격증명 (1회만 노출)
            </h3>
            <p className="text-xs text-yellow-800 mb-3">
              아래 정보는 다시 표시되지 않으니 반드시 안전한 곳에 저장하세요.
            </p>
            <div className="bg-white rounded p-3 font-mono text-sm space-y-1">
              <div>
                <span className="text-gray-500">ID: </span>
                <span className="font-semibold">{credentials.loginId}</span>
              </div>
              <div>
                <span className="text-gray-500">PW: </span>
                <span className="font-semibold">{credentials.password}</span>
              </div>
            </div>
            <button
              onClick={copyCredentials}
              className="mt-3 w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded flex items-center justify-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> 복사됨
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> 클립보드에 복사
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => router.push('/lite/dashboard')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
          >
            대시보드로 이동 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Store className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">셀러 가입 + 쇼핑몰 발행</h1>
          <p className="text-sm text-gray-600 mt-2">
            셀러 회원가입과 동시에 본인 쇼핑몰을 한 번에 발급받습니다. (Lite 트랙)
          </p>
          <p className="text-xs text-gray-500 mt-1">
            일반 쇼핑몰 회원이라면{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              일반 로그인
            </Link>
            을 이용해 주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          <Section title="🔐 로그인 계정">
            <Field label="이메일 *">
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                autoComplete="email"
              />
            </Field>
            <Field label="이름 *">
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
            <Field label="비밀번호 * (8자 이상)">
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                autoComplete="new-password"
              />
            </Field>
            <Field label="비밀번호 확인 *">
              <input
                type="password"
                required
                minLength={8}
                value={form.passwordConfirm}
                onChange={(e) => set('passwordConfirm', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                autoComplete="new-password"
              />
            </Field>
            <Field label="휴대폰">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                autoComplete="tel"
              />
            </Field>
          </Section>

          <Section title="🛍️ 쇼핑몰 정보">
            <Field label="쇼핑몰 이름 *">
              <input
                type="text"
                required
                value={form.shopName}
                onChange={(e) => set('shopName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="우리 쇼핑몰"
              />
            </Field>
            <Field label="URL 주소 (subdomain) *">
              <input
                type="text"
                required
                pattern="^[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]$"
                value={form.subdomain}
                onChange={(e) => set('subdomain', e.target.value.toLowerCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="myshop (3-63자 영소문자/숫자/하이픈)"
              />
            </Field>
            <Field label="개설자 이름">
              <input
                type="text"
                value={form.ownerName}
                onChange={(e) => set('ownerName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="비워두면 위 이름이 사용됩니다"
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

          <Section title="👤 관리자 인적사항 (개설자와 다를 시)">
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
                type="tel"
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

          <Section title="💰 정산 계좌 (선택)">
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

          <div className="border-t pt-4 space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.tosAgreed}
                onChange={(e) => set('tosAgreed', e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <Link href="/policy/terms" target="_blank" className="text-blue-600 hover:underline">
                  이용약관
                </Link>{' '}
                동의 (필수)
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.privacyAgreed}
                onChange={(e) => set('privacyAgreed', e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <Link href="/policy/privacy" target="_blank" className="text-blue-600 hover:underline">
                  개인정보처리방침
                </Link>{' '}
                동의 (필수)
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {submitting ? '발급 중...' : '셀러 가입 + 쇼핑몰 발행'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            가입 즉시 Lite 트랙으로 시작하며, Pro 전환은 관리자 승인이 필요합니다.
          </p>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2 pb-1 border-b border-gray-100">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
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
