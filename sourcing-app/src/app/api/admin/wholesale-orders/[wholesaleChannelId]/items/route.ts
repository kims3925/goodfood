import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/admin/wholesale-orders/:wholesaleChannelId/items
 * 도매처별 상세 주문 목록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wholesaleChannelId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { wholesaleChannelId } = await params
    const channelId = parseInt(wholesaleChannelId)

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!from || !to) {
      return NextResponse.json(
        { success: false, error: '기간(from, to)은 필수입니다.' },
        { status: 400 }
      )
    }

    const fromDate = new Date(from)
    fromDate.setHours(0, 0, 0, 0)
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)

    // 1. 회원 주문 아이템 조회 (PAID, SHIPPED, DELIVERED)
    const statuses: ('PAID' | 'SHIPPED' | 'DELIVERED')[] = ['PAID', 'SHIPPED', 'DELIVERED']
    const whereCondition = {
      order: {
        status: { in: statuses },
        paidAt: {
          not: null,
          gte: fromDate,
          lte: toDate,
        },
      },
      publishedProduct: {
        userId: user.userId,
        product: {
          collectedProduct: {
            post: {
              channelId: channelId,
            },
          },
        },
      },
    }

    const guestWhereCondition = {
      guestOrder: {
        status: { in: statuses },
        paidAt: {
          not: null,
          gte: fromDate,
          lte: toDate,
        },
      },
      publishedProduct: {
        userId: user.userId,
        product: {
          collectedProduct: {
            post: {
              channelId: channelId,
            },
          },
        },
      },
    }

    const [items, guestItems, totalMember, totalGuest] = await Promise.all([
      prisma.orderItem.findMany({
        where: whereCondition,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderedAt: true,
              shippingAddress: {
                select: {
                  recipientName: true,
                  recipientPhone: true,
                  postalCode: true,
                  address: true,
                  addressDetail: true,
                },
              },
              shop: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          publishedProduct: {
            include: {
              product: {
                include: {
                  variants: {
                    select: {
                      id: true,
                      optionSummary: true,
                      wholesalePrice: true,
                    },
                  },
                },
              },
              channel: {
                select: {
                  id: true,
                  name: true,
                  kind: true,
                },
              },
            },
          },
          variant: {
            select: {
              wholesalePrice: true,
              optionSummary: true,
            },
          },
        },
        orderBy: {
          order: {
            orderedAt: 'desc',
          },
        },
      }),
      // 2. 비회원 주문 아이템 조회
      prisma.guestOrderItem.findMany({
        where: guestWhereCondition,
        include: {
          guestOrder: {
            select: {
              id: true,
              orderNumber: true,
              orderedAt: true,
              shippingAddress: {
                select: {
                  recipientName: true,
                  recipientPhone: true,
                  postalCode: true,
                  address: true,
                  addressDetail: true,
                },
              },
              shop: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          publishedProduct: {
            include: {
              product: {
                include: {
                  variants: {
                    select: {
                      id: true,
                      optionSummary: true,
                      wholesalePrice: true,
                    },
                  },
                },
              },
              channel: {
                select: {
                  id: true,
                  name: true,
                  kind: true,
                },
              },
            },
          },
          variant: {
            select: {
              wholesalePrice: true,
              optionSummary: true,
            },
          },
        },
        orderBy: {
          guestOrder: {
            orderedAt: 'desc',
          },
        },
      }),
      prisma.orderItem.count({ where: whereCondition }),
      prisma.guestOrderItem.count({ where: guestWhereCondition }),
    ])

    // 3. 통합 및 페이지네이션
    const allItems = [
      ...items.map(item => ({
        ...item,
        order: item.order,
        isGuestOrder: false,
      })),
      ...guestItems.map(item => ({
        ...item,
        order: {
          id: item.guestOrder.id,
          orderNumber: item.guestOrder.orderNumber,
          orderedAt: item.guestOrder.orderedAt,
          shippingAddress: item.guestOrder.shippingAddress,
          shop: item.guestOrder.shop,
        },
        isGuestOrder: true,
      })),
    ]

    // 시간순 정렬
    allItems.sort((a, b) =>
      new Date(b.order.orderedAt).getTime() - new Date(a.order.orderedAt).getTime()
    )

    const total = totalMember + totalGuest
    const paginatedItems = allItems.slice((page - 1) * limit, page * limit)

    // 4. 전체 합계 계산 (페이지네이션 무관)
    const allItemsForSum = await prisma.orderItem.findMany({
      where: whereCondition,
      include: {
        publishedProduct: {
          include: {
            product: {
              include: {
                variants: {
                  select: {
                    optionSummary: true,
                    wholesalePrice: true,
                  },
                },
              },
            },
          },
        },
        variant: {
          select: {
            wholesalePrice: true,
          },
        },
      },
    })

    const allGuestItemsForSum = await prisma.guestOrderItem.findMany({
      where: guestWhereCondition,
      include: {
        publishedProduct: {
          include: {
            product: {
              include: {
                variants: {
                  select: {
                    optionSummary: true,
                    wholesalePrice: true,
                  },
                },
              },
            },
          },
        },
        variant: {
          select: {
            wholesalePrice: true,
          },
        },
      },
    })

    let totalQuantity = 0
    let totalAmount = 0
    for (const item of allItemsForSum) {
      let wholesalePrice = item.variant?.wholesalePrice || 0

      // variantId가 null인 경우 Product의 variants에서 찾기
      if (!item.variant && item.publishedProduct?.product?.variants?.length) {
        if (item.optionSummary) {
          const matchedVariant = item.publishedProduct.product.variants.find(
            v => v.optionSummary === item.optionSummary
          )
          if (matchedVariant) {
            wholesalePrice = matchedVariant.wholesalePrice || 0
          }
        }
        if (Number(wholesalePrice) === 0) {
          wholesalePrice = item.publishedProduct.product.variants[0].wholesalePrice || 0
        }
      }

      totalQuantity += item.quantity
      totalAmount += Number(wholesalePrice) * item.quantity
    }

    for (const item of allGuestItemsForSum) {
      let wholesalePrice = item.variant?.wholesalePrice || 0

      if (!item.variant && item.publishedProduct?.product?.variants?.length) {
        if (item.optionSummary) {
          const matchedVariant = item.publishedProduct.product.variants.find(
            v => v.optionSummary === item.optionSummary
          )
          if (matchedVariant) {
            wholesalePrice = matchedVariant.wholesalePrice || 0
          }
        }
        if (Number(wholesalePrice) === 0) {
          wholesalePrice = item.publishedProduct.product.variants[0].wholesalePrice || 0
        }
      }

      totalQuantity += item.quantity
      totalAmount += Number(wholesalePrice) * item.quantity
    }

    // 5. 응답 데이터 포맷
    const formattedItems = paginatedItems.map(item => {
      let wholesalePrice = item.variant?.wholesalePrice || 0

      // variantId가 null인 경우 Product의 variants에서 찾기
      if (!item.variant && item.publishedProduct?.product?.variants?.length) {
        if (item.optionSummary) {
          const matchedVariant = item.publishedProduct.product.variants.find(
            v => v.optionSummary === item.optionSummary
          )
          if (matchedVariant) {
            wholesalePrice = matchedVariant.wholesalePrice || 0
          }
        }
        if (Number(wholesalePrice) === 0) {
          wholesalePrice = item.publishedProduct.product.variants[0].wholesalePrice || 0
        }
      }

      const addr = item.order.shippingAddress
      const fullAddress = addr?.addressDetail
        ? `${addr.address} ${addr.addressDetail}`
        : addr?.address || ''
      // optionSummary 결정: item → variant → product의 첫 번째 variant
      let optionSummary = item.optionSummary || item.variant?.optionSummary || null
      if (!optionSummary && item.publishedProduct?.product?.variants?.length) {
        optionSummary = item.publishedProduct.product.variants[0].optionSummary || null
      }

      return {
        orderItemId: item.id,
        orderNumber: item.order.orderNumber,
        orderedAt: item.order.orderedAt.toISOString(),
        retailChannelName: item.publishedProduct?.channel?.name || item.order.shop?.name || '-',
        productName: item.productName,
        optionSummary: optionSummary || '-',
        quantity: item.quantity,
        wholesalePrice: Number(wholesalePrice),
        totalAmount: Number(wholesalePrice) * item.quantity,
        customerName: addr?.recipientName || '',
        customerPhone: maskPhone(addr?.recipientPhone || ''),
        customerAddress: fullAddress,
        postalCode: addr?.postalCode || '',
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        items: formattedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary: {
          totalQuantity,
          totalAmount,
        },
      },
    })
  } catch (error) {
    console.error('도매처 상세 주문 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '상세 주문 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 전화번호 마스킹 함수 (010-1234-5678 → 010-****-5678)
function maskPhone(phone: string): string {
  if (!phone) return phone
  // 하이픈이 있는 경우
  if (phone.includes('-')) {
    const parts = phone.split('-')
    if (parts.length === 3) {
      return `${parts[0]}-****-${parts[2]}`
    }
  }
  // 하이픈이 없는 경우 (01012345678)
  if (phone.length >= 10) {
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  }
  return phone
}
