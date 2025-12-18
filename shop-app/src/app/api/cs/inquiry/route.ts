export const dynamic = 'force-dynamic'

/**
 * Inquiry API
 * 고객 문의 등록 및 조회
 * InquiryService 사용
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import { getInquiryService } from '@/modules/cs/services/inquiry.service'

const inquiryService = getInquiryService()

/**
 * GET /api/cs/inquiry
 * 로그인한 사용자의 문의 목록 조회
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = Number(session.user.id)
    const inquiries = await inquiryService.findByUserId(userId)

    return NextResponse.json({
      success: true,
      inquiries,
    })
  } catch (error: any) {
    console.error('Failed to fetch inquiries:', error)

    // ValidationError
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: '문의 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cs/inquiry
 * 새 문의 등록
 */
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
    const { inquiryType, title, content, publishedProductId, productId } = body

    const userId = Number(session.user.id)
    const inquiry = await inquiryService.createInquiry({
      userId,
      inquiryType,
      title,
      content,
      publishedProductId: publishedProductId
        ? Number(publishedProductId)
        : productId
          ? Number(productId)
          : undefined,
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
  } catch (error: any) {
    console.error('Failed to create inquiry:', error)

    // ValidationError
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: '문의 등록에 실패했습니다' },
      { status: 500 }
    )
  }
}
