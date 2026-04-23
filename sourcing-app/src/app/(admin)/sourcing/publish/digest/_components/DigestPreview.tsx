'use client'

interface PreviewData {
  title: string
  content: string
  imageUrls: string[]
  productCount: number
  truncated: boolean
}

interface Props {
  preview: PreviewData
  headerText: string
  footerText: string
  onHeaderChange: (v: string) => void
  onFooterChange: (v: string) => void
  maxImagesPerProduct: number
  onMaxImagesChange: (n: number) => void
}

export default function DigestPreview({
  preview,
  headerText,
  footerText,
  onHeaderChange,
  onFooterChange,
  maxImagesPerProduct,
  onMaxImagesChange,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-[#2DB400] text-white px-4 py-2 text-sm font-medium">
        미리보기 — 밴드 게시글
      </div>

      <div className="px-4 pt-4">
        <h3 className="text-lg font-bold text-gray-900 break-keep">{preview.title || '제목 (상품 선택 시 표시)'}</h3>
      </div>

      <div className="px-4 pt-3 space-y-2">
        <label className="text-xs text-gray-500">상단 안내 (선택)</label>
        <textarea
          value={headerText}
          onChange={(e) => onHeaderChange(e.target.value)}
          placeholder="예: 오늘 저녁 6시 이전 주문 → 내일 출고"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md resize-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
        />
      </div>

      <pre className="mx-4 my-3 p-3 bg-gray-50 text-xs sm:text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed max-h-[480px] overflow-y-auto rounded-md border border-gray-100">
        {preview.content || '선택된 상품이 없습니다.'}
      </pre>

      <div className="px-4 pb-2 space-y-2">
        <label className="text-xs text-gray-500">하단 안내 (선택)</label>
        <textarea
          value={footerText}
          onChange={(e) => onFooterChange(e.target.value)}
          placeholder="예: 결제 방법, 배송 안내 등"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md resize-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
        />
      </div>

      {/* 이미지 설정 */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs">
        <label className="text-gray-600 flex items-center gap-2">
          상품당 이미지
          <select
            value={maxImagesPerProduct}
            onChange={(e) => onMaxImagesChange(Number(e.target.value))}
            className="px-2 py-1 border border-gray-200 rounded-md"
          >
            <option value={1}>1장</option>
            <option value={2}>2장</option>
            <option value={3}>3장</option>
          </select>
        </label>
        <span className="text-gray-500">
          이미지 {preview.imageUrls.length} / 20장
        </span>
      </div>

      {/* 이미지 미리보기 그리드 */}
      {preview.imageUrls.length > 0 && (
        <div className="px-4 pb-3 grid grid-cols-5 gap-1">
          {preview.imageUrls.slice(0, 10).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded" />
          ))}
          {preview.imageUrls.length > 10 && (
            <div className="bg-gray-100 flex items-center justify-center rounded text-xs text-gray-600">
              +{preview.imageUrls.length - 10}
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-3 bg-gray-50 text-xs text-gray-600 flex justify-between border-t border-gray-100">
        <span>상품 {preview.productCount}개{preview.truncated ? ' (일부 절단됨)' : ''}</span>
        <span>이미지 {preview.imageUrls.length}장</span>
      </div>
    </div>
  )
}
