import { NextResponse } from 'next/server'
import prisma from '@/lib/database/client'

export async function GET() {
  try {
    // 쇼핑몰에 등록된 상품 조회
    const products = await prisma.product.findMany({
      where: {
        // 쇼핑몰에 등록된 상품만 조회 (DELETED 상태 제외)
        status: {
          in: ['ACTIVE', 'SOLD_OUT', 'DRAFT']
        }
      },
      include: {
        images: true,
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 상품 데이터 형식 변환
    const formattedProducts = products.map((product) => ({
      id: product.id,
      title: product.hookingTitle || product.title,
      productCode: `SHOP-${new Date(product.createdAt).getFullYear()}-${product.id.toString().slice(0, 3)}`,
      link: `/shop/product/${product.id}`,
      shortLink: `shop/${product.id}`,
      originalPrice: product.originalPrice || 0,
      salePrice: product.salePrice || product.originalPrice || 0,
      status: product.status === 'ACTIVE' ? 'active' : product.status === 'SOLD_OUT' ? 'soldout' : 'draft',
      createdAt: product.createdAt.toISOString(),
      views: 0, // 조회수는 추후 구현
      orders: 0, // 주문수는 추후 구현
      stock: 100, // 재고는 추후 구현
      category: product.category?.code || '미분류',
      images: product.images.map(img => img.url),
      description: product.hookingContent || product.description,
      rating: 4.5, // 평점은 추후 구현
      reviews: 0, // 리뷰수는 추후 구현
      discount: product.originalPrice && product.salePrice
        ? Math.round(((product.originalPrice - product.salePrice) / product.originalPrice) * 100)
        : 0,
    }))

    return NextResponse.json({
      success: true,
      products: formattedProducts,
    })
  } catch (error) {
    console.error('Failed to load shop products:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load products',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const { productIds } = await req.json()

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product IDs are required',
        },
        { status: 400 }
      )
    }

    // 선택된 상품들을 ACTIVE 상태로 변경 (쇼핑몰 등록)
    const updatedProducts = await prisma.product.updateMany({
      where: {
        id: {
          in: productIds,
        },
      },
      data: {
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: `${updatedProducts.count}개 상품이 쇼핑몰에 등록되었습니다.`,
      count: updatedProducts.count,
    })
  } catch (error) {
    console.error('Failed to register products to shop:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to register products',
      },
      { status: 500 }
    )
  }
}
