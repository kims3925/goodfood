import { NextRequest, NextResponse } from 'next/server'
import prisma, { InquiryType, InquiryStatus } from '@bandauto/db'

// GET: 모든 문의 목록 조회 (관리자용)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    const where: {
      inquiryType?: InquiryType
      status?: InquiryStatus
    } = {}

    // 필터 적용
    if (type && type !== 'ALL') {
      where.inquiryType = type as InquiryType
    }
    if (status && status !== 'ALL') {
      where.status = status as InquiryStatus
    }

    const inquiries = await prisma.inquiry.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // PENDING first
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        inquiryType: true,
        title: true,
        content: true,
        status: true,
        adminReply: true,
        repliedAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        replies: {
          select: { id: true },
        },
      },
    })

    // 응답 형식 변환 (replyCount 추가)
    const formattedInquiries = inquiries.map(({ replies, ...inquiry }) => ({
      ...inquiry,
      replyCount: replies?.length || 0,
    }))

    return NextResponse.json({
      success: true,
      inquiries: formattedInquiries,
    })
  } catch (error) {
    console.error('Failed to fetch inquiries:', error)
    return NextResponse.json(
      { success: false, error: '문의 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
