import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const productId = params.id
    const updates = await request.json()

    // 상품이 존재하고 사용자 소유인지 확인
    const existingProduct = await prisma.product.findUnique({
      where: {
        id: productId,
        userId: session.user.id
      }
    })

    if (!existingProduct) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없거나 수정 권한이 없습니다.'
      }, { status: 404 })
    }

    // 업데이트 가능한 필드들만 필터링
    const allowedUpdates = {
      title: updates.title,
      description: updates.description,
      hookingTitle: updates.hookingTitle,
      hookingContent: updates.hookingContent,
      detailedContent: updates.detailedContent,
      originalPrice: parseFloat(updates.originalPrice) || existingProduct.originalPrice,
      salePrice: parseFloat(updates.salePrice) || existingProduct.salePrice,
      shippingFee: updates.shippingFee ? parseFloat(updates.shippingFee) : existingProduct.shippingFee,
      priceInfo: updates.priceInfo || existingProduct.priceInfo,
      specialNotes: updates.specialNotes,
      productCategory: updates.productCategory,
      status: updates.status,
      updatedAt: new Date()
    }

    // null이나 undefined 값들을 제거하고 유효한 업데이트만 포함
    const validUpdates = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([key, value]) => {
        // 문자열 필드는 빈 문자열도 허용
        if (typeof value === 'string') {
          return true
        }
        // 숫자 필드는 0도 허용하지만 NaN은 제외
        if (typeof value === 'number') {
          return !isNaN(value)
        }
        // Date 객체는 허용
        if (value instanceof Date) {
          return true
        }
        // null이나 undefined는 제외
        return value !== null && value !== undefined
      })
    )

    // 상품 업데이트
    const updatedProduct = await prisma.product.update({
      where: {
        id: productId
      },
      data: validUpdates
    })

    console.log(`상품 업데이트 완료: ${updatedProduct.title} (${updatedProduct.id})`)

    return NextResponse.json({
      success: true,
      message: '상품이 성공적으로 업데이트되었습니다.',
      product: updatedProduct
    })

  } catch (error) {
    console.error('상품 업데이트 실패:', error)
    return NextResponse.json({
      success: false,
      error: '상품 업데이트 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const productId = params.id

    // 상품이 존재하고 사용자 소유인지 확인
    const existingProduct = await prisma.product.findUnique({
      where: {
        id: productId,
        userId: session.user.id
      }
    })

    if (!existingProduct) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없거나 삭제 권한이 없습니다.'
      }, { status: 404 })
    }

    // 상품 삭제
    await prisma.product.delete({
      where: {
        id: productId
      }
    })

    console.log(`상품 삭제 완료: ${existingProduct.title} (${existingProduct.id})`)

    return NextResponse.json({
      success: true,
      message: '상품이 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('상품 삭제 실패:', error)
    return NextResponse.json({
      success: false,
      error: '상품 삭제 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const productId = params.id

    // 상품 조회
    const product = await prisma.product.findUnique({
      where: {
        id: productId,
        userId: session.user.id
      }
    })

    if (!product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      product: product
    })

  } catch (error) {
    console.error('상품 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: '상품 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}