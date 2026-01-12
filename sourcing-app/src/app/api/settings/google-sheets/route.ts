export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { settingsService } from '@/modules/config/domain/src/settings'

// GET: 구글 시트 설정 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const settings = await settingsService.getGoogleSheetSettings(currentUser.userId)

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('구글 시트 설정 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '구글 시트 설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 구글 시트 설정 저장
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { serviceAccountJson, spreadsheetId, sheetName } = body

    if (!serviceAccountJson || !spreadsheetId) {
      return NextResponse.json(
        { success: false, error: '서비스 계정 JSON과 스프레드시트 ID는 필수입니다.' },
        { status: 400 }
      )
    }

    const config = await settingsService.saveGoogleSheetSettings(currentUser.userId, {
      serviceAccountJson,
      spreadsheetId,
      sheetName,
    })

    return NextResponse.json({
      success: true,
      data: {
        spreadsheetId: config.spreadsheetId,
        sheetName: config.sheetName,
        isActive: config.isActive,
      }
    })
  } catch (error: any) {
    console.error('구글 시트 설정 저장 실패:', error)

    if (error.message.includes('JSON') || error.message.includes('client_email')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: '구글 시트 설정 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 구글 시트 설정 삭제
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    await settingsService.deleteGoogleSheetSettings(currentUser.userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('구글 시트 설정 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '구글 시트 설정 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
