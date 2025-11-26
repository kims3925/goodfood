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
      const text = response.text()

      return {
        content: text,
        tokensUsed: response.usageMetadata?.totalTokenCount,
        model: this.config.model,
        provider: AiProvider.GEMINI,
      }
    } catch (error: any) {
      throw new ProductTransformationError(
        `Gemini API Error: ${error.message}`,
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
      throw new ProductTransformationError(
        `OpenAI API Error: ${error.message}`,
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
