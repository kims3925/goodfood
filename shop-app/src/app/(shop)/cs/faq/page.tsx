'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronLeft, Search } from 'lucide-react'
import { useShopUrl } from '@/hooks/useShopUrl'

interface FAQItem {
  id: number
  category: string
  question: string
  answer: string
}

const faqData: FAQItem[] = [
  // 주문/결제
  {
    id: 1,
    category: '주문/결제',
    question: '주문 후 결제 수단을 변경할 수 있나요?',
    answer: '결제 완료 후에는 결제 수단 변경이 불가합니다. 주문을 취소하신 후 다시 주문해 주세요. 단, 상품 준비 중인 경우 취소가 어려울 수 있습니다.',
  },
  {
    id: 2,
    category: '주문/결제',
    question: '주문 취소는 어떻게 하나요?',
    answer: '마이페이지 > 주문내역에서 취소하실 수 있습니다. 상품 준비 전까지는 즉시 취소가 가능하며, 준비 중인 경우 고객센터로 문의해 주세요.',
  },
  {
    id: 3,
    category: '주문/결제',
    question: '결제 오류가 발생했어요',
    answer: '결제 오류 발생 시 잠시 후 다시 시도해 주세요. 동일한 문제가 지속되면 고객센터(1234-5678)로 연락해 주시기 바랍니다.',
  },
  // 배송
  {
    id: 4,
    category: '배송',
    question: '배송은 얼마나 걸리나요?',
    answer: '결제 완료 후 평균 2~3일 이내 배송됩니다. 지역 및 상품에 따라 다소 차이가 있을 수 있습니다.',
  },
  {
    id: 5,
    category: '배송',
    question: '배송비는 얼마인가요?',
    answer: '기본 배송비는 3,000원이며, 30,000원 이상 구매 시 무료배송됩니다. 제주 및 도서산간 지역은 추가 배송비가 발생합니다.',
  },
  {
    id: 6,
    category: '배송',
    question: '배송 조회는 어디서 하나요?',
    answer: '마이페이지 > 주문내역에서 배송 현황을 확인하실 수 있습니다. 송장번호 클릭 시 상세 배송 추적이 가능합니다.',
  },
  // 교환/환불
  {
    id: 7,
    category: '교환/환불',
    question: '환불은 언제 되나요?',
    answer: '환불은 반품 상품 확인 후 3~5 영업일 이내 처리됩니다. 결제 수단에 따라 환불 기간이 다를 수 있습니다.',
  },
  {
    id: 8,
    category: '교환/환불',
    question: '상품이 불량이에요. 어떻게 해야 하나요?',
    answer: '죄송합니다. 1:1 문의로 사진과 함께 문의해 주시면, 확인 후 교환 또는 환불 처리해 드리겠습니다.',
  },
  {
    id: 9,
    category: '교환/환불',
    question: '교환/반품 신청은 어떻게 하나요?',
    answer: '마이페이지 > 주문내역에서 해당 상품의 교환/반품 신청이 가능합니다. 상품 수령 후 7일 이내 신청해 주세요.',
  },
  // 회원
  {
    id: 10,
    category: '회원',
    question: '비밀번호를 잊어버렸어요',
    answer: '로그인 페이지에서 "비밀번호 찾기"를 클릭하시면 가입 시 등록한 이메일로 임시 비밀번호를 발송해 드립니다.',
  },
  {
    id: 11,
    category: '회원',
    question: '회원 탈퇴하고 싶어요',
    answer: '마이페이지 > 회원정보 수정에서 탈퇴 신청이 가능합니다. 탈퇴 시 적립금 및 쿠폰은 모두 소멸되며 복구가 불가합니다.',
  },
]

const categories = ['전체', '주문/결제', '배송', '교환/환불', '회원']

export default function FAQPage() {
  const { getPath } = useShopUrl()
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [searchQuery, setSearchQuery] = useState('')
  const [openItems, setOpenItems] = useState<number[]>([])

  const filteredFAQs = faqData.filter((faq) => {
    const matchesCategory = selectedCategory === '전체' || faq.category === selectedCategory
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const toggleItem = (id: number) => {
    setOpenItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  return (
    <div className="kurly-container py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={getPath('/cs')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">자주 묻는 질문</h1>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="궁금한 내용을 검색해 보세요"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF6B6B] transition-colors"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === category
                ? 'bg-[#FF6B6B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* FAQ List */}
      <div className="space-y-3">
        {filteredFAQs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            검색 결과가 없습니다.
          </div>
        ) : (
          filteredFAQs.map((faq) => (
            <div key={faq.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleItem(faq.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[#FF6B6B] bg-[#FFF5F5] px-2 py-1 rounded">
                    {faq.category}
                  </span>
                  <span className="font-medium text-gray-900">{faq.question}</span>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    openItems.includes(faq.id) ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openItems.includes(faq.id) && (
                <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* CTA */}
      <div className="mt-10 text-center bg-gray-50 rounded-xl p-6">
        <p className="text-gray-600 mb-4">원하는 답변을 찾지 못하셨나요?</p>
        <Link
          href={getPath('/cs/inquiry')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF6B6B] text-white font-medium rounded-lg hover:bg-[#FF5252] transition-colors"
        >
          1:1 문의하기
        </Link>
      </div>
    </div>
  )
}
