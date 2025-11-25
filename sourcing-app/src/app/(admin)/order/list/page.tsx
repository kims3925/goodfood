'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
} from 'lucide-react'

interface Order {
  id: number
  customerName: string
  customerPhone: string
  customerAddress: string | null
  productName: string
  productOption: string | null
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  status: OrderStatus
  customerMemo: string | null
  adminMemo: string | null
  trackingNumber: string | null
  orderedAt: string
  createdAt: string
}

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  PENDING: { label: '주문접수', color: 'text-yellow-600', bgColor: 'bg-yellow-50', icon: <Clock size={14} /> },
  CONFIRMED: { label: '주문확인', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: <CheckCircle size={14} /> },
  PREPARING: { label: '상품준비', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: <Package size={14} /> },
  SHIPPING: { label: '배송중', color: 'text-orange-600', bgColor: 'bg-orange-50', icon: <Truck size={14} /> },
  DELIVERED: { label: '배송완료', color: 'text-green-600', bgColor: 'bg-green-50', icon: <CheckCircle size={14} /> },
  CANCELLED: { label: '취소', color: 'text-red-600', bgColor: 'bg-red-50', icon: <XCircle size={14} /> },
  REFUNDED: { label: '환불', color: 'text-gray-600', bgColor: 'bg-gray-50', icon: <XCircle size={14} /> },
}

export default function OrderListPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (statusFilter) {
        params.set('status', statusFilter)
      }

      if (search) {
        params.set('search', search)
      }

      const res = await fetch(`/api/order?${params}`)
      const data = await res.json()

      if (data.success) {
        setOrders(data.data.orders)
        setTotalPages(data.data.pagination.totalPages)
        setTotal(data.data.pagination.total)
        setStatusCounts(data.data.statusCounts)
      }
    } catch (error) {
      console.error('주문서 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchOrders()
  }

  const handleStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/order/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        fetchOrders()
      }
    } catch (error) {
      console.error('상태 변경 실패:', error)
    }
  }

  const openDetail = (order: Order) => {
    setSelectedOrder(order)
    setIsDetailOpen(true)
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

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return price.toLocaleString() + '원'
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">주문서 관리</h1>
        <p className="text-text-secondary mt-1">Google Forms에서 수집된 주문을 관리합니다</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <button
            key={status}
            onClick={() => {
              setStatusFilter(statusFilter === status ? '' : status as OrderStatus)
              setPage(1)
            }}
            className={`
              p-4 rounded-lg border transition-all
              ${statusFilter === status ? 'border-primary-color ring-2 ring-primary-light' : 'border-border hover:border-gray-300'}
              ${config.bgColor}
            `}
          >
            <div className={`flex items-center gap-2 ${config.color}`}>
              {config.icon}
              <span className="text-sm font-medium">{config.label}</span>
            </div>
            <p className="text-2xl font-bold mt-2">{statusCounts[status] || 0}</p>
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input
              type="text"
              placeholder="고객명, 전화번호, 상품명 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary-color text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            검색
          </button>
        </form>

        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors"
        >
          <RefreshCw size={18} />
          <span>새로고침</span>
        </button>
      </div>

      {/* Order Table */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">주문일시</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">고객정보</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">상품정보</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">수량</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">금액</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">상태</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                    로딩 중...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                    주문이 없습니다
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const statusConfig = STATUS_CONFIG[order.status]
                  return (
                    <tr key={order.id} className="hover:bg-surface/50">
                      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                        {formatDate(order.orderedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-primary">{order.customerName}</p>
                        <p className="text-xs text-text-secondary">{order.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-text-primary line-clamp-1">{order.productName}</p>
                        {order.productOption && (
                          <p className="text-xs text-text-secondary">{order.productOption}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">
                        {order.quantity}개
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-text-primary">
                        {formatPrice(order.totalPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                          className={`
                            text-sm px-2 py-1 rounded border-0
                            ${statusConfig.bgColor} ${statusConfig.color}
                            cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-light
                          `}
                        >
                          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                            <option key={status} value={status}>
                              {config.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openDetail(order)}
                          className="p-2 text-text-secondary hover:text-primary-color hover:bg-surface rounded-lg transition-colors"
                          title="상세보기"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-text-secondary">
              총 {total}건 중 {(page - 1) * 20 + 1}-{Math.min(page * 20, total)}건
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-text-secondary">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {isDetailOpen && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => {
            setIsDetailOpen(false)
            setSelectedOrder(null)
          }}
          onUpdate={fetchOrders}
        />
      )}
    </div>
  )
}

// Order Detail Modal Component
interface OrderDetailModalProps {
  order: Order
  onClose: () => void
  onUpdate: () => void
}

function OrderDetailModal({ order, onClose, onUpdate }: OrderDetailModalProps) {
  const [adminMemo, setAdminMemo] = useState(order.adminMemo || '')
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '')
  const [status, setStatus] = useState<OrderStatus>(order.status)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/order/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          adminMemo,
          trackingNumber,
        }),
      })

      if (res.ok) {
        onUpdate()
        onClose()
      }
    } catch (error) {
      console.error('저장 실패:', error)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">주문 상세</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <XCircle size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Customer Info */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">고객 정보</h3>
            <div className="bg-surface rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-text-secondary">고객명</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">연락처</span>
                <span className="font-medium">{order.customerPhone}</span>
              </div>
              {order.customerAddress && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">주소</span>
                  <span className="font-medium text-right">{order.customerAddress}</span>
                </div>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">상품 정보</h3>
            <div className="bg-surface rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-text-secondary">상품명</span>
                <span className="font-medium">{order.productName}</span>
              </div>
              {order.productOption && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">옵션</span>
                  <span className="font-medium">{order.productOption}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-secondary">수량</span>
                <span className="font-medium">{order.quantity}개</span>
              </div>
              {order.unitPrice && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">단가</span>
                  <span className="font-medium">{order.unitPrice.toLocaleString()}원</span>
                </div>
              )}
              {order.totalPrice && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">총액</span>
                  <span className="font-bold text-primary-color">{order.totalPrice.toLocaleString()}원</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer Memo */}
          {order.customerMemo && (
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-3">고객 요청사항</h3>
              <div className="bg-yellow-50 rounded-lg p-4 text-sm">{order.customerMemo}</div>
            </div>
          )}

          {/* Order Status */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">주문 상태</h3>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
            >
              {Object.entries(STATUS_CONFIG).map(([s, config]) => (
                <option key={s} value={s}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tracking Number */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">운송장 번호</h3>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="운송장 번호를 입력하세요"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>

          {/* Admin Memo */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">관리자 메모</h3>
            <textarea
              value={adminMemo}
              onChange={(e) => setAdminMemo(e.target.value)}
              placeholder="관리자 메모를 입력하세요"
              rows={3}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light resize-none"
            />
          </div>

          {/* Timestamps */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">일시 정보</h3>
            <div className="bg-surface rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">주문일시</span>
                <span>{formatDate(order.orderedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">등록일시</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-border px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary-color text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
