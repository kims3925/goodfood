/**
 * B2B 회원 헬퍼 (B2B 공급몰 전환 Phase 3)
 *
 * 공급가(wholesalePrice) 노출/주문은 b2bStatus=APPROVED 세션에만 허용한다.
 * ⚠️ 비로그인/미승인 응답에는 wholesalePrice 필드 자체가 없어야 한다 (지침서 리스크 1).
 */

import prisma from '@bandauto/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'

/** 현재 세션 사용자의 B2B 승인 여부 (비로그인 false) */
export async function isB2bApprovedSession(): Promise<{ userId: number | null; approved: boolean }> {
  const session = await getServerSession(authOptions)
  const rawId = (session?.user as any)?.id
  const userId = rawId == null ? null : typeof rawId === 'string' ? parseInt(rawId) : rawId
  if (!userId || Number.isNaN(userId)) return { userId: null, approved: false }
  return { userId, approved: await isB2bApprovedUser(userId) }
}

/** userId 의 B2B 승인 여부 */
export async function isB2bApprovedUser(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { b2bStatus: true, deletedAt: true } as any,
  })
  return !!user && !(user as any).deletedAt && (user as any).b2bStatus === 'APPROVED'
}

/**
 * B2B 단가 결정: 승인 회원이면 variant 공급가(>0) 우선, 아니면 소매가.
 * 공급가가 없는 상품은 B2B 회원도 소매가 적용 (폴백).
 */
export function resolveB2bBasePrice(
  isB2b: boolean,
  variant: { price: number; wholesalePrice: unknown } | null | undefined,
  mainVariant: { price: number; wholesalePrice: unknown } | null | undefined
): number {
  const v = variant ?? mainVariant
  if (!v) return 0
  if (isB2b) {
    const w = v.wholesalePrice == null ? 0 : Number(v.wholesalePrice)
    if (w > 0) return Math.round(w)
  }
  return v.price ?? 0
}
