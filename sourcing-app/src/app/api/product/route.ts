import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'

/**
 * GET /api/product
 *
 * Get products list with filtering and pagination
 *
 * Query Parameters:
 * - postId?: number
 * - search?: string (searches in name, description)
 * - wholesaleBandId?: number (filter by source band)
 * - status?: string (filter by status: DRAFT, ACTIVE, INACTIVE, SOLDOUT)
 * - startDate?: string (filter by created date, ISO format)
 * - endDate?: string (filter by created date, ISO format)
 * - page?: number (default: 1)
 * - limit?: number (default: 20)
 *
 * Response:
 * - success: boolean
 * - data?: Product[]
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
    const postId = searchParams.get('postId')
    const search = searchParams.get('search')
    const wholesaleBandId = searchParams.get('wholesaleBandId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build where clause
    const where: any = {
      userId,
    }

    if (postId) {
      where.postId = parseInt(postId)
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    // Filter by wholesale band
    if (wholesaleBandId) {
      where.post = {
        wholesaleBandId: parseInt(wholesaleBandId),
      }
    }

    // Filter by status
    if (status) {
      where.status = status
    }

    // Filter by date range
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        // endDate를 해당 날짜의 끝으로 설정
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // Get total count
    const total = await prisma.product.count({ where })

    // Get products with relations
    const products = await prisma.product.findMany({
      where,
      include: {
        post: {
          include: {
            wholesaleBand: {
              select: {
                id: true,
                name: true,
                coverUrl: true,
              },
            },
            images: {
              orderBy: { sortOrder: 'asc' },
              take: 1,
            },
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
      data: products,
      total,
      page,
      limit,
    })
  } catch (error) {
    console.error('상품 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/product
 *
 * Create new product
 *
 * Request Body:
 * - postId: number
 * - name: string
 * - description?: string
 * - categoryId?: string
 * - currency?: string
 * - price?: number
 * - wholesalePrice?: number
 * - options?: Array<{ groupName: string, value: string, sortOrder?: number }>
 * - variants?: Array<{ sku?: string, optionSummary?: string, price: number, wholesalePrice?: number, stock?: number }>
 *
 * Response:
 * - success: boolean
 * - data?: Product
 * - error?: string
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const body = await request.json()
    const {
      postId,
      name,
      description,
      categoryId,
      currency,
      price,
      wholesalePrice,
      options,
      variants,
    } = body

    console.log('[Product Create] Request:', { postId, name })

    // Validate required fields
    if (!postId || !name) {
      return NextResponse.json(
        { success: false, error: 'postId와 name이 필요합니다.' },
        { status: 400 }
      )
    }

    // Check if post exists and belongs to user
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        userId,
      },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
    })

    if (!post) {
      return NextResponse.json(
        { success: false, error: '게시물을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Check if product already exists for this post
    const existing = await prisma.product.findUnique({
      where: { postId },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 이 게시물로 생성된 상품이 있습니다.' },
        { status: 400 }
      )
    }

    // Get thumbnail from post
    const thumbnailUrl = post.images[0]?.imageUrl || null

    // Create product
    const product = await prisma.product.create({
      data: {
        userId,
        postId,
        name,
        description: description || null,
        categoryId: categoryId || null,
        currency: currency || 'KRW',
        price: price || null,
        wholesalePrice: wholesalePrice || null,
        thumbnailUrl,
      },
    })

    console.log('[Product Create] Success:', product.id)

    return NextResponse.json({
      success: true,
      data: product,
    })
  } catch (error: any) {
    console.error('상품 생성 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '상품 생성에 실패했습니다.',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/product
 *
 * Update existing product
 *
 * Request Body:
 * - id: string
 * - name?: string
 * - description?: string
 * - categoryId?: string
 * - price?: number
 * - wholesalePrice?: number
 * - options?: Array<{ id?: string, groupName: string, value: string, sortOrder?: number }>
 * - variants?: Array<{ id?: string, sku?: string, optionSummary?: string, price: number, wholesalePrice?: number, stock?: number }>
 *
 * Response:
 * - success: boolean
 * - data?: Product
 */
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id가 필요합니다.' },
        { status: 400 }
      )
    }

    // Check product exists and belongs to user
    const existing = await prisma.product.findFirst({
      where: {
        id,
        userId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Prepare update data
    const data: any = {}
    if (updateData.name !== undefined) data.name = updateData.name
    if (updateData.description !== undefined) data.description = updateData.description
    if (updateData.categoryId !== undefined) data.categoryId = updateData.categoryId
    if (updateData.price !== undefined) data.price = updateData.price
    if (updateData.wholesalePrice !== undefined) data.wholesalePrice = updateData.wholesalePrice
    if (updateData.status !== undefined) data.status = updateData.status

    // Update product
    const product = await prisma.product.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      success: true,
      data: product,
    })
  } catch (error: any) {
    console.error('상품 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/product
 *
 * Delete product
 *
 * Query Parameters:
 * - id: string
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

    // Check product exists and belongs to user
    const product = await prisma.product.findFirst({
      where: {
        id,
        userId,
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Delete product (variants and options will be cascade deleted)
    await prisma.product.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('상품 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
