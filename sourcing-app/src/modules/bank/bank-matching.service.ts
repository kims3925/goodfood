/**
 * 입금 거래내역 ↔ PENDING 외부주문 자동 매칭 서비스 (BandAuto SaaS Phase 4)
 *
 * 매칭 규칙:
 *   1) BankTransaction.amount === GuestOrder.totalAmount  (정확 일치)
 *   2) GuestOrder.status === 'PENDING'
 *   3) GuestOrder.shopId 가 BankAccount.userId 가 보유한 쇼핑몰에 속함
 *   4) BankTransaction.senderName 이
 *      - GuestOrder.guestName 와 contains 매칭, 또는
 *      - GuestOrder.shippingAddress.recipientName 와 contains 매칭
 *   5) 후보가 1건이면 자동 매칭 → status=PAID, paidAt=now
 *      여러 건이면 가장 최근 PENDING 1건 선택 (수동 검토 권장)
 *
 * 사이드이펙트: 매칭 성공 시 inbox.message 가 연결돼 있으면 자동 응대 메시지
 *   "입금 확인되어 주문 #XORD-... 가 정상 처리됐습니다" 를 InboxMessage(OUTBOUND)
 *   로 저장 (실제 발송은 채널 어댑터 책임).
 */

import prisma from '@bandauto/db'

export interface MatchResult {
  transactionId: number
  matchedOrderId: number | null
  matchedOrderNumber: string | null
  reason: string
}

export interface RecordTransactionInput {
  bankAccountId: number
  transactionDate: Date
  amount: number
  senderName?: string | null
  description?: string | null
  raw?: any
}

/**
 * 거래내역 1건 등록 + 자동 매칭 시도.
 * 매뉴얼 입력 / API 응답 양쪽에서 호출.
 */
export async function recordTransactionAndMatch(
  userId: number,
  input: RecordTransactionInput
): Promise<MatchResult> {
  // 통장 소유권 확인
  const account = await (prisma as any).bankAccount.findFirst({
    where: { id: input.bankAccountId, userId, deletedAt: null },
    select: { id: true, userId: true },
  })
  if (!account) throw new Error('통장을 찾을 수 없습니다.')

  // 입금만 매칭 대상 (amount > 0)
  const isDeposit = Number(input.amount) > 0

  const transaction = await (prisma as any).bankTransaction.create({
    data: {
      bankAccountId: input.bankAccountId,
      transactionDate: input.transactionDate,
      amount: input.amount,
      senderName: input.senderName?.slice(0, 100) ?? null,
      description: input.description?.slice(0, 500) ?? null,
      raw: input.raw ?? null,
    },
  })

  if (!isDeposit) {
    return {
      transactionId: transaction.id,
      matchedOrderId: null,
      matchedOrderNumber: null,
      reason: '출금 거래 — 매칭 대상 아님',
    }
  }

  const matched = await tryMatchTransaction(userId, transaction.id)
  return matched
}

/**
 * 단일 거래내역에 대해 매칭 시도. 이미 matchedOrderId 가 있으면 skip.
 */
