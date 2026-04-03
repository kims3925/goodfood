'use client'

import { useState, useCallback, useMemo } from 'react'
import { Terminal, ChevronDown, Loader2 } from 'lucide-react'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

interface LogEntry {
  id: string
  timestamp: string
  agentName: string
  level: LogLevel
  message: string
}

interface AgentLogConsoleProps {
  logs: LogEntry[]
  loading?: boolean
}

const LOG_LEVEL_OPTIONS: { value: LogLevel | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Levels' },
  { value: 'DEBUG', label: 'Debug' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARN', label: 'Warn' },
  { value: 'ERROR', label: 'Error' },
  { value: 'CRITICAL', label: 'Critical' },
]

const LEVEL_STYLES: Record<LogLevel, string> = {
  DEBUG: 'text-gray-400',
  INFO: 'text-blue-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-500 font-bold',
}

const LEVEL_BADGE_STYLES: Record<LogLevel, string> = {
  DEBUG: 'bg-gray-700 text-gray-300',
  INFO: 'bg-blue-900 text-blue-300',
  WARN: 'bg-yellow-900 text-yellow-300',
  ERROR: 'bg-red-900 text-red-300',
  CRITICAL: 'bg-red-800 text-red-200',
}

export default function AgentLogConsole({ logs, loading = false }: AgentLogConsoleProps) {
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL')

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterLevel(e.target.value as LogLevel | 'ALL')
  }, [])

  const filteredLogs = useMemo(() => {
    if (filterLevel === 'ALL') return logs
    return logs.filter((log) => log.level === filterLevel)
  }, [logs, filterLevel])

  const formatTimestamp = (timestamp: string) => {
    try {
      const d = new Date(timestamp)
      return d.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      })
    } catch {
      return timestamp
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal className="text-green-400" size={16} />
          <h3 className="text-sm font-semibold text-gray-200">Agent Logs</h3>
          {loading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
          )}
        </div>
        <div className="relative">
          <select
            value={filterLevel}
            onChange={handleFilterChange}
            className="appearance-none bg-gray-700 text-gray-300 text-xs rounded-md pl-2.5 pr-7 py-1.5 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {LOG_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>
      </div>

      {/* Log Output */}
      <div className="max-h-[500px] overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        {loading && filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span>Loading logs...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No logs to display
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex gap-2 py-0.5 hover:bg-gray-800/50 rounded px-1">
              <span className="text-gray-500 shrink-0">
                {formatTimestamp(log.timestamp)}
              </span>
              <span className={`shrink-0 inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium ${LEVEL_BADGE_STYLES[log.level]}`}>
                {log.level.padEnd(8)}
              </span>
              <span className="text-cyan-400 shrink-0">
                [{log.agentName}]
              </span>
              <span className={LEVEL_STYLES[log.level]}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
