/**
 * Automation Module
 *
 * 자동화 워크플로우 모듈
 * - 게시물 수집 → AI 변환 → 소매밴드 발행 파이프라인
 *
 * @example Basic Usage
 * ```typescript
 * import { executeFullPipeline, getAutomationStats } from '@/modules/automation'
 *
 * // 전체 파이프라인 실행
 * const result = await executeFullPipeline(userId)
 * console.log(result.overallStatus)
 *
 * // 통계 조회
 * const stats = await getAutomationStats(userId)
 * console.log(stats.todayCollected, stats.pendingTransform)
 * ```
 *
 * @example Individual Pipeline
 * ```typescript
 * import {
 *   executeCollectionPipeline,
 *   executeTransformPipeline,
 *   executePublishPipeline
 * } from '@/modules/automation'
 *
 * // 수집만 실행
 * const collectionResult = await executeCollectionPipeline(userId)
 *
 * // 변환만 실행
 * const transformResult = await executeTransformPipeline(userId)
 *
 * // 발행만 실행
 * const publishResult = await executePublishPipeline(userId, {
 *   retailBandIds: [1, 2, 3]
 * })
 * ```
 */

// Types
export type {
  BatchContext,
  PipelineResult,
  PipelineError,
  CollectionConfig,
  CollectionResult,
  BandCollectionResult,
  TransformConfig,
  TransformResult,
  TransformedPost,
  PublishConfig,
  PublishResult,
  PublishedProduct,
  BandPublishResult,
  FullPipelineConfig,
  FullPipelineResult,
  WorkflowLogInput,
  WorkflowLogUpdate,
  AutomationStats,
  CronInterval,
} from './types'

export {
  CRON_EXPRESSIONS,
  INTERVAL_LABELS,
} from './types'

// Context
export {
  setBatchContext,
  getBatchContext,
  clearBatchContext,
  createBatchContextFromUserId,
  getActiveAutomationContexts,
  withBatchContext,
  withUserContext,
} from './context'

// Workflow Service
export {
  createWorkflowLog,
  updateWorkflowLog,
  completeWorkflowLog,
  failWorkflowLog,
  getAutomationStats,
  getRecentWorkflowLogs,
  getWorkflowLogsByType,
  getRunningWorkflow,
  getDailyWorkflowStats,
} from './workflow-service'

// Pipeline Executors
export {
  executeCollectionPipeline,
  executeTransformPipeline,
  executePublishPipeline,
  executeFullPipeline,
} from './executor'

// Individual Pipelines (for advanced usage)
export { runCollectionPipeline } from './pipelines/collection'
export { runTransformPipeline } from './pipelines/transform'
export { runPublishPipeline } from './pipelines/publish'

// Scheduler
export {
  initializeScheduler,
  registerScheduler,
  unregisterScheduler,
  updateScheduler,
  stopAllSchedulers,
  getActiveSchedulers,
} from './scheduler'
