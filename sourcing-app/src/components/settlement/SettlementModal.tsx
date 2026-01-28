'use client'

import { useState } from 'react'
import { X, FileText, Loader2, CheckCircle, Package, Banknote, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import Button from '@/components/ui/Button'

interface OrderItem {
  id: number
  orderId: number | null
  orderNumber: string
  customerName: string
  productName: string
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  wholesalePrice: number | null
  marginRate: number | null
  margin: number | null
  status: string
  orderedAt: string
  shopId: number | null
  shopName: string | null
  isSettled: boolean
}

interface SettlementModalProps {
  shopId: number
  shopName: string
  channelId?: number | null
  // 정산 정보 (목록에서 전달)
  periodStart: string
  periodEnd: string
  totalAmount: number
  orderCount: number
  // 주문 아이템 목록
  items?: OrderItem[]
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
  items = [],
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
  const [showItems, setShowItems] = useState(false)

  // 정산 완료/미완료 아이템 분리
  const settledItems = items.filter(i => i.isSettled)
  const unsettledItems = items.filter(i => !i.isSettled)
  const unsettledAmount = unsettledItems.reduce((sum, i) => sum + i.totalPrice, 0)
  const unsettledCount = unsettledItems.length

  // 평균 마진율 계산
  const itemsWithMargin = unsettledItems.filter(i => i.marginRate !== null)
  const avgMarginRate = itemsWithMargin.length > 0
    ? Math.round(itemsWithMargin.reduce((sum, i) => sum + (i.marginRate || 0), 0) / itemsWithMargin.length * 10) / 10
    : null

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
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">정산 생성</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* 쇼핑몰 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              쇼핑몰
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium">
              {shopName}
            </div>
          </div>

          {/* 정산 현황 요약 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 미정산 금액 (정산 대상) */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Banknote size={18} />
                <span className="text-sm font-medium">정산 대상</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                ₩{formatPrice(unsettledAmount)}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Package size={14} />
                <span>{unsettledCount}건</span>
                {avgMarginRate !== null && (
                  <>
                    <span className="text-gray-300">|</span>
                    <TrendingUp size={14} />
                    <span className={`font-medium ${
                      avgMarginRate >= 30 ? 'text-green-600' :
                      avgMarginRate >= 15 ? 'text-blue-600' :
                      'text-orange-600'
                    }`}>
                      평균 마진 {avgMarginRate}%
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* 정산 완료 금액 */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <CheckCircle size={18} />
                <span className="text-sm font-medium">정산 완료</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                ₩{formatPrice(settledItems.reduce((sum, i) => sum + i.totalPrice, 0))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Package size={14} />
                <span>{settledItems.length}건</span>
              </div>
            </div>
          </div>

          {/* 미정산 주문 목록 토글 */}
          {items.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowItems(!showItems)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">
                  주문 목록 ({items.length}건)
                </span>
                {showItems ? (
                  <ChevronUp size={18} className="text-gray-400" />
                ) : (
                  <ChevronDown size={18} className="text-gray-400" />
                )}
              </button>

              {showItems && (
                <div className="max-h-64 overflow-y-auto">
                  {/* 미정산 주문 */}
                  {unsettledItems.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
                        <span className="text-xs font-medium text-orange-700">미정산 ({unsettledItems.length}건)</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {unsettledItems.map((item) => (
                          <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.productName}
                                className="w-10 h-10 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Package size={16} className="text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{item.productName}</div>
                              <div className="text-xs text-gray-500">
                                {item.orderNumber} | {item.quantity}개 | {formatPrice(item.totalPrice)}원
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {item.marginRate !== null ? (
                                <span className={`text-sm font-medium ${
                                  item.marginRate >= 30 ? 'text-green-600' :
                                  item.marginRate >= 15 ? 'text-blue-600' :
                                  item.marginRate >= 0 ? 'text-orange-600' :
                                  'text-red-600'
                                }`}>
                                  {item.marginRate}%
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 정산 완료 주문 */}
                  {settledItems.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-green-50 border-b border-green-100">
                        <span className="text-xs font-medium text-green-700">정산 완료 ({settledItems.length}건)</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {settledItems.map((item) => (
                          <div key={item.id} className="px-4 py-3 flex items-center gap-3 bg-green-50/30">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.productName}
                                className="w-10 h-10 rounded object-cover flex-shrink-0 opacity-70"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 opacity-70">
                                <Package size={16} className="text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-600 truncate">{item.productName}</div>
                              <div className="text-xs text-gray-400">
                                {item.orderNumber} | {item.quantity}개 | {formatPrice(item.totalPrice)}원
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                                완료
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

          {/* 미정산 건이 없는 경우 안내 */}
          {unsettledCount === 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
              <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
              <p className="text-sm text-gray-600">
                모든 주문이 이미 정산 완료되었습니다.
              </p>
            </div>
          )}

          {/* 확인 체크박스 */}
          {unsettledCount > 0 && (
            <label className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-blue-800">
                미정산 {unsettledCount}건 (₩{formatPrice(unsettledAmount)})을 정산합니다.
              </span>
            </label>
          )}

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
              disabled={loading || !confirmed || unsettledCount === 0}
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
