'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckCircle,
  Clock,
  CreditCard,
  Truck,
  XCircle,
  Plus,
  Trash2,
  Edit3,
  Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import Input from '@/components/ui/Input'
import { formatPhoneNumber } from '@/modules/utils/phoneUtils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'
import { getChannelColor } from '@/lib/channel-utils'
import { generateOrderText } from '@/lib/order-text'

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
  // 도매처 정보
  wholesaleChannel?: {
    id: number
    name: string
    platform: string
  } | null
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

  // 삭제 확인 모달
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; order: UnifiedOrder | null }>({
    show: false,
    order: null,
  })

  // 상태별 카운트 (API에서 가져옴)
  const [statusCounts, setStatusCounts] = useState({
    total: 0,
    PENDING: 0,
    PAID: 0,
    PREPARING: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  })

  const router = useRouter()

  const [itemsPerPage, setItemsPerPage] = useState<20 | 50 | 100>(20)

  // 저장하기용: 선택된 주문 + 드롭다운 메뉴 상태
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [showSaveMenu, setShowSaveMenu] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const toggleOrder = (orderNumber: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderNumber)) {
        next.delete(orderNumber)
      } else {
        next.add(orderNumber)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedOrders.size === orders.length && orders.length > 0) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(orders.map(o => o.orderNumber)))
    }
  }

  // 페이지 이동 시 선택 초기화 (선택한 주문번호가 현재 페이지에 없으면 혼란 방지)
  useEffect(() => {
    setSelectedOrders(new Set())
  }, [page, search, selectedShopId, statusFilter, itemsPerPage])

  // 저장 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!showSaveMenu) return
    const handler = () => setShowSaveMenu(false)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [showSaveMenu])

  // 선택한 주문의 상세 정보 로드
  const fetchSelectedDetails = async () => {
    const selected = orders.filter(o => selectedOrders.has(o.orderNumber))
    const details = await Promise.all(
      selected.map(async (o) => {
        const res = await fetch(`/api/order/unified/${o.orderNumber}?source=${o.source}`)
        const data = await res.json()
        return data.success ? data.data : null
      })
    )
    return details.filter(Boolean)
  }

  // 파일명용 타임스탬프 (YYYYMMDD_HHmm)
  const buildTimestamp = () => {
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    return (
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `_${pad(now.getHours())}${pad(now.getMinutes())}`
    )
  }

  const handleSaveAsText = async () => {
    setShowSaveMenu(false)
    if (selectedOrders.size === 0) {
      toast.error('저장할 주문을 선택해주세요.')
      return
    }

    setIsSaving(true)
    try {
      const details = await fetchSelectedDetails()
      if (details.length === 0) {
        toast.error('주문 상세 정보를 불러오지 못했습니다.')
        return
      }

      const texts = details.map((order: any) => {
        const wholesaleItem = (order.items || []).find(
          (i: any) => i?.channel?.kind === 'WHOLESALE'
        )
        return generateOrderText({
          orderNumber: order.orderNumber,
          items: (order.items || []).map((i: any) => ({
            productName: i.productName,
            sourceProductName: i.sourceProductName,
            optionSummary: i.optionSummary,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            shippingFee: i.shippingFee ?? 0,
          })),
          shipping: order.shippingAddress,
          wholesaleChannelName: wholesaleItem?.channel?.name,
          customerName: order.customerName,
          customerPhone: order.customerPhone ?? undefined,
        })
      })

      const divider = '\n\n' + '='.repeat(30) + '\n\n'
      const content = texts.join(divider)

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `BandAuto_발주_${buildTimestamp()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`${details.length}건 텍스트 저장 완료`)
    } catch (err) {
      console.error('텍스트 저장 실패:', err)
      toast.error('텍스트 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAsExcel = async () => {
    setShowSaveMenu(false)
    if (selectedOrders.size === 0) {
      toast.error('저장할 주문을 선택해주세요.')
      return
    }

    setIsSaving(true)
    try {
      const details = await fetchSelectedDetails()
      if (details.length === 0) {
        toast.error('주문 상세 정보를 불러오지 못했습니다.')
        return
      }

      // 주문당 1행. 품목이 여러 개면 품명/옵션/수량은 줄바꿈으로 합치고, 금액·배송비는 합계.
      const rows = details.map((order: any) => {
        const items = order.items || []
        const addr = order.shippingAddress
        const addressStr = addr
          ? `[${addr.postalCode}] ${addr.address}${addr.addressDetail ? ' ' + addr.addressDetail : ''}`
          : ''
        const wholesaleName = items.find((i: any) => i?.channel?.kind === 'WHOLESALE')?.channel?.name || ''

        const productNames = items.map((i: any) => i.sourceProductName || i.productName).join('\n')
        const optionSummaries = items.map((i: any) => i.optionSummary || '').join('\n')
        const quantities = items.map((i: any) => i.quantity).join('\n')
        const totalAmount = items.reduce(
          (sum: number, i: any) => sum + (i.unitPrice * i.quantity), 0
        )
        const totalShipping = items.reduce(
          (sum: number, i: any) => sum + (i.shippingFee ?? 0), 0
        )

        return {
          주문번호: order.orderNumber,
          품명: productNames,
          옵션: optionSummaries,
          수량: quantities,
          금액: totalAmount,
          배송비: totalShipping,
          받는분: addr?.recipientName || '',
          연락처: addr?.recipientPhone || '',
          주소: addressStr,
          보내는분: order.customerName || '',
          '보내는분 연락처': order.customerPhone || '',
          도매방: wholesaleName,
        }
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [
        { wch: 24 }, // 주문번호
        { wch: 34 }, // 품명
        { wch: 18 }, // 옵션
        { wch: 6 },  // 수량
        { wch: 10 }, // 금액
        { wch: 8 },  // 배송비
        { wch: 10 }, // 받는분
        { wch: 15 }, // 연락처
        { wch: 40 }, // 주소
        { wch: 10 }, // 보내는분
        { wch: 15 }, // 보내는분 연락처
        { wch: 20 }, // 도매방
      ]
      // 품목 수에 맞춰 행 높이 자동 조정 (기본 18pt × 품목수)
      ws['!rows'] = [
        { hpt: 18 }, // 헤더
        ...details.map((order: any) => {
          const n = Math.max(1, (order.items || []).length)
          return { hpt: Math.max(22, n * 18) }
        }),
      ]
      // 모든 데이터 셀에 wrapText + 상단 정렬 적용 (줄바꿈 렌더링)
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      for (let R = range.s.r + 1; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C })
          const cell = ws[addr]
          if (cell) {
            cell.s = {
              ...(cell.s || {}),
              alignment: { wrapText: true, vertical: 'top' },
            }
          }
        }
      }

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '발주목록')

      XLSX.writeFile(wb, `BandAuto_발주_${buildTimestamp()}.xlsx`)
      toast.success(`${details.length}건 엑셀 저장 완료`)
    } catch (err) {
      console.error('엑셀 저장 실패:', err)
      toast.error('엑셀 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- toast는 useMemo로 메모이제이션되어 안정적
  }, [page, search, selectedShopId, statusFilter, itemsPerPage])

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

  const formatPrice = (price: number | null) => {
    if (!price) return '0원'
    return `${price.toLocaleString()}원`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).replace(/\. /g, '-').replace(/\.$/, '').replace(/-(\d{2}:\d{2})$/, ' $1')
  }

  const getSourceBadge = (order: UnifiedOrder) => {
    return (
      <div className="flex flex-col items-center gap-1">
        {/* 1줄: 소매처 (Shop) */}
        <span
          className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 max-w-[100px]"
          title={order.shopName || '쇼핑몰'}
        >
          <ShoppingBag size={12} className="flex-shrink-0" />
          <span className="truncate">
            {order.shopName || '쇼핑몰'}
          </span>
        </span>

        {/* 2줄: 도매처 (Channel, WHOLESALE) */}
        {order.wholesaleChannel && (
          <span
            className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium max-w-[100px] ${getChannelColor(order.wholesaleChannel.platform)}`}
            title={order.wholesaleChannel.name}
          >
            <Package size={12} className="flex-shrink-0" />
            <span className="truncate">
              {order.wholesaleChannel.name}
            </span>
          </span>
        )}
      </div>
    )
  }

  const getStatusBadge = (status: string, statusLabel: string) => {
    const colorMap: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      PAID: 'bg-blue-100 text-blue-700',
      PREPARING: 'bg-orange-100 text-orange-700',
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

  // 외부 주문 판별 (주문번호가 'x'로 시작)
  const isExternalOrder = (orderNumber: string) => {
    return orderNumber.toLowerCase().startsWith('x')
  }

  // 외부주문 상태 단계 변경 (상태 뱃지/드롭다운 클릭)
  const handleChangeExternalStatus = async (
    e: React.MouseEvent | React.ChangeEvent<HTMLSelectElement>,
    orderNumber: string,
    source: string,
    newStatus: string
  ) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/order/unified/${orderNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('주문 상태가 변경되었습니다.')
        fetchOrders()
      } else {
        toast.error(data.error || '상태 변경에 실패했습니다.')
      }
    } catch {
      toast.error('상태 변경 중 오류가 발생했습니다.')
    }
  }

  // 외부 주문 수정
  const handleEditExternalOrder = (e: React.MouseEvent, orderNumber: string) => {
    e.stopPropagation()
    router.push(`/shop/order/external/edit/${orderNumber}`)
  }

  // 외부 주문 삭제 확인 모달 열기
  const handleDeleteExternalOrder = (e: React.MouseEvent, order: UnifiedOrder) => {
    e.stopPropagation()
    setDeleteModal({ show: true, order })
  }

  // 외부 주문 삭제 실행
  const confirmDeleteOrder = async () => {
    const order = deleteModal.order
    if (!order) return

    setDeleteModal({ show: false, order: null })

    try {
      const endpoint = order.isGuestOrder
        ? `/api/order/external/guest/${order.id}`
        : `/api/order/external/member/${order.id}`

      const res = await fetch(endpoint, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        toast.success('주문이 삭제되었습니다.')
        fetchOrders()
      } else {
        toast.error(data.error || '주문 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('주문 삭제 실패:', error)
      toast.error('주문 삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">주문 목록</h1>
            <p className="text-gray-600">
              주문 현황을 확인하고 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 저장하기 드롭다운 */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowSaveMenu((v) => !v)}
                disabled={selectedOrders.size === 0 || isSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm font-medium"
              >
                <Download size={18} />
                <span>저장하기{selectedOrders.size > 0 ? ` (${selectedOrders.size})` : ''}</span>
              </button>
              {showSaveMenu && (
                <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-10 overflow-hidden">
                  <button
                    type="button"
                    onClick={handleSaveAsText}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 text-gray-700"
                  >
                    텍스트로 저장 (.txt)
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAsExcel}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 text-gray-700 border-t border-gray-100"
                  >
                    엑셀로 저장 (.xlsx)
                  </button>
                </div>
              )}
            </div>
            <Link
              href="/shop/order/external/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
            >
              <Plus size={18} />
              <span>외부 주문 추가</span>
            </Link>
          </div>
        </div>

        {/* 상태 필터 버튼 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
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
            onClick={() => setStatusFilter(statusFilter === 'PREPARING' ? null : 'PREPARING')}
            className={`rounded-xl p-4 transition-all ${
              statusFilter === 'PREPARING'
                ? 'bg-orange-500 text-white shadow-lg scale-[1.02]'
                : 'bg-white hover:bg-orange-50 border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${statusFilter === 'PREPARING' ? 'bg-orange-400' : 'bg-orange-100'}`}>
                <Package size={20} className={statusFilter === 'PREPARING' ? 'text-white' : 'text-orange-600'} />
              </div>
              <div className="text-left">
                <p className={`text-xs ${statusFilter === 'PREPARING' ? 'text-orange-100' : 'text-gray-500'}`}>상품준비</p>
                <p className={`text-xl font-bold ${statusFilter === 'PREPARING' ? '' : 'text-orange-600'}`}>{statusCounts.PREPARING}</p>
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
              {/* 페이지 크기 선택 */}
              <div className="flex items-center gap-2 sm:ml-auto">
                <span className="text-sm text-gray-500">상품보기</span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {([20, 50, 100] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setItemsPerPage(size)
                        setPage(1)
                      }}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        itemsPerPage === size
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {size}개
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 주문 목록 */}
          {loading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              주문이 없습니다.
            </div>
          ) : (
            <>
              {/* 모바일: 카드 뷰 */}
              <div className="lg:hidden p-3 space-y-3">
                {orders.map((order) => (
                  <div
                    key={`mobile-${order.source}-${order.isGuestOrder ? 'guest' : 'member'}-${order.id}`}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/shop/order/detail/${order.orderNumber}?source=${order.source}`)}
                  >
                    {/* 상단: 주문번호 + 상태 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.orderNumber)}
                          onChange={() => toggleOrder(order.orderNumber)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 cursor-pointer mt-1"
                          aria-label={`주문 ${order.orderNumber} 선택`}
                        />
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {order.orderNumber}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(order.createdAt)}
                          </span>
                        </div>
                      </div>
                      {isExternalOrder(order.orderNumber) ? (
                        <select
                          value={order.status}
                          onChange={(e) => handleChangeExternalStatus(e, order.orderNumber, order.source, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:outline-none ${
                            order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                            order.status === 'PAID' ? 'bg-blue-100 text-blue-700' :
                            order.status === 'PREPARING' ? 'bg-orange-100 text-orange-700' :
                            order.status === 'SHIPPED' ? 'bg-indigo-100 text-indigo-700' :
                            order.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                            order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <option value="PENDING">결제대기</option>
                          <option value="PAID">결제완료</option>
                          <option value="PREPARING">배송준비중</option>
                          <option value="SHIPPED">배송중</option>
                          <option value="DELIVERED">배송완료</option>
                          <option value="CANCELLED">취소</option>
                        </select>
                      ) : (
                        getStatusBadge(order.status, order.statusLabel)
                      )}
                    </div>

                    {/* 출처 배지 */}
                    <div className="flex items-center gap-2 mb-3">
                      {getSourceBadge(order)}
                      {order.isGuestOrder ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          비회원
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          회원
                        </span>
                      )}
                    </div>

                    {/* 상품 정보 */}
                    <div className="mb-3">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {order.productSummary}
                      </p>
                      {order.itemCount > 1 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          총 {order.itemCount}개 상품
                        </p>
                      )}
                    </div>

                    {/* 하단: 고객 정보 + 금액 */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{order.customerName}</span>
                        <span className="text-xs text-gray-500">
                          {order.customerPhone ? formatPhoneNumber(order.customerPhone) : '-'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-900">
                          {formatPrice(order.totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* 외부 주문 액션 버튼 */}
                    {isExternalOrder(order.orderNumber) && (
                      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={(e) => handleEditExternalOrder(e, order.orderNumber)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit3 size={14} />
                          수정
                        </button>
                        <button
                          onClick={(e) => handleDeleteExternalOrder(e, order)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 데스크탑: 테이블 뷰 */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[3%] text-center">
                        <input
                          type="checkbox"
                          checked={selectedOrders.size === orders.length && orders.length > 0}
                          onChange={toggleAll}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 cursor-pointer"
                          aria-label="전체 선택"
                        />
                      </TableHead>
                      <TableHead className="w-[4%] text-center">No.</TableHead>
                      <TableHead className="w-[9%] text-center">출처</TableHead>
                      <TableHead className="w-[9%] text-center">주문번호</TableHead>
                      <TableHead className="w-[7%] text-center">고객명</TableHead>
                      <TableHead className="w-[6%] text-center">회원유형</TableHead>
                      <TableHead className="w-[9%] text-center">전화번호</TableHead>
                      <TableHead className="w-[18%] text-center">상품</TableHead>
                      <TableHead className="w-[7%] text-center">금액</TableHead>
                      <TableHead className="w-[7%] text-center">상태</TableHead>
                      <TableHead className="w-[12%] text-center">주문일시</TableHead>
                      <TableHead className="w-[6%] text-center">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order, index) => (
                      <TableRow
                        key={`${order.source}-${order.isGuestOrder ? 'guest' : 'member'}-${order.id}`}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/shop/order/detail/${order.orderNumber}?source=${order.source}`)}
                      >
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(order.orderNumber)}
                            onChange={() => toggleOrder(order.orderNumber)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 cursor-pointer"
                            aria-label={`주문 ${order.orderNumber} 선택`}
                          />
                        </TableCell>
                        <TableCell className="text-center text-gray-500">
                          {(page - 1) * itemsPerPage + index + 1}
                        </TableCell>
                        <TableCell className="text-center">{getSourceBadge(order)}</TableCell>
                        <TableCell className="text-center">
                          <span className="font-mono text-sm text-gray-900">
                            {order.orderNumber}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium text-gray-900">{order.customerName}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {order.isGuestOrder ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              비회원
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              회원
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-gray-600 text-sm">
                            {order.customerPhone ? formatPhoneNumber(order.customerPhone) : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="font-medium text-gray-900 truncate max-w-[250px]">
                            {order.productSummary}
                          </div>
                          {order.itemCount > 1 && (
                            <div className="text-xs text-gray-500">
                              총 {order.itemCount}개 상품
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium text-gray-900">
                            {formatPrice(order.totalAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          {isExternalOrder(order.orderNumber) ? (
                            // 외부주문: 드롭다운으로 직접 상태 변경 가능
                            <select
                              value={order.status}
                              onChange={(e) => handleChangeExternalStatus(e, order.orderNumber, order.source, e.target.value)}
                              className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                                order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                order.status === 'PAID' ? 'bg-blue-100 text-blue-700' :
                                order.status === 'PREPARING' ? 'bg-orange-100 text-orange-700' :
                                order.status === 'SHIPPED' ? 'bg-indigo-100 text-indigo-700' :
                                order.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                                order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="PENDING">결제대기</option>
                              <option value="PAID">결제완료</option>
                              <option value="PREPARING">배송준비중</option>
                              <option value="SHIPPED">배송중</option>
                              <option value="DELIVERED">배송완료</option>
                              <option value="CANCELLED">취소</option>
                            </select>
                          ) : (
                            getStatusBadge(order.status, order.statusLabel)
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-gray-600 text-sm">
                            {formatDate(order.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {isExternalOrder(order.orderNumber) && (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => handleEditExternalOrder(e, order.orderNumber)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="수정"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={(e) => handleDeleteExternalOrder(e, order)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="삭제"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 gap-3">
              <p className="text-xs sm:text-sm text-gray-600">
                총 {total}건 중 {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, total)}건
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2.5 sm:p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-600 min-w-[60px] text-center">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2.5 sm:p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteModal.show && deleteModal.order && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">주문 삭제 확인</h3>
            <p className="text-gray-600 mb-6">
              주문번호 <span className="font-semibold">{deleteModal.order.orderNumber}</span>을(를) 삭제하시겠습니까?
              <br />
              <span className="text-sm text-red-600 mt-2 block">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ show: false, order: null })}
                className="flex-1 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmDeleteOrder}
                className="flex-1 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
