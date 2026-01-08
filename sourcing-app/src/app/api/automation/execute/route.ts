export const dynamic = 'force-dynamic'

/**
 * Automation Execute API
 * 자동화 파이프라인 수동 실행
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { WorkflowType, TriggerType } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import {
  executeCollectionPipeline,
  executeTransformPipeline,
  executeProductCreatePipeline,
  executePublishPipeline,
  executeFullPipelineWithLock,
  getRunningWorkflow,
  cancelWorkflow,
  cleanupStaleWorkflows,
  PipelineResult,
  FullPipelineResult,
  CollectionResult,
  TransformResult,
  ProductCreateResult,
  PublishResult,
} from '@/modules/automation'
import {
  createCollectNotification,
  createTransformNotification,
  createPublishNotification,
  createErrorNotification,
  createInfoNotification,
} from '@/services/notification.service'

/**
 * 에러 요약 인터페이스
 */
interface ErrorSummaryItem {
  item?: string | number
  message: string
  stage?: string
}

/**
 * 구조화된 API 응답 데이터
 */
interface ExecuteResponseData {
  workflowId?: number
  overallStatus?: string
  totalItems: number
  successCount: number
  failedCount: number
  errorSummary: ErrorSummaryItem[]
  stages: {
    collection?: StageResult
    transform?: StageResult
    productCreate?: StageResult
    publish?: StageResult
  }
}

interface StageResult {
  success: boolean
  totalItems: number
  successCount: number
  failedCount: number
  message: string
}

/**
 * 파이프라인 결과에서 에러 요약 추출
 */
function extractErrorSummary(
  result: PipelineResult | FullPipelineResult,
  type: 'collect' | 'transform' | 'register' | 'publish' | 'full'
): ErrorSummaryItem[] {
  const errors: ErrorSummaryItem[] = []

  if ('errors' in result && Array.isArray(result.errors)) {
    // 단일 파이프라인 결과
    errors.push(
      ...result.errors.slice(0, 5).map((e) => ({
        item: e.itemId,
        message: e.message,
        stage: type,
      }))
    )
  }

  if ('collection' in result && result.collection?.errors) {
    errors.push(
      ...result.collection.errors.slice(0, 3).map((e) => ({
        item: e.itemId,
        message: e.message,
        stage: 'collection',
      }))
    )
  }

  if ('transform' in result && result.transform?.errors) {
    errors.push(
      ...result.transform.errors.slice(0, 3).map((e) => ({
        item: e.itemId,
        message: e.message,
        stage: 'transform',
      }))
    )
  }

  if ('productCreate' in result && result.productCreate?.errors) {
    errors.push(
      ...result.productCreate.errors.slice(0, 3).map((e) => ({
        item: e.itemId,
        message: e.message,
        stage: 'productCreate',
      }))
    )
  }

  if ('publish' in result && result.publish?.errors) {
    errors.push(
      ...result.publish.errors.slice(0, 3).map((e) => ({
        item: e.itemId,
        message: e.message,
        stage: 'publish',
      }))
    )
  }

  return errors.slice(0, 10) // 최대 10개 에러
}

/**
 * 단계별 결과 생성
 */
function createStageResult(result: PipelineResult | undefined, stageName: string): StageResult | undefined {
  if (!result) return undefined

  return {
    success: result.success,
    totalItems: result.totalItems,
    successCount: result.successCount,
    failedCount: result.failedCount,
    message: result.success
      ? `${stageName} 완료: ${result.successCount}건 성공`
      : `${stageName} 실패: ${result.failedCount}건 실패 (${result.successCount}건 성공)`,
  }
}

/**
 * 파이프라인 결과에 따른 알림 생성
 */
