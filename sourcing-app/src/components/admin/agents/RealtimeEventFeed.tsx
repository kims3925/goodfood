'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Radio, AlertCircle, Info, CheckCircle, WifiOff } from 'lucide-react'

interface AgentEvent {
  id: string
  timestamp: string
  agentName: string
  eventType: 'success' | 'error' | 'info'
  message: string
}

const MAX_EVENTS = 100

const EVENT_STYLES: Record<AgentEvent['eventType'], { icon: React.ElementType; color: string; bg: string }> = {
  success: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50' },
}

export default function RealtimeEventFeed() {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const addEvent = useCallback((event: AgentEvent) => {
    setEvents((prev) => {
      const next = [event, ...prev]
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next
    })
  }, [])

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      const es = new EventSource('/api/admin/agents/events/stream')
      eventSourceRef.current = es

      es.onopen = () => {
        setConnected(true)
      }

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as AgentEvent
          addEvent(data)
        } catch {
          // skip malformed messages
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        eventSourceRef.current = null
        // Auto-reconnect after 3 seconds
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

  const formatTime = (timestamp: string) => {
    try {
      const d = new Date(timestamp)
      return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return timestamp
    }
  }

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
        <div className="flex items-center gap-2">
          <Radio className="text-primary-color" size={16} />
          <h3 className="text-sm font-semibold text-text-primary">Real-time Events</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {connected ? (
            <>
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-600">Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-gray-400" />
              <span className="text-xs text-text-secondary">Reconnecting...</span>
            </>
          )}
        </div>
      </div>

      {/* Event List */}
      <div
        ref={containerRef}
        className="max-h-[400px] overflow-y-auto divide-y divide-gray-100"
      >
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
            <Radio size={24} className="mb-2 opacity-40" />
            <p className="text-sm">Waiting for events...</p>
          </div>
        ) : (
          events.map((event) => {
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
                    <span className="text-xs font-medium text-text-primary">
                      {event.agentName}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary truncate">
                    {event.message}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
