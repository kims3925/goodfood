'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Store,
  ChevronDown,
  ChevronUp,
  Calendar,
  DollarSign,
  ShoppingBag,
  Package,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  TrendingUp,
  X,
  Globe,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import SettlementModal from '@/components/settlement/SettlementModal'
import { useToast } from '@/components/ui/Toast'

interface OrderItem {
  id: number
  orderId: number | null
  orderNumber: string
  customerName: string
  productName: string
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  wholesalePrice: number | null
  marginRate: number | null
  margin: number | null
  status: string
  orderedAt: string
  shopId: number | null
  shopName: string | null
  isSettled: boolean
}

interface ShopData {
  id: number
  name: string
  subdomain: string
  coverUrl: string | null
  logoUrl: string | null
  channelId: number | null  // 연결된 소매 채널 ID (정산용)
  channelName: string | null
  items: OrderItem[]
  itemCount: number
  totalQuantity: number
  totalAmount: number
}

interface SettlementData {
  shops: ShopData[]
  unclassified: {
    items: OrderItem[]
    itemCount: number
    totalQuantity: number
    totalAmount: number
  }
  summary: {
    totalItems: number
    totalQuantity: number
    totalAmount: number
    classifiedItems: number
    classifiedAmount: number
    shopCount: number
    settledCount: number
    settledAmount: number
    unsettledCount: number
    unsettledAmount: number
  }
}

