'use client'

import { useRouter } from 'next/navigation'
import { ShieldX, ArrowLeft, LogOut } from 'lucide-react'

export default function ForbiddenPage() {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
            <ShieldX className="w-12 h-12 text-red-500" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          접근 권한이 없습니다
        </h1>

        <p className="text-gray-600 mb-8">
          이 페이지는 관리자 또는 소싱 사용자만 접근할 수 있습니다.
          <br />
          권한이 필요하시면 관리자에게 문의해 주세요.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            이전 페이지
          </button>

          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            다른 계정으로 로그인
          </button>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">
            <strong>허용된 역할:</strong> 관리자(ADMIN), 소싱 사용자(SOURCING_USER)
          </p>
        </div>
      </div>
    </div>
  )
}
