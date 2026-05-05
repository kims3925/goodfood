/**
 * GET /api/admin/lite/sellers/[id] — 라이트 셀러 상세
 * PUT /api/admin/lite/sellers/[id] — 셀러 + 쇼핑몰 + 자동 발행 설정 수정
 * DELETE /api/admin/lite/sellers/[id] — 라이트 셀러 비활성화 (soft delete: User.deletedAt + Shop.deletedAt)
 *
 * 비밀번호는 입력 시에만 갱신, 빈 값이면 유지.
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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })

  const userId = Number(params.id)
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  const seller = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      mode: true,
      liteStartAt: true,
      proStartAt: true,
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
          contactPhone: true,
          contactEmail: true,
          businessNumber: true,
          bankName: true,
          bankAccount: true,
          accountHolder: true,
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
  })
  if (!seller || seller.mode !== 'lite') {
    return NextResponse.json({ success: false, error: '라이트 셀러 없음' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: seller })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })

  const userId = Number(params.id)
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const seller = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, mode: true, shops: { where: { deletedAt: null }, select: { id: true } } },
  })
  if (!seller || seller.mode !== 'lite') {
    return NextResponse.json({ success: false, error: '라이트 셀러 없음' }, { status: 404 })
  }
  const shopId = seller.shops[0]?.id
  if (!shopId) {
    return NextResponse.json({ success: false, error: '쇼핑몰 없음' }, { status: 404 })
  }

  const {
    name,
    phone,
    password,
    shopName,
    ownerName,
    managerName,
    managerPhone,
    managerEmail,
    contactPhone,
    contactEmail,
    businessNumber,
    bankName,
    bankAccount,
    accountHolder,
    adminLoginId,
    adminLoginPassword,
    publishHour,
    publishMinute,
    dailyCount,
    isActive,
  } = body || {}

  // adminLoginId 중복 체크 (다른 쇼핑몰)
  if (adminLoginId) {
    const dup = await prisma.shop.findFirst({
      where: { adminLoginId: String(adminLoginId), deletedAt: null, NOT: { id: shopId } },
    })
    if (dup)
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 관리자 ID' },
        { status: 409 }
      )
  }

  const userUpdate: any = {}
  if (name !== undefined) userUpdate.name = name
  if (phone !== undefined) userUpdate.phone = phone
  if (password) userUpdate.password = await bcrypt.hash(String(password), 10)

  const shopUpdate: any = {}
  if (shopName !== undefined) shopUpdate.name = shopName
  if (ownerName !== undefined) shopUpdate.ownerName = ownerName
  if (managerName !== undefined) shopUpdate.managerName = managerName
  if (managerPhone !== undefined) shopUpdate.managerPhone = managerPhone
  if (managerEmail !== undefined) shopUpdate.managerEmail = managerEmail
  if (contactPhone !== undefined) shopUpdate.contactPhone = contactPhone
  if (contactEmail !== undefined) shopUpdate.contactEmail = contactEmail
  if (businessNumber !== undefined) shopUpdate.businessNumber = businessNumber
  if (bankName !== undefined) shopUpdate.bankName = bankName
  if (bankAccount !== undefined) shopUpdate.bankAccount = bankAccount
  if (accountHolder !== undefined) shopUpdate.accountHolder = accountHolder
  if (adminLoginId !== undefined) shopUpdate.adminLoginId = adminLoginId
  if (adminLoginPassword) shopUpdate.adminLoginPassword = await bcrypt.hash(String(adminLoginPassword), 10)

  const configUpdate: any = {}
  if (publishHour !== undefined) configUpdate.publishHour = clamp(publishHour, 0, 23, 10)
  if (publishMinute !== undefined) configUpdate.publishMinute = clamp(publishMinute, 0, 59, 0)
  if (dailyCount !== undefined) configUpdate.dailyCount = clamp(dailyCount, 1, 100, 20)
  if (isActive !== undefined) configUpdate.isActive = Boolean(isActive)

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userUpdate).length > 0) {
      await tx.user.update({ where: { id: userId }, data: userUpdate })
    }
    if (Object.keys(shopUpdate).length > 0) {
      await tx.shop.update({ where: { id: shopId }, data: shopUpdate })
    }
    if (Object.keys(configUpdate).length > 0) {
      await tx.liteAutoPublishConfig.upsert({
        where: { userId },
        create: {
          userId,
          publishHour: configUpdate.publishHour ?? 10,
          publishMinute: configUpdate.publishMinute ?? 0,
          dailyCount: configUpdate.dailyCount ?? 20,
          isActive: configUpdate.isActive ?? true,
        },
        update: configUpdate,
      })
    }
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })

  const userId = Number(params.id)
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { deletedAt: new Date() } })
    await tx.shop.updateMany({ where: { userId }, data: { deletedAt: new Date(), isActive: false } })
    await tx.liteAutoPublishConfig.update({ where: { userId }, data: { isActive: false } }).catch(() => {})
  })

  return NextResponse.json({ success: true })
}

function clamp(v: any, min: number, max: number, fallback: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}
