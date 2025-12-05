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
    maxTokens: number
  }
  openai: {
    apiKey: string
    model: string
    temperature: number
    maxTokens: number
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
  maxTokens?: number
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
