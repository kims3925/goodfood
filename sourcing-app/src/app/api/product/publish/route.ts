export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/product/publish
 *
 * Get channel published products list with filtering and pagination
 * (채널 발행 목록 조회 - RETAIL kind 채널만)
 *
 * Query Parameters:
 * - search?: string (searches in product name, channel name)
 * - channelId?: number
 * - page?: number (default: 1)
 * - limit?: number (default: 10)
 *
 * Response:
 * - success: boolean
 * - data?: ChannelProduct[]
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
    const channelId = searchParams.get('channelId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build where clause - 채널 발행 조회 (RETAIL kind 채널만)
    const where: any = {
      userId,
      channel: {
        kind: ChannelKind.RETAIL,
      },
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
    const total = await prisma.channelProduct.count({ where })

    // Get channel products with relations
    const channelProducts = await prisma.channelProduct.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
            variants: {
              select: {
                id: true,
                price: true,
              },
              take: 1,
            },
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
      data: channelProducts,
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
 * Delete channel published product
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

    // Check channel product exists and belongs to user
    const channelProduct = await prisma.channelProduct.findFirst({
      where: {
        id,
        userId,
      },
    })

    if (!channelProduct) {
      return NextResponse.json(
        { success: false, error: '발행 상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Soft delete channel product
    await prisma.channelProduct.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
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
