import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()

/**
 * BandAuto 자율운영 AI 에이전트팀 v3
 * 11개 에이전트 · 5개 레이어 · 소싱~발행~주문~배송~정산 완전 자동화
 */
const AGENT_SEEDS = [
  // ── COMMAND (1) ──
  {
    name: "commander",
    displayName: "🧠 Commander",
    layer: "COMMAND" as const,
    icon: "Brain",
    description: "전체 에이전트 오케스트레이션, 이벤트 라우팅, 장애 자동복구, 운영 리포트",
    priority: 1,
    maxConcurrent: 30,
    aiModel: "claude-opus",
    retryPolicy: { maxRetries: 5, backoff: "exponential", delays: [1000, 2000, 4000, 8000, 16000] },
    schedule: "*/1 * * * *",
    config: {
      kpiTargets: { event_latency_ms: 500, auto_recovery_rate: 95 },
      skills: ["orchestrate", "auto-recover", "daily-report", "event-route"],
      report: { daily: "0 21 * * *" },
    },
  },

  // ── SOURCING (2) ──
  {
    name: "sourcing-agent",
    displayName: "📦 Sourcing Agent",
    layer: "SOURCING" as const,
    icon: "Package",
    description: "카테고리/조건 기반 소싱, 잘팔리는 상품 우선 소싱, AI 변환, 발행, 소싱처 추적관리 및 자동 발주처 변경",
    priority: 2,
    maxConcurrent: 3,
    aiModel: "claude-sonnet",
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [5000, 10000, 20000] },
    schedule: "0 9,15 * * *",
    config: {
      kpiTargets: { daily_collect_count: 50, transform_success_rate: 90, publish_success_rate: 95, supplier_track_rate: 100 },
      skills: ["category-sourcing", "priority-sourcing", "collect-posts", "ai-transform", "publish", "publish-report", "supplier-track", "supplier-switch"],
    },
  },
  {
    name: "product-manager",
    displayName: "📋 Product Manager",
    layer: "SOURCING" as const,
    icon: "ClipboardCheck",
    description: "상품 품절/변동 감지 시 즉시 쇼핑몰·소매밴드 삭제/변경 반영, 가격 동기화",
    priority: 2,
    maxConcurrent: 5,
    aiModel: "claude-haiku",
    retryPolicy: { maxRetries: 3, backoff: "linear", delays: [2000, 4000, 6000] },
    schedule: "*/5 * * * *",
    config: {
      kpiTargets: { stock_reflect_time_min: 5, price_sync_rate: 100, change_alert_rate: 100 },
      skills: ["stock-monitor", "price-sync", "product-sync", "discontinue", "change-alert"],
    },
  },

  // ── OPERATIONS (2) ──
  {
    name: "marketing-agent",
    displayName: "📢 Marketing Agent",
    layer: "OPERATIONS" as const,
    icon: "Megaphone",
    description: "소매밴드 공지 자동발송, 카카오톡채널 광고, 프로모션 관리",
    priority: 3,
    maxConcurrent: 3,
    aiModel: "claude-sonnet",
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [3000, 6000] },
    schedule: "40 9 * * *",
    config: {
      kpiTargets: { notice_send_rate: 100, ad_click_rate: 2 },
      skills: ["band-notice", "kakao-ad", "promotion", "content-gen"],
      notice: { times: ["09:40", "12:00", "16:30"] },
    },
  },
  {
    name: "customer-agent",
    displayName: "👤 Customer Agent",
    layer: "OPERATIONS" as const,
    icon: "MessageCircle",
    description: "카톡/댓글/문자/1:1창 소통 전반 관리, FAQ 자동응답",
    priority: 3,
    maxConcurrent: 5,
    aiModel: "claude-sonnet",
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [1000, 2000] },
    schedule: "*/5 * * * *",
    config: {
      kpiTargets: { auto_response_rate: 70, avg_response_time_min: 10 },
      skills: ["auto-reply", "inquiry-route", "return-exchange", "sms-kakao"],
    },
  },

  // ── COMMERCE (3) ──
  {
    name: "order-agent",
    displayName: "📝 Order Agent",
    layer: "COMMERCE" as const,
    icon: "ClipboardList",
    description: "주문 접수, 결제 관리, 소싱처 발주(각 양식), 미결제 자동취소",
    priority: 2,
    maxConcurrent: 10,
    aiModel: "claude-haiku",
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [1000, 2000, 4000] },
    schedule: "*/10 * * * *",
    config: {
      kpiTargets: { order_process_delay_hour: 1, wholesale_order_success_rate: 99 },
      skills: ["order-receive", "payment-manage", "wholesale-order", "order-status"],
      autoCancelHours: 24,
    },
  },
  {
    name: "shipping-agent",
    displayName: "🚚 Shipping Agent",
    layer: "COMMERCE" as const,
    icon: "Truck",
    description: "배송 진행사항 관리, 송장번호 등록, 배송 상태 추적 및 알림",
    priority: 3,
    maxConcurrent: 5,
    aiModel: "claude-haiku",
    retryPolicy: { maxRetries: 3, backoff: "linear", delays: [2000, 4000, 6000] },
    schedule: "0 */1 * * *",
    config: {
      kpiTargets: { tracking_register_rate: 100, delivery_complete_rate: 98 },
      skills: ["tracking-register", "delivery-monitor", "delay-alert", "delivery-complete"],
    },
  },
  {
    name: "settlement-agent",
    displayName: "💰 Settlement Agent",
    layer: "COMMERCE" as const,
    icon: "Coins",
    description: "도매밴드 정산, 관리소매밴드 정산, 매출/수익 정산 자동화",
    priority: 3,
    maxConcurrent: 2,
    aiModel: "claude-haiku",
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [3000, 6000] },
    schedule: "0 9 * * 1",
    config: {
      kpiTargets: { settlement_accuracy: 100, settlement_cycle: 7 },
      skills: ["wholesale-settle", "retail-settle", "revenue-report", "google-sheets-sync"],
    },
  },

  // ── INFRA (3) ──
  {
    name: "session-keeper",
    displayName: "🔐 Session Keeper",
    layer: "INFRA" as const,
    icon: "Shield",
    description: "Band 세션 모니터링, 자동 복구, Docker 헬스체크, DB 연결 감시",
    priority: 1,
    maxConcurrent: 3,
    aiModel: "claude-haiku",
    retryPolicy: { maxRetries: 5, backoff: "exponential", delays: [1000, 2000, 4000, 8000, 16000] },
    schedule: "*/5 * * * *",
    config: {
      kpiTargets: { uptime_percent: 99.9, session_recovery_time_min: 2 },
      skills: ["session-monitor", "health-check", "auto-restart"],
    },
  },
  {
    name: "watcher",
    displayName: "📡 Watcher",
    layer: "INFRA" as const,
    icon: "Radio",
    description: "시스템 모니터링, KPI 추적, 이상탐지, 관리자 알림",
    priority: 2,
    maxConcurrent: 3,
    aiModel: "claude-haiku",
    retryPolicy: { maxRetries: 3, backoff: "linear", delays: [500, 1000, 1500] },
    schedule: "*/1 * * * *",
    config: {
      kpiTargets: { alert_detect_time_min: 1, alert_accuracy: 99 },
      skills: ["system-monitor", "anomaly-detect", "alert-notify"],
    },
  },
  {
    name: "analyst",
    displayName: "📊 Analyst",
    layer: "INFRA" as const,
    icon: "BarChart3",
    description: "매출/전환 분석, 상품 성과 평가, 가격 최적화, 운영 리포트",
    priority: 3,
    maxConcurrent: 2,
    aiModel: "claude-opus",
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [2000, 4000] },
    schedule: "0 8 * * *",
    config: {
      kpiTargets: { data_accuracy: 99, report_cycle_days: 7 },
      skills: ["sales-analysis", "product-ranking", "price-optimize", "weekly-report"],
    },
  },
]

