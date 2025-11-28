import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { orderService } from '@/modules/sourcing/domain/src/order'

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

    const result = await orderService.getList({
      userId: user.userId,
      search,
      page,
      limit,
    })

    return NextResponse.json({
      success: true,
      data: result,
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

    // 필수 필드 검증
    const { customerName, productName, totalPrice } = body
    if (!customerName || !productName) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다. (이름, 상품명)' },
        { status: 400 }
      )
    }

    const result = await orderService.create(userId, {
      customerName,
      productName,
      totalPrice,
    })

    return NextResponse.json({
      success: true,
      message: result.isMatched
        ? '주문이 등록되었습니다. (상품 매칭됨)'
        : '주문이 등록되었습니다. (매칭되는 상품 없음)',
      data: result.order,
    })
  } catch (error: any) {
    console.error('주문 생성 실패:', error)

    if (error.message === '사용자를 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '주문 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
