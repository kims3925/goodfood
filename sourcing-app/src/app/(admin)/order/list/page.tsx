'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  Filter,
  ShoppingBag,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  Package,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

type OrderSource = 'SHOPPING_MALL' | 'GOOGLE_FORM'

interface UnifiedOrder {
  id: number
  source: OrderSource
  orderNumber: string
  customerName: string
  customerPhone: string | null
  productSummary: string
  itemCount: number
  totalAmount: number
  status: string
  statusLabel: string
  createdAt: string
  address?: string
  deliveryMemo?: string
}

type SourceFilter = 'ALL' | 'SHOPPING_MALL' | 'GOOGLE_FORM'

export default function UnifiedOrderListPage() {
  const toast = useToast()
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // 상세 보기 모달
  const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null)

  const itemsPerPage = 20

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      })

      if (search) params.set('search', search)
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter)

      const res = await fetch(`/api/order/unified?${params}`)
      const data = await res.json()

      if (data.success) {
        setOrders(data.data.orders)
        setTotalPages(data.data.pagination.totalPages)
        setTotal(data.data.pagination.total)
      } else {
        toast.error('주문 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('주문 로드 실패:', error)
      toast.error('주문 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [page, search, sourceFilter, toast])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleSearch = () => {
    setPage(1)
    fetchOrders()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatPrice = (price: number) => {
    return `${price.toLocaleString()}원`
  }

  const getSourceBadge = (source: OrderSource) => {
    if (source === 'SHOPPING_MALL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <ShoppingBag size={12} />
          쇼핑몰
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <FileSpreadsheet size={12} />
        밴드주문
      </span>
    )
  }

  const getStatusBadge = (status: string, statusLabel: string) => {
    const colorMap: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      PAID: 'bg-blue-100 text-blue-700',
      PREPARING: 'bg-purple-100 text-purple-700',
      SHIPPED: 'bg-indigo-100 text-indigo-700',
      DELIVERED: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-red-100 text-red-700',
      REFUNDED: 'bg-gray-100 text-gray-700',
      RECEIVED: 'bg-teal-100 text-teal-700',
    }

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorMap[status] || 'bg-gray-100 text-gray-700'}`}>
        {statusLabel}
      </span>
    )
  }

  // 통계 계산
  const shopMallCount = orders.filter(o => o.source === 'SHOPPING_MALL').length
  const bandOrderCount = orders.filter(o => o.source === 'GOOGLE_FORM').length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">주문 목록</h1>
          <p className="text-gray-600">
            쇼핑몰 주문과 밴드(구글폼) 주문을 통합하여 관리합니다.
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Package size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 주문</p>
                <p className="text-2xl font-bold text-gray-900">{total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ShoppingBag size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">쇼핑몰 주문</p>
                <p className="text-2xl font-bold text-blue-600">{shopMallCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <FileSpreadsheet size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">밴드 주문</p>
                <p className="text-2xl font-bold text-green-600">{bandOrderCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* 검색 */}
              <div className="flex gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <Input
                    type="text"
                    placeholder="주문번호, 고객명, 연락처 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
              </div>

              {/* 필터 & 새로고침 */}
              <div className="flex gap-2 items-center">
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => { setSourceFilter('ALL'); setPage(1) }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      sourceFilter === 'ALL'
                        ? 'bg-white shadow-sm text-gray-900'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => { setSourceFilter('SHOPPING_MALL'); setPage(1) }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                      sourceFilter === 'SHOPPING_MALL'
                        ? 'bg-white shadow-sm text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <ShoppingBag size={14} />
                    쇼핑몰
                  </button>
                  <button
                    onClick={() => { setSourceFilter('GOOGLE_FORM'); setPage(1) }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                      sourceFilter === 'GOOGLE_FORM'
                        ? 'bg-white shadow-sm text-green-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FileSpreadsheet size={14} />
                    밴드
                  </button>
                </div>

                <Button
                  variant="secondary"
                  onClick={fetchOrders}
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  새로고침
                </Button>
              </div>
            </div>
          </div>

          {/* 테이블 */}
          {loading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[8%]">출처</TableHead>
                  <TableHead className="w-[12%]">주문번호</TableHead>
                  <TableHead className="w-[10%]">고객명</TableHead>
                  <TableHead className="w-[25%]">상품</TableHead>
                  <TableHead className="w-[10%]">금액</TableHead>
                  <TableHead className="w-[10%]">상태</TableHead>
                  <TableHead className="w-[15%]">주문일시</TableHead>
                  <TableHead className="w-[10%]">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableEmpty message="주문이 없습니다." />
                ) : (
                  orders.map((order) => (
                    <TableRow key={`${order.source}-${order.id}`} className="hover:bg-gray-50">
                      <TableCell>{getSourceBadge(order.source)}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-gray-900">
                          {order.orderNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">{order.customerName}</div>
                          {order.customerPhone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone size={10} />
                              {order.customerPhone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900 truncate max-w-[250px]">
                          {order.productSummary}
                        </div>
                        {order.itemCount > 1 && (
                          <div className="text-xs text-gray-500">
                            총 {order.itemCount}개 상품
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-gray-900">
                          {formatPrice(order.totalAmount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(order.status, order.statusLabel)}
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {formatDate(order.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                        >
                          상세보기
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                총 {total}건 중 {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, total)}건
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상세 보기 모달 */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={fetchOrders}
          toast={toast}
        />
      )}
    </div>
  )
}

// 주문 상태 옵션 (CustomerOrderStatus enum과 일치)
const ORDER_STATUS_OPTIONS = [
  { value: 'PENDING', label: '결제대기', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'PAID', label: '결제완료', color: 'bg-blue-100 text-blue-700' },
  { value: 'SHIPPED', label: '배송중', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'DELIVERED', label: '배송완료', color: 'bg-green-100 text-green-700' },
  { value: 'CANCELLED', label: '주문취소', color: 'bg-red-100 text-red-700' },
  { value: 'REFUNDED', label: '환불완료', color: 'bg-gray-100 text-gray-700' },
]

// 주문 상세 모달
interface OrderDetailModalProps {
  order: UnifiedOrder
  onClose: () => void
  onStatusChange?: () => void
  toast: ReturnType<typeof useToast>
}

function OrderDetailModal({ order, onClose, onStatusChange, toast }: OrderDetailModalProps) {
  const [currentStatus, setCurrentStatus] = useState(order.status)
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return

    setIsChangingStatus(true)
    setStatusError(null)

    try {
      const response = await fetch(`/api/order/unified/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: order.source,
          status: newStatus,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setCurrentStatus(newStatus)
        onStatusChange?.()
        toast.success('주문 상태가 변경되었습니다.')
      } else {
        setStatusError(data.error || '상태 변경에 실패했습니다.')
        toast.error(data.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      setStatusError('상태 변경 중 오류가 발생했습니다.')
      toast.error('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setIsChangingStatus(false)
    }
  }

  const currentStatusOption = ORDER_STATUS_OPTIONS.find(opt => opt.value === currentStatus)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full shadow-xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900">주문 상세</h2>
            <p className="text-sm text-gray-500 font-mono">{order.orderNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* 출처 & 상태 */}
          <div className="flex items-center gap-3">
            {order.source === 'SHOPPING_MALL' ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                <ShoppingBag size={16} />
                쇼핑몰 주문
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700">
                <FileSpreadsheet size={16} />
                밴드 주문
              </span>
            )}
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${currentStatusOption?.color || 'bg-gray-100 text-gray-700'}`}>
              {currentStatusOption?.label || currentStatus}
            </span>
          </div>

          {/* 상태 변경 (쇼핑몰 주문만) */}
          {order.source === 'SHOPPING_MALL' && (
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">주문 상태 변경</h3>
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    disabled={isChangingStatus || option.value === currentStatus}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      option.value === currentStatus
                        ? `${option.color} ring-2 ring-offset-1 ring-current`
                        : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {isChangingStatus && (
                <p className="text-sm text-blue-600">상태 변경 중...</p>
              )}
              {statusError && (
                <p className="text-sm text-red-600">{statusError}</p>
              )}
            </div>
          )}

          {/* 밴드 주문 안내 */}
          {order.source === 'GOOGLE_FORM' && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">
                밴드 주문은 현재 상태 변경을 지원하지 않습니다.
              </p>
            </div>
          )}

          {/* 고객 정보 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">고객 정보</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">이름</span>
                <p className="font-medium text-gray-900">{order.customerName}</p>
              </div>
              {order.customerPhone && (
                <div>
                  <span className="text-gray-500">연락처</span>
                  <p className="font-medium text-gray-900">{order.customerPhone}</p>
                </div>
              )}
            </div>
            {order.address && (
              <div className="text-sm">
                <span className="text-gray-500 flex items-center gap-1">
                  <MapPin size={14} />
                  배송지
                </span>
                <p className="font-medium text-gray-900 mt-1">{order.address}</p>
              </div>
            )}
            {order.deliveryMemo && (
              <div className="text-sm">
                <span className="text-gray-500">배송메모</span>
                <p className="font-medium text-gray-900">{order.deliveryMemo}</p>
              </div>
            )}
          </div>

          {/* 상품 정보 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">상품 정보</h3>
            <div className="text-sm">
              <p className="font-medium text-gray-900">{order.productSummary}</p>
              {order.itemCount > 1 && (
                <p className="text-gray-500">총 {order.itemCount}개 상품</p>
              )}
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">총 결제금액</span>
                <span className="font-bold text-gray-900 text-lg">
                  {order.totalAmount.toLocaleString()}원
                </span>
              </div>
            </div>
          </div>

          {/* 주문 일시 */}
          <div className="text-sm text-gray-500">
            주문일시: {formatDate(order.createdAt)}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  )
}
