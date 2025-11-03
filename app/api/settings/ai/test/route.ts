import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const {
      provider,
      geminiApiKey,
      openaiApiKey,
      geminiModel,
      openaiModel,
      temperature,
      maxTokens,
      testPrompt
    } = await request.json()

    // 디버깅용 로그
    console.log('🔍 Test API 요청 받음:', {
      provider,
      geminiModel,
      openaiModel,
      hasGeminiKey: !!geminiApiKey,
      hasOpenAIKey: !!openaiApiKey
    })

    // Provider 선택
    if (!provider) {
      return NextResponse.json({
        success: false,
        message: 'AI 제공업체를 선택해주세요.'
      })
    }

    // Gemini 테스트
    if (provider === 'gemini') {
      return await testGemini(geminiApiKey, geminiModel, temperature, maxTokens, testPrompt)
    }

    // OpenAI 테스트
    if (provider === 'openai') {
      return await testOpenAI(openaiApiKey, openaiModel, temperature, maxTokens, testPrompt)
    }

    return NextResponse.json({
      success: false,
      message: '지원하지 않는 제공업체입니다.'
    })

  } catch (error) {
    console.error('AI 연결 테스트 실패:', error)
    return NextResponse.json({
      success: false,
      message: '연결 테스트 중 오류가 발생했습니다.'
    })
  }
}

// Gemini API 테스트 함수
async function testGemini(
  apiKey: string,
  model: string,
  temperature: number,
  maxTokens: number,
  testPrompt: string
) {
  console.log('✨ Gemini 테스트 시작:', { model, hasKey: !!apiKey })

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      message: 'Gemini API Key가 필요합니다.'
    })
  }

  // API Key 형식 검증
  if (!apiKey.startsWith('AIza')) {
    return NextResponse.json({
      success: false,
      message: 'Gemini API Key 형식이 올바르지 않습니다. (AIza로 시작해야 함)'
    })
  }

  try {
    const prompt = testPrompt || "Hello, please respond with 'AI connection test successful' in Korean."

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: temperature,
            maxOutputTokens: Math.min(maxTokens, 500)
          }
        })
      }
    )

    if (response.ok) {
      const data = await response.json()

      if (data.candidates && data.candidates.length > 0) {
        const generatedText = data.candidates[0].content?.parts?.[0]?.text

        return NextResponse.json({
          success: true,
          message: `✅ Gemini API 연결 성공! (모델: ${model})`,
          response: generatedText || '응답 생성 완료'
        })
      } else {
        return NextResponse.json({
          success: false,
          message: 'AI 모델에서 응답을 생성하지 못했습니다.'
        })
      }
    } else {
      const errorData = await response.json()

      // 🔍 상세 에러 로깅
      console.error('❌ Gemini API 에러 상세:', {
        status: response.status,
        statusText: response.statusText,
        errorData: JSON.stringify(errorData, null, 2)
      })

      // 에러 메시지 상세 분석
      const errorMessage = errorData.error?.message || 'Unknown error'

      if (errorMessage.includes('quota') || errorMessage.includes('exceeded')) {
        return NextResponse.json({
          success: false,
          message: '❌ Gemini API 할당량이 초과되었습니다. 새 API 키를 발급받거나 내일 다시 시도해주세요.'
        })
      } else if (errorMessage.includes('API key')) {
        return NextResponse.json({
          success: false,
          message: '❌ API Key가 올바르지 않습니다. Gemini API Key를 확인해주세요.'
        })
      } else if (errorMessage.includes('not found')) {
        return NextResponse.json({
          success: false,
          message: `❌ 모델을 찾을 수 없습니다: ${model}`
        })
      } else {
        return NextResponse.json({
          success: false,
          message: `API 연결 실패: ${errorMessage}`
        })
      }
    }
  } catch (fetchError) {
    console.error('Gemini API 호출 오류:', fetchError)
    return NextResponse.json({
      success: false,
      message: '네트워크 오류: Gemini API에 연결할 수 없습니다.'
    })
  }
}

// OpenAI API 테스트 함수
async function testOpenAI(
  apiKey: string,
  model: string,
  temperature: number,
  maxTokens: number,
  testPrompt: string
) {
  console.log('⚡ OpenAI 테스트 시작:', { model, hasKey: !!apiKey })

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      message: 'OpenAI API Key가 필요합니다.'
    })
  }

  // API Key 형식 검증
  if (!apiKey.startsWith('sk-')) {
    return NextResponse.json({
      success: false,
      message: 'OpenAI API Key 형식이 올바르지 않습니다. (sk-로 시작해야 함)'
    })
  }

  try {
    const prompt = testPrompt || "Hello, please respond with 'AI connection test successful' in Korean."

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: temperature,
        max_tokens: Math.min(maxTokens, 500)
      })
    })

    if (response.ok) {
      const data = await response.json()

      if (data.choices && data.choices.length > 0) {
        const generatedText = data.choices[0].message?.content

        return NextResponse.json({
          success: true,
          message: `✅ OpenAI API 연결 성공! (모델: ${model})`,
          response: generatedText || '응답 생성 완료'
        })
      } else {
        return NextResponse.json({
          success: false,
          message: 'AI 모델에서 응답을 생성하지 못했습니다.'
        })
      }
    } else {
      const errorData = await response.json()
      const errorMessage = errorData.error?.message || 'Unknown error'

      // 🔍 상세 에러 로깅
      console.error('❌ OpenAI API 에러 상세:', {
        status: response.status,
        statusText: response.statusText,
        errorData: JSON.stringify(errorData, null, 2),
        errorCode: errorData.error?.code,
        errorType: errorData.error?.type
      })

      // 에러 메시지 상세 분석
      if (response.status === 401) {
        return NextResponse.json({
          success: false,
          message: '❌ API Key가 올바르지 않습니다. OpenAI API Key를 확인해주세요.'
        })
      } else if (response.status === 429) {
        return NextResponse.json({
          success: false,
          message: '❌ OpenAI API 할당량이 초과되었습니다. 잠시 후 다시 시도하거나 유료 플랜을 확인해주세요.'
        })
      } else if (errorMessage.includes('insufficient_quota')) {
        return NextResponse.json({
          success: false,
          message: '❌ OpenAI 크레딧이 부족합니다. https://platform.openai.com/account/billing 에서 결제 정보를 확인해주세요.'
        })
      } else if (errorMessage.includes('model')) {
        return NextResponse.json({
          success: false,
          message: `❌ 모델을 찾을 수 없거나 접근 권한이 없습니다: ${model}`
        })
      } else {
        return NextResponse.json({
          success: false,
          message: `API 연결 실패: ${errorMessage}`
        })
      }
    }
  } catch (fetchError) {
    console.error('OpenAI API 호출 오류:', fetchError)
    return NextResponse.json({
      success: false,
      message: '네트워크 오류: OpenAI API에 연결할 수 없습니다.'
    })
  }
}
