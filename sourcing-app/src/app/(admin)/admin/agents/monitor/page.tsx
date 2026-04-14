'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Radio,
  AlertCircle,
  Info,
  CheckCircle,
  WifiOff,
  Activity,
  Filter,
  Loader2,
} from 'lucide-react'

interface AgentEvent {
  id: string
  timestamp: string
  agentName: string
  eventType: 'success' | 'error' | 'info'
  message: string
}

const EVENT_STYLES: Record<AgentEvent['eventType'], {
  icon: React.ElementType
  color: string
  bg: string
  label: string
}> = {
  success: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: '성공' },
  error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: '오류' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', label: '정보' },
}

const MAX_EVENTS = 500

const SAMPLE_AGENTS = [
  '오케스트레이터',
  '스케줄러',
  '헬스 모니터',
  '소싱 에이전트',
  '주문 에이전트',
  'CS 에이전트',
  '가격 최적화',
  '수요 예측',
  '콘텐츠 생성',
]

export default function AgentMonitorPage() {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(['success', 'error', 'info'])
  )
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [allAgentNames, setAllAgentNames] = useState<string[]>(SAMPLE_AGENTS)
  const [paused, setPaused] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  const addEvent = useCallback((event: AgentEvent) => {
    setEvents(prev => {
      const next = [event, ...prev]
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next
    })
    setAllAgentNames(prev => {
      if (prev.includes(event.agentName)) return prev
      return [...prev, event.agentName]
    })
  }, [])

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      const es = new EventSource('/api/admin/agents/events/stream')
      eventSourceRef.current = es

      es.onopen = () => setConnected(true)

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as AgentEvent
          addEvent(data)
        } catch {
          // skip malformed
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        eventSourceRef.current = null
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [addEvent])

  // Generate sample events for demo when SSE is not available
  useEffect(() => {
    if (connected) return

    const messages = [
      { type: 'info' as const, msg: '스케줄 작업 시작' },
      { type: 'success' as const, msg: '상품 수집 완료 (12건)' },
      { type: 'info' as const, msg: '주문 상태 갱신 처리중' },
      { type: 'error' as const, msg: 'API 호출 타임아웃 발생' },
      { type: 'success' as const, msg: '가격 최적화 배치 완료' },
      { type: 'info' as const, msg: '헬스체크 정상 확인' },
      { type: 'success' as const, msg: 'AI 상품 설명 생성 완료 (5건)' },
      { type: 'error' as const, msg: '정산 데이터 조회 실패' },
      { type: 'info' as const, msg: '수요 예측 모델 업데이트' },
      { type: 'success' as const, msg: '주문 3건 배송 처리 완료' },
    ]

    const timer = setInterval(() => {
      if (paused) return
      const sample = messages[Math.floor(Math.random() * messages.length)]
      const agent = SAMPLE_AGENTS[Math.floor(Math.random() * SAMPLE_AGENTS.length)]
      addEvent({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        agentName: agent,
        eventType: sample.type,
        message: sample.msg,
      })
    }, 2000)

    return () => clearInterval(timer)
  }, [connected, paused, addEvent])

  const toggleType = useCallback((type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const toggleAgent = useCallback((agent: string) => {
    setSelectedAgents(prev => {
      const next = new Set(prev)
      if (next.has(agent)) next.delete(agent)
      else next.add(agent)
      return next
    })
  }, [])

  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      if (!selectedTypes.has(evt.eventType)) return false
      if (selectedAgents.size > 0 && !selectedAgents.has(evt.agentName)) return false
      return true
    })
  }, [events, selectedTypes, selectedAgents])

  const eventCounts = useMemo(() => {
    const counts = { success: 0, error: 0, info: 0, total: events.length }
    events.forEach(e => { counts[e.eventType]++ })
    return counts
  }, [events])

  const formatTime = (timestamp: string) => {
    try {
      const d = new Date(timestamp)
      return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return timestamp
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Activity className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">실시간 모니터</h1>
              <p className="text-gray-600">에이전트 이벤트를 실시간으로 모니터링합니다</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPaused(p => !p)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                paused
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {paused ? '일시정지됨' : '실시간'}
            </button>
            <div className="flex items-center gap-1.5">
              {connected ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-600">SSE 연결됨</span>
                </>
              ) : (
                <>
                  <WifiOff size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-400">데모 모드</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event Count Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { key: 'total', label: '전체', count: eventCounts.total, bg: 'bg-gray-50', text: 'text-gray-700' },
          { key: 'success', label: '성공', count: eventCounts.success, bg: 'bg-green-50', text: 'text-green-700' },
          { key: 'error', label: '오류', count: eventCounts.error, bg: 'bg-red-50', text: 'text-red-700' },
          { key: 'info', label: '정보', count: eventCounts.info, bg: 'bg-blue-50', text: 'text-blue-700' },
        ].map(stat => (
          <div key={stat.key} className={`${stat.bg} rounded-lg p-4 border border-gray-200`}>
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.text}`}>{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Main Content: Filters + Feed */}
      <div className="flex gap-6">
        {/* Left Panel: Filters */}
        <div className="w-64 shrink-0 space-y-4">
          {/* Event Type Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={14} className="text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">이벤트 유형</h3>
            </div>
            <div className="space-y-2">
              {(Object.keys(EVENT_STYLES) as Array<keyof typeof EVENT_STYLES>).map(type => {
                const style = EVENT_STYLES[type]
                const Icon = style.icon
                return (
                  <label key={type} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedTypes.has(type)}
                      onChange={() => toggleType(type)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <Icon size={14} className={style.color} />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      {style.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Agent Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">에이전트</h3>
              {selectedAgents.size > 0 && (
                <button
                  onClick={() => setSelectedAgents(new Set())}
                  className="text-xs text-blue-600 hover:underline"
                >
                  전체 보기
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allAgentNames.map(name => (
                <label key={name} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedAgents.size === 0 || selectedAgents.has(name)}
                    onChange={() => toggleAgent(name)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">
                    {name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={() => setEvents([])}
            className="w-full px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            이벤트 로그 초기화
          </button>
        </div>

        {/* Right Panel: Event Feed */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Radio className="text-indigo-600" size={16} />
              <h3 className="text-sm font-semibold text-gray-900">이벤트 피드</h3>
            </div>
            <span className="text-xs text-gray-400">
              {filteredEvents.length}건 표시 / {events.length}건 수신
            </span>
          </div>

          <div
            ref={feedRef}
            className="overflow-y-auto divide-y divide-gray-50"
            style={{ height: 'calc(100vh - 400px)', minHeight: '400px' }}
          >
            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Radio size={32} className="mb-3 opacity-40" />
                <p className="text-sm">이벤트 대기중...</p>
                <p className="text-xs mt-1">필터 설정을 확인해주세요</p>
              </div>
            ) : (
              filteredEvents.map(event => {
                const style = EVENT_STYLES[event.eventType]
                const Icon = style.icon
                return (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 px-4 py-2.5 ${style.bg} hover:opacity-90 transition-opacity`}
                  >
                    <Icon className={`${style.color} mt-0.5 shrink-0`} size={14} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-gray-900">
                          {event.agentName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{event.message}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
