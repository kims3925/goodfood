/**
 * Lite Manager 개인정보 마스킹 유틸
 * 셀러는 구매자 정보를 식별 가능한 수준만 보면 된다.
 * 풀 매니저(Pro)는 별도 권한 — Lite는 마스킹 강제.
 */

/**
 * 이름 마스킹
 * - "홍길동" → "홍**"
 * - "Kim Sang Kook" → "K***"
 * - "김" → "김"
 * - 빈 값 → "익명"
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return '익명'
  const trimmed = name.trim()
  if (trimmed.length === 0) return '익명'
  if (trimmed.length === 1) return trimmed
  const first = trimmed[0]
  const restLen = trimmed.length - 1
  return first + '*'.repeat(Math.min(restLen, 3))
}

/**
 * 전화번호 마스킹 — 끝 4자리만 표시
 * - "010-1234-5678" → "***-****-5678"
 * - "01012345678"   → "*******5678"
 * - 4자리 미만        → "****"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '****'
  const trimmed = phone.trim()
  if (trimmed.length < 4) return '****'
  // 마지막 4자리 추출, 그 외는 마스킹 패턴 유지
  const last4 = trimmed.slice(-4)
  // 하이픈 보존: 010-1234-5678 같은 포맷
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-')
    if (parts.length >= 3) {
      return parts.slice(0, -1).map((p) => '*'.repeat(p.length)).join('-') + '-' + last4
    }
  }
  return '*'.repeat(trimmed.length - 4) + last4
}

/**
 * 이메일 마스킹 — 로컬부 첫글자만
 * - "user@example.com" → "u***@example.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return ''
  const at = email.indexOf('@')
  if (at <= 0) return email
  const local = email.slice(0, at)
  const domain = email.slice(at)
  if (local.length <= 1) return local + domain
  return local[0] + '*'.repeat(Math.min(local.length - 1, 3)) + domain
}

/**
 * 주소 마스킹 — 시/구 단위까지만
 * - "서울 강남구 역삼동 123-45 101호" → "서울 강남구 ***"
 */
export function maskAddress(address: string | null | undefined): string {
  if (!address) return ''
  const tokens = address.trim().split(/\s+/)
  if (tokens.length <= 2) return address
  return tokens.slice(0, 2).join(' ') + ' ***'
}
