/**
 * MarketingAgent — 마케팅 에이전트
 *
 * 역할:
 *  1. 시간대별 베스트셀러 추천 요청 및 중요공지 생성
 *  2. Gemini로 시간대에 맞는 마케팅 문구 생성
 *  3. 소매밴드 중요공지 게시/해제 이벤트 발행
 *
 * 구독 이벤트:
 *  - schedule.marketing.morning    : 오전 11시
 *  - schedule.marketing.noon       : 오후 1시
 *  - schedule.marketing.evening    : 오후 5시
 *  - marketing.bestseller.response : ProductManagerAgent로부터 추천 상품 목록 수신
 *  - marketing.notice.requested    : 관리자 수동 공지 요청
 *
 * 발행 이벤트:
 *  - marketing.bestseller.requested    : 베스트셀러 TOP5 추천 요청
 *  - band.notice.post.requested        : 소매밴드 중요공지 게시 요청
 *  - band.notice.unpin.requested       : 이전 중요공지 해제
 *  - marketing.notice.posted           : 공지 게시 완료
 */

import prisma from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer, type AgentEvent, type AgentResult } from '../types'
import { GeminiClient } from '@/modules/transformation/ai.client'
import { AiProvider } from '@bandauto/db'

// ─── 시간대 타입 ───

type TimeSlot = 'morning' | 'noon' | 'evening'

// ─── 시간대별 마케팅 톤 ───

const TIME_SLOT_THEMES: Record<TimeSlot, { label: string; tone: string }> = {
  morning: {
    label: '오전 특가',
    tone: '오늘 놓치면 후회! 오전 특가 🔥',
  },
  noon: {
    label: '점심 인기상품',
    tone: '점심시간 잠깐! 지금 뜨는 인기상품 👀',
  },
  evening: {
    label: '퇴근 전 마지막 찬스',
    tone: '퇴근 전 마지막 찬스 🛒 오늘만 이 가격',
  },
}

// ─── Agent 본체 ───

export class MarketingAgent extends AgentBase {
  readonly name = 'marketing-agent'
  readonly layer = AgentLayer.OPERATIONS

  private geminiClient: GeminiClient | null = null

