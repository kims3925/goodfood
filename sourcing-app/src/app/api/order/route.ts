import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@bandauto/db'
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
    const search = searchParams.get('search') || ''

    // 필터 조건
    const where: any = {
      userId: user.userId,
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { productName: { contains: search } },
      ]
    }

    // 총 개수 조회
    const total = await prisma.orderTest.count({ where })

    // 주문 목록 조회 (상품 정보 포함)
    const orders = await prisma.orderTest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
          },
        },
      },
    })

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

    // 사용자 확인
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
    const { customerName, productName } = body
    if (!customerName || !productName) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다. (이름, 상품명)' },
        { status: 400 }
      )
    }

    // 상품명으로 Product 매칭 시도 (정확히 일치하거나 포함하는 경우)
    let productId: number | null = null
    const matchedProduct = await prisma.product.findFirst({
      where: {
        userId,
        OR: [
          { name: productName }, // 정확히 일치
          { name: { contains: productName } }, // 포함
        ],
      },
      select: { id: true },
    })

    if (matchedProduct) {
      productId = matchedProduct.id
    }

    // 테스트 주문 생성
    const order = await prisma.orderTest.create({
      data: {
        userId,
        productId,
        productName,
        totalPrice: body.totalPrice || null,
        customerName,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: productId
        ? '주문이 등록되었습니다. (상품 매칭됨)'
        : '주문이 등록되었습니다. (매칭되는 상품 없음)',
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
