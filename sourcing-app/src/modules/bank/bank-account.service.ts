/**
 * 은행통장(BankAccount) 관리 서비스 (BandAuto SaaS Phase 4)
 *
 * 셀러가 입금 받을 통장을 등록/수정/삭제하고 거래내역을 동기화한다.
 * 실 은행 API (Toss/카카오뱅크/KFTC) 연동은 미구현 — 인터페이스만 정의.
 * 현재는 apiProvider=NONE 으로 수동 등록 운영 가능.
 */

import prisma from '@bandauto/db'

export interface BankAccountCreateInput {
  userId: number
  bankName: string
  accountNumber: string
  accountHolder: string
  apiProvider?: 'NONE' | 'TOSS' | 'KAKAOBANK' | 'KFTC' | 'CUSTOM'
  apiCredentials?: any
  isActive?: boolean
}

export interface BankAccountUpdateInput {
  bankName?: string
  accountNumber?: string
  accountHolder?: string
  apiProvider?: 'NONE' | 'TOSS' | 'KAKAOBANK' | 'KFTC' | 'CUSTOM'
  apiCredentials?: any
  isActive?: boolean
}

export async function listBankAccounts(userId: number) {
  return (prisma as any).bankAccount.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createBankAccount(input: BankAccountCreateInput) {
  if (!input.bankName?.trim() || !input.accountNumber?.trim() || !input.accountHolder?.trim()) {
    throw new Error('은행명/계좌번호/예금주는 필수입니다.')
  }
  return (prisma as any).bankAccount.create({
    data: {
      userId: input.userId,
      bankName: input.bankName.trim().slice(0, 50),
      accountNumber: input.accountNumber.trim().slice(0, 50),
      accountHolder: input.accountHolder.trim().slice(0, 100),
      apiProvider: input.apiProvider ?? 'NONE',
      apiCredentials: input.apiCredentials ?? null,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateBankAccount(
  userId: number,
  id: number,
  input: BankAccountUpdateInput
) {
  // tenant guard
  const existing = await (prisma as any).bankAccount.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  })
  if (!existing) throw new Error('통장을 찾을 수 없습니다.')

  return (prisma as any).bankAccount.update({
    where: { id },
    data: {
      ...(input.bankName !== undefined && { bankName: input.bankName.slice(0, 50) }),
      ...(input.accountNumber !== undefined && {
        accountNumber: input.accountNumber.slice(0, 50),
      }),
      ...(input.accountHolder !== undefined && {
        accountHolder: input.accountHolder.slice(0, 100),
      }),
      ...(input.apiProvider !== undefined && { apiProvider: input.apiProvider }),
      ...(input.apiCredentials !== undefined && { apiCredentials: input.apiCredentials }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  })
}

/** Soft delete (deletedAt) — 원칙: hard delete 금지 */
export async function softDeleteBankAccount(userId: number, id: number) {
  const existing = await (prisma as any).bankAccount.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  })
  if (!existing) throw new Error('통장을 찾을 수 없습니다.')

  return (prisma as any).bankAccount.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  })
}

/**
 * 거래내역 수동 동기화 트리거.
 * 실 API 연동 미구현 — 현재는 noop 후 lastSyncedAt 만 갱신.
 * 향후 apiProvider 별 어댑터 호출 분기를 여기에 추가.
 */
export async function syncBankTransactions(userId: number, id: number) {
  const account = await (prisma as any).bankAccount.findFirst({
    where: { id, userId, deletedAt: null },
  })
  if (!account) throw new Error('통장을 찾을 수 없습니다.')

  // TODO: account.apiProvider 별 adapter 호출
  //   - TOSS / KAKAOBANK / KFTC : OAuth + 거래내역 조회 API
  //   - NONE / CUSTOM : skip (수동 등록만 지원)

  await (prisma as any).bankAccount.update({
    where: { id },
    data: { lastSyncedAt: new Date() },
  })

  return {
    ok: true,
    provider: account.apiProvider,
    message:
      account.apiProvider === 'NONE'
        ? '수동 등록 통장 — 거래내역 페이지에서 직접 입력해 주세요.'
        : `${account.apiProvider} 자동 연동은 아직 구현되지 않았습니다.`,
  }
}
