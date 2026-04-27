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

    // ── 원본 도매밴드 변동 감시: 1시간 주기 고정 스케줄 ──
    // DB 스케줄과 별도로 등록 (매 정각 실행: 0 * * * *)
    // ⚠️ autoFix=false — 감지만 하고 자동 삭제는 하지 않음 (2026-04-11)
    // 이유: 원본 포스트 매칭 로직이 불완전하여 정상 상품이 대량 소프트 삭제되는 사고 발생
    scheduler.register(
      `${productManagerAgent.name}:source-watch`,
      '0 * * * *',
      async () => {
        try {
          console.log('[Instrumentation] 원본 변동 감시 시작 (autoFix=false)')
          await productManagerAgent.runSourceWatch({ autoFix: false })
        } catch (err) {
          console.error('[Instrumentation] 원본 변동 감시 실패:', err)
        }
      }
    )

    // ── 이전글 자동 정리: 매일 03:00 KST (cron timezone은 Asia/Seoul) ──
    // 일반 카테고리 7일 초과, COM(상시상품) 30일 초과 발행분의 ChannelProduct/
    // ShopProduct를 소프트 삭제. 사용자 명시 요청 "에이전트를 동원해서 모두 시행".
    // 실제 Band 게시글 삭제는 emit된 band.post.delete.requested 이벤트의 listener가
    // 추후 처리 (Phase 2). DB 정리만 우선.
    scheduler.register(
      `${productManagerAgent.name}:content-expiry`,
      '0 3 * * *',
      async () => {
        try {
          console.log('[Instrumentation] 이전글 정리 시작 (dryRun=false)')
          const summary = await productManagerAgent.runContentExpiry({ dryRun: false })
          console.log(
            `[Instrumentation] 이전글 정리 완료: 채널 ${summary.channelProducts.softDeleted}/${summary.channelProducts.found}, 쇼핑몰 ${summary.shopProducts.softDeleted}/${summary.shopProducts.found}, 오류 ${summary.errors.length}`
          )
        } catch (err) {
          console.error('[Instrumentation] 이전글 정리 실패:', err)
        }
      }
    )

    scheduler.startAll()
    console.log(`[Instrumentation] AgentScheduler 시작 완료: ${scheduler.size}개 cron 등록`)

    // ═══════════════════════════════════════════════════════════════
    // 🚨 일회성 데이터 복구: runSourceWatch autoFix 버그로 자동 삭제된
    //    ChannelProduct / ShopProduct 레코드를 복구 (2026-04-11)
    // ───────────────────────────────────────────────────────────────
    // 2026-04-10 이후 자동 삭제된 레코드만 대상 (사용자 수동 삭제는 보존)
    // 복구 플래그 파일로 중복 실행 방지
    // ═══════════════════════════════════════════════════════════════
    try {
      const { existsSync, writeFileSync, mkdirSync } = await import('fs')
      const { join, dirname } = await import('path')
      const flagFile = join(process.cwd(), '.data-recovery-2026-04-11.done')

      if (!existsSync(flagFile)) {
        const recoveryStartDate = new Date('2026-04-10T00:00:00Z')

        // ChannelProduct 복구
        const channelRestore = await prisma.channelProduct.updateMany({
          where: {
            deletedAt: { gte: recoveryStartDate },
          },
          data: {
            deletedAt: null,
            isActive: true,
          },
        })

        // ShopProduct 복구
        const shopRestore = await prisma.shopProduct.updateMany({
          where: {
            deletedAt: { gte: recoveryStartDate },
          },
          data: {
            deletedAt: null,
          },
        })

        // Product 복구 (소프트 삭제된 것 중 최근 것)
        const productRestore = await prisma.product.updateMany({
          where: {
            deletedAt: { gte: recoveryStartDate },
          },
          data: {
            deletedAt: null,
            isActive: true,
          },
        })

        console.log(
          `[Instrumentation] 🚑 데이터 복구 완료: ` +
          `Product ${productRestore.count}개, ` +
          `ChannelProduct ${channelRestore.count}개, ` +
          `ShopProduct ${shopRestore.count}개`
        )

        // 플래그 파일 생성 (중복 복구 방지)
        try {
          mkdirSync(dirname(flagFile), { recursive: true })
          writeFileSync(flagFile, new Date().toISOString())
        } catch (flagErr) {
          console.error('[Instrumentation] 복구 플래그 생성 실패 (복구는 완료됨):', flagErr)
        }
      } else {
        console.log('[Instrumentation] 데이터 복구 이미 실행됨 (플래그 파일 존재)')
      }
    } catch (err) {
      console.error('[Instrumentation] 데이터 복구 실패:', err)
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔧 2차 복구 및 정리 (2026-04-11 v2)
    // ───────────────────────────────────────────────────────────────
    // 1) XORD-* 외부주문 PENDING → DELIVERED 일괄 변경
    // 2) 2026-01-06 이후 주문된 ShopProduct 선택 복원
    // 3) 2026-04-01 이후 발행된 ShopProduct 전체 복원
    // ═══════════════════════════════════════════════════════════════
    try {
      const { existsSync, writeFileSync, mkdirSync } = await import('fs')
      const { join, dirname } = await import('path')
      const flagFile2 = join(process.cwd(), '.data-recovery-2026-04-11-v2.done')

      if (!existsSync(flagFile2)) {
        // ── 1) XORD-* 주문 PENDING → DELIVERED 일괄 변경 ──
        const xordPending = await prisma.guestOrder.findMany({
          where: {
            orderNumber: { startsWith: 'XORD-' },
            status: 'PENDING',
          },
          select: { id: true },
        })
        const now = new Date()
        let xordUpdated = 0
        if (xordPending.length > 0) {
          const updateResult = await prisma.guestOrder.updateMany({
            where: {
              id: { in: xordPending.map((o) => o.id) },
            },
            data: {
              status: 'DELIVERED',
              paidAt: now,
              preparingAt: now,
              shippedAt: now,
              deliveredAt: now,
            },
          })
          xordUpdated = updateResult.count
        }

        // ── 2) 2026-01-06 이후 주문된 ShopProduct 선택 복원 ──
        // GuestOrderItem + OrderItem에서 shopProductId 수집
        const orderStartDate = new Date('2026-01-06T00:00:00+09:00')
        const guestItems = await prisma.guestOrderItem.findMany({
          where: {
            guestOrder: {
              orderedAt: { gte: orderStartDate },
            },
            shopProductId: { not: null },
          },
          select: { shopProductId: true },
        })
        const memberItems = await prisma.orderItem.findMany({
          where: {
            order: {
              orderedAt: { gte: orderStartDate },
            },
          },
          select: { shopProductId: true },
        })
        const orderedShopProductIds = Array.from(
          new Set([
            ...guestItems.map((i) => i.shopProductId).filter((id): id is number => id !== null),
            ...memberItems.map((i) => i.shopProductId),
          ])
        )

        let orderedShopRestored = 0
        if (orderedShopProductIds.length > 0) {
          const restoreResult = await prisma.shopProduct.updateMany({
            where: {
              id: { in: orderedShopProductIds },
              deletedAt: { not: null },
            },
            data: { deletedAt: null },
          })
          orderedShopRestored = restoreResult.count

          // 해당 Product도 복원 (soft deleted인 경우)
          const shopProducts = await prisma.shopProduct.findMany({
            where: { id: { in: orderedShopProductIds } },
            select: { productId: true },
          })
          const productIdsToRestore = Array.from(
            new Set(shopProducts.map((sp) => sp.productId).filter((id): id is number => id !== null))
          )
          if (productIdsToRestore.length > 0) {
            await prisma.product.updateMany({
              where: { id: { in: productIdsToRestore } },
              data: { deletedAt: null, isActive: true },
            })
          }
        }

        // ── 3) 2026-04-01 이후 발행된 ShopProduct 전체 복원 ──
        const publishStartDate = new Date('2026-04-01T00:00:00+09:00')
        const recentShopRestore = await prisma.shopProduct.updateMany({
          where: {
            OR: [
              { publishedAt: { gte: publishStartDate } },
              { createdAt: { gte: publishStartDate } },
            ],
            deletedAt: { not: null },
          },
          data: { deletedAt: null },
        })

        // 해당 Product도 복원
        const recentShopProducts = await prisma.shopProduct.findMany({
          where: {
            OR: [
              { publishedAt: { gte: publishStartDate } },
              { createdAt: { gte: publishStartDate } },
            ],
          },
          select: { productId: true },
        })
        const recentProductIds = Array.from(
          new Set(recentShopProducts.map((sp) => sp.productId).filter((id): id is number => id !== null))
        )
        let recentProductRestore = 0
        if (recentProductIds.length > 0) {
          const pr = await prisma.product.updateMany({
            where: {
              id: { in: recentProductIds },
              deletedAt: { not: null },
            },
            data: { deletedAt: null, isActive: true },
          })
          recentProductRestore = pr.count
        }

        console.log(
          `[Instrumentation] 🔧 2차 복구 완료: ` +
          `XORD PENDING→DELIVERED ${xordUpdated}건, ` +
          `주문상품 ShopProduct ${orderedShopRestored}개 복원, ` +
          `2026-04-01 이후 ShopProduct ${recentShopRestore.count}개 복원, ` +
          `관련 Product ${recentProductRestore}개 복원`
        )

        try {
          mkdirSync(dirname(flagFile2), { recursive: true })
          writeFileSync(flagFile2, new Date().toISOString())
        } catch (flagErr) {
          console.error('[Instrumentation] 2차 복구 플래그 생성 실패:', flagErr)
        }
      } else {
        console.log('[Instrumentation] 2차 복구 이미 실행됨')
      }
    } catch (err) {
      console.error('[Instrumentation] 2차 복구 실패:', err)
    }
  }
}