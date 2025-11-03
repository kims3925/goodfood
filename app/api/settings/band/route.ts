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

    // 사용자의 밴드 설정 조회 (사용자가 없으면 빈 설정 반환)
    let user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        bandClientId: true,
        bandClientSecret: true,
        bandAccessToken: true
      }
    })

    // ID로 사용자를 찾지 못한 경우 이메일로 찾기
    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email || '' },
        select: {
          bandClientId: true,
          bandClientSecret: true,
          bandAccessToken: true
        }
      })
    }

    // 사용자가 없으면 기본값 반환
    if (!user) {
      return NextResponse.json({
        success: true,
        settings: {
          clientId: '',
          clientSecret: '',
          accessToken: ''
        }
      })
    }

    return NextResponse.json({
      success: true,
      settings: {
        clientId: user?.bandClientId || '',
        clientSecret: user?.bandClientSecret || '',
        accessToken: user?.bandAccessToken || ''
      }
    })

  } catch (error) {
    console.error('밴드 설정 조회 실패:', error)
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

    const { clientId, clientSecret, accessToken } = await request.json()

    // 사용자의 밴드 설정 업데이트
    // 1. 먼저 ID로 사용자 찾기
    let user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (user) {
      // 사용자가 존재하면 업데이트
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          bandClientId: clientId,
          bandClientSecret: clientSecret,
          bandAccessToken: accessToken
        }
      })
    } else {
      // 사용자가 존재하지 않으면 이메일로 찾아서 ID 업데이트 시도
      const existingUser = await prisma.user.findUnique({
        where: { email: session.user.email || '' }
      })

      if (existingUser) {
        // 이메일로 찾은 사용자의 밴드 설정 업데이트
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            bandClientId: clientId,
            bandClientSecret: clientSecret,
            bandAccessToken: accessToken
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
            bandClientId: clientId,
            bandClientSecret: clientSecret,
            bandAccessToken: accessToken
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: '설정이 저장되었습니다.'
    })

  } catch (error) {
    console.error('밴드 설정 저장 실패:', error)
    return NextResponse.json({
      success: false,
      error: '설정을 저장할 수 없습니다.'
    }, { status: 500 })
  }
}