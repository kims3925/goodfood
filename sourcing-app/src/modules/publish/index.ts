/**
 * Publish Module
 * 상품 발행 서비스 모듈
 *
 * 이 모듈은 상품을 소매채널(Band 등)에 발행하는 핵심 로직을 제공합니다.
 *
 * 사용처:
 * - 발행 페이지 API (/api/shop/publish)
 * - 자동화 파이프라인 (automation/pipelines/publish.ts)
 */

export { PublishService, publishService } from './publish.service'
export type {
  PublishToChannelParams,
  PublishToChannelResult,
  PublishBatchParams,
  PublishBatchResult,
  PublishMultiChannelParams,
  PublishMultiChannelResult,
  ProductForPublish,
  ChannelForPublish,
} from './types'
