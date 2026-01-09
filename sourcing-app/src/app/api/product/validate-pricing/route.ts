export const dynamic = 'force-dynamic'

/**
 * 가격 정책 적용 검증 API
 * 도매가와 소매가가 동일한 상품을 조회합니다.
 *
 * GET /api/product/validate-pricing
 * Query params:
 *   - limit: 최대 조회 개수 (기본: 100)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@modules/auth/auth.config'

interface UnpricedProduct {
  productId: number
  productName: string
  channelName: string | null
  createdAt: Date
  variants: {
    id: number
    optionSummary: string | null
    wholesalePrice: number | null
    price: number
  }[]
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '100')

    // 도매가와 소매가가 같은 variants 조회
    const unpricedVariants = await prisma.productVariant.findMany({
      where: {
        product: { userId },
        wholesalePrice: { not: null },
        // Prisma에서 같은 필드 비교는 raw query 필요
      },
      include: {
        product: {
          include: {
            channel: { select: { name: true } }
          }
        }
      },
      orderBy: { product: { createdAt: 'desc' } },
    })

    // wholesalePrice === price인 것만 필터링
    const filteredVariants = unpricedVariants.filter(
      v => v.wholesalePrice !== null && Number(v.wholesalePrice) === v.price
    )

    // 상품별로 그룹화
    const productMap = new Map<number, UnpricedProduct>()

    for (const v of filteredVariants) {
      if (!productMap.has(v.productId)) {
        productMap.set(v.productId, {
          productId: v.productId,
          productName: v.product.name,
          channelName: v.product.channel?.name || null,
          createdAt: v.product.createdAt,
          variants: []
        })
      }

      productMap.get(v.productId)!.variants.push({
        id: v.id,
        optionSummary: v.optionSummary,
        wholesalePrice: Number(v.wholesalePrice),
        price: v.price
      })
    }

    const products = Array.from(productMap.values()).slice(0, limit)

    // 통계
    const stats = {
      totalProducts: products.length,
      totalVariants: filteredVariants.length,
    }

    // 가격 정책 미적용 이유 분석
    const reasons = [
      {
        reason: '변환 시 가격 정책 미선택',
        description: '상품 변환 시 가격 정책을 선택하지 않으면 AI에 정책이 전달되지 않습니다.',
        solution: '수집상품 관리에서 가격 정책을 선택하고 다시 변환하세요.'
      },
      {
        reason: 'AI 해석 오류',
        description: 'AI가 가격 정책을 제대로 해석하지 못했을 수 있습니다.',
        solution: '가격 정책 내용을 더 명확하게 수정하세요. 예: "도매가 × 1.3 = 소매가"'
      },
      {
        reason: '정책 내용 불명확',
        description: '정책 내용이 모호하여 AI가 적용하지 못했습니다.',
        solution: '구체적인 수식이나 비율을 명시하세요.'
      },
      {
        reason: '원본 게시물 정보 부족',
        description: '원본 게시물에 가격 정보가 명확하지 않았습니다.',
        solution: '상품 편집에서 직접 소매가를 수정하세요.'
      }
    ]

    return NextResponse.json({
      success: true,
      stats,
      products,
      reasons,
    })

  } catch (error: any) {
    console.error('[validate-pricing] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '검증 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
