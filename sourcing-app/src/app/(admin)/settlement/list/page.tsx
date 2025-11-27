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
  retailBandId: number | null
  retailBandName: string | null
}

interface RetailBandData {
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
  retailBands: RetailBandData[]
  itemCount: number
  totalQuantity: number
  totalAmount: number
}

interface SettlementData {
  platforms: PlatformGroup[]
  retailBands: RetailBandData[]
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
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SettlementData | null>(null)
  const [expandedBands, setExpandedBands] = useState<Set<number>>(new Set())
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set(['BAND', 'ALIEXPRESS']))
  const [showUnclassified, setShowUnclassified] = useState(false)

  // 필터 상태
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedBandId, setSelectedBandId] = useState<string>('')

  // 정산 모달 상태
  const [settlementModal, setSettlementModal] = useState<{
    isOpen: boolean
    bandId: number
    bandName: string
  } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedPlatform) params.set('platform', selectedPlatform)
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
  }, [selectedPlatform, startDate, endDate, selectedBandId])

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
    setSelectedPlatform('')
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

  const openSettlementModal = (bandId: number, bandName: string) => {
    setSettlementModal({ isOpen: true, bandId, bandName })
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">정산 관리</h1>
            <p className="text-gray-600">
              소매밴드별로 주문된 상품을 확인하고 정산 내역을 관리합니다.
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <ShoppingCart className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">쇼핑몰 주문</p>
                  <p className="text-xl font-bold text-gray-900">{data.summary.shopCount}건</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <FileText className="text-purple-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">웹훅 주문</p>
                  <p className="text-xl font-bold text-gray-900">{data.summary.webhookCount}건</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <AlertCircle className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">미분류</p>
                  <p className="text-xl font-bold text-gray-900">{data.unclassified.itemCount}건</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 소싱처 탭 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setSelectedPlatform('')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                selectedPlatform === ''
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <ShoppingBag size={18} />
                <span>전체</span>
                {data && (
                  <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                    {data.summary.totalItems}건
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setSelectedPlatform('BAND')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                selectedPlatform === 'BAND'
                  ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Store size={18} />
                <span>밴드</span>
                {data && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {data.platforms.find(p => p.platform === 'BAND')?.itemCount || 0}건
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setSelectedPlatform('ALIEXPRESS')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                selectedPlatform === 'ALIEXPRESS'
                  ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Package size={18} />
                <span>알리익스프레스</span>
                {data && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                    {data.platforms.find(p => p.platform === 'ALIEXPRESS')?.itemCount || 0}건
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

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

              {/* 소매밴드 썸네일 버튼 */}
              {data && data.retailBands.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedBandId('')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      selectedBandId === ''
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
                      <Store size={14} className="text-white" />
                    </div>
                    <span className="text-sm font-medium">전체</span>
                  </button>
                  {data.retailBands.map((band) => (
                    <button
                      key={band.id}
                      onClick={() => setSelectedBandId(band.id.toString())}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        selectedBandId === band.id.toString()
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
                        소매밴드 {platformGroup.retailBands.length}개 | 주문 {platformGroup.itemCount}건 | 매출 {formatPrice(platformGroup.totalAmount)}
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

                {/* 소매밴드 목록 */}
                {expandedPlatforms.has(platformGroup.platform) && platformGroup.retailBands.map((band) => (
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
                        ProductPublish에 매칭되지 않은 주문입니다.
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
            {data.retailBands.length === 0 && data.unclassified.itemCount === 0 && (
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

      {/* 정산 모달 */}
      {settlementModal && (
        <SettlementModal
          retailBandId={settlementModal.bandId}
          retailBandName={settlementModal.bandName}
          onClose={closeSettlementModal}
          onSuccess={() => {
            fetchData()
            alert('정산이 생성되었습니다.')
          }}
        />
      )}
    </div>
  )
}
