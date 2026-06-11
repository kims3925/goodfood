/**
 * B2B 회원(사업자) 가입 신청 API (B2B 공급몰 전환 STEP 3-1)
 *
 * GET  /api/b2b/apply — 내 B2B 상태 조회
 * POST /api/b2b/apply — 사업자 인증 신청 { businessNumber, companyName }
 *   - NONE/REJECTED 상태에서만 신청 가능 → PENDING (관리자 승인 대기)
 *   - 국세청 진위확인 API 연동은 2차 (현재는 형식 검증만)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'

const BUSINESS_NO_RE = /^\d{3}-?\d{2}-?\d{5}$/

async function getSessionUserId(): Promise<number | null> {
  const session = await getServerSession(authOptions)
  const rawId = (session?.user as any)?.id
  const userId = rawId == null ? null : typeof rawId === 'string' ? parseInt(rawId) : rawId
  return userId && !Number.isNaN(userId) ? userId : null
}

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      b2bStatus: true,
      b2bAppliedAt: true,
      b2bApprovedAt: true,
      b2bRejectReason: true,
      businessNumber: true,
      companyName: true,
    } as any,
  })
  if (!user) {
    return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: user })
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const businessNumber = String(body?.businessNumber || '').trim()
  const companyName = String(body?.companyName || '').trim()

  if (!BUSINESS_NO_RE.test(businessNumber)) {
    return NextResponse.json(
      { success: false, error: '사업자등록번호 형식이 올바르지 않습니다 (예: 123-45-67890)' },
      { status: 400 }
    )
  }
  if (!companyName) {
    return NextResponse.json({ success: false, error: '상호명을 입력해주세요' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, b2bStatus: true } as any,
  })
  if (!user) {
    return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다' }, { status: 404 })
  }

  const status = (user as any).b2bStatus
  if (status === 'PENDING') {
    return NextResponse.json({ success: false, error: '이미 승인 대기 중입니다' }, { status: 409 })
  }
  if (status === 'APPROVED') {
    return NextResponse.json({ success: false, error: '이미 승인된 사업자 회원입니다' }, { status: 409 })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      businessNumber: businessNumber.replace(/-/g, ''),
      companyName,
      b2bStatus: 'PENDING',
      b2bAppliedAt: new Date(),
      b2bRejectReason: null,
    } as any,
    select: { b2bStatus: true, b2bAppliedAt: true } as any,
  })

  return NextResponse.json({
    success: true,
    data: updated,
    message: '사업자 인증 신청이 접수되었습니다. 관리자 승인 후 공급가가 표시됩니다.',
  })
}
