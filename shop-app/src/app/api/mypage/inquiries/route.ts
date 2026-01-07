export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@modules/common/utils/src/database/client'

// 내 문의 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const inquiries = await prisma.inquiry.findMany({
      where: {
        userId,
      },
      include: {
        shopProduct: {
          select: {
            id: true,
            product: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
              },
            },
          },
        },
        replies: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      inquiries,
    })
  } catch (error) {
    console.error('Failed to fetch inquiries:', error)
    return NextResponse.json(
      { success: false, error: '문의 내역을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// 문의 작성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const { shopProductId, productId, inquiryType, title, content, isPrivate } =
      await request.json()

    if (!inquiryType || !title || !content) {
      return NextResponse.json(
        { success: false, error: '필수 정보를 입력해주세요' },
        { status: 400 }
      )
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        userId,
        shopProductId: shopProductId
          ? Number(shopProductId)
          : productId
            ? Number(productId)
            : null,
        inquiryType,
        title,
        content,
        isPrivate: isPrivate || false,
      },
      include: {
        shopProduct: {
          select: {
            id: true,
            product: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: '문의가 등록되었습니다',
      inquiry,
    })
  } catch (error) {
    console.error('Failed to create inquiry:', error)
    return NextResponse.json(
      { success: false, error: '문의 등록에 실패했습니다' },
      { status: 500 }
    )
  }
}
