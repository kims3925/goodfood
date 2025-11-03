import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  console.log('=== 상품 삭제 API 호출됨 ===')

  try {
    const session = await getServerSession(authOptions)
    console.log('세션 확인:', session?.user?.id)

    if (!session?.user?.id) {
      console.log('인증 실패: 세션이 없음')
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const body = await request.json()
    console.log('요청 body:', body)

    const { productIds } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      console.log('잘못된 요청: productIds가 없거나 빈 배열')
      return NextResponse.json({
        success: false,
        error: '삭제할 상품 ID가 필요합니다.'
      }, { status: 400 })
    }

    console.log(`삭제할 상품 ID들: ${productIds.join(', ')}`)

    // 먼저 삭제할 상품들이 존재하는지 확인
    const existingProducts = await prisma.product.findMany({
      where: {
        id: {
          in: productIds
        }
      },
      select: {
        id: true,
        title: true
      }
    })

    console.log(`기존 상품 개수: ${existingProducts.length}`)
    console.log('기존 상품들:', existingProducts)

    if (existingProducts.length === 0) {
      return NextResponse.json({
        success: false,
        error: '삭제할 상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 주문이 있는 상품들 확인
    const ordersWithProducts = await prisma.order.findMany({
      where: {
        productId: { in: productIds }
      }
    })
    console.log(`주문이 있는 상품 개수: ${ordersWithProducts.length}`)

    // 트랜잭션으로 관련 데이터들과 함께 삭제
    const result = await prisma.$transaction(async (tx) => {
      // 1. RetailPost 삭제 (소매밴드 게시물)
      const deletedRetailPosts = await tx.retailPost.deleteMany({
        where: {
          productId: { in: productIds }
        }
      })
      console.log(`삭제된 소매밴드 게시물: ${deletedRetailPosts.count}개`)

      // 2. 장바구니에서 해당 상품들 제거
      const deletedCartItems = await tx.cartItem.deleteMany({
        where: {
          productId: { in: productIds }
        }
      })
      console.log(`삭제된 장바구니 아이템: ${deletedCartItems.count}개`)

      // 3. 상품 페이지 데이터 삭제
      const deletedProductPages = await tx.productPage.deleteMany({
        where: {
          productId: { in: productIds }
        }
      })
      console.log(`삭제된 상품 페이지: ${deletedProductPages.count}개`)

      // 4. 주문이 있는 상품의 경우 상태를 DELETED로 변경
      if (ordersWithProducts.length > 0) {
        const orderedProductIds = ordersWithProducts.map(order => order.productId)

        // 주문이 있는 상품은 상태만 변경
        const updatedProducts = await tx.product.updateMany({
          where: {
            id: { in: orderedProductIds }
          },
          data: {
            status: 'DELETED',
            updatedAt: new Date()
          }
        })
        console.log(`상태 변경된 상품: ${updatedProducts.count}개`)

        // 주문이 없는 상품들만 실제 삭제
        const productsToDelete = productIds.filter((id: string) => !orderedProductIds.includes(id))

        if (productsToDelete.length > 0) {
          const deletedProducts = await tx.product.deleteMany({
            where: {
              id: { in: productsToDelete }
            }
          })
          console.log(`실제 삭제된 상품: ${deletedProducts.count}개`)
          return { deletedCount: deletedProducts.count, deactivatedCount: updatedProducts.count }
        } else {
          return { deletedCount: 0, deactivatedCount: updatedProducts.count }
        }
      } else {
        // 주문이 없는 경우 모든 상품 실제 삭제
        const deletedProducts = await tx.product.deleteMany({
          where: {
            id: { in: productIds }
          }
        })
        console.log(`실제 삭제된 상품: ${deletedProducts.count}개`)
        return { deletedCount: deletedProducts.count, deactivatedCount: 0 }
      }
    })

    const totalProcessed = result.deletedCount + result.deactivatedCount
    const message = ordersWithProducts.length > 0
      ? `총 ${totalProcessed}개 상품 처리 완료 (삭제: ${result.deletedCount}개, 비활성화: ${result.deactivatedCount}개)`
      : `${result.deletedCount}개 상품이 완전히 삭제되었습니다.`

    return NextResponse.json({
      success: true,
      message,
      deletedCount: result.deletedCount,
      deactivatedCount: result.deactivatedCount,
      hasOrderedProducts: ordersWithProducts.length > 0
    })

  } catch (error) {
    console.error('상품 삭제 실패 - 상세 에러:', error)
    console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음')
    return NextResponse.json({
      success: false,
      error: '상품 삭제 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}