export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { settingsService } from '@/modules/config/domain/src/settings'

// GET: API 설정 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const settings = await settingsService.getApiSettings(currentUser.userId)

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('API 설정 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: 'API 설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: API 설정 저장
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
    const { provider, settings } = body

    console.log('[API 설정 저장] 요청 받음:', { provider, settings })

    const config = await settingsService.saveApiSettings(currentUser.userId, provider, settings)

    return NextResponse.json({ success: true, data: config })
  } catch (error: any) {
    console.error('API 설정 저장 실패:', error)

    if (error.message === '지원하지 않는 플랫폼입니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'API 설정 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}
