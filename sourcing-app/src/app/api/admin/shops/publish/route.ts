/**
 * POST /api/admin/shops/publish
 * 어드민이 셀러를 선택해 쇼핑몰을 발행한다 (라이트/프로 통합).
 *
 * 비즈니스 규칙:
 * - lite/lite_band: maxShops 강제로 1, 기존 쇼핑몰이 있으면 차단 (1:1 원칙)
 * - pro: maxShops 는 어드민 입력값 (>=1), 기존 쇼핑몰 갯수 < maxShops 인 경우만 발행
 *
 * 동작 (트랜잭션):
 *   1. user.mode 업데이트 + maxShops 설정 (lite 면 1 강제)
 *   2. 현재 쇼핑몰 갯수 검증 (lite=0, pro<maxShops)
 *   3. Shop 생성 (subdomain/name + 자동 생성된 adminLoginId/Password)
 *   4. ShopTheme 기본 생성
 *   5. LiteAutoPublishConfig 생성 (lite/lite_band 만)
 *
 * 응답에 자동 생성된 adminLoginId/RawPassword 포함 — 어드민이 셀러에게 1회 전달.
 *
 * body:
 * {
 *   userId: number,
 *   mode: 'lite' | 'lite_band' | 'pro',
 *   shopName: string,
 *   subdomain: string,
 *   maxShops?: number,         // pro 전용 (lite 는 무시되고 1 로 고정)
 *   ownerName?: string,
 *   managerName?: string,
 *   managerPhone?: string,
 *   managerEmail?: string,
 *   businessNumber?: string,
 *   contactPhone?: string,
 *   contactEmail?: string,
 *   bankName?: string,
 *   bankAccount?: string,
 *   accountHolder?: string,
 *   adminLoginId?: string,     // 미입력 시 자동생성 (subdomain 기반)
 *   adminLoginPassword?: string, // 미입력 시 자동생성 (12자 랜덤)
 *   publishHour?: number,      // lite/lite_band 자동 발행 시각
 *   publishMinute?: number,
 *   dailyCount?: number,
 * }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { isValidUserMode, isLiteMode } from '@/lib/lite-modes'

const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (me.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const {
    userId: userIdRaw,
    mode: modeRaw,
    shopName,
    subdomain: subdomainRaw,
    maxShops: maxShopsRaw,
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
    adminLoginId: adminLoginIdRaw,
    adminLoginPassword: adminLoginPasswordRaw,
    publishHour,
    publishMinute,
    dailyCount,
  } = body || {}

  const userId = Number(userIdRaw)
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ success: false, error: 'userId 누락 또는 잘못됨' }, { status: 400 })
  }

  if (!isValidUserMode(modeRaw)) {
    return NextResponse.json(
      { success: false, error: 'mode 는 pro|lite|lite_band 중 하나' },
      { status: 400 }
    )
  }
  const mode = modeRaw as 'pro' | 'lite' | 'lite_band'

  if (!shopName || typeof shopName !== 'string' || !shopName.trim()) {
    return NextResponse.json({ success: false, error: '쇼핑몰 이름 필수' }, { status: 400 })
  }
  const subdomain = String(subdomainRaw || '').toLowerCase().trim()
  if (!SUBDOMAIN_RE.test(subdomain)) {
    return NextResponse.json(
      { success: false, error: 'URL 주소(subdomain)는 3-63자 영소문자/숫자/하이픈만' },
      { status: 400 }
    )
  }

  // maxShops 결정
  let maxShops: number
  if (isLiteMode(mode)) {
    maxShops = 1 // 라이트는 1:1 강제
  } else {
    const n = Number(maxShopsRaw)
    if (!Number.isFinite(n) || n < 1) {
      maxShops = 1 // 프로 기본값 1
    } else {
      maxShops = Math.floor(n)
    }
  }

  // 사용자 + 기존 쇼핑몰 조회
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      mode: true,
      deletedAt: true,
      shops: {
        where: { deletedAt: null },
        select: { id: true, subdomain: true },
      },
    },
  })

  if (!targetUser) {
    return NextResponse.json({ success: false, error: '대상 사용자를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (targetUser.deletedAt) {
    return NextResponse.json({ success: false, error: '정지된 사용자입니다.' }, { status: 400 })
  }
  if (targetUser.role === 'ADMIN') {
    return NextResponse.json({ success: false, error: '관리자 계정에는 쇼핑몰을 발행할 수 없습니다.' }, { status: 400 })
  }

  const existingShopCount = targetUser.shops.length

  // 발행 가능 여부 검증
  if (isLiteMode(mode) && existingShopCount >= 1) {
    return NextResponse.json(
      {
        success: false,
        error: `라이트 사용자는 쇼핑몰을 1개만 가질 수 있습니다. (현재 ${existingShopCount}개)`,
      },
      { status: 409 }
    )
  }
  if (mode === 'pro' && existingShopCount >= maxShops) {
    return NextResponse.json(
      {
        success: false,
        error: `최대 ${maxShops}개까지 가능합니다. (현재 ${existingShopCount}개) — 한도를 늘리려면 maxShops 를 조정하세요.`,
      },
      { status: 409 }
    )
  }

  // 중복 체크
  const [existsSubdomain, existsAdminId] = await Promise.all([
    prisma.shop.findFirst({ where: { subdomain, deletedAt: null }, select: { id: true } }),
    adminLoginIdRaw
      ? prisma.shop.findFirst({
          where: { adminLoginId: String(adminLoginIdRaw), deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])
  if (existsSubdomain) {
    return NextResponse.json({ success: false, error: '이미 사용 중인 URL 주소' }, { status: 409 })
  }
  if (adminLoginIdRaw && existsAdminId) {
    return NextResponse.json({ success: false, error: '이미 사용 중인 관리자 ID' }, { status: 409 })
  }

  // 자동 생성: adminLoginId / adminLoginPassword
  const adminLoginId =
    adminLoginIdRaw && String(adminLoginIdRaw).trim()
      ? String(adminLoginIdRaw).trim()
      : `${subdomain}-${Math.random().toString(36).slice(2, 6)}`
  const rawPassword =
    adminLoginPasswordRaw && String(adminLoginPasswordRaw).trim()
      ? String(adminLoginPasswordRaw)
      : generateRandomPassword(12)
  const adminPwHash = await bcrypt.hash(rawPassword, 10)

  try {
    const created = await prisma.$transaction(async (tx) => {
      // 1) user.mode + maxShops 업데이트
      const now = new Date()
      const userUpdates: any = { mode, maxShops }
      if (mode === 'pro' && targetUser.mode !== 'pro') {
        userUpdates.proStartAt = now
      } else if (isLiteMode(mode) && targetUser.mode === 'pro') {
        userUpdates.liteStartAt = now
      } else if (isLiteMode(mode) && !targetUser.mode) {
        userUpdates.liteStartAt = now
      }
      const user = await tx.user.update({
        where: { id: userId },
        data: userUpdates,
        select: { id: true, email: true, name: true, mode: true, maxShops: true },
      })

      // 2) Shop 생성
      const shop = await tx.shop.create({
        data: {
          userId: user.id,
          name: String(shopName).trim(),
          subdomain,
          ownerName: ownerName || null,
          managerName: managerName || null,
          managerPhone: managerPhone || null,
          managerEmail: managerEmail || null,
          businessNumber: businessNumber || null,
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          bankName: bankName || null,
          bankAccount: bankAccount || null,
          accountHolder: accountHolder || null,
          adminLoginId,
          adminLoginPassword: adminPwHash,
        },
      })

      // 3) ShopTheme 기본 생성
      const theme = await tx.shopTheme.create({
        data: { shopId: shop.id },
      })

      // 4) LiteAutoPublishConfig (lite/lite_band 만)
      let config = null
      if (isLiteMode(mode)) {
        const existingConfig = await tx.liteAutoPublishConfig.findUnique({ where: { userId: user.id } })
        if (!existingConfig) {
          config = await tx.liteAutoPublishConfig.create({
            data: {
              userId: user.id,
              publishHour: clampHour(publishHour ?? 10),
              publishMinute: clampMinute(publishMinute ?? 0),
              dailyCount: clampCount(dailyCount ?? 20),
              isActive: true,
            },
          })
        } else {
          config = existingConfig
        }
      }

      return { user, shop, theme, config }
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          user: created.user,
          shop: created.shop,
          theme: created.theme,
          config: created.config,
          credentials: {
            adminLoginId,
            adminLoginPassword: rawPassword, // 1회 노출 — 어드민이 셀러에게 전달
          },
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Admin Shops Publish POST]', error)
    return NextResponse.json(
      { success: false, error: error?.message || '쇼핑몰 발행 실패' },
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

function generateRandomPassword(len: number): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}
