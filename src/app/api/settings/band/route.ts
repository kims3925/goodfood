import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'

/**
 * GET /api/settings/band
 * Band API 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)

    // Band API 설정 조회
    const settings = await prisma.bandApiSettings.findUnique({
      where: { userId },
      select: {
        clientId: true,
        clientSecret: true,
        accessToken: true,
        refreshToken: true,
        tokenExpiry: true,
        updatedAt: true,
      }
    })

    if (!settings) {
      return NextResponse.json({
        success: true,
        settings: {
          clientId: '',
          clientSecret: '',
          accessToken: '',
          refreshToken: '',
          tokenExpiry: null,
        }
      })
    }

    return NextResponse.json({
      success: true,
      settings: {
        clientId: settings.clientId,
        clientSecret: settings.clientSecret || '',
        accessToken: settings.accessToken || '',
        refreshToken: settings.refreshToken || '',
        tokenExpiry: settings.tokenExpiry,
        updatedAt: settings.updatedAt,
      }
    })

  } catch (error) {
    console.error('Band API 설정 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'API 설정을 불러올 수 없습니다.'
    }, { status: 500 })
  }
}

/**
 * POST /api/settings/band
 * Band API 설정 저장
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)
    const body = await request.json()

    const { clientId, clientSecret, accessToken, refreshToken } = body

    if (!clientId || !clientId.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Client ID는 필수입니다.'
      }, { status: 400 })
    }

    if (!clientSecret || !clientSecret.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Client Secret은 필수입니다.'
      }, { status: 400 })
    }

    // Band API 설정 저장
    const settings = await prisma.bandApiSettings.upsert({
      where: { userId },
      create: {
        userId,
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        accessToken: accessToken?.trim() || null,
        refreshToken: refreshToken?.trim() || null,
      },
      update: {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        accessToken: accessToken?.trim() || null,
        refreshToken: refreshToken?.trim() || null,
      },
    })

    console.log('✅ Band API 설정 저장 완료:', {
      userId,
      hasAccessToken: !!settings.accessToken,
      hasRefreshToken: !!settings.refreshToken,
    })

    return NextResponse.json({
      success: true,
      message: 'Band API 설정이 저장되었습니다.'
    })

  } catch (error) {
    console.error('Band API 설정 저장 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'API 설정 저장 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/band
 * Band API 설정 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)

    await prisma.bandApiSettings.delete({
      where: { userId }
    })

    console.log('✅ Band API 설정 삭제 완료')

    return NextResponse.json({
      success: true,
      message: 'Band API 설정이 삭제되었습니다.'
    })

  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({
        success: false,
        error: '삭제할 설정이 없습니다.'
      }, { status: 404 })
    }

    console.error('Band API 설정 삭제 실패:', error)
    return NextResponse.json({
      success: false,
      error: '설정 삭제 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
