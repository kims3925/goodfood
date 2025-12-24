export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import { prisma } from '@/modules/common/utils/src/database/client'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다' }, { status: 401 })
  }

  const userId = Number(session.user.id)
  const { agreeTos, agreePrivacy, agreeMarketing } = await request.json()

  if (!agreeTos || !agreePrivacy) {
    return NextResponse.json(
      { success: false, error: '필수 약관에 동의해주세요' },
      { status: 400 }
    )
  }

  const now = new Date()

  await prisma.user.update({
    where: { id: userId },
    data: {
      tosAgreedAt: now,
      privacyAgreedAt: now,
      marketingAgreedAt: agreeMarketing ? now : null,
      signupCompletedAt: now,
    },
  })

  return NextResponse.json({ success: true, completedAt: now })
}
