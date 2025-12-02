import { NextRequest, NextResponse } from 'next/server'
import { channelService } from '@/modules/sourcing/domain/src/channel'

// GET: 채널 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const channel = await channelService.getById(id)

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: channel })
  } catch (error) {
    console.error('채널 조회 실패:', error)
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
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, isActive, coverUrl, accountHolder, bankAccount, bankName } = body

    const channel = await channelService.update(id, {
      name,
      isActive,
      coverUrl,
      accountHolder,
      bankAccount,
      bankName,
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    await channelService.delete(id)

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
