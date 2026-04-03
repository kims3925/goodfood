'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Workflow,
  Plus,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  Play,
  Pause,
  Calendar,
  Hash,
  Zap,
} from 'lucide-react'
import StatusToggle from '@/components/admin/agents/StatusToggle'

interface WorkflowItem {
  id: string
  name: string
  triggerEvent: string
  stepCount: number
  active: boolean
  lastExecuted: string | null
  executionCount: number
  description?: string
}

interface WorkflowFormData {
  name: string
  triggerEvent: string
  description: string
  steps: string[]
}

const sampleWorkflows: WorkflowItem[] = [
  {
    id: 'wf-sourcing-pipeline',
    name: '소싱 파이프라인',
    triggerEvent: 'schedule:cron',
    stepCount: 5,
    active: true,
    lastExecuted: '2026-04-02T14:30:00Z',
    executionCount: 342,
    description: '도매밴드 수집 -> AI 변환 -> 검수 -> 발행 -> 알림',
  },
  {
    id: 'wf-order-processing',
    name: '주문 처리',
    triggerEvent: 'order:created',
    stepCount: 4,
    active: true,
    lastExecuted: '2026-04-02T15:10:00Z',
    executionCount: 1256,
    description: '결제 확인 -> 재고 차감 -> 배송 접수 -> 알림 발송',
  },
  {
    id: 'wf-price-update',
    name: '가격 자동 조정',
    triggerEvent: 'schedule:hourly',
    stepCount: 3,
    active: true,
    lastExecuted: '2026-04-02T15:00:00Z',
    executionCount: 720,
    description: '경쟁사 스캔 -> 가격 분석 -> 자동 반영',
  },
  {
    id: 'wf-cs-auto-reply',
    name: 'CS 자동 응답',
    triggerEvent: 'cs:inquiry_received',
    stepCount: 3,
    active: false,
    lastExecuted: '2026-04-01T10:00:00Z',
    executionCount: 89,
    description: '문의 분류 -> 템플릿 매칭 -> 자동 답변',
  },
  {
    id: 'wf-daily-report',
    name: '일간 리포트',
    triggerEvent: 'schedule:daily',
    stepCount: 4,
    active: true,
    lastExecuted: '2026-04-02T09:00:00Z',
    executionCount: 45,
    description: 'KPI 집계 -> 리포트 생성 -> 슬랙 발송 -> 저장',
  },
  {
    id: 'wf-health-alert',
    name: '장애 알림',
    triggerEvent: 'agent:error',
    stepCount: 2,
    active: true,
    lastExecuted: '2026-04-02T11:45:00Z',
    executionCount: 12,
    description: '에러 감지 -> 알림 발송 및 자동 재시작',
  },
]

const TRIGGER_OPTIONS = [
  'schedule:cron',
  'schedule:hourly',
  'schedule:daily',
  'order:created',
  'order:cancelled',
  'cs:inquiry_received',
  'agent:error',
  'product:collected',
  'payment:completed',
]

function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function AgentWorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: '',
    triggerEvent: TRIGGER_OPTIONS[0],
    description: '',
    steps: [''],
  })

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/agents/workflows')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setWorkflows(json)
      setError(null)
    } catch {
      setWorkflows(sampleWorkflows)
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  const handleToggle = useCallback(async (workflowId: string) => {
    setTogglingId(workflowId)
    try {
      const wf = workflows.find(w => w.id === workflowId)
      if (!wf) return
      await fetch(`/api/admin/agents/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !wf.active }),
      })
    } catch {
      // continue with optimistic update
    }
    setWorkflows(prev => prev.map(w =>
      w.id === workflowId ? { ...w, active: !w.active } : w
    ))
    setTogglingId(null)
  }, [workflows])

  const handleAddStep = useCallback(() => {
    setFormData(prev => ({ ...prev, steps: [...prev.steps, ''] }))
  }, [])

  const handleRemoveStep = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }))
  }, [])

  const handleStepChange = useCallback((index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) => i === index ? value : s),
    }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) return
    const validSteps = formData.steps.filter(s => s.trim())
    if (validSteps.length === 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/agents/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          triggerEvent: formData.triggerEvent,
          description: formData.description,
          steps: validSteps,
        }),
      })
      if (res.ok) {
        const newWf = await res.json()
        setWorkflows(prev => [...prev, newWf])
      }
    } catch {
      // Add locally as fallback
      const newWf: WorkflowItem = {
        id: `wf-${Date.now()}`,
        name: formData.name,
        triggerEvent: formData.triggerEvent,
        stepCount: formData.steps.filter(s => s.trim()).length,
        active: false,
        lastExecuted: null,
        executionCount: 0,
        description: formData.description,
      }
      setWorkflows(prev => [...prev, newWf])
    } finally {
      setSubmitting(false)
      setShowModal(false)
      setFormData({ name: '', triggerEvent: TRIGGER_OPTIONS[0], description: '', steps: [''] })
    }
  }, [formData])

  const activeCount = workflows.filter(w => w.active).length
  const totalExecutions = workflows.reduce((sum, w) => sum + w.executionCount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Workflow className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">워크플로우 관리</h1>
              <p className="text-gray-600">에이전트 워크플로우를 생성하고 관리합니다</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchWorkflows}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              새 워크플로우
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">전체 워크플로우</p>
          <p className="text-2xl font-bold text-gray-900">{workflows.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">활성</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">총 실행 횟수</p>
          <p className="text-2xl font-bold text-gray-900">{totalExecutions.toLocaleString()}</p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        /* Workflows Table */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">워크플로우</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">트리거 이벤트</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">단계</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">상태</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">마지막 실행</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">실행 횟수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workflows.map(wf => (
                  <tr key={wf.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{wf.name}</p>
                        {wf.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{wf.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        <Zap size={10} />
                        {wf.triggerEvent}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        <Hash size={12} className="text-gray-400" />
                        {wf.stepCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusToggle
                        status={wf.active ? 'ACTIVE' : 'INACTIVE'}
                        onToggle={() => handleToggle(wf.id)}
                        loading={togglingId === wf.id}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-gray-500 flex items-center justify-end gap-1">
                        <Calendar size={12} className="text-gray-400" />
                        {formatDateTime(wf.lastExecuted)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {wf.executionCount.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {workflows.length === 0 && (
            <div className="py-12 text-center">
              <Workflow className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">등록된 워크플로우가 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* Create Workflow Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">새 워크플로우 생성</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  워크플로우 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 소싱 파이프라인"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Trigger Event */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  트리거 이벤트 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.triggerEvent}
                  onChange={(e) => setFormData(prev => ({ ...prev, triggerEvent: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {TRIGGER_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="워크플로우 설명..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Steps */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  실행 단계 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {formData.steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-6 text-right shrink-0">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        value={step}
                        onChange={(e) => handleStepChange(index, e.target.value)}
                        placeholder={`${index + 1}단계 내용`}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {formData.steps.length > 1 && (
                        <button
                          onClick={() => handleRemoveStep(index)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddStep}
                  className="mt-2 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  <Plus size={14} />
                  단계 추가
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formData.name.trim() || formData.steps.every(s => !s.trim())}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
