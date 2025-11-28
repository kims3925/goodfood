'use client'

import { useState, useEffect } from 'react'
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
  ScrollText,
  ClipboardList,
  PlusCircle,
  Play,
  LayoutDashboard,
  History,
  Cog,
  Calculator,
  MessageSquare,
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
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  // 경로에 따라 해당 메뉴 그룹 자동 확장
  useEffect(() => {
    const pathToMenuMap: Record<string, string> = {
      '/band': '밴드관리',
      '/product': '상품 관리',
      '/publish': '발행',
      '/order': '주문서 관리',
      '/automation': '자동화 관리',
      '/settlement': '정산 관리',
      '/cs': '고객 문의',
      '/admin/settings': '환경 설정',
    }

    const matchedMenus: string[] = []
    for (const [path, menu] of Object.entries(pathToMenuMap)) {
      if (pathname.startsWith(path)) {
        matchedMenus.push(menu)
      }
    }

    if (matchedMenus.length > 0) {
      setExpandedItems(prev => {
        const newItems = [...prev]
        matchedMenus.forEach(menu => {
          if (!newItems.includes(menu)) {
            newItems.push(menu)
          }
        })
        return newItems
      })
    }
  }, [pathname])

  const menuItems: MenuItem[] = [
    {
      label: '대시보드',
      href: '/automation/dashboard',
      icon: <LayoutDashboard size={20} />,
    },
    {
      label: '밴드관리',
      icon: <Store size={20} />,
      children: [
        {
          label: '도매밴드 관리',
          href: '/band/wholesale',
          icon: <Store size={16} />,
        },
        {
          label: '소매밴드 관리',
          href: '/band/retail',
          icon: <Send size={16} />,
        },
      ],
    },
    {
      label: '게시물 관리',
      href: '/post/list',
      icon: <FileText size={20} />,
    },
    {
      label: '상품 관리',
      icon: <Package size={20} />,
      children: [
        {
          label: '수집 상품 관리',
          href: '/product/list',
          icon: <Database size={16} />,
        },
        {
          label: '발행 상품 관리',
          href: '/product/publish',
          icon: <Send size={16} />,
        },
      ],
    },
    {
      label: '발행',
      icon: <Send size={20} />,
      children: [
        {
          label: '소매밴드 발행',
          href: '/publish/retail-band',
          icon: <Upload size={16} />,
        },
        {
          label: '쇼핑몰 발행',
          href: '/publish/shopping-mall',
          icon: <Globe size={16} />,
        },
      ],
    },
    {
      label: '주문서 관리',
      icon: <ClipboardList size={20} />,
      children: [
        {
          label: '주문 목록',
          href: '/order/list',
          icon: <List size={16} />,
        },
        {
          label: '주문서 작성',
          href: '/order/new',
          icon: <PlusCircle size={16} />,
        },
      ],
    },
    {
      label: '정책 관리',
      href: '/policy/list',
      icon: <ScrollText size={20} />,
    },
    {
      label: '자동화 관리',
      icon: <Zap size={20} />,
      children: [
        {
          label: '자동화 설정',
          href: '/automation/settings',
          icon: <Cog size={16} />,
        },
        {
          label: '실행 로그',
          href: '/automation/logs',
          icon: <History size={16} />,
        },
      ],
    },
    {
      label: '정산 관리',
      href: '/settlement/list',
      icon: <Calculator size={20} />,
    },
    {
      label: '고객 문의',
      href: '/cs/inquiry',
      icon: <MessageSquare size={20} />,
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
              {item.children?.map((child) => renderMenuItem(child, depth + 1))}
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
            <h2 className="text-xl font-bold text-primary-color">BandAuto release-1</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface"
            >
              <X size={20} />
            </button>
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