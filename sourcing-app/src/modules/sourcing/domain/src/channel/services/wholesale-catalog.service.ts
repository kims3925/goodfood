/**
 * 도매밴드 가등록 카탈로그 (2026-06-11)
 *
 * 플랫폼(어드민)이 미리 확보·가입해 둔 소싱 도매밴드를 카탈로그에 등록하고,
 * 매니저는 카탈로그에서 선택("연결")만 하면 본인 소유 WHOLESALE 채널이 자동 생성된다.
 *
 * - 연결 시 Band Open API 설정(SourcingApiConfig)을 요구하지 않는다 — 수집·발행 모두
 *   Playwright 세션 경로가 권위이므로 (운영 Open API 토큰 전멸).
 * - 연결 시 sourceChannel(플랫폼 채널)의 밴드 세션 쿠키를 복사해 매니저 본인이
 *   해당 도매밴드 멤버가 아니어도 수집이 동작한다. 이후 세션 신선도는
 *   SessionKeeperAgent keep-alive 가 sessionAccountEmail 기준으로 전파해 유지.
 */

import prisma from '@bandauto/db'
import { ChannelKind, ChannelPlatform } from '@bandauto/db'

export interface CatalogCreateInput {
  // 방법 1: 어드민 본인 채널에서 가져오기 (bandKey/name/cover/bandNo/세션출처 자동)
  channelId?: number
  // 방법 2: 수동 입력
  bandKey?: string
  bandNo?: number | null
  name?: string
  description?: string | null
  sortOrder?: number
}

export interface CatalogUpdateInput {
  name?: string
  description?: string | null
  bandNo?: number | null
  isActive?: boolean
  sortOrder?: number
  sourceChannelId?: number | null
}

