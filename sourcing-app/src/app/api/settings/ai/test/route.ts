export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { GoogleGenerativeAI } from '@google/generative-ai'

// =============================================
// AI 연결 테스트 함수
// =============================================

async function testGeminiConnection(apiKey: string, model: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[Gemini API Test] 연결 테스트 시작, 모델:', model)

    // REST API로 직접 테스트 (더 안정적)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hi' }] }],
        generationConfig: {
          maxOutputTokens: 10,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[Gemini API Test] API 오류:', response.status, errorData)

      if (response.status === 400 && errorData.error?.message?.includes('API key')) {
        return { success: false, message: 'API Key가 유효하지 않습니다. Google AI Studio에서 키를 확인해주세요.' }
      }
      if (response.status === 403) {
        return { success: false, message: 'API Key 권한이 없습니다. Google AI Studio에서 키를 확인해주세요.' }
      }
      if (response.status === 429) {
        return { success: false, message: 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.' }
      }
      if (response.status === 404) {
        return { success: false, message: `모델 '${model}'을 찾을 수 없습니다. 다른 모델을 선택해주세요.` }
      }

      return { success: false, message: `Gemini API 오류 (${response.status}): ${errorData.error?.message || '알 수 없는 오류'}` }
    }

    console.log('[Gemini API Test] 연결 성공')
    return { success: true, message: `Gemini API 연결 성공! 모델: ${model}` }
  } catch (error: any) {
    console.error('[Gemini API Test] 오류:', error)

    // 네트워크 오류 상세 처리
    if (error.cause?.code === 'ENOTFOUND') {
      return { success: false, message: 'DNS 조회 실패. 인터넷 연결을 확인해주세요.' }
    }
    if (error.cause?.code === 'ECONNREFUSED') {
      return { success: false, message: '연결이 거부되었습니다. 방화벽 설정을 확인해주세요.' }
    }
    if (error.cause?.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return { success: false, message: '연결 시간 초과. 네트워크 상태를 확인해주세요.' }
    }
    if (error.message?.includes('fetch failed')) {
      return { success: false, message: '네트워크 연결 실패. 인터넷 연결 또는 방화벽 설정을 확인해주세요.' }
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

// POST: AI 연결 테스트
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { provider, geminiApiKey, openaiApiKey, geminiModel, openaiModel } = body

    console.log('[AI 연결 테스트] 요청 받음:', { provider })

    let testResult: { success: boolean; message: string }

    if (provider === 'gemini') {
      if (!geminiApiKey) {
        return NextResponse.json({
          success: false,
          message: 'Gemini API Key를 입력해주세요.'
        })
      }
      testResult = await testGeminiConnection(geminiApiKey, geminiModel || 'gemini-2.5-flash')
    } else if (provider === 'openai') {
      if (!openaiApiKey) {
        return NextResponse.json({
          success: false,
          message: 'OpenAI API Key를 입력해주세요.'
        })
      }
      testResult = await testOpenAIConnection(openaiApiKey, openaiModel || 'gpt-4o-mini')
    } else {
      return NextResponse.json({
        success: false,
        message: '지원하지 않는 AI 제공업체입니다.'
      })
    }

    return NextResponse.json(testResult)
  } catch (error: any) {
    console.error('AI 연결 테스트 실패:', error)
    return NextResponse.json(
      { success: false, message: '연결 테스트 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
