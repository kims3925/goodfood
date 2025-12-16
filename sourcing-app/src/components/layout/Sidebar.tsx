'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Package,
  Zap,
  Settings,
  ChevronDown,
  ChevronRight,
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
  ShoppingBag,
  PanelLeftClose,
  PanelLeftOpen,
  Truck,
  RotateCcw,
  Star,
  Gift,
  Ticket,
  Calendar,
  CreditCard,
} from 'lucide-react'
import {
  AppSection,
  MenuItem,
  getMenuBySection,
  getPathToMenuMap,
  getSectionLabel,
} from '@/config/navigation'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  currentSection: AppSection
  onSectionChange: (section: AppSection) => void
}

// 아이콘 컴포넌트 매핑
const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={20} />,
  Store: <Store size={20} />,
  Zap: <Zap size={20} />,
  Package: <Package size={20} />,
  FileText: <FileText size={20} />,
  Send: <Send size={20} />,
  Database: <Database size={20} />,
  ClipboardList: <ClipboardList size={20} />,
  Truck: <Truck size={20} />,
  Cog: <Cog size={20} />,
  History: <History size={20} />,
  Calculator: <Calculator size={20} />,
  Users: <Users size={20} />,
  MessageSquare: <MessageSquare size={20} />,
  Settings: <Settings size={20} />,
  ScrollText: <ScrollText size={20} />,
  Link2: <Link2 size={20} />,
  Bot: <Bot size={20} />,
  ShoppingBag: <ShoppingBag size={20} />,
  RotateCcw: <RotateCcw size={20} />,
  Star: <Star size={20} />,
  Gift: <Gift size={20} />,
  Ticket: <Ticket size={20} />,
  Calendar: <Calendar size={20} />,
  CreditCard: <CreditCard size={20} />,
}

const smallIconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={16} />,
  Store: <Store size={16} />,
  Zap: <Zap size={16} />,
  Package: <Package size={16} />,
  FileText: <FileText size={16} />,
  Send: <Send size={16} />,
  Database: <Database size={16} />,
  ClipboardList: <ClipboardList size={16} />,
  Truck: <Truck size={16} />,
  Cog: <Cog size={16} />,
  History: <History size={16} />,
  Calculator: <Calculator size={16} />,
  Users: <Users size={16} />,
  MessageSquare: <MessageSquare size={16} />,
  Settings: <Settings size={16} />,
  ScrollText: <ScrollText size={16} />,
  Link2: <Link2 size={16} />,
  Bot: <Bot size={16} />,
  ShoppingBag: <ShoppingBag size={16} />,
  RotateCcw: <RotateCcw size={16} />,
  Star: <Star size={16} />,
  Gift: <Gift size={16} />,
  Ticket: <Ticket size={16} />,
  Calendar: <Calendar size={16} />,
  CreditCard: <CreditCard size={16} />,
}

function getIcon(iconComponent: unknown, small = false): React.ReactNode {
  if (!iconComponent) return null
  const iconName = (iconComponent as { displayName?: string })?.displayName ||
                   (iconComponent as { name?: string })?.name ||
                   iconComponent.toString().match(/function (\w+)/)?.[1] ||
                   ''
  return small ? smallIconMap[iconName] || null : iconMap[iconName] || null
}

