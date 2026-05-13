/**
 * GET  /api/admin/bank-account   — 셀러 본인의 통장 목록
 * POST /api/admin/bank-account   — 통장 등록
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import {
  listBankAccounts,
  createBankAccount,
} from '@/modules/bank/bank-account.service'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }
  try {
    const data = await listBankAccounts(user.userId)
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('통장 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '통장 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
  }

  try {
    const created = await createBankAccount({
      userId: user.userId,
      bankName: String(body?.bankName || ''),
      accountNumber: String(body?.accountNumber || ''),
      accountHolder: String(body?.accountHolder || ''),
      apiProvider: body?.apiProvider,
      apiCredentials: body?.apiCredentials,
      isActive: body?.isActive,
    })
    return NextResponse.json({ success: true, data: created })
  } catch (error: any) {
    console.error('통장 등록 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '통장 등록에 실패했습니다.' },
      { status: 400 }
    )
  }
}
