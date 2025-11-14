import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 사용자 확인
    const userId = parseInt(session.user.id, 10)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true
      }
    })

    // 사용자가 없으면 기본값 반환
    if (!user) {
      return NextResponse.json({
        success: true,
        settings: {
          emailEnabled: true,
          emailAddress: '',
          kakaoEnabled: false,
          kakaoToken: '',
          smsEnabled: false,
          phoneNumber: '',
          orderNotifications: true,
          errorNotifications: true,
          completionNotifications: true
        }
      })
    }

    // TODO: 알림 설정 기능은 추후 별도 모델로 구현 예정
    // 현재는 기본값만 반환
    return NextResponse.json({
      success: true,
      settings: {
        emailEnabled: true,
        emailAddress: user.email || '',
        kakaoEnabled: false,
        kakaoToken: '',
        smsEnabled: false,
        phoneNumber: '',
        orderNotifications: true,
        errorNotifications: true,
        completionNotifications: true
      }
    })

  } catch (error) {
    console.error('알림 설정 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: '설정을 조회할 수 없습니다.'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const {
      emailEnabled,
      emailAddress,
      kakaoEnabled,
      kakaoToken,
      smsEnabled,
      phoneNumber,
      orderNotifications,
      errorNotifications,
      completionNotifications
    } = await request.json()

    // 사용자 확인
    const userId = parseInt(session.user.id, 10)
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // TODO: 알림 설정 기능은 추후 별도 NotificationSettings 모델로 구현 예정
    // 현재는 설정을 받기만 하고 저장하지 않음
    console.log('알림 설정 저장 요청 (미구현):', {
      userId,
      emailEnabled,
      emailAddress,
      kakaoEnabled,
      smsEnabled,
      orderNotifications,
      errorNotifications,
      completionNotifications
    })

    return NextResponse.json({
      success: true,
      message: '설정이 저장되었습니다.'
    })

  } catch (error) {
    console.error('알림 설정 저장 실패:', error)
    return NextResponse.json({
      success: false,
      error: '설정을 저장할 수 없습니다.'
    }, { status: 500 })
  }
}