export default function Sidebar({
  isOpen = true,
  onClose,
  collapsed = false,
  onToggleCollapse,
  currentSection,
  onSectionChange
}: SidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [clickedItem, setClickedItem] = useState<string | null>(null)

  // 현재 섹션의 메뉴 아이템
  const menuItems = useMemo(() => getMenuBySection(currentSection), [currentSection])
  const pathToMenuMap = useMemo(() => getPathToMenuMap(currentSection), [currentSection])

  // 경로에 따라 해당 메뉴 그룹 자동 확장
  useEffect(() => {
    const matchedMenus: string[] = []

    // navigation.ts에서 가져온 pathToMenuMap 사용
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
  }, [pathname, pathToMenuMap])

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

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    )
  }

  // 모든 메뉴 아이템의 href 목록을 추출
  const allMenuHrefs = useMemo(() => {
    const hrefs: string[] = []
    const collectHrefs = (items: MenuItem[]) => {
      for (const item of items) {
        if (item.href) hrefs.push(item.href)
        if (item.children) collectHrefs(item.children)
      }
    }
    collectHrefs(menuItems)
    return hrefs
  }, [menuItems])

  const isActive = (href?: string) => {
    if (!href) return false
    // 정확한 경로 매칭
    if (pathname === href) return true

    // 하위 경로 매칭 (단, 더 구체적인 메뉴 href가 없는 경우에만)
    if (pathname.startsWith(href + '/')) {
      // 현재 pathname과 더 길게 매칭되는 다른 메뉴 href가 있는지 확인
      const hasMoreSpecificMatch = allMenuHrefs.some(
        menuHref => menuHref !== href &&
                    menuHref.length > href.length &&
                    (pathname === menuHref || pathname.startsWith(menuHref + '/'))
      )
      return !hasMoreSpecificMatch
    }

    // /list 패턴 처리: /sourcing/collected-product/list → /sourcing/collected-product 기준으로 매칭
    // 예: href='/sourcing/collected-product/list', pathname='/sourcing/collected-product/31'
    if (href.endsWith('/list')) {
      const baseHref = href.replace(/\/list$/, '')
      if (pathname.startsWith(baseHref + '/') || pathname === baseHref) {
        // 다른 메뉴가 더 구체적으로 매칭되는지 확인
        const hasMoreSpecificMatch = allMenuHrefs.some(
          menuHref => menuHref !== href &&
                      menuHref.startsWith(baseHref) &&
                      menuHref.length > href.length &&
                      (pathname === menuHref || pathname.startsWith(menuHref + '/'))
        )
        return !hasMoreSpecificMatch
      }
    }

    return false
  }

  // 자식 메뉴 중 하나라도 활성화되어 있는지 확인
  const hasActiveChild = (item: MenuItem): boolean => {
    if (!item.children) return false
    return item.children.some(child =>
      isActive(child.href) || hasActiveChild(child)
    )
  }

  const renderIcon = (item: MenuItem, small = false) => {
    const Icon = item.icon
    const size = small ? 16 : 20
    return <Icon size={size} />
  }

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.includes(item.label)
    const active = isActive(item.href)
    const childActive = hasActiveChild(item)
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
              transition-colors
              ${depth > 0 ? (collapsed ? '' : 'pl-8') : ''}
              ${childActive
                ? 'text-primary-color bg-primary-light/50 font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }
            `}
            title={collapsed ? item.label : undefined}
          >
            <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
              {renderIcon(item)}
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
                  onClick={() => setClickedItem(null)}
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
                  {renderIcon(child, true)}
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
          {renderIcon(item)}
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
            <h2 className="text-xl font-bold text-primary-color">BandAuto</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface"
            >
              <X size={20} />
            </button>
          </div>

          {/* Section tabs */}
          <div className={`border-b border-border ${collapsed ? 'px-1 py-2' : 'px-2 py-3'}`}>
            {collapsed ? (
              // Collapsed: 아이콘만 표시
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => onSectionChange('sourcing')}
                  className={`
                    w-full flex items-center justify-center p-2 rounded-md transition-colors
                    ${currentSection === 'sourcing'
                      ? 'bg-primary-light text-primary-color'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                    }
                  `}
                  title="소싱"
                >
                  <Package size={20} />
                </button>
                <button
                  onClick={() => onSectionChange('shop')}
                  className={`
                    w-full flex items-center justify-center p-2 rounded-md transition-colors
                    ${currentSection === 'shop'
                      ? 'bg-primary-light text-primary-color'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                    }
                  `}
                  title="쇼핑몰"
                >
                  <ShoppingBag size={20} />
                </button>
              </div>
            ) : (
              // Expanded: 탭 버튼
              <div className="flex gap-1">
                <button
                  onClick={() => onSectionChange('sourcing')}
                  className={`
                    flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors
                    ${currentSection === 'sourcing'
                      ? 'bg-primary-light text-primary-color'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                    }
                  `}
                >
                  <Package size={16} />
                  소싱
                </button>
                <button
                  onClick={() => onSectionChange('shop')}
                  className={`
                    flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors
                    ${currentSection === 'shop'
                      ? 'bg-primary-light text-primary-color'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                    }
                  `}
                >
                  <ShoppingBag size={16} />
                  쇼핑몰
                </button>
              </div>
            )}
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
