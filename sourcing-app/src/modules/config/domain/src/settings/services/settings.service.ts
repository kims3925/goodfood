import { settingsRepository } from '../repository/settings.repository'
import type { ApiSettings, AiSettings, AiSettingsInput } from '../types/settings.types'

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
      configData.refreshToken = null
      configData.metadata = null
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
        maxTokens: 2048,
      },
      openai: {
        apiKey: '',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 2048,
      },
    }

    const geminiConfig = aiConfigs.find((c) => c.provider === 'GEMINI')
    if (geminiConfig) {
      const config = geminiConfig.config ? JSON.parse(geminiConfig.config) : {}
      settings.gemini = {
        apiKey: geminiConfig.apiKey || '',
        model: geminiConfig.model || 'gemini-2.5-flash',
        temperature: config?.temperature || 0.7,
        maxTokens: config?.maxTokens || 2048,
      }
    }

    const openaiConfig = aiConfigs.find((c) => c.provider === 'OPENAI')
    if (openaiConfig) {
      const config = openaiConfig.config ? JSON.parse(openaiConfig.config) : {}
      settings.openai = {
        apiKey: openaiConfig.apiKey || '',
        model: openaiConfig.model || 'gpt-4o-mini',
        temperature: config?.temperature || 0.7,
        maxTokens: config?.maxTokens || 2048,
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
        maxTokens: settings.maxTokens || 2048,
      }),
      isActive: true,
    }

    return settingsRepository.upsertAiConfig(userId, aiProvider, configData)
  }
}

export const settingsService = new SettingsService()
