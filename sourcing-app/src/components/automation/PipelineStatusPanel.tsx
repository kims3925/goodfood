'use client'

import { useState, useEffect } from 'react'
import { Download, Sparkles, ShoppingBag, Upload, X, Check, Loader2, AlertCircle, Clock } from 'lucide-react'

// WorkflowStepLog 기반 단계 진행 정보
interface StageProgress {
  // WorkflowStepLog 기반 필드
  status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
  completed: boolean
  startedAt?: string | null
  completedAt?: string | null
  duration?: number | null
  totalItems?: number
  processedItems?: number
  successCount?: number
  failedCount?: number
  progress?: number  // 0-100 퍼센트
  errorMessage?: string | null
  // 기존 호환 필드
  total?: number
  success?: number
  failed?: number
  totalNewPosts?: number
  channelResults?: Array<{ channelId: number; channelName: string; newPosts: number }>
  batchProgress?: { current: number; total: number }
  currentChannel?: string
  currentProgress?: { current: number; total: number }
}

interface PipelineWorkflow {
  id: number
  type: string
  status: string
  startedAt: string
  totalItems: number
  successCount: number
  failedCount: number
  currentStage: 'collection' | 'transform' | 'productCreate' | 'publish' | null
  stageProgress: {
    collection?: StageProgress
    transform?: StageProgress
    productCreate?: StageProgress
    publish?: StageProgress
  }
}

interface PipelineStatusPanelProps {
  workflow: PipelineWorkflow
  onCancel: (workflowId: number) => void
  isCancelling?: boolean
}

const STAGES = [
  { key: 'collection', label: '수집', icon: Download },
  { key: 'transform', label: '변환', icon: Sparkles },
  { key: 'productCreate', label: '상품생성', icon: ShoppingBag },
  { key: 'publish', label: '발행', icon: Upload },
] as const

type StageKey = typeof STAGES[number]['key']

