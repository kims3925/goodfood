'use client'

import { memo } from 'react'
import * as LucideIcons from 'lucide-react'
import StatusToggle from './StatusToggle'
import MiniKpi from './MiniKpi'

type AgentLayer = 'COMMAND' | 'SOURCING' | 'COMMERCE' | 'INFRA' | string
type AgentStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'STARTING'

interface KpiTarget {
  label: string
  current: number
  target: number
}

export interface Agent {
  id: string
  name: string
  displayName: string
  layer: AgentLayer
  icon: string
  status: AgentStatus
  description: string
  config: {
    kpiTargets?: KpiTarget[]
    [key: string]: unknown
  }
}

interface AgentCardProps {
  agent: Agent
  onToggle: (agentId: string) => void
  compact?: boolean
}

const LAYER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  COMMAND: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  SOURCING: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  COMMERCE: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  INFRA: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  // 하위 호환
  CORE: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  BUSINESS: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  INTELLIGENCE: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  ACTIVE: 'bg-green-500',
  STARTING: 'bg-yellow-500',
  ERROR: 'bg-red-500',
  INACTIVE: 'bg-gray-400',
}

function getIcon(iconName: string) {
  const icons = LucideIcons as Record<string, React.ComponentType<{ className?: string; size?: number }>>
  const Icon = icons[iconName]
  return Icon || LucideIcons.Bot
}

const AgentCard = memo(function AgentCard({ agent, onToggle, compact = false }: AgentCardProps) {
  const layerStyle = LAYER_COLORS[agent.layer] || LAYER_COLORS.INFRA
  const statusColor = STATUS_COLORS[agent.status]
  const IconComponent = getIcon(agent.icon)
  const kpiTargets = agent.config.kpiTargets ?? []

  if (compact) {
    return (
      <div className="bg-white border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-md ${layerStyle.bg}`}>
            <IconComponent className={layerStyle.text} size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary truncate">
                {agent.displayName}
              </span>
              <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
            </div>
          </div>
          <StatusToggle
            status={agent.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
            onToggle={() => onToggle(agent.id)}
            disabled={agent.status === 'ERROR' || agent.status === 'STARTING'}
            loading={agent.status === 'STARTING'}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${layerStyle.bg}`}>
              <IconComponent className={layerStyle.text} size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {agent.displayName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${layerStyle.bg} ${layerStyle.text}`}>
                  {agent.layer}
                </span>
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
                  {agent.status}
                </span>
              </div>
            </div>
          </div>
          <StatusToggle
            status={agent.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
            onToggle={() => onToggle(agent.id)}
            disabled={agent.status === 'ERROR' || agent.status === 'STARTING'}
            loading={agent.status === 'STARTING'}
          />
        </div>

        {/* Description */}
        <p className="text-xs text-text-secondary mb-4 line-clamp-2">
          {agent.description}
        </p>

        {/* KPI Targets */}
        {kpiTargets.length > 0 && (
          <div className="space-y-2">
            {kpiTargets.map((kpi) => (
              <MiniKpi
                key={kpi.label}
                current={kpi.current}
                target={kpi.target}
                label={kpi.label}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

export default AgentCard
