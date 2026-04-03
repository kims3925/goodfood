/**
 * Agent Runtime Engine - AgentScheduler
 *
 * Cron-based scheduling for agent periodic tasks.
 * Uses node-cron (already installed in sourcing-app).
 */

import * as cron from 'node-cron'
import type { ScheduleEntry } from './types'

interface ScheduleRecord {
  entry: ScheduleEntry
  task: cron.ScheduledTask
}

export class AgentScheduler {
  private static instance: AgentScheduler | null = null
  private schedules: Map<string, ScheduleRecord> = new Map()

  private constructor() {}

  static getInstance(): AgentScheduler {
    if (!AgentScheduler.instance) {
      AgentScheduler.instance = new AgentScheduler()
    }
    return AgentScheduler.instance
  }

  /**
   * Register a cron schedule for an agent.
   * If a schedule already exists for this agent, it is replaced.
   */
  register(
    agentName: string,
    cronExpression: string,
    handler: () => Promise<void>
  ): void {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(
        `Invalid cron expression "${cronExpression}" for agent "${agentName}"`
      )
    }

    // Remove existing schedule if present
    if (this.schedules.has(agentName)) {
      this.unregister(agentName)
    }

    const entry: ScheduleEntry = {
      agentName,
      cronExpression,
      handler,
      isActive: false,
    }

    const task = cron.schedule(cronExpression, async () => {
      try {
        await handler()
      } catch (err) {
        console.error(
          `[AgentScheduler] Error in scheduled task for "${agentName}":`,
          err
        )
      }
    })

    // Stop immediately after creation; startAll() will start it
    task.stop()

    this.schedules.set(agentName, { entry, task })
    console.log(
      `[AgentScheduler] Registered: ${agentName} (${cronExpression})`
    )
  }

  /**
   * Unregister and stop a scheduled task for an agent.
   */
  unregister(agentName: string): void {
    const record = this.schedules.get(agentName)
    if (!record) return

    record.task.stop()
    record.entry.isActive = false
    this.schedules.delete(agentName)
    console.log(`[AgentScheduler] Unregistered: ${agentName}`)
  }

  /**
   * Start all registered schedules.
   */
  startAll(): void {
    let started = 0
    for (const [name, record] of this.schedules) {
      try {
        record.task.start()
        record.entry.isActive = true
        started++
      } catch (err) {
        console.error(
          `[AgentScheduler] Failed to start schedule for "${name}":`,
          err
        )
      }
    }

    if (started > 0) {
      console.log(`[AgentScheduler] Started ${started} schedules`)
    }
  }

  /**
   * Stop all registered schedules without removing them.
   */
  stopAll(): void {
    for (const [, record] of this.schedules) {
      try {
        record.task.stop()
        record.entry.isActive = false
      } catch {
        // Ignore stop errors
      }
    }
    console.log('[AgentScheduler] All schedules stopped')
  }

  /**
   * Get all registered schedule entries.
   */
  getAll(): ScheduleEntry[] {
    return Array.from(this.schedules.values()).map((r) => ({ ...r.entry }))
  }

  /**
   * Check if a schedule exists for an agent.
   */
  has(agentName: string): boolean {
    return this.schedules.has(agentName)
  }

  /**
   * Check if a specific agent's schedule is currently active.
   */
  isActive(agentName: string): boolean {
    const record = this.schedules.get(agentName)
    return record?.entry.isActive ?? false
  }

  /**
   * Get the number of registered schedules.
   */
  get size(): number {
    return this.schedules.size
  }
}
