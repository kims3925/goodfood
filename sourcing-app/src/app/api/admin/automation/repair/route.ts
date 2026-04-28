export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/automation/repair
 *
 * 자동화 파이프라인이 다시 정상 작동하도록 일괄 복구 + 나은 도매방 배송비 산입 점검.
 *
 * 처리 순서 (모두 1회 호출로):
 *  1. stuck workflow 정리 — RUNNING 상태로 30분 이상 멈춰있는 워크플로우를 FAILED 처리
 *     (컨테이너 재시작 등으로 죽은 프로세스의 흔적이 lock 을 잡고 있을 때)
 *  2. AutomationConfig.isEnabled / cronExpression / pipelineSteps 검증 + 자동 보정
 *     - pipelineSteps.transform 이 false 면 true 로 (사용자 의도와 다를 가능성 매우 높음)
 *     - pipelineSteps 자체가 없으면 4단계 모두 true 로 초기화
 *  3. 메모리 cron 재등록 (initializeScheduler 시 등록 실패한 케이스 회복)
 *  4. 나은/VIP/SD/킹/가족/초록 정책 seed (옛 "기준가: 도매가+배송비 합산" 텍스트 제거 +
 *     "배송비: 별도" 명시) — body.seedPolicies=true 일 때만
 *  5. 모순 Product 일괄 수정 — shippingFee>0 + INCLUDED → SEPARATE 정정
 *     (옛 가공 결과의 배송비 미산입 사고 정정) — body.fixShippingType=true 일 때만
 *  6. 나은 도매방 배송비 산입 자가 진단 — 현재 정책/Product 상태 점검 결과 반환
 *
 * 동작은 비파괴적 — 자동화 즉시 실행은 하지 않음. 다음 cron 또는 수동 실행 시 정상 동작.
 *
 * Body (모두 선택, 기본 true):
 *   { cleanupStuck?, reregisterCron?, fixPipelineSteps?, seedPolicies?, fixShippingType?, dryRun? }
 *
 * 응답: 각 단계별 처리 결과 + 나은 도매방 정책/상품 점검 결과
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { WorkflowStatus, BundleShippingType } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { updateScheduler, getActiveSchedulers } from '@/modules/automation/scheduler'
import { parsePolicyShippingType } from '@/lib/policy-shipping'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }
    const userId = currentUser.userId

    const body = await request.json().catch(() => ({}))
    const dryRun = !!body?.dryRun
    const cleanupStuck = body?.cleanupStuck !== false
    const reregisterCron = body?.reregisterCron !== false
    const fixPipelineSteps = body?.fixPipelineSteps !== false
    const seedPolicies = !!body?.seedPolicies
    const fixShippingType = !!body?.fixShippingType

    const result: any = {
      success: true,
      dryRun,
      steps: {},
      naunCheck: {},
    }

    // ── 1. stuck workflow 정리 ──
    if (cleanupStuck) {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000)
      const stuck = await prisma.workflowLog.findMany({
        where: { userId, status: WorkflowStatus.RUNNING, startedAt: { lt: cutoff } },
        select: { id: true, currentStep: true, startedAt: true },
      })

      let cancelled = 0
      if (!dryRun && stuck.length > 0) {
        const r = await prisma.workflowLog.updateMany({
          where: { userId, status: WorkflowStatus.RUNNING, startedAt: { lt: cutoff } },
          data: {
            status: WorkflowStatus.FAILED,
            completedAt: new Date(),
            errorMessage: 'repair API — 30분+ stuck 워크플로우 자동 정리',
          },
        })
        cancelled = r.count

        // 진행 중이던 step 도 정리
        await prisma.workflowStepLog.updateMany({
          where: {
            workflowId: { in: stuck.map((s) => s.id) },
            status: { in: ['RUNNING', 'PENDING'] as any },
          },
          data: {
            status: 'FAILED' as any,
            completedAt: new Date(),
            errorMessage: 'repair API — 부모 워크플로우 정리됨',
          },
        }).catch(() => null)
      }
      result.steps.cleanupStuck = { foundStuck: stuck.length, cancelled, samples: stuck.slice(0, 5) }
    }

    // ── 2. AutomationConfig 검증/보정 ──
    if (fixPipelineSteps) {
      const config = await prisma.automationConfig.findUnique({
        where: { userId },
        select: {
          id: true,
          isEnabled: true,
          cronExpression: true,
          pipelineSteps: true,
        },
      })

      const before = {
        isEnabled: config?.isEnabled,
        cronExpression: config?.cronExpression,
        pipelineSteps: config?.pipelineSteps,
      }

      let parsedSteps: any = null
      if (config?.pipelineSteps) {
        try {
          parsedSteps = JSON.parse(config.pipelineSteps)
        } catch {
          parsedSteps = null
        }
      }

      // pipelineSteps 가 없거나 transform=false 면 모두 true 로 보정
      const needsFix =
        !parsedSteps ||
        parsedSteps.collection === false ||
        parsedSteps.transform === false ||
        parsedSteps.productCreate === false ||
        parsedSteps.publish === false

      const newSteps = {
        collection: true,
        transform: true,
        productCreate: true,
        publish: true,
      }

      if (config && needsFix && !dryRun) {
        await prisma.automationConfig.update({
          where: { userId },
          data: { pipelineSteps: JSON.stringify(newSteps) },
        })
      }

      result.steps.fixPipelineSteps = {
        configFound: !!config,
        before,
        wasFixed: needsFix && !!config,
        newPipelineSteps: needsFix ? newSteps : parsedSteps,
        warnings: [
          ...(!config ? ['AutomationConfig 자체 없음 — 자동화 설정 페이지에서 한 번 저장 필요'] : []),
          ...(config && !config.isEnabled
            ? ['isEnabled=false — 자동화 설정에서 토글 켜야 다음 cron 발화']
            : []),
          ...(config && !config.cronExpression
            ? ['cronExpression 비어있음 — 시간 다시 선택해서 저장 필요']
            : []),
        ],
      }
    }

    // ── 3. 메모리 cron 재등록 ──
    if (reregisterCron) {
      if (!dryRun) {
        await updateScheduler(userId)
      }
      const isRegistered = getActiveSchedulers().includes(userId)
      result.steps.reregisterCron = { isRegisteredInMemory: isRegistered }
    }

    // ── 4. 정책 seed (옵션) ──
    if (seedPolicies && !dryRun) {
      const SEED_NAME = 'BandAuto 표준 (v4 체크리스트)'
      // 외부 호출 대신 내부 호출 — 같은 도메인이므로 정상
      const seedRes = await fetch(
        `${request.nextUrl.origin}/api/admin/policies/seed-from-checklist`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') || '' },
          body: JSON.stringify({ dryRun: false }),
        }
      ).catch((e) => ({ ok: false, json: () => ({ error: e?.message }) } as any))
      try {
        result.steps.seedPolicies = (await (seedRes as any).json?.()) || { error: 'no response' }
      } catch {
        result.steps.seedPolicies = { error: 'parse failed' }
      }
      void SEED_NAME
    } else if (seedPolicies && dryRun) {
      result.steps.seedPolicies = { skipped: 'dryRun' }
    }

    // ── 5. fix-shipping-type 일괄 정정 (옵션) ──
    if (fixShippingType) {
      const where = {
        userId,
        deletedAt: null,
        bundleShippingType: BundleShippingType.INCLUDED,
        shippingFee: { gt: 0 },
      }
      const matched = await prisma.product.count({ where })
      let updated = 0
      if (matched > 0 && !dryRun) {
        const r = await prisma.product.updateMany({
          where,
          data: { bundleShippingType: BundleShippingType.SEPARATE },
        })
        updated = r.count
      }
      result.steps.fixShippingType = { matched, updated }
    }

    // ── 6. 나은 도매방 점검 (배송비 산입 자가 진단) ──
    // 6-1) 나은 채널 식별 (이름 keyword "나은")
    const naunChannels = await prisma.channel.findMany({
      where: {
        userId,
        kind: 'WHOLESALE',
        deletedAt: null,
        name: { contains: '나은' },
      },
      select: { id: true, name: true, channelKey: true },
    })

    // 6-2) 각 채널의 활성 정책 + 배송비 타입 파싱
    const naunPolicies: any[] = []
    for (const ch of naunChannels) {
      const policy = await prisma.pricingPolicy.findFirst({
        where: { userId, channelId: ch.id, isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, content: true, updatedAt: true },
      })
      const shippingType = policy ? parsePolicyShippingType(policy.content) : null
      naunPolicies.push({
        channelId: ch.id,
        channelName: ch.name,
        policyId: policy?.id ?? null,
        policyName: policy?.name ?? null,
        policyShippingType: shippingType,
        // 정책 content 마지막 200자만 발췌 (디버그용)
        policyContentSnippet: policy?.content?.slice(-200) ?? null,
        ok: shippingType === 'separate',
        warning:
          shippingType !== 'separate'
            ? '⚠️ 정책 "배송비:" 가 별도가 아님 — seed-from-checklist 호출 또는 정책 수동 편집 필요'
            : null,
      })
    }

    // 6-3) 나은 채널 상품 통계 (현재 발송비 산입 상태)
    const naunChannelIds = naunChannels.map((c) => c.id)
    const naunProductStats =
      naunChannelIds.length > 0
        ? await prisma.product.groupBy({
            by: ['bundleShippingType'],
            where: {
              userId,
              deletedAt: null,
              channelId: { in: naunChannelIds },
            },
            _count: { _all: true },
            _avg: { shippingFee: true },
          }).catch(() => [])
        : []

    // 6-4) 모순 카운트 (shippingFee>0 + INCLUDED) — 이게 0 이어야 정상
    const naunContradiction =
      naunChannelIds.length > 0
        ? await prisma.product.count({
            where: {
              userId,
              deletedAt: null,
              channelId: { in: naunChannelIds },
              bundleShippingType: BundleShippingType.INCLUDED,
              shippingFee: { gt: 0 },
            },
          })
        : 0

    result.naunCheck = {
      channels: naunChannels,
      policies: naunPolicies,
      productStats: naunProductStats,
      contradictionCount: naunContradiction,
      diagnosis:
        naunPolicies.length === 0
          ? '⚠️ "나은" 이름 포함 채널이 없음 — 채널명 확인 필요'
          : naunPolicies.every((p) => p.ok) && naunContradiction === 0
            ? '✅ 정책 별도 + 모순 0건 — 신규 가공은 정상 산입됨'
            : '⚠️ 점검 필요. policies 와 contradictionCount 확인 후 seedPolicies/fixShippingType 옵션 ON 으로 재호출.',
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[automation/repair] 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '복구 실패' },
      { status: 500 }
    )
  }
}
