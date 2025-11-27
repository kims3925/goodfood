import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import { PrismaClient } from '@bandauto/db'

const prisma = new PrismaClient()

// 취소/반품 내역 조회
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

    const returnRequests = await prisma.returnRequest.findMany({
      where: {
        userId,
      },
      orderBy: {
        requestedAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      returnRequests,
    })
  } catch (error) {
    console.error('Failed to fetch return requests:', error)
    return NextResponse.json(
      { success: false, error: '취소/반품 내역을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// 취소/반품 요청
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

    const {
      orderId,
      requestType,
      reason,
      reasonDetail,
      refundMethod,
      bankName,
      accountNumber,
      accountHolder,
      images,
    } = await request.json()

    if (!orderId || !requestType || !reason || !refundMethod) {
      return NextResponse.json(
        { success: false, error: '필수 정보를 입력해주세요' },
        { status: 400 }
      )
    }

    // 주문 확인
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      )
    }

    // 이미 취소/반품 요청이 있는지 확인
    const existingRequest = await prisma.returnRequest.findFirst({
      where: {
        orderId,
        status: {
          notIn: ['REJECTED', 'COMPLETED'],
        },
      },
    })

    if (existingRequest) {
      return NextResponse.json(
        { success: false, error: '이미 처리중인 요청이 있습니다' },
        { status: 400 }
      )
    }

    const returnRequest = await prisma.returnRequest.create({
      data: {
        userId,
        orderId,
        requestType,
        reason,
        reasonDetail,
        refundAmount: order.totalAmount,
        refundMethod,
        bankName,
        accountNumber,
        accountHolder,
        images: images ? JSON.stringify(images) : null,
      },
    })

    return NextResponse.json({
      success: true,
      message: '요청이 접수되었습니다',
      returnRequest,
    })
  } catch (error) {
    console.error('Failed to create return request:', error)
    return NextResponse.json(
      { success: false, error: '요청 처리에 실패했습니다' },
      { status: 500 }
    )
  }
}
