import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// POST: AI API 연결 테스트 (Ping)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, geminiApiKey, openaiApiKey, geminiModel, openaiModel } = body

    // Gemini API 연결 테스트
    if (provider === 'gemini') {
      if (!geminiApiKey || geminiApiKey.trim() === '') {
        return NextResponse.json({
          success: false,
          message: 'Gemini API Key가 필요합니다.',
        })
      }

      try {
        console.log('[Gemini API Test] 연결 테스트 시작')

        const genAI = new GoogleGenerativeAI(geminiApiKey)
        const model = genAI.getGenerativeModel({ model: geminiModel || 'gemini-2.5-flash' })

        // 간단한 ping 테스트
        const result = await model.generateContent('Hi')
        const response = await result.response
        const text = response.text()

        console.log('[Gemini API Test] 연결 성공')

        return NextResponse.json({
          success: true,
          message: `Gemini API 연결 성공! 모델: ${geminiModel || 'gemini-2.5-flash'}`,
          response: text,
        })
      } catch (error: any) {
        console.error('[Gemini API Test] 오류:', error)

        // API 키 오류 처리
        if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('invalid API key')) {
          return NextResponse.json({
            success: false,
            message: 'API Key가 유효하지 않습니다. Google AI Studio에서 키를 확인해주세요.',
          })
        }

        // 할당량 초과 오류
        if (error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
          return NextResponse.json({
            success: false,
            message: 'API 할당량이 초과되었습니다. 잠시 후 다시 시도하거나 다른 모델을 선택해주세요.',
          })
        }

        return NextResponse.json({
          success: false,
          message: `연결 실패: ${error.message || '알 수 없는 오류가 발생했습니다.'}`,
        })
      }
    }

    // OpenAI API 연결 테스트
    else if (provider === 'openai') {
      if (!openaiApiKey || openaiApiKey.trim() === '') {
        return NextResponse.json({
          success: false,
          message: 'OpenAI API Key가 필요합니다.',
        })
      }

      try {
        console.log('[OpenAI API Test] 연결 테스트 시작')

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: openaiModel || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('[OpenAI API Test] 오류:', errorData)

          if (response.status === 401) {
            return NextResponse.json({
              success: false,
              message: 'API Key가 유효하지 않습니다. OpenAI Platform에서 키를 확인해주세요.',
            })
          }

          if (response.status === 429) {
            return NextResponse.json({
              success: false,
              message: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
            })
          }

          return NextResponse.json({
            success: false,
            message: `OpenAI API 오류 (${response.status}): ${errorData.error?.message || '알 수 없는 오류'}`,
          })
        }

        const data = await response.json()
        const text = data.choices?.[0]?.message?.content || ''

        console.log('[OpenAI API Test] 연결 성공')

        return NextResponse.json({
          success: true,
          message: `OpenAI API 연결 성공! 모델: ${openaiModel || 'gpt-4o-mini'}`,
          response: text,
        })
      } catch (error: any) {
        console.error('[OpenAI API Test] 예외:', error)
        return NextResponse.json({
          success: false,
          message: `연결 실패: ${error.message || '네트워크 오류가 발생했습니다.'}`,
        })
      }
    }

    // 지원하지 않는 제공업체
    else {
      return NextResponse.json({
        success: false,
        message: '지원하지 않는 AI 제공업체입니다.',
      })
    }
  } catch (error) {
    console.error('[AI API Test] 오류:', error)
    return NextResponse.json(
      {
        success: false,
        message: '연결 테스트 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
