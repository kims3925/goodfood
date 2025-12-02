'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  RefreshCw,
  Store,
  ChevronDown,
  ChevronRight,
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
  Calculator,
  Check,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import SettlementModal from '@/components/settlement/SettlementModal'
import { useToast } from '@/components/ui/Toast'

const BandIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  </svg>
)

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

interface SettlementData {
  platforms: {
    platform: string
    platformName: string
    channels: ChannelData[]
    itemCount: number
    totalQuantity: number
    totalAmount: number
  }[]
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

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bgColor: string; textColor: string; icon: React.ReactNode }> = {
  BAND: { label: '밴드', color: 'text-green-600', bgColor: 'bg-green-100', textColor: 'text-green-700', icon: <BandIcon size={14} /> },
  ALIEXPRESS: { label: '알리익스프레스', color: 'text-orange-600', bgColor: 'bg-orange-100', textColor: 'text-orange-700', icon: <Package size={14} /> },
  OTHER: { label: '기타', color: 'text-gray-600', bgColor: 'bg-gray-100', textColor: 'text-gray-700', icon: <Store size={14} /> },
}

export default function SettlementTestPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SettlementData | null>(null)

  // 채널 선택 상태
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([])

  // 확장된 채널 (아코디언)
  const [expandedChannelIds, setExpandedChannelIds] = useState<number[]>([])

  // 필터 상태
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

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

  // 플랫폼별 채널 그룹
  const groupedChannels = useMemo(() => {
    if (!data) return { BAND: [], ALIEXPRESS: [], OTHER: [] }

    const groups: Record<string, ChannelData[]> = {
      BAND: [],
      ALIEXPRESS: [],
      OTHER: [],
    }

    data.channels.forEach((ch) => {
      if (ch.platform === 'BAND') {
        groups.BAND.push(ch)
      } else if (ch.platform === 'ALIEXPRESS') {
        groups.ALIEXPRESS.push(ch)
      } else {
        groups.OTHER.push(ch)
      }
    })

    return groups
  }, [data])

  // 선택된 채널들의 데이터
  const selectedChannelsData = useMemo(() => {
    if (!data) return []
    if (selectedChannelIds.length === 0) return data.channels
    return data.channels.filter(ch => selectedChannelIds.includes(ch.id))
  }, [data, selectedChannelIds])

  // 선택된 채널들의 합계
  const selectedSummary = useMemo(() => {
    const channels = selectedChannelsData
    return {
      channelCount: channels.length,
      totalItems: channels.reduce((sum, ch) => sum + ch.itemCount, 0),
      totalAmount: channels.reduce((sum, ch) => sum + ch.totalAmount, 0),
    }
  }, [selectedChannelsData])

  const handleToggleChannel = (channelId: number) => {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    )
  }

  const handleSelectAllChannels = () => {
    if (!data) return
    if (selectedChannelIds.length === data.channels.length) {
      setSelectedChannelIds([])
    } else {
      setSelectedChannelIds(data.channels.map((ch) => ch.id))
    }
  }

  const handleToggleExpand = (channelId: number) => {
    setExpandedChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    )
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

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
    })
  }

  const openSettlementModal = (channelId: number, channelName: string) => {
    setSettlementModal({ isOpen: true, channelId, channelName })
  }

  const closeSettlementModal = () => {
    setSettlementModal(null)
  }

  const getChannelPlatformConfig = (channel: ChannelData) => {
    if (channel.platform === 'BAND') return PLATFORM_CONFIG.BAND
    if (channel.platform === 'ALIEXPRESS') return PLATFORM_CONFIG.ALIEXPRESS
    return PLATFORM_CONFIG.OTHER
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Calculator className="text-emerald-600" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">정산 관리</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 ml-2">
                테스트: 사이드바 채널 선택 + 아코디언
              </span>
            </div>
          </div>
          <p className="text-gray-600">
            사이드바에서 소매채널을 선택하고 주문 내역을 확인 후 정산하세요. 행을 클릭하면 주문 상세를 확인할 수 있습니다.
          </p>
        </div>

        {/* 대시보드 */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">총 주문</p>
                  <p className="text-2xl font-bold text-gray-900">{data.summary.totalItems}건</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">총 매출</p>
                  <p className="text-2xl font-bold text-gray-900">{formatPrice(data.summary.totalAmount)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Store className="text-purple-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">소매채널</p>
                  <p className="text-2xl font-bold text-gray-900">{data.channels.length}개</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">미분류</p>
                  <p className="text-2xl font-bold text-orange-600">{data.unclassified.itemCount}건</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 메인 콘텐츠 - 3:1 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 채널별 주문 목록 - 3/4 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* 상단 컨트롤 */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-gray-500">~</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <Button variant="secondary" onClick={fetchData} disabled={loading}>
                      <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </Button>
                  </div>

                  <Button
                    variant="primary"
                    onClick={() => router.push('/settlement/history')}
                  >
                    <History size={16} />
                    정산 이력
                  </Button>
                </div>
              </div>

              {/* 채널별 아코디언 목록 */}
              {loading ? (
                <div className="p-12"><Loading /></div>
              ) : selectedChannelsData.length === 0 ? (
                <div className="p-12 text-center">
                  <Store size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {selectedChannelIds.length > 0 ? '선택된 채널에 주문이 없습니다' : '정산 데이터가 없습니다'}
                  </h3>
                  <p className="text-gray-500">
                    소매채널에 상품을 발행하고 주문이 들어오면 이곳에서 확인할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {selectedChannelsData.map((channel) => {
                    const isExpanded = expandedChannelIds.includes(channel.id)
                    const config = getChannelPlatformConfig(channel)

                    return (
                      <Fragment key={channel.id}>
                        {/* 채널 헤더 (아코디언 토글) */}
                        <div
                          className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleToggleExpand(channel.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown size={20} className="text-gray-400" />
                                ) : (
                                  <ChevronRight size={20} className="text-gray-400" />
                                )}
                                {channel.coverUrl ? (
                                  <Image
                                    src={channel.coverUrl}
                                    alt={channel.name}
                                    width={40}
                                    height={40}
                                    className="w-10 h-10 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                    <Store size={16} className="text-white" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">{channel.name}</span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                                    {config.icon}
                                    {config.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                                  <span>주문 {channel.itemCount}건</span>
                                  {channel.shopCount > 0 && <span className="text-blue-600">쇼핑몰 {channel.shopCount}</span>}
                                  {channel.webhookCount > 0 && <span className="text-purple-600">웹훅 {channel.webhookCount}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">{formatPrice(channel.totalAmount)}</p>
                                <p className="text-sm text-gray-500">{channel.totalQuantity}개</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openSettlementModal(channel.id, channel.name)
                                }}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                              >
                                <CheckCircle size={14} />
                                정산
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 확장된 주문 목록 */}
                        {isExpanded && (
                          <div className="bg-gray-50 border-t border-gray-200">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">주문자</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">주문일</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                  {channel.items.map((item) => (
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
                                          <span className="text-sm text-gray-900 line-clamp-1 max-w-[200px]">
                                            {item.productName}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600">
                                        {item.customerName}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900">
                                        {item.quantity}개
                                      </td>
                                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {formatPrice(item.totalPrice)}
                                      </td>
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
                                      <td className="px-4 py-3 text-sm text-gray-500">
                                        {formatDateShort(item.orderedAt)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </Fragment>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 사이드바: 채널 선택 + 정산 정보 - 1/4 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 채널 선택 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Store className="text-emerald-600" size={20} />
                  <h3 className="font-semibold text-gray-900">소매채널</h3>
                </div>
                <button
                  onClick={handleSelectAllChannels}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {data && selectedChannelIds.length === data.channels.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>

              {loading ? (
                <div className="py-4 text-center text-gray-500">
                  <RefreshCw size={16} className="animate-spin inline mr-2" />
                  로딩...
                </div>
              ) : !data || data.channels.length === 0 ? (
                <div className="py-4 text-center text-gray-500 text-sm">
                  등록된 소매채널이 없습니다.
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {/* 밴드 */}
                  {groupedChannels.BAND.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <BandIcon size={14} className="text-green-600" />
                        <span className="text-xs font-medium text-gray-700">밴드</span>
                      </div>
                      <div className="space-y-1">
                        {groupedChannels.BAND.map((channel) => (
                          <ChannelCheckboxCompact
                            key={channel.id}
                            channel={channel}
                            isSelected={selectedChannelIds.includes(channel.id)}
                            onToggle={() => handleToggleChannel(channel.id)}
                            config={PLATFORM_CONFIG.BAND}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 알리익스프레스 */}
                  {groupedChannels.ALIEXPRESS.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Package size={14} className="text-orange-600" />
                        <span className="text-xs font-medium text-gray-700">알리익스프레스</span>
                      </div>
                      <div className="space-y-1">
                        {groupedChannels.ALIEXPRESS.map((channel) => (
                          <ChannelCheckboxCompact
                            key={channel.id}
                            channel={channel}
                            isSelected={selectedChannelIds.includes(channel.id)}
                            onToggle={() => handleToggleChannel(channel.id)}
                            config={PLATFORM_CONFIG.ALIEXPRESS}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 기타 */}
                  {groupedChannels.OTHER.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Store size={14} className="text-gray-600" />
                        <span className="text-xs font-medium text-gray-700">기타</span>
                      </div>
                      <div className="space-y-1">
                        {groupedChannels.OTHER.map((channel) => (
                          <ChannelCheckboxCompact
                            key={channel.id}
                            channel={channel}
                            isSelected={selectedChannelIds.includes(channel.id)}
                            onToggle={() => handleToggleChannel(channel.id)}
                            config={PLATFORM_CONFIG.OTHER}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 정산 요약 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="text-emerald-600" size={20} />
                <h3 className="font-semibold text-gray-900">정산 요약</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">선택한 채널</span>
                  <span className="font-medium text-emerald-600">
                    {selectedChannelIds.length > 0 ? `${selectedChannelIds.length}개` : '전체'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">주문 건수</span>
                  <span className="font-medium">{selectedSummary.totalItems}건</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-700 font-medium">총 매출</span>
                    <span className="font-bold text-emerald-600">
                      {formatPrice(selectedSummary.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 미분류 주문 */}
            {data && data.unclassified.itemCount > 0 && (
              <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="text-orange-600" size={20} />
                  <h3 className="font-semibold text-orange-900">미분류 주문</h3>
                </div>
                <p className="text-sm text-orange-700 mb-2">
                  PublishedProduct에 매칭되지 않은 주문입니다.
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-orange-700">{data.unclassified.itemCount}건</span>
                  <span className="font-medium text-orange-900">{formatPrice(data.unclassified.totalAmount)}</span>
                </div>
              </div>
            )}

            <a
              href="/settlement/history"
              className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <History size={16} />
              정산 이력 보기
            </a>
          </div>
        </div>
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

// 사이드바용 컴팩트한 채널 체크박스
function ChannelCheckboxCompact({
  channel,
  isSelected,
  onToggle,
  config,
}: {
  channel: ChannelData
  isSelected: boolean
  onToggle: () => void
  config: { label: string; color: string; bgColor: string; textColor: string; icon: React.ReactNode }
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md border transition-all text-left ${
        isSelected
          ? 'border-emerald-600 bg-emerald-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
          isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300 bg-white'
        }`}
      >
        {isSelected && <Check size={12} className="text-white" />}
      </div>
      <span className={`${config.color} flex-shrink-0`}>{config.icon}</span>
      <div className="flex-1 min-w-0">
        <span className={`text-sm truncate block ${isSelected ? 'text-emerald-700 font-medium' : 'text-gray-700'}`}>
          {channel.name}
        </span>
        <span className="text-xs text-gray-400">{channel.itemCount}건 · {channel.totalAmount.toLocaleString()}원</span>
      </div>
    </button>
  )
}
