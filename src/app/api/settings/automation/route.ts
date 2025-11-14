import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)

    // 데이터베이스에서 자동화 설정 조회
    const automationSettings = await prisma.automationSettings.findUnique({
      where: { userId: userId }
    })

    // 설정이 없으면 기본값 반환
    if (!automationSettings) {
      const defaultSettings = {
        defaultPricingPolicy: '수집가격 기준 구간별 마진 적용 (19,900원 이하 +1,000원, 20,000~29,900원 +2,000원, 30,000~39,900원 +3,000원, 40,000~49,900원 +4,000원, 50,000~59,900원 +5,000원, 60,001~70,000원 +6,000원, 70,001~80,000원 +7,000원, 80,001~90,000원 +8,000원, 90,001~100,000원 +9,000원, 100,001~150,000원 +12,000원, 150,001~200,000원 +20,000원, 200,001원 이상 +20,000원)',
      }

      return NextResponse.json({
        success: true,
        settings: defaultSettings
      })
    }

    return NextResponse.json({
      success: true,
      settings: {
        defaultPricingPolicy: automationSettings.defaultPricingPolicy,
      }
    })
  } catch (error) {
    console.error('Failed to load automation settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load automation settings',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)
    const body = await req.json()

    // 데이터베이스에서 upsert (없으면 생성, 있으면 업데이트)
    const savedSettings = await prisma.automationSettings.upsert({
      where: { userId: userId },
      update: {
        defaultPricingPolicy: body.defaultPricingPolicy || '',
      },
      create: {
        userId: userId,
        defaultPricingPolicy: body.defaultPricingPolicy || '',
      }
    })

    return NextResponse.json({
      success: true,
      message: '자동화 설정이 저장되었습니다.',
      settings: {
        defaultPricingPolicy: savedSettings.defaultPricingPolicy,
      }
    })

  } catch (error) {
    console.error('Failed to save automation settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: '설정 저장에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}
