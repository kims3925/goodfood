/**
 * 가공상품 발행 — 백그라운드 잡 러너
 *
 * `/api/publish/processed-job` 엔드포인트가 클라이언트 응답을 즉시 돌려준 뒤
 * setImmediate 로 호출되는 함수. 다음을 직렬 처리하고 WorkflowLog / WorkflowStepLog
 * 에 진행률을 기록한다.
 *
 *  1) 소매밴드 개별 발행 — publishService.publishMultiChannel 직접 호출
 *  2) 쇼핑몰 개별 발행   — publishService.publishShopBatch (shop loop) 직접 호출
 *  3) 종합발행 (digest)  — POST /api/publish/digest 로 HTTP 루프백 (cookie 포워딩)
 *
 * 탭 클로즈 후에도 진행되도록 모든 작업을 서버 사이드에서 직렬 처리한다.
 * (옛 클라이언트 측 for-loop 가 도중에 탭이 닫히면 중단되던 사고 보완)
 *
 * 한계:
 *  - 컨테이너/Node 프로세스 재시작 시 진행 중이던 잡은 RUNNING 상태로 stuck.
 *    → AutomationFlowControl 의 "stuck 정리" 버튼 또는 30분+ 자동 정리에 의존.
 *  - delayMinutes 큰 값(60분+) 도 같은 이유로 컨테이너 재시작에 취약.
 */

import prisma, { WorkflowStatus, StepStatus, StepType } from '@bandauto/db'
import { publishService } from './publish.service'

const CATEGORY_REGEX = /^(SEA|AGR|MEA|MKT|PRC|HLT|ETC)$/

export interface ProcessedJobInput {
  userId: number
  workflowId: number
  productIds: number[]
  retailChannelIds: number[]
  shopIds: number[]
  mode: { individual: boolean; digest: boolean }
  digestMaxImagesPerProduct: 1 | 2 | 4
  delayMinutes: number
  // 디지스트 HTTP 루프백용 — 캡처된 쿠키/베이스URL
  loopback: { baseUrl: string; cookieHeader: string }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function updateStepProgress(
  workflowId: number,
  data: { successCount?: number; failedCount?: number; processedItems?: number; totalItems?: number }
): Promise<void> {
  try {
    await prisma.workflowStepLog.update({
      where: { workflowId_stepType: { workflowId, stepType: StepType.PUBLISH } },
      data,
    })
    // WorkflowLog 의 누적 successCount/failedCount 도 동기화
    if (data.successCount !== undefined || data.failedCount !== undefined) {
      await prisma.workflowLog.update({
        where: { id: workflowId },
        data: {
          ...(data.successCount !== undefined ? { successCount: data.successCount } : {}),
          ...(data.failedCount !== undefined ? { failedCount: data.failedCount } : {}),
        },
      })
    }
  } catch (err) {
    console.error(`[processed-job:${workflowId}] step progress 업데이트 실패`, err)
  }
}

/**
 * 종합발행 — 카테고리별 그룹핑 → 20개씩 청크 → 각 채널에 HTTP 루프백.
 * 한 청크당 하나의 게시글이 만들어지므로 카운트 단위는 "게시글 시도 수".
 */
async function runDigest(input: {
  userId: number
  workflowId: number
  productIds: number[]
  retailChannelIds: number[]
  digestMaxImagesPerProduct: 1 | 2 | 4
  loopback: { baseUrl: string; cookieHeader: string }
}): Promise<{ success: number; failed: number; errors: string[] }> {
  const { userId, productIds, retailChannelIds, digestMaxImagesPerProduct, loopback, workflowId } = input

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, userId },
    select: { id: true, categoryId: true },
  })

  // 카테고리별 그룹핑 (잘못된 카테고리는 ETC 로 폴백)
  const byCategory: Record<string, number[]> = {}
  for (const p of products) {
    const cat = p.categoryId && CATEGORY_REGEX.test(p.categoryId) ? p.categoryId : 'ETC'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(p.id)
  }

  const CHUNK_SIZE = 20
  let success = 0
  let failed = 0
  const errors: string[] = []

  for (const [category, ids] of Object.entries(byCategory)) {
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE)
      for (const channelId of retailChannelIds) {
        try {
          const res = await fetch(`${loopback.baseUrl}/api/publish/digest`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: loopback.cookieHeader,
            },
            body: JSON.stringify({
              categoryId: category,
              productIds: chunk,
              channelId,
              maxImagesPerProduct: digestMaxImagesPerProduct,
            }),
          })
          const json: any = await res.json().catch(() => ({}))
          if (json?.success && json?.result?.status === 'SUCCESS') {
            success += 1
          } else {
            failed += 1
            const msg = json?.result?.message || json?.error || `종합발행 실패 (status=${res.status})`
            errors.push(`[종합:${category}/ch${channelId}] ${msg}`)
          }
        } catch (e: any) {
          failed += 1
          errors.push(`[종합:${category}/ch${channelId}] ${e?.message || '네트워크 오류'}`)
        }
      }
    }
  }

  // 단계 진행률 동기화
  await updateStepProgress(workflowId, {
    successCount: undefined, // 누적은 호출자가 합산
    failedCount: undefined,
  })

  return { success, failed, errors }
}

