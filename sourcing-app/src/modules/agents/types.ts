/**
 * Agent Runtime Engine - Type Definitions
 *
 * All TypeScript types for the agent runtime system.
 */

import type {
  AgentDefinition,
  AgentTask,
  AgentLog,
  AgentKpiRecord,
  AgentWorkflow,
  AgentWorkflowStep,
} from '@bandauto/db'

export {
  AgentLayer,
  AgentStatus,
  TaskStatus,
  TaskPriority,
  LogLevel,
} from '@bandauto/db'

export type {
  AgentDefinition,
  AgentTask,
  AgentLog,
  AgentKpiRecord,
  AgentWorkflow,
  AgentWorkflowStep,
}

// ─── Agent Event ───

export interface AgentEvent {
  id: string
  type: string
  data: Record<string, unknown>
  source: string
  timestamp: Date
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW'
}

// ─── Agent Result ───

export interface AgentResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
  duration: number
}

// ─── Health Check ───

export interface HealthCheckResult {
  healthy: boolean
  details?: Record<string, unknown>
}

// ─── Workflow Execution ───

export interface WorkflowResult {
  workflowId: string
  workflowName: string
  success: boolean
  steps: StepResult[]
  totalDuration: number
  error?: string
}

export interface StepResult {
  stepId: string
  agentName: string
  order: number
  success: boolean
  duration: number
  data?: Record<string, unknown>
  error?: string
}

// ─── Queue Stats ───

export interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
}

// ─── Registry Stats ───

export interface RegistryStats {
  total: number
  active: number
  inactive: number
  error: number
}

// ─── Handler Types ───

export type EventHandler = (event: AgentEvent) => Promise<void>

export type TaskHandler = (event: AgentEvent) => Promise<AgentResult>

// ─── Agent Config ───

export interface AgentConfig {
  maxConcurrent?: number
  retryPolicy?: RetryPolicy
  schedule?: string
  [key: string]: unknown
}

export interface RetryPolicy {
  maxRetries: number
  backoffMs: number
  backoffMultiplier: number
}

// ─── KPI Types ───

export interface KpiSummary {
  agentId: string
  agentName: string
  metric: string
  currentValue: number
  targetValue: number
  achievementRate: number
}

export interface KpiTrend {
  date: Date
  value: number
}

// ─── Scheduler Types ───

export interface ScheduleEntry {
  agentName: string
  cronExpression: string
  handler: () => Promise<void>
  isActive: boolean
}
