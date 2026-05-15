'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Activity, AlertTriangle, CheckCircle2, RefreshCw, Square, Loader2,
  Cpu, Clock, History, ChevronDown, ChevronRight, Power, Trash2, XCircle,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

type WorkflowStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'SKIPPED'

interface WorkflowStep {
  stepType: string
  stepOrder: number
  status: WorkflowStatus
  startedAt: string | null
  completedAt: string | null
  totalItems: number | null
  processedItems: number | null
  successCount: number | null
  failedCount: number | null
  errorMessage: string | null
}

interface WorkflowLog {
  id: number
  workflowType: string
  triggerType: string
  status: WorkflowStatus
  currentStep: string | null
  startedAt: string
  completedAt: string | null
  totalItems: number
  successCount: number
  failedCount: number
  errorMessage: string | null
  steps: WorkflowStep[]
}

interface DiagnoseData {
  serverTime: string
  serverTz: string
  cronTimezone: string
  config: {
    id: number
    userId: number
    isEnabled: boolean
    cronExpression: string | null
    pipelineSteps: any
    lastRunAt: string | null
    nextRunAt: string | null
    updatedAt: string
  } | null
  scheduler: {
    isRegisteredInMemory: boolean
    activeUserIds: number[]
    nodeCronTasks: Array<{ id: string; name: string; status: string; nextRun: string | null }>
  }
  runningWorkflows: WorkflowLog[]
  recentRuns: WorkflowLog[]
  recentPublishes: { since: string; channelProducts: number; shopProducts: number }
  diagnosis: { ok: boolean; reasons: string[]; recommendation: string | null }
}

const STEP_LABELS: Record<string, string> = {
  collection: '수집',
  COLLECTION: '수집',
  transform: '변환',
  TRANSFORM: '변환',
  productCreate: '상품생성',
  PRODUCT_CREATE: '상품생성',
  publish: '발행',
  PUBLISH: '발행',
}

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  FULL_PIPELINE: '전체 파이프라인',
  COLLECTION: '수집',
  TRANSFORM: 'AI 변환',
  PRODUCT_CREATE: '상품 생성',
  PUBLISH: '발행',
}

const TRIGGER_LABELS: Record<string, string> = {
  CRON: '자동',
  MANUAL: '수동',
  AUTO: '자동',
}

const STATUS_BADGE: Record<WorkflowStatus, { label: string; cls: string }> = {
  PENDING: { label: '대기', cls: 'bg-gray-100 text-gray-700' },
  RUNNING: { label: '진행중', cls: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: '완료', cls: 'bg-green-100 text-green-700' },
  FAILED: { label: '실패', cls: 'bg-red-100 text-red-700' },
  CANCELLED: { label: '취소', cls: 'bg-amber-100 text-amber-700' },
  SKIPPED: { label: '스킵', cls: 'bg-gray-100 text-gray-500' },
}

