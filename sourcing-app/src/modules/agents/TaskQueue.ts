/**
 * Agent Runtime Engine - TaskQueue
 *
 * Bull Queue wrapper for agent task processing.
 * Records task status in the AgentTask table via Prisma.
 */

import Bull, { Job, Queue } from 'bull'
import prisma from '@bandauto/db'
import type { AgentEvent, AgentResult, QueueStats, TaskHandler } from './types'
import { TaskStatus, TaskPriority } from './types'

const QUEUE_NAME = 'agent-tasks'

/** Map TaskPriority enum to Bull numeric priority (lower = higher priority) */
const PRIORITY_MAP: Record<string, number> = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
}

export class TaskQueue {
  private static instance: TaskQueue | null = null
  private queue: Queue<AgentEvent>

  private constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

    // Parse Redis URL for Bull (Bull uses host/port/password format)
    const url = new URL(redisUrl)

    this.queue = new Bull(QUEUE_NAME, {
      redis: {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: url.password || undefined,
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    })

    this.queue.on('error', (err) => {
      console.error('[TaskQueue] Queue error:', err.message)
    })

    this.queue.on('failed', (job, err) => {
      console.error(`[TaskQueue] Job ${job.id} failed:`, err.message)
    })
  }

  static getInstance(): TaskQueue {
    if (!TaskQueue.instance) {
      TaskQueue.instance = new TaskQueue()
    }
    return TaskQueue.instance
  }

  /**
   * Add a task to the queue.
   * Creates an AgentTask record in the database with QUEUED status.
   */
  async addTask(
    agentId: string,
    event: AgentEvent,
    priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL'
  ): Promise<string> {
    // SaaS 테넌트 식별 (2026-06-10): 이벤트 data 에 userId 가 실려 있으면 태스크 소유자로 기록.
    // 없으면 null = 전역/시스템 태스크 (기존 동작 보존).
    const userId = typeof event.data?.userId === 'number' ? event.data.userId : null

    // Create DB record
    const task = await prisma.agentTask.create({
      data: {
        agentId,
        userId,
        eventType: event.type,
        payload: JSON.parse(JSON.stringify(event)),
        status: TaskStatus.QUEUED,
        priority: priority as TaskPriority,
      },
    })

    // Add to Bull queue
    const job = await this.queue.add(
      {
        ...event,
        timestamp: event.timestamp,
      },
      {
        priority: PRIORITY_MAP[priority] ?? 3,
        jobId: task.id,
      }
    )

    return task.id
  }

  /**
   * Register a task processor.
   * The handler receives an AgentEvent and must return an AgentResult.
   * Task status is automatically updated in the database.
   */
  processTask(handler: TaskHandler, concurrency = 5): void {
    this.queue.process(concurrency, async (job: Job<AgentEvent>) => {
      const taskId = job.id as string
      const event: AgentEvent = {
        ...job.data,
        timestamp: new Date(job.data.timestamp),
      }

      // Update DB status to RUNNING
      await this.updateTaskStatus(taskId, TaskStatus.RUNNING, {
        startedAt: new Date(),
      })

      const startTime = Date.now()
      let result: AgentResult

      try {
        result = await handler(event)
      } catch (err) {
        const duration = Date.now() - startTime
        const errorMessage = err instanceof Error ? err.message : String(err)

        await this.updateTaskStatus(taskId, TaskStatus.FAILED, {
          error: errorMessage,
          duration,
          completedAt: new Date(),
        })

        throw err // Re-throw so Bull can handle retries
      }

      const duration = Date.now() - startTime

      if (result.success) {
        await this.updateTaskStatus(taskId, TaskStatus.COMPLETED, {
          result: result.data ? JSON.parse(JSON.stringify(result.data)) : null,
          duration,
          completedAt: new Date(),
        })
      } else {
        await this.updateTaskStatus(taskId, TaskStatus.FAILED, {
          error: result.error ?? 'Unknown error',
          result: result.data ? JSON.parse(JSON.stringify(result.data)) : null,
          duration,
          completedAt: new Date(),
        })
      }

      return result
    })
  }

  /**
   * Get the status of a specific task by its ID.
   */
  async getTaskStatus(taskId: string): Promise<{
    dbStatus: string
    queueStatus: string | null
    task: Awaited<ReturnType<typeof prisma.agentTask.findUnique>>
  }> {
    const task = await prisma.agentTask.findUnique({
      where: { id: taskId },
    })

    let queueStatus: string | null = null
    try {
      const job = await this.queue.getJob(taskId)
      if (job) {
        const state = await job.getState()
        queueStatus = state
      }
    } catch {
      // Job may not exist in queue anymore
    }

    return {
      dbStatus: task?.status ?? 'NOT_FOUND',
      queueStatus,
      task,
    }
  }

  /**
   * Get queue statistics.
   */
  async getQueueStats(): Promise<QueueStats> {
    const counts = await this.queue.getJobCounts()
    const pausedCount = await this.queue.getPausedCount().catch(() => 0)
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: pausedCount,
    }
  }

  /**
   * Pause the queue.
   */
  async pause(): Promise<void> {
    await this.queue.pause()
  }

  /**
   * Resume the queue.
   */
  async resume(): Promise<void> {
    await this.queue.resume()
  }

  /**
   * Close the queue connection.
   */
  async close(): Promise<void> {
    await this.queue.close()
  }

  // ─── Private Helpers ───

  private async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    extra: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await prisma.agentTask.update({
        where: { id: taskId },
        data: {
          status,
          ...extra,
        },
      })
    } catch (err) {
      console.error(`[TaskQueue] Failed to update task ${taskId}:`, err)
    }
  }
}
