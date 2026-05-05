/**
 * Lite My Shop — 추천 상품 풀 (F5) stub
 * Phase 1 C2-C3에서 실제 추천 + 직접 선택 + 카톡/밴드 공유 구현
 */
export default function LiteMyShop() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">마이샵</h1>
        <p className="text-sm text-gray-600 mt-1">
          추천 풀 20개 중 직접 5~10개를 골라 업로드하세요. (자동 업로드는 없습니다)
        </p>
      </header>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="text-sm font-semibold text-blue-900">💡 왜 직접 골라야 하나요?</div>
        <div className="text-xs text-blue-700 mt-1 leading-relaxed">
          상품 감각은 직접 골라봐야 생깁니다. Lite는 "이해"가 목표 — Pro는 자동입니다.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <ProductCardStub key={i} index={i} />
        ))}
      </div>

      <div className="mt-6 sticky bottom-4 bg-white border border-gray-200 rounded-lg p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-semibold">선택: 0/20</span>
            <span className="text-gray-500 ml-2">추천 5~10개</span>
          </div>
          <button
            disabled
            className="px-4 py-2 bg-gray-300 text-white rounded-lg text-sm cursor-not-allowed"
          >
            업로드 + 카톡/밴드 공유
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="text-sm font-semibold text-yellow-900">🚧 Phase 1 진행 중</div>
        <div className="text-xs text-yellow-700 mt-1">
          추천 상품 API + 업로드/공유 기능은 이번 주 내 활성화 예정 (C2, C3 트랙).
        </div>
      </div>
    </div>
  )
}

function ProductCardStub({ index }: { index: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 transition-colors">
      <div className="aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
        상품 #{index + 1}
      </div>
      <div className="p-3">
        <div className="text-sm font-medium text-gray-900 truncate">예시 상품 {index + 1}</div>
        <div className="text-xs text-gray-500 mt-1">₩-,---</div>
        <button
          disabled
          className="mt-2 w-full px-2 py-1.5 bg-gray-100 text-gray-400 rounded text-xs cursor-not-allowed"
        >
          선택 (Phase 1)
        </button>
      </div>
    </div>
  )
}
