'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { ToastProvider } from '@/components/ui/Toast'
import { AppSection, getSectionFromPath, getDefaultPathBySection } from '@/config/navigation'

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

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface">
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          currentSection={currentSection}
          onSectionChange={handleSectionChange}
        />

        <div className="flex h-[calc(100vh-4rem)]">
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            collapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleCollapse}
            currentSection={currentSection}
            onSectionChange={handleSectionChange}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
