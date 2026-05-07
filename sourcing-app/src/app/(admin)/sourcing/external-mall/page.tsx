/**
 * 외부 쇼핑몰 연결 관리 (시나리오 A: 카페24 OAuth + 소싱 실행)
 */
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Store,
  Plus,
  Check,
  X,
  RefreshCw,
  Trash2,
  Settings,
  Link2,
  Sparkles,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'

interface Connection {
  id: number
  name: string
  platform: string
  purpose: string
  mallId: string | null
  shopUrl: string | null
  apiBaseUrl: string | null
  isActive: boolean
  lastSyncAt: string | null
  lastError: string | null
  tokenExpiresAt: string | null
  createdAt: string
  _count: { sourcedProducts: number }
}

const PLATFORM_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CAFE24: { label: '카페24', color: 'text-green-700', bg: 'bg-green-100' },
  OWNERCLAN: { label: '오너클랜', color: 'text-orange-700', bg: 'bg-orange-100' },
  SHOPIFY: { label: 'Shopify', color: 'text-purple-700', bg: 'bg-purple-100' },
  NAVER_STORE: { label: '스마트스토어', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  CUSTOM_API: { label: '커스텀 API', color: 'text-gray-700', bg: 'bg-gray-100' },
}

const PURPOSE_LABELS: Record<string, { label: string; color: string }> = {
  sourcing: { label: '소싱용', color: 'bg-blue-50 text-blue-700' },
  checkout: { label: '결제용', color: 'bg-green-50 text-green-700' },
  both: { label: '소싱+결제', color: 'bg-purple-50 text-purple-700' },
}

