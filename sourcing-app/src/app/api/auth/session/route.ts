export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'

// GET: 현재 세션 정보 조회
export async function GET(request: NextRequest) {
  try {
    // 어드민 패널에서 ?preferAdmin=1 로 호출하면 admin 쿠키를 우선 조회한다.
    // (같은 브라우저에 매니저 쿠키가 함께 있어도 어드민 세션이 매니저로 가려져
    //  어드민 패널에서 튕기던 버그 방지. 매니저 페이지는 파라미터 없이 호출 → 기존 동작.)
    const preferAdmin = request.nextUrl.searchParams.get('preferAdmin') === '1'
    const tokenPayload = await getCurrentUser(preferAdmin)

    if (!tokenPayload) {
      return NextResponse.json({
        success: false,
        user: null,
      })
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: {
        id: tokenPayload.userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        user: null,
      })
    }

    return NextResponse.json({
      success: true,
      user,
    })
  } catch (error) {
    console.error('세션 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        user: null,
        error: '세션 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
