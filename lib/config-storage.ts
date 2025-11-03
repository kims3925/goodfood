/**
 * 설정 파일 저장/로드 유틸리티
 * 추후 데이터베이스 연동 시 쉽게 교체 가능하도록 설계
 */

import fs from 'fs'
import path from 'path'

const CONFIG_DIR = path.join(process.cwd(), '.config')
const AI_SETTINGS_FILE = path.join(CONFIG_DIR, 'ai-settings.json')

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
