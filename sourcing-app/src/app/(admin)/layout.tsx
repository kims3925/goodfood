'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import AdminPanelShell from '@/components/admin/AdminPanelShell'
import { ToastProvider } from '@/components/ui/Toast'
import { BandSessionProvider } from '@/contexts/BandSessionContext'
import { AppSection, UserRole, getSectionFromPath, getDefaultPathBySection, getAvailableSections } from '@/config/navigation'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'
const CURRENT_SECTION_KEY = 'current-section'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [currentSection, setCurrentSection] = useState<AppSection>('sourcing')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [userRole, setUserRole] = useState<UserRole>('USER')
  const [userName, setUserName] = useState('')

  // 인증 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 항상 admin 쿠키 우선 조회 (?preferAdmin=1) — ADMIN 역할이면 /sourcing/*, /shop/*
        // 에서도 어드민패널 레이아웃(단일 패널)을 적용해야 하므로, 매니저 쿠키가 함께 있어도
        // 어드민 세션이 가려지지 않도록 한다. admin 쿠키가 없으면 manager 쿠키로 폴백되어
        // 매니저 전용 로그인에는 영향 없음 (기존 섹션 탭 레이아웃 유지).
        const response = await fetch('/api/auth/session?preferAdmin=1')
        const data = await response.json()

        if (!data.success || !data.user) {
          // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
          return
        }

        setIsAuthenticated(true)
        setUserRole(data.user.role || 'USER')
        setUserName(data.user.name || data.user.email || '')
      } catch (error) {
        console.error('인증 확인 실패:', error)
        router.replace('/login')
      }
    }

    checkAuth()
  }, [pathname, router])

  // URL에서 섹션 감지
  useEffect(() => {
    const section = getSectionFromPath(pathname)
    setCurrentSection(section)
  }, [pathname])

  // localStorage에서 collapsed 상태 복원
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true')
    }
  }, [])

  // collapsed 상태 토글 및 저장
  const handleToggleCollapse = () => {
    const newValue = !sidebarCollapsed
    setSidebarCollapsed(newValue)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue))
  }

  // 섹션 변경 핸들러
  const handleSectionChange = (section: AppSection) => {
    setCurrentSection(section)
    localStorage.setItem(CURRENT_SECTION_KEY, section)

    // 해당 섹션의 기본 페이지로 이동
    const defaultPath = getDefaultPathBySection(section)
    router.push(defaultPath)
  }

  // 인증 확인 중에는 로딩 표시
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // 인증되지 않은 경우 아무것도 렌더링하지 않음 (리다이렉트 중)
  if (!isAuthenticated) {
    return null
  }

  // /admin 경로는 자체 독립 레이아웃(admin/layout.tsx → AdminPanelShell)이 셸을 그리므로
  // 여기서는 Provider만 감싸고 통과 (이중 셸 방지)
  if (pathname.startsWith('/admin')) {
    return (
      <ToastProvider>
        <BandSessionProvider>
          {children}
        </BandSessionProvider>
      </ToastProvider>
    )
  }

  // ADMIN 역할: /sourcing/*, /shop/* 에서도 굿푸드몰 어드민패널 레이아웃 유지 (단일 패널)
  if (userRole === 'ADMIN') {
    return (
      <ToastProvider>
        <BandSessionProvider>
          <AdminPanelShell userName={userName} userRole={userRole}>
            {children}
          </AdminPanelShell>
        </BandSessionProvider>
      </ToastProvider>
    )
  }

  // MANAGER: 기존 섹션 탭 레이아웃 유지 (변경 없음)

  return (
    <ToastProvider>
      <BandSessionProvider>
        <div className="min-h-screen bg-surface">
          <Header
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            currentSection={currentSection}
            onSectionChange={handleSectionChange}
            userRole={userRole}
          />

          <div className="flex h-[calc(100vh-4rem)]">
            <Sidebar
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              collapsed={sidebarCollapsed}
              onToggleCollapse={handleToggleCollapse}
              currentSection={currentSection}
              onSectionChange={handleSectionChange}
              userRole={userRole}
            />

            <main className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 lg:p-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </BandSessionProvider>
    </ToastProvider>
  )
}
