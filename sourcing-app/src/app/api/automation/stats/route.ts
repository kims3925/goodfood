/**
 * Automation Stats API
 * 자동화 통계 조회 (헤더용)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { getAutomationStats } from '@/modules/automation'
import { getHourlyWorkflowStats } from '@/modules/automation/workflow-service'

/**
 * GET /api/automation/stats
 * 자동화 통계 조회
 *
 * Query Parameters:
 * - period: 'today' | '7days' | '30days' | 'custom' (default: 'today')
 * - startDate: YYYY-MM-DD (custom 일 때 사용)
 * - endDate: YYYY-MM-DD (custom 일 때 사용)
 *
 * Response:
 * - todayCollected: 기간 내 수집된 게시물 수
 * - pendingTransform: AI 변환 대기 중인 게시물 수
 * - readyToPublish: 발행 준비된 상품 수
 * - todayPublished: 기간 내 발행된 상품 수
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // 날짜 범위 계산
    let startDate: Date
    let endDate: Date = new Date()
    endDate.setHours(23, 59, 59, 999)

    if (period === 'custom' && startDateParam && endDateParam) {
      startDate = new Date(startDateParam)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(endDateParam)
      endDate.setHours(23, 59, 59, 999)
    } else {
      startDate = new Date()
      startDate.setHours(0, 0, 0, 0)

      switch (period) {
        case '7days':
          startDate.setDate(startDate.getDate() - 6)
          break
        case '30days':
          startDate.setDate(startDate.getDate() - 29)
          break
        case 'today':
        default:
          // startDate는 이미 오늘 00:00:00으로 설정됨
          break
      }
    }

    const [stats, hourlyStats] = await Promise.all([
      getAutomationStats(currentUser.userId, startDate, endDate),
      getHourlyWorkflowStats(currentUser.userId, startDate, endDate),
    ])

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        hourlyStats,
      },
    })
  } catch (error) {
    console.error('통계 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '통계를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
