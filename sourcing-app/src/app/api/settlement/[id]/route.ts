import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'

/**
 * GET /api/settlement/[id]
 *
 * 정산 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId
    const settlementId = parseInt(params.id)

    const settlement = await prisma.settlement.findFirst({
      where: {
        id: settlementId,
        userId,
      },
      include: {
        retailBand: {
          select: { id: true, name: true, coverUrl: true },
        },
        orders: {
          include: {
            order: {
              include: {
                items: {
                  include: {
                    product: {
                      select: { id: true, name: true, thumbnailUrl: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!settlement) {
      return NextResponse.json(
        { success: false, error: '정산을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: settlement,
    })
  } catch (error) {
    console.error('정산 상세 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settlement/[id]
 *
 * 정산 상태 업데이트
 *
 * Body:
 * - status?: 'PENDING' | 'COMPLETED' | 'CANCELLED'
 * - memo?: string
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId
    const settlementId = parseInt(params.id)

    const body = await request.json()
    const { status, memo } = body

    // 기존 정산 확인
    const existingSettlement = await prisma.settlement.findFirst({
      where: {
        id: settlementId,
        userId,
      },
    })

    if (!existingSettlement) {
      return NextResponse.json(
        { success: false, error: '정산을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 업데이트 데이터 준비
    const updateData: any = {}

    if (status) {
      if (!['PENDING', 'COMPLETED', 'CANCELLED'].includes(status)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 상태입니다.' },
          { status: 400 }
        )
      }
      updateData.status = status

      // 완료 시 settledAt 설정
      if (status === 'COMPLETED') {
        updateData.settledAt = new Date()
      } else {
        updateData.settledAt = null
      }
    }

    if (memo !== undefined) {
      updateData.memo = memo
    }

    // 업데이트
    const settlement = await prisma.settlement.update({
      where: { id: settlementId },
      data: updateData,
      include: {
        retailBand: {
          select: { id: true, name: true },
        },
        _count: {
          select: { orders: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: status === 'COMPLETED' ? '정산이 완료 처리되었습니다.' : '정산이 업데이트되었습니다.',
      data: settlement,
    })
  } catch (error) {
    console.error('정산 업데이트 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settlement/[id]
 *
 * 정산 삭제 (PENDING 상태만 가능)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId
    const settlementId = parseInt(params.id)

    // 기존 정산 확인
    const existingSettlement = await prisma.settlement.findFirst({
      where: {
        id: settlementId,
        userId,
      },
    })

    if (!existingSettlement) {
      return NextResponse.json(
        { success: false, error: '정산을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // PENDING 상태만 삭제 가능
    if (existingSettlement.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: '대기중 상태의 정산만 삭제할 수 있습니다.' },
        { status: 400 }
      )
    }

    // 삭제 (SettlementOrder는 Cascade로 자동 삭제)
    await prisma.settlement.delete({
      where: { id: settlementId },
    })

    return NextResponse.json({
      success: true,
      message: '정산이 삭제되었습니다.',
    })
  } catch (error) {
    console.error('정산 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
