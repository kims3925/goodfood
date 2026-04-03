'use client'

import { Shield, Users, UserCog, Eye, Settings, ShoppingBag, Package, Bot, Server } from 'lucide-react'

interface RolePermission {
  module: string
  icon: React.ReactNode
  user: boolean
  manager: boolean
  admin: boolean
}

const permissions: RolePermission[] = [
  { module: '매니저 대시보드', icon: <Package size={16} />, user: false, manager: true, admin: true },
  { module: '채널 관리', icon: <Settings size={16} />, user: false, manager: true, admin: true },
  { module: '상품 수집/가공', icon: <Package size={16} />, user: false, manager: true, admin: true },
  { module: '자동화 설정', icon: <Bot size={16} />, user: false, manager: true, admin: true },
  { module: '쇼핑몰 관리', icon: <ShoppingBag size={16} />, user: false, manager: true, admin: true },
  { module: '주문/정산', icon: <ShoppingBag size={16} />, user: false, manager: true, admin: true },
  { module: '고객 문의/리뷰', icon: <Users size={16} />, user: false, manager: true, admin: true },
  { module: '쿠폰 관리', icon: <Settings size={16} />, user: false, manager: true, admin: true },
  { module: '정책 관리', icon: <Shield size={16} />, user: false, manager: false, admin: true },
  { module: '어드민 패널', icon: <Server size={16} />, user: false, manager: false, admin: true },
  { module: '에이전트팀 관리', icon: <Bot size={16} />, user: false, manager: false, admin: true },
  { module: '사용자 관리', icon: <UserCog size={16} />, user: false, manager: false, admin: true },
  { module: '시스템 설정', icon: <Settings size={16} />, user: false, manager: false, admin: true },
  { module: '쇼핑몰 이용 (고객)', icon: <Eye size={16} />, user: true, manager: true, admin: true },
]

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Shield className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">역할 / 권한</h1>
            <p className="text-gray-600">사용자 역할별 접근 권한 매트릭스</p>
          </div>
        </div>
      </div>

      {/* Role descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RoleCard role="USER" label="일반 사용자" description="쇼핑몰 이용, 상품 구매, 주문 관리" color="gray" />
        <RoleCard role="MANAGER" label="매니저" description="채널 관리, 상품 소싱/가공, 쇼핑몰 운영, 주문/정산" color="blue" />
        <RoleCard role="ADMIN" label="관리자" description="전체 플랫폼 관리, 에이전트팀, 시스템 설정, 사용자 관리" color="red" />
      </div>

      {/* Permission Matrix */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">권한 매트릭스</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-64">모듈</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-32">USER</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-32">MANAGER</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-32">ADMIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {permissions.map(perm => (
                <tr key={perm.module} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{perm.icon}</span>
                      <span className="text-sm text-gray-700">{perm.module}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <PermBadge allowed={perm.user} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <PermBadge allowed={perm.manager} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <PermBadge allowed={perm.admin} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function RoleCard({ role, label, description, color }: { role: string; label: string; description: string; color: string }) {
  const colors: Record<string, string> = {
    gray: 'border-gray-200 bg-gray-50',
    blue: 'border-blue-200 bg-blue-50',
    red: 'border-red-200 bg-red-50',
  }
  const textColors: Record<string, string> = {
    gray: 'text-gray-700',
    blue: 'text-blue-700',
    red: 'text-red-700',
  }
  return (
    <div className={`rounded-lg border-2 p-4 ${colors[color]}`}>
      <h3 className={`font-semibold ${textColors[color]}`}>{label}</h3>
      <p className="text-xs text-gray-500 mt-1">{role}</p>
      <p className="text-sm text-gray-600 mt-2">{description}</p>
    </div>
  )
}

function PermBadge({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">&#10003;</span>
  ) : (
    <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xs">&mdash;</span>
  )
}
