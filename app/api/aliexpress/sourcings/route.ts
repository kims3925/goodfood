import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET: 모든 AliExpress 소싱 설정 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

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

    // 사용자의 모든 AliExpress 소싱 설정 조회 (상품 개수 포함)
    const sourcings = await prisma.aliExpressSourcing.findMany({
      where: {
        userId: actualUser.id
      },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      sourcings: sourcings.map(sourcing => ({
        ...sourcing,
        productCount: sourcing._count.products
      }))
    })

  } catch (error) {
    console.error('소싱 설정 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: '소싱 설정을 조회할 수 없습니다.'
    }, { status: 500 })
  }
}

// POST: 새로운 AliExpress 소싱 설정 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const body = await request.json()
    const { searchType, searchValue, pricingPolicy, collectReviews } = body

    // 입력값 검증
    if (!searchType || !searchValue) {
      return NextResponse.json({
        success: false,
        error: '검색 타입과 검색값은 필수입니다.'
      }, { status: 400 })
    }

    if (!['keyword', 'category'].includes(searchType)) {
      return NextResponse.json({
        success: false,
        error: '검색 타입은 "keyword" 또는 "category"여야 합니다.'
      }, { status: 400 })
    }

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

    // 새로운 소싱 설정 생성
    const newSourcing = await prisma.aliExpressSourcing.create({
      data: {
        userId: actualUser.id,
        searchType,
        searchValue,
        pricingPolicy: pricingPolicy || null,
        collectReviews: collectReviews || false
      }
    })

    console.log(`✅ AliExpress 소싱 설정 생성: ${newSourcing.id} (${searchType}: ${searchValue})`)

    return NextResponse.json({
      success: true,
      message: 'AliExpress 소싱 설정이 생성되었습니다.',
      sourcing: newSourcing
    })

  } catch (error) {
    console.error('소싱 설정 생성 실패:', error)
    return NextResponse.json({
      success: false,
      error: '소싱 설정을 생성할 수 없습니다.'
    }, { status: 500 })
  }
}
