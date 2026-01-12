/**
 * 경로 설정 유틸리티
 *
 * 환경변수로 설정 가능하며, 배포 환경에서 유연하게 경로를 지정할 수 있습니다.
 *
 * 환경변수:
 * - SHOP_SETTINGS_PATH: shop-app 설정 파일 경로 (예: /app/shop-app/data/shop-settings.json)
 * - EXTENSION_PATH: band-session-extension 폴더 경로 (예: /app/band-session-extension)
 */

import fs from 'fs'
import path from 'path'

/**
 * shop-app 설정 파일 경로를 반환합니다.
 *
 * 우선순위:
 * 1. SHOP_SETTINGS_PATH 환경변수
 * 2. 로컬 개발용 상대 경로 (process.cwd()/../shop-app/data/shop-settings.json)
 */
export function getShopSettingsPath(): string {
  // 환경변수 우선
  if (process.env.SHOP_SETTINGS_PATH) {
    return process.env.SHOP_SETTINGS_PATH
  }

  // 로컬 개발용 기본값
  return path.join(process.cwd(), '..', 'shop-app', 'data', 'shop-settings.json')
}

/**
 * shop-app 설정 파일을 읽습니다.
 * 파일이 없거나 읽기 실패 시 null을 반환합니다.
 */
export function readShopSettings(): Record<string, unknown> | null {
  const settingsPath = getShopSettingsPath()

  try {
    if (!fs.existsSync(settingsPath)) {
      console.warn(`[paths] shop-settings.json 파일 없음: ${settingsPath}`)
      return null
    }

    const fileContent = fs.readFileSync(settingsPath, 'utf-8')
    const settings = JSON.parse(fileContent)
    console.log(`[paths] shop-settings.json 로드 성공: ${settingsPath}`)
    return settings
  } catch (error) {
    console.error(`[paths] shop-settings.json 읽기 실패: ${settingsPath}`, error)
    return null
  }
}

/**
 * band-session-extension 폴더 경로를 반환합니다.
 *
 * 우선순위:
 * 1. EXTENSION_PATH 환경변수
 * 2. 로컬 개발용 상대 경로 (process.cwd()/../band-session-extension)
 */
export function getExtensionPath(): string {
  // 환경변수 우선
  if (process.env.EXTENSION_PATH) {
    return process.env.EXTENSION_PATH
  }

  // 로컬 개발용 기본값
  return path.join(process.cwd(), '..', 'band-session-extension')
}

/**
 * band-session-extension 폴더 존재 여부를 확인합니다.
 */
export function checkExtensionPath(): { exists: boolean; path: string } {
  const extensionPath = getExtensionPath()
  const exists = fs.existsSync(extensionPath)

  if (!exists) {
    console.warn(`[paths] band-session-extension 폴더 없음: ${extensionPath}`)
  }

  return { exists, path: extensionPath }
}
