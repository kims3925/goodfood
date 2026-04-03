/**
 * Agent Runtime Engine - EventBus
 *
 * Redis Pub/Sub based event bus for inter-agent communication.
 * Uses the `redis` package (v4.6) already available in the project.
 */

import { createClient, RedisClientType } from 'redis'
import { v4 as uuidV4 } from 'uuid'
import type { AgentEvent, EventHandler } from './types'

const EVENTS_LIST_KEY = 'agent:events:recent'
const EVENTS_LIST_MAX = 1000
const CHANNEL_PREFIX = 'agent:event:'

export class EventBus {
  private static instance: EventBus | null = null

  private publisher: RedisClientType | null = null
  private subscriber: RedisClientType | null = null
  private handlers: Map<string, Set<EventHandler>> = new Map()
  private connected = false
  private connecting = false

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus()
    }
    return EventBus.instance
  }

  /**
   * Initialize Redis connections for pub/sub.
   * Creates two clients: one for publishing and one for subscribing.
   */
  async connect(): Promise<void> {
    if (this.connected || this.connecting) return
    this.connecting = true

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

    try {
      this.publisher = createClient({ url: redisUrl }) as RedisClientType
      this.subscriber = createClient({ url: redisUrl }) as RedisClientType

      this.publisher.on('error', (err) => {
        console.error('[EventBus] Publisher error:', err.message)
      })
      this.subscriber.on('error', (err) => {
        console.error('[EventBus] Subscriber error:', err.message)
      })

      await Promise.all([
        this.publisher.connect(),
        this.subscriber.connect(),
      ])

      this.connected = true
      console.log('[EventBus] Redis pub/sub connected')
    } catch (err) {
      console.error('[EventBus] Failed to connect to Redis:', err)
      this.publisher = null
      this.subscriber = null
    } finally {
      this.connecting = false
    }
  }

  /**
   * Disconnect from Redis and clean up.
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return

    try {
      if (this.subscriber?.isOpen) {
        await this.subscriber.disconnect()
      }
      if (this.publisher?.isOpen) {
        await this.publisher.disconnect()
      }
    } catch {
      // Ignore disconnect errors
    }

    this.publisher = null
    this.subscriber = null
    this.handlers.clear()
    this.connected = false
    console.log('[EventBus] Disconnected')
  }

  /**
   * Subscribe to events matching a pattern.
   * Pattern supports wildcards via Redis PSUBSCRIBE (e.g., "product.*").
   */
  async subscribe(pattern: string, handler: EventHandler): Promise<void> {
    if (!this.subscriber || !this.connected) {
      await this.connect()
    }

    if (!this.subscriber) {
      console.warn('[EventBus] Cannot subscribe - Redis not available')
      return
    }

    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, new Set())

      const channel = `${CHANNEL_PREFIX}${pattern}`

      if (pattern.includes('*')) {
        await this.subscriber.pSubscribe(channel, async (message, receivedChannel) => {
          await this.dispatchToHandlers(pattern, message)
        })
      } else {
        await this.subscriber.subscribe(channel, async (message) => {
          await this.dispatchToHandlers(pattern, message)
        })
      }
    }

    this.handlers.get(pattern)!.add(handler)
  }

  /**
   * Unsubscribe a handler from a pattern.
   * If no handlers remain for the pattern, unsubscribes from Redis.
   */
  async unsubscribe(pattern: string, handler: EventHandler): Promise<void> {
    const handlerSet = this.handlers.get(pattern)
    if (!handlerSet) return

    handlerSet.delete(handler)

    if (handlerSet.size === 0) {
      this.handlers.delete(pattern)

      if (this.subscriber?.isOpen) {
        const channel = `${CHANNEL_PREFIX}${pattern}`
        try {
          if (pattern.includes('*')) {
            await this.subscriber.pUnsubscribe(channel)
          } else {
            await this.subscriber.unsubscribe(channel)
          }
        } catch {
          // Ignore unsubscribe errors
        }
      }
    }
  }

  /**
   * Publish an event to all subscribers.
   * Also stores the event in a recent events list (capped at 1000).
   */
  async publish(event: AgentEvent): Promise<void> {
    if (!this.publisher || !this.connected) {
      await this.connect()
    }

    if (!this.publisher) {
      console.warn('[EventBus] Cannot publish - Redis not available')
      return
    }

    const serialized = JSON.stringify({
      ...event,
      timestamp: event.timestamp.toISOString(),
    })

    const channel = `${CHANNEL_PREFIX}${event.type}`

    try {
      await Promise.all([
        this.publisher.publish(channel, serialized),
        this.storeRecentEvent(serialized),
      ])
    } catch (err) {
      console.error('[EventBus] Failed to publish event:', err)
    }
  }

  /**
   * Retrieve recent events from the Redis list.
   */
  async getRecentEvents(limit = 50): Promise<AgentEvent[]> {
    if (!this.publisher || !this.connected) {
      await this.connect()
    }

    if (!this.publisher) return []

    try {
      const raw = await this.publisher.lRange(EVENTS_LIST_KEY, 0, limit - 1)
      return raw.map((item) => {
        const parsed = JSON.parse(item)
        return {
          ...parsed,
          timestamp: new Date(parsed.timestamp),
        } as AgentEvent
      })
    } catch (err) {
      console.error('[EventBus] Failed to get recent events:', err)
      return []
    }
  }

  /**
   * Create a new AgentEvent with auto-generated id and timestamp.
   */
  static createEvent(
    type: string,
    data: Record<string, unknown>,
    source: string,
    priority: AgentEvent['priority'] = 'NORMAL'
  ): AgentEvent {
    return {
      id: uuidV4(),
      type,
      data,
      source,
      timestamp: new Date(),
      priority,
    }
  }

  // ─── Private Helpers ───

  private async dispatchToHandlers(pattern: string, message: string): Promise<void> {
    const handlerSet = this.handlers.get(pattern)
    if (!handlerSet || handlerSet.size === 0) return

    let event: AgentEvent
    try {
      const parsed = JSON.parse(message)
      event = {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      }
    } catch {
      console.error('[EventBus] Failed to parse event message')
      return
    }

    const promises = Array.from(handlerSet).map(async (handler) => {
      try {
        await handler(event)
      } catch (err) {
        console.error('[EventBus] Handler error:', err)
      }
    })

    await Promise.allSettled(promises)
  }

  private async storeRecentEvent(serialized: string): Promise<void> {
    if (!this.publisher) return

    try {
      await this.publisher.lPush(EVENTS_LIST_KEY, serialized)
      await this.publisher.lTrim(EVENTS_LIST_KEY, 0, EVENTS_LIST_MAX - 1)
    } catch {
      // Non-critical, ignore errors
    }
  }
}
