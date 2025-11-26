import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const prisma = new PrismaClient()

// GET: AI 설정 조회
export async function GET(request: NextRequest) {
  try {
    // 세션에서 userId 가져오기
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: '로그인이 필요합니다.',
        },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    // AI 설정 조회
    const aiConfigs = await prisma.aiApiConfig.findMany({
      where: {
        userId,
      },
    })

    // 설정을 제공업체별로 매핑
    const settings = {
      gemini: {
        apiKey: '',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 2048,
      },
      openai: {
        apiKey: '',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 2048,
      },
    }

    // Gemini AI 설정
    const geminiConfig = aiConfigs.find((c) => c.provider === 'GEMINI')
    if (geminiConfig) {
      const config = geminiConfig.config as any
      settings.gemini = {
        apiKey: geminiConfig.apiKey || '',
        model: geminiConfig.model || 'gemini-2.5-flash',
        temperature: config?.temperature || 0.7,
        maxTokens: config?.maxTokens || 2048,
      }
    }

    // OpenAI 설정
    const openaiConfig = aiConfigs.find((c) => c.provider === 'OPENAI')
    if (openaiConfig) {
      const config = openaiConfig.config as any
      settings.openai = {
        apiKey: openaiConfig.apiKey || '',
        model: openaiConfig.model || 'gpt-4o-mini',
        temperature: config?.temperature || 0.7,
        maxTokens: config?.maxTokens || 2048,
      }
    }

    return NextResponse.json({
      success: true,
      settings,
    })
  } catch (error) {
    console.error('AI 설정 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'AI 설정을 불러오는데 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// POST: AI 설정 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, settings } = body

    console.log('[AI 설정 저장] 요청 받음:', { provider, settings })

    // 세션에서 userId 가져오기
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: '로그인이 필요합니다.',
        },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    // AI 제공업체 매핑
    const aiProviderMap: Record<string, string> = {
      gemini: 'GEMINI',
      openai: 'OPENAI',
    }

    const aiProvider = aiProviderMap[provider]
    console.log('[AI 설정 저장] AI 제공업체 매핑:', aiProvider)

    if (!aiProvider) {
      return NextResponse.json(
        {
          success: false,
          error: '지원하지 않는 AI 제공업체입니다.',
        },
        { status: 400 }
      )
    }

    // 기존 AI 설정 확인
    const existingAiConfig = await prisma.aiApiConfig.findFirst({
      where: {
        userId,
        provider: aiProvider as any,
      },
    })

    console.log('[AI 설정 저장] 기존 AI 설정:', existingAiConfig ? `ID: ${existingAiConfig.id}` : '없음')

    // Upsert (업데이트 또는 생성)
    let aiConfig
    if (existingAiConfig) {
      console.log('[AI 설정 저장] 기존 AI 설정 업데이트 시작')

      // 업데이트 시에는 변경 가능한 필드만 전송
      const updateData = {
        apiKey: settings.apiKey,
        model: settings.model,
        config: {
          temperature: settings.temperature || 0.7,
          maxTokens: settings.maxTokens || 2048,
        },
        isActive: true,
      }

      console.log('[AI 설정 저장] 업데이트 데이터:', updateData)

      aiConfig = await prisma.aiApiConfig.update({
        where: { id: existingAiConfig.id },
        data: updateData,
      })
      console.log('[AI 설정 저장] AI 업데이트 완료:', aiConfig.id)
    } else {
      console.log('[AI 설정 저장] 새 AI 설정 생성 시작')

      // 생성 시에는 모든 필드 전송
      const createData = {
        userId,
        provider: aiProvider as any,
        apiKey: settings.apiKey,
        model: settings.model,
        config: {
          temperature: settings.temperature || 0.7,
          maxTokens: settings.maxTokens || 2048,
        },
        isActive: true,
      }

      console.log('[AI 설정 저장] 생성 데이터:', createData)

      aiConfig = await prisma.aiApiConfig.create({
        data: createData,
      })
      console.log('[AI 설정 저장] AI 생성 완료:', aiConfig.id)
    }

    return NextResponse.json({
      success: true,
      data: aiConfig,
    })
  } catch (error) {
    console.error('AI 설정 저장 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'AI 설정 저장에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}
