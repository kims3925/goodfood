'use client'

import { useRouter } from 'next/navigation'
import { ShieldX, ArrowLeft, LogOut } from 'lucide-react'

export default function UnauthorizedPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        {/* 아이콘 */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
          <ShieldX className="w-10 h-10 text-red-600" />
        </div>

        {/* 제목 */}
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          접근 권한이 없습니다
        </h1>

        {/* 설명 */}
        <p className="text-gray-600 mb-8">
          이 페이지는 <span className="font-semibold text-red-600">관리자</span> 전용입니다.<br />
          관리자 권한이 필요하시면 관리자에게 문의하세요.
        </p>

        {/* 안내 박스 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">현재 계정 역할:</span> 회원
          </p>
          <p className="text-sm text-gray-500 mt-1">
            관리자 권한 요청은 시스템 관리자에게 문의하세요.
          </p>
        </div>

        {/* 버튼들 */}
        <div className="space-y-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 text-white py-3 rounded-lg font-semibold hover:bg-gray-900 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            다른 계정으로 로그인
          </button>

          <button
            onClick={() => router.back()}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            이전 페이지로
          </button>
        </div>
      </div>
    </div>
  )
}
