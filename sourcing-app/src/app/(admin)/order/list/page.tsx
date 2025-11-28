'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Search,
  RefreshCw,
  Trash2,
  ExternalLink,
  ImageOff,
  Plus,
  ShoppingBag,
  CheckCircle,
  AlertCircle,
  Edit,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Loading from '@/components/ui/Loading'

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

  // 선택 삭제 관련 상태
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // 수정 모달 관련 상태
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)

  const itemsPerPage = 10

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
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

  const handleSearch = () => {
    setPage(1)
    fetchOrders()
  }

  const goToProduct = (productId: number) => {
    router.push(`/product/detail/${productId}`)
  }

  // 전체 선택/해제
  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedOrderIds([])
      setSelectAll(false)
    } else {
      const allIds = orders.map((order) => order.id)
      setSelectedOrderIds(allIds)
      setSelectAll(true)
    }
  }

  // 개별 선택/해제
  const handleToggleSelection = (id: number) => {
    setSelectedOrderIds((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((oid) => oid !== id)
        : [...prev, id]
      setSelectAll(newSelection.length === orders.length)
      return newSelection
    })
  }

  // 선택 삭제
  const handleDeleteSelected = async () => {
    if (selectedOrderIds.length === 0) return

    if (!confirm(`선택한 ${selectedOrderIds.length}개의 주문을 삭제하시겠습니까?`)) return

    try {
      for (const id of selectedOrderIds) {
        try {
          await fetch(`/api/order/${id}`, {
            method: 'DELETE',
          })
        } catch (error) {
          console.error(`주문 삭제 실패 (ID: ${id}):`, error)
        }
      }

      setSelectedOrderIds([])
      setSelectAll(false)
      fetchOrders()
    } catch (error) {
      console.error('주문 일괄 삭제 실패:', error)
    }
  }

  // 개별 삭제
  const handleDelete = async (id: number) => {
    if (!confirm('이 주문을 삭제하시겠습니까?')) return

    try {
      await fetch(`/api/order/${id}`, {
        method: 'DELETE',
      })
      fetchOrders()
    } catch (error) {
      console.error('주문 삭제 실패:', error)
    }
  }

  const openEdit = (order: PurchaseOrder) => {
    setSelectedOrder(order)
    setIsEditOpen(true)
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
    return `₩${price.toLocaleString()}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">주문서 관리</h1>
          <p className="text-gray-600">
            Google Forms 또는 직접 등록한 주문을 관리합니다. 주문 정보를 확인하고 수정할 수 있습니다.
          </p>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <Input
                    type="text"
                    placeholder="이름, 상품명 검색..."
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

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={fetchOrders}
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  새로고침
                </Button>
                <Button variant="primary" onClick={() => router.push('/order/new')}>
                  <Plus size={16} />
                  주문 등록
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteSelected}
                  disabled={selectedOrderIds.length === 0}
                >
                  <Trash2 size={16} />
                  선택 삭제 ({selectedOrderIds.length})
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
                  <TableHead className="w-[4%]">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-[5%]">ID</TableHead>
                  <TableHead className="w-[20%]">입력 상품명</TableHead>
                  <TableHead className="w-[20%]">매칭된 상품</TableHead>
                  <TableHead className="w-[8%]">매칭</TableHead>
                  <TableHead className="w-[10%]">총금액</TableHead>
                  <TableHead className="w-[10%]">주문자</TableHead>
                  <TableHead className="w-[13%]">등록일</TableHead>
                  <TableHead className="w-[10%]">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableEmpty message="등록된 주문이 없습니다." />
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-gray-50">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(order.id)}
                          onChange={() => handleToggleSelection(order.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 font-medium">{order.id}</span>
                      </TableCell>
                      {/* 입력 상품명 */}
                      <TableCell>
                        <div className="font-medium text-gray-900">{order.productName}</div>
                      </TableCell>
                      {/* 매칭된 상품 */}
                      <TableCell>
                        {order.product ? (
                          <div className="flex items-center gap-2">
                            {order.product.thumbnailUrl ? (
                              <div
                                className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                                onClick={() => order.product && goToProduct(order.product.id)}
                              >
                                <Image
                                  src={order.product.thumbnailUrl}
                                  alt={order.product.name}
                                  width={40}
                                  height={40}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <ShoppingBag size={16} className="text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-gray-900 truncate text-sm">{order.product.name}</div>
                              <button
                                onClick={() => goToProduct(order.product!.id)}
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              >
                                상품 보기 <ExternalLink size={10} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      {/* 매칭 상태 */}
                      <TableCell>
                        {order.product ? (
                          order.productName === order.product.name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <CheckCircle size={12} />
                              일치
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                              <AlertCircle size={12} />
                              유사
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <AlertCircle size={12} />
                            미매칭
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {formatPrice(order.totalPrice)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">{order.customerName}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {formatDate(order.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(order)}
                          >
                            <Edit size={16} className="text-gray-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(order.id)}
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </Button>
                        </div>
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
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">주문 수정</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* 매칭된 상품 정보 */}
          {order.product && (
            <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
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
                <p className="text-xs text-gray-500">매칭된 상품</p>
                <p className="text-sm font-medium text-gray-900">{order.product.name}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상품명</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">총금액</label>
            <input
              type="number"
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">주문자</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
