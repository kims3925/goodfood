/**
 * 주문 데이터 HMAC 서명 유틸 (Phase 4 — 작업지침서)
 *
 * /api/orders/prepare 가 쿠키에 저장하는 주문 데이터의 무결성 보장.
 * 클라이언트가 totalAmount 등 변조해도 confirm 단계에서 검증 실패로 차단.
 *
 * 환경변수:
 *   ORDER_HMAC_SECRET (없으면 NEXTAUTH_SECRET 폴백, 그것도 없으면 dev fallback)
 */

import crypto from 'crypto'

const SECRET_KEY =
  process.env.ORDER_HMAC_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'dev-only-fallback-key-replace-in-production'

/**
 * 주문 데이터를 서명하여 쿠키 저장 가능한 문자열로 반환.
 * 형식: `${base64url(payload)}.${hmac-sha256(payload)}`
 */
export function signOrderData(data: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payload)
    .digest('base64url')
  return `${payload}.${signature}`
}

/**
 * 서명된 주문 데이터를 검증 + 파싱.
 * @returns 파싱된 데이터 (서명 검증 실패 또는 형식 오류 시 null)
 */
export function verifyOrderData<T = Record<string, unknown>>(
  signed: string
): T | null {
  if (!signed || typeof signed !== 'string') return null
  const parts = signed.split('.')
  if (parts.length !== 2) return null

  const [payload, signature] = parts
  const expectedSig = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payload)
    .digest('base64url')

  // timing-safe 비교
  let sigBuf: Buffer
  let expBuf: Buffer
  try {
    sigBuf = Buffer.from(signature, 'base64url')
    expBuf = Buffer.from(expectedSig, 'base64url')
  } catch {
    return null
  }
  if (sigBuf.length !== expBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.error('[order-signature] HMAC 검증 실패 — 변조 가능성')
    return null
  }

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8')
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
