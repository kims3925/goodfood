'use client'

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

export default function MyPage() {
  const { data: session } = useSession()
  const { getPath } = useShopUrl()
  const { shop } = useShop()
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'

  const menuItems = [
    {
      title: '주문 관리',
      items: [
        { icon: ShoppingBag, label: '주문내역', href: getPath('/mypage/orders'), description: '주문 및 배송 조회' },
        { icon: RotateCcw, label: '취소/반품 내역', href: getPath('/mypage/returns'), description: '취소 및 반품 관리' },
      ],
    },
    {
      title: '쇼핑 활동',
      items: [
        { icon: Tag, label: '쿠폰', href: getPath('/mypage/coupons'), description: '보유 쿠폰 확인' },
        { icon: Heart, label: '찜한 상품', href: getPath('/mypage/wishlist'), description: '관심 상품 보기' },
        { icon: Star, label: '상품 후기', href: getPath('/mypage/reviews'), description: '내가 작성한 후기' },
        { icon: MessageSquare, label: '상품 문의', href: getPath('/mypage/inquiries'), description: '문의 내역 확인' },
      ],
    },
    {
      title: '회원 정보',
      items: [
        { icon: User, label: '회원 정보 관리', href: getPath('/mypage/profile'), description: '개인정보 수정' },
        { icon: MapPin, label: '배송지 관리', href: getPath('/mypage/addresses'), description: '배송지 등록 및 관리' },
      ],
    },
  ]

  return (
    <>
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">마이페이지</h1>
        <p className="text-gray-600">
          안녕하세요, <span className="font-semibold" style={{ color: primaryColor }}>{session?.user?.name || '회원'}</span>님
        </p>
      </div>

      {/* 메뉴 그리드 */}
      <div className="space-y-8">
        {menuItems.map((section, idx) => (
          <div key={idx}>
            <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-4">{section.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map((item, itemIdx) => (
                <Link
                  key={itemIdx}
                  href={item.href}
                  className="group bg-white border border-gray-200 rounded-lg p-5 lg:p-6 hover:shadow-md transition-all"
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = primaryColor}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 lg:gap-4">
                      <div className="p-2.5 lg:p-3 bg-gray-50 rounded-lg transition-colors group-hover:bg-gray-100">
                        <item.icon className="w-5 h-5 lg:w-6 lg:h-6 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {item.label}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
