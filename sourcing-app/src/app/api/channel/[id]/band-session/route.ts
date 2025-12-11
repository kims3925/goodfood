/**
 * Band 수동 세션 관리 API
 * 2FA가 설정된 계정을 위한 수동 로그인 지원
 */

import { NextRequest, NextResponse } from 'next/server'
import { manualLoginService } from '@/modules/band-playwright/band-manual-login.service'

/**
 * GET: 세션 상태 조회
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const channelId = parseInt(params.id, 10)

  if (isNaN(channelId)) {
    return NextResponse.json({ success: false, error: '잘못된 채널 ID입니다.' }, { status: 400 })
  }

  try {
    // URL에서 sessionId 확인 (진행 중인 로그인 상태 확인용)
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      // 진행 중인 로그인 세션 상태 확인
      const status = manualLoginService.getSessionStatus(sessionId)
      return NextResponse.json({ success: true, data: status })
    }

    // 채널의 저장된 세션 상태 확인
    const sessionStatus = await manualLoginService.getChannelSessionStatus(channelId)
    return NextResponse.json({ success: true, data: sessionStatus })
  } catch (error: any) {
    console.error('세션 상태 조회 실패:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * POST: 수동 로그인 시작
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const channelId = parseInt(params.id, 10)

  if (isNaN(channelId)) {
    return NextResponse.json({ success: false, error: '잘못된 채널 ID입니다.' }, { status: 400 })
  }

  try {
    const result = await manualLoginService.startManualLogin(channelId)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: result.sessionId,
        message: '브라우저가 열렸습니다. Band에 로그인해주세요.',
      },
    })
  } catch (error: any) {
    console.error('수동 로그인 시작 실패:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * DELETE: 세션 삭제
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const channelId = parseInt(params.id, 10)

  if (isNaN(channelId)) {
    return NextResponse.json({ success: false, error: '잘못된 채널 ID입니다.' }, { status: 400 })
  }

  try {
    // URL에서 sessionId 확인 (진행 중인 로그인 취소용)
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      // 진행 중인 로그인 취소
      await manualLoginService.cancelSession(sessionId)
      return NextResponse.json({ success: true, message: '로그인이 취소되었습니다.' })
    }

    // 저장된 세션 삭제
    await manualLoginService.deleteSession(channelId)
    return NextResponse.json({ success: true, message: '세션이 삭제되었습니다.' })
  } catch (error: any) {
    console.error('세션 삭제 실패:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
