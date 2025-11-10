import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 사용자의 상품 목록 조회
    const products = await prisma.product.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 쇼핑몰 등록 상태 정보 추가
    const productsWithShopStatus = products.map(product => ({
      ...product,
      isRegisteredToShop: product.status === 'ACTIVE',
      // isRegisteredToRetail은 이미 Product 모델에 있으므로 그대로 사용
    }))

    return NextResponse.json({
      success: true,
      products: productsWithShopStatus
    })

  } catch (error) {
    console.error('상품 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: '상품을 조회할 수 없습니다.'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { title, originalPrice, salePrice, description, status } = await request.json()

    if (!title || !originalPrice || !salePrice) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다.'
      }, { status: 400 })
    }

    // 새 상품 생성
    const product = await prisma.product.create({
      data: {
        userId: session.user.id,
        title,
        originalPrice: parseFloat(originalPrice),
        salePrice: parseFloat(salePrice),
        description: description || '',
        status: status || 'DRAFT'
      }
    })

    return NextResponse.json({
      success: true,
      product
    })

  } catch (error) {
    console.error('상품 생성 실패:', error)
    return NextResponse.json({
      success: false,
      error: '상품을 생성할 수 없습니다.'
    }, { status: 500 })
  }
}