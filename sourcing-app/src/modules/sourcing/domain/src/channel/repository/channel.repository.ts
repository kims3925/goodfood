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
    return prisma.channel.findFirst({
      where: { id },
      include: {
        apiConfig: {
          select: {
            platform: true,
          },
        },
      },
    })
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
        formUrl: data.formUrl,
        accountHolder: data.accountHolder,
        bankAccount: data.bankAccount,
        bankName: data.bankName,
      },
      include: {
        apiConfig: {
          select: {
            platform: true,
          },
        },
      },
    })
  }

  async update(id: number, data: ChannelUpdateInput) {
    return prisma.channel.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.coverUrl !== undefined && { coverUrl: data.coverUrl }),
        ...(data.formUrl !== undefined && { formUrl: data.formUrl }),
        ...(data.accountHolder !== undefined && { accountHolder: data.accountHolder }),
        ...(data.bankAccount !== undefined && { bankAccount: data.bankAccount }),
        ...(data.bankName !== undefined && { bankName: data.bankName }),
      },
      include: {
        apiConfig: {
          select: {
            platform: true,
          },
        },
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
