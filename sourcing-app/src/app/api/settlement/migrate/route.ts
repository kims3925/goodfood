import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@/lib/prisma'

/**
 * POST /api/settlement/migrate
 *
 * 기존 주문의 retailBandId를 일괄 업데이트 (마이그레이션)
 * - productId가 있고 retailBandId가 없는 주문 대상
 * - PublishHistory에서 해당 상품의 소매밴드를 찾아서 매칭
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

    // retailBandId가 없지만 productId가 있는 주문 조회
    const ordersToUpdate = await prisma.purchaseOrder.findMany({
      where: {
        userId,
        retailBandId: null,
        productId: { not: null },
      },
      select: {
        id: true,
        productId: true,
      },
    })

    if (ordersToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: '마이그레이션할 주문이 없습니다.',
        data: { updated: 0, total: 0 },
      })
    }

    // 각 상품별 최근 발행 소매밴드 조회
    const productIds = [...new Set(ordersToUpdate.map(o => o.productId!).filter(Boolean))]

    const publishHistories = await prisma.publishHistory.findMany({
      where: {
        userId,
        productId: { in: productIds },
        status: 'SUCCESS',
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        productId: true,
        retailBandId: true,
      },
    })

    // 상품 -> 소매밴드 매핑 (가장 최근 발행 기준)
    const productToRetailBand = new Map<number, number>()
    publishHistories.forEach(ph => {
      if (!productToRetailBand.has(ph.productId)) {
        productToRetailBand.set(ph.productId, ph.retailBandId)
      }
    })

    // 일괄 업데이트
    let updatedCount = 0
    for (const order of ordersToUpdate) {
      const retailBandId = productToRetailBand.get(order.productId!)
      if (retailBandId) {
        await prisma.purchaseOrder.update({
          where: { id: order.id },
          data: { retailBandId },
        })
        updatedCount++
      }
    }

    // 매칭 안 된 상품 ID 확인
    const unmatchedProductIds = productIds.filter(pid => !productToRetailBand.has(pid))

    return NextResponse.json({
      success: true,
      message: `${updatedCount}개의 주문이 소매밴드와 매칭되었습니다.`,
      data: {
        updated: updatedCount,
        total: ordersToUpdate.length,
        skipped: ordersToUpdate.length - updatedCount,
        debug: {
          totalProductIds: productIds.length,
          matchedProductIds: productToRetailBand.size,
          unmatchedProductIds: unmatchedProductIds.slice(0, 10), // 최대 10개만
        },
      },
    })
  } catch (error) {
    console.error('주문 마이그레이션 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 마이그레이션에 실패했습니다.' },
      { status: 500 }
    )
  }
}
