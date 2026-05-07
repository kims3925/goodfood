/**
 * GET /api/external-mall/go/[productId]?ref=trackingCode
 * 결제 URL 클릭 추적 + 외부몰 리다이렉트.
 *
 * 밴드 게시물의 "주문하기" 링크를 이 라우트로 두면:
 * 1. ExternalOrder.clickedAt 기록
 * 2. CheckoutUrlBuilder 로 최신 URL 계산
 * 3. 302 리다이렉트
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { CheckoutUrlBuilder } from '@/modules/external-mall/checkout/checkout-url.builder'

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  const productId = Number(params.productId)
  if (!Number.isFinite(productId)) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  const trackingCode = request.nextUrl.searchParams.get('ref') || undefined

  // 외부 소싱 매핑 조회
  const sourced = await prisma.externalSourcedProduct.findFirst({
    where: { productId, isActive: true },
    select: {
      id: true,
      userId: true,
      checkoutConnectionId: true,
      connectionId: true,
      product: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // ExternalOrder 클릭 로그 (실패해도 리다이렉트는 진행)
  if (sourced) {
    prisma.externalOrder
      .create({
        data: {
          userId: sourced.userId,
          checkoutConnectionId: sourced.checkoutConnectionId ?? sourced.connectionId,
          sourcedProductId: sourced.id,
          productName: sourced.product?.name || `Product#${productId}`,
          status: 'pending',
          trackingCode,
          clickedAt: new Date(),
        },
      })
      .catch((err) => console.warn('[go] 클릭 로그 실패:', err.message))
  }

  // 최종 결제 URL 계산
  const builder = new CheckoutUrlBuilder()
  const { url } = await builder.buildCheckoutUrl(productId, { trackingCode })

  return NextResponse.redirect(url, { status: 302 })
}
