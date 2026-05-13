/**
 * GET  /api/admin/bank-transactions  — 거래내역 목록 (페이지네이션)
 * POST /api/admin/bank-transactions  — 수동 거래내역 등록 + 자동 매칭 시도
 *
 * Body (POST):
 * {
 *   "bankAccountId": 1,
 *   "transactionDate": "2026-05-13T10:00:00.000Z",
 *   "amount": 35000,
 *   "senderName": "김영자",
 *   "description": "포항물회"
 * }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import {
  recordTransactionAndMatch,
  retryUnmatched,
} from '@/modules/bank/bank-matching.service'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const accountIdParam = searchParams.get('accountId')
  const onlyUnmatched = searchParams.get('unmatched') === '1'

  const where: any = {
    bankAccount: { userId: user.userId, deletedAt: null },
  }
  if (accountIdParam) {
    const aid = Number(accountIdParam)
    if (Number.isFinite(aid)) where.bankAccountId = aid
  }
  if (onlyUnmatched) where.matchedOrderId = null

  const [total, rows] = await Promise.all([
    (prisma as any).bankTransaction.count({ where }),
    (prisma as any).bankTransaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        bankAccount: { select: { bankName: true, accountNumber: true, accountHolder: true } },
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: { rows, page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
  }

  // 매칭 재시도 일괄
  if (body?.action === 'retryUnmatched') {
    const results = await retryUnmatched(user.userId)
    return NextResponse.json({ success: true, data: { results } })
  }

  const bankAccountId = Number(body?.bankAccountId)
  const amount = Number(body?.amount)
  if (!Number.isFinite(bankAccountId) || bankAccountId <= 0) {
    return NextResponse.json({ success: false, error: 'bankAccountId가 필요합니다.' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ success: false, error: '거래 금액이 유효하지 않습니다.' }, { status: 400 })
  }

  let transactionDate: Date
  try {
    transactionDate = body?.transactionDate ? new Date(body.transactionDate) : new Date()
    if (Number.isNaN(transactionDate.getTime())) throw new Error('invalid date')
  } catch {
    return NextResponse.json({ success: false, error: '거래일이 유효하지 않습니다.' }, { status: 400 })
  }

  try {
    const result = await recordTransactionAndMatch(user.userId, {
      bankAccountId,
      transactionDate,
      amount,
      senderName: body?.senderName ?? null,
      description: body?.description ?? null,
      raw: body?.raw ?? null,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('거래내역 등록 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '거래내역 등록에 실패했습니다.' },
      { status: 400 }
    )
  }
}
