import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'

/**
 * GET /api/settings/gemini
 * Gemini API 설정 조회
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

    // Gemini API 설정 조회
    const settings = await prisma.geminiApiSettings.findUnique({
      where: { userId },
      select: {
        apiKey: true,
        model: true,
        temperature: true,
        maxTokens: true,
        updatedAt: true,
      }
    })

    if (!settings) {
      return NextResponse.json({
        success: true,
        settings: {
          apiKey: '',
          model: 'gemini-2.5-flash',
          temperature: 0.7,
          maxTokens: 2048,
        }
      })
    }

    return NextResponse.json({
      success: true,
      settings: {
        apiKey: settings.apiKey,
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        updatedAt: settings.updatedAt,
      }
    })

  } catch (error) {
    console.error('Gemini API 설정 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'API 설정을 불러올 수 없습니다.'
    }, { status: 500 })
  }
}

/**
 * POST /api/settings/gemini
 * Gemini API 설정 저장
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

    const { apiKey, model, temperature, maxTokens } = body

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({
        success: false,
        error: 'API Key는 필수입니다.'
      }, { status: 400 })
    }

    // Gemini API 설정 저장
    const settings = await prisma.geminiApiSettings.upsert({
      where: { userId },
      create: {
        userId,
        apiKey: apiKey.trim(),
        model: model || 'gemini-2.5-flash',
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 2048,
      },
      update: {
        apiKey: apiKey.trim(),
        model: model || 'gemini-2.5-flash',
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 2048,
      },
    })

    console.log('✅ Gemini API 설정 저장 완료:', {
      userId,
      model: settings.model,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    })

    return NextResponse.json({
      success: true,
      message: 'Gemini API 설정이 저장되었습니다.',
      settings: {
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      }
    })

  } catch (error) {
    console.error('Gemini API 설정 저장 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'API 설정 저장 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/gemini
 * Gemini API 설정 삭제
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

    await prisma.geminiApiSettings.delete({
      where: { userId }
    })

    console.log('✅ Gemini API 설정 삭제 완료')

    return NextResponse.json({
      success: true,
      message: 'Gemini API 설정이 삭제되었습니다.'
    })

  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({
        success: false,
        error: '삭제할 설정이 없습니다.'
      }, { status: 404 })
    }

    console.error('Gemini API 설정 삭제 실패:', error)
    return NextResponse.json({
      success: false,
      error: '설정 삭제 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
