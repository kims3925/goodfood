/**
 * GET /api/lite/report/card.svg?period=today|week|month
 * Lite Manager — 수익 리포트 카드 SVG (F3)
 *
 * 720×720 정사각 카드. 외부 폰트 의존 없이 system font 사용.
 * 클라이언트가 <img src=...> 또는 download 로 사용.
 *
 * 응답: image/svg+xml
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const REVENUE_STATUSES = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const

function startOfTodayKST(): Date {
  const now = new Date()
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffsetMs)
  kstNow.setUTCHours(0, 0, 0, 0)
  return new Date(kstNow.getTime() - kstOffsetMs)
}
function startOfMondayKST(): Date {
  const today = startOfTodayKST()
  const day = (today.getUTCDay() + 9) % 7
  const monday = new Date(today)
  monday.setUTCDate(monday.getUTCDate() - ((day + 6) % 7))
  return monday
}
function startOfMonthKST(): Date {
  const today = startOfTodayKST()
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstToday = new Date(today.getTime() + kstOffsetMs)
  kstToday.setUTCDate(1)
  return new Date(kstToday.getTime() - kstOffsetMs)
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;'
  )
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'today') as 'today' | 'week' | 'month'

    const shops = await prisma.shop.findMany({
      where: { userId: user.userId, isActive: true },
      select: { id: true, name: true },
    })
    const shopIds = shops.map((s) => s.id)
    const shopName = shops[0]?.name || '내 마이샵'

    let since: Date
    let label: string
    if (period === 'week') {
      since = startOfMondayKST()
      label = '이번 주'
    } else if (period === 'month') {
      since = startOfMonthKST()
      label = '이번 달'
    } else {
      since = startOfTodayKST()
      label = '오늘'
    }

    let totalAmount = 0
    let orderCount = 0
    let topProductName = ''

    if (shopIds.length > 0) {
      const orders = await prisma.order.findMany({
        where: {
          shopId: { in: shopIds },
          status: { in: REVENUE_STATUSES as any },
          orderedAt: { gte: since },
        },
        select: {
          totalAmount: true,
          items: {
            select: { productName: true, unitPrice: true, quantity: true },
            take: 1,
          },
        },
      })
      const productAgg = new Map<string, number>()
      for (const o of orders) {
        totalAmount += Number(o.totalAmount)
        orderCount++
        for (const it of o.items) {
          const rev = Number(it.unitPrice) * it.quantity
          productAgg.set(it.productName, (productAgg.get(it.productName) || 0) + rev)
        }
      }
      let bestRev = 0
      productAgg.forEach((rev, name) => {
        if (rev > bestRev) {
          bestRev = rev
          topProductName = name
        }
      })
    }

    const dateStr = new Date()
      .toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      })
      .replace(/\.\s/g, '. ')

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="720" height="720" fill="url(#bg)"/>
  <rect x="40" y="40" width="640" height="640" rx="32" fill="white" opacity="0.06"/>

  <text x="60" y="100" fill="white" font-family="Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif" font-size="22" font-weight="500" opacity="0.9">${escapeXml(shopName)}</text>
  <text x="60" y="135" fill="white" font-family="Pretendard, -apple-system, sans-serif" font-size="16" opacity="0.7">${escapeXml(dateStr)}</text>

  <text x="60" y="240" fill="white" font-family="Pretendard, -apple-system, sans-serif" font-size="28" font-weight="600" opacity="0.95">${escapeXml(label)} 매출</text>
  <text x="60" y="340" fill="white" font-family="Pretendard, -apple-system, sans-serif" font-size="76" font-weight="800">₩${totalAmount.toLocaleString('ko-KR')}</text>
  <text x="60" y="395" fill="white" font-family="Pretendard, -apple-system, sans-serif" font-size="22" opacity="0.85">주문 ${orderCount}건${orderCount > 0 ? ` · 평균 ₩${Math.round(totalAmount / orderCount).toLocaleString('ko-KR')}` : ''}</text>

  ${topProductName
    ? `<rect x="60" y="450" width="600" height="130" rx="20" fill="white" opacity="0.18"/>
       <text x="80" y="490" fill="white" font-family="Pretendard, sans-serif" font-size="18" font-weight="500" opacity="0.85">🏆 베스트셀러</text>
       <text x="80" y="540" fill="white" font-family="Pretendard, sans-serif" font-size="26" font-weight="700">${escapeXml(topProductName.length > 28 ? topProductName.slice(0, 27) + '…' : topProductName)}</text>`
    : `<rect x="60" y="450" width="600" height="130" rx="20" fill="white" opacity="0.18"/>
       <text x="80" y="525" fill="white" font-family="Pretendard, sans-serif" font-size="22" opacity="0.85">첫 판매를 기다리는 중...</text>`
  }

  <text x="60" y="640" fill="white" font-family="Pretendard, sans-serif" font-size="16" opacity="0.7">📦 SNSAUTO Lite</text>
  <text x="60" y="665" fill="white" font-family="Pretendard, sans-serif" font-size="12" opacity="0.5">snsauto.abcpharm.net</text>
</svg>`

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error: any) {
    console.error('[Lite Report SVG]', error)
    return new NextResponse(`<svg/>`, { status: 500 })
  }
}
