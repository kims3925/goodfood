'use client'

import Link from 'next/link'
import { Phone, MessageSquare, HelpCircle, Package, ChevronRight } from 'lucide-react'

export default function CustomerServicePage() {
  const menuItems = [
    {
      icon: HelpCircle,
      title: '자주 묻는 질문',
      description: '자주 묻는 질문과 답변을 확인하세요',
      href: '/cs/faq',
      color: 'bg-blue-500',
    },
    {
      icon: MessageSquare,
      title: '1:1 문의',
      description: '궁금한 사항을 문의해 주세요',
      href: '/cs/inquiry',
      color: 'bg-green-500',
    },
    {
      icon: Package,
      title: '주문/배송 조회',
      description: '주문 및 배송 현황을 확인하세요',
      href: '/mypage/orders',
      color: 'bg-purple-500',
    },
  ]

  return (
    <div className="kurly-container py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">고객센터</h1>
        <p className="text-gray-600">무엇을 도와드릴까요?</p>
      </div>

      {/* Contact Info */}
      <div className="bg-gradient-to-r from-[#FF6B6B] to-[#FF8C42] rounded-2xl p-6 md:p-8 text-white mb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
              <Phone className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm opacity-90">고객행복센터</p>
              <p className="text-3xl font-bold">1234-5678</p>
            </div>
          </div>
          <div className="text-center md:text-right">
            <p className="text-sm opacity-90">운영시간</p>
            <p className="font-medium">월~토 오전 7시 ~ 오후 6시</p>
            <p className="text-sm opacity-75 mt-1">일요일/공휴일 휴무</p>
          </div>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {menuItems.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-[#FF6B6B] transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className={`${item.color} w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 group-hover:text-[#FF6B6B] transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{item.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#FF6B6B] transition-colors" />
            </div>
          </Link>
        ))}
      </div>

      {/* Notice */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-4">안내사항</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-[#FF6B6B]">•</span>
            <span>상품 관련 문의는 해당 상품 페이지에서 문의하시면 빠른 답변을 받으실 수 있습니다.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#FF6B6B]">•</span>
            <span>주문/결제/배송 관련 문의는 1:1 문의를 이용해 주세요.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#FF6B6B]">•</span>
            <span>운영시간 외 문의는 다음 영업일에 순차적으로 답변드립니다.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
