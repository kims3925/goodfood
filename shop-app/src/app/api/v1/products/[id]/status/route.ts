/**
 * GET /api/v1/products/{id}/status — 품절/가격 경량 폴링용 (STEP 4-3, scope: products:read)
 * 본문이 작아 고빈도 폴링에 적합. 증분 동기화는 /api/v1/products?updated_after= 권장.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { authenticateApiRequest, logApiCall, apiError } from '@/lib/openapi/auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiRequest(req, 'products:read')
  if (auth instanceof NextResponse) return auth

  const productId = parseInt(params.id, 10)
  if (!Number.isFinite(productId) || productId <= 0) {
    logApiCall(auth, req, 400)
    return apiError(400, 'INVALID_PRODUCT_ID', '유효하지 않은 상품 ID 입니다.')
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: {
        id: true,
        isActive: true,
        sourceStatus: true,
        soldOutAt: true,
        wholesalePrice: true,
        price: true,
        updatedAt: true,
      },
    })

    if (!product) {
      logApiCall(auth, req, 404)
      return apiError(404, 'PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.')
    }

    const res = NextResponse.json({
      data: {
        id: product.id,
        is_active: product.isActive,
        source_status: product.sourceStatus,
        sold_out_at: product.soldOutAt,
        wholesale_price: product.wholesalePrice != null ? Number(product.wholesalePrice) : null,
        retail_price: product.price,
        updated_at: product.updatedAt,
      },
    })
    logApiCall(auth, req, 200)
    return res
  } catch (error: any) {
    logApiCall(auth, req, 500)
    return apiError(500, 'INTERNAL_ERROR', '상품 상태 조회에 실패했습니다.')
  }
}
