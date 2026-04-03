export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { role } = await request.json()
    const userId = parseInt(params.id)

    if (!['USER', 'MANAGER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 역할입니다.' },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    })

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('역할 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '역할 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}
