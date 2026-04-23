'use client'

import { CheckCircle, Loader2, XCircle, Clock } from 'lucide-react'

export type DigestProgressStatus = 'pending' | 'publishing' | 'success' | 'failed'

export interface DigestProgressItem {
  channelId: number
  channelName: string
  status: DigestProgressStatus
  message?: string
}

interface Props {
  isOpen: boolean
  items: DigestProgressItem[]
  digestTitle: string
  productCount: number
  imageCount: number
  onClose: () => void
  canClose: boolean
}

function StatusIcon({ status }: { status: DigestProgressStatus }) {
  switch (status) {
    case 'success':
      return <CheckCircle size={18} className="text-emerald-600" />
    case 'failed':
      return <XCircle size={18} className="text-red-500" />
    case 'publishing':
      return <Loader2 size={18} className="text-blue-500 animate-spin" />
    default:
      return <Clock size={18} className="text-gray-400" />
  }
}

function statusLabel(status: DigestProgressStatus) {
  switch (status) {
    case 'success': return '발행 완료'
    case 'failed': return '실패'
    case 'publishing': return '발행 중...'
    default: return '대기'
  }
}

export default function DigestProgressModal({
  isOpen,
  items,
  digestTitle,
  productCount,
  imageCount,
  onClose,
  canClose,
}: Props) {
  if (!isOpen) return null

  const successCount = items.filter((i) => i.status === 'success').length
  const failedCount = items.filter((i) => i.status === 'failed').length
  const doneCount = successCount + failedCount
  const total = items.length
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">종합 발행 진행 상황</h3>
          <p className="text-sm text-gray-600 mt-1 truncate" title={digestTitle}>
            {digestTitle || '(제목 없음)'}
          </p>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
            <span>상품 {productCount}개</span>
            <span>이미지 {imageCount}장</span>
            <span>{doneCount}/{total} 채널</span>
            {successCount > 0 && <span className="text-emerald-600">{successCount} 성공</span>}
            {failedCount > 0 && <span className="text-red-500">{failedCount} 실패</span>}
          </div>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.channelId}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                item.status === 'failed'
                  ? 'border-red-200 bg-red-50'
                  : item.status === 'success'
                  ? 'border-emerald-200 bg-emerald-50'
                  : item.status === 'publishing'
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex-shrink-0 pt-0.5">
                <StatusIcon status={item.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900 truncate" title={item.channelName}>
                    {item.channelName}
                  </span>
                  <span className="text-xs text-gray-600 whitespace-nowrap">
                    {statusLabel(item.status)}
                  </span>
                </div>
                {item.message && (
                  <p className="mt-1 text-xs text-gray-600 break-words">{item.message}</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={!canClose}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {canClose ? '닫기' : '진행 중...'}
          </button>
        </div>
      </div>
    </div>
  )
}
