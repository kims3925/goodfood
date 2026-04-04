'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LogOut,
  ArrowLeft,
  Bell,
  User,
  ChevronDown,
  Cpu,
} from 'lucide-react'

interface AdminHeaderProps {
  userName?: string
  userRole?: string
}

export default function AdminHeader({ userName, userRole }: AdminHeaderProps) {
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [user, setUser] = useState({ name: userName || '', role: userRole || '' })

  useEffect(() => {
    if (!userName) {
      fetch('/api/auth/session')
        .then(r => r.json())
        .then(data => {
          if (data.success && data.user) {
            setUser({ name: data.user.name || data.user.email || 'Admin', role: data.user.role || 'ADMIN' })
          }
        })
        .catch(() => {})
    }
  }, [userName])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.replace('/login')
    } catch {
      router.replace('/login')
    }
  }, [router])

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-10">
      {/* Left: Back to main + breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/sourcing/dashboard"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">매니저로 돌아가기</span>
        </Link>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-indigo-600" />
          <span className="text-sm font-semibold text-gray-900">어드민 패널</span>
        </div>
      </div>

      {/* Right: Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(prev => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
              <User size={14} className="text-indigo-600" />
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-gray-700">{user.name}</div>
              <div className="text-[10px] text-gray-400">{user.role}</div>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
                <Link
                  href="/admin/system/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User size={14} />
                  시스템 설정
                </Link>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={14} />
                  로그아웃
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
