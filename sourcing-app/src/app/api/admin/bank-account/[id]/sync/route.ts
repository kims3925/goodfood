/**
 * POST /api/admin/bank-account/[id]/sync
 * 통장 거래내역 수동 동기화 트리거 (현재는 lastSyncedAt 갱신 + 안내 메시지).
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { syncBankTransactions } from '@/modules/bank/bank-account.service'

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  try {
    const result = await syncBankTransactions(user.userId, id)
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('통장 동기화 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '동기화에 실패했습니다.' },
      { status: 400 }
    )
  }
}
