import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()

/**
 * BandAuto 자율운영 AI 에이전트팀 시드 데이터
 * 10개 에이전트 · 4개 레이어 · 사람 없이 플랫폼 완전 운영
 */
const AGENT_SEEDS = [
  // ── COMMAND Layer (1) ──
  {
    name: "commander",
    displayName: "🧠 Commander",
    layer: "COMMAND" as const,
    icon: "Brain",
    description: "전체 에이전트 조율, 이벤트 라우팅, 장애 자동복구, 일일/주간 운영 리포트 생성",
    priority: 1,
    maxConcurrent: 30,
    aiModel: "claude-opus",
    retryPolicy: { maxRetries: 5, backoff: "exponential", delays: [1000, 2000, 4000, 8000, 16000] },
    schedule: "*/1 * * * *", // 1분마다 헬스체크
    config: {
      kpiTargets: { event_latency_ms: 500, auto_recovery_rate: 95 },
      routing: { maxConcurrent: 30, defaultTimeout: 30000 },
      report: { daily: "0 23 * * *", weekly: "0 23 * * 0" },
    },
  },

  // ── SOURCING Layer (3) ──
  {
    name: "collector",
    displayName: "📦 Collector",
    layer: "SOURCING" as const,
    icon: "Package",
    description: "도매 밴드 채널에서 상품 게시글 자동 수집, 중복 필터링, 신규 상품 감지",
    priority: 2,
    maxConcurrent: 3,
    aiModel: "claude-haiku",
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [5000, 10000, 20000] },
    schedule: "0 */1 * * *", // 1시간마다 수집
    config: {
      kpiTargets: { daily_collect_count: 50, duplicate_rate_max: 5 },
      pipeline: { timeout: 1800000 },
      channels: ["band"],
      intervals: { default: "1h", peak: "30m", off: "6h" },
    },
  },
  {
    name: "transformer",
    displayName: "✨ Transformer",
    layer: "SOURCING" as const,
    icon: "Sparkles",
    description: "Gemini AI로 도매 상품을 소매용으로 변환: 상품명, 설명, 옵션, 가격 자동 생성",
    priority: 2,
    maxConcurrent: 5,
    aiModel: "claude-sonnet",
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [2000, 4000, 8000] },
    schedule: "0 */1 * * *", // 1시간마다 대기큐 처리
    config: {
      kpiTargets: { transform_success_rate: 90, avg_process_time_sec: 30 },
      gemini: { model: "gemini-pro", maxTokens: 4000 },
      pricing: { minMargin: 30 },
    },
  },
  {
    name: "publisher",
    displayName: "🚀 Publisher",
    layer: "SOURCING" as const,
    icon: "Send",
    description: "소매밴드/쇼핑몰 발행, Playwright 이미지 업로드, Band API 폴백, 세션 관리",
    priority: 2,
    maxConcurrent: 2,
    aiModel: "claude-sonnet",
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [3000, 6000, 12000] },
    schedule: "0 */2 * * *", // 2시간마다 발행
    config: {
      kpiTargets: { publish_success_rate: 95, session_valid_rate: 99 },
      playwright: { timeout: 60000, imageUploadRetries: 3 },
      channels: { retail: true, shop: true },
    },
  },

  // ── COMMERCE Layer (3) ──
  {
    name: "orderbot",
    displayName: "📝 OrderBot",
    layer: "COMMERCE" as const,
    icon: "ClipboardList",
    description: "주문 상태 관리, 도매 발주 연동, 배송 추적, 미결제 자동취소 (24h)",
    priority: 2,
    maxConcurrent: 10,
    aiModel: "claude-haiku",
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [1000, 2000, 4000] },
    schedule: "0 9 * * *", // 매일 9시 미결제 주문 정리
    config: {
      kpiTargets: { order_process_delay_min: 1, auto_cancel_rate: 100 },
      orderStates: ["PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED"],
      autoCancelHours: 24,
      carriers: ["cj", "hanjin", "lotte"],
    },
  },
  {
    name: "payment-guard",
    displayName: "💳 PaymentGuard",
    layer: "COMMERCE" as const,
    icon: "CreditCard",
    description: "토스페이먼츠 결제 처리, 환불, 웹훅 처리, 정산 자동화, Google Sheets 동기",
    priority: 1,
    maxConcurrent: 5,
    aiModel: "claude-haiku",
    retryPolicy: { maxRetries: 5, backoff: "exponential", delays: [1000, 2000, 4000, 8000, 16000] },
    schedule: "0 0 1 * *", // 매월 1일 정산
    config: {
      kpiTargets: { payment_success_rate: 98, settlement_error_rate: 0 },
      toss: { webhookPath: "/api/payments/webhook" },
      settlement: { period: "monthly", sheetsSync: true },
    },
  },
  {
    name: "supportbot",
    displayName: "🎧 SupportBot",
    layer: "COMMERCE" as const,
    icon: "Headphones",
    description: "1:1 문의 자동 응답, 반품/교환 처리, 리뷰 관리, FAQ 기반 자동화",
    priority: 3,
    maxConcurrent: 5,
    aiModel: "claude-sonnet",
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [1000, 2000] },
    config: {
      kpiTargets: { auto_response_rate: 70, avg_response_time_min: 5 },
      escalation: { confidenceThreshold: 70, repeatThreshold: 3 },
      faq: { enabled: true },
    },
  },

  // ── INFRA Layer (3) ──
  {
    name: "session-keeper",
    displayName: "🔐 SessionKeeper",
    layer: "INFRA" as const,
    icon: "Shield",
    description: "Band 세션 유효성 모니터링, 자동 복구, Docker 컨테이너 헬스체크, DB 연결 감시",
    priority: 1,
    maxConcurrent: 3,
    aiModel: "claude-haiku",
    retryPolicy: { maxRetries: 5, backoff: "exponential", delays: [1000, 2000, 4000, 8000, 16000] },
    schedule: "*/5 * * * *", // 5분마다 헬스체크
    config: {
      kpiTargets: { uptime_percent: 99.9, session_valid_rate: 99 },
      healthcheck: { interval: "5m", endpoints: ["/api/health"] },
      session: { autoRecovery: true, maxExpiryDays: 14 },
      docker: { watchContainers: ["bandauto-sourcing", "bandauto-shop"] },
    },
  },
  {
    name: "watcher",
    displayName: "📡 Watcher",
    layer: "INFRA" as const,
    icon: "Radio",
    description: "전체 시스템 모니터링, KPI 추적, 이상탐지, 관리자 알림(카카오톡/이메일)",
    priority: 2,
    maxConcurrent: 3,
    aiModel: "claude-haiku",
    retryPolicy: { maxRetries: 3, backoff: "linear", delays: [500, 1000, 1500] },
    schedule: "0 */6 * * *", // 6시간마다 KPI 갱신
    config: {
      kpiTargets: { alert_detect_time_min: 1, false_positive_rate_max: 5 },
      alerts: { channels: ["kakao", "email"], escalation: { criticalDelayMin: 5 } },
      anomaly: { zScoreThreshold: 3.0, minSamples: 50 },
    },
  },
  {
    name: "analyst",
    displayName: "📊 Analyst",
    layer: "INFRA" as const,
    icon: "BarChart3",
    description: "매출/전환/트래픽 분석, 상품 성과 평가, 가격 최적화 제안, 운영 리포트",
    priority: 3,
    maxConcurrent: 2,
    aiModel: "claude-opus",
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [2000, 4000] },
    schedule: "0 0 * * *", // 매일 자정 일간 분석
    config: {
      kpiTargets: { data_accuracy: 99, price_optimization_revenue_impact: 10 },
      reports: { daily: true, weekly: true, monthly: true },
      pricing: { strategy: "competitive", adjustFrequency: "weekly" },
    },
  },
]

async function seedAgents() {
  console.log('🤖 자율운영 AI 에이전트팀 시드 데이터 삽입...')
  console.log('   10개 에이전트 · 4개 레이어 · 완전 자동화 운영\n')

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
    console.log(`  ✅ ${seed.displayName} [${seed.layer}] — ${seed.aiModel}`)
  }

  // 기존 17개 에이전트 중 삭제된 것들 soft delete
  const validNames = AGENT_SEEDS.map(s => s.name)
  const deprecated = await prisma.agentDefinition.findMany({
    where: { name: { notIn: validNames }, deletedAt: null },
  })
  if (deprecated.length > 0) {
    for (const agent of deprecated) {
      await prisma.agentDefinition.update({
        where: { id: agent.id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
      })
      console.log(`  🗑️ ${agent.displayName} (deprecated → soft deleted)`)
    }
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
