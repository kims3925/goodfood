export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

// POST: 문의에 답변 추가하기 (다중 답변 지원)
export async function POST(
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

    const body = await request.json()
    const { reply, isAdmin = true } = body

    if (!reply?.trim()) {
      return NextResponse.json(
        { success: false, error: '답변 내용을 입력해 주세요' },
        { status: 400 }
      )
    }

    // 문의 존재 여부 확인
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
    })

    if (!inquiry) {
      return NextResponse.json(
        { success: false, error: '문의를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 새 답변 생성 (InquiryReply 테이블에 추가)
    const newReply = await prisma.inquiryReply.create({
      data: {
        inquiryId,
        content: reply.trim(),
        isAdmin,
      },
    })

    // 문의 상태 업데이트 (관리자 답변인 경우 ANSWERED로)
    if (isAdmin) {
      await prisma.inquiry.update({
        where: { id: inquiryId },
        data: {
          status: 'ANSWERED',
          repliedAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      reply: {
        id: newReply.id,
        content: newReply.content,
        isAdmin: newReply.isAdmin,
        createdAt: newReply.createdAt,
      },
    })
  } catch (error) {
    console.error('Failed to reply to inquiry:', error)
    return NextResponse.json(
      { success: false, error: '답변 등록에 실패했습니다' },
      { status: 500 }
    )
  }
}

// GET: 문의의 모든 답변 조회
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

    const replies = await prisma.inquiryReply.findMany({
      where: { inquiryId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      replies,
    })
  } catch (error) {
    console.error('Failed to fetch replies:', error)
    return NextResponse.json(
      { success: false, error: '답변 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
