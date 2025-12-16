import {
  LayoutDashboard,
  Store,
  Zap,
  Package,
  FileText,
  Send,
  Database,
  ClipboardList,
  Truck,
  Cog,
  History,
  Calculator,
  Users,
  MessageSquare,
  Settings,
  Link2,
  Bot,
  ShoppingBag,
  Ticket,
  Star,
  Bell,
  Shield,
  ScrollText,
  Lock,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'

// 타입 정의
export type AppSection = 'sourcing' | 'shop'
export type UserRole = 'USER' | 'MANAGER' | 'ADMIN'

export interface MenuItem {
  label: string
  href?: string
  icon: LucideIcon
  children?: MenuItem[]
  badge?: string
  adminOnly?: boolean
}

// 소싱 탭 메뉴
export const sourcingMenuItems: MenuItem[] = [
  { label: '대시보드', href: '/sourcing/dashboard', icon: LayoutDashboard },
  { label: '채널 관리', href: '/sourcing/channel', icon: Store },
  {
    label: '수집',
    icon: Database,
    children: [
      { label: '수집 게시물', href: '/sourcing/post/list', icon: FileText },
      { label: '수집 상품', href: '/sourcing/collected-product/list', icon: Database },
    ],
  },
  {
    label: '상품',
    icon: Package,
    children: [
      { label: '가공 상품', href: '/sourcing/product/list', icon: Package },
      { label: '발행 상품', href: '/sourcing/published-product/list', icon: Send },
    ],
  },
  { label: '발행', href: '/sourcing/publish', icon: Send },
  {
    label: '자동화',
    icon: Zap,
    children: [
      { label: '설정', href: '/sourcing/automation/settings', icon: Cog },
      { label: '실행 로그', href: '/sourcing/automation/logs', icon: History },
    ],
  },
  { label: '알림 관리', href: '/sourcing/notification', icon: Bell },
  {
    label: '설정',
    icon: Settings,
    children: [
      { label: 'API', href: '/sourcing/settings/api', icon: Link2 },
      { label: 'AI', href: '/sourcing/settings/ai', icon: Bot },
      { label: '프롬프트 / 가격 정책', href: '/sourcing/settings/prompt', icon: FileText },
    ],
  },
  {
    label: '정책 관리',
    icon: Shield,
    adminOnly: true,
    children: [
      { label: '이용약관', href: '/shop/policy/terms', icon: ScrollText, adminOnly: true },
      { label: '개인정보처리방침', href: '/shop/policy/privacy', icon: Lock, adminOnly: true },
    ],
  },
]

// 쇼핑몰 탭 메뉴
export const shopMenuItems: MenuItem[] = [
  { label: '대시보드', href: '/shop/dashboard', icon: LayoutDashboard },
  { label: '쇼핑몰 관리', href: '/shop/store/list', icon: ShoppingBag },
  {
    label: '주문',
    icon: ClipboardList,
    children: [
      { label: '주문 목록', href: '/shop/order/list', icon: ClipboardList },
      { label: '발주 관리', href: '/shop/wholesale-orders', icon: Truck },
      { label: '발주 이력', href: '/shop/wholesale-orders/history', icon: History },
    ],
  },
  {
    label: '정산',
    icon: Calculator,
    children: [
      { label: '정산 목록', href: '/shop/settlement/list', icon: Calculator },
      { label: '정산 이력', href: '/shop/settlement/history', icon: History },
    ],
  },
  { label: '고객 문의', href: '/shop/cs/inquiry', icon: MessageSquare },
  { label: '리뷰 관리', href: '/shop/reviews', icon: Star },
  { label: '쿠폰', href: '/shop/coupon/list', icon: Ticket },
  { label: '알림 관리', href: '/shop/notification', icon: Bell },
  { label: '사용자 관리', href: '/shop/user/list', icon: Users },
  {
    label: '정책 관리',
    icon: Shield,
    adminOnly: true,
    children: [
      { label: '이용약관', href: '/shop/policy/terms', icon: ScrollText, adminOnly: true },
      { label: '개인정보처리방침', href: '/shop/policy/privacy', icon: Lock, adminOnly: true },
    ],
  },
]

// 헬퍼 함수들
export function getMenuBySection(section: AppSection): MenuItem[] {
  return section === 'sourcing' ? sourcingMenuItems : shopMenuItems
}

export function getSectionFromPath(pathname: string): AppSection {
  if (pathname.startsWith('/shop')) return 'shop'
  return 'sourcing'
}

export function getSectionLabel(section: AppSection): string {
  return section === 'sourcing' ? '소싱' : '쇼핑몰'
}

export function getDefaultPathBySection(section: AppSection): string {
  return section === 'sourcing' ? '/sourcing/dashboard' : '/shop/dashboard'
}

// 경로 -> 메뉴 라벨 매핑 (메뉴 자동 확장용)
export const sourcingPathToMenuMap: Record<string, string> = {
  '/sourcing/dashboard': '대시보드',
  '/sourcing/channel': '채널 관리',
  '/sourcing/guide': '채널 관리',
  '/sourcing/post': '수집',
  '/sourcing/collected-product': '수집',
  '/sourcing/product': '상품',
  '/sourcing/published-product': '상품',
  '/sourcing/publish': '발행',
  '/sourcing/automation': '자동화',
  '/sourcing/notification': '알림 관리',
  '/sourcing/settings': '설정',
  '/shop/policy': '정책 관리',
}

export const shopPathToMenuMap: Record<string, string> = {
  '/shop/dashboard': '대시보드',
  '/shop/store': '쇼핑몰 관리',
  '/shop/order': '주문',
  '/shop/wholesale-orders': '주문',
  '/shop/settlement': '정산',
  '/shop/user': '사용자 관리',
  '/shop/cs': '고객 문의',
  '/shop/reviews': '리뷰 관리',
  '/shop/coupon': '쿠폰',
  '/shop/notification': '알림 관리',
  '/shop/policy': '정책 관리',
}

export function getPathToMenuMap(section: AppSection): Record<string, string> {
  return section === 'sourcing' ? sourcingPathToMenuMap : shopPathToMenuMap
}

// 사용자 역할에 따라 메뉴 필터링
export function filterMenuByRole(items: MenuItem[], userRole: UserRole): MenuItem[] {
  return items
    .filter(item => !item.adminOnly || userRole === 'ADMIN')
    .map(item => ({
      ...item,
      children: item.children ? filterMenuByRole(item.children, userRole) : undefined
    }))
}

export function getMenuBySectionAndRole(section: AppSection, userRole: UserRole): MenuItem[] {
  const items = section === 'sourcing' ? sourcingMenuItems : shopMenuItems
  return filterMenuByRole(items, userRole)
}
