/**
 * 결제 URL 빌더 (작업지시서 §6-1).
 *
 * 우선순위:
 * 1. ExternalSourcedProduct.checkoutUrl 직접 지정 (수동 매핑 결과)
 * 2. checkoutConnection 의 커넥터로 URL 생성 (시나리오 B)
 * 3. 소싱 connection 의 커넥터 URL (시나리오 A — 소싱처 = 결제처)
 * 4. 자체 shop-app URL (폴백 — 외부 소싱 아닌 경우)
 */

import prisma from '@bandauto/db'
import { ConnectorFactory } from '../external-mall.service'

export interface BuildCheckoutOptions {
  variantId?: string
  quantity?: number
  trackingCode?: string
}

export interface CheckoutUrlResult {
  url: string
  type: 'external' | 'internal'
  source?: 'manual' | 'checkout_connection' | 'sourcing_connection' | 'fallback'
}

export class CheckoutUrlBuilder {
  async buildCheckoutUrl(
    productId: number,
    options: BuildCheckoutOptions = {}
  ): Promise<CheckoutUrlResult> {
    const sourced = await prisma.externalSourcedProduct.findFirst({
      where: { productId, isActive: true },
      include: {
        connection: true,
        checkoutConnection: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!sourced) {
      // 외부 소싱이 아닌 경우 → shop-app URL 폴백
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, userId: true, shopProducts: { select: { shop: { select: { subdomain: true } } }, take: 1 } },
      })
      const subdomain = product?.shopProducts[0]?.shop?.subdomain
      const shopHost =
        process.env.NEXT_PUBLIC_SHOP_DOMAIN ||
        process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') ||
        'snsauto.kr'
      const url = subdomain
        ? `https://${subdomain}.${shopHost}/product/${productId}`
        : `${process.env.NEXT_PUBLIC_APP_URL || 'https://' + shopHost}/product/${productId}`
      return { url, type: 'internal', source: 'fallback' }
    }

    // Case 1: 수동 매핑된 checkoutUrl 직접 사용
    if (sourced.checkoutUrl) {
      return {
        url: this.appendTracking(sourced.checkoutUrl, options.trackingCode),
        type: 'external',
        source: 'manual',
      }
    }

    // Case 2: 별도 결제 쇼핑몰 (시나리오 B)
    if (sourced.checkoutConnection) {
      try {
        const connector = ConnectorFactory.create(sourced.checkoutConnection)
        const checkoutProductId = sourced.checkoutProductId || sourced.externalProductId
        const url = connector.getCheckoutUrl(checkoutProductId, {
          variantId: options.variantId,
          quantity: options.quantity,
          affiliateCode: options.trackingCode || `ba_${productId}`,
        })
        return { url, type: 'external', source: 'checkout_connection' }
      } catch {
        // 결제몰 커넥터 실패 → 소싱처 URL 폴백
      }
    }

    // Case 3: 소싱처 = 결제처 (시나리오 A)
    try {
      const connector = ConnectorFactory.create(sourced.connection)
      const url = connector.getCheckoutUrl(sourced.externalProductId, {
        variantId: options.variantId,
        quantity: options.quantity,
        affiliateCode: options.trackingCode || `ba_${productId}`,
      })
      return { url, type: 'external', source: 'sourcing_connection' }
    } catch {
      // 커넥터 실패 → 원본 URL 폴백
      return {
        url: sourced.externalUrl,
        type: 'external',
        source: 'sourcing_connection',
      }
    }
  }

  /** 밴드 게시물 본문에 들어갈 "주문하기" 링크 생성 */
  async buildBandOrderLink(productId: number): Promise<string> {
    const trackingCode = `band_${productId}_${Date.now()}`
    const { url } = await this.buildCheckoutUrl(productId, { trackingCode })
    return url
  }

  private appendTracking(url: string, code?: string): string {
    if (!code) return url
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}ref=${code}`
  }
}
