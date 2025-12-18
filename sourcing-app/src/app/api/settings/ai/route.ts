export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { settingsService } from '@/modules/config/domain/src/settings'
import { GoogleGenerativeAI } from '@google/generative-ai'

// =============================================
// AI 연결 테스트 함수
// =============================================

async function testGeminiConnection(apiKey: string, model: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[Gemini API Test] 연결 테스트 시작')

    const genAI = new GoogleGenerativeAI(apiKey)
    const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-2.5-flash' })

    const result = await geminiModel.generateContent('Hi')
    await result.response

    console.log('[Gemini API Test] 연결 성공')
    return { success: true, message: `Gemini API 연결 성공! 모델: ${model}` }
  } catch (error: any) {
    console.error('[Gemini API Test] 오류:', error.message)

    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('invalid API key')) {
      return { success: false, message: 'API Key가 유효하지 않습니다. Google AI Studio에서 키를 확인해주세요.' }
    }
    if (error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return { success: false, message: 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.' }
    }
    return { success: false, message: `연결 실패: ${error.message}` }
  }
}

async function testOpenAIConnection(apiKey: string, model: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[OpenAI API Test] 연결 테스트 시작')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      }),
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, message: 'API Key가 유효하지 않습니다. OpenAI Platform에서 키를 확인해주세요.' }
      }
      if (response.status === 429) {
        return { success: false, message: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' }
      }
      const errorData = await response.json().catch(() => ({}))
      return { success: false, message: `OpenAI API 오류 (${response.status}): ${errorData.error?.message || '알 수 없는 오류'}` }
    }

    console.log('[OpenAI API Test] 연결 성공')
    return { success: true, message: `OpenAI API 연결 성공! 모델: ${model}` }
  } catch (error: any) {
    console.error('[OpenAI API Test] 오류:', error.message)
    return { success: false, message: `연결 실패: ${error.message || '네트워크 오류'}` }
  }
}

// GET: AI 설정 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const settings = await settingsService.getAiSettings(currentUser.userId)

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('AI 설정 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: 'AI 설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: AI 설정 저장 (연결 테스트 포함)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { provider, settings } = body

    console.log('[AI 설정 저장] 요청 받음:', { provider, settings })

    // 연결 테스트 수행 (저장 전 검증)
    const apiKey = settings?.apiKey
    const model = settings?.model

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API Key가 필요합니다.' },
        { status: 400 }
      )
    }

    let testResult: { success: boolean; message: string }

    if (provider === 'GEMINI') {
      testResult = await testGeminiConnection(apiKey, model || 'gemini-2.5-flash')
    } else if (provider === 'OPENAI') {
      testResult = await testOpenAIConnection(apiKey, model || 'gpt-4o-mini')
    } else {
      return NextResponse.json(
        { success: false, error: '지원하지 않는 AI 제공업체입니다.' },
        { status: 400 }
      )
    }

    // 연결 테스트 실패 시 저장하지 않음
    if (!testResult.success) {
      console.log('[AI 설정 저장] 연결 테스트 실패:', testResult.message)
      return NextResponse.json(
        { success: false, error: testResult.message },
        { status: 400 }
      )
    }

    console.log('[AI 설정 저장] 연결 테스트 성공, 저장 진행')

    // 연결 테스트 성공 시 저장 (provider를 소문자로 변환)
    const aiConfig = await settingsService.saveAiSettings(currentUser.userId, provider.toLowerCase(), settings)

    return NextResponse.json({ success: true, data: aiConfig })
  } catch (error: any) {
    console.error('AI 설정 저장 실패:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    console.error('Error meta:', error.meta)

    if (error.message === '지원하지 않는 AI 제공업체입니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'AI 설정 저장에 실패했습니다.', details: error.message },
      { status: 500 }
    )
  }
}
