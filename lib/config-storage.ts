/**
 * 설정 파일 저장/로드 유틸리티
 * 추후 데이터베이스 연동 시 쉽게 교체 가능하도록 설계
 */

import fs from 'fs'
import path from 'path'

const CONFIG_DIR = path.join(process.cwd(), '.config')
const AI_SETTINGS_FILE = path.join(CONFIG_DIR, 'ai-settings.json')
const API_SETTINGS_FILE = path.join(CONFIG_DIR, 'api-settings.json')

export interface AISettings {
  provider: 'gemini' | 'openai'
  geminiApiKey: string
  openaiApiKey: string
  geminiModel: string
  openaiModel: string
  temperature: number
  maxTokens: number
  isValid?: boolean
  updatedAt?: string
}

/**
 * 기본 AI 설정
 */
const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini',
  geminiApiKey: '',
  openaiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  openaiModel: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 2048,
  isValid: false,
}

/**
 * 설정 디렉토리 생성
 */
function ensureConfigDirectory() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

/**
 * AI 설정 로드
 */
export function loadAISettings(): AISettings {
  try {
    ensureConfigDirectory()

    if (!fs.existsSync(AI_SETTINGS_FILE)) {
      // 파일이 없으면 기본값 반환
      return DEFAULT_AI_SETTINGS
    }

    const fileContent = fs.readFileSync(AI_SETTINGS_FILE, 'utf-8')
    const settings = JSON.parse(fileContent) as AISettings

    return {
      ...DEFAULT_AI_SETTINGS,
      ...settings,
    }
  } catch (error) {
    console.error('AI 설정 로드 실패:', error)
    return DEFAULT_AI_SETTINGS
  }
}

/**
 * AI 설정 저장
 */
export function saveAISettings(settings: Partial<AISettings>): boolean {
  try {
    ensureConfigDirectory()

    // 기존 설정 로드
    const currentSettings = loadAISettings()

    // 새 설정과 병합
    const updatedSettings: AISettings = {
      ...currentSettings,
      ...settings,
      updatedAt: new Date().toISOString(),
    }

    // 파일에 저장
    fs.writeFileSync(
      AI_SETTINGS_FILE,
      JSON.stringify(updatedSettings, null, 2),
      'utf-8'
    )

    console.log('✅ AI 설정 저장 완료:', AI_SETTINGS_FILE)
    return true
  } catch (error) {
    console.error('❌ AI 설정 저장 실패:', error)
    return false
  }
}

/**
 * AI 설정 삭제
 */
export function deleteAISettings(): boolean {
  try {
    if (fs.existsSync(AI_SETTINGS_FILE)) {
      fs.unlinkSync(AI_SETTINGS_FILE)
      console.log('✅ AI 설정 삭제 완료')
      return true
    }
    return false
  } catch (error) {
    console.error('❌ AI 설정 삭제 실패:', error)
    return false
  }
}

/**
 * 설정 파일 존재 여부 확인
 */
export function hasAISettings(): boolean {
  return fs.existsSync(AI_SETTINGS_FILE)
}

// ====================================
// API 설정 (Band, AliExpress, etc.)
// ====================================

export interface APISettings {
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
  taobao?: {
    apiKey: string
    appSecret: string
  }
  coupang?: {
    accessKey: string
    secretKey: string
  }
  mall1688?: {
    apiKey: string
    appSecret: string
  }
  updatedAt?: string
}

/**
 * 민감 정보 마스킹 함수
 */
function maskSensitiveValue(value: string): string {
  if (!value || value.length === 0) return ''
  if (value.length <= 8) return '***'
  return `${value.slice(0, 4)}***${value.slice(-2)}`
}

/**
 * API 설정 마스킹 (로깅용)
 */
function maskAPISettings(settings: Partial<APISettings>): any {
  const masked: any = {}

  if (settings.band) {
    masked.band = {
      clientId: maskSensitiveValue(settings.band.clientId || ''),
      clientSecret: settings.band.clientSecret ? '***' : '',
      accessToken: settings.band.accessToken ? '***' : '',
      refreshToken: settings.band.refreshToken ? '***' : ''
    }
  }

  if (settings.aliexpress) {
    masked.aliexpress = {
      apiKey: maskSensitiveValue(settings.aliexpress.apiKey || ''),
      appSecret: settings.aliexpress.appSecret ? '***' : '',
      accessToken: settings.aliexpress.accessToken ? '***' : '',
      trackingId: maskSensitiveValue(settings.aliexpress.trackingId || '')
    }
  }

  if (settings.taobao) {
    masked.taobao = {
      apiKey: maskSensitiveValue(settings.taobao.apiKey || ''),
      appSecret: settings.taobao.appSecret ? '***' : ''
    }
  }

  if (settings.coupang) {
    masked.coupang = {
      accessKey: maskSensitiveValue(settings.coupang.accessKey || ''),
      secretKey: settings.coupang.secretKey ? '***' : ''
    }
  }

  if (settings.mall1688) {
    masked.mall1688 = {
      apiKey: maskSensitiveValue(settings.mall1688.apiKey || ''),
      appSecret: settings.mall1688.appSecret ? '***' : ''
    }
  }

  return masked
}

/**
 * 기본 API 설정
 */
const DEFAULT_API_SETTINGS: APISettings = {
  band: {
    clientId: '',
    clientSecret: '',
    accessToken: '',
    refreshToken: ''
  },
  aliexpress: {
    apiKey: '',
    appSecret: '',
    accessToken: '',
    trackingId: ''
  }
}

/**
 * API 설정 로드
 */
export function loadAPISettings(): APISettings {
  try {
    ensureConfigDirectory()

    if (!fs.existsSync(API_SETTINGS_FILE)) {
      return DEFAULT_API_SETTINGS
    }

    const fileContent = fs.readFileSync(API_SETTINGS_FILE, 'utf-8')
    const settings = JSON.parse(fileContent) as APISettings

    return {
      ...DEFAULT_API_SETTINGS,
      ...settings,
    }
  } catch (error) {
    console.error('API 설정 로드 실패:', error)
    return DEFAULT_API_SETTINGS
  }
}

/**
 * API 설정 저장
 */
export function saveAPISettings(settings: Partial<APISettings>): boolean {
  try {
    ensureConfigDirectory()

    const currentSettings = loadAPISettings()

    const updatedSettings: APISettings = {
      ...currentSettings,
      ...settings,
      updatedAt: new Date().toISOString(),
    }

    fs.writeFileSync(
      API_SETTINGS_FILE,
      JSON.stringify(updatedSettings, null, 2),
      'utf-8'
    )

    // 마스킹된 정보 로그 출력 (보안)
    console.log('✅ API 설정 저장 완료:', maskAPISettings(updatedSettings))
    return true
  } catch (error) {
    console.error('❌ API 설정 저장 실패:', error)
    return false
  }
}

/**
 * API 설정 삭제
 */
export function deleteAPISettings(): boolean {
  try {
    if (fs.existsSync(API_SETTINGS_FILE)) {
      fs.unlinkSync(API_SETTINGS_FILE)
      console.log('✅ API 설정 삭제 완료')
      return true
    }
    return false
  } catch (error) {
    console.error('❌ API 설정 삭제 실패:', error)
    return false
  }
}

/**
 * API 설정 파일 존재 여부 확인
 */
export function hasAPISettings(): boolean {
  return fs.existsSync(API_SETTINGS_FILE)
}
