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
  CreditCard,
  Building,
  Wallet,
  XCircle,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import SettlementModal from '@/components/settlement/SettlementModal'
import { useToast } from '@/components/ui/Toast'

// 결제 수단 타입
type TossPaymentMethod = 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER' | 'MOBILE' | 'CULTURE_GIFT' | 'BOOK_GIFT' | 'GAME_GIFT' | 'BANK_TRANSFER'
// 결제 상태 타입
type TossPaymentStatus = 'READY' | 'IN_PROGRESS' | 'WAITING_FOR_DEPOSIT' | 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | 'EXPIRED'

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
  // 결제 정보
  paymentMethod: TossPaymentMethod | null
  paymentStatus: TossPaymentStatus | null
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

// 토스페이먼츠 개별 거래 타입
interface TossTransaction {
  mId: string
  transactionKey: string
  paymentKey: string
  orderId: string
  orderName: string
  method: TossPaymentMethod | string
  status: TossPaymentStatus
  requestedAt: string
  approvedAt: string | null
  amount: number
  balanceAmount: number
  suppliedAmount: number
  vat: number
  receipt?: {
    url: string
  }
  cancels?: Array<{
    cancelAmount: number
    canceledAt: string
    cancelReason: string
  }>
}

// 토스페이먼츠 거래 조회 응답 타입
interface TossTransactionsSummary {
  totalAmount: number
  totalCount: number
  cardAmount: number
  cardCount: number
  tossPayAmount: number
  tossPayCount: number
  canceledAmount: number
  canceledCount: number
  methodTypes?: string[]  // 디버깅용
}

interface TossTransactionsData {
  period: {
    year: number
    month: number
    startDate: string
    endDate: string
  }
  summary: TossTransactionsSummary
  transactions: TossTransaction[]
}

