export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        signupCompletedAt: true,
        // 어드민/매니저 vs 일반회원(쇼핑몰 유입) 구분용
        shopId: true,
        mode: true,
        // 일반회원이 가입한 쇼핑몰(어느 몰에서 유입됐는지)
        registeredShop: { select: { name: true, subdomain: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '사용자 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
