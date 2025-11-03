import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const bandId = searchParams.get('bandId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status') || 'all'

    // 소매밴드 게시물 목록 조회
    const where = {
      userId: session.user.id,
      ...(bandId && { retailBandId: bandId }),
      ...(status !== 'all' && { status })
    }

    const [posts, totalCount] = await Promise.all([
      prisma.retailPost.findMany({
        where,
        include: {
          retailBand: {
            select: {
              bandName: true,
              bandKey: true
            }
          },
          product: {
            select: {
              title: true,
              images: true,
              salePrice: true,
              originalPrice: true
            }
          }
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.retailPost.count({ where })
    ])

    // 이미지 파싱 및 응답 데이터 구성
    const formattedPosts = posts.map(post => {
      let productImages = []
      try {
        productImages = JSON.parse(post.product.images || '[]')
      } catch (e) {
        productImages = []
      }

      let postImages = []
      try {
        postImages = JSON.parse(post.images || '[]')
      } catch (e) {
        postImages = []
      }

      return {
        id: post.id,
        title: post.title,
        price: post.price,
        shippingFee: post.shippingFee,
        status: post.status,
        viewCount: post.viewCount,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        bandName: post.retailBand.bandName,
        bandKey: post.retailBand.bandKey,
        productTitle: post.product.title,
        firstImage: postImages[0] || productImages[0] || null,
        images: postImages,
        productImages: productImages
      }
    })

    return NextResponse.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error('Failed to load retail posts:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load retail posts',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { postIds } = await req.json()

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '삭제할 게시물 ID가 필요합니다.'
        },
        { status: 400 }
      )
    }

    // 먼저 삭제할 게시물들이 사용자의 것인지 확인
    const existingPosts = await prisma.retailPost.findMany({
      where: {
        id: { in: postIds },
        userId: session.user.id
      },
      select: {
        id: true,
        title: true,
        retailBand: {
          select: {
            bandName: true
          }
        }
      }
    })

    if (existingPosts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '삭제할 게시물을 찾을 수 없습니다.'
        },
        { status: 404 }
      )
    }

    // 소프트 삭제 (status를 DELETED로 변경)
    const deletedPosts = await prisma.retailPost.updateMany({
      where: {
        id: { in: postIds },
        userId: session.user.id
      },
      data: {
        status: 'DELETED'
      }
    })

    return NextResponse.json({
      success: true,
      message: `${deletedPosts.count}개의 게시물이 삭제되었습니다.`,
      deletedCount: deletedPosts.count
    })

  } catch (error) {
    console.error('Failed to delete retail posts:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete retail posts',
      },
      { status: 500 }
    )
  }
}