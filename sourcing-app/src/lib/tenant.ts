/**
 * 멀티테넌트 헬퍼 (BandAuto SaaS 종합계획서 Phase 0)
 *
 * 현재 BandAuto 는 거의 모든 모델에 `userId` FK 가 있어 application-level 멀티테넌시
 * 패턴을 사용. 모든 쿼리 where 절에 `{ userId: currentUser.userId }` 가 포함돼야
 * 안전. 깜빡 누락하면 다른 사용자의 데이터에 접근할 수 있는 취약점.
 *
 * 이 모듈은:
 *  1) Prisma 쿼리에 자동 userId 필터 주입하는 helper (assertOwnedByUser)
 *  2) currentUser 가 특정 리소스(channel/product/shop) 소유자인지 검증
 *  3) Prisma extension 으로 자동 적용하는 미래 옵션
 *
 * 미구현 (Phase 0 후속):
 *  - Prisma Client extension 으로 모든 findMany/findFirst 에 자동 주입
 *    (현재는 호출측이 수동으로 userId 포함)
 *  - shopId 기반 격리 (User 가 여러 Shop 소유 시)
 */

import prisma from '@bandauto/db'

/**
 * 리소스가 사용자 소유인지 검증. 아니면 throw.
 * Prisma where 에 userId 누락된 경우 마지막 안전망.
 */
export async function assertProductOwnedByUser(productId: number, userId: number): Promise<void> {
  const exists = await prisma.product.findFirst({
    where: { id: productId, userId },
    select: { id: true },
  })
  if (!exists) {
    throw new TenantViolationError('PRODUCT', productId, userId)
  }
}

export async function assertChannelOwnedByUser(channelId: number, userId: number): Promise<void> {
  const exists = await prisma.channel.findFirst({
    where: { id: channelId, userId },
    select: { id: true },
  })
  if (!exists) {
    throw new TenantViolationError('CHANNEL', channelId, userId)
  }
}

export async function assertShopOwnedByUser(shopId: number, userId: number): Promise<void> {
  const exists = await prisma.shop.findFirst({
    where: { id: shopId, userId },
    select: { id: true },
  })
  if (!exists) {
    throw new TenantViolationError('SHOP', shopId, userId)
  }
}

/**
 * 다중 리소스 일괄 검증 (예: 일괄 삭제 전 모든 productId 가 사용자 소유인지)
 */
export async function assertAllProductsOwnedByUser(
  productIds: number[],
  userId: number
): Promise<void> {
  if (productIds.length === 0) return
  const count = await prisma.product.count({
    where: { id: { in: productIds }, userId },
  })
  if (count !== productIds.length) {
    throw new TenantViolationError('PRODUCT_BATCH', `${productIds.length}건 중 ${count}건만 소유`, userId)
  }
}

export class TenantViolationError extends Error {
  constructor(public resource: string, public id: number | string, public userId: number) {
    super(`[Tenant] user=${userId} 가 ${resource}=${id} 에 접근 권한 없음`)
    this.name = 'TenantViolationError'
  }
}

/**
 * Prisma where 절에 userId 자동 병합. 이미 다른 userId 가 명시되면 throw (덮어쓰기 방지).
 */
export function withUserScope<T extends object>(where: T, userId: number): T & { userId: number } {
  if ('userId' in where && (where as any).userId !== userId) {
    throw new Error(
      `[Tenant] withUserScope: where.userId=${(where as any).userId} 와 currentUser.userId=${userId} 가 다름. ` +
        `덮어쓰기 시도 — 호출 코드 점검 필요.`
    )
  }
  return { ...where, userId }
}
