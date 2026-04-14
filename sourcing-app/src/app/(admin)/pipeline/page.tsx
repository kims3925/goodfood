'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Play,
  Pause,
  RefreshCw,
  Package,
  Zap,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  ArrowRight,
  Activity,
  ShoppingBag,
  Calculator,
  Truck,
  FileSpreadsheet,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'

// ===== Types =====

interface PipelineData {
  sourcing: {
    stats: {
      todayCollected: number
      pendingTransform: number
      readyToPublish: number
      todayPublished: number
    }
    hourlyStats: { hour: number; collect: number; transform: number; productCreate: number; publish: number }[]
    config: {
      isEnabled: boolean
      lastRunAt: string | null
      nextRunAt: string | null
      cronExpression: string | null
    } | null
    recentWorkflows: {
      id: number
      workflowType: string
      status: string
      startedAt: string
      completedAt: string | null
      totalItems: number
      processedItems: number
      successCount: number
      failedCount: number
      steps: { stepType: string; status: string; progress: number }[]
    }[]
  }
  orders: {
    statusCounts: Record<string, number>
    wholesaleStatusCounts: Record<string, number>
    todayNewOrders: number
    dailyTrend: { date: string; orders: number }[]
  }
  settlement: {
    pendingCount: number
    recentSettlements: {
      id: number
      shopName: string
      periodStart: string
      periodEnd: string
      totalOrders: number
      totalAmount: number
      status: string
      settledAt: string | null
    }[]
  }
  wholesaleChannels: { id: number; name: string; coverUrl: string | null }[]
}

// ===== Helper Functions =====

const formatNumber = (n: number) =>
  new Intl.NumberFormat('ko-KR').format(n)

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(n)

const formatRelativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const formatDateRange = (start: string, end: string) => {
  const s = new Date(start)
  const e = new Date(end)
  const fmt = (d: Date) =>
    `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`
  return `${fmt(s)} ~ ${fmt(e)}`
}

// ===== Status Configs =====

const workflowStatusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  COMPLETED: { label: '완료', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle },
  RUNNING: { label: '실행중', color: 'text-blue-600 bg-blue-50', icon: Activity },
  FAILED: { label: '실패', color: 'text-red-600 bg-red-50', icon: XCircle },
  PARTIAL_SUCCESS: { label: '부분성공', color: 'text-amber-600 bg-amber-50', icon: AlertCircle },
  PENDING: { label: '대기', color: 'text-gray-600 bg-gray-50', icon: Clock },
  WAITING_SESSION: { label: '세션대기', color: 'text-orange-600 bg-orange-50', icon: Clock },
}

const stepTypeLabels: Record<string, string> = {
  COLLECT: '수집',
  TRANSFORM: 'AI 변환',
  PRODUCT_CREATE: '상품 등록',
  PUBLISH: '발행',
}

const orderStatusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: '결제대기', color: 'bg-yellow-500' },
  PAID: { label: '결제완료', color: 'bg-indigo-500' },
  PREPARING: { label: '준비중', color: 'bg-purple-500' },
  SHIPPED: { label: '배송중', color: 'bg-blue-500' },
  DELIVERED: { label: '배송완료', color: 'bg-emerald-500' },
  CANCELLED: { label: '취소', color: 'bg-red-500' },
}

// ===== Page Component =====

