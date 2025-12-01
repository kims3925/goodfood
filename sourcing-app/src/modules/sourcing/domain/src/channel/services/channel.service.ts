import prisma from '@bandauto/db'
import { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { channelRepository } from '../repository/channel.repository'
import type { ChannelListParams, ChannelUpdateInput, ChannelCreateInput } from '../types/channel.types'

export class ChannelService {
  async getList(params: ChannelListParams) {
    return channelRepository.findMany(params)
  }

  async getById(id: number) {
    return channelRepository.findById(id)
  }

  async create(userId: number, data: Omit<ChannelCreateInput, 'userId' | 'apiConfigId'>) {
    // SHOP 플랫폼은 외부 API가 필요 없음
    const platformsRequiringApi: ChannelPlatform[] = [
      ChannelPlatform.BAND,
      ChannelPlatform.ALIEXPRESS,
      ChannelPlatform.NAVER_CAFE,
    ]

    let apiConfigId: number | null = null

    if (platformsRequiringApi.includes(data.platform)) {
      // 사용자의 API 설정 조회 (Platform 기준)
      const apiConfig = await prisma.sourcingApiConfig.findFirst({
        where: {
          userId,
          platform: data.platform === ChannelPlatform.BAND ? 'BAND' : 'ALIEXPRESS',
          isActive: true,
        },
      })

      if (!apiConfig) {
        throw new Error('API 설정을 먼저 등록해주세요.')
      }
      apiConfigId = apiConfig.id
    }

    // 중복 체크
    const existing = await channelRepository.findByUserAndChannelKey(userId, data.channelKey)
    if (existing) {
      throw new Error('이미 등록된 채널입니다.')
    }

    return channelRepository.create({
      userId,
      apiConfigId,
      kind: data.kind,
      platform: data.platform,
      channelKey: data.channelKey,
      name: data.name,
      coverUrl: data.coverUrl || null,
      formUrl: data.formUrl || null,
      accountHolder: data.accountHolder || null,
      bankAccount: data.bankAccount || null,
      bankName: data.bankName || null,
    })
  }

  async update(id: number, data: ChannelUpdateInput) {
    const existing = await channelRepository.findById(id)
    if (!existing) {
      throw new Error('채널을 찾을 수 없습니다.')
    }

    return channelRepository.update(id, data)
  }

  async delete(id: number) {
    const existing = await channelRepository.findById(id)
    if (!existing) {
      throw new Error('채널을 찾을 수 없습니다.')
    }

    return channelRepository.delete(id)
  }

  // Wholesale 채널 전용 메서드
  async getWholesaleChannels(params: Omit<ChannelListParams, 'kind'>) {
    return channelRepository.findWholesaleChannels(params)
  }

  // Retail 채널 전용 메서드
  async getRetailChannels(params: Omit<ChannelListParams, 'kind'>) {
    return channelRepository.findRetailChannels(params)
  }
}

export const channelService = new ChannelService()
