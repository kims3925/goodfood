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
  FileText,
  ChevronRight
} from 'lucide-react'

export default function MyPage() {
  const { data: session } = useSession()

  const menuItems = [
    {
      title: '주문 관리',
      items: [
        { icon: ShoppingBag, label: '주문내역', href: '/store/mypage/orders', description: '주문 및 배송 조회' },
        { icon: RotateCcw, label: '취소/반품 내역', href: '/store/mypage/returns', description: '취소 및 반품 관리' },
      ],
    },
    {
      title: '쇼핑 활동',
      items: [
        { icon: Tag, label: '쿠폰', href: '/store/mypage/coupons', description: '보유 쿠폰 확인' },
        { icon: Heart, label: '찜한 상품', href: '/store/mypage/wishlist', description: '관심 상품 보기' },
        { icon: Star, label: '상품 후기', href: '/store/mypage/reviews', description: '내가 작성한 후기' },
        { icon: MessageSquare, label: '상품 문의', href: '/store/mypage/inquiries', description: '문의 내역 확인' },
      ],
    },
    {
      title: '회원 정보',
      items: [
        { icon: User, label: '회원 정보 관리', href: '/store/mypage/profile', description: '개인정보 수정' },
        { icon: MapPin, label: '배송지 관리', href: '/store/mypage/addresses', description: '배송지 등록 및 관리' },
        { icon: FileText, label: '개인정보처리방침', href: '/store/mypage/privacy', description: '개인정보 보호' },
      ],
    },
  ]

  return (
    <div className="kurly-container py-12">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">마이페이지</h1>
        <p className="text-gray-600">
          안녕하세요, <span className="font-semibold text-[#FF6B6B]">{session?.user?.name || '회원'}</span>님
        </p>
      </div>

      {/* 메뉴 그리드 */}
      <div className="space-y-8">
        {menuItems.map((section, idx) => (
          <div key={idx}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{section.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map((item, itemIdx) => (
                <Link
                  key={itemIdx}
                  href={item.href}
                  className="group bg-white border border-gray-200 rounded-lg p-6 hover:border-[#FF6B6B] hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gray-50 rounded-lg group-hover:bg-[#FFF5F5] transition-colors">
                        <item.icon className="w-6 h-6 text-gray-600 group-hover:text-[#FF6B6B]" />
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
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#FF6B6B]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
