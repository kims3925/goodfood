/**
 * Lite Band — 내 Band 채널 + 세션 관리
 *
 * 셀러는 본인 Band 계정 쿠키를 직접 등록해야 자동 발행이 동작.
 * 어드민이 채널 메타(이름, channelKey)는 미리 등록했으므로 셀러는 쿠키만 입력.
 */
'use client'

import { useEffect, useState } from 'react'
import { Radio, Cookie, AlertTriangle, Check, ExternalLink } from 'lucide-react'

interface ChannelInfo {
  id: number
  name: string
  channelKey: string
  isActive: boolean
  sessionExpiresAt: string | null
  hasSession: boolean
}

export default function LiteChannelPage() {
  const [channels, setChannels] = useState<ChannelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [cookieInput, setCookieInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/lite/channel', { credentials: 'include' }).then((r) => r.json())
      if (res.success) setChannels(res.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function saveCookie(channelId: number) {
    if (!cookieInput.trim()) {
      alert('쿠키를 입력하세요')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/lite/channel', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, bandSessionCookie: cookieInput.trim() }),
      }).then((r) => r.json())
      if (res.success) {
        setSavedAt(new Date())
        setEditingId(null)
        setCookieInput('')
        await load()
      } else alert(res.error || '실패')
    } finally {
      setSaving(false)
    }
  }

  function isExpired(c: ChannelInfo): boolean {
    if (!c.sessionExpiresAt) return true
    return new Date(c.sessionExpiresAt).getTime() < Date.now()
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Radio className="w-6 h-6 text-green-500" /> 내 Band 채널
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          본인 Band 세션 쿠키를 등록하면 매일 자동 등록되는 상품이 본인 Band에도 자동 발행됩니다.
        </p>
      </header>

      {loading && <div className="text-center text-gray-500 py-12">로딩 중...</div>}

      {!loading && channels.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-700">등록된 Band 채널이 없습니다.</p>
          <p className="text-xs text-gray-500 mt-2">
            어드민에게 본인 Band 정보(band_key, 이름) 등록을 요청해 주세요.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {channels.map((c) => {
          const expired = isExpired(c)
          const editing = editingId === c.id
          return (
            <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{c.name}</h2>
                    <span className="text-xs text-gray-500">band_key: {c.channelKey}</span>
                  </div>
                  <a
                    href={`https://band.us/band/${c.channelKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Band 열기
                  </a>
                </div>
                <div className="text-right">
                  {!c.hasSession || expired ? (
                    <div className="flex items-center gap-1 text-orange-600 text-xs">
                      <AlertTriangle className="w-4 h-4" />
                      {!c.hasSession ? '쿠키 미등록' : '세션 만료'}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-green-600 text-xs">
                      <Check className="w-4 h-4" /> 세션 활성
                    </div>
                  )}
                  {c.sessionExpiresAt && (
                    <div className="text-[10px] text-gray-400 mt-1">
                      만료: {new Date(c.sessionExpiresAt).toLocaleDateString('ko-KR')}
                    </div>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="border-t border-gray-200 pt-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Band 세션 쿠키 (전체 Cookie 헤더 값)
                  </label>
                  <textarea
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono"
                    rows={4}
                    placeholder="auth=...; AB_SESS=...; ..."
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => saveCookie(c.id)}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                    >
                      {saving ? '저장 중...' : '쿠키 저장'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null)
                        setCookieInput('')
                      }}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingId(c.id)
                    setCookieInput('')
                  }}
                  className="px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded flex items-center gap-1"
                >
                  <Cookie className="w-4 h-4" />
                  {c.hasSession ? '쿠키 갱신' : '쿠키 등록'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-sm font-semibold text-yellow-900 mb-2">📘 쿠키 가져오는 방법</h3>
        <ol className="text-xs text-yellow-800 space-y-1 list-decimal list-inside">
          <li>PC 크롬으로 band.us 로그인</li>
          <li>F12 → Application → Cookies → https://band.us 선택</li>
          <li>auth, AB_SESS 등 모든 쿠키를 &quot;name=value; name2=value2&quot; 형태로 묶어서 입력</li>
          <li>&quot;쿠키 등록&quot;으로 저장 → 자동 발행이 활성화됩니다</li>
        </ol>
      </div>

      {savedAt && (
        <div className="mt-3 text-xs text-green-700">✓ 저장 완료 ({savedAt.toLocaleTimeString('ko-KR')})</div>
      )}
    </div>
  )
}
