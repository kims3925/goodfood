'use client'

import { useState } from 'react'
import { Sheet, Loader2, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface OrderSheetSyncButtonProps {
  /** 주문 상세 페이지가 보유한 UnifiedOrderDetail 객체 (필요 필드만 사용) */
  order: any
  disabled?: boolean
}

/**
 * 주문 상세 하단 — "구글시트로 전송" 버튼.
 * 현재 주문의 품목들을 사용자 구글 시트('쇼핑몰주문' 탭)에 누적(append)한다.
 * 텍스트복사 버튼과 나란히 배치.
 */
export default function OrderSheetSyncButton({ order, disabled }: OrderSheetSyncButtonProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [lastUrl, setLastUrl] = useState<string | null>(null)

  const handleSync = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/order/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order }),
      })
      const data = await res.json()
      if (data.success) {
        setLastUrl(data.data?.url || null)
        toast.success(data.data?.message || '구글 시트로 전송되었습니다.')
      } else {
        toast.error(data.error || '구글 시트 전송에 실패했습니다.')
      }
    } catch {
      toast.error('구글 시트 전송 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={disabled || loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sheet size={16} />}
        {loading ? '전송 중...' : '구글시트로 전송'}
      </button>
      {lastUrl && (
        <a
          href={lastUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-xs text-emerald-700 hover:underline"
        >
          <ExternalLink size={12} />
          구글 시트 열기
        </a>
      )}
    </div>
  )
}