export default function PipelineStatusPanel({ workflow, onCancel, isCancelling }: PipelineStatusPanelProps) {
  const [elapsedTime, setElapsedTime] = useState('')

  // 경과 시간 계산
  useEffect(() => {
    const updateElapsed = () => {
      const start = new Date(workflow.startedAt).getTime()
      const now = Date.now()
      const diff = Math.floor((now - start) / 1000)

      const hours = Math.floor(diff / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      const seconds = diff % 60

      if (hours > 0) {
        setElapsedTime(`${hours}시간 ${minutes}분 ${seconds}초`)
      } else if (minutes > 0) {
        setElapsedTime(`${minutes}분 ${seconds}초`)
      } else {
        setElapsedTime(`${seconds}초`)
      }
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [workflow.startedAt])

  // 단계 상태 결정 (WorkflowStepLog의 status 활용)
  const getStageStatus = (stageKey: StageKey): 'pending' | 'running' | 'completed' | 'failed' | 'skipped' => {
    const stageProgress = workflow.stageProgress[stageKey]

    // WorkflowStepLog의 status 필드가 있으면 우선 사용
    if (stageProgress?.status) {
      const statusMap: Record<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'> = {
        'PENDING': 'pending',
        'RUNNING': 'running',
        'COMPLETED': 'completed',
        'FAILED': 'failed',
        'SKIPPED': 'skipped',
      }
      return statusMap[stageProgress.status] || 'pending'
    }

    // 기존 로직 (하위 호환)
    if (stageProgress?.completed) {
      // 실패 건수가 있으면서 성공이 0이면 실패
      const failed = stageProgress.failedCount ?? stageProgress.failed ?? 0
      const success = stageProgress.successCount ?? stageProgress.success ?? 0
      if (failed > 0 && success === 0) {
        return 'failed'
      }
      return 'completed'
    }

    if (workflow.currentStage === stageKey) {
      return 'running'
    }

    // 현재 단계 이전인지 확인
    const currentIndex = STAGES.findIndex(s => s.key === workflow.currentStage)
    const thisIndex = STAGES.findIndex(s => s.key === stageKey)

    if (thisIndex < currentIndex) {
      return 'completed'
    }

    return 'pending'
  }

  // 단계 진행 텍스트 (WorkflowStepLog 정보 활용)
  const getStageProgressText = (stageKey: StageKey): string => {
    const progress = workflow.stageProgress[stageKey]
    if (!progress) return ''

    const status = getStageStatus(stageKey)

    // 수집 단계는 totalNewPosts 표시
    if (stageKey === 'collection') {
      if (progress.totalNewPosts !== undefined) {
        return `${progress.totalNewPosts}건`
      }
      // WorkflowStepLog 기반 정보
      if (status === 'completed' || status === 'running') {
        const success = progress.successCount ?? progress.success ?? 0
        return success > 0 ? `${success}건` : ''
      }
      return ''
    }

    // WorkflowStepLog의 processedItems/totalItems 활용 (실시간 진행률)
    if (progress.totalItems && progress.totalItems > 0) {
      const processed = progress.processedItems ?? 0
      const success = progress.successCount ?? progress.success ?? 0
      const failed = progress.failedCount ?? progress.failed ?? 0

      if (status === 'running') {
        // 진행 중: processedItems/totalItems 표시
        return `${processed}/${progress.totalItems}건`
      } else if (status === 'completed' || status === 'failed') {
        // 완료: 성공/실패 건수 표시
        if (failed > 0) {
          return `${success}건 (실패 ${failed})`
        }
        return `${success}건`
      }
    }

    // 기존 로직 (하위 호환)
    if (progress.total && progress.total > 0) {
      const current = (progress.success || 0) + (progress.failed || 0)
      return `${current}/${progress.total}건`
    }

    if (progress.batchProgress) {
      return `${progress.batchProgress.current}/${progress.batchProgress.total}건`
    }

    return ''
  }

  // 전체 진행률 계산 (WorkflowStepLog의 progress 활용)
  const calculateOverallProgress = (): number => {
    let totalProgress = 0

    for (const stage of STAGES) {
      const status = getStageStatus(stage.key)
      const stageData = workflow.stageProgress[stage.key]

      if (status === 'completed' || status === 'skipped') {
        totalProgress += 100
      } else if (status === 'running' && stageData) {
        // WorkflowStepLog의 progress 필드 우선 사용
        if (stageData.progress !== undefined && stageData.progress > 0) {
          totalProgress += stageData.progress
        } else if (stageData.totalItems && stageData.totalItems > 0) {
          // processedItems/totalItems 기반 계산
          const processed = stageData.processedItems ?? 0
          totalProgress += Math.round((processed / stageData.totalItems) * 100)
        } else if (stageData.total && stageData.total > 0) {
          // 기존 로직 (하위 호환)
          const processed = (stageData.success ?? 0) + (stageData.failed ?? 0)
          totalProgress += Math.round((processed / stageData.total) * 100)
        } else if (stageData.batchProgress?.total) {
          totalProgress += Math.round((stageData.batchProgress.current / stageData.batchProgress.total) * 100)
        }
      }
      // pending, failed 상태는 0 기여
    }

    return Math.round(totalProgress / STAGES.length)
  }

  const startTime = new Date(workflow.startedAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const overallProgress = calculateOverallProgress()

  return (
    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg mb-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h3 className="font-bold text-lg">파이프라인 실행 중</h3>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                시작: {startTime}
              </span>
              <span>|</span>
              <span>경과: {elapsedTime}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onCancel(workflow.id)}
          disabled={isCancelling}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {isCancelling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              취소 중...
            </>
          ) : (
            <>
              <X className="w-4 h-4" />
              취소
            </>
          )}
        </button>
      </div>

      {/* 단계 진행 표시 */}
      <div className="bg-white/10 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          {STAGES.map((stage, index) => {
            const status = getStageStatus(stage.key)
            const progressText = getStageProgressText(stage.key)
            const Icon = stage.icon

            return (
              <div key={stage.key} className="flex items-center">
                {/* 단계 */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      status === 'completed'
                        ? 'bg-green-400 text-white'
                        : status === 'running'
                          ? 'bg-white text-blue-600 animate-pulse'
                          : status === 'failed'
                            ? 'bg-red-400 text-white'
                            : status === 'skipped'
                              ? 'bg-gray-400 text-white'
                              : 'bg-white/20 text-white/60'
                    }`}
                  >
                    {status === 'completed' ? (
                      <Check className="w-5 h-5" />
                    ) : status === 'running' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : status === 'failed' ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : status === 'skipped' ? (
                      <Check className="w-5 h-5 opacity-70" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={`text-xs mt-1.5 font-medium ${status === 'pending' ? 'text-white/60' : ''}`}>
                    {stage.label}
                  </span>
                  {progressText && (
                    <span className="text-xs text-white/70">{progressText}</span>
                  )}
                </div>

                {/* 연결선 */}
                {index < STAGES.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 ${
                      getStageStatus(STAGES[index + 1].key) !== 'pending' || status === 'completed' || status === 'skipped'
                        ? status === 'skipped' ? 'bg-gray-400' : 'bg-green-400'
                        : 'bg-white/20'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>전체 진행률</span>
          <span className="font-bold">{overallProgress}%</span>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>성공: {workflow.successCount}건</span>
          {workflow.failedCount > 0 && (
            <span className="text-red-300">실패: {workflow.failedCount}건</span>
          )}
        </div>
      </div>
    </div>
  )
}
