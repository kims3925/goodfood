import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()

const AGENT_SEEDS = [
  // ── CORE (8) ──
  {
    name: "orchestrator",
    displayName: "Orchestrator Agent",
    layer: "CORE" as const,
    icon: "brain",
    description: "중앙 이벤트 라우팅, 워크플로우 관리, 에이전트 조율",
    priority: 1,
    maxConcurrent: 30,
    retryPolicy: { maxRetries: 5, backoff: "exponential", delays: [1000, 2000, 4000, 8000, 16000] },
    schedule: "*/1 * * * *",
    config: {
      kpiTargets: { event_latency: 500 },
      routing: { maxConcurrent: 30, defaultTimeout: 30000 },
    },
  },
  {
    name: "content",
    displayName: "Content Agent",
    layer: "CORE" as const,
    icon: "pen-tool",
    description: "콘텐츠 자동 생성 (프로필, 링크, 상품 설명)",
    priority: 2,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [1000, 2000, 4000] },
    config: {
      kpiTargets: { ai_utilization: 60 },
      claude: { model: "sonnet", maxTokens: 2000 },
      generation: { maxLength: 150, timeout: 3000 },
    },
  },
  {
    name: "analytics",
    displayName: "Analytics Agent",
    layer: "CORE" as const,
    icon: "bar-chart-2",
    description: "클릭/방문/전환 데이터 수집 및 분석",
    priority: 2,
    maxConcurrent: 10,
    retryPolicy: { maxRetries: 3, backoff: "linear", delays: [500, 1000, 1500] },
    schedule: "*/5 * * * *",
    config: {
      kpiTargets: { data_accuracy: 99 },
      anomaly: { zScoreThreshold: 3.0, minSamples: 100 },
    },
  },
  {
    name: "revenue",
    displayName: "Revenue Agent",
    layer: "CORE" as const,
    icon: "dollar-sign",
    description: "수익 최적화, 가격 전략, 업셀 유도",
    priority: 2,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [2000, 4000, 8000] },
    schedule: "0 0 * * *",
    config: {
      kpiTargets: { monthly_revenue_growth: 15 },
      pricing: { maxDailyChange: 15, minMargin: 10 },
      upsell: { freeToProTarget: 10, proToBusinessTarget: 5 },
    },
  },
  {
    name: "growth",
    displayName: "Growth Agent",
    layer: "CORE" as const,
    icon: "trending-up",
    description: "사용자 성장, 이탈 방지, 리텐션 관리",
    priority: 3,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [1000, 2000, 4000] },
    schedule: "0 9 * * *",
    config: {
      kpiTargets: { churn_rate: 5 },
      onboarding: { sequences: [0, 1, 3, 7] },
      retention: { warningDays: [7, 14, 30] },
      maxNotifications: 3,
    },
  },
  {
    name: "support",
    displayName: "Support Agent",
    layer: "CORE" as const,
    icon: "headphones",
    description: "고객 문의 자동 응답, 티켓 관리",
    priority: 3,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [1000, 2000] },
    config: {
      kpiTargets: { auto_resolve_rate: 70 },
      escalation: { confidenceThreshold: 70, repeatThreshold: 3 },
    },
  },
  {
    name: "moderation",
    displayName: "Moderation Agent",
    layer: "CORE" as const,
    icon: "shield",
    description: "스팸, 사기, 유해 콘텐츠 차단",
    priority: 1,
    maxConcurrent: 10,
    retryPolicy: { maxRetries: 1, backoff: "none", delays: [0] },
    config: {
      kpiTargets: { block_rate: 99 },
      safeBrowsing: { enabled: true },
      falsePositiveTarget: 1,
    },
  },
  {
    name: "notification",
    displayName: "Notification Agent",
    layer: "CORE" as const,
    icon: "bell",
    description: "멀티채널 알림 통합 (이메일, 푸시, SMS, 카카오)",
    priority: 2,
    maxConcurrent: 20,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [1000, 2000, 4000] },
    config: {
      kpiTargets: { email_open_rate: 25 },
      channels: ["email", "push", "sms", "kakao", "inapp"],
      throttle: { maxPerUserPerDay: 5 },
      templates: { languages: ["ko", "en"] },
    },
  },

  // ── BUSINESS (4) ──
  {
    name: "commerce",
    displayName: "Commerce Agent",
    layer: "BUSINESS" as const,
    icon: "shopping-bag",
    description: "쇼핑몰 운영 자동화 (상품, 주문, 배송)",
    priority: 3,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [2000, 4000, 8000] },
    config: {
      kpiTargets: { order_processing_time: 60000 },
      orderStates: ["PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED"],
      carriers: ["cj", "hanjin", "lotte"],
    },
  },
  {
    name: "affiliate",
    displayName: "Affiliate Agent",
    layer: "BUSINESS" as const,
    icon: "link-2",
    description: "제휴 마케팅 자동화 (쿠팡, 아마존, ClickBank)",
    priority: 3,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [1000, 2000, 4000] },
    config: {
      kpiTargets: { monthly_affiliate_revenue: 50000 },
      platforms: { coupang: { commission: "3-7%" }, amazon: { commission: "1-10%" } },
    },
  },
  {
    name: "sourcing",
    displayName: "Sourcing Agent",
    layer: "BUSINESS" as const,
    icon: "package",
    description: "도매 상품 자동 수집, 변환, 등록 (SNS_AUTO 연동)",
    priority: 4,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [5000, 10000, 20000] },
    config: {
      kpiTargets: { automation_rate: 70 },
      pipeline: { timeout: 1800000, minMargin: 30 },
      channels: ["band", "aliexpress", "1688"],
    },
  },
  {
    name: "finance",
    displayName: "Finance Agent",
    layer: "BUSINESS" as const,
    icon: "credit-card",
    description: "결제, 정산, 출금, 세금 관리 (토스페이먼츠)",
    priority: 2,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 5, backoff: "exponential", delays: [1000, 2000, 4000, 8000, 16000] },
    config: {
      kpiTargets: { payment_success_rate: 98 },
      settlement: { minWithdrawal: 10000, settlementDay: 15 },
      fees: { free: 5, pro: 3, business: 1 },
    },
  },

  // ── INTELLIGENCE (5) ──
  {
    name: "recommendation",
    displayName: "Recommendation Agent",
    layer: "INTELLIGENCE" as const,
    icon: "target",
    description: "개인화 추천, A/B 테스트 엔진",
    priority: 4,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [1000, 2000] },
    schedule: "0 * * * *",
    config: {
      kpiTargets: { recommendation_ctr: 20 },
      weights: { category: 0.3, popularity: 0.2, commission: 0.2, conversion: 0.2, trend: 0.1 },
      abTest: { minSamples: 100 },
    },
  },
  {
    name: "funnel",
    displayName: "Funnel Agent",
    layer: "INTELLIGENCE" as const,
    icon: "git-merge",
    description: "전환 퍼널 분석, CTA 최적화",
    priority: 4,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [1000, 2000] },
    config: {
      kpiTargets: { funnel_conversion: 8 },
      stages: ["visit", "view", "scroll", "click", "external", "convert"],
      bottleneck: { weights: { dropoff: 0.4, traffic: 0.3, revenue: 0.3 } },
    },
  },
  {
    name: "brand",
    displayName: "Brand Agent",
    layer: "INTELLIGENCE" as const,
    icon: "palette",
    description: "브랜드 전략, 스타일, 콘텐츠 방향",
    priority: 5,
    maxConcurrent: 2,
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [2000, 4000] },
    schedule: "0 0 * * 1",
    config: {
      kpiTargets: { brand_consistency: 80 },
      categories: ["beauty", "tech", "food", "fitness", "business"],
      claude: { model: "opus", maxTokens: 4000 },
    },
  },
  {
    name: "seo",
    displayName: "SEO Agent",
    layer: "INTELLIGENCE" as const,
    icon: "search",
    description: "검색 노출, 메타태그, 사이트맵, 구조화 데이터",
    priority: 3,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [2000, 4000, 8000] },
    schedule: "0 */6 * * *",
    config: {
      kpiTargets: { search_traffic_growth: 15 },
      schemas: ["Person", "Product", "BreadcrumbList", "FAQ"],
      sitemap: { maxUrls: 50000, changefreq: "daily" },
    },
  },
  {
    name: "design",
    displayName: "Design Agent",
    layer: "INTELLIGENCE" as const,
    icon: "figma",
    description: "테마/레이아웃 생성, OG/썸네일, 브랜딩, UI 시스템",
    priority: 4,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [2000, 4000] },
    config: {
      kpiTargets: { theme_adoption: 60 },
      presets: 8,
      claude: { haiku: "color-classify", sonnet: "theme-recommend", opus: "design-strategy" },
      accessibility: { standard: "WCAG-AA" },
    },
  },
]

async function seedAgents() {
  console.log('🤖 에이전트 시드 데이터 삽입 시작...')

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
        retryPolicy: seed.retryPolicy,
        schedule: seed.schedule ?? null,
        config: seed.config,
      },
      create: seed,
    })
    console.log(`  ✅ ${seed.displayName} (${seed.layer})`)
  }

  const count = await prisma.agentDefinition.count()
  console.log(`\n🎉 총 ${count}개 에이전트 등록 완료`)
}

seedAgents()
  .catch((e) => {
    console.error('❌ 시드 실행 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
