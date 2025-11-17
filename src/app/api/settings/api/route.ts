import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'

// GET: API 설정 조회 (Band + Gemini)
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
    const bandSettings = await prisma.bandApiSettings.findUnique({
      where: { userId },
      select: {
        clientId: true,
        clientSecret: true,
        accessToken: true,
        refreshToken: true,
        tokenExpiry: true,
      }
    })

    // Gemini API 설정 조회
    const geminiSettings = await prisma.geminiApiSettings.findUnique({
      where: { userId },
      select: {
        apiKey: true,
        model: true,
        temperature: true,
        maxTokens: true,
      }
    })

    const apiSettings = {
      band: bandSettings ? {
        clientId: bandSettings.clientId,
        clientSecret: bandSettings.clientSecret || '',
        accessToken: bandSettings.accessToken || '',
        refreshToken: bandSettings.refreshToken || '',
        tokenExpiry: bandSettings.tokenExpiry,
      } : {
        clientId: '',
        clientSecret: '',
        accessToken: '',
        refreshToken: '',
        tokenExpiry: null,
      },
      gemini: geminiSettings ? {
        apiKey: geminiSettings.apiKey,
        model: geminiSettings.model,
        temperature: geminiSettings.temperature,
        maxTokens: geminiSettings.maxTokens,
      } : {
        apiKey: '',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 2048,
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

// POST: API 설정 저장 (Band 또는 Gemini)
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

    const userId = parseInt(session.user.id, 10)

    // Band API 저장
    if (provider === 'band') {
      if (!settings.clientId || !settings.clientSecret) {
        return NextResponse.json({
          success: false,
          error: 'Client ID와 Client Secret은 필수입니다.'
        }, { status: 400 })
      }

      await prisma.bandApiSettings.upsert({
        where: { userId },
        create: {
          userId,
          clientId: settings.clientId.trim(),
          clientSecret: settings.clientSecret.trim(),
          accessToken: settings.accessToken?.trim() || null,
          refreshToken: settings.refreshToken?.trim() || null,
        },
        update: {
          clientId: settings.clientId.trim(),
          clientSecret: settings.clientSecret.trim(),
          accessToken: settings.accessToken?.trim() || null,
          refreshToken: settings.refreshToken?.trim() || null,
        },
      })

      console.log('✅ Band API 설정이 데이터베이스에 저장되었습니다.')

      return NextResponse.json({
        success: true,
        message: 'Band API 설정이 저장되었습니다.'
      })
    }

    // Gemini API 저장
    if (provider === 'gemini') {
      if (!settings.apiKey) {
        return NextResponse.json({
          success: false,
          error: 'API Key는 필수입니다.'
        }, { status: 400 })
      }

      await prisma.geminiApiSettings.upsert({
        where: { userId },
        create: {
          userId,
          apiKey: settings.apiKey.trim(),
          model: settings.model || 'gemini-2.5-flash',
          temperature: settings.temperature ?? 0.7,
          maxTokens: settings.maxTokens ?? 2048,
        },
        update: {
          apiKey: settings.apiKey.trim(),
          model: settings.model || 'gemini-2.5-flash',
          temperature: settings.temperature ?? 0.7,
          maxTokens: settings.maxTokens ?? 2048,
        },
      })

      console.log('✅ Gemini API 설정이 데이터베이스에 저장되었습니다.')

      return NextResponse.json({
        success: true,
        message: 'Gemini API 설정이 저장되었습니다.'
      })
    }

    return NextResponse.json({
      success: false,
      error: '지원하지 않는 API 제공자입니다.'
    }, { status: 400 })

  } catch (error) {
    console.error('API 설정 저장 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'API 설정 저장 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
