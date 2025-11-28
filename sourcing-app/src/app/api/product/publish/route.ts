import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/product/publish
 *
 * Get published products list with filtering and pagination
 *
 * Query Parameters:
 * - search?: string (searches in product name, retail band name)
 * - status?: 'PENDING' | 'SUCCESS' | 'FAILED'
 * - retailBandId?: number
 * - page?: number (default: 1)
 * - limit?: number (default: 10)
 *
 * Response:
 * - success: boolean
 * - data?: ProductPublish[]
 * - total?: number
 * - page?: number
 * - limit?: number
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const retailBandId = searchParams.get('retailBandId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build where clause
    const where: any = {
      userId,
    }

    if (status) {
      where.status = status
    }

    if (retailBandId) {
      where.retailBandId = parseInt(retailBandId)
    }

    if (search) {
      where.OR = [
        { product: { name: { contains: search } } },
        { retailBand: { name: { contains: search } } },
      ]
    }

    // Get total count
    const total = await prisma.productPublish.count({ where })

    // Get published products with relations
    const publishedProducts = await prisma.productPublish.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
            price: true,
            wholesalePrice: true,
          },
        },
        retailBand: {
          select: {
            id: true,
            name: true,
            bandKey: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: publishedProducts,
      total,
      page,
      limit,
    })
  } catch (error) {
    console.error('발행 상품 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행 상품 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/product/publish
 *
 * Delete published product
 *
 * Query Parameters:
 * - id: number
 *
 * Response:
 * - success: boolean
 */
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')

    if (!idParam) {
      return NextResponse.json(
        { success: false, error: 'id가 필요합니다.' },
        { status: 400 }
      )
    }

    const id = parseInt(idParam, 10)
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 id입니다.' },
        { status: 400 }
      )
    }

    // Check published product exists and belongs to user
    const publishedProduct = await prisma.productPublish.findFirst({
      where: {
        id,
        userId,
      },
    })

    if (!publishedProduct) {
      return NextResponse.json(
        { success: false, error: '발행 상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Delete published product
    await prisma.productPublish.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('발행 상품 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행 상품 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
