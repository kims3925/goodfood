/**
 * POST /api/v1/oauth/token — OAuth2 client_credentials (STEP 4-2, 카페24 호환)
 *
 * 요청: Authorization: Basic base64(clientId:clientSecret)
 *      body(form 또는 JSON): grant_type=client_credentials
 * 응답: { access_token, token_type: "Bearer", expires_in: 7200, scopes }
 *
 * - access token 2시간 (카페24와 동일)
 * - secret 은 bcrypt 해시 비교
 * - 만료 토큰은 발급 시점에 정리 (지연 청소)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { apiError } from '@/lib/openapi/auth'

const TOKEN_TTL_SECONDS = 2 * 60 * 60 // 2시간

export async function POST(req: NextRequest) {
  // grant_type 파싱 (form-urlencoded 또는 JSON)
  let grantType = ''
  const contentType = req.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/json')) {
      const body = await req.json()
      grantType = body?.grant_type || ''
    } else {
      const form = await req.formData()
      grantType = String(form.get('grant_type') || '')
    }
  } catch {
    // body 없는 경우도 grant_type 누락으로 처리
  }

  if (grantType !== 'client_credentials') {
    return apiError(400, 'UNSUPPORTED_GRANT_TYPE', 'grant_type 은 client_credentials 만 지원합니다.')
  }

  // Basic 인증 파싱
  const authHeader = req.headers.get('authorization') || ''
  const basicMatch = authHeader.match(/^Basic\s+(.+)$/i)
  if (!basicMatch) {
    return apiError(401, 'UNAUTHORIZED', 'Authorization: Basic base64(clientId:clientSecret) 헤더가 필요합니다.')
  }

  let clientKey = ''
  let clientSecret = ''
  try {
    const decoded = Buffer.from(basicMatch[1], 'base64').toString('utf8')
    const sep = decoded.indexOf(':')
    clientKey = decoded.slice(0, sep)
    clientSecret = decoded.slice(sep + 1)
  } catch {
    return apiError(401, 'UNAUTHORIZED', 'Basic 인증 형식이 올바르지 않습니다.')
  }
  if (!clientKey || !clientSecret) {
    return apiError(401, 'UNAUTHORIZED', 'clientId 와 clientSecret 이 필요합니다.')
  }

  const client = await prisma.apiClient.findUnique({
    where: { clientId: clientKey },
    select: { id: true, clientSecret: true, scopes: true, isActive: true, deletedAt: true, userId: true },
  })
  if (!client || client.deletedAt || !client.isActive) {
    return apiError(401, 'INVALID_CLIENT', '클라이언트를 찾을 수 없거나 비활성 상태입니다.')
  }

  const secretOk = await bcrypt.compare(clientSecret, client.clientSecret)
  if (!secretOk) {
    return apiError(401, 'INVALID_CLIENT', '클라이언트 인증에 실패했습니다.')
  }

  // 소유자가 B2B 승인 상태인지 재확인 (승인 철회 시 즉시 차단)
  const owner = await prisma.user.findUnique({
    where: { id: client.userId },
    select: { b2bStatus: true, deletedAt: true } as any,
  })
  if (!owner || (owner as any).deletedAt || (owner as any).b2bStatus !== 'APPROVED') {
    return apiError(403, 'B2B_NOT_APPROVED', 'B2B 사업자 승인 상태가 아닙니다.')
  }

  const accessToken = randomBytes(32).toString('hex') // 64 chars
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000)

  await prisma.$transaction([
    // 만료 토큰 지연 청소 (이 클라이언트 것만)
    prisma.apiToken.deleteMany({
      where: { clientId: client.id, expiresAt: { lt: new Date() } },
    }),
    prisma.apiToken.create({
      data: { clientId: client.id, accessToken, expiresAt },
    }),
  ])

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: TOKEN_TTL_SECONDS,
    scopes: client.scopes.split(',').map((s) => s.trim()).filter(Boolean),
  })
}
