/**
 * GET /api/shop-builder/jobs/[id] — 단일 Job 조회
 * GET /api/shop-builder/jobs   — 본인 Job 목록 (최근 50)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  const job = await prisma.pageGenerationJob.findFirst({
    where: { id, createdBy: me.userId },
  })
  if (!job) return NextResponse.json({ success: false, error: '없음' }, { status: 404 })

  return NextResponse.json({ success: true, data: job })
}
