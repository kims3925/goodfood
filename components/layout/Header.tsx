'use client'

import { useState } from 'react'
import { Menu, Bell, Zap, Package, Upload } from 'lucide-react'

interface HeaderProps {
  onMenuClick?: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false)

  // 실시간 상태 (실제로는 상태 관리 도구에서 가져올 것)
  const stats = {
    todayCollected: 45,
    pendingAI: 12,
    readyToUpload: 8,
    published: 25,
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
            
            <a href="/" className="flex items-center ml-2 lg:ml-0 cursor-pointer hover:opacity-80 transition-opacity">
              <h1 className="text-2xl font-bold text-primary-color">BandAuto</h1>
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">v1.2</span>
            </a>
          </div>

          {/* Center - Real-time Stats */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-green-600" />
              <span className="text-sm text-text-secondary">
                수집: <span className="font-semibold text-text-primary">{stats.todayCollected}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-yellow-600" />
              <span className="text-sm text-text-secondary">
                AI 대기: <span className="font-semibold text-text-primary">{stats.pendingAI}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-blue-600" />
              <span className="text-sm text-text-secondary">
                업로드 준비: <span className="font-semibold text-text-primary">{stats.readyToUpload}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-purple-600" />
              <span className="text-sm text-text-secondary">
                발행 완료: <span className="font-semibold text-text-primary">{stats.published}</span>
              </span>
            </div>
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
                {stats.pendingAI > 0 && (
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
                      {stats.pendingAI > 0 && (
                        <div className="p-3 bg-yellow-50 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            <span className="font-semibold">{stats.pendingAI}개</span>의 상품이 AI 처리 대기 중입니다.
                          </p>
                        </div>
                      )}
                      {stats.readyToUpload > 0 && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <span className="font-semibold">{stats.readyToUpload}개</span>의 상품이 스룩페이 업로드 준비되었습니다.
                          </p>
                        </div>
                      )}
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-800">
                          오늘 <span className="font-semibold">{stats.published}개</span>의 상품이 발행되었습니다.
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
              onClick={() => window.location.href = '/automation/workflow'}
            >
              전체 실행
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}