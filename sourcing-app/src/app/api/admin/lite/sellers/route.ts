/**
 * GET  /api/admin/lite/sellers — 라이트 셀러 목록 (mode='lite' 사용자)
 * POST /api/admin/lite/sellers — 신규 라이트 셀러 + 쇼핑몰 + 자동 발행 설정 생성
 *
 * 관리자(어드민)가 라이트 셀러 계정과 쇼핑몰을 한 번에 발급한다.
 * - User: email/password/name/phone + role='USER' + mode='lite' + liteStartAt=now
 * - Shop: name/subdomain + 관리자/개설자 인적사항 + adminLoginId/adminLoginPassword (별도 보안)
 * - LiteAutoPublishConfig: publishHour=10, dailyCount=20 (기본값, 이후 수정 가능)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', status: 401 as const }
  if (user.role !== 'ADMIN') return { error: '관리자 권한이 필요합니다.', status: 403 as const }
  return { user }
}

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const sellers = await prisma.user.findMany({
    where: { mode: 'lite', deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      liteStartAt: true,
      proStartAt: true,
      createdAt: true,
      shops: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          subdomain: true,
          ownerName: true,
          managerName: true,
          managerPhone: true,
          managerEmail: true,
          adminLoginId: true,
          isActive: true,
        },
      },
      liteAutoPublishConfig: {
        select: {
          publishHour: true,
          publishMinute: true,
          dailyCount: true,
          isActive: true,
          lastRunAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: sellers })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const {
    // 사용자 계정
    email,
    password,
    name,
    phone,
    // 쇼핑몰
    shopName,
    subdomain,
    // 관리자/개설자 정보
    ownerName,
    managerName,
    managerPhone,
    managerEmail,
    businessNumber,
    contactPhone,
    contactEmail,
    bankName,
    bankAccount,
    accountHolder,
    // 쇼핑몰 보안 ID/비번 (라이트 셀러 구분용)
    adminLoginId,
    adminLoginPassword,
    // 자동 발행 설정 (선택)
    publishHour,
    publishMinute,
    dailyCount,
  } = body || {}

  // 필수 필드 검증
  if (!email || !password || !shopName || !subdomain || !adminLoginId || !adminLoginPassword) {
    return NextResponse.json(
      {
        success: false,
        error: '필수 항목 누락: email/password/shopName/subdomain/adminLoginId/adminLoginPassword',
      },
      { status: 400 }
    )
  }

  // subdomain 형식 (영소문자/숫자/하이픈, 3-63자)
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(String(subdomain))) {
    return NextResponse.json(
      { success: false, error: 'URL 주소(subdomain)는 3-63자 영소문자/숫자/하이픈만' },
      { status: 400 }
    )
  }

  // 중복 체크
  const [existsEmail, existsSubdomain, existsAdminId] = await Promise.all([
    prisma.user.findUnique({ where: { email: String(email).toLowerCase() } }),
    prisma.shop.findUnique({ where: { subdomain: String(subdomain).toLowerCase() } }),
    prisma.shop.findFirst({ where: { adminLoginId: String(adminLoginId), deletedAt: null } }),
  ])
  if (existsEmail)
    return NextResponse.json({ success: false, error: '이미 사용 중인 이메일' }, { status: 409 })
  if (existsSubdomain)
    return NextResponse.json(
      { success: false, error: '이미 사용 중인 URL 주소' },
      { status: 409 }
    )
  if (existsAdminId)
    return NextResponse.json(
      { success: false, error: '이미 사용 중인 관리자 ID' },
      { status: 409 }
    )

  const userPwHash = await bcrypt.hash(String(password), 10)
  const adminPwHash = await bcrypt.hash(String(adminLoginPassword), 10)

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: String(email).toLowerCase(),
          password: userPwHash,
          name: name || null,
          phone: phone || null,
          role: 'USER',
          mode: 'lite',
          liteStartAt: new Date(),
        },
        select: { id: true, email: true, name: true, phone: true },
      })

      const shop = await tx.shop.create({
        data: {
          userId: user.id,
          name: String(shopName),
          subdomain: String(subdomain).toLowerCase(),
          ownerName: ownerName || name || null,
          managerName: managerName || null,
          managerPhone: managerPhone || null,
          managerEmail: managerEmail || null,
          contactPhone: contactPhone || phone || null,
          contactEmail: contactEmail || email || null,
          businessNumber: businessNumber || null,
          bankName: bankName || null,
          bankAccount: bankAccount || null,
          accountHolder: accountHolder || null,
          adminLoginId: String(adminLoginId),
          adminLoginPassword: adminPwHash,
        },
      })

      const config = await tx.liteAutoPublishConfig.create({
        data: {
          userId: user.id,
          publishHour: clampHour(publishHour ?? 10),
          publishMinute: clampMinute(publishMinute ?? 0),
          dailyCount: clampCount(dailyCount ?? 20),
          isActive: true,
        },
      })

      return { user, shop, config }
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error: any) {
    console.error('[Admin Lite Sellers POST]', error)
    return NextResponse.json(
      { success: false, error: error?.message || '생성 실패' },
      { status: 500 }
    )
  }
}

function clampHour(v: any): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 10
  return Math.max(0, Math.min(23, Math.floor(n)))
}
function clampMinute(v: any): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(59, Math.floor(n)))
}
function clampCount(v: any): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 20
  return Math.max(1, Math.min(100, Math.floor(n)))
}
