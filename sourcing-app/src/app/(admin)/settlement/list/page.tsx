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
  AlertCircle,
  History,
  CheckCircle,
  ShoppingCart,
  FileText,
  ExternalLink,
  TrendingUp,
  X,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import SettlementModal from '@/components/settlement/SettlementModal'
import { useToast } from '@/components/ui/Toast'

interface OrderItem {
  id: number
  orderId: number | null
  channel: 'SHOP' | 'WEBHOOK'
  orderNumber: string
  customerName: string
  productName: string
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  status: string
  orderedAt: string
  channelId: number | null
  channelName: string | null
}

interface ChannelData {
  id: number
  name: string
  coverUrl: string | null
  platform: string
  items: OrderItem[]
  itemCount: number
  shopCount: number
  webhookCount: number
  totalQuantity: number
  totalAmount: number
}

interface PlatformGroup {
  platform: string
  platformName: string
  channels: ChannelData[]
  itemCount: number
  totalQuantity: number
  totalAmount: number
}

interface SettlementData {
  platforms: PlatformGroup[]
  channels: ChannelData[]
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
    webhookCount: number
  }
}

// 플랫폼별 색상 팔레트
const PLATFORM_COLORS: Record<string, {
  bg: string
  border: string
  text: string
  accent: string
  light: string
  gradient: string
}> = {
  BAND: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    accent: 'bg-emerald-500',
    light: 'bg-emerald-100',
    gradient: 'from-emerald-500 to-teal-500',
  },
  SHOP: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    accent: 'bg-blue-500',
    light: 'bg-blue-100',
    gradient: 'from-blue-500 to-indigo-500',
  },
  ALIEXPRESS: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-700',
    accent: 'bg-orange-500',
    light: 'bg-orange-100',
    gradient: 'from-orange-500 to-red-500',
  },
  NAVER_CAFE: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-700',
    accent: 'bg-green-500',
    light: 'bg-green-100',
    gradient: 'from-green-500 to-lime-500',
  },
  COUPANG: {
    bg: 'bg-rose-50',
    border: 'border-rose-300',
    text: 'text-rose-700',
    accent: 'bg-rose-500',
    light: 'bg-rose-100',
    gradient: 'from-rose-500 to-pink-500',
  },
  SMARTSTORE: {
    bg: 'bg-lime-50',
    border: 'border-lime-300',
    text: 'text-lime-700',
    accent: 'bg-lime-500',
    light: 'bg-lime-100',
    gradient: 'from-lime-500 to-green-500',
  },
}

const DEFAULT_COLOR = {
  bg: 'bg-gray-50',
  border: 'border-gray-300',
  text: 'text-gray-700',
  accent: 'bg-gray-500',
  light: 'bg-gray-100',
  gradient: 'from-gray-500 to-slate-500',
}

const PLATFORM_LABELS: Record<string, string> = {
  BAND: '밴드',
  SHOP: '쇼핑몰',
  ALIEXPRESS: '알리익스프레스',
  NAVER_CAFE: '네이버 카페',
  COUPANG: '쿠팡',
  SMARTSTORE: '스마트스토어',
}

