export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/band-deletion/status
 *
 * 밴드(소매밴드) 게시글 자동 삭제 진행 상태 보고.
 *
 * 데이터 소스:
 *  - ProductManagerAgent (이름: 'product-manager') 가 매일 03:00 KST 에 runContentExpiry 실행
 *  - 만료된 ChannelProduct/ShopProduct 를 soft-delete + Band Playwright 로 실 삭제 시도
 *  - KPI: content_expiry_channel_deleted / content_expiry_shop_deleted / content_expiry_band_deleted
 *  - 이벤트 emit: band.post.delete.requested
 *
 * 반환:
 *  - lastRun: 가장 최근 ProductManagerAgent 의 content-expiry 실행 정보
 *  - schedule: 다음 예정 시각 (cron 정의 기반)
 *  - kpiLast7Days: 일별 삭제 카운트 (밴드/채널프로덕트/쇼프로덕트)
 *  - softDeletedQueue: soft-delete 됐지만 Band 실 삭제 안 됐을 수 있는 ChannelProduct 추정 카운트
 *  - recentLogs: 최근 50건 로그 (ERROR 우선)
 *  - recentBandDeleteEvents: AgentTask 중 band.post.delete.requested 이벤트
 */

import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // ProductManagerAgent 정의 조회
    const agent = await prisma.agentDefinition.findUnique({
      where: { name: 'product-manager' },
      select: {
        id: true,
        name: true,
        status: true,
        schedule: true,
      },
    }).catch(() => null)

    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'product-manager 에이전트가 DB 에 등록돼 있지 않습니다.',
        recommendation: 'POST /api/admin/agents/seed 호출로 에이전트 등록.',
      }, { status: 404 })
    }

    const now = new Date()
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const since1h = new Date(now.getTime() - 60 * 60 * 1000)

    // 최근 7일 KPI (콘텐츠 만료 관련 메트릭만)
    const kpis = await prisma.agentKpiRecord.findMany({
      where: {
        agentId: agent.id,
        date: { gte: since7d },
        metric: {
          in: [
            'content_expiry_channel_deleted',
            'content_expiry_shop_deleted',
            'content_expiry_band_deleted',
          ],
        },
      },
      orderBy: { date: 'desc' },
      select: {
        metric: true,
        value: true,
        target: true,
        date: true,
        period: true,
      },
    }).catch(() => [])

    // 최근 task — content-expiry / band-delete 관련
    const recentTasks = await prisma.agentTask.findMany({
      where: {
        agentId: agent.id,
        OR: [
          { eventType: { contains: 'expiry' } },
          { eventType: { contains: 'band.post.delete' } },
          { eventType: { contains: 'content-expiry' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        eventType: true,
        status: true,
        startedAt: true,
        completedAt: true,
        duration: true,
        error: true,
        retryCount: true,
        createdAt: true,
      },
    }).catch(() => [])

    // 최근 로그 (50건, 에이전트별)
    const recentLogs = await prisma.agentLog.findMany({
      where: {
        agentId: agent.id,
        OR: [
          { message: { contains: '이전글' } },
          { message: { contains: 'expiry' } },
          { message: { contains: '삭제' } },
          { message: { contains: 'delete' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        level: true,
        message: true,
        metadata: true,
        createdAt: true,
      },
    }).catch(() => [])

    // soft-delete 된 ChannelProduct 카운트 (사용자별)
    // — 이 중 일부는 Band 측에서 아직 안 지워졌을 가능성 (Phase 2 listener 미구현이라
    //   에이전트 실행 시 직접 deletePost 호출 — 실패한 건은 다음 실행에서 재시도 안 함)
    const softDeletedChannelProducts = await prisma.channelProduct.count({
      where: {
        userId: currentUser.userId,
        deletedAt: { not: null, gte: since7d },
      },
    }).catch(() => 0)

    const softDeletedRecent1h = await prisma.channelProduct.count({
      where: {
        userId: currentUser.userId,
        deletedAt: { not: null, gte: since1h },
      },
    }).catch(() => 0)

    // KPI 일별 집계
    const kpiByDate: Record<string, Record<string, number>> = {}
    for (const k of kpis) {
      const dateKey = k.date.toISOString().slice(0, 10)
      if (!kpiByDate[dateKey]) kpiByDate[dateKey] = {}
      kpiByDate[dateKey][k.metric] = k.value
    }

    // 다음 실행 예정 — schedule 이 cron 식이면 표시 (실제 계산은 안 함, 표시만)
    const nextScheduledAt = agent.schedule
      ? `cron: ${agent.schedule} (Asia/Seoul, 다음 03:00 KST 예정)`
      : '예약 없음'

    return NextResponse.json({
      success: true,
      data: {
        agent: {
          name: agent.name,
          status: agent.status,
          schedule: agent.schedule,
          nextScheduledAtHuman: nextScheduledAt,
        },
        summary: {
          softDeletedChannelProducts7d: softDeletedChannelProducts,
          softDeletedChannelProductsLast1h: softDeletedRecent1h,
          recentTaskCount: recentTasks.length,
          recentLogCount: recentLogs.length,
        },
        kpiLast7Days: kpiByDate,
        recentTasks,
        recentLogs,
        notes: [
          '⏱️ ProductManagerAgent 가 매일 03:00 KST 에 자동 실행 (cron: 0 3 * * *)',
          '🎯 대상: 발행일 7일 초과 (COM 카테고리는 30일 초과) ChannelProduct/ShopProduct',
          '🚫 활성 RETAIL 채널만 처리 (isActive=false 인 채널은 건너뜀)',
          '🤖 Band 실 게시글 삭제: bandPlaywrightService.deletePost (세션 만료 시 sessionMissing 카운트 증가)',
          '📦 ShopProduct 도 함께 soft-delete (쇼핑몰 노출 즉시 제거)',
          '⚠️ band.post.delete.requested 이벤트 listener 는 미구현 (Phase 2) — 에이전트 실행 시 직접 deletePost 호출',
        ],
      },
    })
  } catch (error: any) {
    console.error('[band-deletion/status] 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '조회 실패' },
      { status: 500 }
    )
  }
}