export default function SettlementListPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SettlementData | null>(null)
  const [showUnclassified, setShowUnclassified] = useState(false)

  // 필터 상태
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 선택된 쇼핑몰 상세 보기
  const [selectedShop, setSelectedShop] = useState<ShopData | null>(null)

  // 정산 모달 상태
  const [settlementModal, setSettlementModal] = useState<{
    isOpen: boolean
    shopId: number
    shopName: string
    channelId: number | null
    totalAmount: number
    orderCount: number
    items: OrderItem[]
  } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

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
  }, [startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatPrice = (price: number | null) => {
    if (!price) return '0원'
    return `${price.toLocaleString()}원`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }

  const openSettlementModal = (shop: ShopData) => {
    setSettlementModal({
      isOpen: true,
      shopId: shop.id,
      shopName: shop.name,
      channelId: shop.channelId,
      totalAmount: shop.totalAmount,
      orderCount: shop.itemCount,
      items: shop.items,
    })
  }

  const closeSettlementModal = () => {
    setSettlementModal(null)
  }

  // 쇼핑몰 카드 컴포넌트
  const ShopCard = ({ shop }: { shop: ShopData }) => {
    const isSelected = selectedShop?.id === shop.id
    const settledCount = shop.items.filter(i => i.isSettled).length
    const unsettledCount = shop.items.filter(i => !i.isSettled).length
    const unsettledAmount = shop.items.filter(i => !i.isSettled).reduce((sum, i) => sum + i.totalPrice, 0)

    return (
      <div
        className={`
          relative overflow-hidden rounded-xl border-2 transition-all duration-200 cursor-pointer
          ${isSelected ? 'border-blue-400 ring-2 ring-offset-2 ring-blue-400' : 'border-gray-200 hover:border-gray-300'}
          bg-white
        `}
        onClick={() => setSelectedShop(isSelected ? null : shop)}
      >
        {/* 상단 색상 바 */}
        <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500" />

        <div className="p-4">
          {/* 쇼핑몰 정보 헤더 */}
          <div className="flex items-start gap-3 mb-4">
            {shop.logoUrl ? (
              <img
                src={shop.logoUrl}
                alt={shop.name}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-200 shadow-sm"
              />
            ) : shop.coverUrl ? (
              <img
                src={shop.coverUrl}
                alt={shop.name}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-200 shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Store size={20} className="text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{shop.name}</h3>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Globe size={12} />
                <span>{shop.subdomain}.shop.com</span>
              </div>
            </div>
          </div>

          {/* 금액 표시 */}
          <div className="mb-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-blue-600">
                {shop.totalAmount.toLocaleString()}
              </span>
              <span className="text-gray-500 text-sm">원</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp size={14} className="text-gray-400" />
              <span className="text-sm text-gray-500">총 {shop.itemCount}건 주문</span>
            </div>
          </div>

          {/* 정산 현황 */}
          <div className="flex gap-2 mb-3 text-xs">
            {unsettledCount > 0 && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                미정산 {unsettledCount}건
              </span>
            )}
            {settledCount > 0 && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                정산완료 {settledCount}건
              </span>
            )}
          </div>

          {/* 정산 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              openSettlementModal(shop)
            }}
            className={`w-full py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              unsettledCount > 0
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-gray-400 hover:bg-gray-500'
            }`}
          >
            <CheckCircle size={14} />
            {unsettledCount > 0 ? `정산하기 (${formatPrice(unsettledAmount)})` : '전체 정산 완료'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">정산 관리</h1>
          <p className="text-gray-600">
            쇼핑몰별로 주문된 상품을 확인하고 정산 내역을 관리합니다.
          </p>
        </div>

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ShoppingBag size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">총 주문</p>
                <p className="text-2xl font-bold text-gray-900">{data?.summary.totalItems || 0}건</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">총 매출</p>
                <p className="text-2xl font-bold text-green-600">{formatPrice(data?.summary.totalAmount || 0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Store size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">쇼핑몰</p>
                <p className="text-2xl font-bold text-purple-600">{data?.summary.shopCount || 0}개</p>
              </div>
            </div>
          </div>
          {/* 새로고침 카드 */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <RefreshCw size={24} className={`text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">데이터</p>
                <p className="text-lg font-bold text-gray-600">새로고침</p>
              </div>
            </div>
          </button>
        </div>

        {/* 필터 영역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-sm text-gray-500">기간:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X size={14} />
                필터 초기화
              </button>
            )}
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <Loading />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* 쇼핑몰 카드 그리드 */}
            {data.shops.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">쇼핑몰별 정산 현황</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {data.shops.map((shop) => (
                    <ShopCard key={shop.id} shop={shop} />
                  ))}
                </div>
              </div>
            )}

            {/* 선택된 쇼핑몰 상세 */}
            {selectedShop && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-blue-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedShop.logoUrl ? (
                        <img
                          src={selectedShop.logoUrl}
                          alt={selectedShop.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : selectedShop.coverUrl ? (
                        <img
                          src={selectedShop.coverUrl}
                          alt={selectedShop.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                          <Store size={20} className="text-white" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{selectedShop.name} 주문 상세</h3>
                        <p className="text-sm text-gray-600">
                          총 {selectedShop.itemCount}건 | 매출 {formatPrice(selectedShop.totalAmount)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedShop(null)}
                      className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                    >
                      <X size={20} className="text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* 주문 목록 */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문번호</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문자</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">수량</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">금액</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">마진율</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">정산</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedShop.items.map((item) => (
                        <tr key={item.id} className={`hover:bg-gray-50 ${item.isSettled ? 'bg-green-50/50' : ''}`}>
                          <td className="px-4 py-3 text-sm font-mono">
                            {item.orderId ? (
                              <a
                                href={`/shop/order/detail/${item.orderNumber}?source=SHOPPING_MALL`}
                                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {item.orderNumber}
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span className="text-gray-900">{item.orderNumber}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {item.thumbnailUrl ? (
                                <img
                                  src={item.thumbnailUrl}
                                  alt={item.productName}
                                  className="w-8 h-8 rounded object-cover"
                                />
                              ) : (
                                <Package size={16} className="text-gray-400 flex-shrink-0" />
                              )}
                              <span className="text-sm text-gray-900 line-clamp-1">{item.productName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.customerName}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.quantity}개</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatPrice(item.totalPrice)}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {item.marginRate !== null ? (
                              <span className={`font-medium ${
                                item.marginRate >= 30 ? 'text-green-600' :
                                item.marginRate >= 15 ? 'text-blue-600' :
                                item.marginRate >= 0 ? 'text-orange-600' :
                                'text-red-600'
                              }`}>
                                {item.marginRate}%
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.isSettled ? (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                완료
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                                미정산
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              item.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                              item.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                              item.status === 'PAID' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {item.status === 'DELIVERED' ? '배송완료' :
                               item.status === 'SHIPPED' ? '배송중' :
                               item.status === 'PAID' ? '결제완료' :
                               item.status === 'PENDING' ? '대기중' : item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(item.orderedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 미분류 주문 */}
            {data.unclassified.itemCount > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                <button
                  onClick={() => setShowUnclassified(!showUnclassified)}
                  className="w-full p-4 flex items-center justify-between hover:bg-orange-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                      <AlertCircle size={20} className="text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">미분류 주문</h3>
                      <p className="text-sm text-gray-500">
                        쇼핑몰에 매칭되지 않은 주문입니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-600">
                        {formatPrice(data.unclassified.totalAmount)}
                      </p>
                      <p className="text-sm text-gray-500">{data.unclassified.itemCount}건</p>
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
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문번호</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문자</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수량</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">금액</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문일</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100">
                          {data.unclassified.items.map((item) => (
                            <tr key={item.id} className="hover:bg-orange-50">
                              <td className="px-4 py-3 text-sm text-gray-900 font-mono">{item.orderNumber}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.productName}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.customerName}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}개</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatPrice(item.totalPrice)}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{formatDate(item.orderedAt)}</td>
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
            {data.shops.length === 0 && data.unclassified.itemCount === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Store size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">정산 데이터가 없습니다</h3>
                <p className="text-gray-500">
                  쇼핑몰에서 주문이 들어오면 이곳에서 확인할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <AlertCircle size={48} className="mx-auto text-red-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">데이터를 불러오지 못했습니다</h3>
            <p className="text-gray-500 mb-4">잠시 후 다시 시도해주세요.</p>
            <Button variant="primary" onClick={fetchData}>
              다시 시도
            </Button>
          </div>
        )}
      </div>

      {/* 정산 모달 */}
      {settlementModal && (
        <SettlementModal
          shopId={settlementModal.shopId}
          shopName={settlementModal.shopName}
          channelId={settlementModal.channelId}
          periodStart={startDate}
          periodEnd={endDate}
          totalAmount={settlementModal.totalAmount}
          orderCount={settlementModal.orderCount}
          items={settlementModal.items}
          onClose={closeSettlementModal}
          onSuccess={() => {
            fetchData()
            toast.success('정산이 생성되었습니다.')
          }}
        />
      )}
    </div>
  )
}
