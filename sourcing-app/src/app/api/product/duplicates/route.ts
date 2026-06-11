/**
 * 중복상품 후보 관리 API (B2B 공급몰 전환 STEP 2-3)
 *
 * GET   /api/product/duplicates?resolved=false — 내 중복 후보 목록 (상품 요약 포함)
 * PATCH /api/product/duplicates — { id, action: 'ignore' | 'deactivate' }
 *   - ignore: 후보 무시 (resolved=true)
 *   - deactivate: 신규 상품(productId) 비활성화 + resolved=true (가역 — isActive 만)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const productSummarySelect = {
  id: true,
  name: true,
  thumbnailUrl: true,
  isActive: true,
  createdAt: true,
  channel: { select: { id: true, name: true } },
} as const

export async function GET(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const resolvedParam = searchParams.get('resolved')
  const resolved = resolvedParam === 'true' ? true : resolvedParam === 'all' ? undefined : false

  try {
    const duplicates = await prisma.productDuplicate.findMany({
      where: {
        ...(resolved === undefined ? {} : { resolved }),
        // 테넌트 격리: 내 상품의 후보만
        product: { userId: me.userId },
      } as any,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // ProductDuplicate 에 relation 이 없으므로 상품 요약을 일괄 조회해 합성
    const ids = [...new Set(duplicates.flatMap((d) => [d.productId, d.dupProductId]))]
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, userId: me.userId },
      select: productSummarySelect,
    })
    const productById = new Map(products.map((p) => [p.id, p]))

    const data = duplicates
      // 두 상품 모두 내 소유인 후보만 노출 (격리 보강)
      .filter((d) => productById.has(d.productId) && productById.has(d.dupProductId))
      .map((d) => ({
        id: d.id,
        method: d.method,
        similarity: d.similarity,
        resolved: d.resolved,
        createdAt: d.createdAt,
        product: productById.get(d.productId)!,
        dupProduct: productById.get(d.dupProductId)!,
      }))

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[Product Duplicates GET]', error)
    return NextResponse.json({ success: false, error: '중복 후보 조회 실패' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const id = Number(body?.id)
  const action = body?.action
  if (!Number.isFinite(id) || !['ignore', 'deactivate'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'id 와 action(ignore|deactivate)이 필요합니다.' },
      { status: 400 }
    )
  }

  try {
    const dup = await prisma.productDuplicate.findUnique({ where: { id } })
    if (!dup) {
      return NextResponse.json({ success: false, error: '후보를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 테넌트 격리: 후보의 신규 상품이 내 소유인지 확인
    const owned = await prisma.product.findFirst({
      where: { id: dup.productId, userId: me.userId },
      select: { id: true },
    })
    if (!owned) {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
    }

    await prisma.$transaction(async (tx) => {
      if (action === 'deactivate') {
        // 가역적 비활성 — soft delete 아님, 복원 가능
        await tx.product.update({
          where: { id: dup.productId },
          data: { isActive: false },
        })
        // 발행물도 내림 (쇼핑몰 노출 차단)
        await tx.shopProduct.updateMany({
          where: { productId: dup.productId, deletedAt: null },
          data: { deletedAt: new Date() },
        })
      }
      await tx.productDuplicate.update({
        where: { id },
        data: { resolved: true },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Product Duplicates PATCH]', error)
    return NextResponse.json({ success: false, error: '처리 실패' }, { status: 500 })
  }
}
