export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { channelService } from '@/modules/sourcing/domain/src/channel'

// GET: 채널 상세 조회
export async function GET(
  request: NextRequest,
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

    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const channel = await channelService.getById(id, currentUser.userId)

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: channel })
  } catch (error) {
    console.error('[Channel API] 채널 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '채널 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 채널 수정
export async function PUT(
  request: NextRequest,
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

    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, isActive, coverUrl, shopId, minSourcingPrice, maxSourcingPrice, orderDeadline, publishPriceTier } = body

    // 가격 범위는 정수만 허용. 빈 문자열/null은 제거(필드 자체 unset).
    const parsePrice = (v: any): number | null | undefined => {
      if (v === undefined) return undefined // 필드 미전달 → 변경 없음
      if (v === null || v === '') return null // 명시적 해제
      const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, ''), 10)
      return Number.isFinite(n) && n >= 0 ? n : null
    }

    // 다단계 발행: 가격 tier — 'WHOLESALE' | 'RETAIL' 만 허용. 미전달 시 변경 없음.
    const parseTier = (v: any): 'WHOLESALE' | 'RETAIL' | undefined => {
      if (v === undefined || v === null) return undefined
      return v === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL'
    }

    const channel = await channelService.update(id, {
      name,
      isActive,
      coverUrl,
      shopId,
      minSourcingPrice: parsePrice(minSourcingPrice),
      maxSourcingPrice: parsePrice(maxSourcingPrice),
      orderDeadline,
      publishPriceTier: parseTier(publishPriceTier) as any,
    }, currentUser.userId)

    return NextResponse.json({ success: true, data: channel })
  } catch (error: any) {
    console.error('채널 수정 실패:', error)

    if (error.message === '채널을 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '채널 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 채널 삭제
export async function DELETE(
  request: NextRequest,
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

    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    await channelService.delete(id, currentUser.userId)

    return NextResponse.json({
      success: true,
      message: '채널이 삭제되었습니다.',
    })
  } catch (error: any) {
    console.error('채널 삭제 실패:', error)

    if (error.message === '채널을 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '채널 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
