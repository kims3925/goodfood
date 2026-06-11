/**
 * B2B 개발자 API 키 관리 (STEP 4-4)
 *
 * GET    /api/b2b/developers — 내 API 클라이언트 목록 + 최근 사용량
 * POST   /api/b2b/developers — 키 발급 { name } (B2B APPROVED 만, 최대 3개)
 *        응답에 clientSecret 원문 1회 노출 — 이후 조회 불가 (bcrypt 해시 저장)
 * PATCH  /api/b2b/developers — { id, action: 'regenerate' | 'deactivate' | 'activate' }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import { isB2bApprovedUser } from '@/lib/b2b'

const MAX_CLIENTS = 3
const DEFAULT_SCOPES = 'products:read,orders:read,orders:write'

async function getSessionUserId(): Promise<number | null> {
  const session = await getServerSession(authOptions)
  const rawId = (session?.user as any)?.id
  const userId = rawId == null ? null : typeof rawId === 'string' ? parseInt(rawId) : rawId
  return userId && !Number.isNaN(userId) ? userId : null
}

async function requireB2bUser() {
  const userId = await getSessionUserId()
  if (!userId) {
    return { error: NextResponse.json({ success: false, error: '로그인이 필요합니다' }, { status: 401 }) }
  }
  const approved = await isB2bApprovedUser(userId)
  if (!approved) {
    return {
      error: NextResponse.json(
        { success: false, error: 'B2B 사업자 승인 후 API 키를 발급할 수 있습니다.' },
        { status: 403 }
      ),
    }
  }
  return { userId }
}

function generateClientKey(): string {
  return `bw_${randomBytes(16).toString('hex')}` // 35 chars
}

function generateClientSecret(): string {
  return randomBytes(32).toString('hex') // 64 chars
}

export async function GET() {
  const auth = await requireB2bUser()
  if (auth.error) return auth.error

  const clients = await prisma.apiClient.findMany({
    where: { userId: auth.userId, deletedAt: null },
    select: { id: true, name: true, clientId: true, scopes: true, isActive: true, rateLimit: true, createdAt: true },
    orderBy: { id: 'desc' },
  })

  // 최근 7일 호출량
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const usage = clients.length
    ? await prisma.apiCallLog.groupBy({
        by: ['clientId'],
        where: { clientId: { in: clients.map((c) => c.id) }, createdAt: { gte: since } },
        _count: { _all: true },
      })
    : []
  const usageByClient = new Map(usage.map((u) => [u.clientId, u._count._all]))

  return NextResponse.json({
    success: true,
    data: clients.map((c) => ({ ...c, calls7d: usageByClient.get(c.id) ?? 0 })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireB2bUser()
  if (auth.error) return auth.error

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const name = String(body?.name || '').trim() || 'API 키'

  const count = await prisma.apiClient.count({ where: { userId: auth.userId, deletedAt: null } })
  if (count >= MAX_CLIENTS) {
    return NextResponse.json(
      { success: false, error: `API 클라이언트는 최대 ${MAX_CLIENTS}개까지 발급 가능합니다.` },
      { status: 409 }
    )
  }

  const clientKey = generateClientKey()
  const secret = generateClientSecret()
  const secretHash = await bcrypt.hash(secret, 10)

  const client = await prisma.apiClient.create({
    data: {
      userId: auth.userId!,
      name: name.slice(0, 100),
      clientId: clientKey,
      clientSecret: secretHash,
      scopes: DEFAULT_SCOPES,
    },
    select: { id: true, name: true, clientId: true, scopes: true, rateLimit: true, createdAt: true },
  })

  return NextResponse.json(
    {
      success: true,
      data: {
        ...client,
        // ⚠️ 원문 secret 은 이 응답에서 1회만 노출 — 저장 후 재조회 불가
        clientSecret: secret,
      },
      message: 'clientSecret 은 지금 한 번만 표시됩니다. 안전한 곳에 보관하세요.',
    },
    { status: 201 }
  )
}

export async function PATCH(req: NextRequest) {
  const auth = await requireB2bUser()
  if (auth.error) return auth.error

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const id = Number(body?.id)
  const action = body?.action
  if (!Number.isFinite(id) || !['regenerate', 'deactivate', 'activate'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'id 와 action(regenerate|deactivate|activate)이 필요합니다.' },
      { status: 400 }
    )
  }

  const client = await prisma.apiClient.findFirst({
    where: { id, userId: auth.userId, deletedAt: null },
  })
  if (!client) {
    return NextResponse.json({ success: false, error: '클라이언트를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (action === 'regenerate') {
    const secret = generateClientSecret()
    const secretHash = await bcrypt.hash(secret, 10)
    await prisma.$transaction([
      prisma.apiClient.update({ where: { id }, data: { clientSecret: secretHash } }),
      // 재발급 시 기존 토큰 전부 무효화
      prisma.apiToken.deleteMany({ where: { clientId: id } }),
    ])
    return NextResponse.json({
      success: true,
      data: { id, clientId: client.clientId, clientSecret: secret },
      message: '새 clientSecret 은 지금 한 번만 표시됩니다. 기존 토큰은 모두 무효화되었습니다.',
    })
  }

  const isActive = action === 'activate'
  await prisma.$transaction([
    prisma.apiClient.update({ where: { id }, data: { isActive } }),
    ...(isActive ? [] : [prisma.apiToken.deleteMany({ where: { clientId: id } })]),
  ])

  return NextResponse.json({ success: true, data: { id, isActive } })
}
