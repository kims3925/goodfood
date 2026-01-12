export interface ApiSettings {
  band: {
    clientId: string
    clientSecret: string
    accessToken: string
    refreshToken: string
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