async function createPipelineNotificationInternal(
  userId: number,
  type: 'collect' | 'transform' | 'register' | 'publish' | 'full',
  result: PipelineResult | FullPipelineResult,
  workflowId?: number
): Promise<void> {
  try {
    // FullPipelineResult는 failedCount가 없으므로 type guard 사용
    const hasErrors = 'failedCount' in result && result.failedCount > 0

    switch (type) {
      case 'collect':
        const collectResult = result as CollectionResult
        if (collectResult.successCount > 0 || collectResult.totalItems > 0) {
          // 수집된 채널 정보 추출
          const channelNames = collectResult.details?.channelResults
            ?.map((ch: any) => ch.channelName)
            .filter(Boolean)
            .join(', ') || ''

          await createCollectNotification(userId, {
            channelName: channelNames,
            collectCount: collectResult.successCount,
            workflowRunId: workflowId,
          })
        }

        // 에러가 있으면 오류 알림도 생성
        if (hasErrors) {
          await createErrorNotification(userId, {
            errorType: '수집',
            errorMessage: `${collectResult.failedCount}개 채널에서 수집 실패`,
            workflowRunId: workflowId,
          })
        }
        break

      case 'transform':
        const transformResult = result as TransformResult
        if (transformResult.totalItems > 0) {
          await createTransformNotification(userId, {
            productCount: transformResult.totalItems,
            successCount: transformResult.successCount,
            failCount: transformResult.failedCount,
            workflowRunId: workflowId,
          })
        }

        if (hasErrors && transformResult.failedCount > 3) {
          // 3개 이상 실패 시 오류 알림
          await createErrorNotification(userId, {
            errorType: 'AI변환',
            errorMessage: `${transformResult.failedCount}개 상품 변환 실패`,
            workflowRunId: workflowId,
          })
        }
        break

      case 'register':
        const registerResult = result as ProductCreateResult
        if (registerResult.successCount > 0) {
          await createInfoNotification(
            userId,
            '상품 등록이 완료되었습니다',
            `${registerResult.successCount}개 상품 등록 완료${registerResult.failedCount > 0 ? ` (${registerResult.failedCount}개 실패)` : ''}`,
            '/sourcing/automation/logs'
          )
        }

        if (hasErrors && registerResult.failedCount > 3) {
          await createErrorNotification(userId, {
            errorType: '상품등록',
            errorMessage: `${registerResult.failedCount}개 상품 등록 실패`,
            workflowRunId: workflowId,
          })
        }
        break

      case 'publish':
        const publishResult = result as PublishResult
        if (publishResult.successCount > 0 || publishResult.totalItems > 0) {
          // 발행된 채널 정보 추출
          const publishChannelNames = publishResult.details?.channelResults
            ?.map((ch: any) => ch.channelName)
            .filter(Boolean)
            .join(', ') || ''

          await createPublishNotification(userId, {
            shopName: publishChannelNames,
            productCount: publishResult.totalItems,
            successCount: publishResult.successCount,
            failCount: publishResult.failedCount,
            workflowRunId: workflowId,
          })
        }

        if (hasErrors && publishResult.failedCount > 0) {
          await createErrorNotification(userId, {
            errorType: '발행',
            errorMessage: `${publishResult.failedCount}개 상품 발행 실패`,
            workflowRunId: workflowId,
          })
        }
        break

      case 'full':
        const fullResult = result as FullPipelineResult
        // 전체 파이프라인은 각 단계별로 알림 생성
        if (fullResult.collection) {
          await createPipelineNotificationInternal(userId, 'collect', fullResult.collection, workflowId)
        }
        if (fullResult.transform) {
          await createPipelineNotificationInternal(userId, 'transform', fullResult.transform, workflowId)
        }
        if (fullResult.productCreate) {
          await createPipelineNotificationInternal(userId, 'register', fullResult.productCreate, workflowId)
        }
        if (fullResult.publish) {
          await createPipelineNotificationInternal(userId, 'publish', fullResult.publish, workflowId)
        }

        // 전체 완료 정보 알림
        const totalSuccess = (fullResult.collection?.successCount || 0) +
          (fullResult.transform?.successCount || 0) +
          (fullResult.productCreate?.successCount || 0) +
          (fullResult.publish?.successCount || 0)
        const totalFailed = (fullResult.collection?.failedCount || 0) +
          (fullResult.transform?.failedCount || 0) +
          (fullResult.productCreate?.failedCount || 0) +
          (fullResult.publish?.failedCount || 0)

        if (totalSuccess > 0 || totalFailed > 0) {
          await createInfoNotification(
            userId,
            '전체 파이프라인 실행 완료',
            `수집→변환→등록→발행 완료 (성공: ${totalSuccess}, 실패: ${totalFailed})`,
            '/sourcing/automation/logs'
          )
        }
        break
    }
  } catch (error) {
    console.error('[Notification] 알림 생성 중 오류:', error)
    // 알림 생성 실패가 전체 파이프라인 결과에 영향을 주지 않도록 에러를 무시
  }
}

