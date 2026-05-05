/**
 * 사용자 트랙 (User.mode) 정의 — Lite Manager v3 (2026-05-05)
 *
 * - 'pro': 풀 매니저 (소싱~발행~주문 전체 자동화)
 * - 'lite': 쇼핑몰 전용 — 어드민이 매일 가공상품 자동 등록
 * - 'lite_band': lite + 본인 Band 채널에 자동 발행 (밴드 운영 셀러용)
 *
 * 각 모드는 사이드바 메뉴/auto-publish 동작/권한이 달라짐.
 */

export const USER_MODES = ['pro', 'lite', 'lite_band'] as const
export type UserMode = (typeof USER_MODES)[number]

export const USER_MODE_LABELS: Record<UserMode, string> = {
  pro: '🚀 Pro',
  lite: '✨ Lite (쇼핑몰)',
  lite_band: '📡 Lite Band',
}

export const USER_MODE_DESCRIPTIONS: Record<UserMode, string> = {
  pro: '풀 매니저 — 소싱·발행·주문 자동화',
  lite: '쇼핑몰만 — 어드민 자동 등록',
  lite_band: '쇼핑몰 + 본인 Band 자동 발행',
}

export function isValidUserMode(v: unknown): v is UserMode {
  return typeof v === 'string' && (USER_MODES as readonly string[]).includes(v)
}

export function isLiteMode(mode: string): boolean {
  return mode === 'lite' || mode === 'lite_band'
}

export function hasBandPublish(mode: string): boolean {
  return mode === 'pro' || mode === 'lite_band'
}
