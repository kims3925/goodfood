/**
 * Next.js Instrumentation
 * 서버 시작 시 실행되는 초기화 코드
 */

export async function register() {
  // 서버 사이드에서만 실행
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 동적으로 스케줄러 모듈 로드 (서버 사이드 전용)
    const { initializeScheduler } = await import('@/modules/automation/scheduler')

    // 스케줄러 초기화
    await initializeScheduler()

    // 무통장입금 기한 초과 주문 자동 취소 스케줄러
    const { startExpiredOrderCanceller } = await import('@/modules/order/expired-order-canceller')
    startExpiredOrderCanceller()

    // ── 에이전트 시스템 등록 및 시작 ──
    const { AgentRegistry } = await import('@/modules/agents/AgentRegistry')
    const registry = AgentRegistry.getInstance()

    // 에이전트 모듈 동적 임포트
    const { productManagerAgent } = await import('@/modules/agents/implementations/ProductManagerAgent')
    const { sessionKeeperAgent } = await import('@/modules/agents/implementations/SessionKeeperAgent')
    const { sourcingAgent } = await import('@/modules/agents/implementations/SourcingAgent')
    const { commanderAgent } = await import('@/modules/agents/implementations/CommanderAgent')
    const { customerAgent } = await import('@/modules/agents/implementations/CustomerAgent')
    const { orderAgent } = await import('@/modules/agents/implementations/OrderAgent')
    const { watcherAgent } = await import('@/modules/agents/implementations/WatcherAgent')
    const { marketingAgent } = await import('@/modules/agents/implementations/MarketingAgent')
    const { shippingAgent } = await import('@/modules/agents/implementations/ShippingAgent')
    const { settlementAgent } = await import('@/modules/agents/implementations/SettlementAgent')
    const { analystAgent } = await import('@/modules/agents/implementations/AnalystAgent')

    // 전체 에이전트 목록 (우선순위 순서)
    const agents = [
      sessionKeeperAgent,   // INFRA - 세션 관리 (최우선)
      sourcingAgent,        // SOURCING - 자동 수집
      productManagerAgent,  // SOURCING - 상품 감사
      commanderAgent,       // COMMAND - 오케스트레이터
      customerAgent,        // OPERATIONS - 고객 응대
      orderAgent,           // COMMERCE - 주문 처리
      watcherAgent,         // INFRA - 시스템 감시
      marketingAgent,       // OPERATIONS - 마케팅
      shippingAgent,        // COMMERCE - 배송 추적
      settlementAgent,      // COMMERCE - 정산
      analystAgent,         // INFRA - 분석
    ]

    for (const agent of agents) {
      if (!registry.has(agent.name)) {
        try {
          registry.register(agent)
          await agent.start()
          console.log(`[Instrumentation] ${agent.name} 시작 완료`)
        } catch (err) {
          console.error(`[Instrumentation] ${agent.name} 시작 실패:`, err)
        }
      }
    }
    console.log(`[Instrumentation] 총 ${registry.getAll().length}개 에이전트 등록 완료`)

    // ── AgentScheduler 등록 (cron 스케줄 활성화) ──
    const { AgentScheduler } = await import('@/modules/agents/AgentScheduler')
    const { default: prisma } = await import('@bandauto/db')
    const scheduler = AgentScheduler.getInstance()

    for (const agent of agents) {
      try {
        const definition = await prisma.agentDefinition.findUnique({
          where: { name: agent.name },
        })
        if (definition?.schedule) {
          scheduler.register(agent.name, definition.schedule, () => agent.onSchedule())
        }
      } catch (err) {
        console.error(`[Instrumentation] ${agent.name} 스케줄 등록 실패:`, err)
      }
    }

    scheduler.startAll()
    console.log(`[Instrumentation] AgentScheduler 시작 완료: ${scheduler.size}개 cron 등록`)

    // ── 데이터 정합성 정리 (서버 시작 시 1회) ──
    try {
      // isConverted=false인 CollectedProduct를 true로 업데이트
      const unconverted = await prisma.collectedProduct.updateMany({
        where: { isConverted: false, deletedAt: null },
        data: { isConverted: true },
      })
      if (unconverted.count > 0) {
        console.log(`[Instrumentation] CollectedProduct 정리: ${unconverted.count}개 isConverted=true 업데이트`)
      }

      // Product가 생성되었지만 CollectedProduct가 없는 게시물에 대해 CollectedProduct 생성
      // (post/list 필터 정합성 보장)
      const postsNeedingCleanup = await prisma.collectedPost.findMany({
        where: {
          deletedAt: null,
          collectedProducts: { none: {} },
        },
        select: { id: true, userId: true, title: true },
      })

      // 이 게시물들 중 Product 이름과 매칭되는 것이 있는지 확인하기 어려우므로
      // 향후 AI 가공 시 자동 생성으로 점진적 정리 (이미 product.service.create에 구현됨)
      if (postsNeedingCleanup.length > 0) {
        console.log(`[Instrumentation] post/list 미분류 게시물: ${postsNeedingCleanup.length}개 (향후 AI 가공 시 자동 정리)`)
      }

      console.log('[Instrumentation] 데이터 정합성 정리 완료')
    } catch (err) {
      console.error('[Instrumentation] 데이터 정리 실패:', err)
    }
  }
}
