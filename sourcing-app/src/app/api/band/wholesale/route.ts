import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { wholesaleBandService } from '@/modules/sourcing/domain/src/band'

// GET: 도매밴드 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const result = await wholesaleBandService.getList({ search, page, limit })

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error('도매밴드 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '도매밴드 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 도매밴드 등록
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
    const { bandKey, name, coverUrl } = body

    if (!bandKey || !name) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const band = await wholesaleBandService.create(currentUser.userId, {
      bandKey,
      name,
      coverUrl,
    })

    return NextResponse.json({ success: true, data: band })
  } catch (error: any) {
    console.error('도매밴드 등록 실패:', error)

    if (error.message === 'Band API 설정을 먼저 등록해주세요.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }
    if (error.message === '이미 등록된 밴드입니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: false, error: '도매밴드 등록에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 도매밴드 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, isActive } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const band = await wholesaleBandService.update(id, { name, isActive })

    return NextResponse.json({ success: true, data: band })
  } catch (error: any) {
    console.error('도매밴드 수정 실패:', error)

    if (error.message === '밴드를 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '도매밴드 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 도매밴드 삭제
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

    await wholesaleBandService.delete(parseInt(id))

    return NextResponse.json({
      success: true,
      message: '도매밴드가 삭제되었습니다.',
    })
  } catch (error: any) {
    console.error('도매밴드 삭제 실패:', error)

    if (error.message === '밴드를 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '도매밴드 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
