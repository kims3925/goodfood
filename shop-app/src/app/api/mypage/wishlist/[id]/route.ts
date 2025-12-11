import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@modules/common/utils/src/database/client'

// 찜한 상품 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const wishlistId = parseInt(params.id)

    if (isNaN(wishlistId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 요청입니다' },
        { status: 400 }
      )
    }

    // 본인의 찜한 상품인지 확인
    const wishlist = await prisma.wishlist.findUnique({
      where: { id: wishlistId },
    })

    if (!wishlist) {
      return NextResponse.json(
        { success: false, error: '찜한 상품을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (wishlist.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      )
    }

    await prisma.wishlist.delete({
      where: { id: wishlistId },
    })

    return NextResponse.json({
      success: true,
      message: '찜한 상품에서 삭제되었습니다',
    })
  } catch (error) {
    console.error('Failed to delete wishlist:', error)
    return NextResponse.json(
      { success: false, error: '삭제에 실패했습니다' },
      { status: 500 }
    )
  }
}
