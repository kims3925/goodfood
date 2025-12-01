import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/product/publish
 *
 * Get published products list with filtering and pagination
 *
 * Query Parameters:
 * - search?: string (searches in product name, channel name)
 * - status?: 'PENDING' | 'SUCCESS' | 'FAILED'
 * - channelId?: number (하위 호환: channelId도 지원)
 * - page?: number (default: 1)
 * - limit?: number (default: 10)
 *
 * Response:
 * - success: boolean
 * - data?: PublishedProduct[]
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
    // 하위 호환성: channelId 또는 channelId 지원
    const channelId = searchParams.get('channelId') || searchParams.get('channelId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build where clause - 채널 발행 조회 (RETAIL kind 채널만)
    const where: any = {
      userId,
      channel: {
        kind: ChannelKind.RETAIL,
      },
    }

    if (status) {
      where.status = status
    }

    if (channelId) {
      where.channelId = parseInt(channelId)
    }

    if (search) {
      where.OR = [
        { product: { name: { contains: search } } },
        { channel: { name: { contains: search } } },
      ]
    }

    // Get total count
    const total = await prisma.publishedProduct.count({ where })

    // Get published products with relations
    const publishedProducts = await prisma.publishedProduct.findMany({
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
        channel: {
          select: {
            id: true,
            name: true,
            channelKey: true,
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
    const publishedProduct = await prisma.publishedProduct.findFirst({
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
    await prisma.publishedProduct.delete({
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