export async function tryMatchTransaction(
  userId: number,
  transactionId: number
): Promise<MatchResult> {
  const tx = await (prisma as any).bankTransaction.findFirst({
    where: {
      id: transactionId,
      bankAccount: { userId, deletedAt: null },
    },
    select: {
      id: true,
      amount: true,
      senderName: true,
      matchedOrderId: true,
      transactionDate: true,
    },
  })
  if (!tx) throw new Error('거래내역을 찾을 수 없습니다.')

  if (tx.matchedOrderId) {
    return {
      transactionId: tx.id,
      matchedOrderId: tx.matchedOrderId,
      matchedOrderNumber: null,
      reason: '이미 매칭됨',
    }
  }

  const amount = Number(tx.amount)
  const sender = (tx.senderName || '').trim()
  if (!sender) {
    return {
      transactionId: tx.id,
      matchedOrderId: null,
      matchedOrderNumber: null,
      reason: '발신자명 없음 — 자동 매칭 불가',
    }
  }

  // 셀러의 쇼핑몰들
  const shops = await prisma.shop.findMany({
    where: { userId, deletedAt: null },
    select: { id: true },
  })
  const shopIds = shops.map((s) => s.id)
  if (shopIds.length === 0) {
    return {
      transactionId: tx.id,
      matchedOrderId: null,
      matchedOrderNumber: null,
      reason: '쇼핑몰 없음',
    }
  }

  // 후보 주문 — 같은 금액 + PENDING + 발신자명 매칭
  const candidates = await prisma.guestOrder.findMany({
    where: {
      shopId: { in: shopIds },
      status: 'PENDING',
      totalAmount: amount,
      OR: [
        { guestName: { contains: sender } },
        { shippingAddress: { recipientName: { contains: sender } } },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      orderedAt: true,
      shippingAddress: { select: { recipientName: true } },
    },
    orderBy: { orderedAt: 'desc' },
  })

  if (candidates.length === 0) {
    return {
      transactionId: tx.id,
      matchedOrderId: null,
      matchedOrderNumber: null,
      reason: `매칭 후보 없음 (금액 ${amount.toLocaleString('ko-KR')}원, 발신자 "${sender}")`,
    }
  }

  // 다중 후보면 가장 최근 1건 선택
  const target = candidates[0]

  await prisma.$transaction(async (db) => {
    await db.guestOrder.update({
      where: { id: target.id },
      data: { status: 'PAID', paidAt: new Date() },
    })
    await (db as any).bankTransaction.update({
      where: { id: tx.id },
      data: { matchedOrderId: target.id, matchedAt: new Date() },
    })

    // 자동 응대 메시지 저장 (inbox 가 연결돼 있을 때)
    const order = await (db as any).guestOrder.findUnique({
      where: { id: target.id },
      select: { inboxMessageId: true, orderNumber: true },
    })
    if (order?.inboxMessageId) {
      const src = await db.inboxMessage.findUnique({
        where: { id: order.inboxMessageId },
        select: {
          id: true,
          userId: true,
          channel: true,
          threadId: true,
          senderId: true,
          senderName: true,
        },
      })
      if (src) {
        await db.inboxMessage.create({
          data: {
            userId: src.userId,
            channel: src.channel,
            direction: 'OUTBOUND',
            threadId: src.threadId,
            senderId: src.senderId,
            senderName: src.senderName,
            content: `입금 확인되어 주문 #${order.orderNumber} 가 정상 처리됐습니다. 빠르게 발송 준비하겠습니다.`,
            isAutoReplied: true,
            repliedAt: new Date(),
            orderId: target.id,
          },
        })
      }
    }
  })

  return {
    transactionId: tx.id,
    matchedOrderId: target.id,
    matchedOrderNumber: target.orderNumber,
    reason: `자동 매칭 완료 (후보 ${candidates.length}건 중 최신 1건)`,
  }
}

/**
 * 미매칭 거래내역 일괄 재시도.
 * UI 의 "매칭 재시도" 버튼에서 호출.
 */
export async function retryUnmatched(userId: number): Promise<MatchResult[]> {
  const unmatched = await (prisma as any).bankTransaction.findMany({
    where: {
      bankAccount: { userId, deletedAt: null },
      matchedOrderId: null,
      amount: { gt: 0 },
    },
    select: { id: true },
    orderBy: { transactionDate: 'desc' },
    take: 200,
  })

  const results: MatchResult[] = []
  for (const t of unmatched) {
    try {
      const r = await tryMatchTransaction(userId, t.id)
      results.push(r)
    } catch (err: any) {
      results.push({
        transactionId: t.id,
        matchedOrderId: null,
        matchedOrderNumber: null,
        reason: `오류: ${err?.message || 'unknown'}`,
      })
    }
  }
  return results
}
