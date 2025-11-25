/**
 * Automation Stats API
 * 자동화 통계 조회 (헤더용)
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { getAutomationStats } from '@/modules/automation'

/**
 * GET /api/automation/stats
 * 자동화 통계 조회
 *
 * Response:
 * - todayCollected: 오늘 수집된 게시물 수
 * - pendingTransform: AI 변환 대기 중인 게시물 수
 * - readyToPublish: 발행 준비된 상품 수
 * - todayPublished: 오늘 발행된 상품 수
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

    const stats = await getAutomationStats(currentUser.userId)

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('통계 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '통계를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
