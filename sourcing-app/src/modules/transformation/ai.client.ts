/**
 * AI Client Abstraction
 *
 * Provides a unified interface for different AI providers (Gemini, OpenAI)
 */

import { AiProvider } from '@bandauto/db'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ProductTransformationError, TransformationErrorCode, TransformationErrorType } from './product.types'

// =============================================
// AI CLIENT INTERFACE
// =============================================

export interface AiClientConfig {
  provider: AiProvider
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
  timeout?: number // milliseconds, default 120000 (120s)
}

export interface AiResponse {
  content: string
  tokensUsed?: number
  model: string
  provider: AiProvider
}

export interface AiImagePart {
  base64: string
  mimeType: string
}

export abstract class BaseAiClient {
  constructor(protected config: AiClientConfig) {}

  abstract generateContent(prompt: string): Promise<AiResponse>

  /** 이미지와 텍스트를 함께 전송 (Vision) - 서브클래스에서 필요 시 오버라이드 */
  async generateContentWithImages(
    _prompt: string,
    _images: AiImagePart[]
  ): Promise<AiResponse> {
    throw new Error(`${this.constructor.name}은 이미지 분석을 지원하지 않습니다.`)
  }
}

// =============================================
// GEMINI CLIENT
// =============================================

export class GeminiClient extends BaseAiClient {
  private client: GoogleGenerativeAI
  private timeout: number

  constructor(config: AiClientConfig) {
    super(config)
    this.client = new GoogleGenerativeAI(config.apiKey)
    this.timeout = config.timeout ?? 120000 // default 120 seconds
  }

  /** Gemini Vision: 이미지 + 텍스트 분석 */
  async generateContentWithImages(prompt: string, images: AiImagePart[]): Promise<AiResponse> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.config.model || 'gemini-2.5-flash',
      })

      const parts: any[] = images.map((img) => ({
        inlineData: { data: img.base64, mimeType: img.mimeType },
      }))
      parts.push({ text: prompt })

      const result = await model.generateContent({ contents: [{ role: 'user', parts }] })
      const response = await result.response
      const text = response.text()

      return {
        content: text,
        tokensUsed: response.usageMetadata?.totalTokenCount,
        model: this.config.model,
        provider: AiProvider.GEMINI,
      }
    } catch (error: any) {
      if (error instanceof ProductTransformationError) throw error
      throw new ProductTransformationError(
        `Gemini Vision 오류: ${error.message}`,
        TransformationErrorCode.AI_API_ERROR,
        { originalError: error }
      )
    }
  }

  async generateContent(prompt: string): Promise<AiResponse> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.config.model || 'gemini-2.5-flash',
      })

      const generationConfig: any = {
        temperature: this.config.temperature ?? 0.7,
      }
      // maxOutputTokens는 명시적으로 설정된 경우에만 적용 (기본값 없음 - Gemini가 자동 결정)
      if (this.config.maxTokens) {
        generationConfig.maxOutputTokens = this.config.maxTokens
      }

      // 타임아웃이 있는 Promise.race 사용
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new ProductTransformationError(
            `AI 응답 대기 시간이 초과되었습니다 (${this.timeout / 1000}초). 잠시 후 다시 시도해주세요.`,
            TransformationErrorCode.AI_API_ERROR,
            { timeout: this.timeout },
            TransformationErrorType.TRANSIENT  // 타임아웃은 일시적 에러
          ))
        }, this.timeout)
      })

      const result = await Promise.race([
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig,
        }),
        timeoutPromise,
      ])

      const response = await result.response

      // Check for safety filter blocking
      const promptFeedback = response.promptFeedback
      if (promptFeedback?.blockReason) {
        throw new ProductTransformationError(
          `Gemini가 콘텐츠를 차단했습니다: ${promptFeedback.blockReason}`,
          TransformationErrorCode.AI_API_ERROR,
          { blockReason: promptFeedback.blockReason, safetyRatings: promptFeedback.safetyRatings }
        )
      }

      const text = response.text()

      // Check for empty response
      if (!text || text.trim() === '') {
        console.error('[GeminiClient] Empty response received. Candidates:', JSON.stringify(response.candidates, null, 2))

        // 빈 응답 원인 분석
        const candidate = response.candidates?.[0]
        const finishReason = candidate?.finishReason

        let errorMessage = 'AI가 응답을 생성하지 못했습니다.'
        if (finishReason === 'SAFETY') {
          errorMessage = '게시물 내용이 안전 정책에 의해 차단되었습니다. 민감한 내용이 포함되어 있을 수 있습니다.'
        } else if (finishReason === 'MAX_TOKENS') {
          errorMessage = '게시물 내용이 너무 길어 처리할 수 없습니다. 내용을 줄여주세요.'
        } else if (finishReason === 'RECITATION') {
          errorMessage = '게시물 내용이 저작권 문제로 처리할 수 없습니다.'
        } else {
          errorMessage = '게시물 내용을 분석할 수 없습니다. 상품 정보가 포함되어 있는지 확인해주세요.'
        }

        throw new ProductTransformationError(
          errorMessage,
          TransformationErrorCode.AI_API_ERROR,
          { candidates: response.candidates, finishReason }
        )
      }

      return {
        content: text,
        tokensUsed: response.usageMetadata?.totalTokenCount,
        model: this.config.model,
        provider: AiProvider.GEMINI,
      }
    } catch (error: any) {
      // Re-throw ProductTransformationError as-is
      if (error instanceof ProductTransformationError) {
        throw error
      }

      const errorMsg = error.message || ''
      const errorName = error.name || ''

      // 디버깅 로그
      console.log('[GeminiClient Error]', {
        name: errorName,
        message: errorMsg,
        fullError: error.toString()
      })

      // 네트워크 오류 처리 (일시적 에러 - 재시도 가능)
      const isNetworkError =
        (errorName === 'TypeError' && errorMsg.includes('fetch failed')) ||
        errorName === 'TypeError' ||  // fetch 관련 TypeError 전체 포함
        errorMsg.includes('ECONNREFUSED') ||
        errorMsg.includes('ETIMEDOUT') ||
        errorMsg.includes('ENOTFOUND') ||
        errorMsg.includes('network') ||
        errorMsg.includes('NetworkError') ||
        errorMsg.includes('fetch')

      if (isNetworkError) {
        throw new ProductTransformationError(
          '네트워크 연결에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
          TransformationErrorCode.AI_API_ERROR,
          { originalError: error },
          TransformationErrorType.TRANSIENT  // 일시적 에러
        )
      }

      // 토큰/할당량 관련 에러 처리 (일시적 에러 - 재시도 가능)
      if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('token') || errorMsg.includes('rate')) {
        throw new ProductTransformationError(
          'API 할당량이 초과되었습니다. 잠시 후 다시 시도하거나 AI 설정을 확인해주세요.',
          TransformationErrorCode.AI_API_ERROR,
          { originalError: error },
          TransformationErrorType.TRANSIENT  // 일시적 에러
        )
      }

      // API 키 관련 에러 (영구적 에러 - 재시도 불가)
      if (errorMsg.includes('API key') || errorMsg.includes('authentication') || errorMsg.includes('401')) {
        throw new ProductTransformationError(
          'AI API 키가 유효하지 않습니다. 환경 설정에서 API 키를 확인해주세요.',
          TransformationErrorCode.AI_API_ERROR,
          { originalError: error },
          TransformationErrorType.PERMANENT  // 영구적 에러
        )
      }

      // 기타 에러는 영구적으로 분류 (기본값)
      throw new ProductTransformationError(
        `Gemini API 오류: ${error.message}`,
        TransformationErrorCode.AI_API_ERROR,
        { originalError: error },
        TransformationErrorType.PERMANENT
      )
    }
  }
}

