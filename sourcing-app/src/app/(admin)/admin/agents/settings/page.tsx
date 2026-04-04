'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  Save,
  Loader2,
  RefreshCw,
  Bot,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface AgentConfig {
  id: string
  name: string
  displayName: string
  layer: string
  status: string
  priority: number
  maxConcurrent: number
  schedule: string | null
  retryPolicy: { maxRetries: number; backoff: string }
}

export default function AgentSettingsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agents')
      if (res.ok) {
        const data = await res.json()
        setAgents(data.agents || [])
      }
    } catch {
      // 샘플 데이터
      setAgents([
        { id: '1', name: 'orchestrator', displayName: 'Orchestrator Agent', layer: 'CORE', status: 'INACTIVE', priority: 1, maxConcurrent: 30, schedule: '*/1 * * * *', retryPolicy: { maxRetries: 5, backoff: 'exponential' } },
        { id: '2', name: 'content', displayName: 'Content Agent', layer: 'CORE', status: 'INACTIVE', priority: 2, maxConcurrent: 5, schedule: null, retryPolicy: { maxRetries: 3, backoff: 'exponential' } },
        { id: '3', name: 'analytics', displayName: 'Analytics Agent', layer: 'CORE', status: 'INACTIVE', priority: 2, maxConcurrent: 10, schedule: '*/5 * * * *', retryPolicy: { maxRetries: 3, backoff: 'linear' } },
      ])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  const handleSave = async (agent: AgentConfig) => {
    setSaving(agent.id)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: agent.priority,
          maxConcurrent: agent.maxConcurrent,
          schedule: agent.schedule,
          retryPolicy: agent.retryPolicy,
        }),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: `${agent.displayName} 설정이 저장되었습니다` })
      } else {
        setMessage({ type: 'error', text: '저장에 실패했습니다' })
      }
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류' })
    } finally {
      setSaving(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const updateAgent = (id: string, field: string, value: unknown) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  const layerColor: Record<string, string> = {
    CORE: 'bg-blue-100 text-blue-700',
    BUSINESS: 'bg-green-100 text-green-700',
    INTELLIGENCE: 'bg-purple-100 text-purple-700',
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg"><Settings className="w-6 h-6 text-gray-600" /></div>
          <h1 className="text-2xl font-bold text-gray-900">에이전트 설정</h1>
        </div>
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg"><Settings className="w-6 h-6 text-gray-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">에이전트 설정</h1>
            <p className="text-sm text-gray-500">각 에이전트의 실행 정책을 관리합니다</p>
          </div>
        </div>
        <button onClick={fetchAgents} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Agent Settings Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">에이전트</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">우선순위</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">동시 실행</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">스케줄</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">재시도</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {agents.map(agent => (
              <tr key={agent.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{agent.displayName}</p>
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full ${layerColor[agent.layer] || 'bg-gray-100 text-gray-600'}`}>
                        {agent.layer}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="number"
                    min={1} max={10}
                    value={agent.priority}
                    onChange={e => updateAgent(agent.id, 'priority', Number(e.target.value))}
                    className="w-16 text-center border border-gray-200 rounded-md px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="number"
                    min={1} max={100}
                    value={agent.maxConcurrent}
                    onChange={e => updateAgent(agent.id, 'maxConcurrent', Number(e.target.value))}
                    className="w-16 text-center border border-gray-200 rounded-md px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="text"
                    value={agent.schedule || ''}
                    onChange={e => updateAgent(agent.id, 'schedule', e.target.value || null)}
                    placeholder="없음"
                    className="w-28 text-center border border-gray-200 rounded-md px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-600">
                    {agent.retryPolicy.maxRetries}회 / {agent.retryPolicy.backoff}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleSave(agent)}
                    disabled={saving === agent.id}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {saving === agent.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {agents.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            등록된 에이전트가 없습니다
          </div>
        )}
      </div>
    </div>
  )
}
