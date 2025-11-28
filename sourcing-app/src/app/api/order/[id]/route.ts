import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const TOSS_SECRET_KEY = process.env.TOSS_PAYMENTS_SECRET_KEY || ''
const TOSS_API_URL = 'https://api.tosspayments.com/v1/payments'

// GET: 주문 상세 조회
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
    const orderId = parseInt(id)

    // Order 조회 (OrderItem, ProductPublish, RetailBand, User 포함)
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        // 판매자 기준: 주문 아이템의 ProductPublish가 내 것인지 확인
        items: {
          some: {
            productPublish: {
              userId: user.userId,
            },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            productPublish: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    thumbnailUrl: true,
                    price: true,
                  },
                },
                retailBand: {
                  select: {
                    id: true,
                    name: true,
                    coverUrl: true,
                  },
                },
              },
            },
            variant: true,
          },
        },
        payment: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: order,
    })
  } catch (error) {
    console.error('주문 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PATCH: 주문 상태 수정
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
    const orderId = parseInt(id)
    const body = await request.json()

    // 기존 주문 확인 (결제 정보 포함)
    const existingOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        items: {
          some: {
            productPublish: {
              userId: user.userId,
            },
          },
        },
      },
      include: {
        payment: true,
      },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 업데이트 데이터 구성
    const updateData: any = {}

    if (body.status !== undefined) {
      updateData.status = body.status

      // 상태에 따른 타임스탬프 업데이트
      if (body.status === 'SHIPPED') {
        updateData.shippedAt = new Date()
      } else if (body.status === 'DELIVERED') {
        updateData.deliveredAt = new Date()
      } else if (body.status === 'CANCELLED') {
        updateData.cancelledAt = new Date()
        updateData.cancelledBy = 'ADMIN'
        updateData.cancelReason = body.cancelReason || '관리자에 의한 취소'

        // 결제 완료 상태인 경우 토스페이먼츠 결제 취소
        if (existingOrder.status === 'PAID' && existingOrder.payment?.paymentKey) {
          try {
            const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')
            const cancelReason = body.cancelReason || '관리자에 의한 주문 취소'

            const tossResponse = await fetch(
              `${TOSS_API_URL}/${existingOrder.payment.paymentKey}/cancel`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${authHeader}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  cancelReason: cancelReason,
                }),
              }
            )

            const tossResult = await tossResponse.json()

            if (!tossResponse.ok) {
              console.error('토스 결제 취소 실패:', tossResult)
              return NextResponse.json(
                {
                  success: false,
                  error: tossResult.message || '토스 결제 취소에 실패했습니다',
                  code: tossResult.code
                },
                { status: 400 }
              )
            }

            // Payment 상태 업데이트
            await prisma.payment.update({
              where: { id: existingOrder.payment.id },
              data: {
                status: 'CANCELED',
                cancelReason: cancelReason,
                cancelledAt: new Date(),
                rawResponse: JSON.stringify(tossResult),
              },
            })

            console.log(`토스 결제 취소 완료: ${existingOrder.payment.paymentKey}`)
          } catch (error: any) {
            console.error('토스 결제 취소 API 오류:', error)
            return NextResponse.json(
              { success: false, error: '결제 취소 처리 중 오류가 발생했습니다' },
              { status: 500 }
            )
          }
        }
      }
    }

    if (body.deliveryMemo !== undefined) {
      updateData.deliveryMemo = body.deliveryMemo
    }

    // 주문 업데이트
    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      message: '주문이 수정되었습니다.',
      data: order,
    })
  } catch (error) {
    console.error('주문 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}
