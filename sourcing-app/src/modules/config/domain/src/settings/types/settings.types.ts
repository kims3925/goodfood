export interface ApiSettings {
  band: {
    clientId: string
    clientSecret: string
    accessToken: string
    refreshToken: string
    // 플랫폼 일괄설정 모드 — true 면 어드민 등록 공용 토큰 사용 (본인 토큰 입력 불필요)
    useGlobalToken: boolean
    // 어드민 공용 토큰이 등록되어 있는지 (UI 안내용 — 토큰 값 자체는 노출하지 않음)
    globalTokenConfigured: boolean
  }
  aliexpress: {
    apiKey: string
    appSecret: string
    accessToken: string
    trackingId: string
  }
}

export interface AiSettings {
  gemini: {
    apiKey: string
    model: string
    temperature: number
  }
  openai: {
    apiKey: string
    model: string
    temperature: number
  }
  claude?: {
    apiKey: string
    model: string
    temperature: number
  }
}

export interface BandApiSettingsInput {
  accessToken: string
}

export interface AliexpressApiSettingsInput {
  apiKey: string
  appSecret: string
  accessToken: string
  trackingId: string
}

export interface AiSettingsInput {
  apiKey: string
  model: string
  temperature?: number
}

export interface PromptConfig {
  promptType: string
  name: string
  prompt: string
  description?: string | null
  isActive: boolean
}

export interface PromptSettings {
  product_extraction: PromptConfig | null
}

export interface PromptConfigInput {
  name: string
  prompt: string
  description?: string | null
}

// Google Sheets 설정
export interface GoogleSheetSettings {
  spreadsheetId: string
  sheetName: string | null
  isActive: boolean
  hasServiceAccount: boolean
  lastSyncedAt: Date | null
}

export interface GoogleSheetSettingsInput {
  serviceAccountJson: string
  spreadsheetId: string
  sheetName?: string | null
}
