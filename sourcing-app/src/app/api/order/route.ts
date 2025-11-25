import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, OrderStatus } from '@prisma/client'
import { getCurrentUser } from '@/modules/auth/auth.service'

const prisma = new PrismaClient()

// GET: 주문서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') as OrderStatus | null
    const search = searchParams.get('search') || ''

    // 필터 조건
    const where: any = {
      userId: user.userId,
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { productName: { contains: search } },
      ]
    }

    // 총 개수 조회
    const total = await prisma.order.count({ where })

    // 주문 목록 조회
    const orders = await prisma.order.findMany({
      where,
      orderBy: { orderedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    // 상태별 개수 조회
    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      where: { userId: user.userId },
      _count: { status: true },
    })

    const statusCountMap = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.status
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        statusCounts: statusCountMap,
      },
    })
  } catch (error) {
    console.error('주문서 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문서 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 주문서 생성 (Google Forms 웹훅용)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // API Key 인증 (Google Apps Script에서 전송)
    const apiKey = request.headers.get('x-api-key')
    const userId = parseInt(request.headers.get('x-user-id') || '0')

    if (!apiKey || !userId) {
      return NextResponse.json(
        { success: false, error: 'API 인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 사용자 확인 (간단한 인증)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 필수 필드 검증
    const { customerName, customerPhone, productName } = body
    if (!customerName || !customerPhone || !productName) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 중복 체크 (formResponseId가 있는 경우)
    if (body.formResponseId) {
      const existing = await prisma.order.findFirst({
        where: {
          userId,
          formResponseId: body.formResponseId,
        },
      })

      if (existing) {
        return NextResponse.json({
          success: true,
          message: '이미 등록된 주문입니다.',
          data: existing,
        })
      }
    }

    // 주문 생성
    const order = await prisma.order.create({
      data: {
        userId,
        formResponseId: body.formResponseId || null,
        customerName,
        customerPhone,
        customerAddress: body.customerAddress || null,
        productName,
        productOption: body.productOption || null,
        quantity: body.quantity || 1,
        unitPrice: body.unitPrice || null,
        totalPrice: body.totalPrice || null,
        customerMemo: body.customerMemo || null,
        orderedAt: body.orderedAt ? new Date(body.orderedAt) : new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: '주문이 등록되었습니다.',
      data: order,
    })
  } catch (error) {
    console.error('주문 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
