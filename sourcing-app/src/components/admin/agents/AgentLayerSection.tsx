'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import AgentCard, { type Agent } from './AgentCard'

type AgentLayer = 'CORE' | 'BUSINESS' | 'INTELLIGENCE'

interface AgentLayerSectionProps {
  layer: AgentLayer
  agents: Agent[]
  onToggle: (agentId: string) => void
}

const LAYER_META: Record<AgentLayer, { label: string; color: string; bgColor: string }> = {
  CORE: { label: 'Core Layer', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  BUSINESS: { label: 'Business Layer', color: 'text-green-700', bgColor: 'bg-green-50' },
  INTELLIGENCE: { label: 'Intelligence Layer', color: 'text-purple-700', bgColor: 'bg-purple-50' },
}

export default function AgentLayerSection({ layer, agents, onToggle }: AgentLayerSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const meta = LAYER_META[layer]

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const activeCount = agents.filter((a) => a.status === 'ACTIVE').length

  return (
    <section className="mb-6">
      {/* Section Header */}
      <button
        type="button"
        onClick={handleToggleExpand}
        className={`
          w-full flex items-center justify-between
          px-4 py-3 rounded-lg
          ${meta.bgColor}
          hover:opacity-90 transition-opacity duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-color
        `}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className={meta.color} size={20} />
          ) : (
            <ChevronRight className={meta.color} size={20} />
          )}
          <h2 className={`text-sm font-semibold ${meta.color}`}>
            {meta.label}
          </h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/70 text-text-secondary">
            {activeCount}/{agents.length} active
          </span>
        </div>
      </button>

      {/* Agent Grid */}
      {expanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onToggle={onToggle} />
          ))}
        </div>
      )}
    </section>
  )
}
