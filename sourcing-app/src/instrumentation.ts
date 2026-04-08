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
  }
}
