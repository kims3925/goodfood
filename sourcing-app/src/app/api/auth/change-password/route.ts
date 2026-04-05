export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser, verifyPassword, hashPassword } from '@/modules/auth/auth.service'

// POST: 비밀번호 변경
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { password: true },
    })

    if (!user?.password) {
      return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    const isValid = await verifyPassword(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ success: false, error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 401 })
    }

    const hashedPassword = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: currentUser.userId },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ success: true, message: '비밀번호가 변경되었습니다.' })
  } catch (error) {
    console.error('비밀번호 변경 실패:', error)
    return NextResponse.json({ success: false, error: '비밀번호 변경에 실패했습니다.' }, { status: 500 })
  }
}
