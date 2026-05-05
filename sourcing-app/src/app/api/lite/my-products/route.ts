/**
 * GET  /api/lite/my-products — 라이트 셀러 본인의 ShopProduct 목록 (자동 등록된 상품)
 * PATCH /api/lite/my-products — 상품 활성/비활성 토글 (body: { shopProductId, active })
 *
 * 자동 발행 cron이 등록한 ShopProduct를 셀러가 관리한다.
 * - active=false → ShopProduct.deletedAt 설정 (소프트 삭제)
 * - active=true  → deletedAt=null 복원
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function GET(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const showInactive = searchParams.get('showInactive') === '1'
  const categoryFilter = searchParams.get('categoryId')

  const shop = await prisma.shop.findFirst({
    where: { userId: me.userId, isActive: true, deletedAt: null },
    select: { id: true, name: true, subdomain: true },
  })
  if (!shop) {
    return NextResponse.json({ success: true, data: { shop: null, items: [], stats: zeroStats() } })
  }

  const items = await prisma.shopProduct.findMany({
    where: {
      shopId: shop.id,
      userId: me.userId,
      ...(showInactive ? {} : { deletedAt: null }),
      ...(categoryFilter
        ? {
            product: { categoryId: categoryFilter },
          }
        : {}),
    },
    select: {
      id: true,
      productId: true,
      publishedAt: true,
      deletedAt: true,
      createdAt: true,
      product: {
        select: {
          name: true,
          description: true,
          categoryId: true,
          thumbnailUrl: true,
          price: true,
          shippingFee: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // 마지막 자동 발행 로그
  const lastLog = await prisma.liteAutoPublishLog.findFirst({
    where: { userId: me.userId },
    orderBy: { publishedAt: 'desc' },
    select: { publishedAt: true, count: true, status: true },
  })

  // 다음 발행 시각
  const config = await prisma.liteAutoPublishConfig.findUnique({
    where: { userId: me.userId },
    select: { publishHour: true, publishMinute: true, dailyCount: true, isActive: true },
  })

  const stats = {
    total: items.length,
    active: items.filter((i) => i.deletedAt == null).length,
    inactive: items.filter((i) => i.deletedAt != null).length,
  }

  return NextResponse.json({
    success: true,
    data: {
      shop,
      items: items.map((i) => ({
        id: i.id,
        productId: i.productId,
        publishedAt: i.publishedAt,
        active: i.deletedAt == null,
        product: i.product,
      })),
      stats,
      lastAutoPublish: lastLog,
      config,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }
  const shopProductId = Number(body?.shopProductId)
  const active = Boolean(body?.active)
  if (!Number.isFinite(shopProductId)) {
    return NextResponse.json({ success: false, error: 'shopProductId 누락' }, { status: 400 })
  }

  // 본인 소유 확인
  const sp = await prisma.shopProduct.findFirst({
    where: { id: shopProductId, userId: me.userId },
    select: { id: true },
  })
  if (!sp) return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 })

  await prisma.shopProduct.update({
    where: { id: shopProductId },
    data: { deletedAt: active ? null : new Date() },
  })

  return NextResponse.json({ success: true })
}

function zeroStats() {
  return { total: 0, active: 0, inactive: 0 }
}
