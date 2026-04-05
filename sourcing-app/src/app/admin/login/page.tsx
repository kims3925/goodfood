'use client'

import { useState } from 'react'
import { Shield, Mail, Lock, ArrowLeft } from 'lucide-react'

export default function AdminLoginPage() {
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        if (data.user?.role !== 'ADMIN') {
          setError('어드민 계정만 접근할 수 있습니다. 판매관리자 계정은 판매관리자 로그인을 이용해주세요.')
          setIsLoading(false)
          return
        }

        // ADMIN 로그인 성공 → 어드민 대시보드로
        window.location.href = '/admin/dashboard'
      } else {
        setError(data.error || '로그인에 실패했습니다.')
      }
    } catch (error) {
      console.error('[어드민 로그인] 예외:', error)
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center p-6">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-900/50 rounded-full mb-4">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">어드민 로그인</h1>
          <p className="text-slate-400 mt-2">BandAuto 어드민 패널</p>
        </div>

        {/* 어드민 안내 */}
        <div className="bg-indigo-900/30 border border-indigo-700/50 text-indigo-300 px-4 py-3 rounded-lg mb-6 text-sm">
          어드민 권한이 필요합니다. 어드민 계정으로 로그인해주세요.
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              이메일
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@email.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              비밀번호
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="비밀번호를 입력하세요"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '로그인 중...' : '어드민 로그인'}
          </button>
        </form>

        {/* 하단 링크 */}
        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm text-slate-400 hover:text-slate-300 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            판매관리자 로그인으로 돌아가기
          </a>
        </div>
      </div>
    </div>
  )
}
