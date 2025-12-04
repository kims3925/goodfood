'use client'

/**
 * Referrer 기반 정산 테스트 페이지
 *
 * 목적: SHOP_REFERRER_SYSTEM.md 문서 기반으로 새로운 정산 방식 테스트
 * - 현재 방식 (AS-IS): 채널별로 발행된 상품 기준 정산
 * - 새로운 방식 (TO-BE): 유입 경로(Referrer) 기준 정산
 */

import { useState, useEffect } from 'react'
import {
  RefreshCw,
  Store,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  ExternalLink,
  Info,
  Target,
  DollarSign,
  ShoppingCart,
  Users,
  Link2,
  BarChart3,
  Eye,
  EyeOff,
  Activity,
  Calendar,
  CreditCard,
  Package,
  TrendingDown,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

interface Channel {
  id: number
  name: string
  platform: string
  coverUrl: string | null
  bankName: string | null
  bankAccount: string | null
  accountHolder: string | null
}

interface OrderSummary {
  channelId: number | null
  channelName: string | null
  orderCount: number
  totalAmount: number
  itemCount: number
}

interface ReferrerData {
  referrerChannelId: number | null
  channelName: string
  orderCount?: number
  itemCount?: number
  quantity?: number
  totalAmount: number
  percentage: number
  platform?: string | null
  bankInfo?: {
    bankName: string | null
    bankAccount: string | null
    accountHolder: string | null
  } | null
}

interface ChannelSettlementDetail {
  channel: {
    id: number
    name: string
    platform: string
    coverUrl: string | null
    bankName: string | null
    bankAccount: string | null
    accountHolder: string | null
  }
  settlement: {
    totalOrders: number
    totalOrderAmount: number
    totalItems: number
    totalQuantity: number
    totalItemAmount: number
    recentItems: number
    recentAmount: number
    monthlyItems: number
    monthlyAmount: number
  }
}

interface TrackingStats {
  totalOrders?: number
  totalItems?: number
  totalAmount: number
  trackedOrders?: number
  trackedItems?: number
  untrackedOrders?: number
  untrackedItems?: number
  trackedAmount: number
  untrackedAmount: number
  trackingRate: number
}

interface TestData {
  channels: Channel[]
  currentSettlement: OrderSummary[]
  orderReferrerSettlement: ReferrerData[]
  orderItemReferrerSettlement: ReferrerData[]
  channelSettlementDetails: ChannelSettlementDetail[]
  orderTrackingStats: TrackingStats
  orderItemTrackingStats: TrackingStats
}

export default function ReferrerTestPage() {
  const { showToast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [testData, setTestData] = useState<TestData | null>(null)
  const [activeTab, setActiveTab] = useState<'comparison' | 'settlement' | 'tracking' | 'migration'>('settlement')

  useEffect(() => {
    loadTestData()
  }, [])

  const loadTestData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/settlement/referrer-test')
      const data = await response.json()

      if (data.success) {
        setTestData(data.data)
      } else {
        showToast(data.error || '데이터 로드 실패', 'error')
      }
    } catch (error) {
      console.error('Failed to load test data:', error)
      showToast('데이터 로드 중 오류가 발생했습니다', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loading />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-7 h-7 text-blue-600" />
            Referrer 기반 정산 테스트
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            소매밴드별 유입 경로 기반 정산 집계 확인
          </p>
        </div>
        <Button onClick={loadTestData} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          새로고침
        </Button>
      </div>

      {/* 안내 배너 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Info className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">Referrer 기반 정산 시스템</h3>
            <p className="text-sm text-blue-700 mt-1">
              <strong>상품별 정산</strong>: 고객이 A밴드에서 상품1을, B밴드에서 상품2를 장바구니에 담으면,
              상품1은 A에, 상품2는 B에 정산됩니다. (OrderItem.referrerChannelId 기준)
            </p>
            <div className="flex items-center gap-4 mt-3 text-sm">
              <a
                href="/docs/business/SHOP_REFERRER_SYSTEM.md"
                target="_blank"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="w-4 h-4" />
                상세 문서 보기
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'settlement', label: '소매밴드별 정산', icon: DollarSign },
            { id: 'tracking', label: '트래킹 현황', icon: BarChart3 },
            { id: 'comparison', label: '방식 비교', icon: TrendingUp },
            { id: 'migration', label: '마이그레이션', icon: ArrowRight },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'settlement' && (
        <SettlementTab testData={testData} formatPrice={formatPrice} />
      )}

      {activeTab === 'tracking' && (
        <TrackingTab testData={testData} formatPrice={formatPrice} />
      )}

      {activeTab === 'comparison' && (
        <ComparisonTab testData={testData} formatPrice={formatPrice} />
      )}

      {activeTab === 'migration' && (
        <MigrationTab />
      )}
    </div>
  )
}

// 소매밴드별 정산 탭
function SettlementTab({ testData, formatPrice }: { testData: TestData | null; formatPrice: (n: number) => string }) {
  const details = testData?.channelSettlementDetails || []
  const itemStats = testData?.orderItemTrackingStats

  // 전체 합계 계산
  const totalSettlement = details.reduce((sum, d) => sum + d.settlement.totalItemAmount, 0)
  const totalMonthly = details.reduce((sum, d) => sum + d.settlement.monthlyAmount, 0)
  const totalRecent = details.reduce((sum, d) => sum + d.settlement.recentAmount, 0)

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">활성 소매밴드</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {testData?.channels?.length || 0}개
          </div>
        </div>

        <div className="bg-white rounded-xl border border-green-200 p-5 bg-green-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-green-700">총 정산 금액</span>
          </div>
          <div className="text-2xl font-bold text-green-900">
            {formatPrice(totalSettlement)}원
          </div>
          <div className="text-sm text-green-700 mt-1">
            채널 유입 매출
          </div>
        </div>

        <div className="bg-white rounded-xl border border-purple-200 p-5 bg-purple-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-purple-700">최근 30일</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">
            {formatPrice(totalMonthly)}원
          </div>
        </div>

        <div className="bg-white rounded-xl border border-orange-200 p-5 bg-orange-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-orange-700">최근 7일</span>
          </div>
          <div className="text-2xl font-bold text-orange-900">
            {formatPrice(totalRecent)}원
          </div>
        </div>
      </div>

      {/* 소매밴드별 정산 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-gray-500" />
            소매밴드별 정산 현황
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            OrderItem.referrerChannelId 기준 상품별 정산 집계
          </p>
        </div>

        {details.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">플랫폼</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">주문 수</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">상품 수</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">총 정산액</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">30일</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">7일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">계좌 정보</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {details.map((detail) => (
                  <tr key={detail.channel.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {detail.channel.coverUrl ? (
                          <img
                            src={detail.channel.coverUrl}
                            alt={detail.channel.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <Store className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{detail.channel.name}</div>
                          <code className="text-xs text-blue-600">ref={detail.channel.id}</code>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        {detail.channel.platform}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-gray-900">
                      {detail.settlement.totalOrders}건
                    </td>
                    <td className="px-4 py-4 text-right text-gray-600">
                      {detail.settlement.totalItems}개
                      <span className="text-gray-400 text-xs ml-1">
                        ({detail.settlement.totalQuantity}수량)
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="font-bold text-green-600">
                        {formatPrice(detail.settlement.totalItemAmount)}원
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-purple-600">
                      {formatPrice(detail.settlement.monthlyAmount)}원
                    </td>
                    <td className="px-4 py-4 text-right text-orange-600">
                      {formatPrice(detail.settlement.recentAmount)}원
                    </td>
                    <td className="px-4 py-4">
                      {detail.channel.bankName ? (
                        <div className="text-sm">
                          <div className="text-gray-900">{detail.channel.bankName}</div>
                          <div className="text-gray-500">
                            {detail.channel.bankAccount} ({detail.channel.accountHolder})
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">미등록</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-4 py-4 font-bold text-gray-900" colSpan={2}>합계</td>
                  <td className="px-4 py-4 text-right font-bold text-gray-900">
                    {details.reduce((sum, d) => sum + d.settlement.totalOrders, 0)}건
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-gray-900">
                    {details.reduce((sum, d) => sum + d.settlement.totalItems, 0)}개
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-green-600">
                    {formatPrice(totalSettlement)}원
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-purple-600">
                    {formatPrice(totalMonthly)}원
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-orange-600">
                    {formatPrice(totalRecent)}원
                  </td>
                  <td className="px-4 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">아직 정산 데이터가 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">
              쇼핑몰에서 ?ref=channelId 파라미터로 유입 추적을 시작하세요
            </p>
          </div>
        )}
      </div>

      {/* 직접 접근 (자체 수익) */}
      {testData?.orderItemReferrerSettlement && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-green-500" />
            직접 접근 (자체 수익)
          </h4>
          {testData.orderItemReferrerSettlement
            .filter(item => item.referrerChannelId === null)
            .map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Target className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-green-900">{item.channelName}</div>
                    <div className="text-sm text-green-700">
                      채널 유입 없이 직접 방문한 고객 매출
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-700">
                    {formatPrice(item.totalAmount)}원
                  </div>
                  <div className="text-sm text-green-600">
                    {item.itemCount || 0}개 상품 ({item.percentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// 트래킹 현황 탭
function TrackingTab({ testData, formatPrice }: { testData: TestData | null; formatPrice: (n: number) => string }) {
  const orderStats = testData?.orderTrackingStats
  const itemStats = testData?.orderItemTrackingStats

  return (
    <div className="space-y-6">
      {/* Order 레벨 트래킹 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-blue-500" />
          주문 레벨 트래킹 (Order.referrerChannelId)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">{orderStats?.totalOrders || 0}건</div>
            <div className="text-sm text-gray-500">총 주문</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-700">{orderStats?.trackedOrders || 0}건</div>
            <div className="text-sm text-green-600">트래킹됨</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-700">{orderStats?.untrackedOrders || 0}건</div>
            <div className="text-sm text-orange-600">직접 접근</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-700">{(orderStats?.trackingRate || 0).toFixed(1)}%</div>
            <div className="text-sm text-blue-600">트래킹 비율</div>
          </div>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
            style={{ width: `${orderStats?.trackingRate || 0}%` }}
          />
        </div>
      </div>

      {/* OrderItem 레벨 트래킹 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-500" />
          상품 레벨 트래킹 (OrderItem.referrerChannelId) - 정산 기준
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">{itemStats?.totalItems || 0}개</div>
            <div className="text-sm text-gray-500">총 상품</div>
            <div className="text-xs text-gray-400 mt-1">{formatPrice(itemStats?.totalAmount || 0)}원</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-700">{itemStats?.trackedItems || 0}개</div>
            <div className="text-sm text-green-600">트래킹됨</div>
            <div className="text-xs text-green-500 mt-1">{formatPrice(itemStats?.trackedAmount || 0)}원</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-700">{itemStats?.untrackedItems || 0}개</div>
            <div className="text-sm text-orange-600">직접 접근</div>
            <div className="text-xs text-orange-500 mt-1">{formatPrice(itemStats?.untrackedAmount || 0)}원</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-700">{(itemStats?.trackingRate || 0).toFixed(1)}%</div>
            <div className="text-sm text-purple-600">트래킹 비율</div>
          </div>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            style={{ width: `${itemStats?.trackingRate || 0}%` }}
          />
        </div>
      </div>

      {/* 채널별 유입 현황 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="font-medium text-gray-900 mb-4">채널별 유입 현황 (상품 기준)</h4>

        {testData?.orderItemReferrerSettlement && testData.orderItemReferrerSettlement.length > 0 ? (
          <div className="space-y-3">
            {testData.orderItemReferrerSettlement
              .filter(item => item.referrerChannelId !== null)
              .sort((a, b) => b.totalAmount - a.totalAmount)
              .map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{item.channelName}</span>
                      {item.platform && (
                        <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-200 rounded">
                          {item.platform}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-40">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right w-36">
                    <div className="text-sm font-semibold">{formatPrice(item.totalAmount)}원</div>
                    <div className="text-xs text-gray-500">
                      {item.itemCount}개 ({item.percentage.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <EyeOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">아직 트래킹 데이터가 없습니다</p>
          </div>
        )}
      </div>

      {/* 활성 채널 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-500" />
          활성 소매 채널 ({testData?.channels?.length || 0}개)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {testData?.channels?.map((channel) => (
            <div key={channel.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {channel.coverUrl ? (
                <img src={channel.coverUrl} alt={channel.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <Store className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{channel.name}</div>
                <div className="text-xs text-gray-500">{channel.platform}</div>
              </div>
              <code className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                ref={channel.id}
              </code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 방식 비교 탭
function ComparisonTab({ testData, formatPrice }: { testData: TestData | null; formatPrice: (n: number) => string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 현재 방식 (AS-IS) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-orange-50 border-b border-orange-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Store className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-orange-900">현재 방식 (AS-IS)</h3>
              <p className="text-xs text-orange-700">채널별 발행 상품 기준 정산</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span>같은 상품이 채널마다 별도 관리됨</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span>쇼핑몰에서 업체별로 상품 분리 표시</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span>정산 기준: PublishedProduct.channelId</span>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-3">현재 채널별 정산 현황</h4>
            {testData?.currentSettlement && testData.currentSettlement.length > 0 ? (
              <div className="space-y-2">
                {testData.currentSettlement.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">
                        {item.channelName || '미분류'}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatPrice(item.totalAmount)}원
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.orderCount}건
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">정산 데이터 없음</p>
            )}
          </div>
        </div>
      </div>

      {/* 새로운 방식 (TO-BE) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-blue-50 border-b border-blue-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Link2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">새로운 방식 (TO-BE)</h3>
              <p className="text-xs text-blue-700">유입 경로 (Referrer) 기준 정산</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>쇼핑몰에 통합 상품 1개만 등록</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>상품별로 유입 채널 추적</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>정산 기준: OrderItem.referrerChannelId</span>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Referrer 기반 정산 현황 (상품별)
            </h4>
            {testData?.orderItemReferrerSettlement && testData.orderItemReferrerSettlement.length > 0 ? (
              <div className="space-y-2">
                {testData.orderItemReferrerSettlement.map((item, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${
                    item.referrerChannelId === null ? 'bg-green-50 border border-green-200' : 'bg-blue-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Target className={`w-4 h-4 ${item.referrerChannelId === null ? 'text-green-500' : 'text-blue-500'}`} />
                      <span className="text-sm font-medium">
                        {item.channelName}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${item.referrerChannelId === null ? 'text-green-900' : 'text-blue-900'}`}>
                        {formatPrice(item.totalAmount)}원
                      </div>
                      <div className={`text-xs ${item.referrerChannelId === null ? 'text-green-600' : 'text-blue-600'}`}>
                        {item.itemCount}개 ({item.percentage.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">트래킹 데이터 없음</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 마이그레이션 가이드 탭
function MigrationTab() {
  const phases = [
    {
      phase: 1,
      title: '스키마 변경',
      status: 'completed',
      tasks: [
        'Order 테이블에 referrer_channel_id 컬럼 추가',
        'OrderItem 테이블에 referrer_channel_id 컬럼 추가',
        'CartItem 테이블에 referrer_channel_id 컬럼 추가',
        'Channel 테이블에 관계 추가',
      ]
    },
    {
      phase: 2,
      title: '쇼핑몰 Referrer 추적 구현',
      status: 'pending',
      tasks: [
        '상품 페이지에서 ?ref=channelId 파라미터 감지',
        '쿠키에 referrerChannelId 저장 (7일 유효)',
        '장바구니 담기 시 CartItem에 referrerChannelId 저장',
        '주문 시 CartItem → OrderItem으로 referrerChannelId 복사',
      ]
    },
    {
      phase: 3,
      title: '쇼핑몰 UI 변경',
      status: 'pending',
      tasks: [
        '채널별 섹션 제거',
        '통합 상품 목록으로 변경',
        'PublishedProduct에 is_shop_product 추가',
      ]
    },
    {
      phase: 4,
      title: '정산 로직 변경',
      status: 'pending',
      tasks: [
        'OrderItem.referrerChannelId 기반 정산 쿼리로 변경',
        '정산 관리 UI 수정',
        '정산 리포트에 Referrer 출처 표시 추가',
      ]
    },
    {
      phase: 5,
      title: '데이터 마이그레이션',
      status: 'pending',
      tasks: [
        '기존 채널별 PublishedProduct → 통합 쇼핑몰 상품으로 변환',
        '기존 주문 데이터는 그대로 유지 (referrer_channel_id = NULL)',
      ]
    },
  ]

  return (
    <div className="space-y-6">
      {/* 마이그레이션 개요 */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
        <h3 className="font-semibold text-amber-900 mb-2">마이그레이션 계획</h3>
        <p className="text-sm text-amber-700">
          5단계로 진행되며, 각 단계별로 테스트 및 검증 후 다음 단계로 진행합니다.
        </p>
      </div>

      {/* 단계별 가이드 */}
      <div className="space-y-4">
        {phases.map((phase) => (
          <div key={phase.phase} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${phase.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-200 text-gray-600'}
              `}>
                {phase.status === 'completed' ? '✓' : phase.phase}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{phase.title}</h4>
              </div>
              <span className={`
                px-3 py-1 rounded-full text-xs font-medium
                ${phase.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'}
              `}>
                {phase.status === 'completed' ? '완료' : '대기'}
              </span>
            </div>
            <div className="p-5">
              <ul className="space-y-2">
                {phase.tasks.map((task, taskIdx) => (
                  <li key={taskIdx} className="flex items-start gap-2 text-sm text-gray-600">
                    {phase.status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2" />
                    )}
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* SQL 예시 */}
      <div className="bg-gray-900 rounded-xl p-5 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-medium">정산 쿼리 (상품별 Referrer 기반)</h4>
        </div>
        <pre className="text-sm text-gray-300 font-mono">
{`-- 소매밴드별 정산 집계 (상품별)
SELECT
  oi.referrer_channel_id,
  c.name AS channel_name,
  COUNT(oi.id) AS item_count,
  SUM(oi.quantity) AS total_quantity,
  SUM(oi.total_price) AS total_amount
FROM order_item oi
LEFT JOIN channel c ON oi.referrer_channel_id = c.id
GROUP BY oi.referrer_channel_id, c.name
ORDER BY total_amount DESC;

-- 기간별 채널 정산 리포트
SELECT
  c.name as channel_name,
  DATE(o.created_at) as order_date,
  SUM(oi.total_price) as total_sales
FROM order_item oi
JOIN \`order\` o ON oi.order_id = o.id
LEFT JOIN channel c ON oi.referrer_channel_id = c.id
WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY c.name, DATE(o.created_at)
ORDER BY order_date DESC, total_sales DESC;`}
        </pre>
      </div>
    </div>
  )
}
