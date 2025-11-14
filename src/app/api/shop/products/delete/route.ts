import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/client'

export async function DELETE(req: NextRequest) {
  try {
    const { productIds } = await req.json()

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '삭제할 상품 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 상품들이 존재하는지 확인
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      }
    })

    if (products.length === 0) {
      return NextResponse.json({
        success: false,
        error: '삭제할 상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 주문이 있는 상품들 확인 (Order → OrderItem → Product 관계 확인)
    const orderItemsWithProducts = await prisma.orderItem.findMany({
      where: {
        productId: { in: productIds }
      },
      select: {
        orderId: true
      }
    })

    if (orderItemsWithProducts.length > 0) {
      return NextResponse.json({
        success: false,
        error: '주문이 있는 상품은 삭제할 수 없습니다. 상품 상태를 비활성화로 변경해보세요.',
        hasOrders: true,
        orderCount: orderItemsWithProducts.length
      }, { status: 400 })
    }

    // 상품을 실제로 삭제하는 대신 상태를 DELETED로 변경
    const updatedProducts = await prisma.product.updateMany({
      where: {
        id: { in: productIds }
      },
      data: {
        status: 'DELETED',
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      deletedCount: updatedProducts.count,
      message: `${updatedProducts.count}개 상품이 삭제되었습니다.`
    })

  } catch (error) {
    console.error('상품 삭제 오류:', error)
    return NextResponse.json({
      success: false,
      error: '상품 삭제 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}