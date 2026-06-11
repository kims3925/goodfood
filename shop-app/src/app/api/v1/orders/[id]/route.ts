/**
 * GET /api/v1/orders/{id} — 발주 상세 (STEP 4-3, scope: orders:read)
 * 본인(클라이언트 소유자) 발주만 조회 가능.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { authenticateApiRequest, logApiCall, apiError } from '@/lib/openapi/auth'
import { formatOrderForApi } from '@/lib/openapi/orders'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiRequest(req, 'orders:read')
  if (auth instanceof NextResponse) return auth

  const orderId = parseInt(params.id, 10)
  if (!Number.isFinite(orderId) || orderId <= 0) {
    logApiCall(auth, req, 400)
    return apiError(400, 'INVALID_ORDER_ID', '유효하지 않은 발주 ID 입니다.')
  }

  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: auth.userId, orderType: 'B2B_API' },
      include: { items: true, shippingAddress: true },
    })

    if (!order) {
      logApiCall(auth, req, 404)
      return apiError(404, 'ORDER_NOT_FOUND', '발주를 찾을 수 없습니다.')
    }

    const res = NextResponse.json({ data: formatOrderForApi(order) })
    logApiCall(auth, req, 200)
    return res
  } catch (error: any) {
    logApiCall(auth, req, 500)
    return apiError(500, 'INTERNAL_ERROR', '발주 상세 조회에 실패했습니다.')
  }
}
