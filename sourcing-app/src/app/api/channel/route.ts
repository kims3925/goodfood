import { NextRequest, NextResponse } from 'next/server'
import { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { channelService } from '@/modules/sourcing/domain/src/channel'

// GET: 채널 목록 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const kind = searchParams.get('kind') as ChannelKind | null
    const platform = searchParams.get('platform') as ChannelPlatform | null
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')

    const result = await channelService.getList({
      userId: currentUser.userId,
      search,
      page,
      limit,
      ...(kind && { kind }),
      ...(platform && { platform }),
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error('채널 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '채널 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 채널 등록
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
    const { channelKey, name, kind, platform, coverUrl } = body

    if (!channelKey || !name || !kind || !platform) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const channel = await channelService.create(currentUser.userId, {
      channelKey,
      name,
      kind,
      platform,
      coverUrl: coverUrl || null,
    })

    return NextResponse.json({ success: true, data: channel })
  } catch (error: any) {
    console.error('채널 등록 실패:', error)

    if (error.message === 'API 설정을 먼저 등록해주세요.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }
    if (error.message === '이미 등록된 채널입니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }

    // Prisma unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: '중복된 데이터가 존재합니다.' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: false, error: error.message || '채널 등록에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 채널 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, isActive, coverUrl } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const channel = await channelService.update(id, {
      name,
      isActive,
      coverUrl,
    })

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
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }

    await channelService.delete(parseInt(id))

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

    // 주문이 있어서 삭제 불가능한 경우
    if (error.message?.includes('주문이 있어 삭제할 수 없습니다')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: '채널 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