export default function PipelineDashboardPage() {
  const [data, setData] = useState<PipelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const { showToast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/pipeline')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (error) {
      console.error('대시보드 데이터 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // 30초 자동 새로고침
    return () => clearInterval(interval)
  }, [fetchData])

  const handleExecutePipeline = async (type: string) => {
    setExecuting(true)
    try {
      const res = await fetch('/api/automation/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const json = await res.json()
      if (json.success) {
        showToast('파이프라인이 실행되었습니다.', 'success')
        setTimeout(fetchData, 2000)
      } else {
        showToast(json.error || '실행 실패', 'error')
      }
    } catch {
      showToast('파이프라인 실행에 실패했습니다.', 'error')
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>데이터를 불러올 수 없습니다.</p>
        <Button variant="secondary" className="mt-4" onClick={fetchData}>
          다시 시도
        </Button>
      </div>
    )
  }

  const { sourcing, orders, settlement, wholesaleChannels } = data

  // 파이프라인 단계별 요약 수치
  const pipelineSteps = [
    {
      label: '수집',
      value: sourcing.stats.todayCollected,
      icon: Package,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      label: 'AI 변환 대기',
      value: sourcing.stats.pendingTransform,
      icon: Zap,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      label: '발행 준비',
      value: sourcing.stats.readyToPublish,
      icon: Upload,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
    {
      label: '발행 완료',
      value: sourcing.stats.todayPublished,
      icon: CheckCircle,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
  ]

  // 주문 흐름 단계
  const orderFlowSteps = [
    { label: '신규 주문', value: orders.statusCounts['PAID'] || 0, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { label: '발주 대기', value: (wholesaleStatusMap(orders, 'NONE') + wholesaleStatusMap(orders, 'PENDING')), color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { label: '발주 완료', value: wholesaleStatusMap(orders, 'ORDERED'), color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { label: '배송완료', value: orders.statusCounts['DELIVERED'] || 0, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  ]

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">파이프라인 대시보드</h1>
          <p className="text-sm text-gray-500 mt-1">소싱 → 주문 → 발주 → 정산 전체 현황</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            새로고침
          </Button>
          {sourcing.config && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border">
              {sourcing.config.isEnabled ? (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-700 font-medium">자동화 활성</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-500">자동화 비활성</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========== Section 1: 소싱 파이프라인 ========== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            소싱 파이프라인
          </h2>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExecutePipeline('collect')}
              disabled={executing}
            >
              {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Package className="w-3.5 h-3.5 mr-1" />}
              수집
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExecutePipeline('transform')}
              disabled={executing}
            >
              {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
              AI 변환
            </Button>
            <Button
              size="sm"
              onClick={() => handleExecutePipeline('full')}
              disabled={executing}
            >
              {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
              전체 실행
            </Button>
          </div>
        </div>

        {/* 파이프라인 단계 카드 */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          {pipelineSteps.map((step, i) => (
            <Card key={step.label} padding="sm" className="relative">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${step.color}`}>
                  <step.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{step.label}</p>
                  <p className="text-xl font-bold text-text-primary">{formatNumber(step.value)}</p>
                </div>
              </div>
              {i < pipelineSteps.length - 1 && (
                <ArrowRight className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 z-10" />
              )}
            </Card>
          ))}
        </div>

        {/* 최근 워크플로우 */}
        <Card padding="sm">
          <div className="flex items-center justify-between px-2 py-1">
            <h3 className="text-sm font-semibold text-text-primary">최근 실행 로그</h3>
            <Link href="/sourcing/automation/logs" className="text-xs text-primary hover:underline flex items-center gap-1">
              전체 보기 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="mt-2">
            {sourcing.recentWorkflows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">실행 이력이 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {sourcing.recentWorkflows.map((wf) => {
                  const cfg = workflowStatusConfig[wf.status] || workflowStatusConfig.PENDING
                  const Icon = cfg.icon
                  return (
                    <div key={wf.id} className="flex items-center justify-between px-2 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        <span className="text-sm text-gray-700">{wf.workflowType}</span>
                        <div className="flex gap-1">
                          {wf.steps.map((s) => (
                              <span
                                key={s.stepType}
                                title={`${stepTypeLabels[s.stepType] || s.stepType}: ${s.progress}%`}
                                className={`inline-block w-2 h-2 rounded-full ${
                                  s.status === 'COMPLETED' ? 'bg-emerald-500' :
                                  s.status === 'RUNNING' ? 'bg-blue-500 animate-pulse' :
                                  s.status === 'FAILED' ? 'bg-red-500' :
                                  'bg-gray-300'
                                }`}
                              />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{wf.successCount}/{wf.totalItems} 성공</span>
                        <span>{formatRelativeTime(wf.startedAt)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ========== Section 2: 주문/발주 파이프라인 ========== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-500" />
            주문/발주 현황
          </h2>
          <Link href="/shop/order/list" className="text-sm text-primary hover:underline flex items-center gap-1">
            주문 목록 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* 주문 흐름 */}
          <div className="col-span-5">
            <Card padding="sm">
              <h3 className="text-sm font-semibold text-text-primary px-2 py-1 mb-2">주문 흐름</h3>
              <div className="space-y-2 px-2">
                {orderFlowSteps.map((step) => (
                  <div key={step.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{step.label}</span>
                    <span className="text-lg font-bold text-text-primary">{formatNumber(step.value)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 px-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">오늘 신규</span>
                  <span className="text-sm font-semibold text-primary">+{orders.todayNewOrders}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* 주문 상태 분포 + 추이 차트 */}
          <div className="col-span-7">
            <Card padding="sm">
              <h3 className="text-sm font-semibold text-text-primary px-2 py-1 mb-2">주문 현황 (7일)</h3>
              <div className="flex gap-4 mb-3 px-2">
                {Object.entries(orders.statusCounts).map(([status, count]) => {
                  const cfg = orderStatusLabels[status]
                  if (!cfg) return null
                  return (
                    <div key={status} className="flex items-center gap-1.5 text-xs">
                      <span className={`w-2 h-2 rounded-full ${cfg.color}`} />
                      <span className="text-gray-600">{cfg.label}</span>
                      <span className="font-semibold text-text-primary">{count}</span>
                    </div>
                  )
                })}
              </div>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orders.dailyTrend} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number | undefined) => [`${value ?? 0}건`, '주문']}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        {/* 도매 발주 현황 */}
        {wholesaleChannels.length > 0 && (
          <div className="mt-4">
            <Card padding="sm">
              <div className="flex items-center justify-between px-2 py-1">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-500" />
                  도매 발주 현황
                </h3>
                <Link href="/shop/wholesale-orders" className="text-xs text-primary hover:underline flex items-center gap-1">
                  발주 관리 <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2 px-2">
                <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-200">
                  <p className="text-xs text-amber-600 mb-1">발주 대기</p>
                  <p className="text-2xl font-bold text-amber-700">
                    {formatNumber(
                      (orders.wholesaleStatusCounts['NONE'] || 0) +
                      (orders.wholesaleStatusCounts['PENDING'] || 0)
                    )}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                  <p className="text-xs text-blue-600 mb-1">발주 완료</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatNumber(orders.wholesaleStatusCounts['ORDERED'] || 0)}
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
                  <p className="text-xs text-emerald-600 mb-1">도매처 확인</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {formatNumber(orders.wholesaleStatusCounts['CONFIRMED'] || 0)}
                  </p>
                </div>
              </div>
              {/* 도매 채널 목록 */}
              <div className="flex gap-2 mt-3 px-2 overflow-x-auto">
                {wholesaleChannels.map((ch) => (
                  <span
                    key={ch.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700 whitespace-nowrap"
                  >
                    {ch.coverUrl && (
                      <img src={ch.coverUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                    )}
                    {ch.name}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ========== Section 3: 정산 현황 ========== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Calculator className="w-5 h-5 text-green-500" />
            정산 현황
          </h2>
          <div className="flex gap-2">
            <Link href="/shop/settlement/wholesale">
              <Button variant="secondary" size="sm">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                도매 정산서
              </Button>
            </Link>
            <Link href="/shop/settlement/list">
              <Button variant="secondary" size="sm">
                전체 정산 <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* 미정산 건수 */}
          <div className="col-span-4">
            <Card padding="md" className="h-full">
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center mb-3">
                  <Calculator className="w-8 h-8 text-orange-500" />
                </div>
                <p className="text-sm text-gray-500 mb-1">정산 대기 주문</p>
                <p className="text-3xl font-bold text-text-primary">{formatNumber(settlement.pendingCount)}</p>
                <p className="text-xs text-gray-400 mt-1">배송완료 주문 기준</p>
              </div>
            </Card>
          </div>

          {/* 최근 정산 이력 */}
          <div className="col-span-8">
            <Card padding="sm">
              <div className="flex items-center justify-between px-2 py-1">
                <h3 className="text-sm font-semibold text-text-primary">최근 정산 이력</h3>
                <Link href="/shop/settlement/history" className="text-xs text-primary hover:underline flex items-center gap-1">
                  전체 보기 <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="mt-2">
                {settlement.recentSettlements.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">정산 이력이 없습니다.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {settlement.recentSettlements.map((s) => (
                      <div key={s.id} className="flex items-center justify-between px-2 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                            s.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {s.status === 'COMPLETED' ? '완료' : s.status === 'PENDING' ? '대기' : '취소'}
                          </span>
                          <div>
                            <span className="text-sm text-gray-700">{s.shopName}</span>
                            <span className="text-xs text-gray-400 ml-2">
                              {formatDateRange(s.periodStart, s.periodEnd)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-text-primary">{formatCurrency(s.totalAmount)}</p>
                          <p className="text-xs text-gray-400">{s.totalOrders}건</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ========== 자동화 스케줄 정보 ========== */}
      {sourcing.config && (
        <Card padding="sm">
          <div className="flex items-center justify-between px-2 py-1">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              자동화 스케줄
            </h3>
            <Link href="/sourcing/automation/settings" className="text-xs text-primary hover:underline flex items-center gap-1">
              설정 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex items-center gap-8 mt-2 px-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">상태:</span>
              <span className={`font-medium ${sourcing.config.isEnabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                {sourcing.config.isEnabled ? '활성' : '비활성'}
              </span>
            </div>
            {sourcing.config.cronExpression && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">스케줄:</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{sourcing.config.cronExpression}</span>
              </div>
            )}
            {sourcing.config.lastRunAt && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">마지막 실행:</span>
                <span className="text-text-primary">{formatDateTime(sourcing.config.lastRunAt)}</span>
              </div>
            )}
            {sourcing.config.nextRunAt && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">다음 실행:</span>
                <span className="text-primary font-medium">{formatDateTime(sourcing.config.nextRunAt)}</span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

// 도매 발주 상태 헬퍼
function wholesaleStatusMap(orders: PipelineData['orders'], key: string): number {
  return orders.wholesaleStatusCounts[key] || 0
}
