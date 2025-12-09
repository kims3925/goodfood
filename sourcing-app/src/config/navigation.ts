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
  ScrollText,
  Link2,
  Bot,
  ShoppingBag,
  Ticket,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'

// 타입 정의
export type AppSection = 'sourcing' | 'shop'

export interface MenuItem {
  label: string
  href?: string
  icon: LucideIcon
  children?: MenuItem[]
  badge?: string
}

// 소싱 탭 메뉴
export const sourcingMenuItems: MenuItem[] = [
  { label: '대시보드', href: '/sourcing/dashboard/automation', icon: LayoutDashboard },
  {
    label: '수집',
    icon: Database,
    children: [
      { label: '채널 관리', href: '/sourcing/channel', icon: Store },
      { label: '게시물', href: '/sourcing/post/list', icon: FileText },
      { label: '수집상품', href: '/sourcing/collected-product/list', icon: Database },
    ],
  },
  {
    label: '상품',
    icon: Package,
    children: [
      { label: '가공상품', href: '/sourcing/product/list', icon: Package },
      { label: '발행상품', href: '/sourcing/published-product/list', icon: Send },
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
  {
    label: '설정',
    icon: Settings,
    children: [
      { label: '정책', href: '/sourcing/policy/list', icon: ScrollText },
      { label: 'API', href: '/sourcing/settings/api', icon: Link2 },
      { label: 'AI', href: '/sourcing/settings/ai', icon: Bot },
      { label: '프롬프트', href: '/sourcing/settings/prompt', icon: FileText },
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
  // { label: '사용자 관리', href: '/shop/user/list', icon: Users }, // TODO: 추후 활성화
  { label: '고객 문의', href: '/shop/cs/inquiry', icon: MessageSquare },
  { label: '쿠폰', href: '/shop/coupon/list', icon: Ticket },
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
  return section === 'sourcing' ? '/sourcing/dashboard/automation' : '/shop/dashboard'
}

// 경로 -> 메뉴 라벨 매핑 (메뉴 자동 확장용)
export const sourcingPathToMenuMap: Record<string, string> = {
  '/sourcing/dashboard/automation': '대시보드',
  '/sourcing/channel': '수집',
  '/sourcing/post': '수집',
  '/sourcing/collected-product': '수집',
  '/sourcing/product': '상품',
  '/sourcing/published-product': '상품',
  '/sourcing/publish': '발행',
  '/sourcing/automation': '자동화',
  '/sourcing/policy': '설정',
  '/sourcing/settings': '설정',
}

export const shopPathToMenuMap: Record<string, string> = {
  '/shop/dashboard': '대시보드',
  '/shop/store': '쇼핑몰 관리',
  '/shop/order': '주문',
  '/shop/wholesale-orders': '주문',
  '/shop/settlement': '정산',
  // '/shop/user': '사용자 관리', // TODO: 추후 활성화
  '/shop/cs': '고객 문의',
  '/shop/coupon': '쿠폰',
}

export function getPathToMenuMap(section: AppSection): Record<string, string> {
  return section === 'sourcing' ? sourcingPathToMenuMap : shopPathToMenuMap
}
