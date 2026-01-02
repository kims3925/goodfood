// 세션 만료 에러 메시지 패턴
export const SESSION_EXPIRED_PATTERNS = [
  '세션이 없거나 만료',
  '세션 만료',
  '밴드 로그인',
  '세션을 다시 저장',
] as const

/**
 * 에러 메시지가 세션 만료를 나타내는지 확인
 */
export function isSessionExpiredError(error: string | undefined): boolean {
  if (!error) return false
  return SESSION_EXPIRED_PATTERNS.some(pattern => error.includes(pattern))
}