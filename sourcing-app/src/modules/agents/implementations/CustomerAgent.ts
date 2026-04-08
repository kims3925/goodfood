/**
 * CustomerAgent — 고객 CS 에이전트
 *
 * 역할:
 *  1. 고객 문의(Inquiry) 자동 분류 및 답변 생성
 *  2. 주문 완료 후 감사 메시지 처리
 *  3. 자동 처리 불가 시 관리자 에스컬레이션
 *
 * 구독 이벤트:
 *  - schedule.customer.check    : 30분 주기 미처리 문의 모니터링
 *  - customer.inquiry.received  : 새 고객 문의 감지
 *  - order.completed            : 주문 완료 후 감사 메시지
 *
 * 발행 이벤트:
 *  - customer.inquiry.classified : 문의 분류 완료
 *  - customer.reply.posted       : 댓글 답변 등록 완료
 *  - customer.escalated          : 자동 처리 불가 → 관리자 알림
 */

import prisma from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer, type AgentEvent, type AgentResult } from '../types'
import { GeminiClient } from '@/modules/transformation/ai.client'
import { AiProvider } from '@bandauto/db'

// ─── 문의 분류 타입 ───

type InquiryClassification = '배송' | '환불' | '구매' | '기타'

// ─── Agent 본체 ───

export class CustomerAgent extends AgentBase {
  readonly name = 'customer-agent'
  readonly layer = AgentLayer.OPERATIONS

  private geminiClient: GeminiClient | null = null

