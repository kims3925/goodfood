/**
 * Next.js Instrumentation
 * 서버 시작 시 실행되는 초기화 코드
 */

export async function register() {
  // 서버리스(Vercel) 배포 (2026-06-11): 스케줄러/에이전트/Bull 등 백그라운드 잡 비활성화.
  // 서버리스 환경에는 상주 프로세스·Redis가 없어 초기화 시 오류/지연 발생 — 관리 UI/API만 제공.
  if (process.env.DISABLE_BACKGROUND_JOBS === '1') {
    console.log('[instrumentation] DISABLE_BACKGROUND_JOBS=1 — 백그라운드 잡 초기화 생략')
    return
  }
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

    // ── 도매밴드 5분 변동 감시 (경영수산비공개 / 외주상품방 등 화이트리스트) ──
    // 게시글 직접 조회로 "삭제글/품절 키워드"(확실 신호)만 인정.
    // 정책 (2026-06-10 사용자 지시): 도매밴드는 모니터링만 (삭제 권한/이유 없음 — 코드상
    // 도매 글 삭제 경로 자체가 없음). 감지 시 반영은 소매밴드·쇼핑몰에만:
    //  - 쇼핑몰(ShopProduct)/소매발행(ChannelProduct) soft-delete (가역)
    //  - deleteBandPost=true — 소매밴드의 실제 발행 글도 Playwright 로 삭제
    try {
      const { wholesaleWatchAgent } = await import('@/modules/agents/implementations/WholesaleWatchAgent')
      scheduler.register('wholesale-watch', '*/5 * * * *', async () => {
        try {
          await wholesaleWatchAgent.runWholesaleWatch({
            autoFix: true,
            deleteBandPost: true,
            limitPerRun: 25,
          })
        } catch (err) {
          console.error('[Instrumentation] 도매밴드 변동 감시 실패:', err)
        }
      })
      console.log('[Instrumentation] ✓ 도매밴드 5분 변동 감시 등록 (*/5, autoFix=true, deleteBandPost=true — 소매밴드/쇼핑몰만 반영)')
    } catch (err) {
      console.error('[Instrumentation] 도매밴드 변동 감시 등록 실패:', err)
    }

    // ── 이전글 자동 정리: 매일 03:00 KST — 🛑 사용자 요청으로 비활성화 (2026-05-04) ──
    // 사고: 4/30~5/3 동안 매일 channel_deleted=500/shop_deleted=500/band_deleted=437
    // 풀 limit 으로 정리되며, Band 페이지에서 가족함께수산 등 소매밴드의 옛 글이
    // 사용자 의도와 무관하게 대량 사라짐. 사용자가 "삭제 에이전트 활동 멈춰줘" 명시
    // 요청하여 cron 등록 자체를 비활성화. 재가동 시 보존 정책 협의 후 활성화 필요.
    //
    // (옛 코드)
    // scheduler.register(
    //   `${productManagerAgent.name}:content-expiry`,
    //   '0 3 * * *',
    //   async () => {
    //     const summary = await productManagerAgent.runContentExpiry({ dryRun: false, limit: 500 })
    //     ...
    //   }
    // )
    console.log('[Instrumentation] ⚠️ content-expiry cron 비활성화 (2026-05-04 사용자 요청)')

    // ═══════════════════════════════════════════════════════════════
    // SNSAUTO Lite Manager — 코칭/미션 자동 평가 cron (E4)
    // ───────────────────────────────────────────────────────────────
    // 매시간 정각 (KST) 모든 mode='lite' 사용자에 대해:
    //   1) 코칭 룰 평가 → CoachingTip 생성 (시간대 룰 등 발화)
    //   2) 미션 진행도 재평가 → 신규 완료 시 SSE 알림
    // 단일 노드 가정. 수가 늘어나면 worker queue 로 분리.
    // ═══════════════════════════════════════════════════════════════
    try {
      const { evaluateAndCreateTips } = await import('@/modules/lite-manager/coaching-engine')
      const { evaluateUserMissions } = await import('@/modules/lite-manager/mission.service')

      scheduler.register('lite:coaching+mission', '0 * * * *', async () => {
        try {
          const liteUsers = await prisma.user.findMany({
            where: { mode: 'lite', deletedAt: null },
            select: { id: true },
          })
          let coachCreated = 0
          let missionsCompleted = 0
          for (const u of liteUsers) {
            try {
              coachCreated += await evaluateAndCreateTips(u.id)
              const r = await evaluateUserMissions(u.id)
              missionsCompleted += r.newlyCompleted.length
            } catch (err) {
              console.error(`[lite:cron] user ${u.id} 평가 실패`, (err as Error).message)
            }
          }
          console.log(
            `[lite:cron] ${liteUsers.length}명 평가 — 신규 코칭 팁 ${coachCreated} / 신규 미션 완료 ${missionsCompleted}`
          )
        } catch (err) {
          console.error('[lite:cron] 실패', err)
        }
      })
      console.log('[Instrumentation] ✓ lite:coaching+mission cron 등록 (매 정시)')
    } catch (err) {
      console.error('[Instrumentation] lite cron 등록 실패', err)
    }

    // ═══════════════════════════════════════════════════════════════
    // Lite Manager v2 — 어드민 자동 발행 cron (매분 tick)
    // ───────────────────────────────────────────────────────────────
    // 매분 LiteAutoPublishConfig 활성 셀러 점검:
    //   - publishHour:publishMinute 도달 + 오늘 미실행 → 자동 발행 실행
    //   - 기본값 매일 10:00, dailyCount=20개
    // ═══════════════════════════════════════════════════════════════
    try {
      const { runAllDueAutoPublish } = await import('@/modules/lite-manager/auto-publish.service')
      scheduler.register('lite:auto-publish', '* * * * *', async () => {
        try {
          const results = await runAllDueAutoPublish()
          const fired = results.filter((r) => r.status === 'SUCCESS' || r.status === 'PARTIAL')
          if (fired.length > 0) {
            console.log(
              `[lite:auto-publish] ${fired.length}명 발행 완료 ` +
                fired.map((r) => `user=${r.userId} count=${r.count}`).join(' / ')
            )
          }
        } catch (err) {
          console.error('[lite:auto-publish] 실행 실패', err)
        }
      })
      console.log('[Instrumentation] ✓ lite:auto-publish cron 등록 (매분 tick)')
    } catch (err) {
      console.error('[Instrumentation] lite:auto-publish cron 등록 실패', err)
    }

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