/**
 * SourcingAgent — 상품 수집 에이전트
 *
 * 역할:
 *  1. 1시간 주기로 도매 채널에서 상품 자동 수집
 *  2. 수동 수집 요청 처리
 *  3. 세션 갱신 후 대기 중이던 수집 재시도
 *
 * 구독 이벤트:
 *  - schedule.sourcing.collect    : 1시간 주기 자동 수집
 *  - sourcing.collect.requested   : 수동 수집 요청 (payload: { channelId, limit })
 *  - band.session.renewed         : 세션 갱신 후 즉시 수집 재시도
 *
 * 발행 이벤트:
 *  - product.collected            : 수집 완료 (payload: { postIds[], channelId })
 *  - sourcing.quota.reached       : 일일 수집 한도 도달
 *  - sourcing.error               : 수집 실패
 */

import prisma from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer, type AgentEvent, type AgentResult } from '../types'
import {
  executeCollectionPipeline,
  createBatchContextFromUserId,
  setBatchContext,
} from '@/modules/automation'

export class SourcingAgent extends AgentBase {
  readonly name = 'sourcing-agent'
  readonly layer = AgentLayer.SOURCING

  getSubscribedEvents(): string[] {
    return [
      'schedule.sourcing.collect',
      'sourcing.collect.requested',
      'band.session.renewed',
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

      switch (event.type) {
        case 'schedule.sourcing.collect': {
          const result = await this.collectAll()
          return {
            success: true,
            data: result as unknown as Record<string, unknown>,
            duration: Date.now() - start,
          }
        }

        case 'sourcing.collect.requested': {
          const channelId = event.data.channelId as number
          const limit = event.data.limit as number | undefined
          const userId = event.data.userId as number | undefined
          const result = await this.collectFromChannel(channelId, limit, userId)
          return {
            success: result.success,
            data: result as unknown as Record<string, unknown>,
            duration: Date.now() - start,
          }
        }

        case 'band.session.renewed': {
          const channelId = event.data.channelId as number | undefined
          if (channelId) {
            await this.log('INFO', `세션 갱신 감지 — 채널 ${channelId} 수집 재시도`)
            const result = await this.collectFromChannel(channelId)
            return {
              success: result.success,
              data: result as unknown as Record<string, unknown>,
              duration: Date.now() - start,
            }
          }
          return { success: true, duration: Date.now() - start }
        }

        default:
          return { success: false, error: `알 수 없는 이벤트: ${event.type}`, duration: Date.now() - start }
      }
    } catch (error: any) {
      await this.log('ERROR', `수집 중 오류 발생: ${error.message}`)
      await this.emitEvent('sourcing.error', { error: error.message }, 'HIGH')
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  // ─── 스케줄 실행 (onSchedule 오버라이드) ───
  async onSchedule(): Promise<void> {
    await this.log('INFO', '정기 수집 시작')
    await this.collectAll()
  }

  // ══════════════════════════════════════════════════
  //  SKILL 1: 채널별 수집
  // ══════════════════════════════════════════════════

  /**
   * 특정 채널에서 상품을 수집합니다.
   * 실제 수집은 executeCollectionPipeline에 위임합니다.
   */
  async collectFromChannel(
    channelId: number,
    limit?: number,
    userId?: number
  ): Promise<{ success: boolean; channelId: number; postIds: number[]; error?: string }> {
    try {
      await this.log('INFO', `채널 ${channelId} 수집 시작`, { limit })

      // 채널 정보 조회
      const channel = await prisma.channel.findFirst({
        where: {
          id: channelId,
          kind: 'WHOLESALE',
          deletedAt: null,
          isActive: true,
        },
        select: { id: true, name: true, userId: true },
      })

      if (!channel) {
        await this.log('WARN', `채널 ${channelId}을 찾을 수 없거나 비활성 상태`)
        return { success: false, channelId, postIds: [], error: '채널을 찾을 수 없음' }
      }

      const effectiveUserId = userId ?? channel.userId
      if (!effectiveUserId) {
        await this.log('WARN', `채널 ${channelId}에 userId가 없음`)
        return { success: false, channelId, postIds: [], error: 'userId 없음' }
      }

      // 배치 컨텍스트 생성 및 설정
      const batchContext = await createBatchContextFromUserId(effectiveUserId)
      setBatchContext(batchContext)

      // 수집 파이프라인 실행 (userId, config, triggerType)
      const pipelineResult = await executeCollectionPipeline(
        effectiveUserId,
        { channelIds: [channelId], limit: limit ?? 50 },
      )

      // 수집된 게시물 ID 추출
      const postIds = pipelineResult?.details?.channelResults
        ?.flatMap((cr) => cr.createdPostIds ?? []) ?? []

      // 수집 완료 이벤트 발행
      if (postIds.length > 0) {
        await this.emitEvent(
          'product.collected',
          { postIds, channelId, count: postIds.length },
          'NORMAL'
        )
      }

      await this.log('INFO', `채널 ${channelId} 수집 완료: ${postIds.length}건`)

      return { success: true, channelId, postIds }
    } catch (error: any) {
      await this.log('ERROR', `채널 ${channelId} 수집 실패: ${error.message}`)
      await this.emitEvent(
        'sourcing.error',
        { channelId, error: error.message },
        'HIGH'
      )
      return { success: false, channelId, postIds: [], error: error.message }
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 2: 중복 제거 (파이프라인에서 처리)
  // ══════════════════════════════════════════════════

  /**
   * 기존 DB와 비교하여 중복 postKey를 제거합니다.
   * 이 기능은 executeCollectionPipeline 내부에서 이미 처리되므로
   * 별도 호출이 필요하지 않습니다.
   */
  async deduplicateProducts(): Promise<void> {
    // 중복 제거는 collection pipeline 내부에서 처리됨
    await this.log('INFO', '중복 제거는 수집 파이프라인 내부에서 자동 처리됩니다')
  }

  // ══════════════════════════════════════════════════
  //  SKILL 3: 소스 필터 적용 (파이프라인에서 처리)
  // ══════════════════════════════════════════════════

  /**
   * 제목 키워드/가격 범위 필터링을 적용합니다.
   * 이 기능은 executeCollectionPipeline 내부에서 이미 처리되므로
   * 별도 호출이 필요하지 않습니다.
   */
  async applySourceFilter(): Promise<void> {
    // 소스 필터는 collection pipeline 내부에서 처리됨
    await this.log('INFO', '소스 필터는 수집 파이프라인 내부에서 자동 처리됩니다')
  }

  // ══════════════════════════════════════════════════
  //  전체 채널 수집
  // ══════════════════════════════════════════════════

  private async collectAll(): Promise<{
    totalChannels: number
    successCount: number
    failCount: number
    totalPosts: number
  }> {
    const stats = { totalChannels: 0, successCount: 0, failCount: 0, totalPosts: 0 }

    // 활성 도매 채널 조회
    const channels = await prisma.channel.findMany({
      where: {
        kind: 'WHOLESALE',
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        userId: true,
      },
    })

    stats.totalChannels = channels.length

    // 자동 소싱: 각 도매 채널당 최대 20개로 제한
    // (수동 호출은 collectFromChannel 직접 호출 시 limit 파라미터 지정으로 무제한 가능)
    const AUTO_PER_CHANNEL_LIMIT = 20

    for (const channel of channels) {
      try {
        const result = await this.collectFromChannel(channel.id, AUTO_PER_CHANNEL_LIMIT, channel.userId ?? undefined)

        if (result.success) {
          stats.successCount++
          stats.totalPosts += result.postIds.length
        } else {
          stats.failCount++
        }
      } catch (error: any) {
        stats.failCount++
        await this.log('ERROR', `채널 ${channel.name}(${channel.id}) 수집 실패: ${error.message}`)
      }
    }

    // KPI 기록
    await this.recordKpi('posts_collected', stats.totalPosts)
    await this.recordKpi(
      'collection_success_rate',
      stats.totalChannels > 0
        ? Math.round((stats.successCount / stats.totalChannels) * 100)
        : 0
    )
    await this.recordKpi('duplicates_filtered', 0) // 파이프라인 내부에서 처리되어 별도 추적 불가

    await this.log('INFO', '전체 수집 완료', stats)

    // 일일 한도 체크 (총 수집량이 설정된 한도에 도달한 경우)
    const dailyQuota = (this.config.dailyQuota as number) ?? 500
    if (stats.totalPosts >= dailyQuota) {
      await this.emitEvent(
        'sourcing.quota.reached',
        { totalPosts: stats.totalPosts, quota: dailyQuota },
        'NORMAL'
      )
      await this.log('WARN', `일일 수집 한도 도달: ${stats.totalPosts}/${dailyQuota}`)
    }

    return stats
  }
}

export const sourcingAgent = new SourcingAgent()
