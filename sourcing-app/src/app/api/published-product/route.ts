import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 발행상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const channelId = searchParams.get('channelId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // 조건 생성
    const where: any = {
      userId: currentUser.userId,
    }

    if (search) {
      where.product = {
        name: { contains: search },
      }
    }

    if (channelId) {
      where.channelId = parseInt(channelId)
    }

    if (status && status !== 'ALL') {
      where.status = status
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    const [data, total] = await Promise.all([
      prisma.publishedProduct.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              thumbnailUrl: true,
              price: true,
              wholesalePrice: true,
              status: true,
            },
          },
          channel: {
            select: {
              id: true,
              name: true,
              coverUrl: true,
              platform: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.publishedProduct.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      limit,
    })
  } catch (error) {
    console.error('발행상품 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행상품 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 발행상품 삭제
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

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

    // 발행상품 확인
    const publishedProduct = await prisma.publishedProduct.findFirst({
      where: { id, userId: currentUser.userId },
    })

    if (!publishedProduct) {
      return NextResponse.json(
        { success: false, error: '발행상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    await prisma.publishedProduct.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('발행상품 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행상품 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
