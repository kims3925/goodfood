'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bot,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Cpu,
} from 'lucide-react'
// 메뉴 정의 단일 소스 — navigation.ts의 굿푸드몰 통합 메뉴 사용 (하드코딩 제거)
import { adminMenuItems } from '@/config/navigation'

const adminNav = adminMenuItems

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
              <span className="font-bold text-sm text-white">굿푸드몰 어드민</span>
              <span className="block text-[10px] text-gray-400 -mt-0.5">GoodFood Mall</span>
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
                        {child.badge && (
                          <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-300">
                            {child.badge}
                          </span>
                        )}
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
                <div className="text-sm font-bold text-white">11</div>
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
