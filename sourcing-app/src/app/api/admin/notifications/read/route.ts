import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { markNotificationsAsRead } from '@/services/notification.service'

/**
 * POST: 알림 읽음 처리 (다중)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: '읽음 처리할 알림 ID를 제공해주세요.' },
        { status: 400 }
      )
    }

    const updatedCount = await markNotificationsAsRead(ids)

    return NextResponse.json({
      success: true,
      message: `${updatedCount}개의 알림이 읽음 처리되었습니다.`,
    })
  } catch (error) {
    console.error('알림 읽음 처리 실패:', error)
    return NextResponse.json(
      { success: false, error: '알림 읽음 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}
