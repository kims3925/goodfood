/**
 * Lite Manager — 인메모리 이벤트 버스 (SSE 백엔드)
 *
 * 단일 노드 프로세스 내에서 동작하는 EventEmitter 싱글톤.
 * 향후 멀티 노드 시 Redis Pub/Sub로 교체 — Bull 큐가 이미 Redis 사용 중.
 *
 * 이벤트 타입:
 *  - order:created — 주문 발생 (F1 실시간 알림)
 *  - order:status — 주문 상태 변경 (paid/shipped/delivered)
 *  - mission:completed — 미션 달성 (G3, B4)
 */
import { EventEmitter } from 'events'

export interface LiteOrderCreatedPayload {
  orderId: number
  shopId: number | null
  userId: number  // 셀러 (구매자 아님) — 어떤 셀러에게 push 할지
  totalAmount: number
  itemCount: number
  buyer: {
    name: string  // 마스킹된 (홍**)
    phone: string // 마스킹된 (***-****-5678)
  }
  topItem: {
    productName: string
    optionSummary: string | null
    quantity: number
  } | null
  orderedAt: string
}

export interface LiteMissionCompletedPayload {
  userId: number
  missionCode: string
  missionTitle: string
  rewardType: string
  rewardValue: string
}

class LiteEventBus extends EventEmitter {
  constructor() {
    super()
    // 다수 SSE 연결 동시 listen — 기본 limit 10 으로는 부족
    this.setMaxListeners(500)
  }

  emitOrderCreated(payload: LiteOrderCreatedPayload) {
    this.emit('order:created', payload)
    // user-specific channel — 그 셀러만 받게
    this.emit(`order:created:user:${payload.userId}`, payload)
  }

  emitMissionCompleted(payload: LiteMissionCompletedPayload) {
    this.emit('mission:completed', payload)
    this.emit(`mission:completed:user:${payload.userId}`, payload)
  }
}

// 모듈 단위 싱글톤 — Next.js dev mode 에서 hot-reload 시에도 유지되도록 globalThis 사용
const globalForBus = globalThis as unknown as { __liteEventBus?: LiteEventBus }
export const liteEventBus = globalForBus.__liteEventBus ?? new LiteEventBus()
if (process.env.NODE_ENV !== 'production') {
  globalForBus.__liteEventBus = liteEventBus
}
