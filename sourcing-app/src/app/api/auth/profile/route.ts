export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// PATCH: 프로필 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { name, phone } = body

    const updated = await prisma.user.update({
      where: { id: currentUser.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
      },
      select: { id: true, email: true, name: true, phone: true, role: true },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('프로필 업데이트 실패:', error)
    return NextResponse.json({ success: false, error: '프로필 업데이트에 실패했습니다.' }, { status: 500 })
  }
}
