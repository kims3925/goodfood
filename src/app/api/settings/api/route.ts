import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import { loadAPISettings, saveAPISettings } from '@/lib/config/storage'
import prisma from '@/lib/database/client'

// GET: API 설정 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // Band API 설정은 데이터베이스에서 로드
    const userId = parseInt(session.user.id, 10)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        bandClientId: true,
        bandClientSecret: true,
        bandAccessToken: true
      }
    })

    // 나머지 API 설정은 파일에서 로드
    const fileSettings = loadAPISettings()

    const apiSettings = {
      ...fileSettings,
      band: {
        clientId: user?.bandClientId || '',
        clientSecret: user?.bandClientSecret || '',
        accessToken: user?.bandAccessToken || '',
        refreshToken: '' // Refresh Token은 별도 관리
      }
    }

    return NextResponse.json({
      success: true,
      settings: apiSettings
    })

  } catch (error) {
    console.error('API 설정 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'API 설정을 불러올 수 없습니다.'
    }, { status: 500 })
  }
}

// POST: API 설정 저장
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { provider, settings } = await request.json()

    if (!provider || !settings) {
      return NextResponse.json({
        success: false,
        error: 'API 제공자와 설정 정보가 필요합니다.'
      }, { status: 400 })
    }

    // Band API는 데이터베이스에 저장
    if (provider === 'band') {
      const userId = parseInt(session.user.id, 10)
      await prisma.user.update({
        where: { id: userId },
        data: {
          bandClientId: settings.clientId || null,
          bandClientSecret: settings.clientSecret || null,
          bandAccessToken: settings.accessToken || null
        }
      })

      console.log('✅ Band API 설정이 데이터베이스에 저장되었습니다.')

      return NextResponse.json({
        success: true,
        message: 'Band API 설정이 저장되었습니다.'
      })
    }

    // 나머지 API 제공자는 파일에 저장
    const currentSettings = loadAPISettings()

    const updatedSettings = {
      ...currentSettings,
      [provider]: settings
    }

    saveAPISettings(updatedSettings)

    console.log(`✅ ${provider} API 설정 저장 완료 (파일)`)

    return NextResponse.json({
      success: true,
      message: 'API 설정이 저장되었습니다.'
    })

  } catch (error) {
    console.error('API 설정 저장 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'API 설정 저장 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
