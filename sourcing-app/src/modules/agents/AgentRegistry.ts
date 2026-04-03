/**
 * Agent Runtime Engine - AgentRegistry
 *
 * Singleton registry for managing all agent instances.
 * Provides lookup, lifecycle management, and statistics.
 */

import { AgentBase } from './AgentBase'
import type { RegistryStats } from './types'
import { AgentLayer } from './types'

export class AgentRegistry {
  private static instance: AgentRegistry | null = null
  private agents: Map<string, AgentBase> = new Map()

  private constructor() {}

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry()
    }
    return AgentRegistry.instance
  }

  /**
   * Register an agent instance.
   * Throws if an agent with the same name is already registered.
   */
  register(agent: AgentBase): void {
    if (this.agents.has(agent.name)) {
      throw new Error(`Agent "${agent.name}" is already registered`)
    }
    this.agents.set(agent.name, agent)
    console.log(`[AgentRegistry] Registered: ${agent.name}`)
  }

  /**
   * Unregister an agent by name.
   * Stops the agent if it is running before removal.
   */
  async unregister(name: string): Promise<void> {
    const agent = this.agents.get(name)
    if (!agent) return

    try {
      await agent.stop()
    } catch (err) {
      console.error(`[AgentRegistry] Error stopping agent "${name}":`, err)
    }

    this.agents.delete(name)
    console.log(`[AgentRegistry] Unregistered: ${name}`)
  }

  /**
   * Get a registered agent by name.
   */
  get(name: string): AgentBase | undefined {
    return this.agents.get(name)
  }

  /**
   * Get all registered agents.
   */
  getAll(): AgentBase[] {
    return Array.from(this.agents.values())
  }

  /**
   * Get all agents belonging to a specific layer.
   */
  getByLayer(layer: AgentLayer): AgentBase[] {
    return this.getAll().filter((agent) => agent.layer === layer)
  }

  /**
   * Start all registered agents.
   * Errors from individual agents are logged but do not stop others.
   */
  async startAll(): Promise<void> {
    const agents = this.getAll()
    console.log(`[AgentRegistry] Starting ${agents.length} agents...`)

    const results = await Promise.allSettled(
      agents.map((agent) => agent.start())
    )

    let started = 0
    let failed = 0
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        started++
      } else {
        failed++
        console.error(
          `[AgentRegistry] Failed to start "${agents[index].name}":`,
          result.reason
        )
      }
    })

    console.log(`[AgentRegistry] Started: ${started}, Failed: ${failed}`)
  }

  /**
   * Stop all registered agents.
   */
  async stopAll(): Promise<void> {
    const agents = this.getAll()
    console.log(`[AgentRegistry] Stopping ${agents.length} agents...`)

    await Promise.allSettled(
      agents.map((agent) => agent.stop())
    )

    console.log('[AgentRegistry] All agents stopped')
  }

  /**
   * Get statistics about registered agents.
   */
  async getStats(): Promise<RegistryStats> {
    const agents = this.getAll()
    let active = 0
    let inactive = 0
    let error = 0

    for (const agent of agents) {
      try {
        const health = await agent.healthCheck()
        if (health.healthy) {
          active++
        } else {
          inactive++
        }
      } catch {
        error++
      }
    }

    return {
      total: agents.length,
      active,
      inactive,
      error,
    }
  }

  /**
   * Check if an agent is registered.
   */
  has(name: string): boolean {
    return this.agents.has(name)
  }

  /**
   * Get the number of registered agents.
   */
  get size(): number {
    return this.agents.size
  }
}
