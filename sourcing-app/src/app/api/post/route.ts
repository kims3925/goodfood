export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { postService } from '@/modules/sourcing/domain/src/post'

// GET: 게시물 목록 조회
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
    const channelIdParam = searchParams.get('channelId')
    const channelId = channelIdParam ? parseInt(channelIdParam) : undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const todayOnly = searchParams.get('todayOnly') === 'true'
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const result = await postService.getList({
      userId: currentUser.userId,
      search,
      channelId,
      page,
      limit,
      todayOnly,
      startDate,
      endDate,
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error('게시물 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '게시물 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 게시물 등록
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
    const { channelId, externalId, title, content, author, comments, images, force } = body

    const finalChannelId = parseInt(channelId)

    if (!finalChannelId || !externalId || !title || !content) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // force=true: 기존 게시물 삭제 후 재등록 (다시소싱하기)
    if (force) {
      await postService.deleteByExternalId(finalChannelId, externalId)
    }

    const post = await postService.create({
      userId: currentUser.userId,
      channelId: finalChannelId,
      externalId,
      title,
      content,
      author,
      comments,
      images,
    })

    return NextResponse.json({ success: true, data: post })
  } catch (error: any) {
    console.error('게시물 등록 실패:', error)

    if (error.message === '이미 등록된 게시물입니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: false, error: '게시물 등록에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 게시물 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, content, author } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const post = await postService.update(id, { title, content, author })

    return NextResponse.json({ success: true, data: post })
  } catch (error: any) {
    console.error('게시물 수정 실패:', error)

    if (error.message === '게시물을 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '게시물 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 게시물 삭제
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

    await postService.delete(parseInt(id))

    return NextResponse.json({
      success: true,
      message: '게시물이 삭제되었습니다.',
    })
  } catch (error: any) {
    console.error('게시물 삭제 실패:', error)

    if (error.message === '게시물을 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '게시물 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
