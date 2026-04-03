'use client'

import { useState, useEffect } from 'react'
import { Users, UserCog, Shield, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface UserInfo {
  id: number
  name: string
  email: string
  role: string
  createdAt: string
  signupCompletedAt?: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch('/api/admin/users')
        const data = await response.json()
        if (data.success) {
          setUsers(data.data)
        }
      } catch {
        // 실패 시 기본값
      } finally {
        setIsLoading(false)
      }
    }
    loadUsers()
  }, [])

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await response.json()
      if (data.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      }
    } catch {
      // 실패 처리
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery ||
      u.name.includes(searchQuery) ||
      u.email.includes(searchQuery)
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const roleConfig: Record<string, { label: string; bg: string }> = {
    ADMIN: { label: '관리자', bg: 'bg-red-100 text-red-700' },
    MANAGER: { label: '매니저', bg: 'bg-blue-100 text-blue-700' },
    USER: { label: '일반 사용자', bg: 'bg-gray-100 text-gray-700' },
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">전체 사용자 관리</h1>
            <p className="text-gray-600">플랫폼 사용자 목록 및 역할 관리</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 또는 이메일 검색"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'ADMIN', 'MANAGER', 'USER'].map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  roleFilter === role
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {role === 'all' ? '전체' : roleConfig[role]?.label || role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">
            <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-2" />
            로딩 중...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할 변경</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map(user => {
                  const rc = roleConfig[user.role] || roleConfig.USER
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{user.id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${rc.bg}`}>
                          {rc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="USER">일반 사용자</option>
                          <option value="MANAGER">매니저</option>
                          <option value="ADMIN">관리자</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      검색 결과가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
