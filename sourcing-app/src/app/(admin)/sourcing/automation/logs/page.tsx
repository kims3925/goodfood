'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  AlertCircle, Clock, ChevronDown, ChevronUp, Download, Zap,
  Package, Send, Bot, Activity, Timer, TrendingUp
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

interface WorkflowStepLog {
  stepType: string
  stepOrder: number
  status: string
  startedAt: string | null
  completedAt: string | null
  duration: number | null
  totalItems: number
  processedItems: number
  successCount: number
  failedCount: number
  progress: number
  errorMessage: string | null
  details: Record<string, any> | null
}

interface WorkflowLog {
  id: number
  workflowType: string
  status: string
  startedAt: string
  completedAt: string | null
  totalItems: number
  successCount: number
  failedCount: number
  errorMessage: string | null
  details: Record<string, any> | null
  currentStep: string | null
  steps: WorkflowStepLog[]
}

const TYPE_LABELS: Record<string, string> = {
  COLLECT: '게시물 수집',
  TRANSFORM: 'AI 변환',
  PUBLISH: '소매밴드 발행',
  FULL_PIPELINE: '파이프라인 실행',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  COLLECT: <Download size={16} />,
  TRANSFORM: <Bot size={16} />,
  PUBLISH: <Send size={16} />,
  FULL_PIPELINE: <Zap size={16} />,
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; bgColor: string; textColor: string; borderColor: string }> = {
  PENDING: {
    label: '대기',
    icon: <Clock size={14} />,
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200'
  },
  RUNNING: {
    label: '실행 중',
    icon: <RefreshCw size={14} className="animate-spin" />,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200'
  },
  COMPLETED: {
    label: '완료',
    icon: <CheckCircle size={14} />,
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200'
  },
  // API에서 COMPLETED/PARTIAL_SUCCESS를 SUCCESS로 변환하므로 SUCCESS도 추가
  SUCCESS: {
    label: '성공',
    icon: <CheckCircle size={14} />,
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200'
  },
  FAILED: {
    label: '실패',
    icon: <XCircle size={14} />,
    bgColor: 'bg-red-50',
    textColor: 'text-red-600',
    borderColor: 'border-red-200'
  },
  PARTIAL_SUCCESS: {
    label: '부분 성공',
    icon: <AlertCircle size={14} />,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200'
  },
}

// 소요시간 포맷
const formatStepDuration = (durationMs: number | null) => {
  if (!durationMs) return '-'
  const seconds = Math.floor(durationMs / 1000)
  if (seconds < 60) return `${seconds}초`
  const minutes = Math.floor(seconds / 60)
  const remainingSecs = seconds % 60
  if (minutes < 60) return `${minutes}분 ${remainingSecs}초`
  const hours = Math.floor(minutes / 60)
  return `${hours}시간 ${minutes % 60}분`
}