// =============================================
// OPENAI CLIENT
// =============================================

export class OpenAiClient extends BaseAiClient {
  private timeout: number

  constructor(config: AiClientConfig) {
    super(config)
    this.timeout = config.timeout ?? 120000 // default 120 seconds
  }

  async generateContent(prompt: string): Promise<AiResponse> {
    try {
      // AbortController를 사용한 타임아웃 구현
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 4096, // 프롬프트가 상세해서 응답도 길어질 수 있음
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `OpenAI API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`
        )
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''

      return {
        content,
        tokensUsed: data.usage?.total_tokens,
        model: this.config.model,
        provider: AiProvider.OPENAI,
      }
    } catch (error: any) {
      // 타임아웃 에러 처리 (AbortError) - 일시적 에러
      if (error.name === 'AbortError') {
        throw new ProductTransformationError(
          `AI 응답 대기 시간이 초과되었습니다 (${this.timeout / 1000}초). 잠시 후 다시 시도해주세요.`,
          TransformationErrorCode.AI_API_ERROR,
          { timeout: this.timeout },
          TransformationErrorType.TRANSIENT
        )
      }
      // 사용자 친화적 에러 메시지 처리
      const errorMsg = error.message || ''
      // 할당량/속도 제한 - 일시적 에러
      if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('rate')) {
        throw new ProductTransformationError(
          'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.',
          TransformationErrorCode.AI_API_ERROR,
          { originalError: error },
          TransformationErrorType.TRANSIENT
        )
      }
      // API 키 에러 - 영구적 에러
      if (errorMsg.includes('API key') || errorMsg.includes('401') || errorMsg.includes('Incorrect')) {
        throw new ProductTransformationError(
          'AI API 키가 유효하지 않습니다. 환경 설정에서 확인해주세요.',
          TransformationErrorCode.AI_API_ERROR,
          { originalError: error },
          TransformationErrorType.PERMANENT
        )
      }
      // 크레딧 부족 - 영구적 에러 (사용자가 결제해야 함)
      if (errorMsg.includes('insufficient_quota') || errorMsg.includes('billing')) {
        throw new ProductTransformationError(
          'API 크레딧이 부족합니다. 결제 정보를 확인해주세요.',
          TransformationErrorCode.AI_API_ERROR,
          { originalError: error },
          TransformationErrorType.PERMANENT
        )
      }
      // 기타 에러 - 영구적으로 분류
      throw new ProductTransformationError(
        `OpenAI API 오류: ${error.message}`,
        TransformationErrorCode.AI_API_ERROR,
        { originalError: error },
        TransformationErrorType.PERMANENT
      )
    }
  }
}

// =============================================
// CLIENT FACTORY
// =============================================

/**
 * Create an AI client based on provider
 *
 * @param config - AI client configuration
 * @returns Appropriate AI client instance
 *
 * @example
 * ```typescript
 * const client = createAiClient({
 *   provider: AiProvider.GEMINI,
 *   apiKey: 'your-api-key',
 *   model: 'gemini-2.5-flash',
 * })
 *
 * const response = await client.generateContent('Extract product info from...')
 * ```
 */
export function createAiClient(config: AiClientConfig): BaseAiClient {
  switch (config.provider) {
    case AiProvider.GEMINI:
      return new GeminiClient(config)

    case AiProvider.OPENAI:
      return new OpenAiClient(config)

    default:
      throw new ProductTransformationError(
        `Unsupported AI provider: ${config.provider}`,
        TransformationErrorCode.INVALID_INPUT
      )
  }
}
