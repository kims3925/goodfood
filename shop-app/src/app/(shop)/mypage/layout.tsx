'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  User,
  ShoppingBag,
  Tag,
  Heart,
  RotateCcw,
  Star,
  MessageSquare,
  MapPin,
  ChevronRight
} from 'lucide-react'
import { useShopUrl } from '@/hooks/useShopUrl'
import { useShop } from '@/contexts/ShopContext'

interface MenuItem {
  icon: React.ElementType
  label: string
  href: string
}

export default function MypageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { getPath } = useShopUrl()
  const { shop } = useShop()
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'

  const menuItems: MenuItem[] = [
    { icon: ShoppingBag, label: '주문내역', href: getPath('/mypage/orders') },
    { icon: RotateCcw, label: '취소/반품', href: getPath('/mypage/returns') },
    { icon: Tag, label: '쿠폰', href: getPath('/mypage/coupons') },
    { icon: Heart, label: '찜한 상품', href: getPath('/mypage/wishlist') },
    { icon: Star, label: '상품 후기', href: getPath('/mypage/reviews') },
    { icon: MessageSquare, label: '상품 문의', href: getPath('/mypage/inquiries') },
    { icon: User, label: '회원정보', href: getPath('/mypage/profile') },
    { icon: MapPin, label: '배송지 관리', href: getPath('/mypage/addresses') },
  ]

  // 마이페이지 메인인지 확인
  const isMypageMain = pathname === getPath('/mypage') || pathname === getPath('/mypage/')

  // 메뉴가 활성화되어 있는지 확인
  const isMenuActive = (href: string) => {
    return pathname.startsWith(href)
  }

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[1050px] px-4 md:px-6 lg:px-0 py-6 lg:py-10">
        {/* 마이페이지 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={getPath('/mypage')}
                className="text-2xl lg:text-3xl font-bold text-gray-900 hover:opacity-70 transition-opacity"
              >
                마이페이지
              </Link>
              {!isMypageMain && (
                <ChevronRight className="w-5 h-5 text-gray-400 hidden lg:block" />
              )}
            </div>
          </div>
        </div>

        {/* 상단 네비게이션 탭 */}
        <div className="mb-6 -mx-4 px-4 lg:mx-0 lg:px-0">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide pb-2 lg:pb-0">
            {menuItems.map((item) => {
              const isActive = isMenuActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all flex-shrink-0 text-sm font-medium ${
                    isActive
                      ? 'text-white shadow-md'
                      : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                  }`}
                  style={isActive ? { backgroundColor: primaryColor } : {}}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* 메인 컨텐츠 영역 */}
        <main className="w-full">
          {children}
        </main>
      </div>
    </div>
  )
}
