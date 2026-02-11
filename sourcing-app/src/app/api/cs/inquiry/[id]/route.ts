export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

// GET: 문의 상세 조회 (답변 목록 포함)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const inquiryId = parseInt(id)

    if (isNaN(inquiryId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 문의 ID입니다' },
        { status: 400 }
      )
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
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
            phone: true,
          },
        },
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
            shop: {
              select: {
                id: true,
                name: true,
                subdomain: true,
              },
            },
          },
        },
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

    if (!inquiry) {
      return NextResponse.json(
        { success: false, error: '문의를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const { shopProduct, ...rest } = inquiry
    return NextResponse.json({
      success: true,
      inquiry: {
        ...rest,
        product: shopProduct?.product || null,
        shop: shopProduct?.shop || null,
      },
    })
  } catch (error) {
    console.error('Failed to fetch inquiry detail:', error)
    return NextResponse.json(
      { success: false, error: '문의 상세 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
