import {
  FolderTree,
  LayoutDashboard,
  Store,
  Zap,
  Package,
  FileText,
  Upload,
  LayoutList,

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
  FileSpreadsheet,
  Eye,
  Activity,
  MonitorDot,
  UserCog,
  Network,
  Server,
  BarChart3,
  Workflow,
  Radio,
  Target,
  GitMerge,
  ExternalLink,
  KeyRound,
  Plug,
  UserPlus,
  Megaphone,
  LayoutGrid,
  Trash2,
  Copy,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'

// 타입 정의
export type AppSection = 'sourcing' | 'shop' | 'admin'
export type UserRole = 'USER' | 'MANAGER' | 'ADMIN'

export interface MenuItem {
  label: string
  href?: string
  icon: LucideIcon
  children?: MenuItem[]
  badge?: string
  adminOnly?: boolean
  external?: boolean  // 외부 링크 (새 탭)
}

// ─── 매니저 탭 메뉴 (간소화: 10→5개) ───
export const sourcingMenuItems: MenuItem[] = [
  { label: '대시보드', href: '/sourcing/dashboard', icon: LayoutDashboard },
  { label: '채널 관리', href: '/sourcing/channel/list', icon: Store },
  {
    label: '상품',
    icon: Package,
    children: [
      { label: '소싱 현황', href: '/sourcing/pipeline', icon: ClipboardList },
      { label: '상품소싱', href: '/sourcing/post/list', icon: FileText },
      { label: '가공상품', href: '/sourcing/product/list', icon: Package },
      { label: '중복 후보', href: '/sourcing/product/duplicates', icon: Copy },
      { label: '발행', href: '/sourcing/publish', icon: Upload },
      { label: '삭제 관리', href: '/sourcing/cleanup', icon: Trash2 },
      { label: '카테고리 관리', href: '/sourcing/categories', icon: FolderTree }, // 등록/숨김/변경 (2026-06-12)
    ],
  },
  {
    label: '광고&마케팅',
    icon: Megaphone,
    children: [
      { label: '종합발행', href: '/sourcing/publish/digest', icon: LayoutList },
      { label: '콜라주', href: '/sourcing/publish/ad/collage', icon: LayoutGrid },
      { label: '카톡광고', href: '/sourcing/publish/ad/kakao', icon: MessageSquare },
      { label: '밴드공지', href: '/sourcing/publish/ad/notice', icon: Bell },
    ],
  },
  {
    label: '자동화',
    icon: Zap,
    children: [
      { label: '자동화 설정', href: '/sourcing/automation/settings', icon: Cog },
      { label: '소싱조건 설정', href: '/sourcing/automation/sourcing-conditions', icon: Target },
      { label: '실행 로그', href: '/sourcing/automation/logs', icon: History },
    ],
  },
  {
    label: 'AI 채팅',
    icon: MessageSquare,
    children: [
      { label: '통합 인박스', href: '/sourcing/inbox', icon: MessageSquare },
      { label: '자동응답 설정', href: '/sourcing/inbox/settings', icon: Bot },
      { label: '운영 매뉴얼', href: '/sourcing/inbox/help', icon: FileText },
    ],
  },
  {
    // 📡 외부 연동 — 외부몰 연결 + AI 페이지빌더 통합 메뉴
    label: '외부 연동',
    icon: Link2,
    children: [
      { label: '외부몰 연동', href: '/sourcing/external-mall', icon: Store },
      { label: 'AI 페이지빌더', href: '/sourcing/shop-builder', icon: LayoutGrid },
    ],
  },
  {
    label: '설정',
    icon: Settings,
    children: [
      // 밴드 로그인 계정 + Band/AliExpress API + 확장프로그램 키 설정 페이지
      { label: '밴드 연동 / API', href: '/sourcing/settings/api', icon: Plug },
      { label: 'AI / API', href: '/sourcing/settings/ai', icon: Bot },
      { label: '프롬프트 / 가격 정책', href: '/sourcing/settings/prompt', icon: FileText },
      { label: '구글 시트', href: '/sourcing/settings/google-sheets', icon: FileSpreadsheet },
      { label: '알림', href: '/sourcing/notification', icon: Bell },
      // '매니저 관리'(매니저 목록/추가)는 어드민 고유 기능 → 어드민 패널(/admin/users/*)에만 둔다.
      // 매니저 탭에서는 제거하고, 매니저 본인용 '내 정보/비밀번호'만 설정 직속으로 유지.
      { label: '내 정보 / 비밀번호', href: '/sourcing/user/profile', icon: KeyRound },
    ],
  },
]

// ─── 쇼핑몰 탭 메뉴 (간소화: 10→6개) ───
export const shopMenuItems: MenuItem[] = [
  { label: '대시보드', href: '/shop/dashboard', icon: LayoutDashboard },
  { label: '쇼핑몰 관리', href: '/shop/store/list', icon: ShoppingBag },
  // 상품 관리(/shop/products/list) 안에 카테고리 탭 통합 — 별도 카테고리 메뉴 제거
  { label: '상품 관리', href: '/shop/products/list', icon: Package },
  {
    label: '주문/정산',
    icon: ClipboardList,
    children: [
      { label: '주문 목록', href: '/shop/order/list', icon: ClipboardList },
      { label: '라이트주문', href: '/shop/lite-orders/list', icon: Zap },
      { label: '발주 관리', href: '/shop/wholesale-orders', icon: Truck },
      { label: '정산 목록', href: '/shop/settlement/list', icon: Calculator },
      { label: '정산 이력', href: '/shop/settlement/history', icon: History },
      { label: '도매 정산서', href: '/shop/settlement/wholesale', icon: FileSpreadsheet },
    ],
  },
  {
    label: '고객관리',
    icon: MessageSquare,
    children: [
      { label: '고객 문의', href: '/shop/cs/inquiry/list', icon: MessageSquare },
      { label: '리뷰 관리', href: '/shop/reviews/list', icon: Star },
      { label: '쿠폰', href: '/shop/coupon/list', icon: Ticket },
    ],
  },
  {
    label: '설정',
    icon: Settings,
    children: [
      { label: '회원 목록', href: '/shop/user/list', icon: Users },
      { label: '실시간 접속자', href: '/shop/visitors', icon: Eye },
      { label: '알림', href: '/shop/notification', icon: Bell },
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

// ─── 어드민 패널 메뉴 (ADMIN 전용, 독립 레이아웃) ───
export const adminMenuItems: MenuItem[] = [
  { label: '플랫폼 현황', href: '/admin/dashboard', icon: MonitorDot },
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
      { label: '통합 셀러 관리', href: '/admin/users/sellers', icon: ShoppingBag },
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
  {
    label: '라이트 운영',
    icon: Zap,
    children: [
      { label: '라이트 셀러', href: '/admin/lite/sellers', icon: Users },
      { label: '자동 발행 설정', href: '/admin/lite/auto-publish', icon: Cog },
      { label: '광고카드 발행', href: '/admin/lite/ad-cards', icon: Megaphone },
    ],
  },
]

// ─── 헬퍼 함수 ───

export function getMenuBySection(section: AppSection): MenuItem[] {
  if (section === 'admin') return adminMenuItems
  return section === 'sourcing' ? sourcingMenuItems : shopMenuItems
}

export function getSectionFromPath(pathname: string): AppSection {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/shop')) return 'shop'
  return 'sourcing'
}

export function getSectionLabel(section: AppSection): string {
  if (section === 'admin') return '어드민'
  return section === 'sourcing' ? '매니저' : '쇼핑몰'
}

export function getDefaultPathBySection(section: AppSection): string {
  if (section === 'admin') return '/admin/dashboard'
  return section === 'sourcing' ? '/sourcing/dashboard' : '/shop/dashboard'
}

// 경로 → 메뉴 라벨 매핑 (메뉴 자동 확장용)
// ⚠️ 순서 중요: startsWith 첫 매치 사용 — 더 긴 경로를 위에 배치
export const sourcingPathToMenuMap: Record<string, string> = {
  '/sourcing/dashboard': '대시보드',
  '/pipeline': '대시보드',
  '/sourcing/channel': '채널 관리',
  '/sourcing/guide': '채널 관리',
  // 광고&마케팅 (구체 경로 — /sourcing/publish 보다 먼저)
  '/sourcing/publish/digest': '광고&마케팅',
  '/sourcing/publish/ad': '광고&마케팅',
  // 상품
  '/sourcing/pipeline': '상품',
  '/sourcing/cleanup': '상품',
  '/sourcing/categories': '상품',
  '/sourcing/post': '상품',
  '/sourcing/collected-product': '상품',
  '/sourcing/product': '상품',
  '/sourcing/publish': '상품',
  '/sourcing/automation': '자동화',
  '/sourcing/inbox': 'AI 채팅',
  '/sourcing/shop-builder': '외부 연동',
  '/sourcing/external-mall': '외부 연동',
  '/sourcing/notification': '설정',
  '/sourcing/settings': '설정',
  '/sourcing/user': '설정',
}

export const shopPathToMenuMap: Record<string, string> = {
  '/shop/dashboard': '대시보드',
  '/shop/store': '쇼핑몰 관리',
  '/shop/products': '상품 관리',
  '/shop/category': '상품 관리', // 옛 카테고리 경로도 상품 관리 메뉴 하이라이트로
  '/shop/order': '주문/정산',
  '/shop/wholesale-orders': '주문/정산',
  '/shop/settlement': '주문/정산',
  '/shop/cs': '고객관리',
  '/shop/reviews': '고객관리',
  '/shop/coupon': '고객관리',
  '/shop/user': '설정',
  '/shop/visitors': '설정',
  '/shop/notification': '설정',
  '/shop/policy': '정책 관리',
}

export const adminPathToMenuMap: Record<string, string> = {
  '/admin/dashboard': '플랫폼 현황',
  '/admin/wholesale-catalog': 'SaaS 운영',
  '/admin/categories': 'SaaS 운영',
  '/admin/band-api': 'SaaS 운영',
  '/admin/agents': '에이전트 관리',
  '/admin/users': '사용자 관리',
  '/admin/system': '시스템',
  '/admin/lite': '라이트 운영',
}

export function getPathToMenuMap(section: AppSection): Record<string, string> {
  if (section === 'admin') return adminPathToMenuMap
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
  const items = getMenuBySection(section)
  return filterMenuByRole(items, userRole)
}

// 어드민 패널은 독립 레이아웃으로 분리 — 매니저 섹션 탭에서 제외
export function getAvailableSections(userRole: UserRole): AppSection[] {
  return ['sourcing', 'shop']
}

export function isAdminUser(userRole: UserRole): boolean {
  return userRole === 'ADMIN'
}
