/**
 * GET /api/v1/products/{id} — 상품 상세 (STEP 4-3, scope: products:read)
 * 공급가, 옵션/variant, 이미지, 배송정책, sourceStatus 포함.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { authenticateApiRequest, logApiCall, apiError } from '@/lib/openapi/auth'
import { formatProductSummary } from '@/lib/openapi/products'

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
      where: {
        id: productId,
        deletedAt: null,
        shopProducts: { some: { deletedAt: null } },
      },
      include: {
        variants: { where: { deletedAt: null }, orderBy: { id: 'asc' } },
        options: { orderBy: { sortOrder: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' }, select: { url: true, sortOrder: true } },
      },
    })

    if (!product) {
      logApiCall(auth, req, 404)
      return apiError(404, 'PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.')
    }

    const optionGroups = product.options.reduce((acc: Record<string, string[]>, option) => {
      if (!acc[option.groupName]) acc[option.groupName] = []
      acc[option.groupName].push(option.value)
      return acc
    }, {})

    const res = NextResponse.json({
      data: {
        ...formatProductSummary(product),
        description: product.description,
        shipping_info: product.shippingInfo,
        bundle_max_qty: product.bundleMaxQty ?? 1,
        images: product.images.map((img) => img.url),
        option_groups: optionGroups,
        variants: product.variants.map((v) => ({
          id: v.id,
          option_summary: v.optionSummary,
          wholesale_price: v.wholesalePrice != null ? Number(v.wholesalePrice) : null,
          retail_price: v.price,
          bundle_unit: v.bundleUnit ?? 1,
        })),
      },
    })
    logApiCall(auth, req, 200)
    return res
  } catch (error: any) {
    console.error('[OpenAPI product detail]', error)
    logApiCall(auth, req, 500)
    return apiError(500, 'INTERNAL_ERROR', '상품 상세 조회에 실패했습니다.')
  }
}
