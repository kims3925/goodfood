/**
 * GET /api/admin/lite/orders — 라이트 셀러 쇼핑몰의 모든 주문 (회원 + 비회원 통합)
 *
 * Query:
 * - shopId (옵션): 특정 라이트 쇼핑몰만
 * - status (옵션): PAID|PREPARING|SHIPPED|DELIVERED|CANCELLED
 * - days  (옵션, 기본 30): 최근 N일
 *
 * 반환:
 * - shops: [{id, name, subdomain, sellerEmail, orderCount, totalRevenue}]
 * - orders: [{id, shopId, shopName, source: 'MEMBER'|'GUEST', orderNumber, ...}]
 *
 * 수령인 정보는 Order.shippingAddress / GuestOrder.shippingAddress 관계에서 조회.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function GET(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })
  if (me.role !== 'ADMIN' && me.role !== 'MANAGER')
    return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const shopIdParam = searchParams.get('shopId')
  const statusParam = searchParams.get('status')
  const daysParam = Number(searchParams.get('days') || 30)
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // 라이트 셀러의 모든 활성 쇼핑몰
  const liteShops = await prisma.shop.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      user: { mode: 'lite', deletedAt: null },
      ...(shopIdParam ? { id: Number(shopIdParam) } : {}),
    },
    select: {
      id: true,
      name: true,
      subdomain: true,
      user: { select: { id: true, email: true, name: true } },
    },
  })
  const shopIds = liteShops.map((s) => s.id)
  if (shopIds.length === 0) {
    return NextResponse.json({ success: true, data: { shops: [], orders: [] } })
  }

  const shopMap = new Map(liteShops.map((s) => [s.id, s]))

  const statusFilter = statusParam ? { status: statusParam as any } : {}

  // 회원 주문
  const memberOrders = await prisma.order.findMany({
    where: {
      shopId: { in: shopIds },
      orderedAt: { gte: since },
      ...statusFilter,
    },
    select: {
      id: true,
      shopId: true,
      orderNumber: true,
      totalAmount: true,
      status: true,
      orderedAt: true,
      shippingAddress: {
        select: { recipientName: true, recipientPhone: true },
      },
      items: {
        select: {
          quantity: true,
          productName: true,
        },
      },
    },
    orderBy: { orderedAt: 'desc' },
    take: 500,
  })

  // 비회원 주문
  const guestOrders = await prisma.guestOrder.findMany({
    where: {
      shopId: { in: shopIds },
      orderedAt: { gte: since },
      ...statusFilter,
    },
    select: {
      id: true,
      shopId: true,
      orderNumber: true,
      totalAmount: true,
      status: true,
      orderedAt: true,
      shippingAddress: {
        select: { recipientName: true, recipientPhone: true },
      },
      items: {
        select: {
          quantity: true,
          productName: true,
        },
      },
    },
    orderBy: { orderedAt: 'desc' },
    take: 500,
  })

  type RowItem = {
    id: number
    source: 'MEMBER' | 'GUEST'
    shopId: number
    shopName: string
    shopSubdomain: string
    sellerEmail: string
    orderNumber: string
    productSummary: string
    itemCount: number
    totalAmount: number
    status: string
    recipientName: string | null
    recipientPhone: string | null
    orderedAt: string
  }

  const summary = (items: { quantity: number; productName: string }[]) => {
    if (!items.length) return ''
    const first = items[0]?.productName || '상품'
    const more = items.length > 1 ? ` 외 ${items.length - 1}건` : ''
    return first + more
  }

  const rows: RowItem[] = []
  for (const o of memberOrders) {
    if (o.shopId == null) continue
    const sh = shopMap.get(o.shopId)
    if (!sh) continue
    rows.push({
      id: o.id,
      source: 'MEMBER',
      shopId: o.shopId,
      shopName: sh.name,
      shopSubdomain: sh.subdomain,
      sellerEmail: sh.user.email,
      orderNumber: o.orderNumber,
      productSummary: summary(o.items),
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      totalAmount: Number(o.totalAmount),
      status: o.status,
      recipientName: o.shippingAddress?.recipientName ?? null,
      recipientPhone: o.shippingAddress?.recipientPhone ?? null,
      orderedAt: o.orderedAt.toISOString(),
    })
  }
  for (const o of guestOrders) {
    if (o.shopId == null) continue
    const sh = shopMap.get(o.shopId)
    if (!sh) continue
    rows.push({
      id: o.id,
      source: 'GUEST',
      shopId: o.shopId,
      shopName: sh.name,
      shopSubdomain: sh.subdomain,
      sellerEmail: sh.user.email,
      orderNumber: o.orderNumber,
      productSummary: summary(o.items),
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      totalAmount: Number(o.totalAmount),
      status: o.status,
      recipientName: o.shippingAddress?.recipientName ?? null,
      recipientPhone: o.shippingAddress?.recipientPhone ?? null,
      orderedAt: o.orderedAt.toISOString(),
    })
  }
  rows.sort((a, b) => b.orderedAt.localeCompare(a.orderedAt))

  // 쇼핑몰별 집계
  const shopAgg = new Map<number, { orderCount: number; totalRevenue: number }>()
  for (const r of rows) {
    const slot = shopAgg.get(r.shopId) || { orderCount: 0, totalRevenue: 0 }
    slot.orderCount += 1
    slot.totalRevenue += r.totalAmount
    shopAgg.set(r.shopId, slot)
  }

  const shops = liteShops.map((s) => ({
    id: s.id,
    name: s.name,
    subdomain: s.subdomain,
    sellerEmail: s.user.email,
    sellerName: s.user.name,
    orderCount: shopAgg.get(s.id)?.orderCount || 0,
    totalRevenue: shopAgg.get(s.id)?.totalRevenue || 0,
  }))

  return NextResponse.json({ success: true, data: { shops, orders: rows } })
}
