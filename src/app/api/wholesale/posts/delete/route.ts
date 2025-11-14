import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const postIdStr = searchParams.get('id')

    if (!postIdStr) {
      return NextResponse.json({
        success: false,
        error: '게시물 ID가 필요합니다.'
      }, { status: 400 })
    }

    const postId = parseInt(postIdStr, 10)
    const userId = parseInt(session.user.id, 10)

    // 해당 게시물이 사용자의 것인지 확인하고 삭제
    const deletedPost = await prisma.collectedPost.deleteMany({
      where: {
        id: postId,
        userId: userId
      }
    })

    if (deletedPost.count === 0) {
      return NextResponse.json({
        success: false,
        error: '해당 게시물을 찾을 수 없거나 삭제할 권한이 없습니다.'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: '게시물이 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('게시물 삭제 실패:', error)
    return NextResponse.json({
      success: false,
      error: '게시물을 삭제할 수 없습니다.'
    }, { status: 500 })
  }
}