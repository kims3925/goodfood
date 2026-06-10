export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { wholesaleCatalogService } from '@/modules/sourcing/domain/src/channel/services/wholesale-catalog.service'

// POST: 매니저가 카탈로그 도매밴드를 본인 채널로 연결 (신청 즉시 연결)
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const catalogId = parseInt(params.id)
    if (!catalogId) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const channel = await wholesaleCatalogService.connect(currentUser.userId, catalogId)
    return NextResponse.json({ success: true, data: channel })
  } catch (error: any) {
    console.error('카탈로그 연결 실패:', error)
    if (error.message === '이미 연결된 도매밴드입니다.') {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 })
    }
    if (error.message?.includes('찾을 수 없습니다')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 })
    }
    return NextResponse.json(
      { success: false, error: error.message || '카탈로그 연결에 실패했습니다.' },
      { status: 500 }
    )
  }
}
