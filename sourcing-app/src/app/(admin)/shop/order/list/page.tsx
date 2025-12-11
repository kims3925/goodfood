'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  ShoppingBag,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckCircle,
  Clock,
  CreditCard,
  Truck,
  XCircle,
} from 'lucide-react'
import Input from '@/components/ui/Input'
import { formatPhoneNumber } from '@/modules/utils/phoneUtils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

type OrderSource = 'SHOPPING_MALL'

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
  isGuestOrder?: boolean
  address?: string
  deliveryMemo?: string
  paymentMethod?: string
  shopId?: number | null
  shopName?: string | null
  shopSubdomain?: string | null
}

interface Shop {
  id: number
  name: string
  subdomain: string
}

export default function UnifiedOrderListPage() {
  const toast = useToast()
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Shop 필터
  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null)

  // 상태 필터
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  // 상태별 카운트 (API에서 가져옴)
  const [statusCounts, setStatusCounts] = useState({
    total: 0,
    PENDING: 0,
    PAID: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  })

  const router = useRouter()

  const itemsPerPage = 20

  // Shop 목록 로드
  useEffect(() => {
    const loadShops = async () => {
      try {
        const res = await fetch('/api/shop?limit=100')
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          setShops(data.data.map((s: any) => ({ id: s.id, name: s.name, subdomain: s.subdomain })))
        }
      } catch (error) {
        console.error('Shop 목록 로드 실패:', error)
      }
    }
    loadShops()
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      })

      if (search) params.set('search', search)
      if (selectedShopId) params.set('shopId', selectedShopId.toString())
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/order/unified?${params}`)
      const data = await res.json()

      if (data.success) {
        setOrders(data.data.orders)
        setTotalPages(data.data.pagination.totalPages)
        setTotal(data.data.pagination.total)
        if (data.data.statusCounts) {
          setStatusCounts(data.data.statusCounts)
        }
      } else {
        // 데이터가 없는 경우는 정상이므로 에러 메시지 표시하지 않음
        console.warn('주문 목록 조회 실패:', data.error)
      }
    } catch (error) {
      console.error('주문 로드 실패:', error)
      toast.error('주문 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [page, search, selectedShopId, statusFilter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // 필터 변경 시 페이지 리셋
  useEffect(() => {
    setPage(1)
  }, [selectedShopId, statusFilter])

  const handleSearch = () => {
    setPage(1)
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

  const getSourceBadge = (order: UnifiedOrder) => {
    if (order.source === 'SHOPPING_MALL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
          <ShoppingBag size={12} className="flex-shrink-0" />
          <span className="truncate max-w-[80px]" title={order.shopName || '쇼핑몰'}>
            {order.shopName || '쇼핑몰'}
          </span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
        <FileSpreadsheet size={12} className="flex-shrink-0" />
        밴드주문
      </span>
    )
  }

  const getStatusBadge = (status: string, statusLabel: string) => {
    const colorMap: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      PAID: 'bg-blue-100 text-blue-700',
      SHIPPED: 'bg-indigo-100 text-indigo-700',
      DELIVERED: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-red-100 text-red-700',
      REFUNDED: 'bg-gray-100 text-gray-700',
    }

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorMap[status] || 'bg-gray-100 text-gray-700'}`}>
        {statusLabel}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">주문 목록</h1>
          <p className="text-gray-600">
            주문 현황을 확인하고 관리합니다.
          </p>
        </div>

        {/* 상태 필터 버튼 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <button
            onClick={() => setStatusFilter(null)}
            className={`rounded-xl p-4 transition-all ${
              statusFilter === null
                ? 'bg-gray-900 text-white shadow-lg scale-[1.02]'
                : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${statusFilter === null ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <Package size={20} className={statusFilter === null ? 'text-white' : 'text-gray-600'} />
              </div>
              <div className="text-left">
                <p className={`text-xs ${statusFilter === null ? 'text-gray-300' : 'text-gray-500'}`}>전체</p>
                <p className="text-xl font-bold">{statusCounts.total}</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'PENDING' ? null : 'PENDING')}
            className={`rounded-xl p-4 transition-all ${
              statusFilter === 'PENDING'
                ? 'bg-yellow-500 text-white shadow-lg scale-[1.02]'
                : 'bg-white hover:bg-yellow-50 border border-gray-200 shadow-sm hover:shadow-md hover:border-yellow-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${statusFilter === 'PENDING' ? 'bg-yellow-400' : 'bg-yellow-100'}`}>
                <Clock size={20} className={statusFilter === 'PENDING' ? 'text-white' : 'text-yellow-600'} />
              </div>
              <div className="text-left">
                <p className={`text-xs ${statusFilter === 'PENDING' ? 'text-yellow-100' : 'text-gray-500'}`}>결제대기</p>
                <p className={`text-xl font-bold ${statusFilter === 'PENDING' ? '' : 'text-yellow-600'}`}>{statusCounts.PENDING}</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'PAID' ? null : 'PAID')}
            className={`rounded-xl p-4 transition-all ${
              statusFilter === 'PAID'
                ? 'bg-blue-500 text-white shadow-lg scale-[1.02]'
                : 'bg-white hover:bg-blue-50 border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${statusFilter === 'PAID' ? 'bg-blue-400' : 'bg-blue-100'}`}>
                <CreditCard size={20} className={statusFilter === 'PAID' ? 'text-white' : 'text-blue-600'} />
              </div>
              <div className="text-left">
                <p className={`text-xs ${statusFilter === 'PAID' ? 'text-blue-100' : 'text-gray-500'}`}>결제완료</p>
                <p className={`text-xl font-bold ${statusFilter === 'PAID' ? '' : 'text-blue-600'}`}>{statusCounts.PAID}</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'SHIPPED' ? null : 'SHIPPED')}
            className={`rounded-xl p-4 transition-all ${
              statusFilter === 'SHIPPED'
                ? 'bg-indigo-500 text-white shadow-lg scale-[1.02]'
                : 'bg-white hover:bg-indigo-50 border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${statusFilter === 'SHIPPED' ? 'bg-indigo-400' : 'bg-indigo-100'}`}>
                <Truck size={20} className={statusFilter === 'SHIPPED' ? 'text-white' : 'text-indigo-600'} />
              </div>
              <div className="text-left">
                <p className={`text-xs ${statusFilter === 'SHIPPED' ? 'text-indigo-100' : 'text-gray-500'}`}>배송중</p>
                <p className={`text-xl font-bold ${statusFilter === 'SHIPPED' ? '' : 'text-indigo-600'}`}>{statusCounts.SHIPPED}</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'DELIVERED' ? null : 'DELIVERED')}
            className={`rounded-xl p-4 transition-all ${
              statusFilter === 'DELIVERED'
                ? 'bg-green-500 text-white shadow-lg scale-[1.02]'
                : 'bg-white hover:bg-green-50 border border-gray-200 shadow-sm hover:shadow-md hover:border-green-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${statusFilter === 'DELIVERED' ? 'bg-green-400' : 'bg-green-100'}`}>
                <CheckCircle size={20} className={statusFilter === 'DELIVERED' ? 'text-white' : 'text-green-600'} />
              </div>
              <div className="text-left">
                <p className={`text-xs ${statusFilter === 'DELIVERED' ? 'text-green-100' : 'text-gray-500'}`}>배송완료</p>
                <p className={`text-xl font-bold ${statusFilter === 'DELIVERED' ? '' : 'text-green-600'}`}>{statusCounts.DELIVERED}</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'CANCELLED' ? null : 'CANCELLED')}
            className={`rounded-xl p-4 transition-all ${
              statusFilter === 'CANCELLED'
                ? 'bg-red-500 text-white shadow-lg scale-[1.02]'
                : 'bg-white hover:bg-red-50 border border-gray-200 shadow-sm hover:shadow-md hover:border-red-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${statusFilter === 'CANCELLED' ? 'bg-red-400' : 'bg-red-100'}`}>
                <XCircle size={20} className={statusFilter === 'CANCELLED' ? 'text-white' : 'text-red-600'} />
              </div>
              <div className="text-left">
                <p className={`text-xs ${statusFilter === 'CANCELLED' ? 'text-red-100' : 'text-gray-500'}`}>취소/환불</p>
                <p className={`text-xl font-bold ${statusFilter === 'CANCELLED' ? '' : 'text-red-600'}`}>{statusCounts.CANCELLED}</p>
              </div>
            </div>
          </button>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* Shop 필터 */}
              {shops.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedShopId ?? ''}
                    onChange={(e) => setSelectedShopId(e.target.value ? parseInt(e.target.value) : null)}
                    className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">전체 쇼핑몰</option>
                    {shops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
              {/* 검색 */}
              <div className="relative w-full sm:w-80">
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
                  <TableHead className="w-[12%]">전화번호</TableHead>
                  <TableHead className="w-[22%]">상품</TableHead>
                  <TableHead className="w-[10%]">금액</TableHead>
                  <TableHead className="w-[10%]">상태</TableHead>
                  <TableHead className="w-[16%]">주문일시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableEmpty message="주문이 없습니다." />
                ) : (
                  orders.map((order) => (
                    <TableRow
                      key={`${order.source}-${order.id}`}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/shop/order/detail/${order.id}?source=${order.source}`)}
                    >
                      <TableCell>{getSourceBadge(order)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm text-gray-900">
                            {order.orderNumber}
                          </span>
                          {order.isGuestOrder && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                              비회원
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-gray-900">{order.customerName}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {order.customerPhone ? formatPhoneNumber(order.customerPhone) : '-'}
                        </span>
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

    </div>
  )
}