// 타임라인 스타일 단계별 섹션 컴포넌트
const TimelineLogSection = ({
  details,
  workflowType,
  steps = [],
  currentStep
}: {
  details: Record<string, any>
  workflowType: string
  steps?: WorkflowStepLog[]
  currentStep?: string | null
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const toggleSection = (name: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  interface StageData {
    name: string
    icon: React.ReactNode
    status: 'success' | 'failed' | 'warning' | 'skipped' | 'pending' | 'running'
    summary: string
    stats?: { label: string; value: number | string; color?: string }[]
    details: React.ReactNode
    hasData: boolean
    duration?: number | null
    progress?: number
    isCurrentStep?: boolean
    errorMessage?: string | null
    startedAt?: string | null
    completedAt?: string | null
  }

  // 워크플로우 타입에 따라 표시할 단계 결정
  const getVisibleStages = (): ('collection' | 'transform' | 'productCreate' | 'publish')[] => {
    switch (workflowType) {
      case 'COLLECT':
        return ['collection']
      case 'TRANSFORM':
        return ['transform', 'productCreate']
      case 'PUBLISH':
        return ['publish']
      case 'FULL_PIPELINE':
      default:
        return ['collection', 'transform', 'productCreate', 'publish']
    }
  }

  // steps 배열에서 해당 stepType 찾기 (step 데이터 우선)
  const getStepByType = (stepType: string): WorkflowStepLog | undefined => {
    return steps.find(s => s.stepType === stepType)
  }

  // step status를 StageData status로 변환
  const mapStepStatus = (step: WorkflowStepLog | undefined, hasData: boolean): StageData['status'] => {
    if (step) {
      switch (step.status) {
        case 'RUNNING': return 'running'
        case 'COMPLETED': return step.failedCount > 0 ? 'warning' : 'success'
        case 'FAILED': return 'failed'
        case 'SKIPPED': return 'skipped'
        case 'PENDING': return 'pending'
        default: return 'pending'
      }
    }
    // step 데이터가 없으면 details 기반으로 판단
    return hasData ? 'success' : 'pending'
  }

  // step 시간 포맷
  const formatStepTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const visibleStages = getVisibleStages()
  const stages: StageData[] = []

  // Collection 단계
  if (visibleStages.includes('collection')) {
    const step = getStepByType('collection')
    const stepDetails = step?.details as Record<string, any> | null
    const hasData = !!step || !!details.collection
    const isCurrentStep = currentStep === 'collection'

    // step 데이터 우선, 없으면 details에서
    const totalNew = step?.successCount ?? details.collection?.totalNewPosts ?? 0
    const totalDup = stepDetails?.totalDuplicates ?? details.collection?.totalDuplicates ?? 0
    const channelResults = stepDetails?.channelResults ?? details.collection?.channelResults ?? []
    const totalFetched = channelResults.reduce((sum: number, ch: any) => sum + (ch.fetched || ch.newPosts + (ch.duplicates || 0)), 0) || (totalNew + totalDup)

    stages.push({
      name: '수집',
      icon: <Download size={18} />,
      status: mapStepStatus(step, hasData),
      summary: step?.status === 'RUNNING'
        ? `진행 중 ${step.processedItems}/${step.totalItems}건`
        : hasData ? `${totalNew}/${totalFetched}건` : '대기 중',
      hasData,
      duration: step?.duration,
      progress: step?.progress,
      isCurrentStep,
      errorMessage: step?.errorMessage,
      startedAt: step?.startedAt,
      completedAt: step?.completedAt,
      stats: hasData ? [
        { label: '신규', value: totalNew, color: 'text-emerald-600' },
        { label: '중복', value: totalDup, color: 'text-slate-400' },
        { label: '전체', value: totalFetched, color: 'text-slate-500' },
      ] : undefined,
      details: hasData ? (
        <div className="space-y-3">
          {/* 에러 메시지 */}
          {step?.errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700">{step.errorMessage}</p>
              </div>
            </div>
          )}

          {/* 채널별 결과 */}
          {channelResults.length > 0 ? (
            <div className="space-y-2">
              {channelResults.map((ch: any, i: number) => {
                const fetched = ch.fetched || ch.newPosts + (ch.duplicates || 0)
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                      ch.newPosts > 0 ? 'bg-emerald-50/50' : 'bg-slate-50'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${ch.newPosts > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className="text-sm font-medium text-slate-700">{ch.channelName}</span>
                    <span className={`text-sm font-semibold ${ch.newPosts > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {ch.newPosts}/{fetched}건
                    </span>
                    {ch.duplicates > 0 && (
                      <span className="text-slate-400 text-xs">(중복 {ch.duplicates})</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-sm text-slate-400 text-center py-2">채널별 상세 정보 없음</div>
          )}

          {/* 실행 시간 정보 */}
          {step?.startedAt && (
            <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-100">
              <span>시작: {formatStepTime(step.startedAt)}</span>
              {step.completedAt && <span>종료: {formatStepTime(step.completedAt)}</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-400 text-center py-2">이 단계의 로그가 기록되지 않았습니다</div>
      ),
    })
  }

  // Transform 단계
  if (visibleStages.includes('transform')) {
    const step = getStepByType('transform')
    const stepDetails = step?.details as Record<string, any> | null
    const hasData = !!step || !!details.transform
    const isCurrentStep = currentStep === 'transform'

    // step 데이터 우선
    const successCount = step?.successCount ?? details.transform?.createdProducts ?? 0
    const failedCount = step?.failedCount ?? details.transform?.retryablePostIds?.length ?? 0
    const total = step?.totalItems || step?.processedItems || (successCount + failedCount)
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0
    const transformedPosts = stepDetails?.transformedPosts ?? details.transform?.transformedPosts ?? []

    stages.push({
      name: 'AI 변환',
      icon: <Bot size={18} />,
      status: mapStepStatus(step, hasData),
      summary: step?.status === 'RUNNING'
        ? `진행 중 ${step.processedItems}/${step.totalItems}건`
        : hasData ? `${successCount}/${total}건 (${successRate}%)` : '대기 중',
      hasData,
      duration: step?.duration,
      progress: step?.progress,
      isCurrentStep,
      errorMessage: step?.errorMessage,
      startedAt: step?.startedAt,
      completedAt: step?.completedAt,
      stats: hasData ? [
        { label: '성공', value: successCount, color: 'text-emerald-600' },
        { label: '실패', value: failedCount, color: failedCount > 0 ? 'text-red-500' : 'text-slate-400' },
        { label: '성공률', value: `${successRate}%`, color: successRate >= 80 ? 'text-emerald-600' : successRate >= 50 ? 'text-amber-600' : 'text-red-500' },
      ] : undefined,
      details: hasData ? (
        <div className="space-y-3">
          {/* step 에러 메시지 */}
          {step?.errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700">{step.errorMessage}</p>
              </div>
            </div>
          )}

          {/* 성공률 프로그레스 바 */}
          {total > 0 && (
            <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
                  successRate >= 80 ? 'bg-emerald-500' : successRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${successRate}%` }}
              />
            </div>
          )}

          {/* 실패 목록 */}
          {failedCount > 0 && transformedPosts.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-red-600 mb-2">실패 항목:</p>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                {transformedPosts
                  .filter((p: any) => p.status === 'failed')
                  .slice(0, 10)
                  .map((p: any, i: number) => (
                    <div
                      key={i}
                      className="text-xs text-red-600 py-1.5 px-2 bg-red-50 rounded border-l-2 border-red-400"
                    >
                      <span className="font-mono text-red-400">#{p.postId}</span>
                      <span className="mx-1.5">-</span>
                      <span>{p.error}</span>
                    </div>
                  ))}
                {transformedPosts.filter((p: any) => p.status === 'failed').length > 10 && (
                  <div className="text-xs text-slate-500 py-1">
                    ... 외 {transformedPosts.filter((p: any) => p.status === 'failed').length - 10}건
                  </div>
                )}
              </div>
            </div>
          )}
          {total === 0 && !step?.errorMessage && (
            <div className="text-sm text-slate-400 text-center py-2">변환할 항목이 없었습니다</div>
          )}

          {/* 실행 시간 정보 */}
          {step?.startedAt && (
            <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-100">
              <span>시작: {formatStepTime(step.startedAt)}</span>
              {step.completedAt && <span>종료: {formatStepTime(step.completedAt)}</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-400 text-center py-2">이 단계의 로그가 기록되지 않았습니다</div>
      ),
    })
  }

  // ProductCreate 단계
  if (visibleStages.includes('productCreate')) {
    const step = getStepByType('productCreate')
    const stepDetails = step?.details as Record<string, any> | null
    const hasData = !!step || !!details.productCreate
    const isCurrentStep = currentStep === 'productCreate'

    // step 데이터 우선
    const successCount = step?.successCount ?? details.productCreate?.totalCreated ?? 0
    const failedCount = step?.failedCount ?? 0
    const createdProducts = stepDetails?.createdProducts ?? details.productCreate?.createdProducts ?? []

    stages.push({
      name: '상품 생성',
      icon: <Package size={18} />,
      status: mapStepStatus(step, hasData),
      summary: step?.status === 'RUNNING'
        ? `진행 중 ${step.processedItems}/${step.totalItems}건`
        : hasData ? `${successCount}개 생성` : '대기 중',
      hasData,
      duration: step?.duration,
      progress: step?.progress,
      isCurrentStep,
      errorMessage: step?.errorMessage,
      startedAt: step?.startedAt,
      completedAt: step?.completedAt,
      stats: hasData ? [
        { label: '생성', value: successCount, color: 'text-emerald-600' },
        { label: '실패', value: failedCount, color: failedCount > 0 ? 'text-red-500' : 'text-slate-400' },
      ] : undefined,
      details: hasData ? (
        <div className="space-y-3">
          {/* step 에러 메시지 */}
          {step?.errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700">{step.errorMessage}</p>
              </div>
            </div>
          )}

          {/* 생성된 상품 목록 */}
          {createdProducts.length > 0 ? (
            <div className="space-y-1.5">
              {createdProducts.slice(0, 10).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1.5 px-2 bg-slate-50 rounded-lg">
                  <span className="text-emerald-500 font-bold">+</span>
                  <span className="flex-1 text-slate-700 font-medium truncate">
                    {p.productName || `상품 #${p.productId}`}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">#{p.productId}</span>
                </div>
              ))}
              {createdProducts.length > 10 && (
                <div className="text-xs text-slate-400 pt-1 text-center">
                  ... 외 {createdProducts.length - 10}개
                </div>
              )}
            </div>
          ) : !step?.errorMessage && (
            <div className="text-sm text-slate-400 text-center py-2">생성된 상품이 없습니다</div>
          )}

          {/* 실행 시간 정보 */}
          {step?.startedAt && (
            <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-100">
              <span>시작: {formatStepTime(step.startedAt)}</span>
              {step.completedAt && <span>종료: {formatStepTime(step.completedAt)}</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-400 text-center py-2">이 단계의 로그가 기록되지 않았습니다</div>
      ),
    })
  }

  // Publish 단계
  if (visibleStages.includes('publish')) {
    const step = getStepByType('publish')
    const stepDetails = step?.details as Record<string, any> | null
    const hasData = !!step || !!details.publish
    const isCurrentStep = currentStep === 'publish'

    // step 데이터 우선
    const publishedProducts = stepDetails?.publishedProducts ?? details.publish?.publishedProducts ?? []
    const channelResults = stepDetails?.channelResults ?? details.publish?.channelResults ?? []

    // channelResults가 있으면 사용, 없으면 publishedProducts에서 계산
    let totalSuccess = step?.successCount ?? 0
    let totalFailed = step?.failedCount ?? 0
    let displayItems: { channelName: string; success: number; failed: number; attempted: number }[] = []

    if (channelResults.length > 0) {
      totalSuccess = channelResults.reduce((sum: number, ch: any) => sum + (ch.success || 0), 0)
      totalFailed = channelResults.reduce((sum: number, ch: any) => sum + (ch.failed || 0), 0)
      displayItems = channelResults.map((ch: any) => ({
        channelName: (ch.targetName || ch.channelName || '')?.replace(/^Shop:\s*/, '') || `채널 ${ch.targetId || ch.channelId}`,
        success: ch.success || 0,
        failed: ch.failed || 0,
        attempted: ch.attempted || (ch.success || 0) + (ch.failed || 0),
      }))
    } else if (publishedProducts.length > 0) {
      // publishedProducts에서 통계 계산
      const channelMap = new Map<number, { name: string; success: number; failed: number }>()
      for (const p of publishedProducts) {
        const channelId = p.targetId || p.channelId
        if (!channelMap.has(channelId)) {
          channelMap.set(channelId, { name: p.targetName || p.channelName || '', success: 0, failed: 0 })
        }
        const stats = channelMap.get(channelId)!
        const pName = p.targetName || p.channelName
        if (pName && !stats.name) {
          stats.name = pName
        }
        if (p.status === 'SUCCESS') {
          stats.success++
          if (!step) totalSuccess++
        } else if (p.status === 'FAILED') {
          stats.failed++
          if (!step) totalFailed++
        }
      }

      const pendingChannel = stepDetails?.pendingChannel ?? details.publish?.pendingChannel
      channelMap.forEach((stats, channelId) => {
        displayItems.push({
          channelName: stats.name || (pendingChannel?.id === channelId ? pendingChannel.name : `채널 ${channelId}`),
          success: stats.success,
          failed: stats.failed,
          attempted: stats.success + stats.failed,
        })
      })
    }

    stages.push({
      name: '발행',
      icon: <Send size={18} />,
      status: mapStepStatus(step, hasData),
      summary: step?.status === 'RUNNING'
        ? `진행 중 ${step.processedItems}/${step.totalItems}건`
        : hasData ? `${totalSuccess}건 발행` : '대기 중',
      hasData,
      duration: step?.duration,
      progress: step?.progress,
      isCurrentStep,
      errorMessage: step?.errorMessage,
      startedAt: step?.startedAt,
      completedAt: step?.completedAt,
      stats: hasData ? [
        { label: '성공', value: totalSuccess, color: 'text-emerald-600' },
        { label: '실패', value: totalFailed, color: totalFailed > 0 ? 'text-red-500' : 'text-slate-400' },
      ] : undefined,
      details: hasData ? (
        <div className="space-y-3">
          {/* step 에러 메시지 */}
          {step?.errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700">{step.errorMessage}</p>
              </div>
            </div>
          )}

          {/* 채널별 결과 */}
          {displayItems.length > 0 ? (
            <div className="space-y-2">
              {displayItems.map((ch, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-2.5 rounded-lg ${ch.failed === 0 && ch.success > 0 ? 'bg-emerald-50/50' : ch.success === 0 ? 'bg-red-50/50' : 'bg-amber-50/50'}`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${ch.failed === 0 && ch.success > 0 ? 'bg-emerald-500' : ch.success === 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="text-sm font-medium text-slate-700">{ch.channelName}</span>
                  <span className={`text-sm font-semibold ${ch.success > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {ch.success}/{ch.attempted}건
                  </span>
                  {ch.failed > 0 && (
                    <span className="text-xs text-red-500">({ch.failed}건 실패)</span>
                  )}
                </div>
              ))}
            </div>
          ) : !step?.errorMessage && (
            <div className="text-sm text-slate-400 text-center py-2">발행된 항목이 없습니다</div>
          )}

          {/* 실행 시간 정보 */}
          {step?.startedAt && (
            <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-100">
              <span>시작: {formatStepTime(step.startedAt)}</span>
              {step.completedAt && <span>종료: {formatStepTime(step.completedAt)}</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-400 text-center py-2">이 단계의 로그가 기록되지 않았습니다</div>
      ),
    })
  }

  const statusStyles = {
    success: { bg: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-600' },
    failed: { bg: 'bg-red-500', ring: 'ring-red-200', text: 'text-red-600' },
    warning: { bg: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-600' },
    skipped: { bg: 'bg-slate-300', ring: 'ring-slate-100', text: 'text-slate-400' },
    pending: { bg: 'bg-slate-200', ring: 'ring-slate-100', text: 'text-slate-400' },
    running: { bg: 'bg-blue-500', ring: 'ring-blue-200', text: 'text-blue-600' },
  }

  return (
    <div className="relative">
      {/* 타임라인 세로선 */}
      <div className="absolute left-[17px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />

      <div className="space-y-1">
        {stages.map((stage, index) => {
          const isExpanded = expandedSections.has(stage.name)
          const styles = statusStyles[stage.status]
          const isRunning = stage.status === 'running'

          return (
            <div key={stage.name} className={`relative ${stage.isCurrentStep ? 'z-10' : ''}`}>
              {/* 타임라인 노드 */}
              <div className={`absolute left-2 top-4 w-3 h-3 rounded-full ${styles.bg} ring-4 ${styles.ring} z-10 ${isRunning ? 'animate-pulse' : ''}`} />

              <div className="ml-10">
                <button
                  onClick={() => toggleSection(stage.name)}
                  className={`w-full text-left rounded-xl transition-all duration-200 ${
                    stage.isCurrentStep
                      ? 'bg-blue-50 shadow-md ring-2 ring-blue-300'
                      : isExpanded
                        ? 'bg-white shadow-sm ring-1 ring-slate-200'
                        : 'hover:bg-slate-50'
                  } ${!stage.hasData && !stage.isCurrentStep ? 'opacity-60' : ''}`}
                >
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${
                        isRunning ? 'bg-blue-100 text-blue-600' :
                        stage.status === 'success' ? 'bg-emerald-100 text-emerald-600' :
                        stage.status === 'failed' ? 'bg-red-100 text-red-600' :
                        stage.status === 'warning' ? 'bg-amber-100 text-amber-600' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {isRunning ? <RefreshCw size={18} className="animate-spin" /> : stage.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${stage.isCurrentStep ? 'text-blue-800' : 'text-slate-800'}`}>{stage.name}</span>
                          <span className={`text-sm ${isRunning ? 'text-blue-600 font-medium' : styles.text}`}>{stage.summary}</span>
                          {stage.isCurrentStep && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium animate-pulse">진행 중</span>
                          )}
                          {!stage.hasData && !stage.isCurrentStep && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">미실행</span>
                          )}
                          {stage.duration && stage.status !== 'running' && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Timer size={12} />
                              {formatStepDuration(stage.duration)}
                            </span>
                          )}
                        </div>
                        {/* 진행률 바 (실행 중인 단계) */}
                        {isRunning && typeof stage.progress === 'number' && stage.progress > 0 && (
                          <div className="mt-1.5 w-full max-w-xs">
                            <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                style={{ width: `${stage.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {stage.stats && !isRunning && (
                          <div className="flex items-center gap-3 mt-0.5">
                            {stage.stats.map((stat, i) => (
                              <span key={i} className="text-xs">
                                <span className="text-slate-400">{stat.label}</span>
                                <span className={`ml-1 font-medium ${stat.color}`}>{stat.value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`p-1 rounded transition-colors ${isExpanded ? 'bg-slate-100' : ''}`}>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1">
                    <div className="p-3 bg-slate-50/50 rounded-lg">
                      {stage.details}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 에러 로그 섹션 */}
      {details.errors && details.errors.length > 0 && (
        <div className="relative mt-4">
          <div className="absolute left-2 top-4 w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-200 z-10" />
          <div className="ml-10">
            <button
              onClick={() => toggleSection('errors')}
              className={`w-full text-left rounded-xl transition-all duration-200 ${
                expandedSections.has('errors')
                  ? 'bg-red-50 shadow-sm ring-1 ring-red-200'
                  : 'hover:bg-red-50/50'
              }`}
            >
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-red-100 text-red-600">
                    <XCircle size={18} />
                  </div>
                  <div>
                    <span className="font-semibold text-red-700">에러 로그</span>
                    <span className="ml-2 text-sm text-red-500">{details.errors.length}건</span>
                  </div>
                </div>
                <div className={`p-1 rounded transition-colors ${expandedSections.has('errors') ? 'bg-red-100' : ''}`}>
                  {expandedSections.has('errors') ? (
                    <ChevronUp size={16} className="text-red-400" />
                  ) : (
                    <ChevronDown size={16} className="text-red-400" />
                  )}
                </div>
              </div>
            </button>

            {expandedSections.has('errors') && (
              <div className="px-3 pb-3 pt-1">
                <div className="max-h-40 overflow-y-auto space-y-1 p-3 bg-red-50/50 rounded-lg">
                  {details.errors.map((err: any, i: number) => (
                    <div
                      key={i}
                      className="text-xs text-red-700 py-1.5 px-2 bg-white rounded border-l-2 border-red-400"
                    >
                      {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 요약 통계 카드
const SummaryStats = ({ logs }: { logs: WorkflowLog[] }) => {
  const totalRuns = logs.length
  const successRuns = logs.filter(l => l.status === 'COMPLETED').length
  const failedRuns = logs.filter(l => l.status === 'FAILED').length
  const totalItems = logs.reduce((sum, l) => sum + l.totalItems, 0)
  const successItems = logs.reduce((sum, l) => sum + l.successCount, 0)

  const stats = [
    {
      label: '총 실행',
      value: totalRuns,
      icon: <Activity size={18} />,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      label: '성공',
      value: successRuns,
      icon: <CheckCircle size={18} />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    {
      label: '실패',
      value: failedRuns,
      icon: <XCircle size={18} />,
      color: 'text-red-600',
      bg: 'bg-red-50'
    },
    {
      label: '처리 건수',
      value: `${successItems}/${totalItems}`,
      icon: <TrendingUp size={18} />,
      color: 'text-violet-600',
      bg: 'bg-violet-50'
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <div key={i} className={`${stat.bg} rounded-xl p-4 flex items-center gap-3`}>
          <div className={`${stat.color}`}>{stat.icon}</div>
          <div>
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AutomationLogsPage() {
  const [logs, setLogs] = useState<WorkflowLog[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  const [hasRunningWorkflow, setHasRunningWorkflow] = useState(false)

  // 실행 중인 워크플로우가 있으면 자동 새로고침
  const loadLogs = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '10',
      })

      const response = await fetch(`/api/automation/logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.data.logs || [])
        setTotalPages(data.data.pagination?.totalPages || 1)
        // RUNNING 상태 워크플로우 확인
        const running = (data.data.logs || []).some(
          (log: WorkflowLog) => log.status === 'RUNNING'
        )
        setHasRunningWorkflow(running)
      }
    } catch (error) {
      console.error('로그 로드 실패:', error)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [currentPage])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // 실행 중인 워크플로우가 있으면 5초마다 자동 새로고침
  useEffect(() => {
    if (!hasRunningWorkflow) return

    const intervalId = setInterval(() => {
      loadLogs(true) // silent refresh
    }, 5000)

    return () => clearInterval(intervalId)
  }, [hasRunningWorkflow, loadLogs])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`

    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const datePart = date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '-').replace(/\.$/, '')
    const timePart = date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${datePart} ${timePart}`
  }

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return '-'
    const duration = new Date(end).getTime() - new Date(start).getTime()
    const seconds = Math.floor(duration / 1000)
    if (seconds < 60) return `${seconds}초`
    const minutes = Math.floor(seconds / 60)
    const remainingSecs = seconds % 60
    if (minutes < 60) return `${minutes}분 ${remainingSecs}초`
    const hours = Math.floor(minutes / 60)
    return `${hours}시간 ${minutes % 60}분`
  }

  // 기술적 에러 메시지를 유저 친화적인 문장으로 변환
  const formatErrorMessage = (errorMessage: string | null): string => {
    if (!errorMessage) return ''

    // Prisma 관련 에러
    if (errorMessage.includes('prisma') || errorMessage.includes('Prisma')) {
      if (errorMessage.includes('update')) {
        return '데이터를 업데이트하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      }
      if (errorMessage.includes('create')) {
        return '데이터를 저장하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      }
      if (errorMessage.includes('delete')) {
        return '데이터를 삭제하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      }
      return '데이터베이스 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
    }

    // 네트워크 관련 에러
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused')) {
      return '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.'
    }
    if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return '요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.'
    }
    if (errorMessage.includes('ENOTFOUND')) {
      return '서버를 찾을 수 없습니다. 네트워크 연결을 확인해주세요.'
    }

    // API 관련 에러
    if (errorMessage.includes('rate limit') || errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
      return 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
    }
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return '인증에 실패했습니다. API 키 설정을 확인해주세요.'
    }
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return '접근 권한이 없습니다. API 설정을 확인해주세요.'
    }
    if (errorMessage.includes('404') || errorMessage.includes('Not found')) {
      return '요청한 데이터를 찾을 수 없습니다.'
    }
    if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
      return '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    }

    // AI 관련 에러
    if (errorMessage.includes('AI') || errorMessage.includes('Gemini') || errorMessage.includes('OpenAI') || errorMessage.includes('Claude')) {
      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        return 'AI 서비스 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.'
      }
      if (errorMessage.includes('API key') || errorMessage.includes('api_key')) {
        return 'AI API 키가 올바르지 않습니다. 설정을 확인해주세요.'
      }
      return 'AI 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
    }

    // 밴드/채널 관련 에러
    if (errorMessage.includes('채널') || errorMessage.includes('channel') || errorMessage.includes('Channel')) {
      if (errorMessage.includes('없') || errorMessage.includes('not found')) {
        return '발행할 채널을 찾을 수 없습니다. 채널 설정을 확인해주세요.'
      }
      return '채널 처리 중 문제가 발생했습니다.'
    }

    // 상품 관련 에러
    if (errorMessage.includes('상품') || errorMessage.includes('product') || errorMessage.includes('Product')) {
      if (errorMessage.includes('없') || errorMessage.includes('not found')) {
        return '처리할 상품을 찾을 수 없습니다.'
      }
      return '상품 처리 중 문제가 발생했습니다.'
    }

    // 사용자 취소
    if (errorMessage.includes('취소') || errorMessage.includes('cancel') || errorMessage.includes('Cancel')) {
      return '사용자에 의해 작업이 취소되었습니다.'
    }

    // 자동 종료
    if (errorMessage.includes('자동 종료') || errorMessage.includes('응답이 없어')) {
      return '작업이 오래 걸려 자동으로 종료되었습니다. 네트워크 상태를 확인해주세요.'
    }

    // 한글이 포함된 경우 그대로 표시 (이미 유저 친화적일 가능성)
    if (/[가-힣]/.test(errorMessage) && errorMessage.length < 100) {
      return errorMessage
    }

    // 너무 긴 에러 메시지는 요약
    if (errorMessage.length > 100) {
      return '작업 처리 중 오류가 발생했습니다. 자세한 내용은 관리자에게 문의해주세요.'
    }

    // 기타 에러
    return '작업 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">실행 로그</h1>
          <p className="text-slate-500 mt-1">자동화 워크플로우 실행 기록을 확인합니다</p>
        </div>
        <div className="flex items-center gap-3">
          {hasRunningWorkflow && (
            <span className="text-xs text-blue-600 flex items-center gap-1.5 animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              자동 새로고침 중
            </span>
          )}
          <Button
            variant="secondary"
            onClick={() => loadLogs()}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            새로고침
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {!isLoading && logs.length > 0 && <SummaryStats logs={logs} />}

      {/* Logs List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">로그를 불러오는 중...</p>
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <Activity size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-500">실행 로그가 없습니다</p>
            <p className="text-sm text-slate-400">자동화를 실행하면 여기에 로그가 표시됩니다</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const status = STATUS_CONFIG[log.status] || STATUS_CONFIG.PENDING
            const isExpanded = expandedLogId === log.id
            // 실행 중이면 진행률(progress), 완료되면 성공률(successRate) 사용
            const isRunning = log.status === 'RUNNING'
            const successRate = log.totalItems > 0
              ? Math.round((log.successCount / log.totalItems) * 100)
              : 0
            // API에서 전달받은 progress 사용 (없으면 successRate 사용)
            const displayProgress = isRunning
              ? (log.progress ?? successRate)
              : successRate

            return (
              <div
                key={log.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isExpanded
                    ? `ring-2 ${status.borderColor} shadow-lg`
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <button
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  className="w-full px-6 py-4 text-left"
                >
                  <div className="flex items-center justify-between">
                    {/* 상태 배지 */}
                    <div className={`w-[100px] shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 rounded-full ${status.bgColor} ${status.textColor}`}>
                      {status.icon}
                      <span className="text-sm font-medium">{status.label}</span>
                    </div>

                    {/* 타입 */}
                    <div className="w-[180px] shrink-0 flex items-center justify-center gap-2">
                      <span className="text-slate-400">{TYPE_ICONS[log.workflowType]}</span>
                      <span className="font-semibold text-slate-800 truncate">
                        {TYPE_LABELS[log.workflowType] || log.workflowType}
                      </span>
                    </div>

                    {/* 진행률/성공률 미니 차트 */}
                    <div className="w-[100px] shrink-0 hidden md:flex items-center justify-center gap-2">
                      <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isRunning ? 'bg-blue-500' :
                            displayProgress >= 80 ? 'bg-emerald-500' :
                            displayProgress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${displayProgress}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${isRunning ? 'text-blue-600' : 'text-slate-500'}`}>{displayProgress}%</span>
                    </div>

                    {/* 대상 건수 */}
                    <div className="w-[80px] shrink-0 text-sm text-center">
                      <span className="text-slate-400">대상</span> <span className="font-semibold text-slate-700">{log.totalItems}</span>
                    </div>

                    {/* 성공/실패 카운트 */}
                    <div className="w-[80px] shrink-0 flex items-center justify-center gap-1 text-sm">
                      <span className="text-emerald-600 font-semibold">{log.successCount}</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-red-500 font-semibold">{log.failedCount}</span>
                    </div>

                    {/* 소요시간 */}
                    <div className="w-[100px] shrink-0 hidden md:flex items-center justify-center gap-1.5 text-sm text-slate-400">
                      <Timer size={14} />
                      <span>{formatDuration(log.startedAt, log.completedAt)}</span>
                    </div>

                    {/* 시작시간 */}
                    <div className="w-[200px] shrink-0 hidden lg:block text-sm text-slate-500 text-center">
                      <span className="text-slate-400">시작</span> {formatFullDate(log.startedAt).slice(5)}
                    </div>

                    {/* 종료시간 */}
                    <div className="w-[200px] shrink-0 hidden lg:block text-sm text-slate-500 text-center">
                      <span className="text-slate-400">종료</span> {log.completedAt ? formatFullDate(log.completedAt).slice(5) : '-'}
                    </div>

                    {/* 확장 버튼 */}
                    <div className={`w-[40px] shrink-0 flex items-center justify-center p-2 rounded-lg transition-colors ${
                      isExpanded ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}>
                      {isExpanded ? (
                        <ChevronUp size={18} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={18} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* 확장된 상세 정보 */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {/* 에러 메시지 */}
                    {log.errorMessage && (
                      <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start gap-2">
                          <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                          <p className="text-sm text-red-700">{formatErrorMessage(log.errorMessage)}</p>
                        </div>
                      </div>
                    )}

                    {/* 상세 로그 (타임라인) */}
                    <div className="p-4">
                      <TimelineLogSection
                        details={log.details || {}}
                        workflowType={log.workflowType}
                        steps={log.steps || []}
                        currentStep={log.currentStep}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="secondary"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="!p-2"
          >
            <ChevronLeft size={18} />
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === pageNum
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>

          <Button
            variant="secondary"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="!p-2"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      )}
      </div>
    </div>
  )
}
