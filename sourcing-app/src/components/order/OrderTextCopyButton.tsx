'use client'

import { useState, useMemo } from 'react'
import {
  ClipboardCopy,
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
import { generateOrderTextsPerItem, type OrderTextData } from '@/lib/order-text'

const ORDER_DIVIDER = '\n\n' + '='.repeat(30) + '\n\n'

interface ChannelInfo {
  id: number
  kind: 'WHOLESALE' | 'RETAIL'
  platform: string
  name: string
}

interface OrderItem {
  id: number
  productName: string
  sourceProductName?: string | null
  optionSummary: string | null
  quantity: number
  unitPrice: number
  shippingFee: number
  wholesalePrice?: number | null  // 공급가 (도매원가)
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

interface OrderTextCopyButtonProps {
  orderNumber: string
  items: OrderItem[]
  shippingAddress: ShippingAddress | null
  orderStatus: string
  customerName?: string
  customerPhone?: string
  retailChannelNames?: string[]  // 주문이 들어온 소매밴드 이름들 (shopId 매핑)
  // 주문 레벨 합계 — 산식 정확도용 (item.unitPrice 가 배송비 포함이면 이걸 우선 사용)
  orderSubtotal?: number
  orderTotal?: number
  orderDiscount?: number
}

export default function OrderTextCopyButton({
  orderNumber,
  items,
  shippingAddress,
  orderStatus,
  customerName,
  customerPhone,
  retailChannelNames,
  orderSubtotal,
  orderTotal,
  orderDiscount,
}: OrderTextCopyButtonProps) {
  const toast = useToast()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  // 주문에서 도매채널 자동 감지 (첫 번째 도매 아이템의 채널)
  const defaultChannel = useMemo(() => {
    const wholesaleItem = items.find(item => item.channel?.kind === 'WHOLESALE')
    return wholesaleItem?.channel || null
  }, [items])

  // 결제 완료 이상 상태에서만 텍스트 복사 가능
  const canOrder = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(orderStatus)

  // 발주 텍스트 생성 (품목별 분리, 여러 개면 구분선으로 연결)
  const orderText = useMemo(() => {
    if (!shippingAddress) return ''

    const data: OrderTextData = {
      orderNumber,
      items: items.map(item => ({
        productName: item.productName,
        sourceProductName: item.sourceProductName,
        optionSummary: item.optionSummary,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        shippingFee: item.shippingFee,
        wholesalePrice: item.wholesalePrice,
      })),
      shipping: shippingAddress,
      wholesaleChannelName: defaultChannel?.name,
      retailChannelName: retailChannelNames && retailChannelNames.length > 0
        ? retailChannelNames.join(', ')
        : undefined,
      customerName,
      customerPhone,
      orderSubtotal,
      orderTotal,
      orderDiscount,
    }

    return generateOrderTextsPerItem(data).join(ORDER_DIVIDER)
  }, [orderNumber, items, shippingAddress, defaultChannel, customerName, customerPhone, retailChannelNames, orderSubtotal, orderTotal, orderDiscount])

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

  if (!canOrder || !shippingAddress) return null

  return (
    <div className="bg-blue-50 rounded-lg border border-blue-200">
      {/* 토글 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-blue-100 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <ClipboardCopy size={20} className="text-blue-700" />
          <span className="font-semibold text-blue-900">텍스트 복사</span>
          <span className="text-xs text-blue-600 bg-blue-200 px-2 py-0.5 rounded-full">
            클립보드 복사
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={20} className="text-blue-600" />
        ) : (
          <ChevronDown size={20} className="text-blue-600" />
        )}
      </button>

      {/* 확장 영역 */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* 감지된 도매처 안내 */}
          {defaultChannel && (
            <div className="flex items-center gap-1.5 text-xs text-blue-700">
              <Store size={12} />
              <span>도매처: <span className="font-medium">{defaultChannel.name}</span> (자동 감지)</span>
            </div>
          )}

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
          <Button
            variant="primary"
            onClick={handleCopy}
            className="w-full"
          >
            {isCopied ? <Check size={16} /> : <Copy size={16} />}
            {isCopied ? '복사됨' : '텍스트 복사'}
          </Button>

          <p className="text-xs text-gray-500">
            복사한 텍스트를 도매처에 전달하세요.
          </p>
        </div>
      )}
    </div>
  )
}
