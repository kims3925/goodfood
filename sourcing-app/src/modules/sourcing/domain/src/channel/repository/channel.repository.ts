import prisma from '@bandauto/db'
import { ChannelKind } from '@bandauto/db'
import type { ChannelListParams, ChannelCreateInput, ChannelUpdateInput } from '../types/channel.types'

export class ChannelRepository {
  async findMany(params: ChannelListParams) {
    const { userId, kind, platform, search = '', page = 1, limit = 10 } = params

    const where = {
      deletedAt: null,
      ...(userId && { userId }),
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
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        shop: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { kind: 'asc' },
        { createdAt: 'desc' },
      ],
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
      const channel = await prisma.channel.findFirst({
        where: { 
          id,
          deletedAt: null,
        },
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              isActive: true,
            },
          },
        },
      })

      if (!channel) {
        console.log('[ChannelRepository] 채널 없음')
        return null
      }

      console.log('[ChannelRepository] findById 결과:', channel ? `ID: ${channel.id}` : 'null')
      return channel
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
        deletedAt: null,
      },
    })
  }

  async create(data: ChannelCreateInput) {
    return prisma.channel.create({
      data: {
        userId: data.userId,
        kind: data.kind,
        platform: data.platform,
        channelKey: data.channelKey,
        name: data.name,
        coverUrl: data.coverUrl,
      },
    })
  }

  async update(id: number, data: ChannelUpdateInput) {
    // 기본 채널 정보 업데이트
    const channelData: Record<string, any> = {}

    if (data.name) channelData.name = data.name
    if (data.isActive !== undefined) channelData.isActive = data.isActive
    if (data.coverUrl !== undefined) channelData.coverUrl = data.coverUrl
    if (data.shopId !== undefined) channelData.shopId = data.shopId

    return prisma.channel.update({
      where: { id },
      data: channelData,
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            isActive: true,
          },
        },
      },
    })
  }

  async delete(id: number) {
    return prisma.channel.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
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
