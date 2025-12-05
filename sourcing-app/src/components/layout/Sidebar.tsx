'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Package,
  Zap,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Store,
  FileText,
  Bot,
  X,
  Send,
  Database,
  Link2,
  ScrollText,
  ClipboardList,
  LayoutDashboard,
  History,
  Cog,
  Calculator,
  MessageSquare,
  Users,
  PanelRight,
  Grid3X3,
  Minimize2,
  ShoppingBag,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
} from 'lucide-react'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

interface MenuItem {
  label: string
  href?: string
  icon: React.ReactNode
  children?: MenuItem[]
  badge?: string
  onClick?: (e: React.MouseEvent) => void
}

export default function Sidebar({ isOpen = true, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [clickedItem, setClickedItem] = useState<string | null>(null)

  // 경로에 따라 해당 메뉴 그룹 자동 확장
  useEffect(() => {
    const pathToMenuMap: Record<string, string> = {
      '/dashboard/shop': '대시보드',
      '/dashboard/automation': '대시보드',
      '/channel': '채널 관리',
      '/shop': '쇼핑몰 관리',
      '/collected-product': '상품 관리',
      '/product': '상품 관리',
      '/published-product': '상품 관리',
      '/publish': '발행',
      '/order': '주문서 관리',
      '/automation': '자동화 관리',
      '/settlement': '정산 관리',
      '/cs': '고객 문의',
      '/user': '사용자 관리',
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

  // collapsed 상태 변경 시 clickedItem 리셋
  useEffect(() => {
    setClickedItem(null)
  }, [collapsed])

  // 외부 클릭 시 clickedItem 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('aside')) {
        setClickedItem(null)
      }
    }

    if (clickedItem) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [clickedItem])

  const menuItems: MenuItem[] = [
    {
      label: '대시보드',
      icon: <LayoutDashboard size={20} />,
      children: [
        {
          label: '쇼핑몰',
          href: '/dashboard/shop',
          icon: <Store size={16} />,
        },
        {
          label: '자동화',
          href: '/dashboard/automation',
          icon: <Zap size={16} />,
        },
      ],
    },
    {
      label: '채널 관리',
      href: '/channel',
      icon: <Store size={20} />,
    },
    {
      label: '쇼핑몰 관리',
      href: '/shop/list',
      icon: <ShoppingBag size={20} />,
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
          label: '수집상품',
          href: '/collected-product/list',
          icon: <Database size={16} />,
        },
        {
          label: '상품',
          href: '/product/list',
          icon: <Package size={16} />,
        },
        {
          label: '발행상품',
          href: '/published-product/list',
          icon: <Send size={16} />,
        },
      ],
    },
    {
      label: '발행',
      href: '/publish',
      icon: <Send size={20} />,
    },
    {
      label: '주문 관리',
      href: '/order/list',
      icon: <ClipboardList size={20} />,
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
      label: '정산 목록',
      href: '/settlement/list',
      icon: <Calculator size={20} />,
    },
    {
      label: '고객 문의',
      href: '/cs/inquiry',
      icon: <MessageSquare size={20} />,
    },
    {
      label: '사용자 관리',
      href: '/user/list',
      icon: <Users size={20} />,
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
        {
          label: '프롬프트 설정',
          href: '/admin/settings/prompt',
          icon: <FileText size={16} />,
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
    // /channel 페이지는 /channel?type=xxx 형태도 활성화
    if (href === '/channel' && pathname.startsWith('/channel')) {
      return true
    }
    // /shop/list 페이지는 /shop/* 형태도 활성화
    if (href === '/shop/list' && pathname.startsWith('/shop')) {
      return true
    }
    // 정확한 경로 매칭만 활성화 (하위 경로 제외)
    return pathname === href
  }

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.includes(item.label)
    const active = isActive(item.href)
    const isHovered = hoveredItem === item.label
    const isClicked = clickedItem === item.label
    const isSubmenuOpen = isHovered || isClicked

    // collapsed 상태에서 하위 메뉴가 있는 항목
    if (hasChildren) {
      const handleClick = () => {
        if (collapsed) {
          // collapsed 상태에서는 클릭으로 토글
          setClickedItem(isClicked ? null : item.label)
        } else {
          toggleExpanded(item.label)
        }
      }

      const handleMouseLeave = () => {
        if (collapsed) {
          setHoveredItem(null)
          // 클릭으로 열린 게 아닌 경우에만 닫기
          // 클릭으로 열린 경우는 유지
        }
      }

      return (
        <div
          key={item.label}
          className="relative"
          onMouseEnter={() => collapsed && setHoveredItem(item.label)}
          onMouseLeave={handleMouseLeave}
        >
          <button
            onClick={handleClick}
            className={`
              w-full flex items-center
              ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}
              py-2.5
              text-text-secondary hover:text-text-primary hover:bg-surface
              transition-colors
              ${depth > 0 ? (collapsed ? '' : 'pl-8') : ''}
            `}
            title={collapsed ? item.label : undefined}
          >
            <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
              {item.icon}
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </div>
            {!collapsed && (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
          </button>

          {/* 펼쳐진 상태의 하위 메뉴 */}
          {!collapsed && isExpanded && (
            <div className="bg-surface/50">
              {item.children?.map((child) => renderMenuItem(child, depth + 1))}
            </div>
          )}

          {/* collapsed 상태에서 호버 또는 클릭 시 팝오버 메뉴 */}
          {collapsed && isSubmenuOpen && (
            <div className="absolute left-full top-0 ml-1 z-50 min-w-48 bg-white rounded-lg shadow-lg border border-border py-2">
              <div className="px-3 py-2 text-sm font-semibold text-text-primary border-b border-border">
                {item.label}
              </div>
              {item.children?.map((child) => (
                <Link
                  key={child.label}
                  href={child.href || '#'}
                  onClick={(e) => {
                    setClickedItem(null)
                    child.onClick?.(e)
                  }}
                  className={`
                    flex items-center gap-3
                    px-4 py-2
                    text-sm font-medium
                    transition-colors
                    ${
                      isActive(child.href)
                        ? 'bg-primary-light text-primary-color'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                    }
                  `}
                >
                  {child.icon}
                  <span>{child.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        key={item.label}
        className="relative"
        onMouseEnter={() => collapsed && setHoveredItem(item.label)}
        onMouseLeave={() => collapsed && setHoveredItem(null)}
      >
        <Link
          href={item.href || '#'}
          onClick={item.onClick}
          className={`
            flex items-center
            ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'}
            py-2.5
            text-sm font-medium
            transition-colors
            ${depth > 0 ? (collapsed ? '' : 'pl-12') : ''}
            ${
              active
                ? 'bg-primary-light text-primary-color border-r-2 border-primary-color'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface'
            }
          `}
          title={collapsed ? item.label : undefined}
        >
          {item.icon}
          {!collapsed && <span>{item.label}</span>}
          {!collapsed && item.badge && (
            <span className="ml-auto px-2 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full">
              {item.badge}
            </span>
          )}
        </Link>

        {/* collapsed 상태에서 호버 시 툴팁 */}
        {collapsed && isHovered && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md whitespace-nowrap">
            {item.label}
          </div>
        )}
      </div>
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
          ${collapsed ? 'w-16' : 'w-64'}
          bg-white
          border-r border-border
          z-30
          transform transition-all duration-200
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-full flex flex-col overflow-y-auto">
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
          <nav className="py-4 flex-1">
            {menuItems.map((item) => renderMenuItem(item))}
          </nav>

          {/* Collapse toggle button - desktop only */}
          <div className="hidden lg:block border-t border-border p-2">
            <button
              onClick={onToggleCollapse}
              className={`
                w-full flex items-center
                ${collapsed ? 'justify-center' : 'justify-between px-2'}
                py-2
                text-text-secondary hover:text-text-primary hover:bg-surface
                rounded-md transition-colors
              `}
              title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <>
                  <span className="text-sm font-medium">메뉴 접기</span>
                  <PanelLeftClose size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}