'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      console.log('[로그인] 요청 시작:', formData.email)

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      console.log('[로그인] 응답 상태:', response.status)

      const data = await response.json()
      console.log('[로그인] 응답 데이터:', data)

      if (data.success) {
        console.log('[로그인] 성공! 역할:', data.user?.role)

        // ADMIN, MANAGER가 아니면 접근 거부 페이지로
        if (data.user?.role !== 'ADMIN' && data.user?.role !== 'MANAGER') {
          window.location.href = '/unauthorized'
          return
        }

        // redirect 파라미터가 있으면 해당 경로로, 없으면 매니저 대시보드로
        const params = new URLSearchParams(window.location.search)
        const redirect = params.get('redirect')
        if (redirect && redirect !== '/login' && redirect !== '/') {
          window.location.href = redirect
        } else {
          window.location.href = '/sourcing/dashboard'
        }
      } else {
        console.log('[로그인] 실패:', data.error)
        setError(data.error || '로그인에 실패했습니다.')
      }
    } catch (error) {
      console.error('[로그인] 예외 발생:', error)
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <LogIn className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">로그인</h1>
          <p className="text-gray-600 mt-2">BandAuto 판매관리자</p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@email.com"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비밀번호
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="비밀번호를 입력하세요"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 하단 링크 */}
        <div className="mt-6 text-center space-y-3">
          <p className="text-sm text-gray-600">
            계정이 없으신가요?{' '}
            <a href="/register" className="text-blue-600 hover:underline font-medium">
              판매관리자 등록
            </a>
          </p>
          <p className="text-sm text-gray-600">
            셀러로 가입 + 쇼핑몰 발행을 함께 받고 싶으신가요?{' '}
            <a href="/seller/register" className="text-purple-600 hover:underline font-medium">
              셀러 통합 가입
            </a>
          </p>
          <a
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 inline-block"
          >
            홈으로 돌아가기
          </a>
        </div>
      </div>
    </div>
  )
}
