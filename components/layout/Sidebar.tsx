'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Package,
  ShoppingCart,
  Zap,
  Settings,
  ChevronDown,
  ChevronRight,
  Store,
  FileText,
  Bot,
  X,
  Upload,
  Send,
  List,
  Database,
  FileSpreadsheet,
  Link2,
  Globe,
} from 'lucide-react'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

interface MenuItem {
  label: string
  href?: string
  icon: React.ReactNode
  children?: MenuItem[]
  badge?: string
  onClick?: (e: React.MouseEvent) => void
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>(['sourcing', 'products', 'automation', '1-2. AliExpress 소싱'])

  const menuItems: MenuItem[] = [
    {
      label: '1. 도매밴드 수집',
      icon: <Store size={20} />,
      children: [
        {
          label: '밴드관리',
          href: '/automation/bands',
          icon: <Store size={16} />,
        },
        {
          label: '게시물수집',
          href: '/automation/bands/collect',
          icon: <Database size={16} />,
        },
        {
          label: '수집 현황',
          href: '/automation/collected',
          icon: <List size={16} />,
        },
      ],
    },
    {
      label: '1-2. AliExpress 소싱',
      icon: <Globe size={20} />,
      children: [
        {
          label: '소싱 관리',
          href: '/admin/aliexpress',
          icon: <Globe size={16} />,
          badge: 'NEW',
        },
        {
          label: '수집 상품',
          href: '/admin/aliexpress/products',
          icon: <Package size={16} />,
          badge: 'NEW',
        },
      ],
    },
    {
      label: '2. 소싱확정상품',
      icon: <Package size={20} />,
      children: [
        {
          label: '소싱확정',
          href: '/automation/sourcing',
          icon: <Package size={16} />,
        },
      ],
    },
    {
      label: '3. 쇼핑몰',
      icon: <Store size={20} />,
      children: [
        {
          label: '쇼핑몰 상품목록',
          href: '/shop/list',
          icon: <List size={16} />,
          badge: 'NEW',
        },
        {
          label: '판매샵',
          href: '#',
          icon: <Store size={16} />,
          badge: 'NEW',
          onClick: (e: React.MouseEvent) => {
            e.preventDefault()
            window.open('/store', '_blank')
          },
        },
      ],
    },
    {
      label: '4. 소매밴드 포스팅',
      icon: <Send size={20} />,
      children: [
        {
          label: '포스팅 작성',
          href: '/retail/compose',
          icon: <FileText size={16} />,
          badge: 'NEW',
        },
        {
          label: '소매밴드등록',
          href: '/retail/publish',
          icon: <Send size={16} />,
          badge: 'NEW',
        },
        {
          label: '발행 현황',
          href: '/retail/status',
          icon: <List size={16} />,
        },
      ],
    },
    {
      label: '자동화 설정',
      icon: <Zap size={20} />,
      children: [
        {
          label: '워크플로우',
          href: '/automation/workflow',
          icon: <Zap size={16} />,
        },
        {
          label: '워크플로우 테스트',
          href: '/automation/workflow-test',
          icon: <Bot size={16} />,
          badge: 'NEW',
        },
        {
          label: '자동화 설정',
          href: '/automation/settings',
          icon: <Settings size={16} />,
          badge: 'NEW',
        },
        {
          label: '스케줄 관리',
          href: '/automation/schedule',
          icon: <FileText size={16} />,
        },
        {
          label: '작업 모니터링',
          href: '/automation/monitor',
          icon: <List size={16} />,
        },
      ],
    },
    {
      label: '환경 설정',
      icon: <Settings size={20} />,
      children: [
        {
          label: 'API 설정',
          href: '/admin/settings/api',
          icon: <Link2 size={16} />,
        },
        {
          label: '쇼핑몰 설정',
          href: '/admin/settings/shop',
          icon: <ShoppingCart size={16} />,
        },
        {
          label: '소매밴드 설정',
          href: '/admin/settings/retail',
          icon: <Send size={16} />,
        },
        {
          label: 'AI 설정',
          href: '/admin/settings/ai',
          icon: <Bot size={16} />,
        },
      ],
    },
  ]

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    )
  }

  const isActive = (href?: string) => {
    if (!href) return false
    // 정확한 경로 매칭만 활성화 (하위 경로 제외)
    return pathname === href
  }

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.includes(item.label)
    const active = isActive(item.href)

    if (hasChildren) {
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleExpanded(item.label)}
            className={`
              w-full flex items-center justify-between
              px-4 py-2.5 
              text-text-secondary hover:text-text-primary hover:bg-surface
              transition-colors
              ${depth > 0 ? 'pl-8' : ''}
            `}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          
          {isExpanded && (
            <div className="bg-surface/50">
              {item.children.map((child) => renderMenuItem(child, depth + 1))}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.label}
        href={item.href || '#'}
        onClick={item.onClick}
        className={`
          flex items-center gap-3
          px-4 py-2.5
          text-sm font-medium
          transition-colors
          ${depth > 0 ? 'pl-12' : ''}
          ${
            active
              ? 'bg-primary-light text-primary-color border-r-2 border-primary-color'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
          }
        `}
      >
        {item.icon}
        <span>{item.label}</span>
        {item.badge && (
          <span className="ml-auto px-2 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static
          top-0 left-0
          h-full lg:h-auto
          w-64
          bg-white
          border-r border-border
          z-30
          transform transition-transform duration-200
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-full overflow-y-auto">
          {/* Mobile header */}
          <div className="flex items-center justify-between p-4 border-b border-divider lg:hidden">
            <h2 className="text-xl font-bold text-primary-color">BandAuto v1.4</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface"
            >
              <X size={20} />
            </button>
          </div>

          {/* Workflow Progress */}
          <div className="p-4 border-b border-divider">
            <h3 className="text-xs font-semibold text-text-secondary uppercase mb-3">워크플로우 진행상황</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-text-secondary">1. 도매밴드 수집</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-text-secondary">2. 소싱확정상품</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-text-secondary">3. 쇼핑몰</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                <span className="text-xs text-text-secondary">4. 소매밴드 포스팅</span>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <nav className="py-4">
            {menuItems.map((item) => renderMenuItem(item))}
          </nav>
        </div>
      </aside>
    </>
  )
}