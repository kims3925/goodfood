import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'

// PUT: 정산 상태 변경 (현재는 기능 없음)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Settlement 모델이 없으므로 기능 없음
    return NextResponse.json({
      success: false,
      error: '정산 이력 기능이 아직 구현되지 않았습니다.',
    })
  } catch (error) {
    console.error('정산 상태 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 상태 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 정산 삭제 (현재는 기능 없음)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Settlement 모델이 없으므로 기능 없음
    return NextResponse.json({
      success: false,
      error: '정산 이력 기능이 아직 구현되지 않았습니다.',
    })
  } catch (error) {
    console.error('정산 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
