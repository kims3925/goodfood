import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { policyService } from '@/modules/config/domain/src/policy'

// GET: 정책 목록 조회
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
    const channelId = searchParams.get('channelId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const result = await policyService.getList({
      userId: currentUser.userId,
      search,
      page,
      limit,
      ...(channelId && { channelId: parseInt(channelId) }),
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error('정책 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '정책 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 정책 등록
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
    const { channelId, name, description, content, isActive = true } = body

    if (!channelId || !name || !content) {
      return NextResponse.json(
        { success: false, error: '채널, 정책 이름, 내용은 필수입니다.' },
        { status: 400 }
      )
    }

    const policy = await policyService.create({
      userId: currentUser.userId,
      channelId,
      name,
      description,
      content,
      isActive,
    })

    return NextResponse.json({ success: true, data: policy })
  } catch (error) {
    console.error('정책 등록 실패:', error)
    return NextResponse.json(
      { success: false, error: '정책 등록에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 정책 수정
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, channelId, name, description, content, isActive } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const policy = await policyService.update(id, { channelId, name, description, content, isActive })

    return NextResponse.json({ success: true, data: policy })
  } catch (error: any) {
    console.error('정책 수정 실패:', error)

    if (error.message === '정책을 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '정책 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 정책 삭제
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }

    await policyService.delete(parseInt(id))

    return NextResponse.json({
      success: true,
      message: '정책이 삭제되었습니다.',
    })
  } catch (error: any) {
    console.error('정책 삭제 실패:', error)

    if (error.message === '정책을 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '정책 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
