'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // 로그인 없이 바로 admin 대시보드로 리다이렉트
    router.push('/admin')
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-4xl font-bold mb-4">BandAuto</h1>
        <p className="text-xl">1차 개발 - 소싱 & 상품 등록 자동화</p>
        <div className="mt-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">대시보드로 이동 중...</p>
        </div>
      </div>
    </div>
  )
}