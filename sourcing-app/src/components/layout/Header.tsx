'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Bell, Zap, Package, Upload, LogIn, LogOut, ClipboardList, Truck, Calculator } from 'lucide-react'
import { AppSection, getDefaultPathBySection } from '@/config/navigation'

interface HeaderProps {
  onMenuClick?: () => void
  currentSection: AppSection
  onSectionChange: (section: AppSection) => void
}

export default function Header({ onMenuClick, currentSection, onSectionChange }: HeaderProps) {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string; name?: string | null } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // 소싱 통계
  const [sourcingStats, setSourcingStats] = useState({
    todayCollected: 0,
    pendingAI: 0,
    readyToUpload: 0,
    published: 0,
  })

  // 쇼핑몰 통계 (TODO: API 연동 필요)
  const [shopStats, setShopStats] = useState({
    pendingOrders: 0,
    shippingToday: 0,
    pendingSettlement: 0,
    inquiries: 0,
  })

  // 통계 데이터 로드
  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/automation/stats')
        const data = await response.json()
        if (data.success) {
          setSourcingStats({
            todayCollected: data.data.todayCollected || 0,
            pendingAI: data.data.pendingTransform || 0,
            readyToUpload: data.data.readyToPublish || 0,
            published: data.data.todayPublished || 0,
          })
        }
      } catch (error) {
        console.error('통계 로드 실패:', error)
      }
    }

    if (user) {
      loadStats()
      // 30초마다 갱신
      const interval = setInterval(loadStats, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  useEffect(() => {
    checkSession()
  }, [])


  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session')
      const data = await response.json()

      if (data.success && data.user) {
        setUser(data.user)
      }
    } catch (error) {
      console.error('세션 확인 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        router.push('/login')
      }
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
  }

  // 현재 섹션에 따른 통계 표시
  const renderStats = () => {
    if (currentSection === 'sourcing') {
      return (
        <>
          <div className="flex items-center gap-2">
            <Package size={16} className="text-green-600" />
            <span className="text-sm text-text-secondary">
              수집: <span className="font-semibold text-text-primary">{sourcingStats.todayCollected}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-yellow-600" />
            <span className="text-sm text-text-secondary">
              AI 대기: <span className="font-semibold text-text-primary">{sourcingStats.pendingAI}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-blue-600" />
            <span className="text-sm text-text-secondary">
              업로드 준비: <span className="font-semibold text-text-primary">{sourcingStats.readyToUpload}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-purple-600" />
            <span className="text-sm text-text-secondary">
              발행 완료: <span className="font-semibold text-text-primary">{sourcingStats.published}</span>
            </span>
          </div>
        </>
      )
    } else {
      return (
        <>
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-blue-600" />
            <span className="text-sm text-text-secondary">
              신규 주문: <span className="font-semibold text-text-primary">{shopStats.pendingOrders}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-green-600" />
            <span className="text-sm text-text-secondary">
              배송 예정: <span className="font-semibold text-text-primary">{shopStats.shippingToday}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-purple-600" />
            <span className="text-sm text-text-secondary">
              정산 대기: <span className="font-semibold text-text-primary">{shopStats.pendingSettlement}</span>
            </span>
          </div>
        </>
      )
    }
  }

  return (
    <header className="bg-white border-b border-border sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side */}
          <div className="flex items-center">
            <button
              onClick={onMenuClick}
              className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface lg:hidden"
            >
              <Menu size={24} />
            </button>

            <a href={getDefaultPathBySection(currentSection)} className="flex items-center ml-2 lg:ml-0 cursor-pointer hover:opacity-80 transition-opacity">
              <h1 className="text-2xl font-bold text-primary-color">BandAuto</h1>
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">release-1</span>
            </a>

          </div>

          {/* Center - Real-time Stats */}
          <div className="hidden md:flex items-center gap-6">
            {renderStats()}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface relative"
              >
                <Bell size={20} />
                {sourcingStats.pendingAI > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 bg-error rounded-full animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-border">
                  <div className="p-4 border-b border-divider">
                    <h3 className="font-semibold text-text-primary">작업 알림</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="p-4 space-y-3">
                      {sourcingStats.pendingAI > 0 && (
                        <div className="p-3 bg-yellow-50 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            <span className="font-semibold">{sourcingStats.pendingAI}개</span>의 상품이 AI 처리 대기 중입니다.
                          </p>
                        </div>
                      )}
                      {sourcingStats.readyToUpload > 0 && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <span className="font-semibold">{sourcingStats.readyToUpload}개</span>의 상품이 스룩페이 업로드 준비되었습니다.
                          </p>
                        </div>
                      )}
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-800">
                          오늘 <span className="font-semibold">{sourcingStats.published}개</span>의 상품이 발행되었습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <button
              className="px-4 py-2 bg-primary-color text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
              onClick={() => window.location.href = '/sourcing/automation/settings'}
            >
              전체 실행
            </button>

            {/* User Menu */}
            {isLoading ? (
              <div className="p-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
              </div>
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-color flex items-center justify-center text-white font-semibold">
                    {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-border">
                    <div className="p-4 border-b border-divider">
                      <p className="text-sm font-semibold text-text-primary">{user.name || '사용자'}</p>
                      <p className="text-xs text-text-secondary truncate">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <LogOut size={16} />
                        로그아웃
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-color hover:bg-primary-light rounded-lg transition-colors"
              >
                <LogIn size={18} />
                로그인
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
