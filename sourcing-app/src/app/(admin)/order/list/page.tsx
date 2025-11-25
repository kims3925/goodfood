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
} from 'lucide-react'
import Pagination from '@/components/ui/Pagination'

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
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchOrders()
  }

  // 행 클릭 시 상세 페이지로 이동
  const handleRowClick = (orderId: number) => {
    router.push(`/order/${orderId}`)
  }

  const goToProduct = (productId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/product/${productId}`)
  }

  // 전체 선택/해제
  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([])
      setSelectAll(false)
    } else {
      const allIds = orders.map(order => order.id)
      setSelectedIds(allIds)
      setSelectAll(true)
    }
  }

  // 개별 선택/해제
  const handleToggleSelection = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]

      setSelectAll(newSelection.length === orders.length)
      return newSelection
    })
  }

  // 선택 삭제
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`선택한 ${selectedIds.length}개의 주문을 삭제하시겠습니까?`)) return

    try {
      for (const id of selectedIds) {
        await fetch(`/api/order/${id}`, {
          method: 'DELETE',
        })
      }
      setSelectedIds([])
      setSelectAll(false)
      fetchOrders()
    } catch (error) {
      console.error('삭제 실패:', error)
    }
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

        <div className="flex gap-2">
          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors"
          >
            <RefreshCw size={18} />
            <span>새로고침</span>
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={18} />
            <span>선택 삭제 ({selectedIds.length})</span>
          </button>
        </div>
      </div>

      {/* Order Table */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary w-[50px]">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">상품</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">총금액</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">이름</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">등록일</th>
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
                  <tr
                    key={order.id}
                    className="hover:bg-surface/50 cursor-pointer"
                    onClick={() => handleRowClick(order.id)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={(e) => handleToggleSelection(order.id, e as unknown as React.MouseEvent)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {order.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* 썸네일 */}
                        {order.product?.thumbnailUrl ? (
                          <div
                            className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary-color transition-all"
                            onClick={(e) => order.product && goToProduct(order.product.id, e)}
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
                              onClick={(e) => goToProduct(order.product!.id, e)}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={itemsPerPage}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