export async function runProcessedJob(input: ProcessedJobInput): Promise<void> {
  const {
    userId, workflowId, productIds, retailChannelIds, shopIds, mode,
    digestMaxImagesPerProduct, delayMinutes, loopback,
  } = input

  console.log(`[processed-job:${workflowId}] 시작 — products=${productIds.length} retail=${retailChannelIds.length} shops=${shopIds.length} mode=${JSON.stringify(mode)} delay=${delayMinutes}분`)

  let totalSuccess = 0
  let totalFailed = 0
  const allErrors: string[] = []

  try {
    // ── 0) 지연 ──────────────────────────────────────────────────────
    if (delayMinutes > 0) {
      console.log(`[processed-job:${workflowId}] ${delayMinutes}분 지연 대기`)
      await sleep(delayMinutes * 60 * 1000)
    }

    // ── 워크플로우 RUNNING 으로 전환 ──
    await prisma.workflowLog.update({
      where: { id: workflowId },
      data: {
        status: WorkflowStatus.RUNNING,
        currentStep: StepType.PUBLISH,
        startedAt: new Date(),
      },
    })
    await prisma.workflowStepLog.update({
      where: { workflowId_stepType: { workflowId, stepType: StepType.PUBLISH } },
      data: { status: StepStatus.RUNNING, startedAt: new Date() },
    })

    // ── 1) 소매밴드 개별 발행 (mode.individual + retailChannels) ──
    if (mode.individual && retailChannelIds.length > 0) {
      try {
        const res = await publishService.publishMultiChannel({
          userId,
          productIds,
          channelIds: retailChannelIds,
        })
        totalSuccess += res.successCount
        totalFailed += res.failedCount
        // 채널별 errors 수집
        for (const cr of res.channelResults) {
          for (const e of cr.errors || []) {
            allErrors.push(`[밴드:${cr.channelName}] ${e}`)
          }
        }
        await updateStepProgress(workflowId, { successCount: totalSuccess, failedCount: totalFailed })
      } catch (e: any) {
        totalFailed += productIds.length * retailChannelIds.length
        allErrors.push(`[밴드 개별] ${e?.message || '실패'}`)
        await updateStepProgress(workflowId, { successCount: totalSuccess, failedCount: totalFailed })
      }
    }

    // ── 2) 쇼핑몰 개별 발행 (shopIds) ──
    if (shopIds.length > 0) {
      for (const shopId of shopIds) {
        try {
          const res = await publishService.publishShopBatch({
            userId,
            productIds,
            shopId,
          })
          totalSuccess += res.successCount
          totalFailed += res.failedCount
          for (const r of res.results || []) {
            if (!r.success && !r.skipped && r.error) {
              allErrors.push(`[쇼핑몰 ${shopId}] ${r.error}`)
            }
          }
        } catch (e: any) {
          totalFailed += productIds.length
          allErrors.push(`[쇼핑몰 ${shopId}] ${e?.message || '실패'}`)
        }
        await updateStepProgress(workflowId, { successCount: totalSuccess, failedCount: totalFailed })
      }
    }

    // ── 3) 종합발행 (mode.digest + retailChannels) ──
    if (mode.digest && retailChannelIds.length > 0) {
      const digestRes = await runDigest({
        userId,
        workflowId,
        productIds,
        retailChannelIds,
        digestMaxImagesPerProduct,
        loopback,
      })
      totalSuccess += digestRes.success
      totalFailed += digestRes.failed
      for (const e of digestRes.errors) allErrors.push(e)
      await updateStepProgress(workflowId, { successCount: totalSuccess, failedCount: totalFailed })
    }

    // ── 마무리 ──
    const finalStatus: WorkflowStatus =
      totalFailed > 0 && totalSuccess === 0
        ? WorkflowStatus.FAILED
        : totalFailed > 0
          ? WorkflowStatus.PARTIAL_SUCCESS
          : WorkflowStatus.COMPLETED

    const errorMsg = allErrors.slice(0, 10).join('\n') || null

    await prisma.workflowLog.update({
      where: { id: workflowId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        successCount: totalSuccess,
        failedCount: totalFailed,
        errorMessage: errorMsg,
      },
    })
    await prisma.workflowStepLog.update({
      where: { workflowId_stepType: { workflowId, stepType: StepType.PUBLISH } },
      data: {
        status: finalStatus === WorkflowStatus.FAILED ? StepStatus.FAILED : StepStatus.COMPLETED,
        completedAt: new Date(),
        successCount: totalSuccess,
        failedCount: totalFailed,
        processedItems: totalSuccess + totalFailed,
        errorMessage: errorMsg,
      },
    })

    console.log(`[processed-job:${workflowId}] 완료 — status=${finalStatus} success=${totalSuccess} failed=${totalFailed}`)
  } catch (err: any) {
    console.error(`[processed-job:${workflowId}] 치명적 오류`, err)
    try {
      await prisma.workflowLog.update({
        where: { id: workflowId },
        data: {
          status: WorkflowStatus.FAILED,
          completedAt: new Date(),
          successCount: totalSuccess,
          failedCount: totalFailed,
          errorMessage: err?.message || '백그라운드 잡 치명적 오류',
        },
      })
      await prisma.workflowStepLog.update({
        where: { workflowId_stepType: { workflowId, stepType: StepType.PUBLISH } },
        data: {
          status: StepStatus.FAILED,
          completedAt: new Date(),
          successCount: totalSuccess,
          failedCount: totalFailed,
          errorMessage: err?.message || '백그라운드 잡 치명적 오류',
        },
      })
    } catch (e) {
      console.error(`[processed-job:${workflowId}] 실패 상태 기록도 실패`, e)
    }
  }
}
