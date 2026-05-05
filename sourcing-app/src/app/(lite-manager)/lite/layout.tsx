/**
 * SNSAUTO Lite Manager — 체험용 7일 프로그램 레이아웃
 * 철학: "편하게 만들지 말고 이해하게 만들어라"
 */
import Link from 'next/link'
import { ReactNode } from 'react'
import OrderNotifier from './_components/OrderNotifier'

const NAV = [
  { href: '/lite/dashboard', label: '🏠 대시보드', desc: '오늘 매출 한눈에' },
  { href: '/lite/myshop', label: '🛍️ 마이샵', desc: '추천 상품 → 직접 선택' },
  { href: '/lite/orders', label: '🔔 주문', desc: '실시간 알림 + 발주' },
  { href: '/lite/missions', label: '🎯 미션', desc: '판매 미션 + 배지' },
  { href: '/lite/report', label: '📊 리포트', desc: '수익 카드 공유' },
  { href: '/lite/rankings', label: '🏆 랭킹', desc: '셀러들과 비교' },
  { href: '/lite/upgrade', label: '⚡ Pro 전환', desc: '7일 무료 체험' },
]

export default function LiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="flex">
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4 sticky top-0">
          <div className="mb-6 pb-4 border-b border-gray-200">
            <div className="text-lg font-bold text-blue-600">SNSAUTO Lite</div>
            <div className="text-xs text-gray-500 mt-1">체험용 7일 프로그램</div>
          </div>

          <nav className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors group"
              >
                <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                  {item.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
              </Link>
            ))}
          </nav>

          <div className="mt-8 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="text-xs font-semibold text-blue-900">💡 Lite 철학</div>
            <div className="text-xs text-blue-700 mt-1 leading-relaxed">
              자동화 대신 코칭. 직접 클릭하며 판매 구조를 학습합니다.
            </div>
          </div>

          <div className="mt-4 p-3 bg-purple-50 border border-purple-100 rounded-lg">
            <div className="text-xs font-semibold text-purple-900">⚡ Pro 전환</div>
            <div className="text-xs text-purple-700 mt-1 leading-relaxed">
              미션 5개 달성 시 Pro 7일 무료 체험권을 드려요.
            </div>
          </div>
        </aside>

        <main className="flex-1 p-6 max-w-[1400px]">{children}</main>
      </div>

      {/* 실시간 주문 알림 (F1) — 모든 lite 페이지에서 동작 */}
      <OrderNotifier />
    </div>
  )
}
