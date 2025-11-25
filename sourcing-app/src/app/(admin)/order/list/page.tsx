'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit,
  X,
  ExternalLink,
  ImageOff,
} from 'lucide-react'

interface MatchedProduct {
  id: number
  name: string
  thumbnailUrl: string | null
}

interface PurchaseOrder {
  id: number
  productId: number | null
  productName: string
  totalPrice: number | null
  customerName: string
  createdAt: string
  product: MatchedProduct | null
}

export default function OrderListPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (search) {
        params.set('search', search)
      }

      const res = await fetch(`/api/order?${params}`)
      const data = await res.json()

      if (data.success) {
        setOrders(data.data.orders)
        setTotalPages(data.data.pagination.totalPages)
        setTotal(data.data.pagination.total)
      }
    } catch (error) {
      console.error('주문서 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchOrders()
  }

  const handleDelete = async (orderId: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/order/${orderId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchOrders()
      }
    } catch (error) {
      console.error('삭제 실패:', error)
    }
  }

  const openEdit = (order: PurchaseOrder) => {
    setSelectedOrder(order)
    setIsEditOpen(true)
  }

  const goToProduct = (productId: number) => {
    router.push(`/product/${productId}`)
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

      {/* Stats Card */}
      <div className="bg-white rounded-lg border border-border p-4 mb-6">
        <p className="text-text-secondary text-sm">총 주문</p>
        <p className="text-3xl font-bold text-primary-color">{total}건</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input
              type="text"
              placeholder="이름, 상품명 검색..."
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
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">상품</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">총금액</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">이름</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">등록일</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                    로딩 중...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                    주문이 없습니다
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface/50">
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {order.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* 썸네일 */}
                        {order.product?.thumbnailUrl ? (
                          <div
                            className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary-color transition-all"
                            onClick={() => order.product && goToProduct(order.product.id)}
                          >
                            <Image
                              src={order.product.thumbnailUrl}
                              alt={order.productName}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <ImageOff size={20} className="text-gray-400" />
                          </div>
                        )}

                        {/* 상품명 및 매칭 상태 */}
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary truncate">{order.productName}</p>
                          {order.product ? (
                            <button
                              onClick={() => goToProduct(order.product!.id)}
                              className="text-xs text-primary-color hover:underline flex items-center gap-1 mt-0.5"
                            >
                              상품 보기
                              <ExternalLink size={12} />
                            </button>
                          ) : (
                            <span className="text-xs text-text-secondary">매칭되는 상품 없음</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-text-primary">
                      {formatPrice(order.totalPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {order.customerName}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(order)}
                          className="p-2 text-text-secondary hover:text-primary-color hover:bg-surface rounded-lg transition-colors"
                          title="수정"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="p-2 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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

      {/* Edit Modal */}
      {isEditOpen && selectedOrder && (
        <EditOrderModal
          order={selectedOrder}
          onClose={() => {
            setIsEditOpen(false)
            setSelectedOrder(null)
          }}
          onUpdate={fetchOrders}
        />
      )}
    </div>
  )
}

// Edit Order Modal Component
interface EditOrderModalProps {
  order: PurchaseOrder
  onClose: () => void
  onUpdate: () => void
}

function EditOrderModal({ order, onClose, onUpdate }: EditOrderModalProps) {
  const [productName, setProductName] = useState(order.productName)
  const [totalPrice, setTotalPrice] = useState(order.totalPrice?.toString() || '')
  const [customerName, setCustomerName] = useState(order.customerName)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/order/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          totalPrice: totalPrice ? parseInt(totalPrice) : null,
          customerName,
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">주문 수정</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* 매칭된 상품 정보 */}
          {order.product && (
            <div className="bg-surface rounded-lg p-3 flex items-center gap-3">
              {order.product.thumbnailUrl ? (
                <Image
                  src={order.product.thumbnailUrl}
                  alt={order.product.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                  <ImageOff size={20} className="text-gray-400" />
                </div>
              )}
              <div>
                <p className="text-xs text-text-secondary">매칭된 상품</p>
                <p className="text-sm font-medium">{order.product.name}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">상품명</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">총금액</label>
            <input
              type="number"
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">이름</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex justify-end gap-3">
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