function formatElapsed(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const sec = Math.max(0, Math.floor((end - start) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}시간 ${m}분`
  if (m > 0) return `${m}분 ${s}초`
  return `${s}초`
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function AutomationFlowControl() {
  const toast = useToast()
  const [data, setData] = useState<DiagnoseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showRecent, setShowRecent] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [confirmStopAll, setConfirmStopAll] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const inFlightRef = useRef(false)

  const fetchData = useCallback(async (silent = false) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/admin/automation/diagnose', { cache: 'no-store' })
      const json = await res.json()
      if (json?.success && json?.data) {
        setData(json.data as DiagnoseData)
        setError(null)
      } else {
        setError(json?.error || '진단 조회 실패')
      }
    } catch (e: any) {
      setError(e?.message || '진단 조회 실패')
    } finally {
      inFlightRef.current = false
      if (!silent) setLoading(false)
    }
  }, [])

  // 초기 로드 + 폴링
  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = (data?.runningWorkflows?.length ?? 0) > 0 ? 5000 : 15000
    const t = setInterval(() => fetchData(true), interval)
    return () => clearInterval(t)
  }, [autoRefresh, data?.runningWorkflows?.length, fetchData])

  const callJson = async (input: RequestInfo, init?: RequestInit) => {
    const res = await fetch(input, init)
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, json }
  }

  // 단일 워크플로우 취소
  const cancelOne = async (workflowId: number) => {
    setPendingAction(`cancel-${workflowId}`)
    try {
      const { ok, json } = await callJson(`/api/automation/execute?workflowId=${workflowId}`, {
        method: 'DELETE',
      })
      if (ok && json?.success) {
        toast.success(`워크플로우 #${workflowId} 취소 요청 전송`)
        await fetchData(true)
      } else {
        toast.error(json?.error || '취소 실패')
      }
    } catch (e: any) {
      toast.error(e?.message || '취소 실패')
    } finally {
      setPendingAction(null)
    }
  }

  // 전체 중지 (영구 비활성화 없음)
  const stopAll = async (disable: boolean) => {
    setPendingAction(disable ? 'stop-disable' : 'stop-all')
    try {
      const { ok, json } = await callJson('/api/admin/automation/stop-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disable }),
      })
      if (ok && json?.success) {
        const s = json.summary
        toast.success(
          `중지 완료 — 취소 ${s?.cancelledWorkflows ?? 0}건` +
          (s?.cronUnregistered ? ', cron 메모리 해제됨' : '') +
          (s?.configDisabled ? ', 영구 비활성화' : '')
        )
        setConfirmStopAll(false)
        setConfirmDisable(false)
        await fetchData(true)
      } else {
        toast.error(json?.error || '중지 실패')
      }
    } catch (e: any) {
      toast.error(e?.message || '중지 실패')
    } finally {
      setPendingAction(null)
    }
  }

  // cron 메모리 재등록
  const reregisterCron = async () => {
    setPendingAction('reregister')
    try {
      const { ok, json } = await callJson('/api/admin/automation/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reregister' }),
      })
      if (ok && json?.success) {
        toast.success(json.message || 'cron 재등록 요청 완료')
        await fetchData(true)
      } else {
        toast.error(json?.error || 'cron 재등록 실패')
      }
    } catch (e: any) {
      toast.error(e?.message || 'cron 재등록 실패')
    } finally {
      setPendingAction(null)
    }
  }

  // 30분+ stuck 워크플로우 일괄 정리
  const cleanupStuck = async () => {
    setPendingAction('cleanup')
    try {
      const { ok, json } = await callJson('/api/automation/execute?cleanup=true', {
        method: 'DELETE',
      })
      if (ok && json?.success) {
        toast.success(`stuck 워크플로우 ${json?.cleanedCount ?? 0}건 정리됨`)
        await fetchData(true)
      } else {
        toast.error(json?.error || '정리 실패')
      }
    } catch (e: any) {
      toast.error(e?.message || '정리 실패')
    } finally {
      setPendingAction(null)
    }
  }

  const running = data?.runningWorkflows ?? []
  const diagnosis = data?.diagnosis
  const scheduler = data?.scheduler
  const config = data?.config
  const recentPublishes = data?.recentPublishes

  const cronOk = !!(config?.isEnabled && config?.cronExpression && scheduler?.isRegisteredInMemory)
  const healthOk = diagnosis?.ok && running.length === 0

  return (
    <Card className="overflow-hidden mb-6">
      <div className="p-4 sm:p-5">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 flex-shrink-0">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">자동화 흐름 제어</h2>
                {running.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700 animate-pulse">
                    실행중 {running.length}건
                  </span>
                )}
                {data && (healthOk ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 정상
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> 점검 필요
                  </span>
                ))}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                현재 실행 중인 자동화 작업과 스케줄러 상태를 관리합니다
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              자동 새로고침
            </label>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchData()}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              새로고침
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 스케줄러 + 발행 통계 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatTile
            icon={<Power className={`w-4 h-4 ${config?.isEnabled ? 'text-green-600' : 'text-gray-400'}`} />}
            label="자동화"
            value={config?.isEnabled ? '활성' : '비활성'}
            valueCls={config?.isEnabled ? 'text-green-700' : 'text-gray-500'}
          />
          <StatTile
            icon={<Cpu className={`w-4 h-4 ${cronOk ? 'text-green-600' : 'text-amber-500'}`} />}
            label="메모리 cron"
            value={scheduler?.isRegisteredInMemory ? '등록됨' : '미등록'}
            valueCls={scheduler?.isRegisteredInMemory ? 'text-green-700' : 'text-amber-600'}
            sub={config?.cronExpression || undefined}
          />
          <StatTile
            icon={<Clock className="w-4 h-4 text-violet-500" />}
            label="마지막 실행"
            value={formatDateTime(config?.lastRunAt)}
          />
          <StatTile
            icon={<History className="w-4 h-4 text-indigo-500" />}
            label="최근 1시간 발행"
            value={`채널 ${recentPublishes?.channelProducts ?? 0} · 쇼핑몰 ${recentPublishes?.shopProducts ?? 0}`}
          />
        </div>

        {/* 진단 메시지 */}
        {diagnosis && diagnosis.reasons.length > 0 && !healthOk && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1 flex-1">
                {diagnosis.reasons.map((r, i) => (
                  <div key={i}>• {r}</div>
                ))}
                {diagnosis.recommendation && (
                  <div className="pt-1 mt-1 border-t border-amber-200 text-amber-800">
                    권고: {diagnosis.recommendation}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 실행 중 워크플로우 목록 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Loader2 className={`w-4 h-4 ${running.length > 0 ? 'text-blue-500 animate-spin' : 'text-gray-400'}`} />
            실행 중 워크플로우
            <span className="text-xs font-medium text-gray-500">({running.length}건)</span>
          </h3>
          {running.length === 0 ? (
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-500 text-center">
              현재 실행 중인 워크플로우가 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {running.map((wf) => (
                <RunningWorkflowRow
                  key={wf.id}
                  workflow={wf}
                  isCancelling={pendingAction === `cancel-${wf.id}`}
                  onCancel={() => cancelOne(wf.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          {!confirmStopAll ? (
            <button
              onClick={() => setConfirmStopAll(true)}
              disabled={running.length === 0 || !!pendingAction}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              전체 중지
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-red-50 border border-red-200">
              <span className="text-red-700">진행 중 {running.length}건을 모두 중지할까요?</span>
              <button
                onClick={() => stopAll(false)}
                disabled={pendingAction === 'stop-all'}
                className="ml-2 px-2 py-1 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
              >
                {pendingAction === 'stop-all' && <Loader2 className="w-3 h-3 animate-spin" />}
                예, 중지
              </button>
              <button
                onClick={() => setConfirmStopAll(false)}
                disabled={pendingAction === 'stop-all'}
                className="px-2 py-1 text-xs rounded text-red-700 hover:bg-red-100"
              >
                취소
              </button>
            </div>
          )}

          <button
            onClick={reregisterCron}
            disabled={!!pendingAction}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
          >
            {pendingAction === 'reregister' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            cron 재등록
          </button>

          <button
            onClick={cleanupStuck}
            disabled={!!pendingAction}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
            title="30분 이상 RUNNING 상태로 멈춰있는 워크플로우를 일괄 FAILED 처리"
          >
            {pendingAction === 'cleanup' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            stuck 정리
          </button>

          <div className="flex-1" />

          {!confirmDisable ? (
            <button
              onClick={() => setConfirmDisable(true)}
              disabled={!!pendingAction || config?.isEnabled === false}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              title="실행 중 중지 + 자동화 isEnabled=false (수동 재시작 전까지 cron 미실행)"
            >
              <Power className="w-3.5 h-3.5" />
              영구 비활성화
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gray-100 border border-gray-300">
              <span className="text-gray-700">전체 중지 + 자동화 OFF 까지 진행할까요?</span>
              <button
                onClick={() => stopAll(true)}
                disabled={pendingAction === 'stop-disable'}
                className="ml-2 px-2 py-1 text-xs font-bold rounded bg-gray-800 text-white hover:bg-black disabled:opacity-50 flex items-center gap-1"
              >
                {pendingAction === 'stop-disable' && <Loader2 className="w-3 h-3 animate-spin" />}
                예, 비활성화
              </button>
              <button
                onClick={() => setConfirmDisable(false)}
                disabled={pendingAction === 'stop-disable'}
                className="px-2 py-1 text-xs rounded text-gray-700 hover:bg-gray-200"
              >
                취소
              </button>
            </div>
          )}
        </div>

        {/* 최근 실행 이력 (접이식) */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={() => setShowRecent((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            {showRecent ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            최근 실행 이력 ({data?.recentRuns?.length ?? 0}건)
          </button>
          {showRecent && (data?.recentRuns?.length ?? 0) > 0 && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-500 text-left">
                  <tr>
                    <th className="py-1.5 pr-2 font-medium">ID</th>
                    <th className="py-1.5 pr-2 font-medium">유형</th>
                    <th className="py-1.5 pr-2 font-medium">트리거</th>
                    <th className="py-1.5 pr-2 font-medium">상태</th>
                    <th className="py-1.5 pr-2 font-medium">시작</th>
                    <th className="py-1.5 pr-2 font-medium">소요</th>
                    <th className="py-1.5 pr-2 font-medium">성공/실패</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {data!.recentRuns.map((r) => {
                    const badge = STATUS_BADGE[r.status] || STATUS_BADGE.PENDING
                    return (
                      <tr key={r.id} className="border-t border-gray-100">
                        <td className="py-1.5 pr-2">#{r.id}</td>
                        <td className="py-1.5 pr-2">{WORKFLOW_TYPE_LABELS[r.workflowType] || r.workflowType}</td>
                        <td className="py-1.5 pr-2">{TRIGGER_LABELS[r.triggerType] || r.triggerType}</td>
                        <td className="py-1.5 pr-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 whitespace-nowrap">{formatDateTime(r.startedAt)}</td>
                        <td className="py-1.5 pr-2 whitespace-nowrap">
                          {formatElapsed(r.startedAt, r.completedAt)}
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className="text-green-700">{r.successCount}</span>
                          {r.failedCount > 0 && (
                            <span className="text-red-600"> / {r.failedCount}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function StatTile({
  icon, label, value, valueCls, sub,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  valueCls?: string
  sub?: string
}) {
  return (
    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-sm font-bold ${valueCls || 'text-gray-900'} truncate`} title={typeof value === 'string' ? value : undefined}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5 truncate" title={sub}>{sub}</div>}
    </div>
  )
}

function RunningWorkflowRow({
  workflow, isCancelling, onCancel,
}: {
  workflow: WorkflowLog
  isCancelling: boolean
  onCancel: () => void
}) {
  const [elapsed, setElapsed] = useState(formatElapsed(workflow.startedAt))

  useEffect(() => {
    const t = setInterval(() => setElapsed(formatElapsed(workflow.startedAt)), 1000)
    return () => clearInterval(t)
  }, [workflow.startedAt])

  const typeLabel = WORKFLOW_TYPE_LABELS[workflow.workflowType] || workflow.workflowType
  const triggerLabel = TRIGGER_LABELS[workflow.triggerType] || workflow.triggerType

  // step 진행률 (총 단계 중 완료/진행)
  const totalSteps = workflow.steps.length || 1
  const runningStep = workflow.steps.find((s) => s.status === 'RUNNING')
  const totalProcessed = runningStep?.processedItems ?? 0
  const totalToProcess = runningStep?.totalItems ?? 0

  return (
    <div className="p-3 rounded-lg bg-white border border-blue-200 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-bold text-gray-900">{typeLabel}</span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">
              #{workflow.id}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700">
              {triggerLabel}
            </span>
            {workflow.currentStep && (
              <span className="text-xs text-blue-600 font-medium">
                → {STEP_LABELS[workflow.currentStep] || workflow.currentStep}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDateTime(workflow.startedAt)} · 경과 {elapsed}
            </span>
            <span>
              성공 <span className="text-green-700 font-medium">{workflow.successCount}</span>
              {workflow.failedCount > 0 && (
                <> · 실패 <span className="text-red-600 font-medium">{workflow.failedCount}</span></>
              )}
              {workflow.totalItems > 0 && (
                <> / 전체 {workflow.totalItems}</>
              )}
            </span>
            {runningStep && totalToProcess > 0 && (
              <span className="text-blue-600">
                현재 단계 {totalProcessed}/{totalToProcess}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onCancel}
          disabled={isCancelling}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
        >
          {isCancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
          취소
        </button>
      </div>

      {/* 단계 진행 미니 표시 */}
      <div className="flex items-center gap-1 flex-wrap">
        {workflow.steps.map((step) => {
          const badge = STATUS_BADGE[step.status] || STATUS_BADGE.PENDING
          const stepLabel = STEP_LABELS[step.stepType] || step.stepType
          return (
            <span
              key={`${step.stepOrder}-${step.stepType}`}
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${badge.cls}`}
              title={step.errorMessage || ''}
            >
              {stepLabel}: {badge.label}
              {step.status === 'RUNNING' && step.totalItems && step.totalItems > 0 ? (
                <> ({step.processedItems ?? 0}/{step.totalItems})</>
              ) : null}
            </span>
          )
        })}
      </div>

      {workflow.errorMessage && (
        <div className="mt-2 text-xs text-red-600 truncate" title={workflow.errorMessage}>
          ⚠ {workflow.errorMessage}
        </div>
      )}
    </div>
  )
}
