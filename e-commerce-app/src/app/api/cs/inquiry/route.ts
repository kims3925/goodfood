import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma, { InquiryType } from '@bandauto/db'

// GET: 로그인한 사용자의 문의 목록 조회
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const inquiries = await prisma.inquiry.findMany({
      where: {
        userId: Number(session.user.id),
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        inquiryType: true,
        title: true,
        content: true,
        status: true,
        adminReply: true,
        repliedAt: true,
        createdAt: true,
        replies: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            isAdmin: true,
            createdAt: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      inquiries,
    })
  } catch (error) {
    console.error('Failed to fetch inquiries:', error)
    return NextResponse.json(
      { success: false, error: '문의 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// POST: 새 문의 등록
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { inquiryType, title, content, productId } = body

    // 유효성 검사
    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: '제목을 입력해 주세요' },
        { status: 400 }
      )
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: '내용을 입력해 주세요' },
        { status: 400 }
      )
    }

    // InquiryType 유효성 검사
    const validTypes: InquiryType[] = ['PRODUCT', 'DELIVERY', 'ORDER', 'PAYMENT', 'RETURN', 'EXCHANGE', 'GENERAL']
    if (!validTypes.includes(inquiryType as InquiryType)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 문의 유형입니다' },
        { status: 400 }
      )
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        userId: Number(session.user.id),
        productId: productId ? Number(productId) : null,
        inquiryType: inquiryType as InquiryType,
        title: title.trim(),
        content: content.trim(),
        isPrivate: true,
      },
    })

    return NextResponse.json({
      success: true,
      inquiry: {
        id: inquiry.id,
        inquiryType: inquiry.inquiryType,
        title: inquiry.title,
        status: inquiry.status,
        createdAt: inquiry.createdAt,
      },
    })
  } catch (error) {
    console.error('Failed to create inquiry:', error)
    return NextResponse.json(
      { success: false, error: '문의 등록에 실패했습니다' },
      { status: 500 }
    )
  }
}