  getSubscribedEvents(): string[] {
    return [
      'schedule.customer.check',
      'customer.inquiry.received',
      'order.completed',
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

      switch (event.type) {
        case 'schedule.customer.check': {
          await this.onSchedule()
          break
        }

        case 'customer.inquiry.received': {
          const inquiryId = event.data.inquiryId as number
          await this.processInquiry(inquiryId)
          break
        }

        case 'order.completed': {
          const orderId = event.data.orderId as number
          const userId = event.data.userId as number
          await this.sendThankYouMessage(orderId, userId)
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

  // ─── 스케줄 실행 (30분 주기) ───

  async onSchedule(): Promise<void> {
    await this.log('INFO', '미처리 문의 모니터링 시작')

    let inquiriesProcessed = 0
    let autoReplied = 0
    let escalated = 0

    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

      // 미처리 문의 조회 (PENDING 상태, 30분 이전 생성)
      const unhandledInquiries = await prisma.inquiry.findMany({
        where: {
          status: 'PENDING',
          repliedAt: null,
          createdAt: { lt: thirtyMinutesAgo },
        },
        include: {
          user: { select: { id: true, name: true } },
          shopProduct: { select: { id: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      })

      await this.log('INFO', `미처리 문의 ${unhandledInquiries.length}건 발견`)

      for (const inquiry of unhandledInquiries) {
        try {
          inquiriesProcessed++

          // 문의 분류
          const classification = await this.classifyInquiry(inquiry.content)

          await this.emitEvent('customer.inquiry.classified', {
            inquiryId: inquiry.id,
            type: classification,
          })

          // 답변 생성 시도
          const reply = await this.generateReply(classification, {
            inquiryType: inquiry.inquiryType,
            content: inquiry.content,
            productName: inquiry.shopProductId ? `상품 #${inquiry.shopProductId}` : null,
          })

          if (reply) {
            // 자동 답변 등록
            await prisma.inquiryReply.create({
              data: {
                inquiryId: inquiry.id,
                content: reply,
                isAdmin: true,
              },
            })

            await this.markAsHandled(inquiry.id)
            autoReplied++

            await this.emitEvent('customer.reply.posted', {
              inquiryId: inquiry.id,
              classification,
            })
          } else {
            // 자동 처리 불가 → 에스컬레이션
            escalated++

            await this.emitEvent('customer.escalated', {
              inquiryId: inquiry.id,
              classification,
              reason: '자동 답변 생성 불가',
            }, 'HIGH')
          }
        } catch (err: any) {
          await this.log('ERROR', `문의 ${inquiry.id} 처리 실패: ${err.message}`)
          escalated++

          await this.emitEvent('customer.escalated', {
            inquiryId: inquiry.id,
            reason: `처리 오류: ${err.message}`,
          }, 'HIGH')
        }
      }
    } catch (err: any) {
      await this.log('ERROR', `문의 모니터링 실패: ${err.message}`)
    }

    // KPI 기록
    await this.recordKpi('inquiries_processed', inquiriesProcessed)
    await this.recordKpi('auto_replied', autoReplied)
    await this.recordKpi('escalated', escalated)

    await this.log('INFO', '문의 모니터링 완료', {
      inquiriesProcessed,
      autoReplied,
      escalated,
    })
  }

  // ══════════════════════════════════════════════════
  //  SKILL 1: 문의 유형 분류 (Gemini)
  // ══════════════════════════════════════════════════

  /**
   * Gemini를 사용하여 고객 문의 내용을 분류합니다.
   * 반환: '배송' | '환불' | '구매' | '기타'
   */
  async classifyInquiry(text: string): Promise<InquiryClassification> {
    const client = await this.getGeminiClient()
    if (!client) {
      await this.log('WARN', 'Gemini API 키 없음 — 기본 분류(기타) 반환')
      return '기타'
    }

    try {
      const prompt = `다음 고객 문의를 분류해주세요.

문의 내용:
"${text}"

아래 4가지 중 하나로만 답변해주세요 (다른 텍스트 없이 카테고리명만):
- 배송
- 환불
- 구매
- 기타`

      const response = await client.generateContent(prompt)
      const result = response.content.trim()

      const validTypes: InquiryClassification[] = ['배송', '환불', '구매', '기타']
      const matched = validTypes.find((t) => result.includes(t))

      return matched ?? '기타'
    } catch (err: any) {
      await this.log('ERROR', `문의 분류 실패: ${err.message}`)
      return '기타'
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 2: 맞춤 답변 생성 (Gemini)
  // ══════════════════════════════════════════════════

  /**
   * 문의 유형과 주문 정보를 바탕으로 맞춤 답변을 생성합니다.
   * 자동 답변이 적절하지 않은 경우 null을 반환합니다.
   */
  async generateReply(
    inquiryType: InquiryClassification,
    orderInfo: {
      inquiryType: string
      content: string
      productName: string | null
    }
  ): Promise<string | null> {
    const client = await this.getGeminiClient()
    if (!client) {
      return null
    }

    try {
      const prompt = `쇼핑몰 고객 문의에 대한 친절한 답변을 작성해주세요.

문의 분류: ${inquiryType}
문의 유형: ${orderInfo.inquiryType}
관련 상품: ${orderInfo.productName ?? '없음'}
문의 내용: "${orderInfo.content}"

작성 규칙:
1. 존댓말을 사용하고 친절하게 답변
2. 구체적인 안내가 필요한 경우(환불 금액, 배송 일정 등) 확인 후 안내드리겠다고 답변
3. 자동 답변이 부적절한 복잡한 문의라면 "ESCALATE"라고만 답변
4. 150자 이내로 간결하게 작성`

      const response = await client.generateContent(prompt)
      const reply = response.content.trim()

      // 에스컬레이션 판단
      if (reply === 'ESCALATE' || reply.includes('ESCALATE')) {
        return null
      }

      return reply
    } catch (err: any) {
      await this.log('ERROR', `답변 생성 실패: ${err.message}`)
      return null
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 3: 처리 완료 기록
  // ══════════════════════════════════════════════════

  /**
   * 문의를 처리 완료 상태로 DB에 기록합니다.
   */
  async markAsHandled(inquiryId: number): Promise<void> {
    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: {
        status: 'ANSWERED',
        repliedAt: new Date(),
      },
    })
  }

  // ─── 주문 완료 감사 메시지 ───

  private async sendThankYouMessage(orderId: number, userId: number): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { take: 3, select: { productName: true } },
          user: { select: { name: true } },
        },
      })

      if (!order) {
        await this.log('WARN', `주문 ${orderId}를 찾을 수 없음`)
        return
      }

      const productNames = order.items.map((i) => i.productName).join(', ')

      await this.log('INFO', `주문 완료 감사 처리: 주문 ${orderId}`, {
        userId,
        productNames,
        userName: order.user?.name,
      })

      // 감사 메시지 이벤트 발행 (알림 시스템에서 처리)
      await this.emitEvent('customer.reply.posted', {
        orderId,
        userId,
        type: 'thank_you',
        message: `${order.user?.name ?? '고객'}님, 주문해 주셔서 감사합니다! (${productNames})`,
      })
    } catch (err: any) {
      await this.log('ERROR', `감사 메시지 처리 실패: ${err.message}`)
    }
  }

  // ─── 개별 문의 처리 (이벤트 수신 시) ───

  private async processInquiry(inquiryId: number): Promise<void> {
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        user: { select: { id: true, name: true } },
        shopProduct: { select: { id: true } },
      },
    })

    if (!inquiry) {
      await this.log('WARN', `문의 ${inquiryId}를 찾을 수 없음`)
      return
    }

    if (inquiry.status !== 'PENDING') {
      await this.log('INFO', `문의 ${inquiryId}는 이미 처리됨`)
      return
    }

    // 분류
    const classification = await this.classifyInquiry(inquiry.content)

    await this.emitEvent('customer.inquiry.classified', {
      inquiryId: inquiry.id,
      type: classification,
    })

    // 답변 생성
    const reply = await this.generateReply(classification, {
      inquiryType: inquiry.inquiryType,
      content: inquiry.content,
      productName: inquiry.shopProductId ? `상품 #${inquiry.shopProductId}` : null,
    })

    if (reply) {
      await prisma.inquiryReply.create({
        data: {
          inquiryId: inquiry.id,
          content: reply,
          isAdmin: true,
        },
      })

      await this.markAsHandled(inquiry.id)

      await this.emitEvent('customer.reply.posted', {
        inquiryId: inquiry.id,
        classification,
      })
    } else {
      await this.emitEvent('customer.escalated', {
        inquiryId: inquiry.id,
        classification,
        reason: '자동 답변 생성 불가',
      }, 'HIGH')
    }
  }

  // ─── 내부 헬퍼 ───

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
      temperature: 0.3,
    })

    return this.geminiClient
  }
}

export const customerAgent = new CustomerAgent()