export default function SettlementListPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SettlementData | null>(null)
  const [showUnclassified, setShowUnclassified] = useState(false)

  // 필터 상태
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')

  // 선택된 채널 상세 보기
  const [selectedChannel, setSelectedChannel] = useState<ChannelData | null>(null)

  // 정산 모달 상태
  const [settlementModal, setSettlementModal] = useState<{
    isOpen: boolean
    channelId: number
    channelName: string
  } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (selectedChannelId) params.set('channelId', selectedChannelId)

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
  }, [startDate, endDate, selectedChannelId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatPrice = (price: number | null) => {
    if (!price) return '0원'
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

  const getColorScheme = (platform: string) => {
    return PLATFORM_COLORS[platform] || DEFAULT_COLOR
  }

  const openSettlementModal = (channelId: number, channelName: string) => {
    setSettlementModal({ isOpen: true, channelId, channelName })
  }

  const closeSettlementModal = () => {
    setSettlementModal(null)
  }

  // 채널 뱃지 컴포넌트
  const ChannelBadge = ({ channel }: { channel: 'SHOP' | 'WEBHOOK' }) => {
    if (channel === 'SHOP') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
          <ShoppingCart size={10} />
          쇼핑몰
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
        <FileText size={10} />
        웹훅
      </span>
    )
  }

  // 채널 카드 컴포넌트
  const ChannelCard = ({ channel }: { channel: ChannelData }) => {
    const colors = getColorScheme(channel.platform)
    const isSelected = selectedChannel?.id === channel.id

    return (
      <div
        className={`
          relative overflow-hidden rounded-xl border-2 transition-all duration-200 cursor-pointer
          ${isSelected ? `${colors.border} ring-2 ring-offset-2 ${colors.border.replace('border-', 'ring-')}` : 'border-gray-200 hover:border-gray-300'}
          ${colors.bg}
        `}
        onClick={() => setSelectedChannel(isSelected ? null : channel)}
      >
        {/* 상단 색상 바 */}
        <div className={`h-2 bg-gradient-to-r ${colors.gradient}`} />

        <div className="p-4">
          {/* 채널 정보 헤더 */}
          <div className="flex items-start gap-3 mb-4">
            {channel.coverUrl ? (
              <Image
                src={channel.coverUrl}
                alt={channel.name}
                width={48}
                height={48}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-white shadow-sm"
              />
            ) : (
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colors.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <Store size={20} className="text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{channel.name}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colors.light} ${colors.text}`}>
                {PLATFORM_LABELS[channel.platform] || channel.platform}
              </span>
            </div>
          </div>

          {/* 금액 표시 */}
          <div className="mb-4">
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${colors.text}`}>
                {channel.totalAmount.toLocaleString()}
              </span>
              <span className="text-gray-500 text-sm">원</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp size={14} className="text-gray-400" />
              <span className="text-sm text-gray-500">총 {channel.itemCount}건 주문</span>
            </div>
          </div>

          {/* 정산 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              openSettlementModal(channel.id, channel.name)
            }}
            className={`w-full py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${colors.accent} hover:opacity-90`}
          >
            <CheckCircle size={14} />
            정산하기
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
            소매채널별로 주문된 상품을 확인하고 정산 내역을 관리합니다.
          </p>
        </div>

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
                <p className="text-sm text-gray-500">소매채널</p>
                <p className="text-2xl font-bold text-purple-600">{data?.channels.length || 0}개</p>
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
          {/* 정산 이력 카드 */}
          <button
            onClick={() => router.push('/settlement/history')}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <History size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">정산</p>
                <p className="text-lg font-bold text-blue-600">이력 보기</p>
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
            {/* 채널 카드 그리드 */}
            {data.channels.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">소매채널별 정산 현황</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {data.channels.map((channel) => (
                    <ChannelCard key={channel.id} channel={channel} />
                  ))}
                </div>
              </div>
            )}

            {/* 선택된 채널 상세 */}
            {selectedChannel && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className={`p-4 border-b ${getColorScheme(selectedChannel.platform).bg}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedChannel.coverUrl ? (
                        <Image
                          src={selectedChannel.coverUrl}
                          alt={selectedChannel.name}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getColorScheme(selectedChannel.platform).gradient} flex items-center justify-center`}>
                          <Store size={20} className="text-white" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{selectedChannel.name} 주문 상세</h3>
                        <p className="text-sm text-gray-600">
                          총 {selectedChannel.itemCount}건 | 매출 {formatPrice(selectedChannel.totalAmount)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedChannel(null)}
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">채널</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문번호</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문자</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">수량</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">금액</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedChannel.items.map((item) => (
                        <tr key={`${item.channel}-${item.id}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <ChannelBadge channel={item.channel} />
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">
                            {item.orderId ? (
                              <a
                                href={`/order/${item.orderId}`}
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
                                <Image
                                  src={item.thumbnailUrl}
                                  alt={item.productName}
                                  width={32}
                                  height={32}
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
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              item.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                              item.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                              item.status === 'PAID' ? 'bg-yellow-100 text-yellow-700' :
                              item.status === 'WEBHOOK' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {item.status === 'DELIVERED' ? '배송완료' :
                               item.status === 'SHIPPED' ? '배송중' :
                               item.status === 'PAID' ? '결제완료' :
                               item.status === 'PENDING' ? '대기중' :
                               item.status === 'WEBHOOK' ? '웹훅' : item.status}
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
                        PublishedProduct에 매칭되지 않은 주문입니다.
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
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">채널</th>
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
                            <tr key={`${item.channel}-${item.id}`} className="hover:bg-orange-50">
                              <td className="px-4 py-3">
                                <ChannelBadge channel={item.channel} />
                              </td>
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
            {data.channels.length === 0 && data.unclassified.itemCount === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Store size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">정산 데이터가 없습니다</h3>
                <p className="text-gray-500">
                  소매채널에 상품을 발행하고 주문이 들어오면 이곳에서 확인할 수 있습니다.
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
          channelId={settlementModal.channelId}
          channelName={settlementModal.channelName}
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
