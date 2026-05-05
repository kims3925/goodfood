/**
 * Lite Report — 수익 리포트 카드 자동 생성 + SNS 공유 (G1) stub
 * Phase 3 F3-F4: Canvas/Satori PNG 카드 + 카톡/밴드 공유
 */
export default function LiteReport() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">수익 리포트</h1>
        <p className="text-sm text-gray-600 mt-1">
          오늘 번 돈을 한 장의 카드로. 카톡·밴드에 자랑해보세요 (자연스러운 바이럴)
        </p>
      </header>

      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
        <div className="text-6xl mb-4">🎴</div>
        <div className="text-lg font-semibold text-gray-900">아직 리포트가 없습니다</div>
        <div className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          첫 판매가 발생하면 "오늘 30,000원 벌었습니다" 같은 카드가 자동 생성되어
          여기에 표시됩니다. 그 카드를 카톡/밴드에 공유할 수 있어요.
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Tip title="📸 카드는 자동 생성">
          매출이 발생할 때마다 깔끔한 PNG 카드로 만들어드려요. (Phase 3 F3)
        </Tip>
        <Tip title="📤 한 번 클릭 공유">
          카톡 / 밴드 공유 버튼으로 친구·고객에게 바로 보낼 수 있어요. (Phase 3 F4)
        </Tip>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="text-sm font-semibold text-yellow-900">🚧 Phase 3 (Week 8-10)</div>
        <div className="text-xs text-yellow-700 mt-1">
          리포트 카드 자동 생성 + SNS 공유는 Phase 3에서 활성화됩니다.
        </div>
      </div>
    </div>
  )
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
      <div className="text-sm font-semibold text-purple-900">{title}</div>
      <div className="text-xs text-purple-700 mt-1 leading-relaxed">{children}</div>
    </div>
  )
}
