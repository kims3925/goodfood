import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { bandId, collectComments } = await request.json()

    if (!bandId || typeof collectComments !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 요청 데이터입니다.'
      }, { status: 400 })
    }

    // 실제 사용자 ID 찾기 (ID 또는 이메일로)
    let actualUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    })

    if (!actualUser) {
      actualUser = await prisma.user.findUnique({
        where: { email: session.user.email || '' },
        select: { id: true }
      })
    }

    if (!actualUser) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 해당 밴드가 사용자의 것인지 확인하고 업데이트
    const updatedBand = await prisma.wholesaleBand.updateMany({
      where: {
        id: bandId,
        userId: actualUser.id
      },
      data: {
        collectComments
      }
    })

    if (updatedBand.count === 0) {
      return NextResponse.json({
        success: false,
        error: '해당 밴드에 접근할 수 없습니다.'
      }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      message: `댓글 수집이 ${collectComments ? '활성화' : '비활성화'}되었습니다.`
    })

  } catch (error) {
    console.error('댓글 수집 설정 변경 실패:', error)
    return NextResponse.json({
      success: false,
      error: '댓글 수집 설정을 변경할 수 없습니다.'
    }, { status: 500 })
  }
}