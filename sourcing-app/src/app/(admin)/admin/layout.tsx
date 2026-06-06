'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminHeader from '@/components/admin/AdminHeader'

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed'

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
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

  // localStorage에서 collapsed 복원
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (saved !== null) {
      setCollapsed(saved === 'true')
    }
  }, [])

  const handleToggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
  }

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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <AdminSidebar
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <AdminHeader userName={userName} userRole={userRole} />

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
