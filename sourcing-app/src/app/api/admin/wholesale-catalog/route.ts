export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { wholesaleCatalogService } from '@/modules/sourcing/domain/src/channel/services/wholesale-catalog.service'

async function requireAdmin() {
  const user = await getCurrentUser(true)
  if (!user || user.role !== 'ADMIN') return null
  return user
}

// GET: 카탈로그 전체 목록 (어드민)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'ADMIN 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const data = await wholesaleCatalogService.listForAdmin()
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('카탈로그 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '카탈로그 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 카탈로그 가등록 (어드민) — channelId(본인 채널에서 가져오기) 또는 수동 입력
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'ADMIN 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const entry = await wholesaleCatalogService.create(admin.userId, {
      channelId: body.channelId ? Number(body.channelId) : undefined,
      bandKey: body.bandKey,
      bandNo: body.bandNo != null && body.bandNo !== '' ? Number(body.bandNo) : null,
      name: body.name,
      description: body.description ?? null,
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : undefined,
    })

    return NextResponse.json({ success: true, data: entry })
  } catch (error: any) {
    console.error('카탈로그 등록 실패:', error)
    const known =
      error.message?.includes('이미 카탈로그') ||
      error.message?.includes('필수') ||
      error.message?.includes('본인 소유')
    return NextResponse.json(
      { success: false, error: error.message || '카탈로그 등록에 실패했습니다.' },
      { status: known ? 400 : 500 }
    )
  }
}
