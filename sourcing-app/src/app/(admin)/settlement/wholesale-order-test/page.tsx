'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import {
  RefreshCw,
  Store,
  Calendar,
  DollarSign,
  ShoppingBag,
  Package,
  AlertCircle,
  Download,
  ChevronDown,
  ChevronUp,
  X,
  FileSpreadsheet,
  Truck,
  Check,
  Minus,
  Plus,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

// ============================================
// Types
// ============================================

interface WholesaleOrderItem {
  orderItemId: number
  orderId: number
  orderNumber: string
  orderedAt: string
  paidAt: string | null
  retailChannelId: number | null
  retailChannelName: string | null
  productId: number
  productName: string
  optionSummary: string | null
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  wholesalePrice: number | null  // ProductVariant.wholesalePrice
  wholesaleTotalPrice: number | null
  customerName: string
  orderStatus: string
}

interface WholesaleChannelSummary {
  wholesaleChannelId: number
  wholesaleChannelName: string
  wholesaleChannelCoverUrl: string | null
  platform: string
  totalOrders: number
  totalItems: number
  totalQuantity: number
  totalRetailAmount: number
  totalWholesaleAmount: number
  items: WholesaleOrderItem[]
}

interface WholesaleOrderData {
  wholesaleChannels: WholesaleChannelSummary[]
  summary: {
    totalWholesaleChannels: number
    totalOrders: number
    totalItems: number
    totalQuantity: number
    totalRetailAmount: number
    totalWholesaleAmount: number
  }
}

// 발주 항목 (체크/수량 수정용)
interface BatchItem {
  orderItemId: number
  included: boolean
  adjustedQty: number
  originalQty: number
  memo: string
}

// ============================================
// Constants
// ============================================

const PLATFORM_COLORS: Record<string, {
  bg: string
  border: string
  text: string
  accent: string
  gradient: string
}> = {
  BAND: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    accent: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-teal-500',
  },
  SHOP: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    accent: 'bg-blue-500',
    gradient: 'from-blue-500 to-indigo-500',
  },
  ALIEXPRESS: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-700',
    accent: 'bg-orange-500',
    gradient: 'from-orange-500 to-red-500',
  },
  DEFAULT: {
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    text: 'text-gray-700',
    accent: 'bg-gray-500',
    gradient: 'from-gray-500 to-slate-500',
  },
}

const PLATFORM_LABELS: Record<string, string> = {
  BAND: '밴드',
  SHOP: '쇼핑몰',
  ALIEXPRESS: '알리익스프레스',
  NAVER_CAFE: '네이버 카페',
  COUPANG: '쿠팡',
  SMARTSTORE: '스마트스토어',
}

// ============================================
// Main Component
// ============================================

