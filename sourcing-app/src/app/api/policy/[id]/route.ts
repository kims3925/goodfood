export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'

// GET: 개별 정책 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { id } = await params
    const policyId = parseInt(id)

    if (isNaN(policyId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const policy = await prisma.pricingPolicy.findFirst({
      where: {
        id: policyId,
        userId: currentUser.userId,
      },
    })

    if (!policy) {
      return NextResponse.json(
        { success: false, error: '정책을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: policy,
    })
  } catch (error) {
    console.error('정책 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '정책 조회에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}