async function seedAgents() {
  console.log('🤖 자율운영 AI 에이전트팀 v3 시드 데이터 삽입...')
  console.log('   11개 에이전트 · 5개 레이어 · 완전 자동화 운영\n')

  for (const seed of AGENT_SEEDS) {
    await prisma.agentDefinition.upsert({
      where: { name: seed.name },
      update: {
        displayName: seed.displayName,
        layer: seed.layer,
        icon: seed.icon,
        description: seed.description,
        priority: seed.priority,
        maxConcurrent: seed.maxConcurrent,
        aiModel: seed.aiModel,
        retryPolicy: seed.retryPolicy,
        schedule: seed.schedule ?? null,
        config: seed.config,
      },
      create: seed,
    })
    console.log(`  ✅ ${seed.displayName} [${seed.layer}]`)
  }

  // 기존 에이전트 중 삭제된 것들 soft delete
  const validNames = AGENT_SEEDS.map(s => s.name)
  const deprecated = await prisma.agentDefinition.findMany({
    where: { name: { notIn: validNames }, deletedAt: null },
  })
  for (const agent of deprecated) {
    await prisma.agentDefinition.update({
      where: { id: agent.id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    })
    console.log(`  🗑️ ${agent.displayName} (deprecated)`)
  }

  const count = await prisma.agentDefinition.count({ where: { deletedAt: null } })
  console.log(`\n🎉 총 ${count}개 활성 에이전트 등록 완료`)
}

seedAgents()
  .catch((e) => {
    console.error('❌ 시드 실행 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
