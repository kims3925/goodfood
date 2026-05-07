/**
 * 외부몰 → 밴드오토 Product 직접 등록 (작업지시서 §5-3, 보정).
 *
 * 보정: 작업지침서는 CollectedProduct 단계를 거쳤지만, CollectedProduct.postId
 *      가 NOT NULL 이라 외부몰 소싱 시 더미 0 입력은 FK 위반. 따라서 외부몰
 *      소싱은 CollectedProduct 를 SKIP 하고 직접 Product 를 생성.
 *      (Product.collectedPostId 도 nullable 이라 외부몰 상품은 NULL 로 둠)
 *
 * 시나리오 A 흐름:
 *   1. Cafe24 API 로 상품 목록 조회
 *   2. 중복 체크 (ExternalSourcedProduct.unique[connectionId, externalProductId])
 *   3. Product 생성 (사용자 선호 옵션: AI 가공 ON/OFF — 일단 OFF, 향후 추가)
 *   4. ExternalSourcedProduct 매핑 생성 (productId 연결)
 *   5. 가격/재고 동기화 메타 저장
 */

import prisma from '@bandauto/db'
import { ConnectorFactory } from '../external-mall.service'
import type { ExternalProduct } from '../types'

export interface SourceBatchParams {
  connectionId: number
  userId: number
  productIds?: string[]
  maxProducts?: number
  minPrice?: number
  maxPrice?: number
  defaultMargin?: number // 도매가→판매가 마진 (%) — 시나리오 B 에서 활용
}

export interface SourceBatchResult {
  total: number
  created: number
  skipped: number
  failed: number
  errors: string[]
  productIds: number[]
}

export class MallSourcingService {
  async sourceBatch(params: SourceBatchParams): Promise<SourceBatchResult> {
    const connection = await prisma.externalMallConnection.findUnique({
      where: { id: params.connectionId },
    })
    if (!connection || connection.deletedAt) {
      throw new Error('연결 정보 없음 또는 삭제됨')
    }
    if (connection.userId !== params.userId) {
      throw new Error('권한 없음')
    }

    const connector = ConnectorFactory.create({
      platform: connection.platform,
      mallId: connection.mallId,
      apiBaseUrl: connection.apiBaseUrl,
      apiKey: connection.apiKey,
      apiSecret: connection.apiSecret,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      sourcingConfig: connection.sourcingConfig as any,
      checkoutConfig: connection.checkoutConfig as any,
    })

    const errors: string[] = []
    let created = 0
    let skipped = 0
    let failed = 0
    const productIds: number[] = []

    // 1. 상품 목록 조회 (또는 명시된 ID 만)
    let products: ExternalProduct[]
    try {
      if (params.productIds?.length) {
        products = await Promise.all(
          params.productIds.map((id) => connector.fetchProductDetail(id))
        )
      } else {
        const sourcingCfg = connection.sourcingConfig as any
        products = await connector.fetchProducts({
          limit: params.maxProducts || 50,
          minPrice: params.minPrice ?? sourcingCfg?.minPrice,
          maxPrice: params.maxPrice ?? sourcingCfg?.maxPrice,
        })
      }
    } catch (err: any) {
      throw new Error(`외부몰 상품 조회 실패: ${err.message}`)
    }

    // 2. 각 상품 → Product + ExternalSourcedProduct 생성
    for (const product of products) {
      try {
        // 중복 체크
        const existing = await prisma.externalSourcedProduct.findUnique({
          where: {
            connectionId_externalProductId: {
              connectionId: params.connectionId,
              externalProductId: product.externalId,
            },
          },
        })
        if (existing) {
          skipped++
          continue
        }

        // 상세 조회
        const detail = await connector.fetchProductDetail(product.externalId)

        // 마진 적용
        const margin = params.defaultMargin ?? 0
        const sellingPrice = margin > 0
          ? Math.round(detail.price * (1 + margin / 100))
          : detail.price

        // Product 생성 (CollectedProduct/Post 우회)
        const createdProduct = await prisma.product.create({
          data: {
            userId: params.userId,
            name: detail.name,
            description: detail.description,
            thumbnailUrl: detail.thumbnailUrl,
            price: sellingPrice,
            wholesalePrice: detail.price,
            currency: 'KRW',
            categoryId: detail.category || null,
            isActive: true,
            shippingFee: null,
            shippingInfo: detail.shippingInfo || null,
            // 이미지 별도 테이블에 저장
            images: detail.images.length
              ? {
                  create: detail.images.slice(0, 10).map((url, idx) => ({
                    url,
                    sortOrder: idx,
                  })),
                }
              : undefined,
          },
          select: { id: true },
        })

        // 매핑 테이블 생성
        await prisma.externalSourcedProduct.create({
          data: {
            userId: params.userId,
            connectionId: params.connectionId,
            externalProductId: detail.externalId,
            externalUrl: detail.productUrl,
            externalData: detail as any,
            productId: createdProduct.id,
            priceAtSource: detail.price,
            priceAtCheckout: sellingPrice,
            stockStatus: 'in_stock',
            lastSyncAt: new Date(),
          },
        })

        productIds.push(createdProduct.id)
        created++
      } catch (err: any) {
        failed++
        errors.push(`${product.externalId}: ${err.message}`)
      }
    }

    // 3. lastSyncAt 갱신
    await prisma.externalMallConnection.update({
      where: { id: params.connectionId },
      data: { lastSyncAt: new Date(), lastError: errors.length > 0 ? errors[0] : null },
    })

    return { total: products.length, created, skipped, failed, errors, productIds }
  }
}
