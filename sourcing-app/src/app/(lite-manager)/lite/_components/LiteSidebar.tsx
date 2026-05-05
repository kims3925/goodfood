/**
 * Lite Sidebar — 사용자 mode에 따라 메뉴를 동적으로 구성
 */
'use client'

import Link from 'next/link'

interface NavItem {
  href: string
  label: string
  desc: string
}

const BASE_NAV: NavItem[] = [
  { href: '/lite/dashboard', label: '🏠 대시보드', desc: '오늘 매출 한눈에' },
  { href: '/lite/myshop', label: '🛍️ 내 상품', desc: '자동 등록 상품 관리' },
  { href: '/lite/orders', label: '🔔 주문', desc: '실시간 알림 + 발주' },
]

const BAND_NAV: NavItem[] = [
  { href: '/lite/channel', label: '📡 내 밴드', desc: 'Band 채널 + 세션' },
  { href: '/lite/band-publish', label: '🚀 발행 결과', desc: 'Band 게시글 이력' },
]

const TAIL_NAV: NavItem[] = [
  { href: '/lite/missions', label: '🎯 미션', desc: '판매 미션 + 배지' },
  { href: '/lite/report', label: '📊 리포트', desc: '수익 카드 공유' },
  { href: '/lite/rankings', label: '🏆 랭킹', desc: '셀러들과 비교' },
  { href: '/lite/upgrade', label: '⚡ Pro 전환', desc: '풀 자동화 체험' },
]

export default function LiteSidebar({ mode }: { mode: 'lite' | 'lite_band' }) {
  const items = mode === 'lite_band' ? [...BASE_NAV, ...BAND_NAV, ...TAIL_NAV] : [...BASE_NAV, ...TAIL_NAV]

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4 sticky top-0">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="text-lg font-bold text-blue-600">
          SNSAUTO {mode === 'lite_band' ? 'Lite Band' : 'Lite'}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {mode === 'lite_band'
            ? '쇼핑몰 + 본인 Band 자동 발행'
            : '체험용 7일 프로그램'}
        </div>
      </div>

      <nav className="space-y-1">
        {items.map((item) => (
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

      {mode === 'lite_band' ? (
        <div className="mt-8 p-3 bg-green-50 border border-green-100 rounded-lg">
          <div className="text-xs font-semibold text-green-900">📡 Lite Band</div>
          <div className="text-xs text-green-700 mt-1 leading-relaxed">
            매일 자동 등록되는 상품이 본인 Band에도 자동 발행됩니다. Band 세션은 수시로 갱신해
            주세요.
          </div>
        </div>
      ) : (
        <div className="mt-8 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="text-xs font-semibold text-blue-900">💡 Lite 철학</div>
          <div className="text-xs text-blue-700 mt-1 leading-relaxed">
            자동화 대신 코칭. 직접 클릭하며 판매 구조를 학습합니다.
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-purple-50 border border-purple-100 rounded-lg">
        <div className="text-xs font-semibold text-purple-900">⚡ Pro 전환</div>
        <div className="text-xs text-purple-700 mt-1 leading-relaxed">
          미션 5개 달성 시 Pro 7일 무료 체험권을 드려요.
        </div>
      </div>
    </aside>
  )
}
