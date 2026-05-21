export const dynamic = 'force-dynamic'

/**
 * 고객명 검색 — /shop/order/external/new "외부주문추가" 페이지의 자동완성용.
 *
 * GET /api/order/customer-search?q=홍길동&limit=10
 *
 * 검색 범위:
 *  - GuestOrder (비회원): guestName LIKE %q%
 *  - Order (회원): user.name LIKE %q% OR shippingAddress.recipientName LIKE %q%
 *
 * 응답: 최근 주문 기준 N개의 고객+배송 묶음. 동일 (이름+전화) 조합은 dedupe.
 *   결과로 페이지가 폼 필드를 자동 채우는 데 사용:
 *   guestName, guestPhone, guestEmail, recipientName, recipientPhone,
 *   postalCode, address, addressDetail
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export interface CustomerSearchResult {
  source: 'GUEST' | 'MEMBER'
  // 고객 정보
  guestName: string
  guestPhone: string
  guestEmail: string | null
  // 배송 정보 (가장 최근 주문 기준)
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail: string | null
  // 메타
  lastOrderAt: string  // ISO
  lastOrderNumber: string
  orderCount: number   // 같은 사람의 옛 주문 수
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }
    const userId = currentUser.userId

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '8', 10)))

    if (q.length < 2) {
      return NextResponse.json({ success: true, data: [], message: '검색어는 2자 이상' })
    }

    // 멀티테넌트 격리 — 본인 user 의 shop 에 들어온 주문만 (Shop.userId 매칭)
    // shop_id 기준이라 본인 shop 들의 id 먼저 조회
    const myShops = await prisma.shop.findMany({
      where: { userId },
      select: { id: true },
    })
    const myShopIds = myShops.map((s) => s.id)
    if (myShopIds.length === 0) {
      return NextResponse.json({ success: true, data: [], message: '등록된 쇼핑몰 없음' })
    }

    // ── 1) 비회원 주문 (GuestOrder) — include 사용 (select nested 타입 추론 회피) ──
    const guestOrders = await prisma.guestOrder.findMany({
      where: {
        shopId: { in: myShopIds },
        OR: [
          { guestName: { contains: q } },
          { shippingAddress: { is: { recipientName: { contains: q } } } },
        ],
      },
      include: {
        shippingAddress: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    })

    // ── 2) 회원 주문 (Order) — include 사용 ──
    const memberOrders = await prisma.order.findMany({
      where: {
        shopId: { in: myShopIds },
        OR: [
          { user: { is: { name: { contains: q } } } },
          { shippingAddress: { is: { recipientName: { contains: q } } } },
        ],
      },
      include: {
        shippingAddress: true,
        user: { select: { name: true, phone: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    })

    // ── 3) 통합 + dedupe (이름+전화 기준, 최근 주문 우선) ──
    type Candidate = CustomerSearchResult & { _dedupKey: string }
    const candidates: Candidate[] = []

    // Prisma include 의 type 추론이 일부 환경에서 stale — 사용처에서 any cast 로 안전 처리.
    // 런타임은 include 로 nested 데이터가 실제 채워져 들어옴.
    for (const g of guestOrders as any[]) {
      if (!g.shippingAddress) continue
      const candidate: Candidate = {
        source: 'GUEST',
        guestName: g.guestName,
        guestPhone: g.guestPhone,
        guestEmail: g.guestEmail,
        recipientName: g.shippingAddress.recipientName,
        recipientPhone: g.shippingAddress.recipientPhone,
        postalCode: g.shippingAddress.postalCode,
        address: g.shippingAddress.address,
        addressDetail: g.shippingAddress.addressDetail,
        lastOrderAt: (g.orderedAt ?? g.createdAt).toISOString(),
        lastOrderNumber: g.orderNumber,
        orderCount: 1,
        _dedupKey: `${g.guestName}|${g.guestPhone}|${g.shippingAddress.address}`,
      }
      candidates.push(candidate)
    }

    for (const o of memberOrders as any[]) {
      if (!o.shippingAddress) continue
      const memberName = o.user?.name || o.shippingAddress.recipientName
      const memberPhone = o.user?.phone || o.shippingAddress.recipientPhone
      const candidate: Candidate = {
        source: 'MEMBER',
        guestName: memberName,
        guestPhone: memberPhone,
        guestEmail: o.user?.email || null,
        recipientName: o.shippingAddress.recipientName,
        recipientPhone: o.shippingAddress.recipientPhone,
        postalCode: o.shippingAddress.postalCode,
        address: o.shippingAddress.address,
        addressDetail: o.shippingAddress.addressDetail,
        lastOrderAt: (o.orderedAt ?? o.createdAt).toISOString(),
        lastOrderNumber: o.orderNumber,
        orderCount: 1,
        _dedupKey: `${memberName}|${memberPhone}|${o.shippingAddress.address}`,
      }
      candidates.push(candidate)
    }

    // 최근 순 정렬 후 dedup
    candidates.sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt))
    const seen = new Map<string, Candidate>()
    for (const c of candidates) {
      const existing = seen.get(c._dedupKey)
      if (existing) {
        existing.orderCount += 1
      } else {
        seen.set(c._dedupKey, c)
      }
    }

    const results: CustomerSearchResult[] = Array.from(seen.values())
      .slice(0, limit)
      .map(({ _dedupKey: _ignore, ...rest }) => rest)

    return NextResponse.json({ success: true, data: results })
  } catch (error: any) {
    console.error('[customer-search] 실패', error)
    return NextResponse.json(
      { success: false, error: error?.message || '검색 실패' },
      { status: 500 },
    )
  }
}
