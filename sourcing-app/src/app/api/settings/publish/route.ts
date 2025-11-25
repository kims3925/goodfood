import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getCurrentUser } from '@/modules/auth/auth.service'

const prisma = new PrismaClient()

// GET: 발행 설정 조회
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const setting = await prisma.publishSetting.findUnique({
      where: { userId: user.userId },
    })

    return NextResponse.json({
      success: true,
      data: setting,
    })
  } catch (error) {
    console.error('발행 설정 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행 설정 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 발행 설정 저장/수정
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { orderFormUrl, additionalComment } = body

    // upsert: 있으면 업데이트, 없으면 생성
    const setting = await prisma.publishSetting.upsert({
      where: { userId: user.userId },
      update: {
        orderFormUrl: orderFormUrl || null,
        additionalComment: additionalComment || null,
      },
      create: {
        userId: user.userId,
        orderFormUrl: orderFormUrl || null,
        additionalComment: additionalComment || null,
        autoPush: false,
      },
    })

    return NextResponse.json({
      success: true,
      data: setting,
    })
  } catch (error) {
    console.error('발행 설정 저장 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행 설정 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}