export class WholesaleCatalogService {
  /** 어드민용 전체 목록 (연결 수 + 세션 출처 상태 포함) */
  async listForAdmin() {
    const entries = await prisma.wholesaleBandCatalog.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        _count: { select: { channels: { where: { deletedAt: null } } } },
      },
    })

    // 세션 출처 채널의 세션 보유 여부 (카탈로그가 실제 수집 가능한 상태인지)
    const sourceIds = entries.map((e) => e.sourceChannelId).filter((v): v is number => v != null)
    const sources = sourceIds.length
      ? await prisma.channel.findMany({
          where: { id: { in: sourceIds } },
          select: { id: true, bandSessionCookie: true, sessionAccountEmail: true },
        })
      : []
    const sourceMap = new Map(sources.map((s) => [s.id, s]))

    return entries.map((e) => {
      const src = e.sourceChannelId ? sourceMap.get(e.sourceChannelId) : undefined
      return {
        ...e,
        connectedCount: e._count.channels,
        sourceHasSession: !!src?.bandSessionCookie,
        sourceSessionAccount: src?.sessionAccountEmail ?? null,
      }
    })
  }

  /** 카탈로그 등록 (가등록) */
  async create(adminUserId: number, input: CatalogCreateInput) {
    let bandKey = input.bandKey?.trim()
    let name = input.name?.trim()
    let bandNo = input.bandNo ?? null
    let coverUrl: string | null = null
    let sourceChannelId: number | null = null

    if (input.channelId) {
      const channel = await prisma.channel.findFirst({
        where: {
          id: input.channelId,
          userId: adminUserId,
          kind: ChannelKind.WHOLESALE,
          platform: ChannelPlatform.BAND,
          deletedAt: null,
        },
      })
      if (!channel) {
        throw new Error('본인 소유의 도매(BAND) 채널만 카탈로그에 등록할 수 있습니다.')
      }
      bandKey = channel.channelKey
      name = name || channel.name
      bandNo = bandNo ?? channel.bandNo
      coverUrl = channel.coverUrl
      sourceChannelId = channel.id
    }

    if (!bandKey || !name) {
      throw new Error('bandKey 와 name 은 필수입니다. (또는 channelId 로 채널에서 가져오기)')
    }

    const existing = await prisma.wholesaleBandCatalog.findUnique({ where: { bandKey } })
    if (existing) {
      if (!existing.deletedAt) {
        throw new Error('이미 카탈로그에 등록된 도매밴드입니다.')
      }
      // 소프트 삭제된 항목 재등록 → 복원
      return prisma.wholesaleBandCatalog.update({
        where: { id: existing.id },
        data: {
          name,
          bandNo,
          description: input.description ?? null,
          coverUrl,
          sortOrder: input.sortOrder ?? 0,
          sourceChannelId,
          createdById: adminUserId,
          isActive: true,
          deletedAt: null,
        },
      })
    }

    return prisma.wholesaleBandCatalog.create({
      data: {
        bandKey,
        bandNo,
        name,
        description: input.description ?? null,
        coverUrl,
        sortOrder: input.sortOrder ?? 0,
        sourceChannelId,
        createdById: adminUserId,
      },
    })
  }

  async update(id: number, data: CatalogUpdateInput) {
    const existing = await prisma.wholesaleBandCatalog.findFirst({
      where: { id, deletedAt: null },
    })
    if (!existing) throw new Error('카탈로그 항목을 찾을 수 없습니다.')
    return prisma.wholesaleBandCatalog.update({ where: { id }, data })
  }

  /** 소프트 삭제 — 이미 연결된 매니저 채널은 그대로 유지 */
  async delete(id: number) {
    const existing = await prisma.wholesaleBandCatalog.findFirst({
      where: { id, deletedAt: null },
    })
    if (!existing) throw new Error('카탈로그 항목을 찾을 수 없습니다.')
    return prisma.wholesaleBandCatalog.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    })
  }

  /** 매니저용 목록 — 활성 항목 + 본인 연결 여부 */
  async listForManager(userId: number) {
    const entries = await prisma.wholesaleBandCatalog.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        bandKey: true,
        bandNo: true,
        name: true,
        description: true,
        coverUrl: true,
        sourceChannelId: true,
      },
    })
    if (entries.length === 0) return []

    // 본인이 이미 연결(동일 channelKey 보유)했는지 — relation traversal 로 사용자 채널만 조회
    const myChannels = await prisma.channel.findMany({
      where: { userId, deletedAt: null, platform: ChannelPlatform.BAND },
      select: { channelKey: true },
    })
    const myKeys = new Set(myChannels.map((c) => c.channelKey))

    // 세션 출처 보유 여부 (연결해도 수집이 되는지 안내용)
    const sourceIds = entries.map((e) => e.sourceChannelId).filter((v): v is number => v != null)
    const sources = sourceIds.length
      ? await prisma.channel.findMany({
          where: { id: { in: sourceIds } },
          select: { id: true, bandSessionCookie: true },
        })
      : []
    const sourceSessionMap = new Map(sources.map((s) => [s.id, !!s.bandSessionCookie]))

    return entries.map((e) => ({
      id: e.id,
      bandKey: e.bandKey,
      bandNo: e.bandNo,
      name: e.name,
      description: e.description,
      coverUrl: e.coverUrl,
      isConnected: myKeys.has(e.bandKey),
      sessionAvailable: e.sourceChannelId ? (sourceSessionMap.get(e.sourceChannelId) ?? false) : false,
    }))
  }

  /**
   * 매니저 연결 — 카탈로그 항목으로부터 본인 소유 WHOLESALE 채널 생성.
   * 플랫폼 세션(sourceChannel)이 있으면 복사해 즉시 수집 가능 상태로 만든다.
   * (신청 즉시 연결 — 어드민 승인 단계 없음)
   */
  async connect(userId: number, catalogId: number) {
    const entry = await prisma.wholesaleBandCatalog.findFirst({
      where: { id: catalogId, deletedAt: null, isActive: true },
    })
    if (!entry) throw new Error('카탈로그 항목을 찾을 수 없습니다.')

    // 세션 복사 출처: 명시된 sourceChannel 우선, 없으면 같은 bandKey 의 세션 보유 채널 중 최신
    let source = entry.sourceChannelId
      ? await prisma.channel.findFirst({
          where: { id: entry.sourceChannelId, bandSessionCookie: { not: null } },
          select: { bandSessionCookie: true, sessionExpiresAt: true, sessionAccountEmail: true },
        })
      : null
    if (!source) {
      source = await prisma.channel.findFirst({
        where: { channelKey: entry.bandKey, deletedAt: null, bandSessionCookie: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: { bandSessionCookie: true, sessionExpiresAt: true, sessionAccountEmail: true },
      })
    }

    const sessionData = source
      ? {
          bandSessionCookie: source.bandSessionCookie,
          sessionExpiresAt: source.sessionExpiresAt,
          sessionAccountEmail: source.sessionAccountEmail,
        }
      : {}

    // 동일 channelKey 채널 보유 시: 소프트 삭제분은 복원, 활성분은 409 성격 에러
    const existing = await prisma.channel.findFirst({
      where: { userId, channelKey: entry.bandKey },
    })
    if (existing) {
      if (!existing.deletedAt) {
        throw new Error('이미 연결된 도매밴드입니다.')
      }
      return prisma.channel.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          isActive: true,
          kind: ChannelKind.WHOLESALE,
          platform: ChannelPlatform.BAND,
          name: entry.name,
          coverUrl: entry.coverUrl,
          bandNo: entry.bandNo,
          catalogId: entry.id,
          ...sessionData,
        },
      })
    }

    return prisma.channel.create({
      data: {
        userId,
        kind: ChannelKind.WHOLESALE,
        platform: ChannelPlatform.BAND,
        channelKey: entry.bandKey,
        name: entry.name,
        coverUrl: entry.coverUrl,
        bandNo: entry.bandNo,
        catalogId: entry.id,
        ...sessionData,
      },
    })
  }
}

export const wholesaleCatalogService = new WholesaleCatalogService()
