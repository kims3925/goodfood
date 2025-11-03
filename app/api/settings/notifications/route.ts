import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 사용자의 알림 설정 조회 (사용자가 없으면 빈 설정 반환)
    let user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        notificationEmail: true,
        notificationEmailAddress: true,
        notificationKakao: true,
        notificationKakaoToken: true,
        notificationSms: true,
        notificationPhoneNumber: true,
        notificationOrders: true,
        notificationErrors: true,
        notificationCompletion: true
      }
    })

    // ID로 사용자를 찾지 못한 경우 이메일로 찾기
    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email || '' },
        select: {
          notificationEmail: true,
          notificationEmailAddress: true,
          notificationKakao: true,
          notificationKakaoToken: true,
          notificationSms: true,
          notificationPhoneNumber: true,
          notificationOrders: true,
          notificationErrors: true,
          notificationCompletion: true
        }
      })
    }

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

    return NextResponse.json({
      success: true,
      settings: {
        emailEnabled: user?.notificationEmail ?? true,
        emailAddress: user?.notificationEmailAddress || '',
        kakaoEnabled: user?.notificationKakao ?? false,
        kakaoToken: user?.notificationKakaoToken || '',
        smsEnabled: user?.notificationSms ?? false,
        phoneNumber: user?.notificationPhoneNumber || '',
        orderNotifications: user?.notificationOrders ?? true,
        errorNotifications: user?.notificationErrors ?? true,
        completionNotifications: user?.notificationCompletion ?? true
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

    // 사용자의 알림 설정 업데이트
    // 1. 먼저 ID로 사용자 찾기
    let user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (user) {
      // 사용자가 존재하면 업데이트
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          notificationEmail: emailEnabled,
          notificationEmailAddress: emailAddress,
          notificationKakao: kakaoEnabled,
          notificationKakaoToken: kakaoToken,
          notificationSms: smsEnabled,
          notificationPhoneNumber: phoneNumber,
          notificationOrders: orderNotifications,
          notificationErrors: errorNotifications,
          notificationCompletion: completionNotifications
        }
      })
    } else {
      // 사용자가 존재하지 않으면 이메일로 찾아서 ID 업데이트 시도
      const existingUser = await prisma.user.findUnique({
        where: { email: session.user.email || '' }
      })

      if (existingUser) {
        // 이메일로 찾은 사용자의 알림 설정 업데이트
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            notificationEmail: emailEnabled,
            notificationEmailAddress: emailAddress,
            notificationKakao: kakaoEnabled,
            notificationKakaoToken: kakaoToken,
            notificationSms: smsEnabled,
            notificationPhoneNumber: phoneNumber,
            notificationOrders: orderNotifications,
            notificationErrors: errorNotifications,
            notificationCompletion: completionNotifications
          }
        })
      } else {
        // 완전히 새로운 사용자 생성
        await prisma.user.create({
          data: {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.name || '',
            password: 'oauth-user',
            notificationEmail: emailEnabled,
            notificationEmailAddress: emailAddress,
            notificationKakao: kakaoEnabled,
            notificationKakaoToken: kakaoToken,
            notificationSms: smsEnabled,
            notificationPhoneNumber: phoneNumber,
            notificationOrders: orderNotifications,
            notificationErrors: errorNotifications,
            notificationCompletion: completionNotifications
          }
        })
      }
    }

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