export default function WholesaleOrderTestPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<WholesaleOrderData | null>(null)

  // 필터 상태
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 선택된 도매처
  const [selectedChannel, setSelectedChannel] = useState<WholesaleChannelSummary | null>(null)

  // 발주 배치 상태
  const [batchItems, setBatchItems] = useState<Map<number, BatchItem>>(new Map())
  const [exporting, setExporting] = useState(false)

  // 데이터 로드
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/wholesale-orders/test?${params}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast.error(result.error || '데이터 로드 실패')
      }
    } catch (error) {
      console.error('도매처 발주 데이터 로드 실패:', error)
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 도매처 선택 시 배치 아이템 초기화
  useEffect(() => {
    if (selectedChannel) {
      const newBatchItems = new Map<number, BatchItem>()
      selectedChannel.items.forEach(item => {
        newBatchItems.set(item.orderItemId, {
          orderItemId: item.orderItemId,
          included: true,
          adjustedQty: item.quantity,
          originalQty: item.quantity,
          memo: '',
        })
      })
      setBatchItems(newBatchItems)
    } else {
      setBatchItems(new Map())
    }
  }, [selectedChannel])

  // ============================================
  // Handlers
  // ============================================

  const toggleItemIncluded = (orderItemId: number) => {
    setBatchItems(prev => {
      const newMap = new Map(prev)
      const item = newMap.get(orderItemId)
      if (item) {
        newMap.set(orderItemId, { ...item, included: !item.included })
      }
      return newMap
    })
  }

  const updateItemQty = (orderItemId: number, qty: number) => {
    setBatchItems(prev => {
      const newMap = new Map(prev)
      const item = newMap.get(orderItemId)
      if (item) {
        newMap.set(orderItemId, { ...item, adjustedQty: Math.max(0, qty) })
      }
      return newMap
    })
  }

  const updateItemMemo = (orderItemId: number, memo: string) => {
    setBatchItems(prev => {
      const newMap = new Map(prev)
      const item = newMap.get(orderItemId)
      if (item) {
        newMap.set(orderItemId, { ...item, memo })
      }
      return newMap
    })
  }

  const selectAll = () => {
    setBatchItems(prev => {
      const newMap = new Map(prev)
      newMap.forEach((item, key) => {
        newMap.set(key, { ...item, included: true })
      })
      return newMap
    })
  }

  const deselectAll = () => {
    setBatchItems(prev => {
      const newMap = new Map(prev)
      newMap.forEach((item, key) => {
        newMap.set(key, { ...item, included: false })
      })
      return newMap
    })
  }

  // 엑셀 다운로드
  const handleExportExcel = async () => {
    if (!selectedChannel) return

    const includedItems = Array.from(batchItems.values()).filter(b => b.included)
    if (includedItems.length === 0) {
      toast.error('발주할 항목을 선택해주세요.')
      return
    }

    setExporting(true)
    try {
      const res = await fetch('/api/wholesale-orders/test/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wholesaleChannelId: selectedChannel.wholesaleChannelId,
          wholesaleChannelName: selectedChannel.wholesaleChannelName,
          periodStart: startDate || null,
          periodEnd: endDate || null,
          items: includedItems.map(b => {
            const originalItem = selectedChannel.items.find(i => i.orderItemId === b.orderItemId)
            return {
              orderItemId: b.orderItemId,
              orderNumber: originalItem?.orderNumber,
              productName: originalItem?.productName,
              optionSummary: originalItem?.optionSummary,
              quantity: b.adjustedQty,
              unitPrice: originalItem?.wholesalePrice || originalItem?.unitPrice,
              totalAmount: b.adjustedQty * (originalItem?.wholesalePrice || originalItem?.unitPrice || 0),
              memo: b.memo,
            }
          }),
        }),
      })

      if (!res.ok) {
        throw new Error('엑셀 생성 실패')
      }

      // 파일 다운로드
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `발주서_${selectedChannel.wholesaleChannelName}_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()

      toast.success('엑셀 발주서가 다운로드되었습니다.')
    } catch (error) {
      console.error('엑셀 내보내기 실패:', error)
      toast.error('엑셀 생성에 실패했습니다.')
    } finally {
      setExporting(false)
    }
  }

  // ============================================
  // Computed Values
  // ============================================

  const getColorScheme = (platform: string) => {
    return PLATFORM_COLORS[platform] || PLATFORM_COLORS.DEFAULT
  }

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return '-'
    return `${price.toLocaleString()}원`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const maskName = (name: string) => {
    if (!name || name.length <= 1) return name
    if (name.length === 2) return name[0] + '*'
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
  }

  // 선택된 항목 집계
  const selectedSummary = (() => {
    if (!selectedChannel) return { count: 0, quantity: 0, amount: 0 }

    let count = 0
    let quantity = 0
    let amount = 0

    batchItems.forEach((batch, orderItemId) => {
      if (batch.included) {
        const original = selectedChannel.items.find(i => i.orderItemId === orderItemId)
        if (original) {
          count++
          quantity += batch.adjustedQty
          amount += batch.adjustedQty * (original.wholesalePrice || original.unitPrice)
        }
      }
    })

    return { count, quantity, amount }
  })()

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Truck size={24} className="text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">도매처 발주 관리</h1>
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 ml-2">
                테스트 페이지
              </span>
            </div>
          </div>
          <p className="text-gray-600 mt-2">
            결제 완료된 주문을 도매처별로 집계하고 발주서를 생성합니다.
          </p>
        </div>

        {/* 통계 카드 */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Store size={24} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">도매처</p>
                  <p className="text-2xl font-bold text-purple-600">{data.summary.totalWholesaleChannels}개</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ShoppingBag size={24} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">발주 대상</p>
                  <p className="text-2xl font-bold text-blue-600">{data.summary.totalItems}건</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Package size={24} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">총 수량</p>
                  <p className="text-2xl font-bold text-green-600">{data.summary.totalQuantity}개</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <DollarSign size={24} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">도매가 합계</p>
                  <p className="text-xl font-bold text-amber-600">{formatPrice(data.summary.totalWholesaleAmount)}</p>
                </div>
              </div>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <RefreshCw size={24} className={`text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">데이터</p>
                  <p className="text-lg font-bold text-gray-600">새로고침</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* 필터 영역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-sm text-gray-500">주문일:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X size={14} />
                필터 초기화
              </button>
            )}
            <div className="ml-auto text-sm text-gray-500">
              * 결제 완료(PAID) 상태의 주문만 표시됩니다.
            </div>
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <Loading />
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 도매처 목록 (좌측) */}
            <div className="lg:col-span-1">
              <h2 className="text-lg font-bold text-gray-900 mb-4">도매처별 발주 현황</h2>

              {data.wholesaleChannels.length > 0 ? (
                <div className="space-y-4">
                  {data.wholesaleChannels.map((channel) => {
                    const colors = getColorScheme(channel.platform)
                    const isSelected = selectedChannel?.wholesaleChannelId === channel.wholesaleChannelId

                    return (
                      <div
                        key={channel.wholesaleChannelId}
                        className={`
                          relative overflow-hidden rounded-xl border-2 transition-all duration-200 cursor-pointer
                          ${isSelected ? `${colors.border} ring-2 ring-offset-2 ${colors.border.replace('border-', 'ring-')}` : 'border-gray-200 hover:border-gray-300'}
                          ${colors.bg}
                        `}
                        onClick={() => setSelectedChannel(isSelected ? null : channel)}
                      >
                        {/* 상단 색상 바 */}
                        <div className={`h-2 bg-gradient-to-r ${colors.gradient}`} />

                        <div className="p-4">
                          {/* 채널 정보 헤더 */}
                          <div className="flex items-start gap-3 mb-3">
                            {channel.wholesaleChannelCoverUrl ? (
                              <Image
                                src={channel.wholesaleChannelCoverUrl}
                                alt={channel.wholesaleChannelName}
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-white shadow-sm"
                              />
                            ) : (
                              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colors.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                <Store size={20} className="text-white" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-gray-900 truncate">{channel.wholesaleChannelName}</h3>
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}>
                                {PLATFORM_LABELS[channel.platform] || channel.platform}
                              </span>
                            </div>
                            {isSelected && (
                              <div className={`p-1 rounded-full ${colors.accent}`}>
                                <Check size={14} className="text-white" />
                              </div>
                            )}
                          </div>

                          {/* 집계 정보 */}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-white/60 rounded-lg p-2">
                              <p className="text-gray-500 text-xs">발주 건수</p>
                              <p className="font-bold text-gray-900">{channel.totalItems}건</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-2">
                              <p className="text-gray-500 text-xs">총 수량</p>
                              <p className="font-bold text-gray-900">{channel.totalQuantity}개</p>
                            </div>
                          </div>

                          {/* 금액 */}
                          <div className="mt-3 pt-3 border-t border-white/50">
                            <div className="flex items-baseline justify-between">
                              <span className="text-sm text-gray-600">도매가 합계</span>
                              <span className={`text-lg font-bold ${colors.text}`}>
                                {formatPrice(channel.totalWholesaleAmount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <Store size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">발주 대상이 없습니다</h3>
                  <p className="text-gray-500 text-sm">
                    결제 완료된 주문이 있으면 도매처별로 집계됩니다.
                  </p>
                </div>
              )}
            </div>

            {/* 상세 목록 (우측) */}
            <div className="lg:col-span-2">
              {selectedChannel ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* 헤더 */}
                  <div className={`p-4 border-b ${getColorScheme(selectedChannel.platform).bg}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {selectedChannel.wholesaleChannelCoverUrl ? (
                          <Image
                            src={selectedChannel.wholesaleChannelCoverUrl}
                            alt={selectedChannel.wholesaleChannelName}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getColorScheme(selectedChannel.platform).gradient} flex items-center justify-center`}>
                            <Store size={20} className="text-white" />
                          </div>
                        )}
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {selectedChannel.wholesaleChannelName} 발주 목록
                          </h3>
                          <p className="text-sm text-gray-600">
                            {selectedChannel.totalItems}건 | 도매가 합계 {formatPrice(selectedChannel.totalWholesaleAmount)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedChannel(null)}
                        className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                      >
                        <X size={20} className="text-gray-500" />
                      </button>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/50">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={selectAll}
                          className="px-3 py-1.5 text-sm bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
                        >
                          전체 선택
                        </button>
                        <button
                          onClick={deselectAll}
                          className="px-3 py-1.5 text-sm bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
                        >
                          전체 해제
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-600">
                          선택: <span className="font-bold">{selectedSummary.count}건</span> /
                          수량: <span className="font-bold">{selectedSummary.quantity}개</span> /
                          금액: <span className="font-bold text-purple-600">{formatPrice(selectedSummary.amount)}</span>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleExportExcel}
                          disabled={exporting || selectedSummary.count === 0}
                          className="flex items-center gap-2"
                        >
                          {exporting ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <FileSpreadsheet size={16} />
                          )}
                          엑셀 발주서 다운로드
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* 테이블 */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12">선택</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">소매처</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">옵션</th>
                          <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24">수량</th>
                          <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">도매단가</th>
                          <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">공급금액</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문일</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">메모</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedChannel.items.map((item) => {
                          const batchItem = batchItems.get(item.orderItemId)
                          const isIncluded = batchItem?.included ?? true
                          const adjustedQty = batchItem?.adjustedQty ?? item.quantity
                          const unitPrice = item.wholesalePrice || item.unitPrice
                          const totalAmount = adjustedQty * unitPrice

                          return (
                            <tr
                              key={item.orderItemId}
                              className={`hover:bg-gray-50 ${!isIncluded ? 'opacity-50 bg-gray-100' : ''}`}
                            >
                              <td className="px-3 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isIncluded}
                                  onChange={() => toggleItemIncluded(item.orderItemId)}
                                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                />
                              </td>
                              <td className="px-3 py-3 text-sm font-mono text-gray-900">
                                {item.orderNumber}
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-600">
                                {item.retailChannelName || '-'}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  {item.thumbnailUrl ? (
                                    <Image
                                      src={item.thumbnailUrl}
                                      alt={item.productName}
                                      width={32}
                                      height={32}
                                      className="w-8 h-8 rounded object-cover"
                                    />
                                  ) : (
                                    <Package size={16} className="text-gray-400 flex-shrink-0" />
                                  )}
                                  <span className="text-sm text-gray-900 line-clamp-1 max-w-[200px]">
                                    {item.productName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-600">
                                {item.optionSummary || '-'}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => updateItemQty(item.orderItemId, adjustedQty - 1)}
                                    disabled={!isIncluded}
                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <input
                                    type="number"
                                    value={adjustedQty}
                                    onChange={(e) => updateItemQty(item.orderItemId, parseInt(e.target.value) || 0)}
                                    disabled={!isIncluded}
                                    className="w-12 text-center text-sm border border-gray-300 rounded py-1 disabled:bg-gray-100"
                                  />
                                  <button
                                    onClick={() => updateItemQty(item.orderItemId, adjustedQty + 1)}
                                    disabled={!isIncluded}
                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                                {adjustedQty !== item.quantity && (
                                  <p className="text-xs text-orange-500 text-center mt-1">
                                    (원래: {item.quantity})
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-3 text-sm text-right text-gray-900">
                                {formatPrice(unitPrice)}
                              </td>
                              <td className="px-3 py-3 text-sm text-right font-medium text-gray-900">
                                {formatPrice(totalAmount)}
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-600">
                                {maskName(item.customerName)}
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-500">
                                {formatDate(item.orderedAt)}
                              </td>
                              <td className="px-3 py-3">
                                <input
                                  type="text"
                                  placeholder="메모"
                                  value={batchItem?.memo || ''}
                                  onChange={(e) => updateItemMemo(item.orderItemId, e.target.value)}
                                  disabled={!isIncluded}
                                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 하단 요약 */}
                  <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        총 {selectedChannel.items.length}건 중 <span className="font-bold text-purple-600">{selectedSummary.count}건</span> 선택됨
                      </div>
                      <div className="flex items-center gap-6">
                        <div>
                          <span className="text-sm text-gray-500">선택 수량:</span>
                          <span className="ml-2 font-bold text-lg">{selectedSummary.quantity}개</span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">선택 공급금액:</span>
                          <span className="ml-2 font-bold text-lg text-purple-600">{formatPrice(selectedSummary.amount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <ChevronDown size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">도매처를 선택하세요</h3>
                  <p className="text-gray-500">
                    좌측에서 도매처 카드를 클릭하면 발주 대상 상세 목록을 확인할 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <AlertCircle size={48} className="mx-auto text-red-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">데이터를 불러오지 못했습니다</h3>
            <p className="text-gray-500 mb-4">잠시 후 다시 시도해주세요.</p>
            <Button variant="primary" onClick={fetchData}>
              다시 시도
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
