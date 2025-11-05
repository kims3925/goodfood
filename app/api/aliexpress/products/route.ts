import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET: AliExpress 수집 상품 조회 (필터링 및 페이징)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // URL 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url)
    const sourcingId = searchParams.get('sourcingId')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // 실제 사용자 ID 찾기
    let actualUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    })

    if (!actualUser) {
      actualUser = await prisma.user.findUnique({
        where: { email: session.user.email || '' },
        select: { id: true }
      })
    }

    if (!actualUser) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 필터 조건 구성
    const where: any = {
      userId: actualUser.id
    }

    if (sourcingId) {
      where.sourcingId = sourcingId
    }

    if (status) {
      where.status = status
    }

    if (category && category !== 'ALL') {
      where.productCategory = category
    }

    // 전체 개수 조회
    const totalCount = await prisma.aliExpressProduct.count({ where })

    // 상품 조회 (페이징)
    const products = await prisma.aliExpressProduct.findMany({
      where,
      include: {
        sourcing: {
          select: {
            searchType: true,
            searchValue: true,
            pricingPolicy: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    })

    return NextResponse.json({
      success: true,
      products,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error('AliExpress 상품 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'AliExpress 상품을 조회할 수 없습니다.'
    }, { status: 500 })
  }
}
