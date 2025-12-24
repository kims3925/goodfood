'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react'
import { useShop } from '@/contexts/ShopContext'
import { useShopUrl } from '@/hooks/useShopUrl'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const { shop } = useShop()
  const { getPath } = useShopUrl()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const shopName = shop?.name
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'
  const callbackUrl = searchParams.get('callbackUrl') || getPath('/main')

  // 로그인된 사용자는 리다이렉트
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const user = session.user as any
      if (user.pendingSignup) {
        router.replace(getPath('/auth/complete'))
      } else {
        router.replace(callbackUrl)
      }
    }
  }, [status, session, router, callbackUrl, getPath])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        setIsLoading(false)
        return
      }

      router.refresh()
    } catch (err) {
      setError('로그인 중 문제가 발생했습니다.')
      setIsLoading(false)
    }
  }

  // 로딩 중이면 스피너 표시
  if (status === 'loading') {
    return (
      <div className="bg-gray-50 flex-1 flex items-center justify-center py-12 md:py-16 px-4">
        <div
          className="animate-spin rounded-full h-10 w-10 border-b-2"
          style={{ borderColor: primaryColor }}
        />
      </div>
    )
  }

  return (
    <div className="bg-gray-50 flex-1 flex items-center justify-center py-12 md:py-16 px-4">
      <div className="max-w-md w-full">
        {/* Shop Name */}
        <div className="text-center mb-4">
          <Link href={getPath('/main')} className="inline-block">
            <h1 className="text-4xl font-black" style={{ color: primaryColor }}>
              {shopName}
            </h1>
          </Link>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-center mb-6">로그인</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:border-transparent outline-none transition"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-md focus:ring-2 focus:border-transparent outline-none transition"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300"
                  style={{ accentColor: primaryColor }}
                />
                <span className="text-gray-600">로그인 상태 유지</span>
              </label>
              <Link href={getPath('/auth/forgot-password')} className="hover:underline" style={{ color: primaryColor }}>
                비밀번호 찾기
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 text-white font-bold rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  로그인 중...
                </>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          {/* Signup Link */}
          <p className="mt-6 text-center text-gray-600">
            아직 회원이 아니신가요?{' '}
            <Link href={getPath('/auth/signup')} className="font-medium hover:underline" style={{ color: primaryColor }}>
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function LoginFallback() {
  return (
    <div className="bg-gray-50 flex-1 flex items-center justify-center py-12 md:py-16 px-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-400" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  )
}
