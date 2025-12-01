'use client'

import { useState } from 'react'
import { X, Calendar, FileText, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'

interface SettlementModalProps {
  channelId: number
  channelName: string
  onClose: () => void
  onSuccess: () => void
}

export default function SettlementModal({
  channelId,
  channelName,
  onClose,
  onSuccess,
}: SettlementModalProps) {
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!periodStart || !periodEnd) {
      setError('정산 기간을 선택해주세요.')
      return
    }

    if (new Date(periodStart) > new Date(periodEnd)) {
      setError('시작일이 종료일보다 클 수 없습니다.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

  // 오늘 날짜를 기본값으로 설정하는 빠른 선택 버튼
  const setThisMonth = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setPeriodStart(firstDay.toISOString().split('T')[0])
    setPeriodEnd(lastDay.toISOString().split('T')[0])
  }

  const setLastMonth = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
    setPeriodStart(firstDay.toISOString().split('T')[0])
    setPeriodEnd(lastDay.toISOString().split('T')[0])
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
          {/* 소매밴드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              소매밴드
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
              {channelName}
            </div>
          </div>

          {/* 기간 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              정산 기간
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={setThisMonth}
                className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
              >
                이번달
              </button>
              <button
                type="button"
                onClick={setLastMonth}
                className="px-3 py-1 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100"
              >
                지난달
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <span className="text-gray-500">~</span>
              <div className="relative flex-1">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              메모 (선택)
            </label>
            <div className="relative">
              <FileText size={16} className="absolute left-3 top-3 text-gray-400" />
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="정산에 대한 메모를 입력하세요..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>
          </div>

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
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  처리중...
                </>
              ) : (
                '정산 생성'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
