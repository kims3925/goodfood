'use client'

/**
 * 어드민 — 플랫폼 Band API 토큰 (2026-06-11)
 *
 * "일괄설정" 모드를 선택한 매니저 전체가 공유하는 Band Open API Access Token 을 관리한다.
 * 매니저 측: 설정 > 밴드 연동/API > Band API 설정에서 "플랫폼 일괄설정 사용" 선택.
 * 토큰을 갱신하면 일괄설정 모드 매니저 전체에 즉시 적용된다 (별도 배포/재설정 불필요).
 */

import { useState, useEffect, useCallback } from 'react'
import { KeyRound, Save, CheckCircle2, AlertCircle } from 'lucide-react'

interface TokenInfo {
  configured: boolean
  tokenTail: string | null
  updatedAt: string | null
  ownerUserId: number | null
}

export default function AdminBandApiPage() {
  const [info, setInfo] = useState<TokenInfo | null>(null)
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/band-token', { credentials: 'include' }).then((r) =>
        r.json()
      )
      if (res.success) setInfo(res.data)
    } catch (e) {
      console.error('플랫폼 Band 토큰 조회 실패:', e)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave() {
    if (!token.trim()) {
      setMessage({ type: 'error', text: 'Access Token을 입력해 주세요.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/band-token', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '저장 실패')
      setInfo(res.data)
      setToken('')
      setMessage({
        type: 'success',
        text: '플랫폼 토큰이 저장되었습니다. 일괄설정 모드의 모든 매니저에게 즉시 적용됩니다.',
      })
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || '저장 실패' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <KeyRound size={22} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">플랫폼 Band API 토큰</h1>
          <p className="text-sm text-gray-500">
            Band API 설정에서 &quot;플랫폼 일괄설정&quot;을 선택한 매니저 전체가 이 토큰을
            공유합니다.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">현재 상태:</span>
          {info?.configured ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 size={15} />
              등록됨 (…{info.tokenTail})
              {info.updatedAt && (
                <span className="text-gray-400 font-normal">
                  · {new Date(info.updatedAt).toLocaleString('ko-KR')} 갱신
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
              <AlertCircle size={15} />
              미등록 — 일괄설정 모드 매니저는 Band API 를 사용할 수 없습니다
            </span>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            새 Access Token
          </label>
          <textarea
            value={token}
            onChange={(e) => {
              setToken(e.target.value)
              setMessage(null)
            }}
            placeholder="Band Developers에서 발급받은 Access Token 입력 (예: 플랫폼 계정 jins3925@naver.com 토큰)"
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            저장 즉시 일괄설정 모드 매니저 전체에 적용됩니다. 기존 토큰은 덮어써집니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            <Save size={15} />
            {saving ? '저장 중…' : '토큰 저장'}
          </button>
          {message && (
            <p
              className={`text-xs ${message.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
            >
              {message.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
