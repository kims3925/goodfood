'use client'

import { useState, useEffect } from 'react'
import {
  Workflow,
  Bot,
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  Filter,
} from 'lucide-react'

interface AgentTask {
  id: number
  agentName: string
  title: string
  description: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  startedAt?: string
  completedAt?: string
  progress?: number
}

const sampleTasks: AgentTask[] = [
  {
    id: 1, agentName: '소싱 에이전트', title: '도매밴드 수집 (채널 3개)',
    description: '장터, 해양수산, 농산물 채널에서 신규 게시물 수집',
    status: 'running', priority: 'high', createdAt: '10분 전', startedAt: '8분 전', progress: 45,
  },
  {
    id: 2, agentName: '소싱 에이전트', title: 'AI 상품 변환 (15건)',
    description: 'Gemini AI로 수집 상품 제목/설명/가격 자동 가공',
    status: 'queued', priority: 'medium', createdAt: '5분 전',
  },
  {
    id: 3, agentName: '쇼핑몰 에이전트', title: '주문 상태 업데이트',
    description: '결제 완료 주문 3건 배송준비중으로 변경',
    status: 'completed', priority: 'medium', createdAt: '30분 전', completedAt: '25분 전',
  },
  {
    id: 4, agentName: 'DevOps 에이전트', title: '헬스체크 모니터링',
    description: '전체 서비스 상태 확인 및 알림',
    status: 'running', priority: 'low', createdAt: '1시간 전', startedAt: '1시간 전', progress: 100,
  },
  {
    id: 5, agentName: 'QA 에이전트', title: '타입체크 실행',
    description: 'npm run typecheck 전체 실행',
    status: 'completed', priority: 'low', createdAt: '2시간 전', completedAt: '2시간 전',
  },
  {
    id: 6, agentName: 'DB 에이전트', title: '인덱스 성능 분석',
    description: '정산/주문 쿼리 인덱스 사용률 분석',
    status: 'completed', priority: 'medium', createdAt: '3시간 전', completedAt: '2시간 전',
  },
]

export default function AgentTasksPage() {
  const [tasks] = useState<AgentTask[]>(sampleTasks)
  const [filter, setFilter] = useState<string>('all')

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; bg: string }> = {
    running: { icon: <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />, label: '실행중', bg: 'bg-blue-50 text-blue-700' },
    queued: { icon: <Clock size={14} className="text-gray-400" />, label: '대기', bg: 'bg-gray-100 text-gray-700' },
    completed: { icon: <CheckCircle size={14} className="text-green-500" />, label: '완료', bg: 'bg-green-50 text-green-700' },
    failed: { icon: <AlertCircle size={14} className="text-red-500" />, label: '실패', bg: 'bg-red-50 text-red-700' },
  }

  const priorityConfig: Record<string, string> = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-gray-300',
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Workflow className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">작업 현황</h1>
              <p className="text-gray-600">에이전트팀의 실시간 작업 진행 상태</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {(['running', 'queued', 'completed', 'failed'] as const).map(status => {
          const count = tasks.filter(t => t.status === status).length
          const sc = statusConfig[status]
          return (
            <button
              key={status}
              onClick={() => setFilter(filter === status ? 'all' : status)}
              className={`p-4 rounded-lg border transition-colors ${
                filter === status ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {sc.icon}
                <span className="text-sm text-gray-600">{sc.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
            </button>
          )
        })}
      </div>

      {/* Task List */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">작업 목록</h2>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-xs text-blue-600 hover:underline">
              전체 보기
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {filteredTasks.map(task => {
            const sc = statusConfig[task.status]
            return (
              <div key={task.id} className={`p-4 border-l-4 ${priorityConfig[task.priority]} hover:bg-gray-50`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${sc.bg}`}>
                        {sc.label}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {task.agentName}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900">{task.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-xs text-gray-400">{task.createdAt}</p>
                    {task.progress !== undefined && task.status === 'running' && (
                      <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
