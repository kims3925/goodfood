/**
 * Lite Orders — 주문 리스트 (F2) + 발주 트리거 (F6) stub
 * Phase 1 C4: 마스킹 표시 / Phase 2 C5: 발주 요청 버튼
 */
export default function LiteOrders() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">주문</h1>
        <p className="text-sm text-gray-600 mt-1">
          실시간 알림으로 새 주문이 들어오는 순간 확인하세요. 발주는 직접 버튼을 눌러 시작합니다.
        </p>
      </header>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600">
          <div className="col-span-2">시각</div>
          <div className="col-span-3">상품</div>
          <div className="col-span-2">구매자</div>
          <div className="col-span-2">금액</div>
          <div className="col-span-1">상태</div>
          <div className="col-span-2 text-right">발주</div>
        </div>

        <div className="px-4 py-12 text-center">
          <div className="text-4xl mb-2">📬</div>
          <div className="text-sm font-medium text-gray-900">아직 주문이 없습니다</div>
          <div className="text-xs text-gray-500 mt-1">
            마이샵에서 상품을 업로드하면 여기에 실시간으로 표시됩니다
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Tip title="🔔 실시간 알림">
          주문이 발생하면 토스트 + 사운드로 즉시 알려드려요. (Phase 1 B1-B3)
        </Tip>
        <Tip title="🛡️ 개인정보 보호">
          구매자 이름은 마스킹(홍**), 연락처는 끝 4자리만 표시됩니다.
        </Tip>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="text-sm font-semibold text-yellow-900">🚧 Phase 1 진행 중</div>
        <div className="text-xs text-yellow-700 mt-1">
          주문 API + WebSocket/SSE 알림은 이번 주 내 활성화 예정 (A3, B1-B3 트랙).
        </div>
      </div>
    </div>
  )
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
      <div className="text-sm font-semibold text-blue-900">{title}</div>
      <div className="text-xs text-blue-700 mt-1 leading-relaxed">{children}</div>
    </div>
  )
}
