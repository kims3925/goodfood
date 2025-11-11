import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 데이터베이스에서 소매 설정 조회
    const retailSettings = await prisma.retailSettings.findUnique({
      where: { userId: session.user.id }
    })

    // 설정이 없으면 기본값 반환
    if (!retailSettings) {
      const defaultSettings = {
        autoPostInterval: 30,
        maxPostsPerDay: 20,
        enableAutoPosting: false,
        postingSchedule: {
          start: '09:00',
          end: '22:00',
        },
        isLocked: false,
      }

      return NextResponse.json({
        success: true,
        settings: defaultSettings
      })
    }

    // 데이터베이스 결과를 프론트엔드 형식으로 변환
    const formattedSettings = {
      autoPostInterval: retailSettings.autoPostInterval,
      maxPostsPerDay: retailSettings.maxPostsPerDay,
      enableAutoPosting: retailSettings.enableAutoPosting,
      postingSchedule: {
        start: retailSettings.postingStart,
        end: retailSettings.postingEnd,
      },
      isLocked: retailSettings.isLocked,
    }

    return NextResponse.json({
      success: true,
      settings: formattedSettings
    })
  } catch (error) {
    console.error('Failed to load retail settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load retail settings',
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

    const body = await req.json()

    // 프론트엔드 형식을 데이터베이스 형식으로 변환
    const dbData = {
      autoPostInterval: body.autoPostInterval || 30,
      maxPostsPerDay: body.maxPostsPerDay || 20,
      enableAutoPosting: body.enableAutoPosting || false,
      postingStart: body.postingSchedule?.start || '09:00',
      postingEnd: body.postingSchedule?.end || '22:00',
      isLocked: body.isLocked || false,
    }

    // 데이터베이스에서 upsert (없으면 생성, 있으면 업데이트)
    const savedSettings = await prisma.retailSettings.upsert({
      where: { userId: session.user.id },
      update: dbData,
      create: {
        userId: session.user.id,
        ...dbData
      }
    })

    // 응답용 데이터 변환
    const responseSettings = {
      autoPostInterval: savedSettings.autoPostInterval,
      maxPostsPerDay: savedSettings.maxPostsPerDay,
      enableAutoPosting: savedSettings.enableAutoPosting,
      postingSchedule: {
        start: savedSettings.postingStart,
        end: savedSettings.postingEnd,
      },
      isLocked: savedSettings.isLocked,
    }

    return NextResponse.json({
      success: true,
      message: '소매밴드 설정이 저장되었습니다.',
      settings: responseSettings
    })

  } catch (error) {
    console.error('Failed to save retail settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: '설정 저장에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}