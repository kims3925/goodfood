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
  Filter,
  History,
  CheckCircle,
  ShoppingCart,
  FileText,
  ExternalLink,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import SettlementModal from '@/components/settlement/SettlementModal'
import { useToast } from '@/components/ui/Toast'

interface OrderItem {
  id: number
  orderId: number | null  // Order ID (쇼핑몰 주문만 있음)
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

export default function SettlementListPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SettlementData | null>(null)
  const [expandedBands, setExpandedBands] = useState<Set<number>>(new Set())
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set(['BAND', 'ALIEXPRESS']))
  const [showUnclassified, setShowUnclassified] = useState(false)

  // 필터 상태
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedChannelId, setSelectedBandId] = useState<string>('')

  // 정렬 상태
  type SortColumn = 'name' | 'itemCount' | 'shopCount' | 'webhookCount' | 'totalAmount'
  type SortDirection = 'asc' | 'desc'
  const [sortColumn, setSortColumn] = useState<SortColumn>('totalAmount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // 선택된 채널 상세 보기
  const [selectedChannelForDetails, setSelectedChannelForDetails] = useState<number | null>(null)

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

  const toggleChannelExpansion = (channelId: number) => {
    setExpandedBands(prev => {
      const newSet = new Set(prev)
      if (newSet.has(channelId)) {
        newSet.delete(channelId)
      } else {
        newSet.add(channelId)
      }
      return newSet
    })
  }

  const togglePlatformExpansion = (platform: string) => {
    setExpandedPlatforms(prev => {
      const newSet = new Set(prev)
      if (newSet.has(platform)) {
        newSet.delete(platform)
      } else {
        newSet.add(platform)
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

  const handleFilter = () => {
    fetchData()
  }

  const handleResetFilter = () => {
    setStartDate('')
    setEndDate('')
    setSelectedBandId('')
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'BAND':
        return <Store size={20} className="text-green-600" />
      case 'ALIEXPRESS':
        return <Package size={20} className="text-orange-600" />
      default:
        return <Store size={20} className="text-gray-600" />
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'BAND':
        return 'bg-green-100 border-green-200'
      case 'ALIEXPRESS':
        return 'bg-orange-100 border-orange-200'
      default:
        return 'bg-gray-100 border-gray-200'
    }
  }

  const openSettlementModal = (channelId: number, channelName: string) => {
    setSettlementModal({ isOpen: true, channelId, channelName })
  }

  const closeSettlementModal = () => {
    setSettlementModal(null)
  }

  // 정렬 핸들러
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // 같은 컬럼 클릭 시 방향 반전
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // 다른 컬럼 클릭 시 해당 컬럼으로 정렬 (기본: 내림차순)
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  // 채널 정렬 함수
  const sortChannels = (channels: ChannelData[]) => {
    return [...channels].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortColumn) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'itemCount':
          aValue = a.itemCount
          bValue = b.itemCount
          break
        case 'shopCount':
          aValue = a.shopCount
          bValue = b.shopCount
          break
        case 'webhookCount':
          aValue = a.webhookCount
          bValue = b.webhookCount
          break
        case 'totalAmount':
          aValue = a.totalAmount
          bValue = b.totalAmount
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  // 정렬 아이콘 컴포넌트
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ChevronDown size={14} className="text-gray-300" />
    }
    return sortDirection === 'asc' ? (
      <ChevronUp size={14} className="text-blue-600" />
    ) : (
      <ChevronDown size={14} className="text-blue-600" />
    )
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
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">정산 관리</h1>
            <p className="text-gray-600">
              소매채널별로 주문된 상품을 확인하고 정산 내역을 관리합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => router.push('/settlement/history')}
            >
              <History size={16} />
              정산 이력
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <ShoppingBag className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">총 주문</p>
                  <p className="text-xl font-bold text-gray-900">{data.summary.totalItems}건</p>
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
                  <p className="text-sm text-gray-500">소매채널</p>
                  <p className="text-xl font-bold text-gray-900">{data.channels.length}개</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 필터 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4">
            <div className="flex flex-col gap-4">
              {/* 날짜 필터 및 버튼 */}
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
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

              {/* 소매채널 썸네일 버튼 */}
              {data && data.channels.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedBandId('')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      selectedChannelId === ''
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
                      <Store size={14} className="text-white" />
                    </div>
                    <span className="text-sm font-medium">전체</span>
                  </button>
                  {data.channels.map((band) => (
                    <button
                      key={band.id}
                      onClick={() => setSelectedBandId(band.id.toString())}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        selectedChannelId === band.id.toString()
                          ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      title={`${band.name} (${band.itemCount}건)`}
                    >
                      {band.coverUrl ? (
                        <Image
                          src={band.coverUrl}
                          alt={band.name}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                          <Store size={14} className="text-white" />
                        </div>
                      )}
                      <div className="text-left">
                        <p className="text-sm font-medium line-clamp-1 max-w-[120px]">{band.name}</p>
                        <p className="text-xs text-gray-400">{band.itemCount}건</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
            <Loading />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* 소매채널 요약 테이블 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">소매채널별 정산 요약</h2>
                <p className="text-sm text-gray-500 mt-1">각 소매채널의 주문 및 매출 현황을 확인하세요</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('name')}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                          채널명
                          <SortIcon column="name" />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        플랫폼
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('itemCount')}
                          className="flex items-center gap-1 ml-auto hover:text-gray-700 transition-colors"
                        >
                          총 주문
                          <SortIcon column="itemCount" />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('shopCount')}
                          className="flex items-center gap-1 ml-auto hover:text-gray-700 transition-colors"
                        >
                          쇼핑몰
                          <SortIcon column="shopCount" />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('webhookCount')}
                          className="flex items-center gap-1 ml-auto hover:text-gray-700 transition-colors"
                        >
                          웹훅
                          <SortIcon column="webhookCount" />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('totalAmount')}
                          className="flex items-center gap-1 ml-auto hover:text-gray-700 transition-colors"
                        >
                          총 매출
                          <SortIcon column="totalAmount" />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.channels.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          등록된 소매채널이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      sortChannels(data.channels).map((channel) => (
                          <tr
                            key={channel.id}
                            onClick={() =>
                              setSelectedChannelForDetails(
                                selectedChannelForDetails === channel.id ? null : channel.id
                              )
                            }
                            className={`cursor-pointer transition-colors ${
                              selectedChannelForDetails === channel.id
                                ? 'bg-blue-50 border-l-4 border-blue-500'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
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
                                <div>
                                  <p className="font-medium text-gray-900">{channel.name}</p>
                                  <p className="text-xs text-gray-500">ID: {channel.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                channel.platform === 'BAND'
                                  ? 'bg-green-100 text-green-700'
                                  : channel.platform === 'SHOP'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700'
                              }`}>
                                {channel.platform}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-semibold text-gray-900">{channel.itemCount}건</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-blue-600">{channel.shopCount}건</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-purple-600">{channel.webhookCount}건</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-bold text-gray-900">{formatPrice(channel.totalAmount)}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openSettlementModal(channel.id, channel.name)
                                }}
                              >
                                정산
                              </Button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 선택된 채널 상세 통계 */}
            {selectedChannelForDetails && data.channels.find(c => c.id === selectedChannelForDetails) && (
              <div className="bg-white rounded-lg shadow-sm border border-blue-200 overflow-hidden">
                {(() => {
                  const selectedChannel = data.channels.find(c => c.id === selectedChannelForDetails)!
                  return (
                    <>
                      <div className="p-4 bg-blue-50 border-b border-blue-200">
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
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                <Store size={20} className="text-white" />
                              </div>
                            )}
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">{selectedChannel.name} 상세 통계</h3>
                              <p className="text-sm text-gray-600">
                                총 {selectedChannel.itemCount}건 | 매출 {formatPrice(selectedChannel.totalAmount)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedChannelForDetails(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <ChevronUp size={24} />
                          </button>
                        </div>
                      </div>

                      {/* 통계 카드 */}
                      <div className="p-4 bg-gray-50 border-b border-gray-200">
                        <div className="grid grid-cols-4 gap-4">
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center gap-2 mb-1">
                              <ShoppingBag size={16} className="text-blue-600" />
                              <p className="text-xs text-gray-500">총 주문</p>
                            </div>
                            <p className="text-xl font-bold text-gray-900">{selectedChannel.itemCount}건</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center gap-2 mb-1">
                              <ShoppingCart size={16} className="text-blue-600" />
                              <p className="text-xs text-gray-500">쇼핑몰 주문</p>
                            </div>
                            <p className="text-xl font-bold text-blue-600">{selectedChannel.shopCount}건</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText size={16} className="text-purple-600" />
                              <p className="text-xs text-gray-500">웹훅 주문</p>
                            </div>
                            <p className="text-xl font-bold text-purple-600">{selectedChannel.webhookCount}건</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center gap-2 mb-1">
                              <DollarSign size={16} className="text-green-600" />
                              <p className="text-xs text-gray-500">총 매출</p>
                            </div>
                            <p className="text-xl font-bold text-green-600">{formatPrice(selectedChannel.totalAmount)}</p>
                          </div>
                        </div>
                      </div>

                      {/* 주문 상세 목록 */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                채널
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                주문번호
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                상품명
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                주문자
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                수량
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                금액
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                상태
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                주문일
                              </th>
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
                                    <span className="text-sm text-gray-900 line-clamp-1">
                                      {item.productName}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.customerName}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  {item.quantity}개
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
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
                                  {formatDate(item.orderedAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            {/* 소싱처별 그룹 */}
            {data.platforms.map((platformGroup) => (
              <div key={platformGroup.platform} className="space-y-4">
                {/* 소싱처 헤더 */}
                <button
                  onClick={() => togglePlatformExpansion(platformGroup.platform)}
                  className={`w-full p-4 rounded-lg border ${getPlatformColor(platformGroup.platform)} flex items-center justify-between hover:opacity-90 transition-opacity`}
                >
                  <div className="flex items-center gap-3">
                    {getPlatformIcon(platformGroup.platform)}
                    <div className="text-left">
                      <h2 className="text-lg font-bold text-gray-900">{platformGroup.platformName}</h2>
                      <p className="text-sm text-gray-600">
                        소매채널 {platformGroup.channels.length}개 | 주문 {platformGroup.itemCount}건 | 매출 {formatPrice(platformGroup.totalAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">{formatPrice(platformGroup.totalAmount)}</p>
                      <p className="text-sm text-gray-500">{platformGroup.itemCount}건</p>
                    </div>
                    {expandedPlatforms.has(platformGroup.platform) ? (
                      <ChevronUp size={24} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={24} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {/* 소매채널 목록 */}
                {expandedPlatforms.has(platformGroup.platform) && platformGroup.channels.map((band) => (
                  <div
                    key={band.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                  >
                    {/* 밴드 헤더 */}
                    <button
                      onClick={() => toggleChannelExpansion(band.id)}
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
                            주문 {band.itemCount}건 | 매출 {formatPrice(band.totalAmount)}
                          </p>
                          <div className="flex gap-2 mt-1">
                            {band.shopCount > 0 && (
                              <span className="text-xs text-blue-600">쇼핑몰 {band.shopCount}건</span>
                            )}
                            {band.webhookCount > 0 && (
                              <span className="text-xs text-purple-600">웹훅 {band.webhookCount}건</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">{formatPrice(band.totalAmount)}</p>
                          <p className="text-sm text-gray-500">{band.itemCount}건</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openSettlementModal(band.id, band.name)
                          }}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                        >
                          <CheckCircle size={14} />
                          정산하기
                        </button>
                        {expandedBands.has(band.id) ? (
                          <ChevronUp size={20} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={20} className="text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* 주문 아이템 목록 */}
                    {expandedBands.has(band.id) && (
                      <div className="border-t border-gray-200">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  채널
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  주문번호
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  상품명
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  주문자
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  수량
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  금액
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  상태
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  주문일
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {band.items.map((item) => (
                                <tr key={`${item.channel}-${item.id}`} className="hover:bg-gray-50">
                                  <td className="px-4 py-3">
                                    <ChannelBadge channel={item.channel} />
                                  </td>
                                  <td className="px-4 py-3 text-sm font-mono">
                                    {item.orderId ? (
                                      <a
                                        href={`/order/${item.orderId}`}
                                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
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
                                      <span className="text-sm text-gray-900 line-clamp-1">
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
                                    {formatDate(item.orderedAt)}
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
              </div>
            ))}

            {/* 미분류 주문 */}
            {data.unclassified.itemCount > 0 && (
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
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              채널
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              주문번호
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              상품명
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              주문자
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              수량
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              금액
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              주문일
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100">
                          {data.unclassified.items.map((item) => (
                            <tr key={`${item.channel}-${item.id}`} className="hover:bg-orange-50">
                              <td className="px-4 py-3">
                                <ChannelBadge channel={item.channel} />
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                                {item.orderNumber}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {item.productName}
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
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {formatDate(item.orderedAt)}
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
            {data.channels.length === 0 && data.unclassified.itemCount === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <Store size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">정산 데이터가 없습니다</h3>
                <p className="text-gray-500">
                  소매채널에 상품을 발행하고 주문이 들어오면 이곳에서 확인할 수 있습니다.
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
