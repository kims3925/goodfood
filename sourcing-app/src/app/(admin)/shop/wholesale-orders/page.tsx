'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Package,
  Download,
  ChevronRight,
  ChevronLeft,
  Truck,
  X,
  Clock,
  Settings,
  ShoppingCart,
  Banknote,
  Store,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { formatPhoneNumber } from '@/modules/utils/phoneUtils'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

// 주문 그룹 색상 팔레트
const ORDER_COLORS = [
  { border: 'border-blue-400', bg: 'bg-blue-50/30' },
  { border: 'border-purple-400', bg: 'bg-purple-50/30' },
  { border: 'border-green-400', bg: 'bg-green-50/30' },
  { border: 'border-orange-400', bg: 'bg-orange-50/30' },
]

interface WholesaleSummary {
  wholesaleChannelId: number
  wholesaleChannelName: string
  wholesaleChannelCoverUrl: string | null
  totalOrders: number
  totalQuantity: number
  totalAmount: number
}

interface WholesaleOrderItem {
  orderItemId: number
  orderId: number  // 발주완료 처리용
  orderNumber: string
  orderedAt: string
  isMember: boolean  // 회원/비회원 구분
  retailChannelName: string
  productName: string
  optionSummary: string
  quantity: number
  wholesalePrice: number
  totalAmount: number
  customerName: string
  customerPhone: string
  customerAddress: string
  postalCode: string
}

interface OrderItemsResponse {
  items: WholesaleOrderItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    totalQuantity: number
    totalAmount: number
  }
}

interface MissedOrdersInfo {
  count: number
  oldestDate: string
  newestDate: string
}

