export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'

/**
 * POST /api/admin/agents/seed
 *
 * 11개 에이전트 AgentDefinition을 upsert합니다.
 * 중복 실행 안전 (upsert 사용).
 * ADMIN 세션 필요.
 */

const AGENT_SEEDS = [
  // ── COMMAND (1) ──
  {
    name: 'commander',
    displayName: '🧠 Commander',
    layer: 'COMMAND' as const,
    icon: 'Brain',
    description: '전체 에이전트 오케스트레이션, 이벤트 라우팅, 장애 자동복구, 운영 리포트',
    priority: 1,
    maxConcurrent: 1,
    aiModel: 'claude-opus',
    retryPolicy: { maxRetries: 5, backoff: 'exponential', delays: [1000, 2000, 4000, 8000, 16000] },
    schedule: null,
    config: {
      maxConcurrent: 1,
      skills: ['routeEvent', 'executeWorkflow', 'handleAgentError', 'escalate', 'healthCheckAll'],
    },
  },

  // ── SOURCING (2) ──
  {
    name: 'sourcing-agent',
    displayName: '📦 Sourcing Agent',
    layer: 'SOURCING' as const,
    icon: 'Package',
    description: '도매밴드의 새 게시물을 자동으로 수집하여 CollectedPost로 저장',
    priority: 2,
    maxConcurrent: 3,
    aiModel: 'claude-sonnet',
    retryPolicy: { maxRetries: 3, backoff: 'exponential', delays: [5000, 10000, 20000] },
    schedule: '0 * * * *',
    config: {
      maxConcurrent: 3,
      schedule: '0 * * * *',
      skills: ['collectFromChannel', 'parsePost', 'deduplicateProducts', 'saveCollectedPosts', 'applySourceFilter'],
    },
  },
  {
    name: 'product-manager',
    displayName: '📋 Product Manager',
    layer: 'SOURCING' as const,
    icon: 'ClipboardCheck',
    description: '가격정책 검증, 이미지 가격 텍스트 탐지, 위반 상품 삭제/재발행, 베스트셀러 재발행',
    priority: 2,
    maxConcurrent: 2,
    aiModel: 'claude-haiku',
    retryPolicy: { maxRetries: 3, backoff: 'linear', delays: [2000, 4000, 6000] },
    schedule: '0 2 * * *',
    config: {
      maxConcurrent: 2,
      schedule: '0 2 * * *',
      maxRepublishPerRun: 5,
      skills: ['validateProductPricing', 'detectPriceInImages', 'deletePublishedProduct', 'requestRepublish', 'runFullAudit', 'analyzeSeasonBestsellers', 'republishToBandTop', 'respondBestsellerRequest'],
    },
  },

  // ── OPERATIONS (2) ──
  {
    name: 'marketing-agent',
    displayName: '📢 Marketing Agent',
    layer: 'OPERATIONS' as const,
    icon: 'Megaphone',
    description: '하루 3회(11시/13시/17시) 베스트셀러 추천 공지를 소매밴드에 자동 게시',
    priority: 3,
    maxConcurrent: 2,
    aiModel: 'claude-sonnet',
    retryPolicy: { maxRetries: 2, backoff: 'linear', delays: [3000, 6000] },
    schedule: '0 11,13,17 * * *',
    config: {
      maxConcurrent: 2,
      schedule: '0 11,13,17 * * *',
      skills: ['requestBestsellerRecommendation', 'composeNoticeContent', 'postImportantNotice', 'unpinPreviousNotice', 'scheduleThreeDailyPosts', 'recordNoticeHistory'],
    },
  },
  {
    name: 'customer-agent',
    displayName: '👤 Customer Agent',
    layer: 'OPERATIONS' as const,
    icon: 'MessageCircle',
    description: '소매밴드 댓글 자동 분류(구매/배송/환불) 및 AI 맞춤 답변 등록',
    priority: 3,
    maxConcurrent: 5,
    aiModel: 'claude-sonnet',
    retryPolicy: { maxRetries: 2, backoff: 'linear', delays: [1000, 2000] },
    schedule: '*/30 * * * *',
    config: {
      maxConcurrent: 5,
      schedule: '*/30 * * * *',
      skills: ['readBandComments', 'classifyInquiry', 'generateReply', 'postReply', 'markAsHandled'],
    },
  },

  // ── COMMERCE (3) ──
  {
    name: 'order-agent',
    displayName: '📝 Order Agent',
    layer: 'COMMERCE' as const,
    icon: 'ClipboardList',
    description: '신규 주문 자동 접수, 결제 확인, 무통장 미결제 자동 취소',
    priority: 2,
    maxConcurrent: 5,
    aiModel: 'claude-haiku',
    retryPolicy: { maxRetries: 3, backoff: 'exponential', delays: [1000, 2000, 4000] },
    schedule: '*/10 * * * *',
    config: {
      maxConcurrent: 5,
      schedule: '*/10 * * * *',
      autoCancelHours: 24,
      skills: ['processNewOrders', 'confirmOrder', 'cancelOrder', 'checkExpiredOrders', 'notifyCustomer'],
    },
  },
  {
    name: 'shipping-agent',
    displayName: '🚚 Shipping Agent',
    layer: 'COMMERCE' as const,
    icon: 'Truck',
    description: '배송 중인 주문의 운송장 추적, 상태 변경 알림',
    priority: 3,
    maxConcurrent: 3,
    aiModel: 'claude-haiku',
    retryPolicy: { maxRetries: 3, backoff: 'linear', delays: [2000, 4000, 6000] },
    schedule: '0 */2 * * *',
    config: {
      maxConcurrent: 3,
      schedule: '0 */2 * * *',
      skills: ['trackShipment', 'updateDeliveryStatus', 'sendDeliveryAlert', 'detectDeliveryDelay'],
    },
  },
  {
    name: 'settlement-agent',
    displayName: '💰 Settlement Agent',
    layer: 'COMMERCE' as const,
    icon: 'Coins',
    description: '배달 완료 주문 정산, 채널별/도매방별 수익 집계, 리포트 이메일 발송',
    priority: 4,
    maxConcurrent: 1,
    aiModel: 'claude-haiku',
    retryPolicy: { maxRetries: 2, backoff: 'linear', delays: [3000, 6000] },
    schedule: '0 1 * * *',
    config: {
      maxConcurrent: 1,
      schedule: '0 1 * * *',
      skills: ['calculateSettlement', 'aggregateByChannel', 'generateReport', 'sendReportEmail'],
    },
  },

  // ── INFRA (3) ──
  {
    name: 'session-keeper',
    displayName: '🔐 Session Keeper',
    layer: 'INFRA' as const,
    icon: 'Shield',
    description: 'Band 로그인 세션 만료 감지 및 자동 갱신',
    priority: 1,
    maxConcurrent: 1,
    aiModel: 'claude-haiku',
    retryPolicy: { maxRetries: 5, backoff: 'exponential', delays: [1000, 2000, 4000, 8000, 16000] },
    schedule: '0 */6 * * *',
    config: {
      maxConcurrent: 1,
      schedule: '0 */6 * * *',
      skills: ['checkSessionValidity', 'renewSession', 'notifySessionExpiry', 'getSessionExpiryTime'],
    },
  },
  {
    name: 'watcher-agent',
    displayName: '📡 Watcher Agent',
    layer: 'INFRA' as const,
    icon: 'Radio',
    description: '시스템 전반 이상 상태 5분 주기 감시 (Redis, API, DB, 에이전트)',
    priority: 1,
    maxConcurrent: 1,
    aiModel: 'claude-haiku',
    retryPolicy: { maxRetries: 3, backoff: 'linear', delays: [500, 1000, 1500] },
    schedule: '*/5 * * * *',
    config: {
      maxConcurrent: 1,
      schedule: '*/5 * * * *',
      skills: ['checkApiHealth', 'checkQueueStatus', 'checkAgentStatuses', 'checkDbConnection', 'sendAlert'],
    },
  },
  {
    name: 'analyst-agent',
    displayName: '📊 Analyst Agent',
    layer: 'INFRA' as const,
    icon: 'BarChart3',
    description: '일별/주별/월별 매출·수익·소싱 성과 분석, Gemini AI 인사이트 요약',
    priority: 5,
    maxConcurrent: 1,
    aiModel: 'claude-opus',
    retryPolicy: { maxRetries: 2, backoff: 'linear', delays: [2000, 4000] },
    schedule: '0 6 * * *',
    config: {
      maxConcurrent: 1,
      schedule: '0 6 * * *',
      skills: ['generateSalesReport', 'analyzeTopProducts', 'analyzeChannelROI', 'forecastRevenue', 'generateInsightSummary', 'saveKpiRecords'],
    },
  },
]

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'ADMIN 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    let created = 0
    let updated = 0

    for (const seed of AGENT_SEEDS) {
      const existing = await prisma.agentDefinition.findUnique({
        where: { name: seed.name },
      })

      await prisma.agentDefinition.upsert({
        where: { name: seed.name },
        update: {
          displayName: seed.displayName,
          layer: seed.layer,
          icon: seed.icon,
          description: seed.description,
          priority: seed.priority,
          maxConcurrent: seed.maxConcurrent,
          aiModel: seed.aiModel,
          retryPolicy: seed.retryPolicy as any,
          schedule: seed.schedule ?? null,
          config: seed.config as any,
          deletedAt: null, // 삭제된 에이전트도 복원
        },
        create: {
          name: seed.name,
          displayName: seed.displayName,
          layer: seed.layer,
          icon: seed.icon,
          description: seed.description,
          priority: seed.priority,
          maxConcurrent: seed.maxConcurrent,
          aiModel: seed.aiModel,
          retryPolicy: seed.retryPolicy as any,
          schedule: seed.schedule ?? null,
          config: seed.config as any,
        },
      })

      if (existing) {
        updated++
      } else {
        created++
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      total: AGENT_SEEDS.length,
      message: `${created}개 생성, ${updated}개 업데이트 완료`,
    })
  } catch (error: any) {
    console.error('Seed API 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Seed 실행에 실패했습니다.' },
      { status: 500 }
    )
  }
}
