import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import { refreshBandToken, validateBandToken } from '@/domain/band'
import prisma from '@/lib/database/client'

export async function POST() {
  try {
    console.log('🔄 Band API 토큰 갱신 시작...')

    // 인증 확인
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)

    // 데이터베이스에서 Band API 설정 조회
    const bandSettings = await prisma.bandApiSettings.findUnique({
      where: { userId },
      select: {
        accessToken: true,
        refreshToken: true,
      }
    })

    if (!bandSettings) {
      return NextResponse.json({
        success: false,
        error: 'Band API 설정이 없습니다. /admin/settings/api 페이지에서 설정해주세요.'
      }, { status: 404 })
    }

    // 현재 토큰 상태 확인
    if (bandSettings.accessToken) {
      const isValid = await validateBandToken(bandSettings.accessToken)
      if (isValid) {
        return NextResponse.json({
          success: true,
          message: '현재 토큰이 아직 유효합니다.',
          currentToken: `${bandSettings.accessToken.slice(0, 20)}...`
        })
      }
    }

    // 토큰 갱신 시도
    if (!bandSettings.refreshToken) {
      return NextResponse.json({
        success: false,
        error: 'Refresh Token이 없습니다. Band OAuth 인증을 다시 진행해주세요.'
      }, { status: 400 })
    }

    const newTokens = await refreshBandToken(userId, bandSettings.refreshToken)

    // 새 토큰을 데이터베이스에 저장
    await prisma.bandApiSettings.update({
      where: { userId },
      data: {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || bandSettings.refreshToken,
        tokenExpiry: new Date(Date.now() + (newTokens.expires_in || 3600) * 1000),
      }
    })

    return NextResponse.json({
      success: true,
      message: '토큰이 성공적으로 갱신되어 데이터베이스에 저장되었습니다.',
      newTokens: {
        access_token: `${newTokens.access_token.slice(0, 20)}...`,
        expires_in: newTokens.expires_in
      }
    })
    
  } catch (error) {
    console.error('토큰 갱신 실패:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      solution: [
        '1. /admin/settings/api 페이지에서 Band API 설정을 확인하세요',
        '2. 리프레시 토큰이 유효한지 확인하세요',
        '3. 필요시 Band OAuth 인증을 다시 진행하세요',
        '4. https://developers.band.us/develop/guide/api 참조'
      ]
    }, { status: 500 })
  }
}
