'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Bot,
  Network,
  Radio,
  GitMerge,
  Target,
  Workflow,
  History,
  Settings,
  UserCog,
  Users,
  Shield,
  Server,
  Activity,
  BarChart3,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Cpu,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'

interface NavItem {
  label: string
  href?: string
  icon: LucideIcon
  children?: NavItem[]
}

const adminNav: NavItem[] = [
  { label: '플랫폼 현황', href: '/admin/dashboard', icon: LayoutDashboard },
  {
    label: '에이전트 관리',
    icon: Bot,
    children: [
      { label: '대시보드', href: '/admin/agents/dashboard', icon: LayoutDashboard },
      { label: '레지스트리', href: '/admin/agents/registry', icon: Network },
      { label: '실시간 모니터링', href: '/admin/agents/monitor', icon: Radio },
      { label: '워크플로우', href: '/admin/agents/workflows', icon: GitMerge },
      { label: 'KPI', href: '/admin/agents/kpi', icon: Target },
      { label: '태스크', href: '/admin/agents/tasks', icon: Workflow },
      { label: '로그', href: '/admin/agents/logs', icon: History },
      { label: '설정', href: '/admin/agents/settings', icon: Settings },
    ],
  },
  {
    label: '사용자 관리',
    icon: UserCog,
    children: [
      { label: '전체 사용자', href: '/admin/users/list', icon: Users },
      { label: '역할/권한', href: '/admin/users/roles', icon: Shield },
    ],
  },
  {
    label: '시스템',
    icon: Server,
    children: [
      { label: '서비스 상태', href: '/admin/system/status', icon: Activity },
      { label: '통계/분석', href: '/admin/system/analytics', icon: BarChart3 },
      { label: '시스템 설정', href: '/admin/system/settings', icon: Settings },
    ],
  },
]

interface AdminSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function AdminSidebar({ collapsed, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const item of adminNav) {
      if (item.children?.some(child => child.href && pathname.startsWith(child.href))) {
        initial.add(item.label)
      }
    }
    return initial
  })

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  const isActive = (href?: string) => {
    if (!href) return false
    return pathname === href || pathname.startsWith(href + '/')
  }

  const activeAgentCount = useMemo(() => {
    return { total: 17, active: 0 }
  }, [])

  return (
    <aside
      className={`bg-gray-900 text-gray-100 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo / Brand */}
      <div className="h-14 flex items-center px-4 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-600 rounded-lg flex-shrink-0">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <span className="font-bold text-sm text-white">Admin Panel</span>
              <span className="block text-[10px] text-gray-400 -mt-0.5">BandAuto</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {adminNav.map((item) => {
          const Icon = item.icon
          const hasChildren = !!item.children?.length
          const isExpanded = expandedItems.has(item.label)
          const isParentActive = item.children?.some(child => isActive(child.href))

          if (!hasChildren && item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors ${
                  isActive(item.href)
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          }

          return (
            <div key={item.label} className="mb-0.5">
              <button
                onClick={() => toggleExpand(item.label)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isParentActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </>
                )}
              </button>

              {!collapsed && isExpanded && item.children && (
                <div className="ml-4 mt-0.5 border-l border-gray-700 pl-3 space-y-0.5">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon
                    return (
                      <Link
                        key={child.label}
                        href={child.href!}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs transition-colors ${
                          isActive(child.href)
                            ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                        }`}
                      >
                        <ChildIcon size={14} />
                        <span>{child.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Agent Status Summary */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Bot size={14} className="text-indigo-400" />
              <span className="text-xs font-medium text-gray-300">에이전트 현황</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-sm font-bold text-white">10</div>
                <div className="text-[10px] text-gray-500">전체</div>
              </div>
              <div>
                <div className="text-sm font-bold text-green-400">-</div>
                <div className="text-[10px] text-gray-500">활성</div>
              </div>
              <div>
                <div className="text-sm font-bold text-red-400">-</div>
                <div className="text-[10px] text-gray-500">오류</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="border-t border-gray-800 p-2">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-sm"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && <span>접기</span>}
        </button>
      </div>
    </aside>
  )
}
