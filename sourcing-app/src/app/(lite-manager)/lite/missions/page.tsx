/**
 * Lite Missions — 게이미피케이션 (G3) stub
 * Phase 3 F1-F2: 미션 진행도 + 배지 컬렉션
 */
const MISSIONS = [
  { code: 'first_sale', title: '첫 판매 달성', description: '첫 주문이 들어오면 자동 완료됩니다', reward: '🎉 시작 배지' },
  { code: '3_sales', title: '3건 판매', description: '하루 안에 3건 이상 판매', reward: '🏅 페이스메이커 배지' },
  { code: '10man_revenue', title: '10만원 매출', description: '누적 매출 100,000원 달성', reward: '💰 첫 수익 배지' },
  { code: 'review_5', title: '후기 5개', description: '구매자가 작성한 후기 5개 받기', reward: '⭐ 신뢰 배지' },
  { code: 'pro_unlock', title: 'Pro 7일 체험권', description: '미션 5개 달성 시 Pro 7일 무료', reward: '🚀 Pro 체험권' },
]

export default function LiteMissions() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">미션</h1>
        <p className="text-sm text-gray-600 mt-1">
          미션을 달성하며 판매 감각을 키우고, Pro 체험권까지 받아보세요
        </p>
      </header>

      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-5 mb-6">
        <div className="text-sm opacity-90">진행 상황</div>
        <div className="text-3xl font-bold mt-1">0 / 5 달성</div>
        <div className="text-xs opacity-75 mt-2">5개 모두 달성 시 Pro 7일 체험권 자동 발급</div>
      </div>

      <div className="space-y-3">
        {MISSIONS.map((m, i) => (
          <MissionCard key={m.code} index={i} {...m} />
        ))}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="text-sm font-semibold text-yellow-900">🚧 Phase 3 (Week 8-10)</div>
        <div className="text-xs text-yellow-700 mt-1">
          미션 진행도 자동 추적 + 배지 + Pro 전환 트리거는 Phase 3에서 활성화됩니다.
        </div>
      </div>
    </div>
  )
}

function MissionCard({
  index,
  title,
  description,
  reward,
}: {
  index: number
  title: string
  description: string
  reward: string
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold">
        {index + 1}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-gray-500">보상</div>
        <div className="text-sm font-medium text-gray-900">{reward}</div>
      </div>
      <div className="ml-2">
        <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">대기</span>
      </div>
    </div>
  )
}