// 토스페이먼츠 대시보드 URL 생성
const getTossDashboardUrl = () => {
  const merchantId = process.env.NEXT_PUBLIC_TOSS_MERCHANT_ID
  if (!merchantId) return null
  return `https://dashboard.tosspayments.com/sales-reports?mid=${encodeURIComponent(merchantId)}`
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

  // 토스페이먼츠 거래 조회 상태
  const [tossData, setTossData] = useState<TossTransactionsData | null>(null)
  const [tossLoading, setTossLoading] = useState(false)
  const [tossError, setTossError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

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

  // 토스페이먼츠 거래 조회
  const fetchTossTransactions = useCallback(async () => {
    setTossLoading(true)
    setTossError(null)
    try {
      const res = await fetch(`/api/settlement/toss-transactions?year=${selectedYear}&month=${selectedMonth}`)
      const result = await res.json()

      if (result.success) {
        setTossData(result.data)
      } else {
        setTossError(result.error || '거래 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('토스페이먼츠 거래 조회 실패:', error)
      setTossError('거래 조회 중 오류가 발생했습니다.')
    } finally {
      setTossLoading(false)
    }
  }, [selectedYear, selectedMonth])

  useEffect(() => {
    fetchTossTransactions()
  }, [fetchTossTransactions])

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

  // 결제 상태 라벨 및 스타일 반환
  const getPaymentStatusInfo = (method: TossPaymentMethod | null, status: TossPaymentStatus | null): {
    label: string
    bgColor: string
    textColor: string
    icon: typeof CreditCard
  } => {
    if (!method || !status) {
      return { label: '정보없음', bgColor: 'bg-gray-100', textColor: 'text-gray-500', icon: AlertCircle }
    }

    // 가상계좌 (현금입금)
    if (method === 'VIRTUAL_ACCOUNT') {
      if (status === 'WAITING_FOR_DEPOSIT') {
        return { label: '결제대기', bgColor: 'bg-amber-100', textColor: 'text-amber-700', icon: Building }
      }
      if (status === 'DONE') {
        return { label: '계좌입금완료', bgColor: 'bg-green-100', textColor: 'text-green-700', icon: Building }
      }
      if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
        return { label: '취소', bgColor: 'bg-red-100', textColor: 'text-red-700', icon: XCircle }
      }
      if (status === 'EXPIRED') {
        return { label: '입금기한만료', bgColor: 'bg-gray-100', textColor: 'text-gray-500', icon: Building }
      }
      return { label: '입금대기', bgColor: 'bg-amber-100', textColor: 'text-amber-700', icon: Building }
    }

    // 카드 결제
    if (method === 'CARD') {
      if (status === 'DONE') {
        return { label: '결제완료', bgColor: 'bg-blue-100', textColor: 'text-blue-700', icon: CreditCard }
      }
      if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
        return { label: '취소', bgColor: 'bg-red-100', textColor: 'text-red-700', icon: XCircle }
      }
      return { label: '카드결제중', bgColor: 'bg-blue-100', textColor: 'text-blue-600', icon: CreditCard }
    }

    // 계좌이체
    if (method === 'TRANSFER' || method === 'BANK_TRANSFER') {
      if (status === 'DONE') {
        return { label: '이체완료', bgColor: 'bg-green-100', textColor: 'text-green-700', icon: Wallet }
      }
      return { label: '이체중', bgColor: 'bg-blue-100', textColor: 'text-blue-600', icon: Wallet }
    }

    // 기타 결제 수단
    if (status === 'DONE') {
      return { label: '결제완료', bgColor: 'bg-green-100', textColor: 'text-green-700', icon: CheckCircle }
    }
    if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
      return { label: '취소', bgColor: 'bg-red-100', textColor: 'text-red-700', icon: XCircle }
    }

    return { label: '처리중', bgColor: 'bg-gray-100', textColor: 'text-gray-600', icon: AlertCircle }
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
            className={`w-full py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${unsettledCount > 0
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

        {/* 토스페이먼츠 결제 현황 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg mb-6 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CreditCard size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">토스페이먼츠 결제 현황</h2>
                  <p className="text-blue-100 text-sm">PG사 연동 실시간 데이터</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i).map((y) => (
                    <option key={y} value={y} className="text-gray-900">{y}년</option>
                  ))}
                </select>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m} className="text-gray-900">{m}월</option>
                  ))}
                </select>
                <button
                  onClick={fetchTossTransactions}
                  disabled={tossLoading}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <RefreshCw size={20} className={`text-white ${tossLoading ? 'animate-spin' : ''}`} />
                </button>
                {getTossDashboardUrl() && (
                  <a
                    href={getTossDashboardUrl()!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    title="토스페이먼츠 대시보드"
                  >
                    <ExternalLink size={20} className="text-white" />
                  </a>
                )}
              </div>
            </div>

            {tossLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            ) : tossError ? (
              <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4 text-white">
                <div className="flex items-center gap-2">
                  <AlertCircle size={20} />
                  <span>{tossError}</span>
                </div>
              </div>
            ) : tossData ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 총 결제 금액 */}
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign size={18} className="text-green-300" />
                    <span className="text-blue-100 text-sm">총 결제</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {tossData.summary.totalAmount.toLocaleString()}
                    <span className="text-sm font-normal text-blue-200 ml-1">원</span>
                  </p>
                  <p className="text-blue-200 text-xs mt-1">{tossData.summary.totalCount}건</p>
                </div>

                {/* 카드 결제 */}
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard size={18} className="text-purple-300" />
                    <span className="text-blue-100 text-sm">카드</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {tossData.summary.cardAmount.toLocaleString()}
                    <span className="text-sm font-normal text-blue-200 ml-1">원</span>
                  </p>
                  <p className="text-blue-200 text-xs mt-1">{tossData.summary.cardCount}건</p>
                </div>

                {/* 토스페이 (간편결제) */}
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet size={18} className="text-cyan-300" />
                    <span className="text-blue-100 text-sm">토스페이</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {(tossData.summary.tossPayAmount || 0).toLocaleString()}
                    <span className="text-sm font-normal text-blue-200 ml-1">원</span>
                  </p>
                  <p className="text-blue-200 text-xs mt-1">{tossData.summary.tossPayCount || 0}건</p>
                </div>

                {/* 취소 */}
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle size={18} className="text-red-300" />
                    <span className="text-blue-100 text-sm">취소</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {tossData.summary.canceledAmount.toLocaleString()}
                    <span className="text-sm font-normal text-blue-200 ml-1">원</span>
                  </p>
                  <p className="text-blue-200 text-xs mt-1">{tossData.summary.canceledCount}건</p>
                </div>
              </div>
            ) : null}

            {/* 디버깅: method 타입들 표시 */}
            {tossData?.summary.methodTypes && tossData.summary.methodTypes.length > 0 && (
              <div className="mt-4 text-xs text-blue-200">
                결제수단 종류: {tossData.summary.methodTypes.join(', ')}
              </div>
            )}
          </div>
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
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">결제</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">정산</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">배송</th>
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
                              <span className={`font-medium ${item.marginRate >= 30 ? 'text-green-600' :
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
                            {(() => {
                              const paymentInfo = getPaymentStatusInfo(item.paymentMethod, item.paymentStatus)
                              const PaymentIcon = paymentInfo.icon
                              return (
                                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${paymentInfo.bgColor} ${paymentInfo.textColor}`}>
                                  <PaymentIcon size={12} />
                                  {paymentInfo.label}
                                </span>
                              )
                            })()}
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
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${item.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
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
