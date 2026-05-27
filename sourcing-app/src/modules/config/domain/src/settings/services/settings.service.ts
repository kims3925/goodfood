import { settingsRepository } from '../repository/settings.repository'
import type { ApiSettings, AiSettings, AiSettingsInput, PromptSettings, PromptConfigInput, PromptConfig, GoogleSheetSettings, GoogleSheetSettingsInput } from '../types/settings.types'

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
      // 토큰 자동 갱신용 절대 만료시각 (expiresIn[초] → now + expiresIn).
      // refreshBandTokenIfNeeded 가 이 값으로 만료 임박을 판단. expiresIn 없으면 null(자동갱신 비활성).
      configData.tokenExpiry = settings.expiresIn
        ? new Date(Date.now() + Number(settings.expiresIn) * 1000)
        : null
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
      claude: {
        apiKey: '',
        model: 'claude-haiku-4-5-20251001',
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

    const claudeConfig = aiConfigs.find((c) => c.provider === 'CLAUDE')
    if (claudeConfig) {
      let config: any = {}
      try {
        config = claudeConfig.config ? JSON.parse(claudeConfig.config) : {}
      } catch {
        config = {}
      }
      settings.claude = {
        apiKey: claudeConfig.apiKey || '',
        model: claudeConfig.model || 'claude-haiku-4-5-20251001',
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
      claude: 'CLAUDE',
    }

    const aiProvider = aiProviderMap[provider]
    if (!aiProvider) {
      throw new Error('지원하지 않는 AI 제공업체입니다.')
    }

    // apiKey는 복붙 시 앞뒤 공백/개행이 섞이는 일이 잦다. 저장 시점에 정규화해
    // 런타임에서 "API 키가 설정되지 않았습니다" 같은 오해 에러 방지.
    const configData = {
      apiKey: (settings.apiKey || '').trim(),
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

  // Google Sheets 설정 조회
  async getGoogleSheetSettings(userId: number): Promise<GoogleSheetSettings | null> {
    const config = await settingsRepository.findGoogleSheetConfig(userId)

    if (!config) {
      return null
    }

    return {
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      isActive: config.isActive,
      hasServiceAccount: !!config.serviceAccountJson,
      lastSyncedAt: config.lastSyncedAt,
    }
  }

  // Google Sheets 설정 저장
  async saveGoogleSheetSettings(userId: number, settings: GoogleSheetSettingsInput) {
    // JSON 형식 검증
    try {
      const parsed = JSON.parse(settings.serviceAccountJson)
      if (!parsed.client_email || !parsed.private_key) {
        throw new Error('유효하지 않은 서비스 계정 JSON입니다. client_email과 private_key가 필요합니다.')
      }
    } catch (e: any) {
      if (e.message.includes('client_email') || e.message.includes('private_key')) {
        throw e
      }
      throw new Error('유효하지 않은 JSON 형식입니다.')
    }

    // 스프레드시트 ID 추출 (URL이 입력된 경우)
    let spreadsheetId = settings.spreadsheetId
    const urlMatch = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (urlMatch) {
      spreadsheetId = urlMatch[1]
    }

    return settingsRepository.upsertGoogleSheetConfig(userId, {
      serviceAccountJson: settings.serviceAccountJson,
      spreadsheetId,
      sheetName: settings.sheetName || null,
      isActive: true,
    })
  }

  // Google Sheets 설정 삭제
  async deleteGoogleSheetSettings(userId: number) {
    return settingsRepository.deleteGoogleSheetConfig(userId)
  }

  // Google Sheets 서비스 계정 JSON 조회 (내부용)
  async getGoogleSheetServiceAccount(userId: number): Promise<string | null> {
    const config = await settingsRepository.findGoogleSheetConfig(userId)
    return config?.serviceAccountJson || null
  }

  // Google Sheets 마지막 동기화 시간 업데이트
  async updateGoogleSheetLastSynced(userId: number) {
    return settingsRepository.updateGoogleSheetLastSynced(userId)
  }
}

export const settingsService = new SettingsService()
