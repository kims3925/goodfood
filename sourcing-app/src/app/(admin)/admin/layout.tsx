'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import AdminPanelShell from '@/components/admin/AdminPanelShell'

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')

  // 인증 + ADMIN 역할 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 어드민 패널 → admin 쿠키 우선 조회 (매니저 쿠키 공존 시 매니저로 가려져 튕기던 버그 방지)
        const res = await fetch('/api/auth/session?preferAdmin=1')
        const data = await res.json()

        if (!data.success || !data.user) {
          router.replace('/admin/login')
          return
        }

        if (data.user.role !== 'ADMIN') {
          router.replace('/admin/login')
          return
        }

        setIsAuthenticated(true)
        setUserName(data.user.name || data.user.email || 'Admin')
        setUserRole(data.user.role)
      } catch {
        router.replace('/login')
      }
    }

    checkAuth()
  }, [pathname, router])

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">어드민 패널 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <AdminPanelShell userName={userName} userRole={userRole}>
      {children}
    </AdminPanelShell>
  )
}
