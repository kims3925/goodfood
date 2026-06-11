/**
 * 가격 변동 처리 정책 (B2B 공급몰 전환 STEP 2-2)
 *
 * 도매가 변동 감지 시 테넌트(AutomationConfig.priceChangePolicy) 설정에 따라:
 * - NOTIFY_ONLY (기본): PriceHistory 기록 + 알림만. 판매가는 손대지 않는다.
 * - AUTO_MARGIN: 기존 마진율(판매가/도매가 비율)을 유지하며 판매가를 자동 갱신.
 *   Product.wholesalePrice/price 와 모든 variant 의 wholesalePrice/price 를
 *   같은 비율로 스케일한다 (트랜잭션). PriceHistory.applied=true.
 *
 * 판매가 반올림: 100원 단위 올림 (도매 B2B 관례 — 단수 가격 방지).
 */

import prisma from '@bandauto/db'

export type PriceChangePolicy = 'NOTIFY_ONLY' | 'AUTO_MARGIN'

export interface PriceChangeInput {
  productId: number
  userId: number
  /** 재크롤로 감지한 새 도매가 */
  newWholesalePrice: number
}

export interface PriceChangeResult {
  policy: PriceChangePolicy
  applied: boolean
  priceHistoryId: number
  oldWholesalePrice: number | null
  newWholesalePrice: number
  oldPrice: number | null
  newPrice: number | null
}

export async function getPriceChangePolicy(userId: number): Promise<PriceChangePolicy> {
  const config = await prisma.automationConfig.findUnique({
    where: { userId },
    select: { priceChangePolicy: true } as any,
  })
  const value = (config as any)?.priceChangePolicy
  return value === 'AUTO_MARGIN' ? 'AUTO_MARGIN' : 'NOTIFY_ONLY'
}

/** 100원 단위 올림 */
function roundPrice(value: number): number {
  return Math.ceil(value / 100) * 100
}

/**
 * 가격 변동 기록 + 정책 적용.
 * 호출 전에 변동 임계치(절대/비율) 판정은 호출자(소스 모니터)가 수행한다.
 */
export async function handlePriceChange(input: PriceChangeInput): Promise<PriceChangeResult> {
  const { productId, userId, newWholesalePrice } = input

  const product = await prisma.product.findFirst({
    where: { id: productId, userId, deletedAt: null },
    select: {
      id: true,
      wholesalePrice: true,
      price: true,
      variants: {
        where: { deletedAt: null },
        select: { id: true, wholesalePrice: true, price: true },
      },
    },
  })
  if (!product) {
    throw new Error(`Product not found: ${productId}`)
  }

  const oldWholesale = product.wholesalePrice != null ? Number(product.wholesalePrice) : null
  const oldPrice = product.price ?? null
  const policy = await getPriceChangePolicy(userId)

  // 마진율 유지 스케일 비율 (기존 도매가가 없으면 자동 반영 불가 → NOTIFY 로 강등)
  const ratio = oldWholesale && oldWholesale > 0 ? newWholesalePrice / oldWholesale : null
  const canApply = policy === 'AUTO_MARGIN' && ratio !== null

  let newPrice: number | null = null
  if (canApply && oldPrice != null) {
    newPrice = roundPrice(oldPrice * ratio!)
  }

  const result = await prisma.$transaction(async (tx) => {
    const history = await tx.priceHistory.create({
      data: {
        productId,
        oldWholesalePrice: oldWholesale,
        newWholesalePrice,
        oldPrice,
        newPrice,
        applied: !!canApply,
      },
    })

    if (canApply) {
      // 상품 본체 갱신
      await tx.product.update({
        where: { id: productId },
        data: {
          wholesalePrice: newWholesalePrice,
          ...(newPrice != null ? { price: newPrice } : {}),
          sourceStatus: 'PRICE_CHANGED',
        },
      })
      // variant 별 동일 비율 스케일 (variant 도매가는 개별 값 유지하며 스케일)
      for (const v of product.variants) {
        const vOldW = v.wholesalePrice != null ? Number(v.wholesalePrice) : null
        await tx.productVariant.update({
          where: { id: v.id },
          data: {
            ...(vOldW != null ? { wholesalePrice: vOldW * ratio! } : {}),
            price: roundPrice(v.price * ratio!),
          },
        })
      }
    } else {
      // 알림만 — 상태 사유만 보존
      await tx.product.update({
        where: { id: productId },
        data: { sourceStatus: 'PRICE_CHANGED' },
      })
    }

    return history
  })

  return {
    policy,
    applied: !!canApply,
    priceHistoryId: result.id,
    oldWholesalePrice: oldWholesale,
    newWholesalePrice,
    oldPrice,
    newPrice,
  }
}