export default function ExternalMallPage() {
  const params = useSearchParams()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showCafe24Modal, setShowCafe24Modal] = useState(false)
  const [showSourceModal, setShowSourceModal] = useState<Connection | null>(null)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/external-mall/connections', { credentials: 'include' }).then(
        (r) => r.json()
      )
      if (res.success) setConnections(res.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // OAuth 콜백 후 banner 표시
  useEffect(() => {
    const connected = params.get('connected')
    const error = params.get('error')
    if (connected) setBanner(`✅ 카페24 연결 완료 (ID: ${connected})`)
    else if (error) setBanner(`❌ ${decodeURIComponent(error)}`)
    if (connected || error) {
      const t = setTimeout(() => setBanner(null), 5000)
      return () => clearTimeout(t)
    }
  }, [params])

  async function testConnection(id: number) {
    setBusy(true)
    try {
      const res = await fetch(`/api/external-mall/connections/${id}/test`, {
        method: 'POST',
        credentials: 'include',
      }).then((r) => r.json())
      alert(res.success ? `✅ ${res.message}` : `❌ ${res.message || res.error}`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function deleteConnection(id: number, name: string) {
    if (!confirm(`연결 "${name}" 을 삭제할까요?`)) return
    const res = await fetch(`/api/external-mall/connections/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    }).then((r) => r.json())
    if (res.success) await load()
    else alert(res.error || '실패')
  }

  return (
    <div className="p-6 max-w-6xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6 text-blue-500" /> 외부몰 연동
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            카페24 등 외부 쇼핑몰 API 연결을 관리합니다. 소싱처와 결제처를 분리할 수 있어요.
          </p>
        </div>
        <button
          onClick={() => setShowCafe24Modal(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> 카페24 연결 추가
        </button>
      </header>

      {banner && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded text-sm">
          {banner}
        </div>
      )}

      {loading && <div className="text-center text-gray-500 py-12">로딩 중...</div>}

      {!loading && connections.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">연결된 외부 쇼핑몰이 없습니다</p>
          <p className="text-xs text-gray-500 mt-1">
            카페24 연결 추가 → OAuth 인증 → 상품 소싱
          </p>
        </div>
      )}

      <div className="space-y-3">
        {connections.map((c) => {
          const pl = PLATFORM_LABELS[c.platform] || {
            label: c.platform,
            color: 'text-gray-700',
            bg: 'bg-gray-100',
          }
          const pr = PURPOSE_LABELS[c.purpose] || {
            label: c.purpose,
            color: 'bg-gray-50 text-gray-700',
          }
          const tokenExpired =
            c.tokenExpiresAt && new Date(c.tokenExpiresAt).getTime() < Date.now()

          return (
            <div
              key={c.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4"
            >
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${pl.bg}`}
              >
                <Store className={`w-6 h-6 ${pl.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{c.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${pl.bg} ${pl.color}`}>
                    {pl.label}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${pr.color}`}>
                    {pr.label}
                  </span>
                  {tokenExpired && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> 토큰 만료
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                  {c.shopUrl && (
                    <a
                      href={c.shopUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      {c.shopUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <span>소싱 상품 {c._count.sourcedProducts}개</span>
                  {c.lastSyncAt && (
                    <span>마지막: {new Date(c.lastSyncAt).toLocaleString('ko-KR')}</span>
                  )}
                </div>
                {c.lastError && (
                  <div className="text-xs text-red-600 mt-1">⚠️ {c.lastError}</div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {c.isActive ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <X className="w-5 h-5 text-red-400" />
                )}
                <button
                  onClick={() => setShowSourceModal(c)}
                  className="px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded flex items-center gap-1"
                  disabled={!c.isActive || Boolean(tokenExpired)}
                >
                  <Sparkles className="w-3 h-3" /> 소싱
                </button>
                <button
                  onClick={() => testConnection(c.id)}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> 테스트
                </button>
                <button
                  onClick={() => deleteConnection(c.id, c.name)}
                  className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> 삭제
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
        <h3 className="font-semibold text-yellow-900 mb-1">📘 시나리오 A 사용 흐름</h3>
        <ol className="text-xs text-yellow-800 space-y-1 list-decimal list-inside">
          <li>운영 환경변수에 <code className="bg-white px-1 rounded">CAFE24_CLIENT_ID</code> / <code className="bg-white px-1 rounded">CAFE24_CLIENT_SECRET</code> 등록 (개발자 센터 발급)</li>
          <li>&quot;카페24 연결 추가&quot; 클릭 → mall_id 입력 → OAuth 인증</li>
          <li>연결 완료 후 &quot;소싱&quot; 버튼 → 카페24 상품 → Product DB 자동 생성</li>
          <li>가공 → 소매 밴드 발행 → &quot;주문하기&quot; 클릭 시 카페24 결제 페이지로 직행</li>
        </ol>
      </div>

      {showCafe24Modal && <Cafe24OAuthModal onClose={() => setShowCafe24Modal(false)} />}
      {showSourceModal && (
        <SourceModal
          connection={showSourceModal}
          onClose={() => setShowSourceModal(null)}
          onDone={async () => {
            setShowSourceModal(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

function Cafe24OAuthModal({ onClose }: { onClose: () => void }) {
  const [mallId, setMallId] = useState('')

  function startOAuth() {
    if (!mallId.trim() || !/^[a-z0-9-]{2,20}$/i.test(mallId)) {
      alert('유효한 mall_id 를 입력하세요 (영소문자/숫자/하이픈 2-20자)')
      return
    }
    window.location.href = `/api/external-mall/oauth/cafe24/authorize?mallId=${encodeURIComponent(mallId.trim())}`
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">🛒 카페24 연결 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <p className="text-gray-700">
            본인 카페24 쇼핑몰의 <code className="bg-gray-100 px-1 rounded">mall_id</code> 를
            입력하세요. 카페24 로그인 페이지로 이동하여 앱 사용을 승인하면 자동으로 연결됩니다.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              카페24 mall_id
            </label>
            <input
              value={mallId}
              onChange={(e) => setMallId(e.target.value)}
              placeholder="myshop"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              autoFocus
            />
            <p className="text-[11px] text-gray-500 mt-1">
              예) https://<strong>myshop</strong>.cafe24.com 인 경우 → &quot;myshop&quot;
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-900">
            ⚠️ 이 기능은 운영 환경변수에{' '}
            <code className="bg-white px-1 rounded">CAFE24_CLIENT_ID</code> /{' '}
            <code className="bg-white px-1 rounded">CAFE24_CLIENT_SECRET</code> 가 필요합니다
            (카페24 개발자 센터 → 앱 등록).
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              취소
            </button>
            <button
              onClick={startOAuth}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" /> OAuth 시작
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SourceModal({
  connection,
  onClose,
  onDone,
}: {
  connection: Connection
  onClose: () => void
  onDone: () => void
}) {
  const [maxProducts, setMaxProducts] = useState(20)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [defaultMargin, setDefaultMargin] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function run() {
    setBusy(true)
    try {
      const res = await fetch('/api/external-mall/sourcing', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          maxProducts,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          defaultMargin: defaultMargin ? Number(defaultMargin) : undefined,
        }),
      }).then((r) => r.json())
      if (res.success) setResult(res.data)
      else alert(res.error || '실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">✨ 외부몰 상품 소싱</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-gray-500 mb-3">{connection.name}</div>

        {result ? (
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="font-semibold text-green-900">소싱 완료</div>
              <div className="text-xs text-green-800 mt-1">
                전체 {result.total}개 / 신규 등록 {result.created}개 / 중복 스킵{' '}
                {result.skipped}개 / 실패 {result.failed}개
              </div>
              {result.errors?.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-orange-700">
                    실패 상세 ({result.errors.length})
                  </summary>
                  <ul className="mt-1 list-disc list-inside text-orange-800">
                    {result.errors.slice(0, 10).map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <button
              onClick={onDone}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              완료
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <Field label="최대 수집 개수">
              <input
                type="number"
                min={1}
                max={100}
                value={maxProducts}
                onChange={(e) => setMaxProducts(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="최소 가격 (원)">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="제한 없음"
                />
              </Field>
              <Field label="최대 가격 (원)">
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="제한 없음"
                />
              </Field>
            </div>
            <Field label="마진 (%) — 도매가 기반 판매가 가산">
              <input
                type="number"
                value={defaultMargin}
                onChange={(e) => setDefaultMargin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="0 (소싱처 가격 그대로)"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                disabled={busy}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                취소
              </button>
              <button
                onClick={run}
                disabled={busy}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 flex items-center gap-1"
              >
                {busy ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {busy ? '소싱 중...' : '소싱 실행'}
              </button>
            </div>
          </div>
        )}
      </div>
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
