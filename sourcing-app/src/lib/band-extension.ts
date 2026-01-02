/**
 * Band Session Helper Extension 통신 모듈
 * Chrome Extension과 웹 앱 간의 통신을 담당
 */

// Chrome Extension API 타입 선언
declare const chrome: {
  runtime?: {
    sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void
    lastError?: { message: string }
  }
} | undefined

// Extension ID (Chrome Extension 설치 후 확인 필요)
// chrome://extensions 에서 "Band Session Helper" ID 확인
const EXTENSION_ID = process.env.NEXT_PUBLIC_BAND_EXTENSION_ID || ''

interface ExtensionResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  version?: string
}

interface SessionStatus {
  bandLoggedIn: boolean
  appLoggedIn: boolean
  lastSaveTime: number | null
}

interface SaveResult {
  channelCount: number
  savedAt: string
}

/**
 * Extension 설치 여부 확인
 */
export async function checkExtensionInstalled(): Promise<boolean> {
  if (!EXTENSION_ID || typeof chrome === 'undefined' || !chrome.runtime) {
    return false
  }

  try {
    const response = await sendMessage<ExtensionResponse>({ action: 'ping' })
    return response?.success === true
  } catch {
    return false
  }
}

/**
 * Extension에 메시지 전송
 */
async function sendMessage<T>(message: { action: string; [key: string]: unknown }): Promise<T | null> {
  if (!EXTENSION_ID) {
    console.warn('[BandExtension] Extension ID가 설정되지 않았습니다.')
    return null
  }

  if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
    console.warn('[BandExtension] Chrome Extension API를 사용할 수 없습니다.')
    return null
  }

  const runtime = chrome.runtime

  return new Promise((resolve) => {
    try {
      runtime.sendMessage(EXTENSION_ID, message, (response: unknown) => {
        if (runtime.lastError) {
          console.error('[BandExtension] 메시지 전송 실패:', runtime.lastError.message)
          resolve(null)
        } else {
          resolve(response as T)
        }
      })
    } catch (error) {
      console.error('[BandExtension] 예외 발생:', error)
      resolve(null)
    }
  })
}

/**
 * Extension 상태 조회
 */
export async function getExtensionStatus(): Promise<SessionStatus | null> {
  const response = await sendMessage<ExtensionResponse<SessionStatus>>({ action: 'getStatus' })

  if (response?.success && response.data) {
    return response.data
  }

  return null
}

/**
 * Extension을 통해 세션 저장
 */
export async function saveSessionViaExtension(): Promise<{ success: boolean; data?: SaveResult; error?: string }> {
  const response = await sendMessage<ExtensionResponse<SaveResult>>({ action: 'saveSession' })

  if (!response) {
    return {
      success: false,
      error: 'Extension과 통신할 수 없습니다. Extension이 설치되어 있는지 확인해주세요.',
    }
  }

  if (response.success && response.data) {
    return {
      success: true,
      data: response.data,
    }
  }

  return {
    success: false,
    error: response.error || '세션 저장에 실패했습니다.',
  }
}

/**
 * Extension 버전 조회
 */
export async function getExtensionVersion(): Promise<string | null> {
  const response = await sendMessage<ExtensionResponse>({ action: 'ping' })
  return response?.version || null
}
