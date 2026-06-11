/**
 * 밴드 세션 쿠키 컬럼 암호화 (SaaS P0-3, 2026-06-11)
 *
 * Channel.bandSessionCookie 에 저장되는 네이버/밴드 세션 쿠키를 AES-256-GCM 으로
 * 암호화한다. 키는 env BAND_COOKIE_ENC_KEY (64자 hex = 32바이트).
 *
 * 형식: "enc:v1:{iv b64}:{authTag b64}:{ciphertext b64}"
 * - prefix 가 없는 값은 레거시 평문으로 간주하고 그대로 반환 (점진 마이그레이션).
 *   기존 행 일괄 암호화: db/scripts/encrypt-session-cookies.cjs
 * - 키 미설정 시: 암호화 없이 평문 저장 (경고 1회) — 키 배포 전 동작 보존.
 *   키 설정 후에는 새로 저장되는 쿠키부터 자동 암호화된다.
 *
 * ⚠️ 키를 분실하면 암호화된 세션은 복구 불가 — 사용자가 세션을 재저장해야 한다.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const PREFIX = 'enc:v1:'
let warnedNoKey = false

function getKey(): Buffer | null {
  const hex = process.env.BAND_COOKIE_ENC_KEY
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    if (!warnedNoKey) {
      console.warn(
        '[BandCookieCrypto] BAND_COOKIE_ENC_KEY 미설정 또는 형식 오류(64자 hex 필요) — 세션 쿠키가 평문으로 저장됩니다 (P0-3 비활성). ' +
          '키 생성: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      )
      warnedNoKey = true
    }
    return null
  }
  return Buffer.from(hex, 'hex')
}

/** 저장 직전 호출 — 키가 있으면 암호화, 없으면 평문 그대로 */
export function encryptBandCookie(plain: string): string {
  if (!plain) return plain
  if (plain.startsWith(PREFIX)) return plain // 이미 암호화됨 (이중 암호화 방지)
  const key = getKey()
  if (!key) return plain
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

/**
 * 읽기 직후 호출 — enc:v1: prefix 면 복호화, 아니면 레거시 평문 그대로.
 * 복호화 실패(키 변경/손상) 시 null — 호출부는 "세션 없음"으로 처리해
 * 사용자에게 재저장을 유도한다 (조용한 깨진 쿠키 사용 방지).
 */
export function decryptBandCookie(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  if (!value.startsWith(PREFIX)) return value // 레거시 평문

  const key = getKey()
  if (!key) {
    console.error('[BandCookieCrypto] 암호화된 쿠키가 있는데 BAND_COOKIE_ENC_KEY 가 없습니다 — 세션 없음으로 처리')
    return null
  }
  try {
    const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch (e: any) {
    console.error('[BandCookieCrypto] 복호화 실패 (키 변경/데이터 손상?) — 세션 없음으로 처리:', e?.message)
    return null
  }
}

export function isEncryptedBandCookie(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX)
}