  getSubscribedEvents(): string[] {
    return [
      'schedule.marketing.morning',
      'schedule.marketing.noon',
      'schedule.marketing.evening',
      'marketing.bestseller.response',
      'marketing.notice.requested',
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

      switch (event.type) {
        case 'schedule.marketing.morning':
        case 'schedule.marketing.noon':
        case 'schedule.marketing.evening': {
          const timeSlot = this.getTimeSlotFromEvent(event.type)
          await this.handleScheduledNotice(timeSlot)
          break
        }

        case 'marketing.bestseller.response': {
          const products = event.data.products as Array<{
            id: number
            name: string
            price: number
          }>
          const timeSlot = (event.data.timeSlot as TimeSlot) ?? this.getCurrentTimeSlot()
          const channelId = event.data.channelId as number | undefined
          await this.handleBestsellerResponse(products, timeSlot, channelId)
          break
        }

        case 'marketing.notice.requested': {
          const channelId = event.data.channelId as number
          const content = event.data.content as string | undefined
          const timeSlot = (event.data.timeSlot as TimeSlot) ?? this.getCurrentTimeSlot()

          if (content) {
            // 관리자가 직접 내용 지정
            await this.postImportantNotice(channelId, content)
          } else {
            // 자동 생성 흐름
            await this.requestBestsellerRecommendation(timeSlot, channelId)
          }
          break
        }

        default:
          await this.log('WARN', `알 수 없는 이벤트: ${event.type}`)
      }

      return { success: true, duration: Date.now() - start }
    } catch (error: any) {
      await this.log('ERROR', `이벤트 처리 중 오류: ${error.message}`, {
        eventType: event.type,
        error: error.message,
      })
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  // ─── 스케줄 실행 ───

  async onSchedule(): Promise<void> {
    const timeSlot = this.getCurrentTimeSlot()
    await this.handleScheduledNotice(timeSlot)
  }

  // ══════════════════════════════════════════════════
  //  SKILL 1: 베스트셀러 추천 요청
  // ══════════════════════════════════════════════════

  /**
   * ProductManagerAgent에 베스트셀러 TOP5 추천을 요청합니다.
   */
  async requestBestsellerRecommendation(
    timeSlot: TimeSlot,
    channelId?: number
  ): Promise<void> {
    await this.log('INFO', `베스트셀러 추천 요청: ${timeSlot}`)

    await this.emitEvent('marketing.bestseller.requested', {
      timeSlot,
      channelId: channelId ?? null,
      limit: 5,
      requestedBy: this.name,
    })
  }

  // ══════════════════════════════════════════════════
  //  SKILL 2: 중요공지 문구 생성 (Gemini)
  // ══════════════════════════════════════════════════

  /**
   * Gemini를 사용하여 시간대에 맞는 중요공지 문구를 생성합니다.
   */
  async composeNoticeContent(
    products: Array<{ id: number; name: string; price: number }>,
    timeSlot: TimeSlot
  ): Promise<string> {
    const theme = TIME_SLOT_THEMES[timeSlot]
    const client = await this.getGeminiClient()

    // Gemini 없는 경우 기본 템플릿
    if (!client) {
      await this.log('WARN', 'Gemini API 키 없음 — 기본 템플릿 사용')
      return this.buildFallbackNotice(products, timeSlot)
    }

    try {
      const productList = products
        .map((p, i) => `${i + 1}. ${p.name} - ${p.price.toLocaleString()}원`)
        .join('\n')

      const prompt = `소셜커머스 밴드 중요공지 문구를 작성해주세요.

시간대: ${theme.label}
분위기/톤: "${theme.tone}"

추천 상품 TOP${products.length}:
${productList}

작성 규칙:
1. 제목은 "${theme.tone}" 스타일로 시작
2. 각 상품을 매력적으로 한 줄씩 소개
3. 마지막에 구매 유도 문구 추가
4. 전체 300자 이내
5. 이모지를 적절히 활용
6. 밴드 중요공지에 적합한 포맷`

      const response = await client.generateContent(prompt)
      return response.content.trim()
    } catch (err: any) {
      await this.log('ERROR', `공지 문구 생성 실패: ${err.message}`)
      return this.buildFallbackNotice(products, timeSlot)
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 3: 중요공지 게시 이벤트 발행
  // ══════════════════════════════════════════════════

  /**
   * 소매밴드 중요공지 게시를 요청합니다.
   * - 이전 중요공지 해제 이벤트 발행
   * - 새 중요공지 게시 이벤트 발행
   */
  async postImportantNotice(channelId: number, content: string): Promise<void> {
    try {
      // 이전 중요공지 해제 요청
      await this.emitEvent('band.notice.unpin.requested', {
        channelId,
        requestedBy: this.name,
      })

      // 새 중요공지 게시 요청
      await this.emitEvent('band.notice.post.requested', {
        channelId,
        content,
        requestedBy: this.name,
      })

      // 게시 완료 이벤트
      await this.emitEvent('marketing.notice.posted', {
        channelId,
        contentLength: content.length,
        postedAt: new Date().toISOString(),
      })

      // 게시 이력 DB 기록
      await this.recordNoticeHistory({
        channelId,
        content,
        success: true,
      })

      await this.log('INFO', `중요공지 게시 요청 완료: 채널 ${channelId}`)
      await this.recordKpi('notices_posted', 1)
    } catch (err: any) {
      await this.log('ERROR', `중요공지 게시 실패: ${err.message}`)

      await this.recordNoticeHistory({
        channelId,
        content,
        success: false,
        error: err.message,
      })
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 4: 게시 이력 DB 저장
  // ══════════════════════════════════════════════════

  /**
   * 공지 게시 정보를 AgentLog로 기록합니다.
   */
  async recordNoticeHistory(data: {
    channelId: number
    content: string
    success: boolean
    error?: string
  }): Promise<void> {
    try {
      await this.log(
        data.success ? 'INFO' : 'ERROR',
        `중요공지 ${data.success ? '게시 완료' : '게시 실패'}`,
        {
          channelId: data.channelId,
          contentPreview: data.content.substring(0, 100),
          success: data.success,
          error: data.error ?? null,
          timestamp: new Date().toISOString(),
        }
      )
    } catch (err: any) {
      console.error(`[${this.name}] 공지 이력 기록 실패:`, err)
    }
  }

  // ─── 내부 흐름 메서드 ───

  /**
   * 스케줄 이벤트 처리: 시간대 결정 → 베스트셀러 추천 요청
   */
  private async handleScheduledNotice(timeSlot: TimeSlot): Promise<void> {
    await this.log('INFO', `마케팅 스케줄 실행: ${timeSlot}`)
    await this.requestBestsellerRecommendation(timeSlot)
  }

  /**
   * 베스트셀러 응답 수신 시: 공지 문구 생성 → 게시 요청
   */
  private async handleBestsellerResponse(
    products: Array<{ id: number; name: string; price: number }>,
    timeSlot: TimeSlot,
    channelId?: number
  ): Promise<void> {
    if (!products || products.length === 0) {
      await this.log('WARN', '추천 상품이 비어있어 공지 생성 건너뜀')
      return
    }

    // 공지 문구 생성
    const content = await this.composeNoticeContent(products, timeSlot)

    if (!channelId) {
      // 활성 소매채널 전체에 공지
      const retailChannels = await prisma.channel.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          kind: 'RETAIL',
        },
        select: { id: true, name: true },
      })

      await this.log('INFO', `소매채널 ${retailChannels.length}개에 공지 게시`)

      let successCount = 0
      for (const channel of retailChannels) {
        try {
          await this.postImportantNotice(channel.id, content)
          successCount++
        } catch (err: any) {
          await this.log('ERROR', `채널 ${channel.id}(${channel.name}) 공지 실패: ${err.message}`)
        }
      }

      await this.recordKpi(
        'notice_success_rate',
        retailChannels.length > 0 ? Math.round((successCount / retailChannels.length) * 100) : 0
      )
    } else {
      await this.postImportantNotice(channelId, content)
      await this.recordKpi('notice_success_rate', 100)
    }
  }

  // ─── 유틸리티 ───

  private getTimeSlotFromEvent(eventType: string): TimeSlot {
    if (eventType.includes('morning')) return 'morning'
    if (eventType.includes('noon')) return 'noon'
    if (eventType.includes('evening')) return 'evening'
    return this.getCurrentTimeSlot()
  }

  private getCurrentTimeSlot(): TimeSlot {
    const hour = new Date().getHours()
    if (hour < 12) return 'morning'
    if (hour < 15) return 'noon'
    return 'evening'
  }

  /**
   * Gemini 없을 때 사용하는 기본 공지 템플릿
   */
  private buildFallbackNotice(
    products: Array<{ id: number; name: string; price: number }>,
    timeSlot: TimeSlot
  ): string {
    const theme = TIME_SLOT_THEMES[timeSlot]
    const lines = [
      `📢 ${theme.tone}`,
      '',
      ...products.map(
        (p, i) => `${i + 1}. ${p.name} — ${p.price.toLocaleString()}원`
      ),
      '',
      '💬 댓글로 상품번호 남겨주세요!',
    ]
    return lines.join('\n')
  }

  private async getGeminiClient(): Promise<GeminiClient | null> {
    if (this.geminiClient) return this.geminiClient

    const apiConfig = await prisma.aiApiConfig.findFirst({
      where: { provider: AiProvider.GEMINI, isActive: true },
    })

    if (!apiConfig?.apiKey) return null

    this.geminiClient = new GeminiClient({
      provider: AiProvider.GEMINI,
      apiKey: apiConfig.apiKey,
      model: apiConfig.model || 'gemini-2.5-flash',
      temperature: 0.7,
    })

    return this.geminiClient
  }
}

export const marketingAgent = new MarketingAgent()
