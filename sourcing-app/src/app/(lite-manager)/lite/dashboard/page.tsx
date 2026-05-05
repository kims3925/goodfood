/**
 * Lite Dashboard — 수익 대시보드 (F3) stub
 * Phase 2 D1-D4에서 실제 차트/위젯 구현
 */
export default function LiteDashboard() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-600 mt-1">오늘 무엇을 팔았는지 한눈에 확인하세요</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="오늘 매출" value="₩0" hint="첫 판매를 기다리는 중..." />
        <StatCard label="이번 주 매출" value="₩0" hint="" />
        <StatCard label="이번 달 매출" value="₩0" hint="" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="📈 시간대별 판매 (Phase 2)">
          <div className="text-sm text-gray-500 py-12 text-center">
            차트가 여기에 표시됩니다 (Recharts 연동 예정)
          </div>
        </Panel>
        <Panel title="🏆 판매 TOP 3 (Phase 2)">
          <div className="text-sm text-gray-500 py-12 text-center">
            첫 판매 후 TOP3 상품이 표시됩니다
          </div>
        </Panel>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="text-sm font-semibold text-yellow-900">🚧 Phase 1 (Foundation) 진행 중</div>
        <div className="text-xs text-yellow-700 mt-1">
          마이샵, 주문 알림 기능이 먼저 동작합니다. 대시보드는 Phase 2 (Week 5-7)에 활성화됩니다.
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  )
}
