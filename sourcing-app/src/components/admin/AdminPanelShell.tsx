'use client'

import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminHeader from '@/components/admin/AdminHeader'

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed'

interface AdminPanelShellProps {
  userName?: string
  userRole?: string
  children: React.ReactNode
}

/**
 * 굿푸드몰 어드민패널 셸 (AdminSidebar + AdminHeader + 콘텐츠 영역)
 *
 * - /admin/* 은 (admin)/admin/layout.tsx 가 인증 확인 후 이 셸을 렌더링
 * - ADMIN 역할이 /sourcing/*, /shop/* 에 진입하면 (admin)/layout.tsx 가
 *   섹션 탭 레이아웃 대신 이 셸을 적용 — 단일 어드민패널 유지
 */
export default function AdminPanelShell({ userName, userRole, children }: AdminPanelShellProps) {
  const [collapsed, setCollapsed] = useState(false)

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
