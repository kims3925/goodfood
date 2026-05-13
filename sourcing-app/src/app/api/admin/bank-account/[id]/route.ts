/**
 * PATCH  /api/admin/bank-account/[id]  — 통장 수정
 * DELETE /api/admin/bank-account/[id]  — soft delete
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import {
  updateBankAccount,
  softDeleteBankAccount,
} from '@/modules/bank/bank-account.service'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
  }

  try {
    const updated = await updateBankAccount(user.userId, id, body)
    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('통장 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '통장 수정에 실패했습니다.' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  try {
    await softDeleteBankAccount(user.userId, id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('통장 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '통장 삭제에 실패했습니다.' },
      { status: 400 }
    )
  }
}
