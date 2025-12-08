'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Store,
  Calendar,
  Package,
  ShoppingCart,
  Banknote,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Download,
  ArrowLeft,
  BarChart3,
  FileText,
  X,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

interface WholesaleChannel {
  id: number
  name: string
  coverUrl: string | null
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

interface WholesaleOrderItem {
  orderItemId: number
  orderNumber: string
  orderedAt: string
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

export default function WholesaleOrderHistoryPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState<WholesaleChannel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [history, setHistory] = useState<DailyHistory[]>([])
  const [summary, setSummary] = useState<HistorySummary | null>(null)

  // 기간 필터 (기본: 최근 30일)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // 상세 모달 상태
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [orderItems, setOrderItems] = useState<OrderItemsResponse | null>(null)
  const [detailPage, setDetailPage] = useState(1)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedChannelId) {
        params.set('wholesaleChannelId', selectedChannelId.toString())
      }
      params.set('from', fromDate)
      params.set('to', toDate)

      const res = await fetch(`/api/admin/wholesale-orders/history?${params}`)
      const data = await res.json()

      if (data.success) {
        setChannels(data.channels || [])
        setHistory(data.history || [])
        setSummary(data.summary || null)
      } else {
        toast.error(data.error || '발주 이력 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('발주 이력 조회 실패:', error)
      toast.error('발주 이력 조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [selectedChannelId, fromDate, toDate])

  // 상세 조회
  const fetchDetails = useCallback(async (date: string, page: number = 1) => {
    if (!selectedChannelId) return

    setDetailLoading(true)
    try {
      const params = new URLSearchParams({
        from: date,
        to: date,
        page: page.toString(),
        limit: '50',
      })

      const res = await fetch(`/api/admin/wholesale-orders/${selectedChannelId}/items?${params}`)
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
  }, [selectedChannelId])

  // 엑셀 다운로드
  const downloadExcel = async (date: string) => {
    if (!selectedChannelId || !selectedChannel) return

    try {
      const params = new URLSearchParams({
        from: date,
        to: date,
      })

      const res = await fetch(`/api/admin/wholesale-orders/${selectedChannelId}/export?${params}`)

      if (!res.ok) {
        toast.error('엑셀 다운로드에 실패했습니다.')
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `발주서_${selectedChannel.name}_${date}.xlsx`
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

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // 모달 열기
  const openModal = (date: string) => {
    setModalDate(date)
    fetchDetails(date, 1)
  }

  // 모달 닫기
  const closeModal = () => {
    setModalDate(null)
    setOrderItems(null)
    setDetailPage(1)
  }

  const formatPrice = (price: number) => {
    return `₩${price.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const selectedChannel = channels.find(c => c.id === selectedChannelId)

  // 일별 평균 계산
  const dailyAverage = history.length > 0 && summary ? {
    orders: Math.round(summary.totalOrders / history.length * 10) / 10,
    quantity: Math.round(summary.totalQuantity / history.length * 10) / 10,
    amount: Math.round(summary.totalAmount / history.length),
  } : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/shop/wholesale-orders">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={16} />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">발주 이력</h1>
          </div>
          <p className="text-gray-600 ml-11">
            도매처별 발주 내역을 기간별로 조회합니다.
          </p>
        </div>

        {/* 필터 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* 도매처 선택 */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                도매처
              </label>
              <select
                value={selectedChannelId || ''}
                onChange={(e) => setSelectedChannelId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <option value="">도매처를 선택하세요</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 시작일 */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                시작일
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>

            {/* 종료일 */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                종료일
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>

            {/* 빠른 선택 */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const d = new Date()
                  d.setDate(d.getDate() - 7)
                  setFromDate(d.toISOString().split('T')[0])
                  setToDate(new Date().toISOString().split('T')[0])
                }}
                className="px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                7일
              </button>
              <button
                onClick={() => {
                  const d = new Date()
                  d.setDate(d.getDate() - 30)
                  setFromDate(d.toISOString().split('T')[0])
                  setToDate(new Date().toISOString().split('T')[0])
                }}
                className="px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                30일
              </button>
              <button
                onClick={() => {
                  const d = new Date()
                  d.setDate(d.getDate() - 90)
                  setFromDate(d.toISOString().split('T')[0])
                  setToDate(new Date().toISOString().split('T')[0])
                }}
                className="px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                90일
              </button>
            </div>
          </div>
        </div>

        {/* 도매처 미선택 시 */}
        {!selectedChannelId && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="text-center mb-8">
              <Store size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">도매처를 선택하여 발주 이력을 조회하세요.</p>
            </div>

            {/* 도매처 카드 목록 */}
            {channels.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-4xl mx-auto">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannelId(channel.id)}
                    className="bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-xl p-4 transition-all text-center"
                  >
                    <div className="w-16 h-16 mx-auto mb-3 rounded-lg bg-gray-200 overflow-hidden">
                      {channel.coverUrl ? (
                        <img
                          src={channel.coverUrl}
                          alt={channel.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Store size={24} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 truncate">{channel.name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex justify-center">
            <Loading />
          </div>
        )}

        {/* 도매처 선택됨 */}
        {selectedChannelId && !loading && (
          <>
            {/* 선택된 도매처 정보 + 통계 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              {/* 도매처 정보 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {selectedChannel?.coverUrl ? (
                      <img
                        src={selectedChannel.coverUrl}
                        alt={selectedChannel.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store size={20} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">도매처</p>
                    <p className="font-bold text-gray-900">{selectedChannel?.name}</p>
                  </div>
                </div>
              </div>

              {/* 총 주문 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Package size={24} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">총 주문</p>
                    <p className="text-2xl font-bold text-gray-900">{summary?.totalOrders || 0}건</p>
                  </div>
                </div>
              </div>

              {/* 총 수량 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <ShoppingCart size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">총 수량</p>
                    <p className="text-2xl font-bold text-blue-600">{summary?.totalQuantity.toLocaleString() || 0}개</p>
                  </div>
                </div>
              </div>

              {/* 총 금액 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Banknote size={24} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">총 금액</p>
                    <p className="text-2xl font-bold text-green-600">{formatPrice(summary?.totalAmount || 0)}</p>
                  </div>
                </div>
              </div>

              {/* 일 평균 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <TrendingUp size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">일 평균</p>
                    <p className="text-2xl font-bold text-purple-600">{formatPrice(dailyAverage?.amount || 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 일별 이력 테이블 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={20} className="text-gray-500" />
                  <h2 className="font-semibold text-gray-900">일별 발주 이력</h2>
                  <span className="text-sm text-gray-500">({history.length}일)</span>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="p-12 text-center">
                  <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">해당 기간에 발주 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">주문 수</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">상품 수</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">총 수량</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">발주 금액</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">상세</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {history.map((day) => (
                        <tr key={day.date} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <span className="font-medium text-gray-900">{formatDate(day.date)}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                              {day.orderCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center text-gray-600">{day.itemCount}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-medium text-gray-900">{day.totalQuantity.toLocaleString()}개</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-gray-900">{formatPrice(day.totalAmount)}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => openModal(day.date)}
                              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                            >
                              <FileText size={16} />
                              발주서
                              <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* 합계 */}
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td className="px-6 py-4 font-bold text-gray-900">합계</td>
                        <td className="px-6 py-4 text-center font-bold text-gray-900">{summary?.totalOrders}</td>
                        <td className="px-6 py-4 text-center font-bold text-gray-900">{summary?.totalItems}</td>
                        <td className="px-6 py-4 text-center font-bold text-gray-900">{summary?.totalQuantity.toLocaleString()}개</td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900">{formatPrice(summary?.totalAmount || 0)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 상세 모달 */}
      {modalDate && selectedChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* 모달 헤더 */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedChannel.name}</h2>
                <p className="text-sm text-gray-500">{modalDate} 발주 상세</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                  onClick={() => downloadExcel(modalDate)}
                >
                  <Download size={16} />
                  엑셀 다운로드
                </button>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 요약 */}
            {orderItems && (
              <div className="px-6 py-3 bg-gray-100 border-b border-gray-200 flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">총 수량:</span>
                  <span className="font-bold text-gray-900">{orderItems.summary.totalQuantity.toLocaleString()}개</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">총 금액:</span>
                  <span className="font-bold text-gray-900">{formatPrice(orderItems.summary.totalAmount)}</span>
                </div>
              </div>
            )}

            {/* 테이블 */}
            <div className="flex-1 overflow-auto">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <Loading />
                </div>
              ) : orderItems && orderItems.items.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">옵션</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">수량</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">단가</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">공급가액</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객명</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">연락처</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주소</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문일시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orderItems.items.map((item) => (
                      <tr key={item.orderItemId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate" title={item.productName}>
                          {item.productName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.optionSummary}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center font-medium">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatPrice(item.wholesalePrice)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{formatPrice(item.totalAmount)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.customerName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.customerPhone}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[250px] truncate" title={item.customerAddress}>
                          {item.customerAddress}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(item.orderedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-gray-500">
                  주문 내역이 없습니다.
                </div>
              )}
            </div>

            {/* 페이지네이션 */}
            {orderItems && orderItems.pagination.totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  총 {orderItems.pagination.total}건 중 {(detailPage - 1) * 50 + 1}-{Math.min(detailPage * 50, orderItems.pagination.total)}건
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchDetails(modalDate, detailPage - 1)}
                    disabled={detailPage === 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-sm text-gray-600">
                    {detailPage} / {orderItems.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => fetchDetails(modalDate, detailPage + 1)}
                    disabled={detailPage === orderItems.pagination.totalPages}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
