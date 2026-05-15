export const dynamic = 'force-dynamic'

/**
 * POST /api/publish/processed-job
 *
 * 가공상품 페이지(`/sourcing/product/list`)의 "상품발행하기" 진입점.
 *
 * 옛 흐름: 클라이언트가 retail(자동경로) + shop(per-shop loop) + digest(category×chunk×channel loop)
 * 을 직접 fetch 로 돌렸음 → 탭이 닫히면 도중에 중단.
 *
 * 새 흐름:
 *  1) 이 엔드포인트가 WorkflowLog 한 행을 만들고 workflowId 즉시 반환
 *  2) setImmediate 로 runProcessedJob() 호출 (서버 사이드 background)
 *  3) 진행 상태는 WorkflowLog/WorkflowStepLog 로 영속화 → AutomationFlowControl 패널에서 자동 표시
 *
 * 한계:
 *  - Node 프로세스가 죽으면 in-flight 잡은 RUNNING 으로 stuck — AutomationFlowControl
 *    "stuck 정리" 버튼 또는 30분+ 자동 정리에 의존.
 *  - delayMinutes 큰 값(>60분)도 같은 이유로 컨테이너 재시작에 취약. 서버 입장에서
 *    permanent persistent scheduler 는 미구현.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { WorkflowType, TriggerType, WorkflowStatus, StepStatus, StepType } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { runProcessedJob } from '@/modules/publish/processed-job.runner'

const MAX_DELAY_MINUTES = 720 // 12시간 — 그 이상은 컨테이너 재시작 가능성 너무 높음
const MAX_PRODUCT_COUNT = 500

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }
    const userId = currentUser.userId

    const body = await request.json().catch(() => ({}))
    const productIds: number[] = Array.isArray(body?.productIds) ? body.productIds.filter((n: any) => Number.isInteger(n) && n > 0) : []
    const retailChannelIds: number[] = Array.isArray(body?.retailChannelIds) ? body.retailChannelIds.filter((n: any) => Number.isInteger(n) && n > 0) : []
    const shopIds: number[] = Array.isArray(body?.shopIds) ? body.shopIds.filter((n: any) => Number.isInteger(n) && n > 0) : []
    const modeInput = body?.mode || {}
    const mode = {
      individual: modeInput.individual !== false, // 기본 true
      digest: !!modeInput.digest,
    }
    const digestMaxImagesPerProduct: 1 | 2 | 4 =
      body?.digestMaxImagesPerProduct === 1 ? 1
      : body?.digestMaxImagesPerProduct === 2 ? 2
      : 4
    const delayMinutes = Math.max(0, Math.min(MAX_DELAY_MINUTES, Math.floor(Number(body?.delayMinutes ?? 0) || 0)))

    // ── 입력 검증 ──
    if (productIds.length === 0) {
      return NextResponse.json({ success: false, error: '발행할 상품을 선택해주세요.' }, { status: 400 })
    }
    if (productIds.length > MAX_PRODUCT_COUNT) {
      return NextResponse.json({ success: false, error: `상품 개수가 너무 많습니다. (최대 ${MAX_PRODUCT_COUNT}개)` }, { status: 400 })
    }
    if (retailChannelIds.length === 0 && shopIds.length === 0) {
      return NextResponse.json({ success: false, error: '발행할 소매밴드 또는 쇼핑몰을 1개 이상 선택해주세요.' }, { status: 400 })
    }
    if (!mode.individual && !mode.digest) {
      return NextResponse.json({ success: false, error: '개별발행 또는 종합발행 중 하나 이상을 선택해주세요.' }, { status: 400 })
    }

    // ── 소유권 검증 (대량 IN 쿼리 카운트) ──
    const ownedCount = await prisma.product.count({
      where: { id: { in: productIds }, userId, deletedAt: null },
    })
    if (ownedCount !== productIds.length) {
      return NextResponse.json(
        { success: false, error: '본인의 상품이 아니거나 삭제된 상품이 포함되어 있습니다.' },
        { status: 403 },
      )
    }

    // ── 채널/쇼핑몰 소유권 검증 ──
    if (retailChannelIds.length > 0) {
      const c = await prisma.channel.count({
        where: { id: { in: retailChannelIds }, userId, isActive: true },
      })
      if (c !== retailChannelIds.length) {
        return NextResponse.json({ success: false, error: '비활성 또는 권한이 없는 소매밴드가 포함되어 있습니다.' }, { status: 403 })
      }
    }
    if (shopIds.length > 0) {
      const c = await prisma.shop.count({
        where: { id: { in: shopIds }, userId, isActive: true },
      })
      if (c !== shopIds.length) {
        return NextResponse.json({ success: false, error: '비활성 또는 권한이 없는 쇼핑몰이 포함되어 있습니다.' }, { status: 403 })
      }
    }

    // ── HTTP 루프백용 base URL + cookie 캡처 (digest 호출에 사용) ──
    const cookieHeader = request.headers.get('cookie') || ''
    const host = request.headers.get('host') || `localhost:${process.env.PORT || 3001}`
    const proto = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim() || 'http'
    const baseUrl = `${proto}://${host}`

    // ── WorkflowLog + step 생성 (PENDING 으로 시작 — runner 가 RUNNING 으로 전환) ──
    // totalItems = "이론적 시도 수" — 소매밴드(productIds × channels) + 쇼핑몰(productIds × shops)
    const retailAttempts = mode.individual ? productIds.length * retailChannelIds.length : 0
    const shopAttempts = productIds.length * shopIds.length
    const totalItems = retailAttempts + shopAttempts // digest 는 게시글 단위라 별도 카운트

    const workflow = await prisma.workflowLog.create({
      data: {
        userId,
        workflowType: WorkflowType.PUBLISH,
        triggerType: TriggerType.MANUAL,
        status: WorkflowStatus.PENDING,
        currentStep: StepType.PUBLISH,
        startedAt: new Date(),
        totalItems,
        successCount: 0,
        failedCount: 0,
      },
      select: { id: true },
    })

    await prisma.workflowStepLog.create({
      data: {
        workflowId: workflow.id,
        stepType: StepType.PUBLISH,
        stepOrder: 1,
        status: StepStatus.PENDING,
        totalItems,
        processedItems: 0,
        successCount: 0,
        failedCount: 0,
      },
    })

    const scheduledAt = delayMinutes > 0 ? new Date(Date.now() + delayMinutes * 60 * 1000) : null

    // ── 백그라운드 잡 발사 (응답 후 setImmediate 로 실행) ──
    setImmediate(() => {
      runProcessedJob({
        userId,
        workflowId: workflow.id,
        productIds,
        retailChannelIds,
        shopIds,
        mode,
        digestMaxImagesPerProduct,
        delayMinutes,
        loopback: { baseUrl, cookieHeader },
      }).catch((err) => {
        console.error(`[processed-job:${workflow.id}] runner 진입 실패`, err)
      })
    })

    return NextResponse.json({
      success: true,
      workflowId: workflow.id,
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
      message: delayMinutes > 0
        ? `발행 작업이 등록되었습니다 — ${delayMinutes}분 후 실행 예정. 탭을 닫아도 진행됩니다.`
        : '발행 작업이 시작되었습니다 — 탭을 닫아도 서버에서 계속 진행됩니다.',
    })
  } catch (error: any) {
    console.error('[processed-job POST] 실패', error)
    return NextResponse.json(
      { success: false, error: error?.message || '발행 작업 등록 실패' },
      { status: 500 },
    )
  }
}
