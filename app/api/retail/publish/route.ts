import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

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

    // 선택된 상품들 조회
    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        // 쇼핑몰에 등록된 상품들만 대상
        status: 'ACTIVE'
      },
    })

    if (products.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid products found for retail publishing',
        },
        { status: 404 }
      )
    }

    // TODO: 실제 소매밴드 등록 로직 구현
    // 현재는 시뮬레이션으로 처리
    const publishResults = []

    for (const product of products) {
      try {
        // 쇼핑몰 링크 생성
        const shopUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/store/product/${product.id}`

        // 소매밴드 게시 내용 구성
        const publishContent = {
          title: product.hookingTitle || product.title,
          content: product.hookingContent || product.description,
          price: product.salePrice,
          shopUrl: shopUrl,
          images: product.images ? JSON.parse(product.images) : []
        }

        // TODO: 여기서 실제 밴드 API 호출
        // await publishToBand(publishContent)

        publishResults.push({
          productId: product.id,
          success: true,
          publishContent
        })

        // 소매밴드 등록 상태 업데이트 (임시로 Product 테이블에 추가 필드 가정)
        // 실제로는 별도 테이블이나 상태 관리가 필요할 수 있음
        await prisma.product.update({
          where: { id: product.id },
          data: {
            updatedAt: new Date(),
            // isRegisteredToRetail: true  // 스키마에 필드 추가 필요
          }
        })

      } catch (productError) {
        console.error(`Failed to publish product ${product.id}:`, productError)
        publishResults.push({
          productId: product.id,
          success: false,
          error: 'Failed to publish to retail band'
        })
      }
    }

    const successCount = publishResults.filter(r => r.success).length
    const failureCount = publishResults.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `${successCount}개 상품이 소매밴드에 등록되었습니다.${failureCount > 0 ? ` (실패: ${failureCount}개)` : ''}`,
      results: publishResults,
      successCount,
      failureCount
    })

  } catch (error) {
    console.error('Failed to publish to retail:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to publish to retail bands',
      },
      { status: 500 }
    )
  }
}