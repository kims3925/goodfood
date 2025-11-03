import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// 개별 밴드 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const bandId = params.id

    // 밴드 존재 여부 및 소유권 확인
    const band = await prisma.wholesaleBand.findUnique({
      where: { id: bandId }
    })

    if (!band) {
      return NextResponse.json({
        success: false,
        error: '밴드를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 실제 사용자 ID 찾기
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

    // 소유권 확인
    if (band.userId !== actualUser.id) {
      return NextResponse.json({
        success: false,
        error: '이 밴드를 삭제할 권한이 없습니다.'
      }, { status: 403 })
    }

    // 밴드와 연관된 데이터 확인
    const relatedPostsCount = await prisma.collectedPost.count({
      where: { wholesaleBandId: band.id }
    })

    // 밴드 삭제 (Cascade로 관련 데이터도 자동 삭제됨)
    await prisma.wholesaleBand.delete({
      where: { id: bandId }
    })

    return NextResponse.json({
      success: true,
      message: `"${band.name}" 밴드가 삭제되었습니다.`,
      deletedPostsCount: relatedPostsCount
    })

  } catch (error: any) {
    console.error('밴드 삭제 실패:', error)
    return NextResponse.json({
      success: false,
      error: '밴드 삭제 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}
