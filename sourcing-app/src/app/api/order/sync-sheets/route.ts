export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { googleSheetsService, type SheetRowData } from '@/services/google-sheets.service'

/**
 * POST /api/order/sync-sheets
 * 주문 상세에서 "구글시트로 전송" 버튼 → 해당 주문의 품목들을 사용자 구글 시트('쇼핑몰주문' 탭)에
 * append(누적)한다. 전체 덮어쓰기(syncOrdersToSheet)와 달리 기존 행을 보존한다.
 *
 * body: { order: UnifiedOrderDetail (클라이언트 보유 객체) }
 * - 인증 사용자 본인의 시트에만 기록되므로 별도 소유권 재검증 없이 안전.
 */

const pad = (n: number) => String(n).padStart(2, '0')

// ISO/Date 문자열 → KST 'YYYY-MM-DD HH:mm' / 'YYYY-MM-DD'
function toKst(dateStr: string | null | undefined): { timestamp: string; dateKey: string } {
  if (!dateStr) return { timestamp: '', dateKey: '' }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return { timestamp: '', dateKey: '' }
  const k = new Date(d.getTime() + 9 * 3600 * 1000) // KST 보정
  const dateKey = `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`
  const timestamp = `${dateKey} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`
  return { timestamp, dateKey }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const order = body?.order
    if (!order || !order.orderNumber || !Array.isArray(order.items) || order.items.length === 0) {
      return NextResponse.json({ success: false, error: '주문 정보가 올바르지 않습니다.' }, { status: 400 })
    }

    const addr = order.shippingAddress || null
    const fullAddress = addr
      ? [
          addr.postalCode ? `(${addr.postalCode})` : '',
          addr.address || '',
          addr.addressDetail || '',
        ].filter(Boolean).join(' ').trim()
      : ''
    const recipientName = addr?.recipientName || order.customerName || ''
    const recipientPhone = addr?.recipientPhone || order.customerPhone || ''
    // 보내는분: 주문자와 받는분이 다를 때만 표기
    const senderName =
      order.customerName && order.customerName !== recipientName ? order.customerName : ''
    const email = order?.user?.email || ''
    const shopName = order.shopName || '쇼핑몰주문'
    const isShipped = ['SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status)
    const { timestamp, dateKey } = toKst(order.createdAt)

    const rows: SheetRowData[] = order.items.map((item: any) => {
      const name = item.sourceProductName || item.productName || ''
      const productName = item.optionSummary ? `${name} (${item.optionSummary})` : name
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unitPrice) || 0
      return {
        orderNumber: String(order.orderNumber),
        shopName,
        timestamp,
        productName,
        quantity,
        productAmount: unitPrice * quantity,
        shippingFee: Number(item.shippingFee) || 0,
        totalAmount: Number(item.totalPrice) || unitPrice * quantity,
        recipientName,
        recipientPhone,
        fullAddress,
        senderName,
        cashReceipt: '',
        email,
        dateKey,
        isShipped,
      }
    })

    const result = await googleSheetsService.appendOrderRows(currentUser.userId, rows)
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    const msg = error?.message || '구글 시트 전송에 실패했습니다.'
    // 권한/설정 관련 에러는 사용자에게 그대로 노출 (안내성)
    const status = /설정이 없습니다|권한|403/.test(msg) ? 400 : 500
    console.error('[order/sync-sheets] 실패:', msg)
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
