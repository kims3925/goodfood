/**
 * Band OAuth 토큰 자동 갱신 (개발계획서 Phase 1-3 / 1-4)
 *
 * 설계 원칙 — "절대 작동 중인 토큰을 망가뜨리지 않는다":
 *  - tokenExpiry 가 설정돼 있고 + refresh_token 이 있으며 + 만료 10분 이내일 때만 갱신 시도.
 *    (현재 운영 토큰처럼 tokenExpiry=NULL 이면 완전 no-op → 기존 동작 불변.)
 *  - Band refresh 응답에 access_token 이 있는 "성공"일 때만 DB 토큰을 덮어쓴다.
 *    실패/예외 시 기존 토큰을 그대로 유지(덮어쓰지 않음) → 수집/발행 중단 방지.
 *
 * Band OAuth 토큰 엔드포인트는 authorization_code 교환과 동일:
 *   POST https://auth.band.us/oauth2/token  (grant_type=refresh_token)
 */

import prisma from '@bandauto/db'

const BAND_TOKEN_URL = 'https://auth.band.us/oauth2/token'
// 만료 10분 전부터 갱신 (개발계획서 1-3)
const REFRESH_THRESHOLD_MS = 10 * 60 * 1000

export interface RefreshResult {
  refreshed: boolean
  reason?: string
}

/**
 * refresh_token 으로 Band access_token 을 갱신한다.
 * 성공(응답에 access_token 존재) 시에만 DB 를 갱신하고, 그 외에는 기존 토큰을 보존한다.
 */
export async function refreshBandToken(userId: number): Promise<RefreshResult> {
  const cfg = await prisma.sourcingApiConfig.findFirst({
    where: { userId, platform: 'BAND', isActive: true },
    select: { id: true, refreshToken: true },
  })
  if (!cfg?.refreshToken) {
    return { refreshed: false, reason: 'no_refresh_token' }
  }

  const clientId = process.env.BAND_CLIENT_ID
  const clientSecret = process.env.BAND_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return { refreshed: false, reason: 'no_client_credentials' }
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: cfg.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })

    const res = await fetch(BAND_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data: any = await res.json().catch(() => ({}))

    // 성공 응답에 access_token 이 있을 때만 덮어쓴다 (작동 중인 토큰 보호).
    if (!res.ok || !data?.access_token) {
      console.error(
        `[BandToken] userId=${userId} 토큰 갱신 실패 — 기존 토큰 유지:`,
        data?.error_description || data?.error || `HTTP ${res.status}`
      )
      return { refreshed: false, reason: 'refresh_failed' }
    }

    await prisma.sourcingApiConfig.update({
      where: { id: cfg.id },
      data: {
        accessToken: data.access_token,
        // 새 refresh_token 이 오면 교체, 없으면 기존 유지
        refreshToken: data.refresh_token || cfg.refreshToken,
        tokenExpiry: data.expires_in
          ? new Date(Date.now() + Number(data.expires_in) * 1000)
          : null,
      },
    })
    console.log(`[BandToken] userId=${userId} access_token 갱신 완료`)
    return { refreshed: true }
  } catch (error: any) {
    console.error(`[BandToken] userId=${userId} 토큰 갱신 예외 — 기존 토큰 유지:`, error?.message)
    return { refreshed: false, reason: 'exception' }
  }
}

/**
 * 만료가 임박(10분 이내)하고 refresh_token 이 있을 때만 갱신한다.
 * 그 외(만료시각 미설정/여유 충분/리프레시 없음)에는 아무것도 하지 않는다 → 안전.
 *
 * 수집/발행 등 Band API 사용 직전에 호출하면, 토큰이 만료되기 전에 자동으로 갱신된다.
 */
export async function refreshBandTokenIfNeeded(userId: number): Promise<void> {
  const cfg = await prisma.sourcingApiConfig.findFirst({
    where: { userId, platform: 'BAND', isActive: true },
    select: { tokenExpiry: true, refreshToken: true },
  })
  // tokenExpiry 가 없으면(현재 운영 토큰 대부분) 만료 판단 불가 → no-op (기존 동작 유지).
  if (!cfg?.tokenExpiry || !cfg.refreshToken) return

  const msLeft = new Date(cfg.tokenExpiry).getTime() - Date.now()
  if (msLeft > REFRESH_THRESHOLD_MS) return // 아직 여유 있음 → no-op

  await refreshBandToken(userId)
}
