import prisma from '@bandauto/db'
import { ChannelKind } from '@bandauto/db'
import type { ChannelListParams, ChannelCreateInput, ChannelUpdateInput } from '../types/channel.types'

export class ChannelRepository {
  async findMany(params: ChannelListParams) {
    const { kind, platform, search = '', page = 1, limit = 10 } = params

    const where = {
      ...(kind && { kind }),
      ...(platform && { platform }),
      ...(search && {
        name: { contains: search },
      }),
    }

    const total = await prisma.channel.count({ where })

    const channels = await prisma.channel.findMany({
      where,
      include: {
        apiConfig: {
          select: {
            platform: true,
          },
        },
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      data: channels,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async findById(id: number) {
    try {
      console.log('[ChannelRepository] findById 호출 - ID:', id)
      // 먼저 기본 채널 조회
      const channel = await prisma.channel.findFirst({
        where: { id },
        include: {
          apiConfig: {
            select: {
              platform: true,
            },
          },
        },
      })

      if (!channel) {
        console.log('[ChannelRepository] 채널 없음')
        return null
      }

      // 테마 별도 조회
      let theme = null
      try {
        theme = await prisma.channelTheme.findFirst({
          where: { channelId: id },
        })
      } catch (themeError) {
        console.log('[ChannelRepository] 테마 조회 실패 (무시):', themeError)
      }

      const result = { ...channel, theme }
      console.log('[ChannelRepository] findById 결과:', result ? `ID: ${result.id}` : 'null')
      return result
    } catch (error) {
      console.error('[ChannelRepository] findById 에러:', error)
      throw error
    }
  }

  async findByUserAndChannelKey(userId: number, channelKey: string) {
    return prisma.channel.findFirst({
      where: {
        userId,
        channelKey,
      },
    })
  }

  async create(data: ChannelCreateInput) {
    return prisma.channel.create({
      data: {
        userId: data.userId,
        apiConfigId: data.apiConfigId,
        kind: data.kind,
        platform: data.platform,
        channelKey: data.channelKey,
        name: data.name,
        coverUrl: data.coverUrl,
        accountHolder: data.accountHolder,
        bankAccount: data.bankAccount,
        bankName: data.bankName,
        subdomain: data.subdomain,
      },
      include: {
        apiConfig: {
          select: {
            platform: true,
          },
        },
        theme: true,
      },
    })
  }

  async update(id: number, data: ChannelUpdateInput) {
    // 기본 채널 정보 업데이트
    const channelData: Record<string, any> = {}

    if (data.name) channelData.name = data.name
    if (data.isActive !== undefined) channelData.isActive = data.isActive
    if (data.coverUrl !== undefined) channelData.coverUrl = data.coverUrl
    if (data.accountHolder !== undefined) channelData.accountHolder = data.accountHolder
    if (data.bankAccount !== undefined) channelData.bankAccount = data.bankAccount
    if (data.bankName !== undefined) channelData.bankName = data.bankName

    // 서브도메인 쇼핑몰 필드
    if (data.subdomain !== undefined) channelData.subdomain = data.subdomain
    if (data.displayName !== undefined) channelData.displayName = data.displayName
    if (data.enableToss !== undefined) channelData.enableToss = data.enableToss
    if (data.enableBankTransfer !== undefined) channelData.enableBankTransfer = data.enableBankTransfer
    if (data.freeShippingAmount !== undefined) channelData.freeShippingAmount = data.freeShippingAmount
    if (data.defaultShippingFee !== undefined) channelData.defaultShippingFee = data.defaultShippingFee
    if (data.contactPhone !== undefined) channelData.contactPhone = data.contactPhone
    if (data.contactEmail !== undefined) channelData.contactEmail = data.contactEmail

    // 테마가 포함된 경우 upsert 처리
    if (data.theme) {
      channelData.theme = {
        upsert: {
          create: {
            primaryColor: data.theme.primaryColor ?? null,
            secondaryColor: data.theme.secondaryColor ?? null,
            logoUrl: data.theme.logoUrl ?? null,
            faviconUrl: data.theme.faviconUrl ?? null,
            bannerUrl: data.theme.bannerUrl ?? null,
            footerText: data.theme.footerText ?? null,
          },
          update: {
            primaryColor: data.theme.primaryColor ?? null,
            secondaryColor: data.theme.secondaryColor ?? null,
            logoUrl: data.theme.logoUrl ?? null,
            faviconUrl: data.theme.faviconUrl ?? null,
            bannerUrl: data.theme.bannerUrl ?? null,
            footerText: data.theme.footerText ?? null,
          },
        },
      }
    }

    return prisma.channel.update({
      where: { id },
      data: channelData,
      include: {
        apiConfig: {
          select: {
            platform: true,
          },
        },
        theme: true,
      },
    })
  }

  async delete(id: number) {
    return prisma.channel.delete({
      where: { id },
    })
  }

  // Wholesale 채널 전용 메서드
  async findWholesaleChannels(params: Omit<ChannelListParams, 'kind'>) {
    return this.findMany({ ...params, kind: ChannelKind.WHOLESALE })
  }

  // Retail 채널 전용 메서드
  async findRetailChannels(params: Omit<ChannelListParams, 'kind'>) {
    return this.findMany({ ...params, kind: ChannelKind.RETAIL })
  }
}

export const channelRepository = new ChannelRepository()
