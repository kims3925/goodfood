'use client'

import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Bell, Zap, Package, Upload, LogIn, LogOut, ClipboardList, Truck, Calculator, ShoppingCart, XCircle, RotateCcw, MessageSquare, Wallet, Check, AlertCircle, Info, Wifi, WifiOff, RefreshCw, Save, Users, Eye } from 'lucide-react'
import { AppSection, getDefaultPathBySection } from '@/config/navigation'
import { useBandSession } from '@/contexts/BandSessionContext'
import { checkExtensionInstalled, saveSessionViaExtension } from '@/lib/band-extension'

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

// 세션 상태 인디케이터 컴포넌트
const SessionIndicator = memo(function SessionIndicator() {
  const { summary, isLoading, checkSession, lastChecked, channels } = useBandSession()
  const [showTooltip, setShowTooltip] = useState(false)
  const [extensionAvailable, setExtensionAvailable] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Extension 설치 여부 확인
  useEffect(() => {
    checkExtensionInstalled().then(setExtensionAvailable)
  }, [])

  // 세션 저장 핸들러
  const handleSaveSession = async () => {
    if (isSaving) return

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const result = await saveSessionViaExtension()

      if (result.success && result.data) {
        setSaveMessage({
          type: 'success',
          text: `${result.data.channelCount}개 채널 저장 완료!`,
        })
        // 저장 후 즉시 세션 상태 새로고침
        checkSession()
        // 메시지는 2초 후 제거
        setTimeout(() => setSaveMessage(null), 2000)
      } else {
        setSaveMessage({
          type: 'error',
          text: result.error || '저장 실패',
        })
        setTimeout(() => setSaveMessage(null), 3000)
      }
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: 'Extension 통신 오류',
      })
      setTimeout(() => setSaveMessage(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading && !summary) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-full">
        <RefreshCw size={14} className="text-gray-400 animate-spin" />
        <span className="text-xs text-gray-500">확인 중...</span>
      </div>
    )
  }

  // 채널도 없고 Extension도 없으면 표시 안함
  // Extension이 있으면 채널 없어도 세션 저장 버튼은 표시
  if (!summary || (summary.total === 0 && !extensionAvailable)) {
    return null
  }

  const isHealthy = summary.allValid
  const hasExpired = summary.expired > 0

  return (
    <div className="relative flex items-center gap-1">
      {/* 세션 저장 버튼 (Extension 설치 시만 표시) */}
      {extensionAvailable && (
        <button
          onClick={handleSaveSession}
          disabled={isSaving}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
            isSaving
              ? 'bg-gray-100 text-gray-400 cursor-wait'
              : saveMessage?.type === 'success'
              ? 'bg-green-100 text-green-700'
              : saveMessage?.type === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
          }`}
          title="Band 세션 저장 (Extension)"
        >
          {isSaving ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : saveMessage ? (
            saveMessage.type === 'success' ? <Check size={12} /> : <AlertCircle size={12} />
          ) : (
            <Save size={12} />
          )}
          <span>{saveMessage?.text || '세션 저장'}</span>
        </button>
      )}

      {/* 세션 상태 표시 버튼 (채널이 있을 때만) */}
      {summary.total > 0 && (
        <button
          onClick={checkSession}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
            isHealthy
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : hasExpired
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
          }`}
          title="클릭하여 세션 상태 새로고침"
        >
          {isHealthy ? (
            <Wifi size={14} />
          ) : (
            <WifiOff size={14} />
          )}
          <span className="text-xs font-medium">
            {isHealthy
              ? `세션 ${summary.valid}/${summary.total}`
              : hasExpired
              ? `만료 ${summary.expired}개`
              : `미설정 ${summary.none}개`}
          </span>
          {isLoading && <RefreshCw size={12} className="animate-spin" />}
        </button>
      )}

      {/* 툴팁 (채널이 있을 때만) */}
      {showTooltip && summary.total > 0 && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
          <div className="text-xs font-medium text-gray-700 mb-2">Band 세션 상태</div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {channels.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 truncate max-w-[140px]">{ch.name}</span>
                {ch.isValid ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Wifi size={10} />
                    정상
                  </span>
                ) : ch.hasSession ? (
                  <span className="flex items-center gap-1 text-red-600">
                    <WifiOff size={10} />
                    만료
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-400">
                    <WifiOff size={10} />
                    미설정
                  </span>
                )}
              </div>
            ))}
          </div>
          {/* Extension 미설치 안내 */}
          {!extensionAvailable && (summary.none > 0 || summary.expired > 0) && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Chrome Extension</strong>을 설치하면 여기서 바로 세션을 저장할 수 있어요.
                </span>
              </div>
            </div>
          )}
          {lastChecked && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
              마지막 확인: {lastChecked.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// 실시간 접속자 인디케이터 컴포넌트
const VisitorIndicator = memo(function VisitorIndicator() {
  const router = useRouter()
  const [visitorCount, setVisitorCount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchVisitorCount = async () => {
      try {
        const response = await fetch('/api/shop/visitors')
        const data = await response.json()
        if (data.success) {
          setVisitorCount(data.data.stats.total)
        }
      } catch {
        // 에러 시 null 유지
      } finally {
        setIsLoading(false)
      }
    }

    fetchVisitorCount()
    // 10초마다 갱신
    const interval = setInterval(fetchVisitorCount, 10000)
    return () => clearInterval(interval)
  }, [])

  // 로딩 중이거나 데이터가 없으면 표시 안함
  if (isLoading || visitorCount === null) {
    return null
  }

  return (
    <button
      onClick={() => router.push('/shop/visitors')}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
        visitorCount > 0
          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
      title="실시간 접속자 보기"
    >
      <Eye size={14} />
      <span className="text-xs font-medium">{visitorCount}</span>
    </button>
  )
})

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

  // 알림 데이터 로드 (현재 섹션에 따라, 읽지 않은 알림만)
  const loadNotifications = useCallback(async () => {
    try {
      setNotificationLoading(true)
      const response = await fetch(`/api/admin/notifications?section=${currentSection}&limit=10&isRead=false`)
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
  }, [currentSection])

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
  }, [user, loadNotifications])

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
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-surface lg:hidden"
              aria-label="메뉴 열기"
            >
              <Menu size={24} />
            </button>

            <a href={getDefaultPathBySection(currentSection)} className="flex items-center ml-2 lg:ml-0 cursor-pointer hover:opacity-80 transition-opacity">
              <h1 className="text-2xl font-bold text-primary-color">SNS AUTO</h1>
            </a>

          </div>

          {/* Center - Real-time Stats */}
          {/* Desktop: 전체 통계 */}
          <div className="hidden md:flex items-center gap-6">
            {renderStats()}
          </div>
          {/* Mobile: 간소화된 통계 (sm 이상 ~ md 미만) */}
          <div className="hidden sm:flex md:hidden items-center gap-3">
            {currentSection === 'sourcing' ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Package size={14} className="text-green-600" />
                  <span className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{sourcingStats.todayCollected}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap size={14} className="text-yellow-600" />
                  <span className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{sourcingStats.pendingAI}</span>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-blue-600" />
                  <span className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{shopStats.pendingOrders}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Truck size={14} className="text-green-600" />
                  <span className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{shopStats.shippingToday}</span>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* 실시간 접속자 */}
            <VisitorIndicator />

            {/* Band Session Status */}
            <SessionIndicator />

            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-surface relative"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-[384px] bg-white rounded-lg shadow-xl border border-border z-[9999]">
                  <div className="p-3 border-b border-divider flex items-center justify-between">
                    <h3 className="font-semibold text-text-primary">알림</h3>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && (
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

            {/* User Menu */}
            {isLoading ? (
              <div className="p-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
              </div>
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center justify-center gap-2 p-2 min-w-[44px] min-h-[44px] rounded-md text-text-secondary hover:text-text-primary hover:bg-surface"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-color flex items-center justify-center text-white font-semibold">
                    {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white rounded-lg shadow-lg border border-border">
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
