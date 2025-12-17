/**
 * 자동화 파이프라인 알림 생성 헬퍼
 * 파이프라인 완료 후 성공/실패 알림 생성
 */

import prisma from '@bandauto/db'
import { WorkflowStatus } from '@bandauto/db'
import { FullPipelineResult } from './types'

interface PipelineNotificationParams {
  result: FullPipelineResult
  workflowLogId?: number
  errorMessage?: string
}

/**
 * 파이프라인 실행 결과에 따른 알림 생성
 * 성공/일부성공/실패 상태에 따라 적절한 알림 생성
 */
export async function createPipelineNotification(
  params: PipelineNotificationParams
): Promise<void> {
  const { result, workflowLogId, errorMessage } = params

  try {
    const isSuccess = result.overallStatus === WorkflowStatus.COMPLETED
    const isPartialSuccess = result.overallStatus === WorkflowStatus.PARTIAL_SUCCESS
    const isFailed = result.overallStatus === WorkflowStatus.FAILED

    // 각 단계별 카운트 집계
    const collectCount = result.collection?.successCount || 0
    const transformCount = result.transform?.successCount || 0
    const productCreateCount = result.productCreate?.successCount || 0
    const publishCount = result.publish?.successCount || 0

    const totalSuccess = collectCount + transformCount + productCreateCount + publishCount
    const totalFailed =
      (result.collection?.failedCount || 0) +
      (result.transform?.failedCount || 0) +
      (result.productCreate?.failedCount || 0) +
      (result.publish?.failedCount || 0)

    // 알림 제목 및 타입 결정
    let title: string
    let type: 'COLLECT' | 'TRANSFORM' | 'PUBLISH' | 'ERROR' | 'INFO'

    if (isSuccess) {
      title = '자동화 파이프라인 완료'
      type = 'INFO'
    } else if (isPartialSuccess) {
      title = '자동화 파이프라인 일부 완료'
      type = 'INFO'
    } else {
      title = '자동화 파이프라인 실패'
      type = 'ERROR'
    }

    // 메시지 구성
    let message = ''

    if (isSuccess || isPartialSuccess) {
      // 성공/일부성공 시 각 단계별 결과 표시
      const parts: string[] = []

      if (result.collection) {
        parts.push(`수집 ${result.collection.successCount}건`)
      }
      if (result.transform) {
        parts.push(`변환 ${result.transform.successCount}건`)
      }
      if (result.productCreate) {
        parts.push(`상품생성 ${result.productCreate.successCount}건`)
      }
      if (result.publish) {
        parts.push(`발행 ${result.publish.successCount}건`)
      }

      message = parts.join(', ')

      if (totalFailed > 0) {
        message += ` (실패 ${totalFailed}건)`
      }
    } else {
      // 실패 시 에러 메시지 포함
      if (errorMessage) {
        message = errorMessage
      } else {
        // 각 단계별 실패 사유 확인
        const failureReasons: string[] = []

        // Collection: channelResults에서 에러 추출
        if (result.collection?.failedCount) {
          const channelErrors = result.collection.details?.channelResults
            ?.filter((ch) => ch.errors && ch.errors.length > 0)
            .flatMap((ch) => ch.errors) || []
          if (channelErrors.length > 0) {
            failureReasons.push(`수집 실패: ${channelErrors[0]}`)
          }
        }

        // Transform: transformedPosts에서 실패 항목 추출
        if (result.transform?.failedCount) {
          const failedItems = result.transform.details?.transformedPosts?.filter(
            (p) => p.status === 'failed'
          ) || []
          if (failedItems.length > 0) {
            failureReasons.push(`변환 실패: ${failedItems[0]?.error || '알 수 없는 오류'}`)
          }
        }

        // ProductCreate: createdProducts에서 실패 항목 추출
        if (result.productCreate?.failedCount) {
          const failedItems = result.productCreate.details?.createdProducts?.filter(
            (p) => p.status === 'failed'
          ) || []
          if (failedItems.length > 0) {
            failureReasons.push(`상품생성 실패: ${failedItems[0]?.error || '알 수 없는 오류'}`)
          }
        }

        // Publish: publishedProducts에서 실패 항목 추출 (status: 'FAILED')
        if (result.publish?.failedCount) {
          const failedItems = result.publish.details?.publishedProducts?.filter(
            (p) => p.status === 'FAILED'
          ) || []
          if (failedItems.length > 0) {
            failureReasons.push(`발행 실패: ${failedItems[0]?.error || '알 수 없는 오류'}`)
          }
        }

        message = failureReasons.length > 0
          ? failureReasons.join(', ')
          : '작업 중 오류가 발생했습니다.'
      }
    }

    // 알림 생성
    await prisma.notification.create({
      data: {
        section: 'sourcing',
        type,
        title,
        message,
        link: '/sourcing/automation/logs',
      },
    })

    console.log(`[PipelineNotification] Created notification: ${title}`)
  } catch (error) {
    console.error('[PipelineNotification] 알림 생성 실패:', error)
    // 알림 생성 실패해도 파이프라인 결과에는 영향을 주지 않음
  }
}

/**
 * 단일 파이프라인 (수집/변환/발행) 실패 알림 생성
 */
export async function createSinglePipelineErrorNotification(
  pipelineType: 'COLLECT' | 'TRANSFORM' | 'PUBLISH',
  errorMessage: string,
  workflowLogId?: number
): Promise<void> {
  const typeLabels = {
    COLLECT: '수집',
    TRANSFORM: 'AI 변환',
    PUBLISH: '발행',
  }

  try {
    await prisma.notification.create({
      data: {
        section: 'sourcing',
        type: 'ERROR',
        title: `${typeLabels[pipelineType]} 작업 실패`,
        message: errorMessage,
        link: '/sourcing/automation/logs',
      },
    })
  } catch (error) {
    console.error(`[PipelineNotification] ${typeLabels[pipelineType]} 실패 알림 생성 실패:`, error)
  }
}
