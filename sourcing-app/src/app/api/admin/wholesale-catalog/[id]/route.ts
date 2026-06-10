export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { wholesaleCatalogService } from '@/modules/sourcing/domain/src/channel/services/wholesale-catalog.service'

async function requireAdmin() {
  const user = await getCurrentUser(true)
  if (!user || user.role !== 'ADMIN') return null
  return user
}

// PUT: 카탈로그 항목 수정 (어드민)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'ADMIN 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const id = parseInt(params.id)
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const entry = await wholesaleCatalogService.update(id, {
      name: body.name,
      description: body.description,
      bandNo: body.bandNo != null && body.bandNo !== '' ? Number(body.bandNo) : body.bandNo === null ? null : undefined,
      isActive: body.isActive,
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : undefined,
      sourceChannelId:
        body.sourceChannelId === null
          ? null
          : body.sourceChannelId != null
            ? Number(body.sourceChannelId)
            : undefined,
    })

    return NextResponse.json({ success: true, data: entry })
  } catch (error: any) {
    console.error('카탈로그 수정 실패:', error)
    const notFound = error.message?.includes('찾을 수 없습니다')
    return NextResponse.json(
      { success: false, error: error.message || '카탈로그 수정에 실패했습니다.' },
      { status: notFound ? 404 : 500 }
    )
  }
}

// DELETE: 카탈로그 항목 소프트 삭제 (어드민) — 기존 연결 채널은 유지
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'ADMIN 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const id = parseInt(params.id)
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }

    await wholesaleCatalogService.delete(id)
    return NextResponse.json({ success: true, message: '카탈로그에서 제거되었습니다.' })
  } catch (error: any) {
    console.error('카탈로그 삭제 실패:', error)
    const notFound = error.message?.includes('찾을 수 없습니다')
    return NextResponse.json(
      { success: false, error: error.message || '카탈로그 삭제에 실패했습니다.' },
      { status: notFound ? 404 : 500 }
    )
  }
}
