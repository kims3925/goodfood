export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { Prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const Decimal = Prisma.Decimal

// 토스페이먼츠 결제 취소 함수
async function cancelTossPayment(
  paymentKey: string,
  cancelReason: string,
  cancelAmount?: number
): Promise<{ success: boolean; error?: string; data?: any }> {
  const TOSS_SECRET_KEY = process.env.TOSS_PAYMENTS_SECRET_KEY || ''
  const TOSS_API_URL = 'https://api.tosspayments.com/v1/payments'

  if (!TOSS_SECRET_KEY) {
    return { success: false, error: '토스페이먼츠 시크릿 키가 설정되지 않았습니다.' }
  }

  try {
    const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')

    const requestBody: any = { cancelReason }
    if (cancelAmount !== undefined) {
      requestBody.cancelAmount = cancelAmount
    }

    const response = await fetch(`${TOSS_API_URL}/${paymentKey}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('토스페이먼츠 결제 취소 실패:', data)
      return { success: false, error: data.message || '결제 취소에 실패했습니다.', data }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error('토스페이먼츠 결제 취소 오류:', error)
    return { success: false, error: error.message || '결제 취소 중 오류가 발생했습니다.' }
  }
}

/**
 * GET /api/order/unified/[id]
 * 주문 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') // SHOPPING_MALL or GOOGLE_FORM

    if (source === 'SHOPPING_MALL') {
      // 먼저 회원 주문 조회 (orderNumber로 조회)
      const order = await prisma.order.findFirst({
        where: {
          orderNumber: id,
          items: {
            some: {
              shopProduct: {
                userId: user.userId,
              },
            },
          },
        },
        include: {
          shippingAddress: true,
          items: {
            include: {
              shopProduct: {
                include: {
                  product: {
                    include: {
                      channel: {
                        select: {
                          id: true,
                          kind: true,
                          platform: true,
                          name: true,
                        },
                      },
                      collectedPost: {
                        select: {
                          id: true,
                          title: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          payment: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          shop: {
            select: {
              id: true,
              name: true,
            },
          },
          refundAccount: true, // 환불 계좌 정보
        },
      })

      // 회원 주문이 있으면 반환
      if (order) {

        // 상태 레이블 매핑
        const statusLabels: Record<string, string> = {
          PENDING: '결제대기',
          PAID: '결제완료',
          PREPARING: '상품준비',
          SHIPPED: '배송중',
          DELIVERED: '배송완료',
          CANCELLED: '취소됨',
          REFUNDED: '환불됨',
        }

        // 통합 형식으로 변환
        const formattedOrder = {
          id: order.id,
          source: 'SHOPPING_MALL' as const,
          orderNumber: order.orderNumber,
          status: order.status,
          statusLabel: statusLabels[order.status] || order.status,
          isGuestOrder: false,
          customerName: order.shippingAddress?.recipientName || order.user?.name || '정보없음',
          customerPhone: order.shippingAddress?.recipientPhone || null,
          shippingAddress: order.shippingAddress ? {
            recipientName: order.shippingAddress.recipientName,
            recipientPhone: order.shippingAddress.recipientPhone,
            postalCode: order.shippingAddress.postalCode,
            address: order.shippingAddress.address,
            addressDetail: order.shippingAddress.addressDetail,
            deliveryMemo: order.shippingAddress.deliveryMemo,
          } : null,
          subtotalAmount: Number(order.subtotalAmount),
          discountAmount: Number(order.discountAmount),
          totalAmount: Number(order.totalAmount),
          paymentMethod: order.payment?.method || null,
          createdAt: order.orderedAt?.toISOString() || order.createdAt?.toISOString(),
          paidAt: order.paidAt?.toISOString() || null,
          preparingAt: order.preparingAt?.toISOString() || null,
          shippedAt: order.shippedAt?.toISOString() || null,
          deliveredAt: order.deliveredAt?.toISOString() || null,
          cancelledAt: order.cancelledAt?.toISOString() || null,
          items: order.items.map((item) => ({
            id: item.id,
            productName: item.productName,
            sourceProductName: item.shopProduct?.product?.sourceProductName
              ?? item.shopProduct?.product?.collectedPost?.title
              ?? null,
            optionSummary: item.optionSummary,
            thumbnailUrl: item.thumbnailUrl || item.shopProduct?.product?.thumbnailUrl || null,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            // 배송비 및 합배송 정보
            shippingFee: item.shopProduct?.product?.shippingFee || 0,
            bundleShippingType: item.shopProduct?.product?.bundleShippingType || 'NONE',
            bundleMaxQty: item.shopProduct?.product?.bundleMaxQty || 1,
            // 도매처(소싱 출처) 정보
            channel: item.shopProduct?.product?.channel ? {
              id: item.shopProduct.product.channel.id,
              kind: item.shopProduct.product.channel.kind,
              platform: item.shopProduct.product.channel.platform,
              name: item.shopProduct.product.channel.name,
            } : null,
          })),
          payment: order.payment ? {
            id: order.payment.id,
            method: order.payment.method,
            status: order.payment.status,
            amount: Number(order.payment.amount),
            paidAt: order.payment.approvedAt?.toISOString() || null,
          } : null,
          user: order.user ? {
            id: order.user.id,
            name: order.user.name,
            email: order.user.email,
          } : null,
          shopId: order.shopId,
          shopName: order.shop?.name || null,
          // 환불 계좌 정보 (무통장입금 취소 시)
          refundAccount: order.refundAccount ? {
            bankName: order.refundAccount.bankName,
            accountNumber: order.refundAccount.accountNumber,
            accountHolder: order.refundAccount.accountHolder,
          } : null,
          cancelReason: order.cancelReason || null,
          cancelledBy: order.cancelledBy || null,
          // 도매 발주 상태
          wholesaleOrderStatus: order.wholesaleOrderStatus || null,
          wholesaleChannelId: order.wholesaleChannelId || null,
          wholesaleOrderedAt: order.wholesaleOrderedAt?.toISOString() || null,
        }

        return NextResponse.json({
          success: true,
          data: formattedOrder,
        })
      }

      // 회원 주문이 없으면 비회원 주문 조회 (orderNumber로 조회)
      const guestOrder = await prisma.guestOrder.findFirst({
        where: {
          orderNumber: id,
          items: {
            some: {
              shopProduct: {
                userId: user.userId,
              },
            },
          },
        },
        include: {
          shippingAddress: true,
          items: {
            include: {
              shopProduct: {
                include: {
                  product: {
                    include: {
                      channel: {
                        select: {
                          id: true,
                          kind: true,
                          platform: true,
                          name: true,
                        },
                      },
                      collectedPost: {
                        select: {
                          id: true,
                          title: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          payment: true,
          shop: {
            select: {
              id: true,
              name: true,
            },
          },
          refundAccount: true, // 환불 계좌 정보
        },
      })

      if (!guestOrder) {
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      // 상태 레이블 매핑
      const statusLabels: Record<string, string> = {
        PENDING: '결제대기',
        PAID: '결제완료',
        PREPARING: '상품준비',
        SHIPPED: '배송중',
        DELIVERED: '배송완료',
        CANCELLED: '취소됨',
        REFUNDED: '환불됨',
      }

      // 통합 형식으로 변환
      const formattedGuestOrder = {
        id: guestOrder.id,
        source: 'SHOPPING_MALL' as const,
        orderNumber: guestOrder.orderNumber,
        status: guestOrder.status,
        statusLabel: statusLabels[guestOrder.status] || guestOrder.status,
        isGuestOrder: true,
        customerName: guestOrder.shippingAddress?.recipientName || guestOrder.guestName,
        customerPhone: guestOrder.shippingAddress?.recipientPhone || guestOrder.guestPhone,
        shippingAddress: guestOrder.shippingAddress ? {
          recipientName: guestOrder.shippingAddress.recipientName,
          recipientPhone: guestOrder.shippingAddress.recipientPhone,
          postalCode: guestOrder.shippingAddress.postalCode,
          address: guestOrder.shippingAddress.address,
          addressDetail: guestOrder.shippingAddress.addressDetail,
          deliveryMemo: guestOrder.shippingAddress.deliveryMemo,
        } : null,
        subtotalAmount: Number(guestOrder.subtotalAmount),
        discountAmount: Number(guestOrder.discountAmount),
        totalAmount: Number(guestOrder.totalAmount),
        paymentMethod: guestOrder.payment?.method || null,
        createdAt: guestOrder.orderedAt?.toISOString() || guestOrder.createdAt?.toISOString(),
        paidAt: guestOrder.paidAt?.toISOString() || null,
        preparingAt: guestOrder.preparingAt?.toISOString() || null,
        shippedAt: guestOrder.shippedAt?.toISOString() || null,
        deliveredAt: guestOrder.deliveredAt?.toISOString() || null,
        cancelledAt: guestOrder.cancelledAt?.toISOString() || null,
        items: guestOrder.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          sourceProductName: item.shopProduct?.product?.sourceProductName
            ?? item.shopProduct?.product?.collectedPost?.title
            ?? null,
          optionSummary: item.optionSummary,
          thumbnailUrl: item.thumbnailUrl || item.shopProduct?.product?.thumbnailUrl || null,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          // 배송비 및 합배송 정보
          shippingFee: item.shopProduct?.product?.shippingFee || 0,
          bundleShippingType: item.shopProduct?.product?.bundleShippingType || 'NONE',
          bundleMaxQty: item.shopProduct?.product?.bundleMaxQty || 1,
          // 도매처(소싱 출처) 정보
          channel: item.shopProduct?.product?.channel ? {
            id: item.shopProduct.product.channel.id,
            kind: item.shopProduct.product.channel.kind,
            platform: item.shopProduct.product.channel.platform,
            name: item.shopProduct.product.channel.name,
          } : null,
        })),
        payment: guestOrder.payment ? {
          id: guestOrder.payment.id,
          method: guestOrder.payment.method,
          status: guestOrder.payment.status,
          amount: Number(guestOrder.payment.amount),
          paidAt: guestOrder.payment.approvedAt?.toISOString() || null,
        } : null,
        user: null, // 비회원은 user 정보 없음
        shopId: guestOrder.shopId,
        shopName: guestOrder.shop?.name || null,
        // 환불 계좌 정보 (무통장입금 취소 시)
        refundAccount: guestOrder.refundAccount ? {
          bankName: guestOrder.refundAccount.bankName,
          accountNumber: guestOrder.refundAccount.accountNumber,
          accountHolder: guestOrder.refundAccount.accountHolder,
        } : null,
        cancelReason: guestOrder.cancelReason || null,
        cancelledBy: guestOrder.cancelledBy || null,
        // 도매 발주 상태
        wholesaleOrderStatus: guestOrder.wholesaleOrderStatus || null,
        wholesaleChannelId: guestOrder.wholesaleChannelId || null,
        wholesaleOrderedAt: guestOrder.wholesaleOrderedAt?.toISOString() || null,
      }

      return NextResponse.json({
        success: true,
        data: formattedGuestOrder,
      })
    }

    return NextResponse.json(
      { success: false, error: 'source 파라미터가 필요하거나 유효하지 않습니다.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('주문 상세 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/order/unified/[id]
 * 주문 상태 변경
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { source, status } = body

    if (!source || !status) {
      return NextResponse.json(
        { success: false, error: 'source와 status가 필요합니다.' },
        { status: 400 }
      )
    }

    if (source === 'SHOPPING_MALL') {
      // 먼저 회원 주문 조회 (orderNumber로 조회)
      const order = await prisma.order.findFirst({
        where: {
          orderNumber: id,
          items: {
            some: {
              shopProduct: {
                userId: user.userId,
              },
            },
          },
        },
        include: {
          payment: true, // 결제 취소를 위해 payment 포함
        },
      })

      // 회원 주문이 있으면 처리
      if (order) {

      // 유효한 상태인지 확인
      const validStatuses = ['PENDING', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 상태입니다.' },
          { status: 400 }
        )
      }

      // 상태 변경 시 관련 날짜 필드도 업데이트
      // 중간 단계를 건너뛸 경우 이전 단계의 날짜도 함께 채움
      const updateData: any = { status }
      const now = new Date()

      switch (status) {
        case 'PAID':
          // paidAt이 없으면 설정
          if (!order.paidAt) {
            updateData.paidAt = now
          }
          // 취소 상태에서 복구하는 경우 취소 관련 필드 초기화
          if (order.status === 'CANCELLED') {
            updateData.cancelledAt = null
            updateData.cancelledBy = null
            updateData.cancelReason = null
          }
          break
        case 'PREPARING':
          // paidAt이 없으면 설정 (중간 단계 채움)
          if (!order.paidAt) {
            updateData.paidAt = now
          }
          // preparingAt 설정
          updateData.preparingAt = now
          // 취소 상태에서 복구하는 경우 취소 관련 필드 초기화
          if (order.status === 'CANCELLED') {
            updateData.cancelledAt = null
            updateData.cancelledBy = null
            updateData.cancelReason = null
          }
          break
        case 'SHIPPED':
          // paidAt이 없으면 설정 (중간 단계 채움)
          if (!order.paidAt) {
            updateData.paidAt = now
          }
          // preparingAt이 없으면 설정 (중간 단계 채움)
          if (!order.preparingAt) {
            updateData.preparingAt = now
          }
          // shippedAt 설정
          if (!order.shippedAt) {
            updateData.shippedAt = now
          }
          break
        case 'DELIVERED':
          // paidAt이 없으면 설정 (중간 단계 채움)
          if (!order.paidAt) {
            updateData.paidAt = now
          }
          // preparingAt이 없으면 설정 (중간 단계 채움)
          if (!order.preparingAt) {
            updateData.preparingAt = now
          }
          // shippedAt이 없으면 설정 (중간 단계 채움)
          if (!order.shippedAt) {
            updateData.shippedAt = now
          }
          // deliveredAt 설정
          if (!order.deliveredAt) {
            updateData.deliveredAt = now
          }
          break
        case 'CANCELLED':
          updateData.cancelledAt = now
          updateData.cancelledBy = 'ADMIN'

          // 카드 결제인 경우만 토스페이먼츠 결제 취소 API 호출
          // 무통장입금/가상계좌는 토스 API 호출하지 않음 (환불 계좌로 수동 환불)
          const isCardPayment = order.payment?.method === 'CARD'
          const isVirtualAccountPayment = order.payment?.method === 'VIRTUAL_ACCOUNT' || order.payment?.method === 'BANK_TRANSFER'

          if (order.payment && order.payment.paymentKey && ['DONE', 'PARTIAL_CANCELED'].includes(order.payment.status) && isCardPayment) {
            const paymentAmount = Number(order.payment.amount)
            const alreadyCancelledAmount = Number(order.payment.cancelledAmount || 0)
            const remainingAmount = paymentAmount - alreadyCancelledAmount

            if (remainingAmount > 0) {
              const cancelResult = await cancelTossPayment(
                order.payment.paymentKey,
                body.cancelReason || '관리자에 의한 주문 취소',
                remainingAmount
              )

              if (!cancelResult.success) {
                return NextResponse.json(
                  { success: false, error: `결제 취소 실패: ${cancelResult.error}` },
                  { status: 400 }
                )
              }

              // 트랜잭션으로 payment와 order 동시 업데이트
              await prisma.$transaction(async (tx) => {
                await tx.payment.update({
                  where: { id: order.payment!.id },
                  data: {
                    status: 'CANCELED',
                    cancelReason: body.cancelReason || '관리자에 의한 주문 취소',
                    cancelledAmount: new Decimal(paymentAmount),
                    cancelledAt: now,
                  }
                })

                await tx.order.update({
                  where: { orderNumber: id },
                  data: updateData,
                })
              })

              return NextResponse.json({
                success: true,
                message: '주문 상태가 변경되었습니다.',
              })
            }
          }

          // 무통장입금/가상계좌의 경우 트랜잭션으로 Payment와 Order 동시 업데이트
          if (order.payment && isVirtualAccountPayment) {
            await prisma.$transaction(async (tx) => {
              await tx.payment.update({
                where: { id: order.payment!.id },
                data: {
                  status: 'CANCELED',
                  cancelReason: body.cancelReason || '관리자에 의한 주문 취소',
                  cancelledAt: now,
                }
              })

              await tx.order.update({
                where: { orderNumber: id },
                data: updateData,
              })
            })

            return NextResponse.json({
              success: true,
              message: '주문 상태가 변경되었습니다.',
            })
          }
          break
      }

        await prisma.order.update({
          where: { orderNumber: id },
          data: updateData,
        })

        return NextResponse.json({
          success: true,
          message: '주문 상태가 변경되었습니다.',
        })
      }

      // 회원 주문이 없으면 비회원 주문 조회 (orderNumber로 조회)
      // 외부주문(XORD-)은 isCustomItem=true인 경우 shopProduct가 null이므로
      // shop.userId로 권한 검증 (OR 조건)
      const guestOrder = await prisma.guestOrder.findFirst({
        where: {
          orderNumber: id,
          OR: [
            {
              items: {
                some: {
                  shopProduct: {
                    userId: user.userId,
                  },
                },
              },
            },
            {
              shop: {
                userId: user.userId,
              },
            },
          ],
        },
        include: {
          payment: true, // 결제 취소를 위해 payment 포함
        },
      })

      if (!guestOrder) {
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없거나 권한이 없습니다.' },
          { status: 404 }
        )
      }

      // 유효한 상태인지 확인
      const validStatuses = ['PENDING', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 상태입니다.' },
          { status: 400 }
        )
      }

      // 상태 변경 시 관련 날짜 필드도 업데이트
      const updateData: any = { status }
      const now = new Date()

      switch (status) {
        case 'PAID':
          if (!guestOrder.paidAt) {
            updateData.paidAt = now
          }
          // 취소 상태에서 복구하는 경우 취소 관련 필드 초기화
          if (guestOrder.status === 'CANCELLED') {
            updateData.cancelledAt = null
            updateData.cancelledBy = null
            updateData.cancelReason = null
          }
          break
        case 'PREPARING':
          if (!guestOrder.paidAt) {
            updateData.paidAt = now
          }
          updateData.preparingAt = now
          // 취소 상태에서 복구하는 경우 취소 관련 필드 초기화
          if (guestOrder.status === 'CANCELLED') {
            updateData.cancelledAt = null
            updateData.cancelledBy = null
            updateData.cancelReason = null
          }
          break
        case 'SHIPPED':
          if (!guestOrder.paidAt) {
            updateData.paidAt = now
          }
          if (!guestOrder.preparingAt) {
            updateData.preparingAt = now
          }
          if (!guestOrder.shippedAt) {
            updateData.shippedAt = now
          }
          break
        case 'DELIVERED':
          if (!guestOrder.paidAt) {
            updateData.paidAt = now
          }
          if (!guestOrder.preparingAt) {
            updateData.preparingAt = now
          }
          if (!guestOrder.shippedAt) {
            updateData.shippedAt = now
          }
          if (!guestOrder.deliveredAt) {
            updateData.deliveredAt = now
          }
          break
        case 'CANCELLED':
          updateData.cancelledAt = now
          updateData.cancelledBy = 'ADMIN'

          // 카드 결제인 경우만 토스페이먼츠 결제 취소 API 호출
          // 무통장입금/가상계좌는 토스 API 호출하지 않음 (환불 계좌로 수동 환불)
          const isGuestCardPayment = guestOrder.payment?.method === 'CARD'
          const isGuestVirtualAccountPayment = guestOrder.payment?.method === 'VIRTUAL_ACCOUNT' || guestOrder.payment?.method === 'BANK_TRANSFER'

          if (guestOrder.payment && guestOrder.payment.paymentKey && ['DONE', 'PARTIAL_CANCELED'].includes(guestOrder.payment.status) && isGuestCardPayment) {
            const paymentAmount = Number(guestOrder.payment.amount)
            const alreadyCancelledAmount = Number(guestOrder.payment.cancelledAmount || 0)
            const remainingAmount = paymentAmount - alreadyCancelledAmount

            if (remainingAmount > 0) {
              const cancelResult = await cancelTossPayment(
                guestOrder.payment.paymentKey,
                body.cancelReason || '관리자에 의한 주문 취소',
                remainingAmount
              )

              if (!cancelResult.success) {
                return NextResponse.json(
                  { success: false, error: `결제 취소 실패: ${cancelResult.error}` },
                  { status: 400 }
                )
              }

              // 트랜잭션으로 guestPayment와 guestOrder 동시 업데이트
              await prisma.$transaction(async (tx) => {
                await tx.guestPayment.update({
                  where: { id: guestOrder.payment!.id },
                  data: {
                    status: 'CANCELED',
                    cancelReason: body.cancelReason || '관리자에 의한 주문 취소',
                    cancelledAmount: new Decimal(paymentAmount),
                    cancelledAt: now,
                  }
                })

                await tx.guestOrder.update({
                  where: { orderNumber: id },
                  data: updateData,
                })
              })

              return NextResponse.json({
                success: true,
                message: '주문 상태가 변경되었습니다.',
              })
            }
          }

          // 무통장입금/가상계좌의 경우 트랜잭션으로 Payment와 Order 동시 업데이트
          if (guestOrder.payment && isGuestVirtualAccountPayment) {
            await prisma.$transaction(async (tx) => {
              await tx.guestPayment.update({
                where: { id: guestOrder.payment!.id },
                data: {
                  status: 'CANCELED',
                  cancelReason: body.cancelReason || '관리자에 의한 주문 취소',
                  cancelledAt: now,
                }
              })

              await tx.guestOrder.update({
                where: { orderNumber: id },
                data: updateData,
              })
            })

            return NextResponse.json({
              success: true,
              message: '주문 상태가 변경되었습니다.',
            })
          }
          break
      }

      await prisma.guestOrder.update({
        where: { orderNumber: id },
        data: updateData,
      })

      return NextResponse.json({
        success: true,
        message: '주문 상태가 변경되었습니다.',
      })
    }

    return NextResponse.json(
      { success: false, error: '유효하지 않은 source입니다.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('주문 상태 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '상태 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}
