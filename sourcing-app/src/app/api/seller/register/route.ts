/**
 * POST /api/seller/register — 셀러 통합 회원가입 + 쇼핑몰 발행
 *
 * 일반 회원가입(/api/auth/register, /api/auth/signup)과 분리된 셀러 전용 경로.
 * 셀러는 가입과 동시에 본인 쇼핑몰을 발행한다.
 *
 * 자동 처리:
 * - User: mode='lite' (기본), role='USER', shopId=null (← 셀러 식별 핵심)
 * - Shop: 입력된 정보로 생성, adminLoginId/Password 자동 생성
 * - LiteAutoPublishConfig: 매일 10:00, 20개 자동 발행 (기본값)
 * - auth-token 쿠키 자동 설정 → 즉시 로그인 상태로 /lite/dashboard 진입
 *
 * Pro 트랙은 본 폼에서 신청 불가 — 관리자가 /admin/users/sellers 에서
 * 등급 변경 시 가능 (남용 방지).
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@bandauto/db'
import { hashPassword, createToken } from '@/modules/auth/auth.service'

const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const {
    // 계정
    email: emailRaw,
    password,
    name,
    phone,
    // 쇼핑몰
    shopName,
    subdomain: subdomainRaw,
    ownerName,
    businessNumber,
    // 관리자(=셀러 본인 또는 위임자)
    managerName,
    managerPhone,
    managerEmail,
    // 정산
    bankName,
    bankAccount,
    accountHolder,
    // 약관
    tosAgreed,
    privacyAgreed,
  } = body || {}

  // ─── 검증 ───────────────────────────────────────────
  const email = String(emailRaw || '').trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ success: false, error: '올바른 이메일을 입력해 주세요.' }, { status: 400 })
  }
  if (!password || String(password).length < 8) {
    return NextResponse.json({ success: false, error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 })
  }
  if (!name || !String(name).trim()) {
    return NextResponse.json({ success: false, error: '이름을 입력해 주세요.' }, { status: 400 })
  }
  if (!shopName || !String(shopName).trim()) {
    return NextResponse.json({ success: false, error: '쇼핑몰 이름을 입력해 주세요.' }, { status: 400 })
  }

  const subdomain = String(subdomainRaw || '').toLowerCase().trim()
  if (!SUBDOMAIN_RE.test(subdomain)) {
    return NextResponse.json(
      { success: false, error: 'URL 주소(subdomain)는 3-63자 영소문자/숫자/하이픈만 가능합니다.' },
      { status: 400 }
    )
  }

  if (!tosAgreed || !privacyAgreed) {
    return NextResponse.json(
      { success: false, error: '이용약관 및 개인정보처리방침 동의가 필요합니다.' },
      { status: 400 }
    )
  }

  // ─── 중복 체크 ──────────────────────────────────────
  const [existsEmail, existsSubdomain] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.shop.findUnique({ where: { subdomain } }),
  ])
  if (existsEmail) {
    return NextResponse.json({ success: false, error: '이미 사용 중인 이메일입니다.' }, { status: 409 })
  }
  if (existsSubdomain) {
    return NextResponse.json({ success: false, error: '이미 사용 중인 URL 주소입니다.' }, { status: 409 })
  }

  // ─── 자격증명 자동 생성 (라이트 셀러 구분 보안) ─────────
  const adminLoginId = `${subdomain}-${Math.random().toString(36).slice(2, 6)}`
  const rawAdminPassword = generateRandomPassword(12)

  // ─── 트랜잭션 생성 ─────────────────────────────────
  const userPwHash = await hashPassword(String(password))
  const adminPwHash = await bcrypt.hash(rawAdminPassword, 10)
  const now = new Date()

  let created
  try {
    created = await prisma.$transaction(async (tx) => {
      // User: shopId 미설정(=셀러), mode='lite', maxShops=1
      const user = await tx.user.create({
        data: {
          email,
          password: userPwHash,
          name: String(name).trim(),
          phone: phone || null,
          role: 'USER',
          mode: 'lite',
          maxShops: 1,
          liteStartAt: now,
          tosAgreedAt: now,
          privacyAgreedAt: now,
          signupCompletedAt: now,
        },
        select: { id: true, email: true, name: true, role: true, mode: true },
      })

      // Shop
      const shop = await tx.shop.create({
        data: {
          userId: user.id,
          name: String(shopName).trim(),
          subdomain,
          ownerName: ownerName || name || null,
          managerName: managerName || null,
          managerPhone: managerPhone || null,
          managerEmail: managerEmail || null,
          contactPhone: phone || null,
          contactEmail: email,
          businessNumber: businessNumber || null,
          bankName: bankName || null,
          bankAccount: bankAccount || null,
          accountHolder: accountHolder || null,
          adminLoginId,
          adminLoginPassword: adminPwHash,
        },
        select: { id: true, name: true, subdomain: true },
      })

      // ShopTheme 기본
      await tx.shopTheme.create({ data: { shopId: shop.id } })

      // LiteAutoPublishConfig (매일 10:00, 20개)
      await tx.liteAutoPublishConfig.create({
        data: {
          userId: user.id,
          publishHour: 10,
          publishMinute: 0,
          dailyCount: 20,
          isActive: true,
        },
      })

      return { user, shop }
    })
  } catch (err: any) {
    console.error('[Seller Register]', err)
    return NextResponse.json(
      { success: false, error: err?.message || '가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }

  // ─── auth-token 발급 + 자동 로그인 ─────────────────
  const token = await createToken({
    userId: created.user.id,
    email: created.user.email,
    role: created.user.role,
  })

  const response = NextResponse.json({
    success: true,
    data: {
      user: created.user,
      shop: created.shop,
      // 라이트 셀러 구분 보안 자격증명 — 1회 노출 (사용자가 별도 보관)
      shopAdminCredentials: {
        loginId: adminLoginId,
        password: rawAdminPassword,
      },
      redirectTo: '/lite/dashboard',
    },
  })

  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: '/',
  })

  return response
}

function generateRandomPassword(len: number): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}
