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
          const userId = event.data.userId as number | undefined
          await this.handleBestsellerResponse(products, timeSlot, userId, channelId)
          break
        }

        case 'marketing.notice.requested': {
          const channelId = event.data.channelId as number
          const content = event.data.content as string | undefined
          const timeSlot = (event.data.timeSlot as TimeSlot) ?? this.getCurrentTimeSlot()
          const userId = event.data.userId as number | undefined

          if (content) {
            // 관리자가 직접 내용 지정
            await this.postImportantNotice(channelId, content)
          } else if (userId) {
            // 자동 생성 흐름 (단일 사용자)
            await this.requestBestsellerRecommendation(timeSlot, userId, channelId)
          } else {
            await this.log('WARN', 'marketing.notice.requested 에 userId 와 content 모두 없음 — 처리 불가')
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
   * 멀티테넌트: userId 가 필수 — 어느 사용자의 상품을 인기순위 대상으로 할지 결정.
   */
  async requestBestsellerRecommendation(
    timeSlot: TimeSlot,
    userId: number,
    channelId?: number
  ): Promise<void> {
    await this.log('INFO', `베스트셀러 추천 요청: user=${userId} ${timeSlot}`)

    await this.emitEvent('marketing.bestseller.requested', {
      userId,
      timeSlot,
      channelId: channelId ?? null,
      // limit 은 BandNoticeConfig.topN 사용 — ProductManagerAgent 가 자동 조회
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
   * 스케줄 이벤트 처리:
   * BandNoticeConfig.isEnabled=true 사용자별로 베스트셀러 추천 요청을 발화.
   *
   * 멀티테넌트 fan-out:
   *  - cron (11/13/17) 1회 발화 → 활성 사용자 N명 iterate
   *  - 각 사용자마다 marketing.bestseller.requested(userId) emit
   *  - ProductManagerAgent 가 사용자별 BandNoticeConfig 필터로 popularity 계산 후 response emit
   *  - 응답마다 handleBestsellerResponse(userId) 가 해당 사용자의 retail 채널에 게시
   *
   * scheduleTimes 가 사용자 정의(예: 10:00 / 14:00) 인 경우 본 cron 의 11/13/17 와 어긋날 수 있음.
   * 현재는 cron 시각에 활성 사용자 모두 발화 — 더 정밀한 매칭은 AgentScheduler 사용자별 cron 재설계 필요(차후).
   */
  private async handleScheduledNotice(timeSlot: TimeSlot): Promise<void> {
    await this.log('INFO', `마케팅 스케줄 실행: ${timeSlot}`)

    // BandNoticeConfig.isEnabled=true 인 사용자만 대상
    // (scheduleTimes 매칭은 향후 cron 재설계 시 정밀 적용)
    const activeConfigs = await prisma.bandNoticeConfig.findMany({
      where: { isEnabled: true },
      select: { userId: true, scheduleTimes: true },
    }).catch((err) => {
      // 테이블 미배포(db push 안 됨) 등의 경우 안전하게 빈 배열
      console.warn('[MarketingAgent] bandNoticeConfig 조회 실패, fan-out 스킵:', err?.message)
      return [] as Array<{ userId: number; scheduleTimes: string }>
    })

    if (activeConfigs.length === 0) {
      await this.log('INFO', `활성 BandNoticeConfig 없음 — 공지 발화 스킵`)
      return
    }

    // 현재 시각(HH:MM) 과 scheduleTimes 매칭 — 가까운 시간(±5분) 이내면 발화
    // cron 이 11:00 정각에 발화, 사용자가 10:55 또는 11:05 설정해도 매칭되도록 ±5분 윈도우
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const matchWindow = 5  // 분

    let firedCount = 0
    for (const cfg of activeConfigs) {
      try {
        const times: string[] = JSON.parse(cfg.scheduleTimes || '[]')
        const matched = times.some((t) => {
          const m = t.match(/^(\d{2}):(\d{2})$/)
          if (!m) return false
          const target = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
          return Math.abs(target - currentMinutes) <= matchWindow
        })

        if (matched) {
          await this.requestBestsellerRecommendation(timeSlot, cfg.userId)
          firedCount++
        }
      } catch (err: any) {
        await this.log('ERROR', `user=${cfg.userId} 발화 실패: ${err.message}`)
      }
    }

    await this.log('INFO', `공지 발화 완료: ${firedCount}/${activeConfigs.length}명`)
    await this.recordKpi('marketing_users_fired', firedCount)
  }

  /**
   * 베스트셀러 응답 수신 시: 공지 문구 생성 → 게시 요청.
   * userId 로 사용자의 retail 채널만 필터링 (멀티테넌트 격리).
   */
  private async handleBestsellerResponse(
    products: Array<{ id: number; name: string; price: number }>,
    timeSlot: TimeSlot,
    userId?: number,
    channelId?: number
  ): Promise<void> {
    if (!products || products.length === 0) {
      await this.log('WARN', '추천 상품이 비어있어 공지 생성 건너뜀')
      return
    }

    // 공지 문구 생성
    const content = await this.composeNoticeContent(products, timeSlot)

    if (!channelId) {
      // 활성 소매채널 전체에 공지 — userId 가 있으면 그 사용자 채널만 (멀티테넌트 격리)
      const retailChannels = await prisma.channel.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          kind: 'RETAIL',
          ...(userId ? { userId } : {}),
        },
        select: { id: true, name: true },
      })

      // BandNoticeConfig.retailChannelIds 필터 적용 (있으면 그 채널만)
      let targetChannels = retailChannels
      if (userId) {
        const cfg = await prisma.bandNoticeConfig
          .findUnique({ where: { userId }, select: { retailChannelIds: true } })
          .catch(() => null)
        if (cfg) {
          try {
            const ids: number[] = JSON.parse(cfg.retailChannelIds || '[]')
            if (ids.length > 0) {
              targetChannels = retailChannels.filter((c) => ids.includes(c.id))
            }
          } catch {}
        }
      }

      await this.log(
        'INFO',
        `user=${userId ?? '?'} 소매채널 ${targetChannels.length}/${retailChannels.length}개에 공지 게시`,
      )

      let successCount = 0
      for (const channel of targetChannels) {
        try {
          await this.postImportantNotice(channel.id, content)
          successCount++
        } catch (err: any) {
          await this.log('ERROR', `채널 ${channel.id}(${channel.name}) 공지 실패: ${err.message}`)
        }
      }

      await this.recordKpi(
        'notice_success_rate',
        targetChannels.length > 0 ? Math.round((successCount / targetChannels.length) * 100) : 0,
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
