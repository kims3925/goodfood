'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  RefreshCw,
  Store,
  ChevronDown,
  ChevronUp,
  Calendar,
  DollarSign,
  ShoppingBag,
  Package,
  ExternalLink,
  AlertCircle,
  Filter,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'

interface Order {
  id: number
  productId: number | null
  productName: string
  matchedProductName: string | null
  thumbnailUrl: string | null
  totalPrice: number | null
  customerName: string
  createdAt: string
}

interface RetailBandData {
  id: number
  name: string
  coverUrl: string | null
  orders: Order[]
  orderCount: number
  totalAmount: number
}

interface SettlementData {
  retailBands: RetailBandData[]
  unclassified: {
    orders: Order[]
    orderCount: number
    totalAmount: number
  }
  summary: {
    totalOrders: number
    totalAmount: number
    classifiedOrders: number
    classifiedAmount: number
  }
}

export default function SettlementListPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SettlementData | null>(null)
  const [expandedBands, setExpandedBands] = useState<Set<number>>(new Set())
  const [showUnclassified, setShowUnclassified] = useState(false)

  // 필터 상태
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedBandId, setSelectedBandId] = useState<string>('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (selectedBandId) params.set('retailBandId', selectedBandId)

      const res = await fetch(`/api/settlement?${params}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('정산 데이터 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedBandId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleBandExpansion = (bandId: number) => {
    setExpandedBands(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bandId)) {
        newSet.delete(bandId)
      } else {
        newSet.add(bandId)
      }
      return newSet
    })
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `${price.toLocaleString()}원`
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

  const goToOrder = (orderId: number) => {
    router.push(`/order/${orderId}`)
  }

  const goToProduct = (productId: number) => {
    router.push(`/product/detail/${productId}`)
  }

  const handleFilter = () => {
    fetchData()
  }

  const handleResetFilter = () => {
    setStartDate('')
    setEndDate('')
    setSelectedBandId('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">정산 관리</h1>
          <p className="text-gray-600">
            소매밴드별로 주문된 상품을 확인하고 정산 내역을 관리합니다.
          </p>
        </div>

        {/* 통계 카드 */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <ShoppingBag className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">총 주문</p>
                  <p className="text-xl font-bold text-gray-900">{data.summary.totalOrders}건</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <DollarSign className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">총 매출</p>
                  <p className="text-xl font-bold text-gray-900">{formatPrice(data.summary.totalAmount)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Store className="text-purple-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">분류된 주문</p>
                  <p className="text-xl font-bold text-gray-900">{data.summary.classifiedOrders}건</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <AlertCircle className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">미분류 주문</p>
                  <p className="text-xl font-bold text-gray-900">{data.unclassified.orderCount}건</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 필터 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-gray-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">~</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {data && data.retailBands.length > 0 && (
                  <select
                    value={selectedBandId}
                    onChange={(e) => setSelectedBandId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">전체 소매밴드</option>
                    {data.retailBands.map((band) => (
                      <option key={band.id} value={band.id.toString()}>
                        {band.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleResetFilter}>
                  초기화
                </Button>
                <Button variant="primary" onClick={handleFilter}>
                  <Filter size={16} />
                  필터 적용
                </Button>
                <Button
                  variant="secondary"
                  onClick={fetchData}
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  새로고침
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
            <Loading />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* 소매밴드별 주문 목록 */}
            {data.retailBands.map((band) => (
              <div
                key={band.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* 밴드 헤더 */}
                <button
                  onClick={() => toggleBandExpansion(band.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {band.coverUrl ? (
                      <Image
                        src={band.coverUrl}
                        alt={band.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <Store size={20} className="text-white" />
                      </div>
                    )}
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{band.name}</h3>
                      <p className="text-sm text-gray-500">
                        주문 {band.orderCount}건 | 매출 {formatPrice(band.totalAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatPrice(band.totalAmount)}</p>
                      <p className="text-sm text-gray-500">{band.orderCount}건</p>
                    </div>
                    {expandedBands.has(band.id) ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {/* 주문 목록 */}
                {expandedBands.has(band.id) && (
                  <div className="border-t border-gray-200">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              주문 ID
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              상품
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              주문자
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              금액
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              주문일
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              관리
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {band.orders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                #{order.id}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {order.thumbnailUrl ? (
                                    <Image
                                      src={order.thumbnailUrl}
                                      alt={order.productName}
                                      width={40}
                                      height={40}
                                      className="w-10 h-10 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                                      <Package size={16} className="text-gray-400" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                                      {order.productName}
                                    </p>
                                    {order.matchedProductName && order.matchedProductName !== order.productName && (
                                      <p className="text-xs text-gray-500 line-clamp-1">
                                        매칭: {order.matchedProductName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {order.customerName}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {formatPrice(order.totalPrice)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {formatDate(order.createdAt)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => goToOrder(order.id)}
                                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                  >
                                    주문 <ExternalLink size={12} />
                                  </button>
                                  {order.productId && (
                                    <button
                                      onClick={() => goToProduct(order.productId!)}
                                      className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1"
                                    >
                                      상품 <ExternalLink size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* 미분류 주문 */}
            {data.unclassified.orderCount > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-orange-200 overflow-hidden">
                <button
                  onClick={() => setShowUnclassified(!showUnclassified)}
                  className="w-full p-4 flex items-center justify-between hover:bg-orange-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                      <AlertCircle size={20} className="text-orange-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">미분류 주문</h3>
                      <p className="text-sm text-gray-500">
                        소매밴드에 발행되지 않은 상품의 주문입니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-600">
                        {formatPrice(data.unclassified.totalAmount)}
                      </p>
                      <p className="text-sm text-gray-500">{data.unclassified.orderCount}건</p>
                    </div>
                    {showUnclassified ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {showUnclassified && (
                  <div className="border-t border-orange-200">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-orange-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              주문 ID
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              상품
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              주문자
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              금액
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              주문일
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              관리
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100">
                          {data.unclassified.orders.map((order) => (
                            <tr key={order.id} className="hover:bg-orange-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                #{order.id}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {order.thumbnailUrl ? (
                                    <Image
                                      src={order.thumbnailUrl}
                                      alt={order.productName}
                                      width={40}
                                      height={40}
                                      className="w-10 h-10 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                                      <Package size={16} className="text-gray-400" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                                      {order.productName}
                                    </p>
                                    {!order.productId && (
                                      <p className="text-xs text-orange-600">매칭된 상품 없음</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {order.customerName}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {formatPrice(order.totalPrice)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {formatDate(order.createdAt)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => goToOrder(order.id)}
                                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                  >
                                    주문 <ExternalLink size={12} />
                                  </button>
                                  {order.productId && (
                                    <button
                                      onClick={() => goToProduct(order.productId!)}
                                      className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1"
                                    >
                                      상품 <ExternalLink size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 데이터 없음 */}
            {data.retailBands.length === 0 && data.unclassified.orderCount === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <Store size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">정산 데이터가 없습니다</h3>
                <p className="text-gray-500">
                  소매밴드에 상품을 발행하고 주문이 들어오면 이곳에서 확인할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <AlertCircle size={48} className="mx-auto text-red-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">데이터를 불러오지 못했습니다</h3>
            <p className="text-gray-500 mb-4">
              잠시 후 다시 시도해주세요.
            </p>
            <Button variant="primary" onClick={fetchData}>
              다시 시도
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
