import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'

// 개별 상품 조회 (공개용 + 관리자용)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const productId = parseInt(params.id, 10)

    if (!productId) {
      return NextResponse.json(
        { success: false, error: '상품 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 1. 관리자 인증이 있는 경우 - ShopProduct 조회
    if (session?.user?.id) {
      const userId = parseInt(session.user.id, 10)
      const shopProduct = await prisma.shopProduct.findFirst({
        where: {
          id: productId,
          shop: {
            userId: userId
          }
        },
        include: {
          shop: true
        }
      })

      if (shopProduct) {
        return NextResponse.json({
          success: true,
          product: shopProduct
        })
      }
    }

    // 2. 공개 상품 조회 - Product 테이블에서 조회
    let product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: true,
        category: true
      }
    })

    if (!product) {
      // 3. 상품이 없으면 Mock 상품 데이터 반환 (테스트용)
      const mockProduct = {
        id: productId,
        title: '[500g 2,900원] 택배비보다 싼!! 가마솥 사골 도가니탕 2종',
        description: '진한 사골 육수로 끓인 도가니탕입니다. 집에서 간편하게 즐기세요.',
        salePrice: 2900,
        originalPrice: 4900,
        category: '육류',
        images: ['https://via.placeholder.com/600x600/FF6B6B/FFFFFF?text=도가니탕'],
        stock: 1000,
        isActive: true,
        tags: ['도가니탕', '사골', '육류', '냉동'],
        specifications: {
          weight: '500g',
          storage: '냉동보관',
          origin: '국산',
          expiry: '제조일로부터 6개월'
        },
        shippingInfo: {
          freeShippingAmount: 30000,
          defaultShippingFee: 3000,
          shippingMethod: '택배',
          deliveryTime: '1-2일'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        wholesaleBandName: 'Mock 도매업체'
      }

      return NextResponse.json({
        success: true,
        product: mockProduct,
        message: 'Mock 상품 데이터입니다. (테스트 모드)'
      })
    }

    // 상품 이미지 (이제 relation이므로 직접 접근)
    const images = product.images.map(img => img.url)

    const formattedProduct = {
      id: product.id,
      title: product.title,
      description: product.description || '',
      salePrice: product.salePrice,
      originalPrice: product.originalPrice,
      category: product.category?.code || null,
      images,
      shippingFee: product.shippingFee || 0,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      wholesaleBandName: product.wholesaleBandName || null
    }

    return NextResponse.json({
      success: true,
      product: formattedProduct
    })
  } catch (error: any) {
    console.error('상품 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '상품 조회 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// 개별 상품 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)
    const productId = parseInt(params.id, 10)
    const body = await request.json()

    // 상품 존재 및 권한 확인
    const existingProduct = await prisma.shopProduct.findFirst({
      where: {
        id: productId,
        shop: {
          userId: userId
        }
      },
      include: {
        shop: true
      }
    })

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' }, 
        { status: 404 }
      )
    }

    const {
      productCode,
      category,
      name,
      summary,
      status,
      stock,
      supplyPrice,
      salePrice,
      shippingType,
      shippingFee,
      shippingUnit,
      hasOptions,
      options,
      thumbnail,
      detailContent,
      taxType,
      isPublished
    } = body

    // 상품코드가 변경되었다면 중복 확인
    if (productCode && productCode !== existingProduct.productCode) {
      const duplicateProduct = await prisma.shopProduct.findUnique({
        where: {
          shopId_productCode: {
            shopId: existingProduct.shopId,
            productCode
          }
        }
      })

      if (duplicateProduct) {
        return NextResponse.json(
          { error: 'Product code already exists in this shop', code: 'CODE_EXISTS' }, 
          { status: 409 }
        )
      }
    }

    // 상품 수정
    const product = await prisma.shopProduct.update({
      where: { id: productId },
      data: {
        ...(productCode && { productCode }),
        ...(category && { category }),
        ...(name && { name }),
        ...(summary !== undefined && { summary }),
        ...(status && { status }),
        ...(stock !== undefined && { stock }),
        ...(supplyPrice !== undefined && { supplyPrice }),
        ...(salePrice !== undefined && { salePrice }),
        ...(shippingType && { shippingType }),
        ...(shippingFee !== undefined && { shippingFee }),
        ...(shippingUnit !== undefined && { shippingUnit }),
        ...(hasOptions !== undefined && { hasOptions }),
        ...(options && { options: JSON.stringify(options) }),
        ...(thumbnail !== undefined && { thumbnail }),
        ...(detailContent !== undefined && { detailContent }),
        ...(taxType && { taxType }),
        ...(isPublished !== undefined && { isPublished })
      }
    })

    return NextResponse.json({ 
      success: true, 
      product 
    })
  } catch (error) {
    console.error('상품 수정 실패:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// 상품 부분 수정 (PATCH)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)
    const productId = parseInt(params.id, 10)
    const body = await request.json()

    // 상품 존재 및 권한 확인
    const existingProduct = await prisma.shopProduct.findFirst({
      where: {
        id: productId,
        shop: {
          userId: userId
        }
      }
    })

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // 상품 부분 수정 (받은 필드만 업데이트)
    const product = await prisma.shopProduct.update({
      where: { id: productId },
      data: body
    })

    return NextResponse.json({ 
      success: true, 
      product 
    })
  } catch (error) {
    console.error('상품 부분 수정 실패:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// 개별 상품 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)
    const productId = parseInt(params.id, 10)

    // 상품 존재 및 권한 확인
    const existingProduct = await prisma.shopProduct.findFirst({
      where: {
        id: productId,
        shop: {
          userId: userId
        }
      }
    })

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // 상품 삭제
    await prisma.shopProduct.delete({
      where: { id: productId }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Product deleted successfully'
    })
  } catch (error) {
    console.error('상품 삭제 실패:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}