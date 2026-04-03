'use client'

import { useState } from 'react'
import {
  Bot,
  Package,
  ShoppingBag,
  Database,
  Server,
  TestTube,
  Settings,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface AgentTeam {
  id: string
  name: string
  icon: React.ReactNode
  scope: string
  description: string
  tools: string[]
  status: 'active' | 'idle' | 'paused' | 'error'
  tasks: AgentTask[]
  config: {
    autoRun: boolean
    schedule?: string
    maxConcurrent: number
  }
}

interface AgentTask {
  id: string
  title: string
  status: 'running' | 'completed' | 'failed' | 'queued'
  startedAt?: string
  completedAt?: string
  progress?: number
}

const defaultTeams: AgentTeam[] = [
  {
    id: 'sourcing',
    name: '소싱 에이전트',
    icon: <Package size={24} />,
    scope: 'sourcing-app 전체',
    description: '수집/AI변환/발행 파이프라인, 자동화 설정 담당',
    tools: ['Claude Code', 'Playwright', 'Gemini API'],
    status: 'active',
    tasks: [
      { id: 's1', title: '도매밴드 상품 수집 (10개)', status: 'completed', completedAt: '5분 전' },
      { id: 's2', title: 'AI 상품 변환 처리', status: 'running', progress: 65 },
      { id: 's3', title: '소매밴드 발행 예정', status: 'queued' },
    ],
    config: { autoRun: true, schedule: '0 9,14,19 * * *', maxConcurrent: 3 },
  },
  {
    id: 'shop',
    name: '쇼핑몰 에이전트',
    icon: <ShoppingBag size={24} />,
    scope: 'shop-app 전체',
    description: '상품 페이지, 장바구니, 결제, 주문 관리 담당',
    tools: ['Claude Code', 'Toss SDK'],
    status: 'active',
    tasks: [
      { id: 'sh1', title: '신규 주문 처리 (3건)', status: 'running', progress: 30 },
      { id: 'sh2', title: '결제 웹훅 처리', status: 'completed', completedAt: '12분 전' },
    ],
    config: { autoRun: true, maxConcurrent: 5 },
  },
  {
    id: 'db',
    name: 'DB 에이전트',
    icon: <Database size={24} />,
    scope: 'db 패키지 + 스키마',
    description: '모델 설계, 마이그레이션, 성능 최적화 담당',
    tools: ['Prisma CLI', 'MariaDB'],
    status: 'idle',
    tasks: [
      { id: 'd1', title: '인덱스 최적화 완료', status: 'completed', completedAt: '2시간 전' },
    ],
    config: { autoRun: false, maxConcurrent: 1 },
  },
  {
    id: 'devops',
    name: 'DevOps 에이전트',
    icon: <Server size={24} />,
    scope: 'CI/CD + Docker + 모니터링',
    description: '배포, 컨테이너 관리, 로그 분석 담당',
    tools: ['Docker', 'GitHub Actions', 'SSH'],
    status: 'active',
    tasks: [
      { id: 'do1', title: '헬스체크 모니터링', status: 'running', progress: 100 },
      { id: 'do2', title: '로그 분석 (일간)', status: 'completed', completedAt: '30분 전' },
    ],
    config: { autoRun: true, schedule: '*/5 * * * *', maxConcurrent: 2 },
  },
  {
    id: 'qa',
    name: 'QA 에이전트',
    icon: <TestTube size={24} />,
    scope: '테스트 + 품질 보증',
    description: 'E2E 테스트, 타입체크, 린트 담당',
    tools: ['Playwright', 'TypeScript', 'ESLint'],
    status: 'idle',
    tasks: [
      { id: 'q1', title: '타입체크 통과', status: 'completed', completedAt: '1시간 전' },
    ],
    config: { autoRun: false, maxConcurrent: 1 },
  },
]

export default function AgentTeamsPage() {
  const [teams, setTeams] = useState<AgentTeam[]>(defaultTeams)
  const [expandedTeam, setExpandedTeam] = useState<string | null>('sourcing')

  const toggleTeamStatus = (teamId: string) => {
    setTeams(prev => prev.map(team => {
      if (team.id !== teamId) return team
      const newStatus = team.status === 'active' ? 'paused' : 'active'
      return { ...team, status: newStatus }
    }))
  }

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    active: { label: '활성', bg: 'bg-green-100', text: 'text-green-700' },
    idle: { label: '대기', bg: 'bg-gray-100', text: 'text-gray-700' },
    paused: { label: '일시정지', bg: 'bg-yellow-100', text: 'text-yellow-700' },
    error: { label: '오류', bg: 'bg-red-100', text: 'text-red-700' },
  }

  const taskStatusConfig: Record<string, { icon: React.ReactNode; text: string }> = {
    running: { icon: <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />, text: 'text-blue-700' },
    completed: { icon: <CheckCircle size={14} className="text-green-500" />, text: 'text-green-700' },
    failed: { icon: <AlertCircle size={14} className="text-red-500" />, text: 'text-red-700' },
    queued: { icon: <Clock size={14} className="text-gray-400" />, text: 'text-gray-500' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Bot className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">에이전트팀 구성</h1>
              <p className="text-gray-600">AI 에이전트팀의 구성과 역할을 관리합니다</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {teams.filter(t => t.status === 'active').length}/{teams.length} 활성
            </span>
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="space-y-4">
        {teams.map((team) => {
          const isExpanded = expandedTeam === team.id
          const sc = statusConfig[team.status]

          return (
            <div key={team.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Team Header */}
              <div
                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gray-100 rounded-xl text-gray-600">
                      {team.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${sc.bg} ${sc.text}`}>
                          {sc.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{team.scope}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* 실행 중 작업 수 */}
                    {team.tasks.filter(t => t.status === 'running').length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        {team.tasks.filter(t => t.status === 'running').length}개 실행중
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTeamStatus(team.id) }}
                      className={`p-2 rounded-lg transition-colors ${
                        team.status === 'active'
                          ? 'text-yellow-600 hover:bg-yellow-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={team.status === 'active' ? '일시정지' : '활성화'}
                    >
                      {team.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  <p className="text-sm text-gray-600">{team.description}</p>

                  {/* Tools */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">사용 도구</h4>
                    <div className="flex flex-wrap gap-2">
                      {team.tools.map(tool => (
                        <span key={tool} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Config */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">설정</h4>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>자동 실행: {team.config.autoRun ? '켜짐' : '꺼짐'}</span>
                      {team.config.schedule && <span>스케줄: {team.config.schedule}</span>}
                      <span>최대 동시 실행: {team.config.maxConcurrent}</span>
                    </div>
                  </div>

                  {/* Tasks */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">작업 목록</h4>
                    <div className="space-y-2">
                      {team.tasks.map(task => {
                        const tc = taskStatusConfig[task.status]
                        return (
                          <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              {tc.icon}
                              <span className={`text-sm ${tc.text}`}>{task.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {task.progress !== undefined && task.status === 'running' && (
                                <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{ width: `${task.progress}%` }}
                                  />
                                </div>
                              )}
                              {task.completedAt && (
                                <span className="text-xs text-gray-400">{task.completedAt}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
