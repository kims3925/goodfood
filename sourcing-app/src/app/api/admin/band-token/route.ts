export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { settingsService } from '@/modules/config/domain/src/settings'

async function requireAdmin() {
  const user = await getCurrentUser(true)
  if (!user || user.role !== 'ADMIN') return null
  return user
}

// GET: 플랫폼 공용 Band 토큰 상태 (토큰 끝 4자리만 노출)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'ADMIN 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const info = await settingsService.getGlobalBandTokenInfo()
    return NextResponse.json({ success: true, data: info })
  } catch (error) {
    console.error('플랫폼 Band 토큰 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 플랫폼 공용 Band 토큰 저장 — 일괄설정 모드 매니저 전체에 즉시 적용
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'ADMIN 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const accessToken = (body.accessToken || '').trim()
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Access Token을 입력해 주세요.' },
        { status: 400 }
      )
    }

    await settingsService.saveGlobalBandToken(admin.userId, accessToken)
    const info = await settingsService.getGlobalBandTokenInfo()
    return NextResponse.json({ success: true, data: info })
  } catch (error) {
    console.error('플랫폼 Band 토큰 저장 실패:', error)
    return NextResponse.json(
      { success: false, error: '저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}
