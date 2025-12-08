'use client'

import { useState } from 'react'
import { X, FileText, Loader2, CheckCircle, Package, Banknote } from 'lucide-react'
import Button from '@/components/ui/Button'

interface SettlementModalProps {
  shopId: number
  shopName: string
  channelId?: number | null
  // 정산 정보 (목록에서 전달)
  periodStart: string
  periodEnd: string
  totalAmount: number
  orderCount: number
  // 은행 정보 (선택)
  bankInfo?: {
    bankName: string | null
    accountNumber: string | null
    accountHolder: string | null
  }
  onClose: () => void
  onSuccess: () => void
}

export default function SettlementModal({
  shopId,
  shopName,
  channelId,
  periodStart,
  periodEnd,
  totalAmount,
  orderCount,
  bankInfo,
  onClose,
  onSuccess,
}: SettlementModalProps) {
  // 정산 처리일 (기본값: 오늘)
  const today = new Date().toISOString().split('T')[0]
  const [settlementDate, setSettlementDate] = useState(today)
  const [memo, setMemo] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!confirmed) {
      setError('정산 내용을 확인해주세요.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          channelId,
          periodStart,
          periodEnd,
          memo: memo || undefined,
        }),
      })

      const result = await res.json()

      if (result.success) {
        onSuccess()
        onClose()
      } else {
        setError(result.error || '정산 생성에 실패했습니다.')
      }
    } catch (err) {
      setError('정산 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString()
  }

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">정산 생성</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 쇼핑몰 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              쇼핑몰
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium">
              {shopName}
            </div>
          </div>

          {/* 정산 금액 카드 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Banknote size={18} />
              <span className="text-sm font-medium">정산 금액</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              ₩{formatPrice(totalAmount)}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Package size={14} />
              <span>{orderCount}건</span>
            </div>
          </div>

          {/* 정산 처리일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              정산 처리일
            </label>
            <input
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 은행 정보 (있는 경우) */}
          {bankInfo && (bankInfo.bankName || bankInfo.accountNumber) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 mb-1">입금 계좌</div>
              <div className="text-sm text-gray-700">
                {bankInfo.bankName} {bankInfo.accountNumber}
                {bankInfo.accountHolder && (
                  <span className="text-gray-500 ml-1">({bankInfo.accountHolder})</span>
                )}
              </div>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText size={14} className="inline mr-1" />
              메모 (선택)
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="정산에 대한 메모를 입력하세요..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
            />
          </div>

          {/* 확인 체크박스 */}
          <label className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-blue-800">
              위 정산 내용을 확인했습니다.
            </span>
          </label>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !confirmed}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  처리중...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  정산 생성
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