/**
 * 전체 파이프라인 응답 생성
 */
function buildFullPipelineResponse(result: FullPipelineResult): ExecuteResponseData {
  const totalItems =
    (result.collection?.totalItems || 0) +
    (result.transform?.totalItems || 0) +
    (result.productCreate?.totalItems || 0) +
    (result.publish?.totalItems || 0)

  const successCount =
    (result.collection?.successCount || 0) +
    (result.transform?.successCount || 0) +
    (result.productCreate?.successCount || 0) +
    (result.publish?.successCount || 0)

  const failedCount =
    (result.collection?.failedCount || 0) +
    (result.transform?.failedCount || 0) +
    (result.productCreate?.failedCount || 0) +
    (result.publish?.failedCount || 0)

  return {
    overallStatus: result.overallStatus,
    totalItems,
    successCount,
    failedCount,
    errorSummary: extractErrorSummary(result, 'full'),
    stages: {
      collection: createStageResult(result.collection, '게시물 수집'),
      transform: createStageResult(result.transform, 'AI 변환'),
      productCreate: createStageResult(result.productCreate, '상품 등록'),
      publish: createStageResult(result.publish, '발행'),
    },
  }
}

/**
 * 단일 파이프라인 응답 생성
 */
function buildSinglePipelineResponse(
  result: PipelineResult,
  type: 'collect' | 'transform' | 'register' | 'publish'
): ExecuteResponseData {
  const stageNames: Record<string, string> = {
    collect: '게시물 수집',
    transform: 'AI 변환',
    register: '상품 등록',
    publish: '발행',
  }

  return {
    totalItems: result.totalItems,
    successCount: result.successCount,
    failedCount: result.failedCount,
    errorSummary: extractErrorSummary(result, type),
    stages: {
      [type === 'register' ? 'productCreate' : type]: createStageResult(result, stageNames[type]),
    },
  }
}

/**
 * 자동화 설정 검증 결과
 */
interface ConfigValidationResult {
  isValid: boolean
  error?: string
  missingItems: string[]
}

/**
 * 파이프라인 실행 전 설정 검증
 */
async function validateAutomationConfig(
  userId: number,
  type: 'collect' | 'transform' | 'register' | 'publish' | 'full'
): Promise<ConfigValidationResult> {
  const automationConfig = await prisma.automationConfig.findUnique({
    where: { userId },
  })

  const missingItems: string[] = []

  // 자동화 설정 자체가 없는 경우
  if (!automationConfig) {
    return {
      isValid: false,
      error: '자동화 설정이 없습니다. 먼저 설정 페이지에서 기본 설정을 완료해주세요.',
      missingItems: ['자동화 설정'],
    }
  }

  // 수집(collect) 검증
  if (type === 'collect' || type === 'full') {
    let channelIds: number[] = []
    if (automationConfig.channelIds) {
      try {
        channelIds = JSON.parse(automationConfig.channelIds)
      } catch {
        channelIds = []
      }
    }
    if (channelIds.length === 0) {
      missingItems.push('수집할 도매채널')
    }
  }

  // 변환(transform) 및 상품등록(register) 검증
  if (type === 'transform' || type === 'register' || type === 'full') {
    if (!automationConfig.aiProvider) {
      missingItems.push('AI 제공자')
    }
  }

  // 발행(publish) 검증
  if (type === 'publish' || type === 'full') {
    let retailChannelIds: number[] = []
    if (automationConfig.retailChannelIds) {
      try {
        retailChannelIds = JSON.parse(automationConfig.retailChannelIds)
      } catch {
        retailChannelIds = []
      }
    }
    if (retailChannelIds.length === 0) {
      missingItems.push('발행할 소매채널')
    }
  }

  if (missingItems.length > 0) {
    const typeNames: Record<string, string> = {
      collect: '게시물 수집',
      transform: 'AI 변환',
      register: '상품 등록',
      publish: '발행',
      full: '전체 실행',
    }
    return {
      isValid: false,
      error: `${typeNames[type]}을 실행하려면 다음 설정이 필요합니다: ${missingItems.join(', ')}. 설정 페이지에서 먼저 설정해주세요.`,
      missingItems,
    }
  }

  return { isValid: true, missingItems: [] }
}

