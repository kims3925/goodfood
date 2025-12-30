import { settingsRepository } from '../repository/settings.repository'
import type { ApiSettings, AiSettings, AiSettingsInput, PromptSettings, PromptConfigInput, PromptConfig } from '../types/settings.types'

export class SettingsService {
  // API 설정 조회
  async getApiSettings(userId: number): Promise<ApiSettings> {
    const configs = await settingsRepository.findApiConfigs(userId)

    const settings: ApiSettings = {
      band: {
        clientId: '',
        clientSecret: '',
        accessToken: '',
        refreshToken: '',
      },
      aliexpress: {
        apiKey: '',
        appSecret: '',
        accessToken: '',
        trackingId: '',
      },
    }

    const bandConfig = configs.find((c) => c.platform === 'BAND')
    if (bandConfig) {
      settings.band = {
        clientId: '',
        clientSecret: '',
        accessToken: bandConfig.accessToken || '',
        refreshToken: '',
      }
    }

    const aliexpressConfig = configs.find((c) => c.platform === 'ALIEXPRESS')
    if (aliexpressConfig) {
      let metadata: any = {}
      try {
        metadata = aliexpressConfig.metadata ? JSON.parse(aliexpressConfig.metadata) : {}
      } catch {
        metadata = {}
      }
      settings.aliexpress = {
        apiKey: aliexpressConfig.apiKey || '',
        appSecret: metadata?.appSecret || '',
        accessToken: aliexpressConfig.accessToken || '',
        trackingId: metadata?.trackingId || '',
      }
    }

    return settings
  }

  // API 설정 저장
  async saveApiSettings(userId: number, provider: string, settings: any) {
    const platformMap: Record<string, string> = {
      band: 'BAND',
      aliexpress: 'ALIEXPRESS',
    }

    const platform = platformMap[provider]
    if (!platform) {
      throw new Error('지원하지 않는 플랫폼입니다.')
    }

    const configData: any = {
      isActive: true,
    }

    if (provider === 'band') {
      configData.accessToken = settings.accessToken || null
      configData.refreshToken = settings.refreshToken || null
      // OAuth 메타데이터 저장 (만료시간 등)
      if (settings.expiresIn || settings.tokenType) {
        configData.metadata = JSON.stringify({
          expiresIn: settings.expiresIn || null,
          tokenType: settings.tokenType || 'Bearer',
          updatedAt: new Date().toISOString(),
        })
      } else {
        configData.metadata = null
      }
    } else if (provider === 'aliexpress') {
      configData.apiKey = settings.apiKey || null
      configData.accessToken = settings.accessToken || null
      configData.metadata = JSON.stringify({
        appSecret: settings.appSecret || null,
        trackingId: settings.trackingId || null,
      })
    }

    return settingsRepository.upsertApiConfig(userId, platform, configData)
  }

  // AI 설정 조회
  async getAiSettings(userId: number): Promise<AiSettings> {
    const aiConfigs = await settingsRepository.findAiConfigs(userId)

    const settings: AiSettings = {
      gemini: {
        apiKey: '',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
      },
      openai: {
        apiKey: '',
        model: 'gpt-4o-mini',
        temperature: 0.7,
      },
    }

    const geminiConfig = aiConfigs.find((c) => c.provider === 'GEMINI')
    if (geminiConfig) {
      let config: any = {}
      try {
        config = geminiConfig.config ? JSON.parse(geminiConfig.config) : {}
      } catch {
        config = {}
      }
      settings.gemini = {
        apiKey: geminiConfig.apiKey || '',
        model: geminiConfig.model || 'gemini-2.5-flash',
        temperature: config?.temperature || 0.7,
      }
    }

    const openaiConfig = aiConfigs.find((c) => c.provider === 'OPENAI')
    if (openaiConfig) {
      let config: any = {}
      try {
        config = openaiConfig.config ? JSON.parse(openaiConfig.config) : {}
      } catch {
        config = {}
      }
      settings.openai = {
        apiKey: openaiConfig.apiKey || '',
        model: openaiConfig.model || 'gpt-4o-mini',
        temperature: config?.temperature || 0.7,
      }
    }

    return settings
  }

  // AI 설정 저장
  async saveAiSettings(userId: number, provider: string, settings: AiSettingsInput) {
    const aiProviderMap: Record<string, string> = {
      gemini: 'GEMINI',
      openai: 'OPENAI',
    }

    const aiProvider = aiProviderMap[provider]
    if (!aiProvider) {
      throw new Error('지원하지 않는 AI 제공업체입니다.')
    }

    const configData = {
      apiKey: settings.apiKey,
      model: settings.model,
      config: JSON.stringify({
        temperature: settings.temperature || 0.7,
      }),
      isActive: true,
    }

    return settingsRepository.upsertAiConfig(userId, aiProvider, configData)
  }

  // 프롬프트 설정 조회
  async getPromptSettings(userId: number): Promise<PromptSettings> {
    const promptConfigs = await settingsRepository.findPromptConfigs(userId)

    const settings: PromptSettings = {
      product_extraction: null,
    }

    const extractionConfig = promptConfigs.find((c) => c.promptType === 'product_extraction')
    if (extractionConfig) {
      settings.product_extraction = {
        promptType: extractionConfig.promptType,
        name: extractionConfig.name,
        prompt: extractionConfig.prompt,
        description: extractionConfig.description,
        isActive: extractionConfig.isActive,
      }
    }

    return settings
  }

  // 특정 프롬프트 타입으로 조회 (변환 시 사용)
  async getPromptByType(userId: number, promptType: string): Promise<PromptConfig | null> {
    const config = await settingsRepository.findPromptConfigByType(userId, promptType)
    if (!config || !config.isActive) {
      return null
    }
    return {
      promptType: config.promptType,
      name: config.name,
      prompt: config.prompt,
      description: config.description,
      isActive: config.isActive,
    }
  }

  // 프롬프트 설정 저장
  async savePromptSettings(userId: number, promptType: string, settings: PromptConfigInput) {
    const validTypes = ['product_extraction']
    if (!validTypes.includes(promptType)) {
      throw new Error('지원하지 않는 프롬프트 타입입니다.')
    }

    return settingsRepository.upsertPromptConfig(userId, promptType, {
      name: settings.name,
      prompt: settings.prompt,
      description: settings.description || null,
      isActive: true,
    })
  }

  // 프롬프트 설정 삭제 (기본값 사용으로 복구)
  async deletePromptSettings(userId: number, promptType: string) {
    return settingsRepository.deletePromptConfig(userId, promptType)
  }
}

export const settingsService = new SettingsService()
