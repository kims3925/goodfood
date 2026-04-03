/**
 * Agent Runtime Engine - WorkflowEngine
 *
 * DAG workflow execution engine.
 * Finds matching workflows by triggerEvent, executes steps in order,
 * and supports parallel step execution via the isParallel flag.
 */

import prisma from '@bandauto/db'
import { AgentRegistry } from './AgentRegistry'
import { EventBus } from './EventBus'
import type { AgentEvent, WorkflowResult, StepResult } from './types'

export class WorkflowEngine {
  private static instance: WorkflowEngine | null = null
  private registry: AgentRegistry
  private eventBus: EventBus

  private constructor() {
    this.registry = AgentRegistry.getInstance()
    this.eventBus = EventBus.getInstance()
  }

  static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine()
    }
    return WorkflowEngine.instance
  }

  /**
   * Execute all active workflows matching the given event's type.
   * Returns results for each matched workflow.
   */
  async executeWorkflow(event: AgentEvent): Promise<WorkflowResult[]> {
    // Find all active workflows triggered by this event type
    const workflows = await prisma.agentWorkflow.findMany({
      where: {
        triggerEvent: event.type,
        isActive: true,
      },
      include: {
        steps: {
          include: {
            agent: {
              select: { id: true, name: true },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    if (workflows.length === 0) {
      return []
    }

    const results: WorkflowResult[] = []

    for (const workflow of workflows) {
      const workflowStart = Date.now()
      const stepResults: StepResult[] = []
      let workflowSuccess = true
      let workflowError: string | undefined

      try {
        // Group steps by order for parallel execution
        const stepGroups = this.groupStepsByOrder(workflow.steps)

        // Build context that accumulates data from previous steps
        const context: Record<string, unknown> = {
          triggerEvent: event,
          stepOutputs: {} as Record<string, unknown>,
        }

        for (const group of stepGroups) {
          if (group.length === 1 && !group[0].isParallel) {
            // Sequential step
            const step = group[0]
            const result = await this.executeStep(step, event, context)
            stepResults.push(result)

            // Add step output to context
            ;(context.stepOutputs as Record<string, unknown>)[step.agent.name] = result.data

            if (!result.success) {
              workflowSuccess = false
              workflowError = `Step "${step.agent.name}" failed: ${result.error}`
              break // Stop workflow on step failure
            }
          } else {
            // Parallel steps - execute all in this group concurrently
            const parallelResults = await Promise.allSettled(
              group.map((step) => this.executeStep(step, event, context))
            )

            for (let i = 0; i < parallelResults.length; i++) {
              const settled = parallelResults[i]
              if (settled.status === 'fulfilled') {
                stepResults.push(settled.value)
                ;(context.stepOutputs as Record<string, unknown>)[group[i].agent.name] =
                  settled.value.data

                if (!settled.value.success) {
                  workflowSuccess = false
                  workflowError = `Parallel step "${group[i].agent.name}" failed: ${settled.value.error}`
                }
              } else {
                const errorResult: StepResult = {
                  stepId: group[i].id,
                  agentName: group[i].agent.name,
                  order: group[i].order,
                  success: false,
                  duration: 0,
                  error: settled.reason?.message ?? 'Unknown error',
                }
                stepResults.push(errorResult)
                workflowSuccess = false
                workflowError = `Parallel step "${group[i].agent.name}" threw: ${errorResult.error}`
              }
            }

            // Stop workflow if any parallel step failed
            if (!workflowSuccess) break
          }
        }
      } catch (err) {
        workflowSuccess = false
        workflowError = err instanceof Error ? err.message : String(err)
      }

      const totalDuration = Date.now() - workflowStart

      // Update workflow execution metadata in DB
      await this.recordExecution(workflow.id, workflowSuccess)

      const result: WorkflowResult = {
        workflowId: workflow.id,
        workflowName: workflow.name,
        success: workflowSuccess,
        steps: stepResults,
        totalDuration,
        error: workflowError,
      }

      results.push(result)

      // Emit workflow completion event
      const completionEvent = EventBus.createEvent(
        'workflow.completed',
        {
          workflowId: workflow.id,
          workflowName: workflow.name,
          success: workflowSuccess,
          totalDuration,
          stepCount: stepResults.length,
        },
        'WorkflowEngine',
        workflowSuccess ? 'NORMAL' : 'HIGH'
      )
      await this.eventBus.publish(completionEvent)
    }

    return results
  }

  /**
   * Execute a single workflow step by dispatching the event to the target agent.
   */
  async executeStep(
    step: {
      id: string
      order: number
      config: unknown
      agent: { id: string; name: string }
    },
    event: AgentEvent,
    context: Record<string, unknown>
  ): Promise<StepResult> {
    const startTime = Date.now()

    const agent = this.registry.get(step.agent.name)
    if (!agent) {
      return {
        stepId: step.id,
        agentName: step.agent.name,
        order: step.order,
        success: false,
        duration: 0,
        error: `Agent "${step.agent.name}" not found in registry`,
      }
    }

    // Enrich event data with step config and workflow context
    const stepEvent: AgentEvent = {
      ...event,
      data: {
        ...event.data,
        _stepConfig: step.config ?? {},
        _workflowContext: context,
      },
    }

    try {
      const result = await agent.handleEvent(stepEvent)
      const duration = Date.now() - startTime

      return {
        stepId: step.id,
        agentName: step.agent.name,
        order: step.order,
        success: result.success,
        duration,
        data: result.data,
        error: result.error,
      }
    } catch (err) {
      const duration = Date.now() - startTime
      return {
        stepId: step.id,
        agentName: step.agent.name,
        order: step.order,
        success: false,
        duration,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  // ─── Private Helpers ───

  /**
   * Group steps by their order value so steps with the same order
   * (and isParallel=true) can be executed concurrently.
   */
  private groupStepsByOrder(
    steps: Array<{
      id: string
      order: number
      isParallel: boolean
      config: unknown
      agent: { id: string; name: string }
    }>
  ): Array<typeof steps> {
    const groups: Map<number, typeof steps> = new Map()

    for (const step of steps) {
      const existing = groups.get(step.order)
      if (existing) {
        existing.push(step)
      } else {
        groups.set(step.order, [step])
      }
    }

    // Return groups sorted by order
    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([, group]) => group)
  }

  /**
   * Record workflow execution in the database.
   */
  private async recordExecution(workflowId: string, success: boolean): Promise<void> {
    try {
      await prisma.agentWorkflow.update({
        where: { id: workflowId },
        data: {
          executionCount: { increment: 1 },
          lastExecuted: new Date(),
        },
      })
    } catch (err) {
      console.error(`[WorkflowEngine] Failed to record execution for ${workflowId}:`, err)
    }
  }
}
