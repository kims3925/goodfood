'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import {
  Store,
  Package,
  CheckCircle,
  ShoppingCart,
  FileText,
  Layers,
  Calendar,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

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

const formatPrice = (price: number) => `${price.toLocaleString()}원`

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// 채널 뱃지
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

// 플랫폼 뱃지
const PlatformBadge = ({ platform }: { platform: string }) => {
  if (platform === 'BAND') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
        <Store size={10} />
        밴드
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
      <Package size={10} />
      알리
    </span>
  )
}

export default function SettlementTestPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SettlementData | null>(null)

  // 필터 상태
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [selectedChannel, setSelectedChannel] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 선택된 밴드
  const [selectedBandId, setSelectedBandId] = useState<number | null>(null)
  const [expandedBands, setExpandedBands] = useState<Set<number>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedPlatform) params.set('platform', selectedPlatform)
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
  }, [selectedPlatform, startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleResetFilter = () => {
    setSelectedPlatform('')
    setSelectedChannel('')
    setStartDate('')
    setEndDate('')
    setSelectedBandId(null)
  }

  // 필터링된 밴드 목록
  const getFilteredBands = () => {
    if (!data) return []

    let bands = data.retailBands

    // 플랫폼 필터
    if (selectedPlatform) {
      bands = bands.filter(b => b.platform === selectedPlatform)
    }

    // 채널 필터 (밴드 내 아이템 기준)
    if (selectedChannel) {
      bands = bands.map(band => ({
        ...band,
        items: band.items.filter(item => item.channel === selectedChannel),
        itemCount: band.items.filter(item => item.channel === selectedChannel).length,
        totalAmount: band.items
          .filter(item => item.channel === selectedChannel)
          .reduce((sum, item) => sum + item.totalPrice, 0),
      })).filter(band => band.itemCount > 0)
    }

    return bands
  }

  const filteredBands = getFilteredBands()
  const selectedBand = selectedBandId ? filteredBands.find(b => b.id === selectedBandId) : null

  const toggleBand = (id: number) => {
    setExpandedBands(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  // 통계 계산
  const stats = {
    totalBands: filteredBands.length,
    totalItems: filteredBands.reduce((sum, b) => sum + b.itemCount, 0),
    totalAmount: filteredBands.reduce((sum, b) => sum + b.totalAmount, 0),
    bandCount: filteredBands.filter(b => b.platform === 'BAND').length,
    aliCount: filteredBands.filter(b => b.platform === 'ALIEXPRESS').length,
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex h-screen">
        {/* 좌측 사이드바 - 필터 */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          {/* 사이드바 헤더 */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Filter size={20} />
              필터
            </h2>
          </div>

          {/* 필터 내용 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* 플랫폼 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                소싱처
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedPlatform('')}
                  className={`w-full px-3 py-2.5 text-left rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                    selectedPlatform === ''
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Layers size={18} />
                  전체
                  {data && (
                    <span className="ml-auto text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                      {data.retailBands.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setSelectedPlatform('BAND')}
                  className={`w-full px-3 py-2.5 text-left rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                    selectedPlatform === 'BAND'
                      ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Store size={18} />
                  밴드
                  {data && (
                    <span className="ml-auto text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                      {data.retailBands.filter(b => b.platform === 'BAND').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setSelectedPlatform('ALIEXPRESS')}
                  className={`w-full px-3 py-2.5 text-left rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                    selectedPlatform === 'ALIEXPRESS'
                      ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-500'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Package size={18} />
                  알리익스프레스
                  {data && (
                    <span className="ml-auto text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                      {data.retailBands.filter(b => b.platform === 'ALIEXPRESS').length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 채널 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                주문 채널
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedChannel('')}
                  className={`w-full px-3 py-2.5 text-left rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                    selectedChannel === ''
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Layers size={18} />
                  전체
                </button>
                <button
                  onClick={() => setSelectedChannel('SHOP')}
                  className={`w-full px-3 py-2.5 text-left rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                    selectedChannel === 'SHOP'
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <ShoppingCart size={18} />
                  쇼핑몰
                  {data && (
                    <span className="ml-auto text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      {data.summary.shopCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setSelectedChannel('WEBHOOK')}
                  className={`w-full px-3 py-2.5 text-left rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                    selectedChannel === 'WEBHOOK'
                      ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <FileText size={18} />
                  웹훅
                  {data && (
                    <span className="ml-auto text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                      {data.summary.webhookCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 날짜 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar size={14} className="inline mr-1" />
                주문 기간
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="시작일"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="종료일"
                />
              </div>
            </div>
          </div>

          {/* 사이드바 푸터 - 버튼 */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button
              onClick={handleResetFilter}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              필터 초기화
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 상단 헤더 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">정산 관리</h1>
                <p className="text-sm text-gray-500 mt-1">
                  사이드바 레이아웃 테스트
                </p>
              </div>

              {/* 통계 요약 */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{stats.totalBands}</p>
                  <p className="text-xs text-gray-500">소매밴드</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.totalItems}</p>
                  <p className="text-xs text-gray-500">주문</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{formatPrice(stats.totalAmount)}</p>
                  <p className="text-xs text-gray-500">총 매출</p>
                </div>
              </div>
            </div>
          </div>

          {/* 밴드 목록 / 상세 */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <RefreshCw size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
                  <p className="text-gray-500">데이터를 불러오는 중...</p>
                </div>
              </div>
            ) : selectedBand ? (
              // 선택된 밴드 상세
              <div className="max-w-4xl mx-auto">
                <button
                  onClick={() => setSelectedBandId(null)}
                  className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  ← 목록으로 돌아가기
                </button>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* 밴드 헤더 */}
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {selectedBand.coverUrl ? (
                          <Image
                            src={selectedBand.coverUrl}
                            alt={selectedBand.name}
                            width={64}
                            height={64}
                            className="w-16 h-16 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                            <Store size={28} className="text-white" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-bold">{selectedBand.name}</h2>
                            <PlatformBadge platform={selectedBand.platform} />
                          </div>
                          <p className="text-gray-500">
                            {selectedBand.itemCount}건 | 쇼핑몰 {selectedBand.shopCount}건 | 웹훅 {selectedBand.webhookCount}건
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{formatPrice(selectedBand.totalAmount)}</p>
                        <button className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700">
                          <CheckCircle size={18} />
                          정산하기
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 주문 목록 */}
                  <div className="divide-y divide-gray-100">
                    {selectedBand.items.length > 0 ? (
                      selectedBand.items.map(item => (
                        <div key={`${item.channel}-${item.id}`} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <ChannelBadge channel={item.channel} />
                            <div>
                              <p className="font-medium">{item.productName}</p>
                              <p className="text-sm text-gray-500">
                                {item.orderNumber} · {item.customerName} · {formatDate(item.orderedAt)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatPrice(item.totalPrice)}</p>
                            <p className="text-sm text-gray-500">x{item.quantity}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        주문 데이터가 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // 밴드 목록 (아코디언 스타일)
              <div className="max-w-4xl mx-auto space-y-3">
                {filteredBands.length > 0 ? (
                  filteredBands.map(band => (
                    <div
                      key={band.id}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                    >
                      {/* 밴드 헤더 */}
                      <button
                        onClick={() => toggleBand(band.id)}
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
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">{band.name}</p>
                              <PlatformBadge platform={band.platform} />
                            </div>
                            <p className="text-sm text-gray-500">
                              {band.itemCount}건 | 쇼핑몰 {band.shopCount} | 웹훅 {band.webhookCount}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-bold">{formatPrice(band.totalAmount)}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedBandId(band.id)
                            }}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1"
                          >
                            <CheckCircle size={14} />
                            정산
                          </button>
                          {expandedBands.has(band.id) ? (
                            <ChevronUp size={20} className="text-gray-400" />
                          ) : (
                            <ChevronDown size={20} className="text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* 주문 목록 (펼침) */}
                      {expandedBands.has(band.id) && (
                        <div className="border-t border-gray-200 bg-gray-50">
                          {band.items.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                              {band.items.slice(0, 5).map(item => (
                                <div
                                  key={`${item.channel}-${item.id}`}
                                  className="px-4 py-3 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <ChannelBadge channel={item.channel} />
                                    <span className="text-sm">{item.productName}</span>
                                    <span className="text-xs text-gray-400">
                                      {item.customerName}
                                    </span>
                                  </div>
                                  <span className="font-medium text-sm">
                                    {formatPrice(item.totalPrice)}
                                  </span>
                                </div>
                              ))}
                              {band.items.length > 5 && (
                                <button
                                  onClick={() => setSelectedBandId(band.id)}
                                  className="w-full py-3 text-sm text-blue-600 hover:bg-blue-50"
                                >
                                  +{band.items.length - 5}건 더보기
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-sm text-gray-500">
                              주문 데이터가 없습니다.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <Store size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      조건에 맞는 데이터가 없습니다
                    </h3>
                    <p className="text-gray-500">
                      필터를 조정해보세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
