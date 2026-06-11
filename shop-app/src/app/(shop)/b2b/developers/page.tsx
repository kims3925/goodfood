'use client'

/**
 * B2B 개발자 — API 키 관리 (STEP 4-4, 2026-06-11)
 *
 * B2B 승인 회원이 오픈 API v1 키(clientId/clientSecret)를 발급/재발급/비활성한다.
 * secret 은 발급 직후 1회만 표시.
 */

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useShopUrl } from '@/hooks/useShopUrl'
import { useShop } from '@/contexts/ShopContext'

interface ApiClientRow {
  id: number
  name: string
  clientId: string
  scopes: string
  isActive: boolean
  rateLimit: number
  createdAt: string
  calls7d: number
}

export default function B2bDevelopersPage() {
  const { data: session, status: sessionStatus } = useSession()
  const { getApiPath, getPath } = useShopUrl()
  const { shop } = useShop()
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'

  const [clients, setClients] = useState<ApiClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // 발급 직후 1회 노출되는 secret
  const [issuedSecret, setIssuedSecret] = useState<{ clientId: string; clientSecret: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(getApiPath('/api/b2b/developers')).then((r) => r.json())
      if (!res.success) {
        setErrorMsg(res.error || '조회 실패')
        setClients([])
      } else {
        setClients(res.data || [])
      }
    } catch {
      setErrorMsg('조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [getApiPath])

  useEffect(() => {
    if (session) load()
    else if (sessionStatus !== 'loading') setLoading(false)
  }, [session, sessionStatus, load])

  async function handleCreate() {
    setSubmitting(true)
    setIssuedSecret(null)
    try {
      const res = await fetch(getApiPath('/api/b2b/developers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || 'API 키' }),
      }).then((r) => r.json())
      if (!res.success) {
        alert(res.error || '발급 실패')
        return
      }
      setIssuedSecret({ clientId: res.data.clientId, clientSecret: res.data.clientSecret })
      setNewName('')
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAction(id: number, action: 'regenerate' | 'deactivate' | 'activate') {
    if (action === 'regenerate' && !confirm('secret 을 재발급할까요? 기존 토큰은 모두 무효화됩니다.')) return
    if (action === 'deactivate' && !confirm('이 키를 비활성화할까요? 발급된 토큰이 즉시 무효화됩니다.')) return
    const res = await fetch(getApiPath('/api/b2b/developers'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    }).then((r) => r.json())
    if (!res.success) {
      alert(res.error || '처리 실패')
      return
    }
    if (action === 'regenerate') {
      setIssuedSecret({ clientId: res.data.clientId, clientSecret: res.data.clientSecret })
    }
    await load()
  }

  if (sessionStatus === 'loading' || loading) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">불러오는 중...</div>
  }

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">오픈 API 키 관리</h1>
        <p className="text-gray-500 mb-6">로그인 후 이용할 수 있습니다.</p>
        <a href={getPath('/auth/login')} className="inline-block px-6 py-3 rounded-xl text-white font-medium" style={{ backgroundColor: primaryColor }}>
          로그인하기
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">오픈 API 키 관리</h1>
      <p className="text-sm text-gray-500 mb-6">
        상품조회·발주 오픈 API(v1)에 사용할 인증 키를 관리합니다. (B2B 승인 회원 전용)
      </p>

      {errorMsg && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          {errorMsg}{' '}
          {errorMsg.includes('승인') && (
            <a href={getPath('/b2b/apply')} className="underline font-medium">
              사업자 인증 신청하기
            </a>
          )}
        </div>
      )}

      {issuedSecret && (
        <div className="mb-4 p-4 bg-green-50 border border-green-300 rounded-xl">
          <p className="text-sm font-bold text-green-800 mb-2">
            🔑 발급 완료 — clientSecret 은 지금 한 번만 표시됩니다. 반드시 복사해 보관하세요.
          </p>
          <div className="space-y-1.5 font-mono text-xs bg-white p-3 rounded-lg border border-green-200 break-all">
            <div>
              <span className="text-gray-400">client_id: </span>
              {issuedSecret.clientId}
            </div>
            <div>
              <span className="text-gray-400">client_secret: </span>
              {issuedSecret.clientSecret}
            </div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`client_id=${issuedSecret.clientId}\nclient_secret=${issuedSecret.clientSecret}`)
            }}
            className="mt-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg"
          >
            클립보드에 복사
          </button>
        </div>
      )}

      {!errorMsg && (
        <>
          <div className="flex gap-2 mb-6">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="키 이름 (예: 자사몰 연동)"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
            />
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? '발급 중...' : '키 발급'}
            </button>
          </div>

          <div className="space-y-3">
            {clients.length === 0 ? (
              <div className="py-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200 text-sm">
                발급된 API 키가 없습니다.
              </div>
            ) : (
              clients.map((c) => (
                <div key={c.id} className={`p-4 bg-white rounded-xl border ${c.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{c.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {c.isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">7일 호출 {c.calls7d.toLocaleString()}회</span>
                  </div>
                  <div className="font-mono text-xs text-gray-500 break-all mb-1">client_id: {c.clientId}</div>
                  <div className="text-[11px] text-gray-400 mb-3">
                    scope: {c.scopes} · 분당 {c.rateLimit}회 · 발급 {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAction(c.id, 'regenerate')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-lg">
                      Secret 재발급
                    </button>
                    {c.isActive ? (
                      <button onClick={() => handleAction(c.id, 'deactivate')} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs rounded-lg">
                        비활성화
                      </button>
                    ) : (
                      <button onClick={() => handleAction(c.id, 'activate')} className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs rounded-lg">
                        활성화
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-700 text-sm mb-1">빠른 시작</p>
            <p className="font-mono break-all">
              POST /api/v1/oauth/token (Basic client_id:client_secret, grant_type=client_credentials)
            </p>
            <p className="font-mono">GET /api/v1/products — Bearer 토큰 (2시간 유효)</p>
            <p className="font-mono">POST /api/v1/orders — 발주 생성</p>
            <p>자세한 스펙: docs/api/openapi-v1.md 참조</p>
          </div>
        </>
      )}
    </div>
  )
}
