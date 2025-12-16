'use client'

import { useState, useEffect, useRef, memo } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Bell, Zap, Package, Upload, LogIn, LogOut, ClipboardList, Truck, Calculator, ShoppingCart, XCircle, RotateCcw, MessageSquare, Wallet, Check, AlertCircle, Info } from 'lucide-react'
import { AppSection, getDefaultPathBySection } from '@/config/navigation'

// 상대 시간 표시 컴포넌트 (독립적으로 업데이트되어 반짝임 방지)
const RelativeTime = memo(function RelativeTime({ dateString }: { dateString: string }) {
  const [timeText, setTimeText] = useState('')

  useEffect(() => {
    const formatTime = () => {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMinutes / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffMinutes < 1) return '방금 전'
      if (diffMinutes < 60) return `${diffMinutes}분 전`
      if (diffHours < 24) return `${diffHours}시간 전`
      if (diffDays < 7) return `${diffDays}일 전`
      return `${date.getMonth() + 1}/${date.getDate()}`
    }

    setTimeText(formatTime())

    // 1분마다 시간 텍스트만 업데이트 (API 호출 없이)
    const interval = setInterval(() => {
      setTimeText(formatTime())
    }, 60000)

    return () => clearInterval(interval)
  }, [dateString])

  return <span className="text-xs text-gray-400">{timeText}</span>
})

interface HeaderProps {
  onMenuClick?: () => void
  currentSection: AppSection
  onSectionChange: (section: AppSection) => void
}

// 알림 타입 (Shop + Sourcing)
type NotificationType = 'ORDER' | 'CANCEL' | 'REFUND' | 'INQUIRY' | 'SETTLEMENT' | 'COLLECT' | 'TRANSFORM' | 'PUBLISH' | 'ERROR' | 'INFO'

interface AppNotification {
  id: number
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  link?: string
  createdAt: string
}

// 타입별 설정 (Shop + Sourcing)
const notificationTypeConfig: Record<NotificationType, { icon: React.ReactNode; bg: string; text: string }> = {
  // Shop 알림 타입
  ORDER: { icon: <ShoppingCart size={14} />, bg: 'bg-blue-100', text: 'text-blue-600' },
  CANCEL: { icon: <XCircle size={14} />, bg: 'bg-orange-100', text: 'text-orange-600' },
  REFUND: { icon: <RotateCcw size={14} />, bg: 'bg-red-100', text: 'text-red-600' },
  INQUIRY: { icon: <MessageSquare size={14} />, bg: 'bg-purple-100', text: 'text-purple-600' },
  SETTLEMENT: { icon: <Wallet size={14} />, bg: 'bg-green-100', text: 'text-green-600' },
  // Sourcing 알림 타입
  COLLECT: { icon: <Package size={14} />, bg: 'bg-green-100', text: 'text-green-600' },
  TRANSFORM: { icon: <Zap size={14} />, bg: 'bg-yellow-100', text: 'text-yellow-600' },
  PUBLISH: { icon: <Upload size={14} />, bg: 'bg-blue-100', text: 'text-blue-600' },
  ERROR: { icon: <AlertCircle size={14} />, bg: 'bg-red-100', text: 'text-red-600' },
  INFO: { icon: <Info size={14} />, bg: 'bg-gray-100', text: 'text-gray-600' },
}

export default function Header({ onMenuClick, currentSection, onSectionChange }: HeaderProps) {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string; name?: string | null } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)

  // 알림 (현재 섹션에 따라 shop 또는 sourcing)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationLoading, setNotificationLoading] = useState(false)

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

  // 알림 데이터 로드 (현재 섹션에 따라)
  const loadNotifications = async () => {
    try {
      setNotificationLoading(true)
      const response = await fetch(`/api/admin/notifications?section=${currentSection}&limit=10`)
      const data = await response.json()
      if (data.success) {
        setNotifications(data.data.notifications || [])
        setUnreadCount(data.data.stats?.unread || 0)
      }
    } catch (error) {
      console.error('알림 로드 실패:', error)
    } finally {
      setNotificationLoading(false)
    }
  }

  // 알림 읽음 처리
  const handleMarkAsRead = async (ids: number[]) => {
    try {
      await fetch('/api/admin/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      loadNotifications()
    } catch (error) {
      console.error('읽음 처리 실패:', error)
    }
  }

  // 알림 클릭 시 이동
  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.isRead) {
      handleMarkAsRead([notification.id])
    }
    if (notification.link) {
      setShowNotifications(false)
      router.push(notification.link)
    }
  }

  // 모든 알림 읽음 처리
  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id)
    if (unreadIds.length > 0) {
      await handleMarkAsRead(unreadIds)
    }
  }

  // 알림 로드 (로그인 시 및 섹션 변경 시)
  useEffect(() => {
    if (user) {
      loadNotifications()
      // 30초마다 갱신
      const notificationInterval = setInterval(loadNotifications, 30000)
      return () => clearInterval(notificationInterval)
    }
  }, [user, currentSection])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    <header className="bg-white border-b border-border sticky top-0 z-50">
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
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface relative"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-border z-[9999]">
                  <div className="p-3 border-b border-divider flex items-center justify-between">
                    <h3 className="font-semibold text-text-primary">알림</h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Check size={12} />
                          모두 읽음
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {notificationLoading ? (
                      <div className="p-8 text-center text-gray-400">
                        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto"></div>
                      </div>
                    ) : notifications.length > 0 ? (
                      <div className="divide-y divide-gray-100">
                        {notifications.map((notification) => {
                          const config = notificationTypeConfig[notification.type] || notificationTypeConfig.ORDER
                          return (
                            <div
                              key={notification.id}
                              onClick={() => handleNotificationClick(notification)}
                              className={`px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                                !notification.isRead ? 'bg-blue-50/50' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${config.bg} ${config.text} flex-shrink-0`}>
                                  {config.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm truncate ${!notification.isRead ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                    {notification.title}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <RelativeTime dateString={notification.createdAt} />
                                  {!notification.isRead && (
                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-400">
                        <Bell size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">새로운 알림이 없습니다</p>
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-t border-divider">
                    <button
                      onClick={() => {
                        setShowNotifications(false)
                        router.push(`/${currentSection}/notification`)
                      }}
                      className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      모든 알림 보기
                    </button>
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
