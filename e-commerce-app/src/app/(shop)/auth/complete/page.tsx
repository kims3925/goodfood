'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function AuthCompletePage() {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const [agreeTos, setAgreeTos] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 로그인/온보딩 상태에 따라 리다이렉트
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.id) {
      router.replace('/auth/login')
      return
    }
    if (!(session.user as any).pendingSignup) {
      router.replace('/')
    }
  }, [session, status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!agreeTos || !agreePrivacy) {
      setError('필수 약관에 동의해주세요.')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/auth/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreeTos, agreePrivacy, agreeMarketing }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || '온보딩에 실패했습니다.')
      }

      // 세션 갱신 후 홈으로 이동
      await update()
      router.replace('/')
    } catch (err: any) {
      setError(err.message || '온보딩에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || !session?.user?.id) {
    return (
      <div className="kurly-container py-12 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF6B6B] mx-auto" />
      </div>
    )
  }

  return (
    <div className="kurly-container max-w-2xl py-12">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">계정 사용을 마무리해주세요</h1>
        <p className="text-gray-600 mb-6">
          소셜 로그인으로 가입을 시작했습니다. 필수 약관에 동의하면 계정이 활성화됩니다.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-[#FF6B6B] focus:ring-[#FF6B6B]"
              checked={agreeTos}
              onChange={(e) => setAgreeTos(e.target.checked)}
              required
            />
            <span className="text-sm text-gray-800">
              (필수) 서비스 이용약관 및 전자상거래 표준약관에 동의합니다.
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-[#FF6B6B] focus:ring-[#FF6B6B]"
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
              required
            />
            <span className="text-sm text-gray-800">
              (필수) 개인정보 수집 및 이용에 동의합니다.
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-[#FF6B6B] focus:ring-[#FF6B6B]"
              checked={agreeMarketing}
              onChange={(e) => setAgreeMarketing(e.target.checked)}
            />
            <span className="text-sm text-gray-800">
              (선택) 프로모션, 할인 정보 등 마케팅 수신에 동의합니다.
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#FF6B6B] text-white font-semibold rounded-lg hover:bg-[#ff5a5a] transition disabled:opacity-60"
          >
            {submitting ? '처리 중...' : '동의하고 계속하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
