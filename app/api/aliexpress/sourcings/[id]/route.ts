import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET: 특정 소싱 설정 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const sourcingId = params.id

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

    // 소싱 설정 조회 (권한 확인 포함)
    const sourcing = await prisma.aliExpressSourcing.findFirst({
      where: {
        id: sourcingId,
        userId: actualUser.id
      },
      include: {
        _count: {
          select: {
            products: true
          }
        },
        products: {
          take: 10,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!sourcing) {
      return NextResponse.json({
        success: false,
        error: '소싱 설정을 찾을 수 없거나 접근 권한이 없습니다.'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      sourcing: {
        ...sourcing,
        productCount: sourcing._count.products
      }
    })

  } catch (error) {
    console.error('소싱 설정 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: '소싱 설정을 조회할 수 없습니다.'
    }, { status: 500 })
  }
}

// PATCH: 소싱 설정 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const sourcingId = params.id
    const body = await request.json()
    const { searchType, searchValue, pricingPolicy, collectReviews } = body

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

    // 소싱 설정 존재 및 권한 확인
    const existingSourcing = await prisma.aliExpressSourcing.findFirst({
      where: {
        id: sourcingId,
        userId: actualUser.id
      }
    })

    if (!existingSourcing) {
      return NextResponse.json({
        success: false,
        error: '소싱 설정을 찾을 수 없거나 접근 권한이 없습니다.'
      }, { status: 404 })
    }

    // 업데이트할 데이터 준비
    const updateData: any = {}
    if (searchType !== undefined) updateData.searchType = searchType
    if (searchValue !== undefined) updateData.searchValue = searchValue
    if (pricingPolicy !== undefined) updateData.pricingPolicy = pricingPolicy
    if (collectReviews !== undefined) updateData.collectReviews = collectReviews

    // 소싱 설정 업데이트
    const updatedSourcing = await prisma.aliExpressSourcing.update({
      where: {
        id: sourcingId
      },
      data: updateData
    })

    console.log(`✅ AliExpress 소싱 설정 수정: ${updatedSourcing.id}`)

    return NextResponse.json({
      success: true,
      message: '소싱 설정이 수정되었습니다.',
      sourcing: updatedSourcing
    })

  } catch (error) {
    console.error('소싱 설정 수정 실패:', error)
    return NextResponse.json({
      success: false,
      error: '소싱 설정을 수정할 수 없습니다.'
    }, { status: 500 })
  }
}

// DELETE: 소싱 설정 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const sourcingId = params.id

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

    // 소싱 설정 존재 및 권한 확인
    const existingSourcing = await prisma.aliExpressSourcing.findFirst({
      where: {
        id: sourcingId,
        userId: actualUser.id
      },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    })

    if (!existingSourcing) {
      return NextResponse.json({
        success: false,
        error: '소싱 설정을 찾을 수 없거나 접근 권한이 없습니다.'
      }, { status: 404 })
    }

    // 연결된 상품들도 함께 삭제 (CASCADE)
    await prisma.aliExpressProduct.deleteMany({
      where: {
        sourcingId: sourcingId
      }
    })

    // 소싱 설정 삭제
    await prisma.aliExpressSourcing.delete({
      where: {
        id: sourcingId
      }
    })

    console.log(`🗑️ AliExpress 소싱 설정 삭제: ${sourcingId} (상품 ${existingSourcing._count.products}개 함께 삭제)`)

    return NextResponse.json({
      success: true,
      message: `소싱 설정이 삭제되었습니다. (상품 ${existingSourcing._count.products}개 함께 삭제)`
    })

  } catch (error) {
    console.error('소싱 설정 삭제 실패:', error)
    return NextResponse.json({
      success: false,
      error: '소싱 설정을 삭제할 수 없습니다.'
    }, { status: 500 })
  }
}
