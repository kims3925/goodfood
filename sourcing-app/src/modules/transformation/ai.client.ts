/**
 * AI Client Abstraction
 *
 * Provides a unified interface for different AI providers (Gemini, OpenAI)
 */

import { AiProvider } from '@bandauto/db'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ProductTransformationError, TransformationErrorCode } from './product.types'

// =============================================
// AI CLIENT INTERFACE
// =============================================

export interface AiClientConfig {
  provider: AiProvider
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface AiResponse {
  content: string
  tokensUsed?: number
  model: string
  provider: AiProvider
}

export abstract class BaseAiClient {
  constructor(protected config: AiClientConfig) {}

  abstract generateContent(prompt: string): Promise<AiResponse>
}

// =============================================
// GEMINI CLIENT
// =============================================

export class GeminiClient extends BaseAiClient {
  private client: GoogleGenerativeAI

  constructor(config: AiClientConfig) {
    super(config)
    this.client = new GoogleGenerativeAI(config.apiKey)
  }

  async generateContent(prompt: string): Promise<AiResponse> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.config.model || 'gemini-2.5-flash',
      })

      const generationConfig = {
        temperature: this.config.temperature ?? 0.7,
        maxOutputTokens: this.config.maxTokens ?? 2048,
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      })

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
      // 토큰 관련 에러 처리
      const errorMsg = error.message || ''
      if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('token')) {
        throw new ProductTransformationError(
          'API 할당량이 초과되었습니다. 잠시 후 다시 시도하거나 AI 설정을 확인해주세요.',
          TransformationErrorCode.AI_API_ERROR,
          { originalError: error }
        )
      }
      if (errorMsg.includes('API key') || errorMsg.includes('authentication') || errorMsg.includes('401')) {
        throw new ProductTransformationError(
          'AI API 키가 유효하지 않습니다. 환경 설정에서 API 키를 확인해주세요.',
          TransformationErrorCode.AI_API_ERROR,
          { originalError: error }
        )
      }
      throw new ProductTransformationError(
        `Gemini API 오류: ${error.message}`,
        TransformationErrorCode.AI_API_ERROR,
        { originalError: error }
      )
    }
  }
}

// =============================================
// OPENAI CLIENT
// =============================================

export class OpenAiClient extends BaseAiClient {
  async generateContent(prompt: string): Promise<AiResponse> {
    try {
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
          max_tokens: this.config.maxTokens ?? 2048,
        }),
      })

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
      // 사용자 친화적 에러 메시지 처리
      const errorMsg = error.message || ''
      if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('rate')) {
        throw new ProductTransformationError(
          'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.',
          TransformationErrorCode.AI_API_ERROR,
          { originalError: error }
        )
      }
      if (errorMsg.includes('API key') || errorMsg.includes('401') || errorMsg.includes('Incorrect')) {
        throw new ProductTransformationError(
          'AI API 키가 유효하지 않습니다. 환경 설정에서 확인해주세요.',
          TransformationErrorCode.AI_API_ERROR,
          { originalError: error }
        )
      }
      if (errorMsg.includes('insufficient_quota') || errorMsg.includes('billing')) {
        throw new ProductTransformationError(
          'API 크레딧이 부족합니다. 결제 정보를 확인해주세요.',
          TransformationErrorCode.AI_API_ERROR,
          { originalError: error }
        )
      }
      throw new ProductTransformationError(
        `OpenAI API 오류: ${error.message}`,
        TransformationErrorCode.AI_API_ERROR,
        { originalError: error }
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
