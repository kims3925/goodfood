'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  MessageSquare,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Store,
  Eye,
  EyeOff,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { generateOrderText, type OrderTextData } from '@/lib/order-text'
import { CHANNEL_PLATFORM_CONFIG } from '@/lib/channel-utils'

interface ChannelInfo {
  id: number
  kind: 'WHOLESALE' | 'RETAIL'
  platform: string
  name: string
}

interface OrderItem {
  id: number
  productName: string
  optionSummary: string | null
  quantity: number
  channel: ChannelInfo | null
}

interface ShippingAddress {
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail: string | null
  deliveryMemo: string | null
}

interface WholesaleChannel {
  id: number
  name: string
  platform: string
  kind: string
}

interface KakaoOrderButtonProps {
  orderNumber: string
  items: OrderItem[]
  shippingAddress: ShippingAddress | null
  orderStatus: string
}

export default function KakaoOrderButton({
  orderNumber,
  items,
  shippingAddress,
  orderStatus,
}: KakaoOrderButtonProps) {
  const toast = useToast()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [wholesaleChannels, setWholesaleChannels] = useState<WholesaleChannel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)

  // 주문에서 도매채널 자동 감지 (첫 번째 아이템의 채널)
  const defaultChannel = useMemo(() => {
    const wholesaleItem = items.find(item => item.channel?.kind === 'WHOLESALE')
    return wholesaleItem?.channel || null
  }, [items])

  // 결제 완료 이상 상태에서만 카톡 발주 가능
  const canOrder = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(orderStatus)

  // 도매 채널 목록 로드
  useEffect(() => {
    if (!isExpanded) return

    const loadChannels = async () => {
      setIsLoadingChannels(true)
      try {
        const res = await fetch('/api/channel/wholesale')
        const data = await res.json()
        if (data.success) {
          setWholesaleChannels(data.data)
          // 자동 선택: 주문 아이템의 도매채널이 있으면 그것을 선택
          if (defaultChannel && !selectedChannelId) {
            setSelectedChannelId(defaultChannel.id)
          } else if (data.data.length > 0 && !selectedChannelId) {
            setSelectedChannelId(data.data[0].id)
          }
        }
      } catch (err) {
        console.error('도매 채널 목록 로드 실패:', err)
      } finally {
        setIsLoadingChannels(false)
      }
    }

    loadChannels()
  }, [isExpanded, defaultChannel, selectedChannelId])

  // 선택된 채널 이름
  const selectedChannelName = useMemo(() => {
    if (!selectedChannelId) return undefined
    const ch = wholesaleChannels.find(c => c.id === selectedChannelId)
    return ch?.name
  }, [selectedChannelId, wholesaleChannels])

  // 발주 텍스트 생성
  const orderText = useMemo(() => {
    if (!shippingAddress) return ''

    const data: OrderTextData = {
      orderNumber,
      items: items.map(item => ({
        productName: item.productName,
        optionSummary: item.optionSummary,
        quantity: item.quantity,
      })),
      shipping: shippingAddress,
      wholesaleChannelName: selectedChannelName,
    }

    return generateOrderText(data)
  }, [orderNumber, items, shippingAddress, selectedChannelName])

  // 클립보드 복사
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderText)
      setIsCopied(true)
      toast.success('발주 내용이 클립보드에 복사되었습니다.')
      setTimeout(() => setIsCopied(false), 3000)
    } catch (err) {
      // 폴백: textarea 방식
      try {
        const textarea = document.createElement('textarea')
        textarea.value = orderText
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setIsCopied(true)
        toast.success('발주 내용이 클립보드에 복사되었습니다.')
        setTimeout(() => setIsCopied(false), 3000)
      } catch {
        toast.error('복사에 실패했습니다. 직접 텍스트를 선택하여 복사해주세요.')
      }
    }
  }

  // 복사 + 발주완료 처리
  const handleCopyAndComplete = async () => {
    await handleCopy()

    // 발주 완료 상태로 API 호출
    try {
      const res = await fetch(`/api/order/${orderNumber}/wholesale-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ORDERED',
          wholesaleChannelId: selectedChannelId,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success('발주 완료 처리되었습니다.')
      }
      // 실패해도 복사는 성공했으므로 별도 에러 표시하지 않음
    } catch (err) {
      console.error('발주 상태 업데이트 실패:', err)
    }
  }

  if (!canOrder || !shippingAddress) return null

  return (
    <div className="bg-yellow-50 rounded-lg border border-yellow-200">
      {/* 토글 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-yellow-100 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-yellow-700" />
          <span className="font-semibold text-yellow-900">카톡 발주</span>
          <span className="text-xs text-yellow-600 bg-yellow-200 px-2 py-0.5 rounded-full">
            클립보드 복사
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={20} className="text-yellow-600" />
        ) : (
          <ChevronDown size={20} className="text-yellow-600" />
        )}
      </button>

      {/* 확장 영역 */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* 도매처 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              도매처 선택
            </label>
            {isLoadingChannels ? (
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedChannelId ?? ''}
                onChange={(e) => setSelectedChannelId(e.target.value ? Number(e.target.value) : null)}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              >
                <option value="">도매처를 선택하세요</option>
                {wholesaleChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} ({CHANNEL_PLATFORM_CONFIG[ch.platform]?.label || ch.platform})
                  </option>
                ))}
              </select>
            )}
            {/* 주문 아이템의 도매처가 감지된 경우 안내 */}
            {defaultChannel && (
              <p className="mt-1 text-xs text-yellow-700 flex items-center gap-1">
                <Store size={12} />
                주문 상품의 도매처: {defaultChannel.name}
              </p>
            )}
          </div>

          {/* 미리보기 토글 */}
          <div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPreview ? '미리보기 닫기' : '발주 내용 미리보기'}
            </button>

            {showPreview && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                <pre className="text-xs sm:text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                  {orderText}
                </pre>
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="secondary"
              onClick={handleCopy}
              className="flex-1"
            >
              {isCopied ? <Check size={16} /> : <Copy size={16} />}
              {isCopied ? '복사됨' : '텍스트 복사'}
            </Button>
            <Button
              variant="primary"
              onClick={handleCopyAndComplete}
              className="flex-1"
              style={{ backgroundColor: '#FEE500', color: '#3C1E1E', borderColor: '#FEE500' }}
            >
              <MessageSquare size={16} />
              복사 + 발주완료
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            복사한 내용을 카카오톡 채팅방에 붙여넣기하여 도매처에 발주하세요.
          </p>
        </div>
      )}
    </div>
  )
}