/**
 * 세션 검증 결과
 */
interface SessionValidationResult {
  isValid: boolean
  invalidChannels: Array<{
    id: number
    name: string
    kind: 'WHOLESALE' | 'RETAIL'
  }>
}

/**
 * 밴드 세션 유효성 검증
 */
async function validateBandSessions(
  userId: number,
  type: 'collect' | 'transform' | 'register' | 'publish' | 'full'
): Promise<SessionValidationResult> {
  const automationConfig = await prisma.automationConfig.findUnique({
    where: { userId },
  })

  if (!automationConfig) {
    return { isValid: true, invalidChannels: [] }
  }

  const channelIdsToCheck: number[] = []

  // 소매채널(발행용)만 세션 검증 필요 (도매채널은 세션 불필요)
  if (type === 'publish' || type === 'full') {
    if (automationConfig.retailChannelIds) {
      try {
        const ids = JSON.parse(automationConfig.retailChannelIds)
        channelIdsToCheck.push(...ids)
      } catch {
        // ignore
      }
    }
  }

  if (channelIdsToCheck.length === 0) {
    return { isValid: true, invalidChannels: [] }
  }

  // 채널 세션 정보 조회
  const channels = await prisma.channel.findMany({
    where: { id: { in: channelIdsToCheck } },
    select: {
      id: true,
      name: true,
      kind: true,
      bandSessionCookie: true,
      sessionExpiresAt: true,
    },
  })

  const now = new Date()
  const invalidChannels = channels
    .filter((channel) => {
      const hasSession = !!channel.bandSessionCookie
      const isExpired = channel.sessionExpiresAt
        ? new Date(channel.sessionExpiresAt) <= now
        : true
      return !hasSession || isExpired
    })
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      kind: channel.kind as 'WHOLESALE' | 'RETAIL',
    }))

  return {
    isValid: invalidChannels.length === 0,
    invalidChannels,
  }
}

