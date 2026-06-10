export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { wholesaleCatalogService } from '@/modules/sourcing/domain/src/channel/services/wholesale-catalog.service'

// GET: 매니저용 카탈로그 목록 (활성 항목 + 본인 연결 여부)
export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const data = await wholesaleCatalogService.listForManager(currentUser.userId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('카탈로그 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '카탈로그 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
