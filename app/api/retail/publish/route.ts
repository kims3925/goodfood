import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'

export async function POST(req: Request) {
  try {
    // 인증 확인
    const session = await getServerSession()
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { productIds, retailBandIds } = await req.json()

    // 입력값 검증
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '상품을 선택해주세요.' },
        { status: 400 }
      )
    }

    if (!retailBandIds || !Array.isArray(retailBandIds) || retailBandIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '소매밴드를 선택해주세요.' },
        { status: 400 }
      )
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 선택된 상품들 조회
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        userId: user.id,
        status: 'ACTIVE', // 활성화된 상품만
      },
    })

    if (products.length === 0) {
      return NextResponse.json(
        { success: false, error: '발행 가능한 상품이 없습니다.' },
        { status: 404 }
      )
    }

    // 선택된 소매밴드들 조회
    const retailBands = await prisma.retailBand.findMany({
      where: {
        id: { in: retailBandIds },
        userId: user.id,
        isActive: true, // 활성화된 밴드만
      },
    })

    if (retailBands.length === 0) {
      return NextResponse.json(
        { success: false, error: '활성화된 소매밴드가 없습니다.' },
        { status: 404 }
      )
    }

    const publishResults: any[] = []
    const publishedProductIds: string[] = []

    // 각 상품을 각 소매밴드에 발행
    for (const product of products) {
      for (const retailBand of retailBands) {
        try {
          // 쇼핑몰 링크 생성
          const shopUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/store/product/${product.id}`

          // 소매밴드 게시 내용 구성
          const title = product.hookingTitle || product.title
          const content = `${product.hookingContent || product.description}\n\n🛒 구매하기: ${shopUrl}`
          const images = product.images ? JSON.parse(product.images) : []
          const price = product.salePrice
          const shippingFee = product.shippingFee || 0

          // TODO: 실제 밴드 API 호출하여 게시물 발행
          // const bandPostId = await publishToBand(retailBand.bandKey, {
          //   title,
          //   content,
          //   images,
          // })

          // 현재는 시뮬레이션으로 bandPostId 생성
          const bandPostId = null // 실제 발행 전까지는 null

          // RetailPost 테이블에 저장
          const retailPost = await prisma.retailPost.create({
            data: {
              userId: user.id,
              retailBandId: retailBand.id,
              productId: product.id,
              bandPostId: bandPostId, // 실제 밴드 API 호출 시 받아온 ID
              title: title,
              content: content,
              images: JSON.stringify(images),
              price: price,
              shippingFee: shippingFee,
              status: 'PUBLISHED', // PUBLISHED, DELETED, FAILED
            },
          })

          publishResults.push({
            productId: product.id,
            productTitle: product.title,
            retailBandId: retailBand.id,
            retailBandName: retailBand.bandName,
            retailPostId: retailPost.id,
            success: true,
          })

          // 상품이 발행되었음을 표시
          if (!publishedProductIds.includes(product.id)) {
            publishedProductIds.push(product.id)
          }

        } catch (productError: any) {
          console.error(`Failed to publish product ${product.id} to band ${retailBand.id}:`, productError)

          publishResults.push({
            productId: product.id,
            productTitle: product.title,
            retailBandId: retailBand.id,
            retailBandName: retailBand.bandName,
            success: false,
            error: productError.message || '발행 실패',
          })
        }
      }
    }

    // 발행된 상품들의 isRegisteredToRetail 플래그 업데이트
    if (publishedProductIds.length > 0) {
      await prisma.product.updateMany({
        where: {
          id: { in: publishedProductIds },
        },
        data: {
          isRegisteredToRetail: true,
          updatedAt: new Date(),
        },
      })
    }

    const successCount = publishResults.filter(r => r.success).length
    const failureCount = publishResults.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `${successCount}건의 게시물이 소매밴드에 발행되었습니다.${failureCount > 0 ? ` (실패: ${failureCount}건)` : ''}`,
      results: publishResults,
      stats: {
        totalProducts: products.length,
        totalBands: retailBands.length,
        successCount,
        failureCount,
      },
    })

  } catch (error) {
    console.error('Failed to publish to retail:', error)
    return NextResponse.json(
      {
        success: false,
        error: '소매밴드 발행 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