/**
 * POST /api/automation/execute
 * 파이프라인 수동 실행
 *
 * Request Body:
 * - type: 'collect' | 'transform' | 'register' | 'publish' | 'full'
 * - config?: 파이프라인별 추가 설정
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { type, config } = body

    if (!type) {
      return NextResponse.json(
        { success: false, error: '실행 타입이 필요합니다.' },
        { status: 400 }
      )
    }

    // 이미 실행 중인 워크플로우 확인
    const running = await getRunningWorkflow(currentUser.userId)
    if (running) {
      return NextResponse.json(
        {
          success: false,
          error: '이미 실행 중인 워크플로우가 있습니다. 완료될 때까지 기다려주세요.',
          runningWorkflow: {
            id: running.id,
            type: running.workflowType,
            startedAt: running.startedAt,
          },
        },
        { status: 409 }
      )
    }

    // 설정 검증 (config가 명시적으로 제공된 경우는 검증 스킵)
    const hasExplicitConfig = type === 'collect' ? config?.channelIds?.length > 0 :
                             type === 'publish' ? config?.channelIds?.length > 0 :
                             false

    if (!hasExplicitConfig) {
      const validation = await validateAutomationConfig(currentUser.userId, type)
      if (!validation.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: validation.error,
            missingItems: validation.missingItems,
          },
          { status: 400 }
        )
      }
    }

    // 밴드 세션 유효성 검증 (발행 시 필요 - 소매채널만)
    if (type === 'publish' || type === 'full') {
      const sessionValidation = await validateBandSessions(currentUser.userId, type)
      if (!sessionValidation.isValid) {
        // 세션 없음 알림 생성
        const channelNames = sessionValidation.invalidChannels.map((ch) => ch.name).join(', ')
        await createErrorNotification(currentUser.userId, {
          errorType: '밴드 세션',
          errorMessage: `${sessionValidation.invalidChannels.length}개 채널(${channelNames})의 밴드 세션이 없거나 만료되었습니다. Band Session Helper 확장을 사용하여 세션을 저장해주세요.`,
        })

        return NextResponse.json(
          {
            success: false,
            error: `밴드 세션이 없거나 만료된 채널이 있습니다: ${channelNames}`,
            invalidChannels: sessionValidation.invalidChannels,
            errorType: 'SESSION_MISSING',
          },
          { status: 400 }
        )
      }
    }

    let result: PipelineResult | FullPipelineResult | null
    let responseData: ExecuteResponseData

    switch (type) {
      case 'collect':
        console.log(`[Execute] Collection for user ${currentUser.userId}`)
        result = await executeCollectionPipeline(currentUser.userId, config)
        responseData = buildSinglePipelineResponse(result as PipelineResult, 'collect')
        // 수집 완료 알림 생성
        await createPipelineNotificationInternal(currentUser.userId, 'collect', result as PipelineResult, responseData.workflowId)
        break

      case 'transform':
        console.log(`[Execute] Transform for user ${currentUser.userId}`)
        result = await executeTransformPipeline(currentUser.userId, config)
        responseData = buildSinglePipelineResponse(result as PipelineResult, 'transform')
        // AI 변환 완료 알림 생성
        await createPipelineNotificationInternal(currentUser.userId, 'transform', result as PipelineResult, responseData.workflowId)
        break

      case 'register':
        // register는 CollectedProduct에서 Product를 생성하는 파이프라인
        console.log(`[Execute] Product Create for user ${currentUser.userId}`)
        result = await executeProductCreatePipeline(currentUser.userId, config)
        responseData = buildSinglePipelineResponse(result as PipelineResult, 'register')
        // 상품 등록 완료 알림 생성
        await createPipelineNotificationInternal(currentUser.userId, 'register', result as PipelineResult, responseData.workflowId)
        break

      case 'publish':
        console.log(`[Execute] Publish for user ${currentUser.userId}`)
        result = await executePublishPipeline(currentUser.userId, config)
        responseData = buildSinglePipelineResponse(result as PipelineResult, 'publish')
        // 발행 완료 알림 생성
        await createPipelineNotificationInternal(currentUser.userId, 'publish', result as PipelineResult, responseData.workflowId)
        break

      case 'full':
        console.log(`[Execute] Full pipeline for user ${currentUser.userId}`)
        // Lock 기반 실행으로 중복 실행 방지
        result = await executeFullPipelineWithLock(currentUser.userId, config, TriggerType.MANUAL)

        if (!result) {
          return NextResponse.json(
            {
              success: false,
              error: '이미 실행 중인 워크플로우가 있습니다. 완료될 때까지 기다려주세요.',
            },
            { status: 409 }
          )
        }

        responseData = buildFullPipelineResponse(result as FullPipelineResult)
        // 전체 파이프라인 알림은 executor.ts의 createPipelineNotification에서 생성됨 (중복 방지)
        break

      default:
        return NextResponse.json(
          { success: false, error: '잘못된 실행 타입입니다.' },
          { status: 400 }
        )
    }

    // 성공 여부 판단 (failedCount가 있더라도 일부 성공하면 success: true)
    const isSuccess = responseData.successCount > 0 || responseData.failedCount === 0

    return NextResponse.json({
      success: isSuccess,
      data: responseData,
      // 에러가 있을 경우 최상위에 에러 메시지 추가
      ...(responseData.errorSummary.length > 0 && {
        error: `일부 항목 처리 중 오류 발생: ${responseData.errorSummary[0]?.message}`,
      }),
    })
  } catch (error: any) {
    console.error('파이프라인 실행 실패:', error)

    // 예외 발생 시 오류 알림 생성 (currentUser가 있을 경우에만)
    const currentUser = await getCurrentUser()
    if (currentUser) {
      await createErrorNotification(currentUser.userId, {
        errorType: '파이프라인',
        errorMessage: error.message || '파이프라인 실행 중 오류가 발생했습니다.',
      })
    }

    return NextResponse.json(
      { success: false, error: error.message || '파이프라인 실행에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/automation/execute
 * 현재 실행 중인 워크플로우 상태 조회
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const running = await getRunningWorkflow(currentUser.userId)

    if (!running) {
      return NextResponse.json({
        success: true,
        data: {
          isRunning: false,
          workflow: null,
        },
      })
    }

    // 단계별 로그 조회
    const steps = await prisma.workflowStepLog.findMany({
      where: { workflowId: running.id },
      orderBy: { stepOrder: 'asc' },
    })

    // 현재 단계 - WorkflowLog.currentStep 또는 RUNNING 상태인 단계
    const currentStage = running.currentStep ||
      steps.find(s => s.status === 'RUNNING')?.stepType ||
      null

    // StepType을 camelCase 키로 변환
    const stepTypeToKey: Record<string, string> = {
      'COLLECTION': 'collection',
      'TRANSFORM': 'transform',
      'PRODUCT_CREATE': 'productCreate',
      'PUBLISH': 'publish',
    }

    // 단계별 진행 상태
    const stageProgress: Record<string, any> = {}
    for (const step of steps) {
      const key = stepTypeToKey[step.stepType] || step.stepType.toLowerCase()
      const stepDetails = step.details ? JSON.parse(step.details as string) : null

      stageProgress[key] = {
        status: step.status,
        completed: step.status === 'COMPLETED' || step.status === 'SKIPPED',
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        duration: step.startedAt && step.completedAt
          ? step.completedAt.getTime() - step.startedAt.getTime()
          : null,
        totalItems: step.totalItems,
        processedItems: step.processedItems,
        successCount: step.successCount,
        failedCount: step.failedCount,
        progress: step.totalItems > 0
          ? Math.round((step.processedItems / step.totalItems) * 100)
          : 0,
        errorMessage: step.errorMessage,
        // 기존 details 호환성을 위한 추가 정보
        ...(stepDetails || {}),
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        isRunning: true,
        workflow: {
          id: running.id,
          type: running.workflowType,
          status: running.status,
          startedAt: running.startedAt,
          totalItems: running.totalItems,
          successCount: running.successCount,
          failedCount: running.failedCount,
          currentStage: currentStage ? stepTypeToKey[currentStage] || currentStage.toLowerCase() : null,
          stageProgress,
          steps: steps.map(s => ({
            stepType: stepTypeToKey[s.stepType] || s.stepType.toLowerCase(),
            stepOrder: s.stepOrder,
            status: s.status,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
            totalItems: s.totalItems,
            processedItems: s.processedItems,
            successCount: s.successCount,
            failedCount: s.failedCount,
            progress: s.totalItems > 0
              ? Math.round((s.processedItems / s.totalItems) * 100)
              : 0,
          })),
        },
      },
    })
  } catch (error) {
    console.error('실행 상태 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '상태 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/automation/execute
 * 실행 중인 워크플로우 취소
 *
 * Query Params:
 * - workflowId: 취소할 워크플로우 ID (없으면 현재 실행 중인 워크플로우 취소)
 * - cleanup: 'true'인 경우 오래된 stuck 워크플로우 정리
 */
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const workflowIdParam = searchParams.get('workflowId')
    const cleanup = searchParams.get('cleanup') === 'true'

    // 오래된 워크플로우 정리 모드
    if (cleanup) {
      const cleanedCount = await cleanupStaleWorkflows(currentUser.userId, 30)
      return NextResponse.json({
        success: true,
        data: {
          cleanedCount,
          message: cleanedCount > 0
            ? `${cleanedCount}개의 오래된 워크플로우가 정리되었습니다.`
            : '정리할 워크플로우가 없습니다.',
        },
      })
    }

    // 특정 워크플로우 취소
    let workflowId: number | null = null

    if (workflowIdParam) {
      workflowId = parseInt(workflowIdParam, 10)
      if (isNaN(workflowId)) {
        return NextResponse.json(
          { success: false, error: '잘못된 워크플로우 ID입니다.' },
          { status: 400 }
        )
      }
    } else {
      // 현재 실행 중인 워크플로우 찾기
      const running = await getRunningWorkflow(currentUser.userId)
      if (!running) {
        return NextResponse.json(
          { success: false, error: '실행 중인 워크플로우가 없습니다.' },
          { status: 404 }
        )
      }
      workflowId = running.id
    }

    const cancelled = await cancelWorkflow(workflowId, currentUser.userId)

    if (!cancelled) {
      return NextResponse.json(
        { success: false, error: '워크플로우를 취소할 수 없습니다. 이미 완료되었거나 존재하지 않습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        workflowId,
        message: '워크플로우가 취소되었습니다.',
      },
    })
  } catch (error) {
    console.error('워크플로우 취소 실패:', error)
    return NextResponse.json(
      { success: false, error: '워크플로우 취소에 실패했습니다.' },
      { status: 500 }
    )
  }
}