export default function WholesaleOrdersPage() {
  const toast = useToast()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [summaries, setSummaries] = useState<WholesaleSummary[]>([])
  const [missedOrders, setMissedOrders] = useState<MissedOrdersInfo | null>(null)

  // 날짜 필터 (하루만) - URL 쿼리 파라미터에서 초기값 설정
  const [selectedDate, setSelectedDate] = useState(() => {
    const dateParam = searchParams.get('date')
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return dateParam
    }
    return new Date().toISOString().split('T')[0]
  })

  // 자동 발주 시간 설정
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('18:00')

  // 상세 보기
  const [selectedChannel, setSelectedChannel] = useState<WholesaleSummary | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [orderItems, setOrderItems] = useState<OrderItemsResponse | null>(null)
  const [detailPage, setDetailPage] = useState(1)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // 체크박스 선택 상태 (key: orderId-isMember, value: { orderId, isMember })
  const [selectedOrders, setSelectedOrders] = useState<Map<string, { orderId: number; isMember: boolean }>>(new Map())

  // 각 주문(orderId)에 색상 인덱스 할당
  const orderColorMap = useMemo(() => {
    if (!orderItems) return new Map<string, number>()

    const uniqueOrders = new Map<string, number>()
    let colorIndex = 0

    orderItems.items.forEach(item => {
      const key = `${item.orderId}-${item.isMember}`
      if (!uniqueOrders.has(key)) {
        uniqueOrders.set(key, colorIndex % ORDER_COLORS.length)
        colorIndex++
      }
    })

    return uniqueOrders
  }, [orderItems])

  // 각 아이템이 그룹의 첫 번째인지 여부 및 주문 정보
  const orderMetadata = useMemo(() => {
    if (!orderItems) return new Map<string, {
      isFirst: boolean
      itemCount: number
      orderNumber: string
      orderedAt: string
    }>()

    const metadata = new Map()
    const orderItemCounts = new Map<string, number>()
    const seenOrders = new Set<string>()

    // 주문당 아이템 개수 세기
    orderItems.items.forEach(item => {
      const orderKey = `${item.orderId}-${item.isMember}`
      orderItemCounts.set(orderKey, (orderItemCounts.get(orderKey) || 0) + 1)
    })

    // 첫 번째 아이템 식별
    orderItems.items.forEach(item => {
      const orderKey = `${item.orderId}-${item.isMember}`
      const itemKey = `${item.orderItemId}`

      metadata.set(itemKey, {
        isFirst: !seenOrders.has(orderKey),
        itemCount: orderItemCounts.get(orderKey) || 1,
        orderNumber: item.orderNumber,
        orderedAt: item.orderedAt
      })

      seenOrders.add(orderKey)
    })

    return metadata
  }, [orderItems])

  // 집계 조회
  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from: selectedDate,
        to: selectedDate,
      })

      const res = await fetch(`/api/admin/wholesale-orders/summary?${params}`)
      const data = await res.json()

      if (data.success) {
        setSummaries(data.data)
        setMissedOrders(data.missedOrders || null)
        // 디버그 정보 출력
        if (data.debug) {
          console.log('=== 도매 발주 디버그 ===', data.debug)
        }
      } else {
        toast.error(data.error || '집계 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('집계 조회 실패:', error)
      toast.error('집계 조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  // 상세 조회
  const fetchDetails = useCallback(async (channelId: number, page: number = 1) => {
    setDetailLoading(true)
    try {
      const params = new URLSearchParams({
        from: selectedDate,
        to: selectedDate,
        page: page.toString(),
        limit: '10',
      })

      const res = await fetch(`/api/admin/wholesale-orders/${channelId}/items?${params}`)
      const data = await res.json()

      if (data.success) {
        setOrderItems(data.data)
        setDetailPage(page)
      } else {
        toast.error(data.error || '상세 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('상세 조회 실패:', error)
      toast.error('상세 조회에 실패했습니다.')
    } finally {
      setDetailLoading(false)
    }
  }, [selectedDate])

  // 엑셀 다운로드
  const downloadExcel = async (channelId: number, channelName: string) => {
    try {
      const params = new URLSearchParams({
        from: selectedDate,
        to: selectedDate,
      })

      const res = await fetch(`/api/admin/wholesale-orders/${channelId}/export?${params}`)

      if (!res.ok) {
        toast.error('엑셀 다운로드에 실패했습니다.')
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `발주서_${channelName}_${selectedDate}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('발주서가 다운로드되었습니다.')
    } catch (error) {
      console.error('엑셀 다운로드 실패:', error)
      toast.error('엑셀 다운로드에 실패했습니다.')
    }
  }

  // 발주 완료 (배송시작) 상태로 변경
  const markAsShipped = async (channelId: number, markAll: boolean = false) => {
    setIsUpdatingStatus(true)
    try {
      const params = new URLSearchParams({
        from: selectedDate,
        to: selectedDate,
      })

      // 선택 발주완료 시 선택된 주문 ID 분류
      let body: { markAll?: boolean; orderIds?: { memberIds?: number[]; guestIds?: number[] } } = {}

      if (markAll) {
        body = { markAll: true }
      } else {
        // 선택된 주문을 회원/비회원으로 분류
        const memberIds: number[] = []
        const guestIds: number[] = []

        selectedOrders.forEach((order) => {
          if (order.isMember) {
            memberIds.push(order.orderId)
          } else {
            guestIds.push(order.orderId)
          }
        })

        if (memberIds.length === 0 && guestIds.length === 0) {
          toast.error('선택된 주문이 없습니다.')
          setIsUpdatingStatus(false)
          return
        }

        body = {
          orderIds: {
            ...(memberIds.length > 0 && { memberIds }),
            ...(guestIds.length > 0 && { guestIds }),
          },
        }
      }

      const res = await fetch(`/api/admin/wholesale-orders/${channelId}/mark-shipped?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        toast.success(`${data.updatedCount}건의 주문이 발주 완료(배송시작) 처리되었습니다.`)
        // 선택 초기화
        setSelectedOrders(new Map())
        // 목록 새로고침
        fetchSummary()
        // 상세 목록 새로고침
        if (selectedChannel) {
          fetchDetails(selectedChannel.wholesaleChannelId, 1)
        }
      } else {
        toast.error(data.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('상태 변경 실패:', error)
      toast.error('상태 변경에 실패했습니다.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // 체크박스 토글
  const toggleOrderSelection = (item: WholesaleOrderItem) => {
    const key = `${item.orderId}-${item.isMember}`
    setSelectedOrders((prev) => {
      const next = new Map(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.set(key, { orderId: item.orderId, isMember: item.isMember })
      }
      return next
    })
  }

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (!orderItems) return

    const allSelected = orderItems.items.every((item) => selectedOrders.has(`${item.orderId}-${item.isMember}`))

    if (allSelected) {
      // 전체 해제
      setSelectedOrders(new Map())
    } else {
      // 전체 선택
      const newSelection = new Map<string, { orderId: number; isMember: boolean }>()
      orderItems.items.forEach((item) => {
        const key = `${item.orderId}-${item.isMember}`
        newSelection.set(key, { orderId: item.orderId, isMember: item.isMember })
      })
      setSelectedOrders(newSelection)
    }
  }

  // 현재 페이지 전체 선택 여부
  const isAllSelected = orderItems && orderItems.items.length > 0 && orderItems.items.every((item) => selectedOrders.has(`${item.orderId}-${item.isMember}`))

  // 날짜 변경 핸들러 (자동 조회)
  const handleDateChange = (date: string) => {
    setSelectedDate(date)
  }

  // 날짜 변경 시 자동 조회
  useEffect(() => {
    fetchSummary()
  }, [selectedDate, fetchSummary])

  // 도매처 선택 시 상세 조회
  useEffect(() => {
    if (selectedChannel) {
      fetchDetails(selectedChannel.wholesaleChannelId, 1)
    }
  }, [selectedChannel])

  const formatPrice = (price: number) => {
    return `₩${price.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  // 총합계 계산
  const totalSummary = summaries.reduce(
    (acc, s) => ({
      totalOrders: acc.totalOrders + s.totalOrders,
      totalQuantity: acc.totalQuantity + s.totalQuantity,
      totalAmount: acc.totalAmount + s.totalAmount,
    }),
    { totalOrders: 0, totalQuantity: 0, totalAmount: 0 }
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">발주 관리</h1>
          <p className="text-gray-600">
            결제 완료된 주문을 도매처별로 집계하고 발주서를 생성합니다.
          </p>
        </div>

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {/* 전체 주문 카드 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Package size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 주문</p>
                <p className="text-2xl font-bold text-gray-900">{totalSummary.totalOrders}건</p>
              </div>
            </div>
          </div>
          {/* 총 수량 카드 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ShoppingCart size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">총 수량</p>
                <p className="text-2xl font-bold text-blue-600">{totalSummary.totalQuantity.toLocaleString()}개</p>
              </div>
            </div>
          </div>
          {/* 총 금액 카드 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Banknote size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">총 금액</p>
                <p className="text-2xl font-bold text-green-600">{formatPrice(totalSummary.totalAmount)}</p>
              </div>
            </div>
          </div>
          {/* 도매처 수 카드 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Store size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">도매처</p>
                <p className="text-2xl font-bold text-purple-600">{summaries.length}곳</p>
              </div>
            </div>
          </div>
          {/* 자동 발주 설정 카드 */}
          <button
            onClick={() => setShowScheduleModal(true)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Clock size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">자동 발주</p>
                <p className="text-lg font-bold text-gray-700">설정하기</p>
              </div>
            </div>
          </button>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600">발주일</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700"
              />
              {loading && <Loading />}
            </div>
          </div>
        </div>

        {/* 발주 누락 경고 배너 */}
        {missedOrders && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">발주 누락 주문이 있습니다</h3>
                <p className="text-sm text-amber-700 mt-1">
                  {missedOrders.oldestDate === missedOrders.newestDate ? (
                    <>{missedOrders.oldestDate}에 결제되었지만 아직 발주되지 않은 주문이 <span className="font-bold">{missedOrders.count}건</span> 있습니다.</>
                  ) : (
                    <>{missedOrders.oldestDate} ~ {missedOrders.newestDate} 기간에 결제되었지만 아직 발주되지 않은 주문이 <span className="font-bold">{missedOrders.count}건</span> 있습니다.</>
                  )}
                </p>
                <button
                  onClick={() => setSelectedDate(missedOrders.oldestDate)}
                  className="mt-2 text-sm font-medium text-amber-800 hover:text-amber-900 underline"
                >
                  {missedOrders.oldestDate} 주문 보기 →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 도매처별 카드 */}
        {!loading && summaries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Truck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">해당 날짜에 발주 대상 주문이 없습니다.</p>
            <p className="text-gray-400 text-sm mt-1">결제 완료(PAID) 주문만 표시됩니다.</p>
          </div>
        ) : !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {summaries.map((summary) => (
              <div
                key={summary.wholesaleChannelId}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                  selectedChannel?.wholesaleChannelId === summary.wholesaleChannelId
                    ? 'border-gray-400 ring-1 ring-gray-300'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedChannel(summary)}
              >
                {/* 썸네일 영역 */}
                <div className="relative h-36 bg-gray-100">
                  {summary.wholesaleChannelCoverUrl ? (
                    <img
                      src={summary.wholesaleChannelCoverUrl}
                      alt={summary.wholesaleChannelName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Store size={48} className="text-gray-300" />
                    </div>
                  )}
                  {/* 도매처명 오버레이 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <h3 className="font-semibold text-white truncate">{summary.wholesaleChannelName}</h3>
                  </div>
                </div>
                {/* 정보 영역 */}
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-gray-50 rounded-lg py-2">
                      <p className="text-xs text-gray-500">주문</p>
                      <p className="font-bold text-gray-900">{summary.totalOrders}건</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-2">
                      <p className="text-xs text-gray-500">수량</p>
                      <p className="font-bold text-gray-900">{summary.totalQuantity}개</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-2">
                      <p className="text-xs text-gray-500">금액</p>
                      <p className="font-bold text-gray-700 text-sm">{formatPrice(summary.totalAmount)}</p>
                    </div>
                  </div>
                  <button
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadExcel(summary.wholesaleChannelId, summary.wholesaleChannelName)
                    }}
                  >
                    <Download size={14} />
                    발주서 다운로드
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 상세 모달 */}
        {selectedChannel && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-10 md:p-16">
            <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              {/* 모달 헤더 */}
              <div className="px-8 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center gap-4">
                  {selectedChannel.wholesaleChannelCoverUrl ? (
                    <img
                      src={selectedChannel.wholesaleChannelCoverUrl}
                      alt={selectedChannel.wholesaleChannelName}
                      className="w-12 h-12 rounded-xl object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200">
                      <Store size={24} className="text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedChannel.wholesaleChannelName}</h2>
                    <p className="text-sm text-gray-500">{selectedDate} 발주 상세</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-lg transition-colors shadow-sm"
                    onClick={() => downloadExcel(selectedChannel.wholesaleChannelId, selectedChannel.wholesaleChannelName)}
                  >
                    <Download size={16} />
                    엑셀 다운로드
                  </button>
                  <button
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => markAsShipped(selectedChannel.wholesaleChannelId, false)}
                    disabled={isUpdatingStatus || selectedOrders.size === 0}
                  >
                    <CheckCircle size={16} />
                    {isUpdatingStatus ? '처리중...' : `선택 발주완료 (${selectedOrders.size})`}
                  </button>
                  <button
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => markAsShipped(selectedChannel.wholesaleChannelId, true)}
                    disabled={isUpdatingStatus}
                  >
                    <Truck size={16} />
                    {isUpdatingStatus ? '처리중...' : '전체 발주완료'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedChannel(null)
                      setOrderItems(null)
                      setSelectedOrders(new Map())
                    }}
                    className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X size={22} className="text-gray-500" />
                  </button>
                </div>
              </div>

              {/* 요약 */}
              {orderItems && (
                <div className="px-8 py-5 bg-gradient-to-br from-gray-50 to-gray-100/50 border-b border-gray-200">
                  <div className="grid grid-cols-3 gap-5">
                    <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-[38px] h-[38px] rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Package size={19} className="text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-500">총 수량</p>
                          <p className="text-2xl font-bold text-gray-900 truncate">{orderItems.summary.totalQuantity.toLocaleString()}개</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-[38px] h-[38px] rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                          <Banknote size={19} className="text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-500">총 금액</p>
                          <p className="text-2xl font-bold text-gray-900 truncate">{formatPrice(orderItems.summary.totalAmount)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-[38px] h-[38px] rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                          <ShoppingCart size={19} className="text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-500">주문 건수</p>
                          <p className="text-2xl font-bold text-gray-900 truncate">{orderItems.items.length}건</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 테이블 */}
              <div className="p-6">
                {detailLoading ? (
                  <div className="flex justify-center py-16">
                    <Loading />
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-center py-4 px-3 w-12">
                            <div className="flex flex-col items-center gap-1">
                              <input
                                type="checkbox"
                                checked={!!isAllSelected}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                title="전체 주문 선택"
                              />
                              <span className="text-[10px] text-gray-500">주문</span>
                            </div>
                          </th>
                          <th className="text-left py-4 px-5 text-sm font-semibold text-gray-700">상품명</th>
                          <th className="text-left py-4 px-5 text-sm font-semibold text-gray-700">옵션</th>
                          <th className="text-right py-4 px-5 text-sm font-semibold text-gray-700">수량</th>
                          <th className="text-right py-4 px-5 text-sm font-semibold text-gray-700">단가</th>
                          <th className="text-right py-4 px-5 text-sm font-semibold text-gray-700">금액</th>
                          <th className="text-left py-4 px-5 text-sm font-semibold text-gray-700">고객명</th>
                          <th className="text-left py-4 px-5 text-sm font-semibold text-gray-700">연락처</th>
                          <th className="text-left py-4 px-5 text-sm font-semibold text-gray-700">주소</th>
                          <th className="text-left py-4 px-5 text-sm font-semibold text-gray-700">주문일시</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 실제 데이터 행 */}
                        {orderItems?.items.map((item, idx) => {
                          const orderKey = `${item.orderId}-${item.isMember}`
                          const itemKey = `${item.orderItemId}`
                          const colorIndex = orderColorMap.get(orderKey) ?? 0
                          const colors = ORDER_COLORS[colorIndex]
                          const metadata = orderMetadata.get(itemKey)
                          const isFirstInGroup = metadata?.isFirst || false
                          const isSelected = selectedOrders.has(orderKey)

                          return (
                            <>
                              {/* 주문 헤더 행 (그룹의 첫 번째 아이템일 때만 표시) - 체크박스 포함 */}
                              {isFirstInGroup && (
                                <tr key={`header-${item.orderId}-${item.isMember}`} className={`bg-gray-100/50 border-b border-gray-200 ${isSelected ? 'bg-blue-100/50' : ''}`}>
                                  <td className={`py-2 px-3 border-l-4 ${colors.border}`}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleOrderSelection(item)}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                    />
                                  </td>
                                  <td colSpan={9} className="py-2 px-2">
                                    <div className="flex items-center gap-4 text-xs">
                                      <span className="font-semibold text-gray-700">
                                        주문번호: {metadata?.orderNumber}
                                      </span>
                                      <span className="text-gray-500">
                                        주문일시: {formatDate(metadata?.orderedAt || '')}
                                      </span>
                                      <span className="text-gray-500">
                                        {metadata?.itemCount}개 상품
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {/* 실제 상품 행 - 체크박스 없음 */}
                              <tr
                                key={item.orderItemId}
                                className={`
                                  border-b border-gray-100
                                  ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}
                                  ${isSelected ? 'bg-blue-50' : colors.bg}
                                  ${`border-l-4 ${colors.border}`}
                                `}
                              >
                                <td className="py-4 px-3"></td>
                                <td className="py-4 px-5 text-sm text-gray-900 max-w-[200px] truncate" title={item.productName}>
                                  {item.productName}
                                </td>
                                <td className="py-4 px-5">
                                  <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md">
                                    {item.optionSummary || '-'}
                                  </span>
                                </td>
                                <td className="py-4 px-5 text-sm text-right font-medium text-gray-900">{item.quantity}</td>
                                <td className="py-4 px-5 text-sm text-right text-gray-600">{formatPrice(item.wholesalePrice)}</td>
                                <td className="py-4 px-5 text-sm text-right font-semibold text-gray-900">{formatPrice(item.totalAmount)}</td>
                                <td className="py-4 px-5 text-sm text-gray-900">{item.customerName}</td>
                                <td className="py-4 px-5 text-sm text-gray-600">{formatPhoneNumber(item.customerPhone)}</td>
                                <td className="py-4 px-5 text-sm text-gray-600 max-w-[220px] truncate" title={item.customerAddress}>
                                  {item.customerAddress}
                                </td>
                                <td className="py-4 px-5 text-sm text-gray-500 whitespace-nowrap">{formatDate(item.orderedAt)}</td>
                              </tr>
                            </>
                          )
                        })}
                        {/* 빈 행 (최소 10행 유지) */}
                        {Array.from({ length: Math.max(0, 10 - (orderItems?.items.length || 0)) }).map((_, idx) => (
                          <tr key={`empty-${idx}`} className={`border-b border-gray-100 ${(orderItems?.items.length || 0) + idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                            <td className="py-4 px-3"></td>
                            <td className="py-4 px-5 text-sm text-gray-400">{!orderItems?.items.length && idx === 4 ? '데이터가 없습니다' : ''}</td>
                            <td className="py-4 px-5"></td>
                            <td className="py-4 px-5"></td>
                            <td className="py-4 px-5"></td>
                            <td className="py-4 px-5"></td>
                            <td className="py-4 px-5"></td>
                            <td className="py-4 px-5"></td>
                            <td className="py-4 px-5"></td>
                            <td className="py-4 px-5"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 페이지네이션 - 항상 표시 */}
              <div className="px-8 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {orderItems ? (
                    <>
                      총 <span className="font-semibold text-gray-900">{orderItems.pagination.total}건</span>
                      {orderItems.pagination.total > 0 && (
                        <> 중 <span className="font-medium">{(detailPage - 1) * 10 + 1}-{Math.min(detailPage * 10, orderItems.pagination.total)}건</span></>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400">로딩 중...</span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchDetails(selectedChannel.wholesaleChannelId, detailPage - 1)}
                    disabled={!orderItems || detailPage === 1}
                    className="p-2.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg min-w-[80px] text-center">
                    {orderItems ? `${detailPage} / ${Math.max(1, orderItems.pagination.totalPages)}` : '- / -'}
                  </span>
                  <button
                    onClick={() => fetchDetails(selectedChannel.wholesaleChannelId, detailPage + 1)}
                    disabled={!orderItems || detailPage >= orderItems.pagination.totalPages}
                    className="p-2.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 자동 발주 설정 모달 */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Settings size={20} className="text-gray-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">자동 발주 설정</h2>
                </div>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    자동 발주서 발송 시간
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    매일 지정된 시간에 해당 날짜의 발주서가 자동으로 생성됩니다.
                  </p>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-lg"
                  />
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Clock size={18} className="text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">현재 설정</p>
                      <p className="text-sm text-gray-600">
                        매일 <span className="font-bold">{scheduleTime}</span>에 발주서 자동 생성
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    toast.success(`자동 발주 시간이 ${scheduleTime}로 설정되었습니다.`)
                    setShowScheduleModal(false)
                  }}
                  className="flex-1 py-3 text-white bg-gray-800 hover:bg-gray-900 rounded-lg font-medium transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
