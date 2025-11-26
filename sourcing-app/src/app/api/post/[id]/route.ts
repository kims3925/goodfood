import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@bandauto/db'

const prisma = new PrismaClient()

// GET: 특정 게시물 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    const post = await prisma.post.findFirst({
      where: {
        id,
      },
      include: {
        wholesaleBand: {
          select: {
            id: true,
            name: true,
            bandKey: true,
            coverUrl: true,
          },
        },
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        images: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        comments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!post) {
      return NextResponse.json(
        {
          success: false,
          error: '게시물을 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: post,
    })
  } catch (error) {
    console.error('게시물 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '게시물 조회에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}
