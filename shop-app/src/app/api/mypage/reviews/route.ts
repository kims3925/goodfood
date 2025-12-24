export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@bandauto/db'

// 내 리뷰 목록 조회 (탭별: writable - 작성 가능, written - 작성 완료)
// order_item 기준으로 조회 (상품별 개별 후기)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    // Shop ID 확인 (middleware에서 설정)
    const shopIdHeader = request.headers.get('x-shop-id')
    const shopId = shopIdHeader ? parseInt(shopIdHeader) : null

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'writable' // writable, written
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // 주문 조건 (userId + shopId)
    const orderWhere: any = { userId }
    if (shopId) {
      orderWhere.shopId = shopId
    }

    if (tab === 'writable') {
      // 작성 가능한 후기: 배송 완료된 주문의 상품 중 리뷰를 작성하지 않은 상품
      // order_item → order.user_id로 사용자 확인

      // 디버그: 배송 완료된 주문 확인
      const deliveredOrders = await prisma.order.findMany({
        where: { ...orderWhere, status: 'DELIVERED' },
        select: { id: true, orderNumber: true, status: true }
      })
      console.log('DEBUG - userId:', userId)
      console.log('DEBUG - Delivered orders:', deliveredOrders)

      // 디버그: 해당 주문의 모든 order_item 확인
      const allOrderItems = await prisma.orderItem.findMany({
        where: {
          order: {
            ...orderWhere,
            status: 'DELIVERED',
          },
        },
        include: {
          review: true,
        },
      })
      console.log('DEBUG - All order items for delivered orders:', allOrderItems.map(i => ({
        id: i.id,
        orderId: i.orderId,
        productName: i.productName,
        hasReview: !!i.review,
        reviewId: i.review?.id
      })))

      const [orderItems, total] = await Promise.all([
        prisma.orderItem.findMany({
          where: {
            order: {
              ...orderWhere,
              status: 'DELIVERED',
            },
            review: { is: null }, // 리뷰가 없는 상품만
          },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                deliveredAt: true,
              },
            },
            publishedProduct: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    thumbnailUrl: true,
                  },
                },
              },
            },
          },
          orderBy: {
            order: {
              deliveredAt: 'desc',
            },
          },
          skip: offset,
          take: limit,
        }),
        prisma.orderItem.count({
          where: {
            order: {
              ...orderWhere,
              status: 'DELIVERED',
            },
            review: { is: null },
          },
        }),
      ])

      // 응답 형식 변환
      const writableItems = orderItems.map(item => ({
        orderItemId: item.id,
        orderId: item.orderId,
        orderNumber: item.order.orderNumber,
        deliveredAt: item.order.deliveredAt?.toISOString() || null,
        publishedProductId: item.publishedProductId,
        productName: item.productName,
        optionSummary: item.optionSummary,
        thumbnailUrl: item.thumbnailUrl || item.publishedProduct?.product?.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        product: item.publishedProduct?.product ? {
          id: item.publishedProduct.product.id,
          name: item.publishedProduct.product.name,
          thumbnailUrl: item.publishedProduct.product.thumbnailUrl,
        } : null,
      }))

      return NextResponse.json({
        success: true,
        tab: 'writable',
        items: writableItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        // 디버그 정보 (개발용)
        debug: {
          userId,
          deliveredOrdersCount: deliveredOrders.length,
          deliveredOrders: deliveredOrders,
          allOrderItemsCount: allOrderItems.length,
          allOrderItems: allOrderItems.map(i => ({
            id: i.id,
            orderId: i.orderId,
            productName: i.productName,
            hasReview: !!i.review,
            reviewId: i.review?.id
          }))
        }
      })
    } else {
      // 작성한 후기: order_item → order.user_id로 사용자의 리뷰 조회
      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where: {
            orderItem: {
              order: orderWhere,
            },
          },
          include: {
            orderItem: {
              include: {
                order: {
                  select: {
                    id: true,
                    orderNumber: true,
                  },
                },
                publishedProduct: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        name: true,
                        thumbnailUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip: offset,
          take: limit,
        }),
        prisma.review.count({
          where: {
            orderItem: {
              order: orderWhere,
            },
          },
        }),
      ])

      // 응답 형식 변환
      const formattedReviews = reviews.map(review => ({
        id: review.id,
        orderItemId: review.orderItemId,
        orderId: review.orderItem?.orderId,
        orderNumber: review.orderItem?.order?.orderNumber || null,
        rating: review.rating,
        title: review.title,
        content: review.content,
        images: review.images ? JSON.parse(review.images) : null,
        createdAt: review.createdAt.toISOString(),
        product: review.orderItem?.publishedProduct?.product || null,
        orderItem: review.orderItem ? {
          productName: review.orderItem.productName,
          optionSummary: review.orderItem.optionSummary,
          thumbnailUrl: review.orderItem.thumbnailUrl,
        } : null,
      }))

      return NextResponse.json({
        success: true,
        tab: 'written',
        reviews: formattedReviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    }
  } catch (error) {
    console.error('Failed to fetch reviews:', error)
    return NextResponse.json(
      { success: false, error: '리뷰 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// 리뷰 작성 (상품별 개별 후기)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const { orderItemId, rating, title, content, images } = await request.json()

    if (!orderItemId || !rating || !content) {
      return NextResponse.json(
        { success: false, error: '필수 정보를 입력해주세요' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: '평점은 1~5 사이여야 합니다' },
        { status: 400 }
      )
    }

    // 주문 상품 확인 (order_item → order.user_id로 본인 확인)
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: true,
        publishedProduct: {
          include: {
            product: true,
          },
        },
        review: true,
      },
    })

    if (!orderItem) {
      return NextResponse.json(
        { success: false, error: '주문 상품을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 본인의 주문인지 확인 (order.user_id로 확인)
    if (orderItem.order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      )
    }

    // Shop ID 확인 (middleware에서 설정)
    const shopIdHeader = request.headers.get('x-shop-id')
    const shopId = shopIdHeader ? parseInt(shopIdHeader) : null

    // shopId가 있으면 해당 Shop의 주문인지 확인
    if (shopId && orderItem.order.shopId !== shopId) {
      return NextResponse.json(
        { success: false, error: '주문 상품을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (orderItem.order.status !== 'DELIVERED') {
      return NextResponse.json(
        { success: false, error: '배송 완료된 주문만 리뷰를 작성할 수 있습니다' },
        { status: 400 }
      )
    }

    // 이미 리뷰를 작성했는지 확인
    if (orderItem.review) {
      return NextResponse.json(
        { success: false, error: '이미 리뷰를 작성하셨습니다' },
        { status: 400 }
      )
    }

    const review = await prisma.review.create({
      data: {
        userId,
        orderItemId,
        rating,
        title: title || null,
        content,
        images: images && images.length > 0 ? JSON.stringify(images) : null,
      },
      include: {
        orderItem: {
          include: {
            publishedProduct: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    thumbnailUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: '리뷰가 작성되었습니다',
      review: {
        id: review.id,
        orderItemId: review.orderItemId,
        rating: review.rating,
        title: review.title,
        content: review.content,
        images: review.images ? JSON.parse(review.images) : null,
        createdAt: review.createdAt.toISOString(),
        product: review.orderItem?.publishedProduct?.product || null,
        orderItem: review.orderItem ? {
          productName: review.orderItem.productName,
          optionSummary: review.orderItem.optionSummary,
          thumbnailUrl: review.orderItem.thumbnailUrl,
          orderId: review.orderItem.orderId,
        } : null,
      },
    })
  } catch (error) {
    console.error('Failed to create review:', error)
    return NextResponse.json(
      { success: false, error: '리뷰 작성에 실패했습니다' },
      { status: 500 }
    )
  }
}
