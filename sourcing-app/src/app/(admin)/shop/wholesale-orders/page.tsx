'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Calendar,
  History,
  FileSpreadsheet,
} from 'lucide-react'
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
  orderId: number
  orderNumber: string
  orderedAt: string
  isMember: boolean
  retailChannelName: string
  productName: string
  optionSummary: string
  quantity: number
  productAmount: number  // 상품금액 (도매가 × 수량)
  shippingFee: number    // 배송비 (합배송 단위 계산)
  totalAmount: number    // 합산금액 (상품금액 + 배송비)
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

interface DailyHistory {
  date: string
  orderCount: number
  itemCount: number
  totalQuantity: number
  totalAmount: number
}

interface HistorySummary {
  totalOrders: number
  totalItems: number
  totalQuantity: number
  totalAmount: number
}

export default function WholesaleOrdersPage() {
  const toast = useToast()

  // 발주 대기 상태
  const [loading, setLoading] = useState(false)
  const [summaries, setSummaries] = useState<WholesaleSummary[]>([])
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('18:00')
  const [selectedChannel, setSelectedChannel] = useState<WholesaleSummary | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [orderItems, setOrderItems] = useState<OrderItemsResponse | null>(null)
  const [detailPage, setDetailPage] = useState(1)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<Map<string, { orderId: number; isMember: boolean }>>(new Map())

  // 발주 이력 상태 (모달 내)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState<DailyHistory[]>([])
  const [historySummary, setHistorySummary] = useState<HistorySummary | null>(null)
  const [historyDetailMap, setHistoryDetailMap] = useState<Map<string, WholesaleOrderItem[]>>(new Map())
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false)

  // 쇼핑몰 필터
  const [selectedShop, setSelectedShop] = useState<string>('all')

  // 쇼핑몰 목록 추출
  const shopList = useMemo(() => {
    if (!orderItems) return []
    const shops = new Set<string>()
    orderItems.items.forEach(item => {
      if (item.retailChannelName) {
        shops.add(item.retailChannelName)
      }
    })
    return Array.from(shops).sort()
  }, [orderItems])

  // 필터링된 아이템
  const filteredItems = useMemo(() => {
    if (!orderItems) return []
    if (selectedShop === 'all') return orderItems.items
    return orderItems.items.filter(item => item.retailChannelName === selectedShop)
  }, [orderItems, selectedShop])

  // 각 주문(orderId)에 색상 인덱스 할당
  const orderColorMap = useMemo(() => {
    if (!filteredItems.length) return new Map<string, number>()

    const uniqueOrders = new Map<string, number>()
    let colorIndex = 0

    filteredItems.forEach(item => {
      const key = `${item.orderId}-${item.isMember}`
      if (!uniqueOrders.has(key)) {
        uniqueOrders.set(key, colorIndex % ORDER_COLORS.length)
        colorIndex++
      }
    })

    return uniqueOrders
  }, [filteredItems])

  // 각 아이템이 그룹의 첫 번째인지 여부 및 주문 정보
  const orderMetadata = useMemo(() => {
    if (!filteredItems.length) return new Map<string, {
      isFirst: boolean
      itemCount: number
      orderNumber: string
      orderedAt: string
    }>()

    const metadata = new Map()
    const orderItemCounts = new Map<string, number>()
    const seenOrders = new Set<string>()

    filteredItems.forEach(item => {
      const orderKey = `${item.orderId}-${item.isMember}`
      orderItemCounts.set(orderKey, (orderItemCounts.get(orderKey) || 0) + 1)
    })

    filteredItems.forEach(item => {
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
  }, [filteredItems])

  // 발주 대기 집계 조회 (전체 기간)
  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/wholesale-orders/summary`)
      const data = await res.json()

      if (data.success) {
        setSummaries(data.data)
      } else {
        toast.error(data.error || '집계 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('집계 조회 실패:', error)
      toast.error('집계 조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  // 발주 대기 상세 조회 (전체 기간)
  const fetchDetails = useCallback(async (channelId: number, page: number = 1) => {
    setDetailLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '100',  // 전체 조회를 위해 limit 증가
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
  }, [toast])

  // 발주 이력 조회 (최근 30일)
  const fetchHistory = useCallback(async (channelId: number) => {
    setHistoryLoading(true)
    setHistoryDetailMap(new Map())
    try {
      const toDate = new Date().toISOString().split('T')[0]
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const params = new URLSearchParams({
        wholesaleChannelId: channelId.toString(),
        from: fromDate,
        to: toDate,
      })

      const res = await fetch(`/api/admin/wholesale-orders/history?${params}`)
      const data = await res.json()

      if (data.success) {
        const historyData = data.history || []
        setHistory(historyData)
        setHistorySummary(data.summary || null)

        // 모든 날짜의 상세 내역 조회
        if (historyData.length > 0) {
          setHistoryDetailLoading(true)
          const detailMap = new Map<string, WholesaleOrderItem[]>()

          await Promise.all(
            historyData.map(async (day: DailyHistory) => {
              try {
                const detailParams = new URLSearchParams({
                  from: day.date,
                  to: day.date,
                  page: '1',
                  limit: '100',
                  status: 'completed',
                })

                const detailRes = await fetch(`/api/admin/wholesale-orders/${channelId}/items?${detailParams}`)
                const detailData = await detailRes.json()

                if (detailData.success) {
                  detailMap.set(day.date, detailData.data.items || [])
                }
              } catch (error) {
                console.error(`이력 상세 조회 실패 (${day.date}):`, error)
              }
            })
          )

          setHistoryDetailMap(detailMap)
          setHistoryDetailLoading(false)
        }
      } else {
        toast.error(data.error || '발주 이력 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('발주 이력 조회 실패:', error)
      toast.error('발주 이력 조회에 실패했습니다.')
    } finally {
      setHistoryLoading(false)
    }
  }, [toast])


  const downloadExcel = async (channelId: number, channelName: string) => {
    try {
      const res = await fetch(`/api/admin/wholesale-orders/${channelId}/export`)

      if (!res.ok) {
        toast.error('엑셀 다운로드에 실패했습니다.')
        return
      }

      const today = new Date().toISOString().split('T')[0]
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `발주서_${channelName}_${today}.xlsx`
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

  const [isSyncingSheets, setIsSyncingSheets] = useState(false)
  const [sheetsSyncResult, setSheetsSyncResult] = useState<{ message: string; url: string } | null>(null)

  const syncToGoogleSheets = async (channelId: number, channelName: string) => {
    setIsSyncingSheets(true)
    try {
      const res = await fetch(`/api/admin/wholesale-orders/${channelId}/sync-sheets`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.error?.includes('설정')) {
          toast.error(data.error + ' 설정 > 구글 시트에서 설정하세요.')
        } else {
          toast.error(data.error || '구글 시트 동기화에 실패했습니다.')
        }
        return
      }

      // 성공 모달 표시
      setSheetsSyncResult({
        message: data.data.message,
        url: data.data.url,
      })
    } catch (error) {
      console.error('구글 시트 동기화 실패:', error)
      toast.error('구글 시트 동기화에 실패했습니다.')
    } finally {
      setIsSyncingSheets(false)
    }
  }

  const markAsShipped = async (channelId: number, markAll: boolean = false) => {
    setIsUpdatingStatus(true)
    try {
      let body: { markAll?: boolean; orderIds?: { memberIds?: number[]; guestIds?: number[] } } = {}

      if (markAll) {
        body = { markAll: true }
      } else {
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

      const res = await fetch(`/api/admin/wholesale-orders/${channelId}/mark-shipped`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        toast.success(`${data.updatedCount}건의 주문이 발주 완료(상품 준비) 처리되었습니다.`)
        setSelectedOrders(new Map())
        fetchSummary()
        if (selectedChannel) {
          fetchDetails(selectedChannel.wholesaleChannelId, 1)
          fetchHistory(selectedChannel.wholesaleChannelId)
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

  const toggleSelectAll = () => {
    if (!filteredItems.length) return

    const allSelected = filteredItems.every((item) => selectedOrders.has(`${item.orderId}-${item.isMember}`))

    if (allSelected) {
      // 필터링된 아이템만 해제
      setSelectedOrders((prev) => {
        const next = new Map(prev)
        filteredItems.forEach((item) => {
          next.delete(`${item.orderId}-${item.isMember}`)
        })
        return next
      })
    } else {
      // 필터링된 아이템만 선택
      setSelectedOrders((prev) => {
        const next = new Map(prev)
        filteredItems.forEach((item) => {
          const key = `${item.orderId}-${item.isMember}`
          next.set(key, { orderId: item.orderId, isMember: item.isMember })
        })
        return next
      })
    }
  }

  const isAllSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedOrders.has(`${item.orderId}-${item.isMember}`))

  // Effects
  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    if (selectedChannel) {
      fetchDetails(selectedChannel.wholesaleChannelId, 1)
      fetchHistory(selectedChannel.wholesaleChannelId)
      setSelectedShop('all') // 쇼핑몰 필터 초기화
    }
  }, [selectedChannel, fetchDetails, fetchHistory])

  // 포맷 함수들
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

  const formatDateKorean = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">발주 관리</h1>
          <p className="text-gray-600">
            결제 완료(PAID) 주문을 도매처별로 집계하고 발주서를 생성합니다.
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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

        {/* 로딩 표시 */}
        {loading && (
          <div className="flex justify-center mb-6">
            <Loading />
          </div>
        )}


        {/* 도매처별 카드 */}
        {!loading && summaries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Truck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">해당 날짜에 발주 대상 주문이 없습니다.</p>
            <p className="text-gray-400 text-sm mt-1">결제 완료 상태의 주문만 표시됩니다.</p>
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
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <h3 className="font-semibold text-white truncate">{summary.wholesaleChannelName}</h3>
                  </div>
                </div>
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
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 md:p-8">
            <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
              {/* 모달 헤더 */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
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
                    <p className="text-sm text-gray-500">발주 현황</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedChannel(null)
                    setOrderItems(null)
                    setSelectedOrders(new Map())
                    setHistory([])
                    setHistorySummary(null)
                  }}
                  className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={22} className="text-gray-500" />
                </button>
              </div>

              {/* 모달 컨텐츠 - 스크롤 영역 */}
              <div className="flex-1 overflow-y-auto">
                {/* 발주 대기 섹션 */}
                <div className="border-b border-gray-200">
                  <div className="px-6 py-4 bg-orange-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Package size={20} className="text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">발주 대기</h3>
                        <p className="text-sm text-gray-500">결제 완료 주문</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-lg transition-colors"
                        onClick={() => downloadExcel(selectedChannel.wholesaleChannelId, selectedChannel.wholesaleChannelName)}
                      >
                        <Download size={16} />
                        엑셀
                      </button>
                      <button
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => syncToGoogleSheets(selectedChannel.wholesaleChannelId, selectedChannel.wholesaleChannelName)}
                        disabled={isSyncingSheets}
                      >
                        <FileSpreadsheet size={16} />
                        {isSyncingSheets ? '동기화 중...' : '구글시트'}
                      </button>
                      <button
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => markAsShipped(selectedChannel.wholesaleChannelId, false)}
                        disabled={isUpdatingStatus || selectedOrders.size === 0}
                      >
                        <CheckCircle size={16} />
                        {isUpdatingStatus ? '처리중...' : `선택 완료 (${selectedOrders.size})`}
                      </button>
                      <button
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => markAsShipped(selectedChannel.wholesaleChannelId, true)}
                        disabled={isUpdatingStatus || !orderItems?.items.length}
                      >
                        <Truck size={16} />
                        {isUpdatingStatus ? '처리중...' : '전체 완료'}
                      </button>
                    </div>
                  </div>

                  {/* 발주 대기 요약 */}
                  {orderItems && (
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">주문:</span>
                            <span className="font-bold text-gray-900">{filteredItems.length}건</span>
                            {selectedShop !== 'all' && (
                              <span className="text-xs text-gray-400">(전체 {orderItems.pagination.total}건)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">수량:</span>
                            <span className="font-bold text-gray-900">
                              {filteredItems.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}개
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">금액:</span>
                            <span className="font-bold text-gray-900">
                              {formatPrice(filteredItems.reduce((sum, item) => sum + item.totalAmount, 0))}
                            </span>
                          </div>
                        </div>
                        {/* 쇼핑몰 필터 */}
                        {shopList.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">쇼핑몰:</span>
                            <select
                              value={selectedShop}
                              onChange={(e) => setSelectedShop(e.target.value)}
                              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                            >
                              <option value="all">전체 ({orderItems.items.length})</option>
                              {shopList.map((shop) => (
                                <option key={shop} value={shop}>
                                  {shop} ({orderItems.items.filter(i => i.retailChannelName === shop).length})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 발주 대기 테이블 */}
                  <div className="px-6 py-4">
                    {detailLoading ? (
                      <div className="flex justify-center py-8">
                        <Loading />
                      </div>
                    ) : filteredItems.length > 0 ? (
                      <>
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-center py-3 px-3 w-10">
                                  <input
                                    type="checkbox"
                                    checked={!!isAllSelected}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                  />
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">주문일시</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">쇼핑몰</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">상품명</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">옵션</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600">수량</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600">상품금액</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600">배송비</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600">합계</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">고객</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">연락처</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">주소</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredItems.map((item, idx) => {
                                const orderKey = `${item.orderId}-${item.isMember}`
                                const itemKey = `${item.orderItemId}`
                                const colorIndex = orderColorMap.get(orderKey) ?? 0
                                const colors = ORDER_COLORS[colorIndex]
                                const metadata = orderMetadata.get(itemKey)
                                const isFirstInGroup = metadata?.isFirst || false
                                const isSelected = selectedOrders.has(orderKey)

                                return (
                                  <tr
                                    key={item.orderItemId}
                                    className={`border-b border-gray-100 ${isSelected ? 'bg-blue-50' : colors.bg} border-l-4 ${colors.border}`}
                                  >
                                    <td className="py-3 px-3 text-center">
                                      {isFirstInGroup && (
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleOrderSelection(item)}
                                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                        />
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                                      {formatDate(item.orderedAt)}
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                        {item.retailChannelName || '-'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-900 max-w-[160px] truncate" title={item.productName}>
                                      {item.productName}
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                                        {item.optionSummary || '-'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">{item.quantity}</td>
                                    <td className="py-3 px-4 text-sm text-right text-gray-900">{formatPrice(item.productAmount)}</td>
                                    <td className="py-3 px-4 text-sm text-right text-orange-600">{item.shippingFee > 0 ? formatPrice(item.shippingFee) : '-'}</td>
                                    <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900">{formatPrice(item.totalAmount)}</td>
                                    <td className="py-3 px-4 text-sm text-gray-900">{item.customerName}</td>
                                    <td className="py-3 px-4 text-sm text-gray-600">{formatPhoneNumber(item.customerPhone)}</td>
                                    <td className="py-3 px-4 text-sm text-gray-600 max-w-[180px] truncate" title={item.customerAddress}>
                                      {item.customerAddress}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* 페이지네이션 */}
                        {orderItems && orderItems.pagination.totalPages > 1 && (
                          <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                              총 {orderItems.pagination.total}건 중 {(detailPage - 1) * 10 + 1}-{Math.min(detailPage * 10, orderItems.pagination.total)}건
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => fetchDetails(selectedChannel.wholesaleChannelId, detailPage - 1)}
                                disabled={detailPage === 1}
                                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <span className="px-3 py-1 text-sm text-gray-700">
                                {detailPage} / {orderItems.pagination.totalPages}
                              </span>
                              <button
                                onClick={() => fetchDetails(selectedChannel.wholesaleChannelId, detailPage + 1)}
                                disabled={detailPage >= orderItems.pagination.totalPages}
                                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        발주 대기 주문이 없습니다.
                      </div>
                    )}
                  </div>
                </div>

                {/* 발주 완료 이력 섹션 */}
                <div>
                  <div className="px-6 py-4 bg-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <History size={20} className="text-green-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900">발주 완료 이력</h3>
                        <p className="text-sm text-gray-500">최근 30일 발주 완료 내역 (상품 준비 이상)</p>
                      </div>
                      {historySummary && (
                        <div className="flex items-center gap-4 ml-4 text-sm">
                          <span className="text-gray-500">총 <span className="font-bold text-gray-900">{historySummary.totalOrders}건</span></span>
                          <span className="text-gray-500"><span className="font-bold text-gray-900">{formatPrice(historySummary.totalAmount)}</span></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-gray-50">
                    {historyLoading ? (
                      <div className="flex justify-center py-8">
                        <Loading />
                      </div>
                    ) : history.length > 0 ? (
                      <div className="space-y-4">
                        {history.map((day) => {
                          const dayItems = historyDetailMap.get(day.date) || []

                          return (
                            <div key={day.date} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              {/* 날짜 헤더 */}
                              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-gray-400" />
                                    <span className="font-medium text-gray-900">{formatDateKorean(day.date)}</span>
                                  </div>
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{day.orderCount}건</span>
                                  <span className="text-sm text-gray-500">{day.totalQuantity}개</span>
                                </div>
                                <span className="font-bold text-gray-900">{formatPrice(day.totalAmount)}</span>
                              </div>

                              {/* 상세 내역 테이블 */}
                              <div className="p-4">
                                {historyDetailLoading ? (
                                  // 1. 로딩 중
                                  <div className="flex justify-center py-4">
                                    <Loading />
                                  </div>
                                ) : dayItems.length > 0 ? (
                                  // 2. 데이터 있음 → 테이블 표시
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="text-xs text-gray-500 border-b border-gray-200">
                                          <th className="text-left py-2 px-3">쇼핑몰</th>
                                          <th className="text-left py-2 px-3">상품명</th>
                                          <th className="text-left py-2 px-3">옵션</th>
                                          <th className="text-right py-2 px-3">수량</th>
                                          <th className="text-right py-2 px-3">상품금액</th>
                                          <th className="text-right py-2 px-3">배송비</th>
                                          <th className="text-right py-2 px-3">합계</th>
                                          <th className="text-left py-2 px-3">고객</th>
                                          <th className="text-left py-2 px-3">연락처</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {dayItems.map((item) => (
                                          <tr key={item.orderItemId} className="border-b border-gray-100">
                                            <td className="py-2 px-3">
                                              <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                                {item.retailChannelName || '-'}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 text-gray-900 max-w-[150px] truncate">{item.productName}</td>
                                            <td className="py-2 px-3 text-gray-600">{item.optionSummary || '-'}</td>
                                            <td className="py-2 px-3 text-right font-medium">{item.quantity}</td>
                                            <td className="py-2 px-3 text-right">{formatPrice(item.productAmount)}</td>
                                            <td className="py-2 px-3 text-right text-orange-600">{item.shippingFee > 0 ? formatPrice(item.shippingFee) : '-'}</td>
                                            <td className="py-2 px-3 text-right font-medium">{formatPrice(item.totalAmount)}</td>
                                            <td className="py-2 px-3 text-gray-900">{item.customerName}</td>
                                            <td className="py-2 px-3 text-gray-600">{formatPhoneNumber(item.customerPhone)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  // 3. 로딩 완료 + 데이터 없음 → 빈 상태
                                  <p className="text-center text-gray-400 py-2 text-sm">해당 날짜에 상세 내역이 없습니다.</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        최근 30일간 발주 완료 내역이 없습니다.
                      </div>
                    )}
                  </div>
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

        {/* 구글 시트 동기화 성공 모달 */}
        {sheetsSyncResult && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <FileSpreadsheet size={24} className="text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">동기화 완료</h3>
                  <p className="text-sm text-gray-500">{sheetsSyncResult.message}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSheetsSyncResult(null)}
                  className="flex-1 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  닫기
                </button>
                <button
                  onClick={() => {
                    window.open(sheetsSyncResult.url, '_blank')
                    setSheetsSyncResult(null)
                  }}
                  className="flex-1 py-3 text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet size={18} />
                  시트 열기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
