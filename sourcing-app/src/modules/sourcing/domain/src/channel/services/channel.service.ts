import prisma from '@bandauto/db'
import { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { channelRepository } from '../repository/channel.repository'
import type { ChannelListParams, ChannelUpdateInput, ChannelCreateInput } from '../types/channel.types'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'

// ~ 경로를 홈 디렉토리로 확장
const expandTilde = (filePath: string): string => {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(1))
  }
  return filePath
}

// 채널 이미지 파일 삭제 함수
const deleteChannelImageFile = async (coverUrl: string | null) => {
  if (!coverUrl || !coverUrl.startsWith('/api/images/channel/file/')) {
    return
  }

  const filename = coverUrl.split('/').pop()
  if (!filename) return

  const storagePath = process.env.CHANNEL_IMAGE_STORAGE_PATH
  if (!storagePath) return

  const expandedPath = expandTilde(storagePath)
  const filePath = path.join(expandedPath, filename)

  if (existsSync(filePath)) {
    try {
      await unlink(filePath)
      console.log(`채널 이미지 파일 삭제 완료: ${filePath}`)
    } catch (error) {
      console.error(`채널 이미지 파일 삭제 실패: ${filePath}`, error)
    }
  }
}

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

    // 이미지가 변경되면 기존 이미지 삭제
    if (data.coverUrl !== undefined && existing.coverUrl && existing.coverUrl !== data.coverUrl) {
      await deleteChannelImageFile(existing.coverUrl)
    }

    return channelRepository.update(id, data)
  }

  async delete(id: number) {
    const existing = await channelRepository.findById(id)
    if (!existing) {
      throw new Error('채널을 찾을 수 없습니다.')
    }

    // 채널에 연결된 PublishedProduct 조회
    const publishedProducts = await prisma.publishedProduct.findMany({
      where: { channelId: id },
      select: { id: true },
    })
    const publishedProductIds = publishedProducts.map((p) => p.id)

    if (publishedProductIds.length > 0) {
      // 주문이 있는지 확인 (주문이 있으면 삭제 불가)
      const orderCount = await prisma.orderItem.count({
        where: { publishedProductId: { in: publishedProductIds } },
      })
      if (orderCount > 0) {
        throw new Error(`이 채널에 ${orderCount}건의 주문이 있어 삭제할 수 없습니다. 먼저 주문을 처리해주세요.`)
      }

      // Inquiry의 publishedProductId를 null로 설정
      await prisma.inquiry.updateMany({
        where: { publishedProductId: { in: publishedProductIds } },
        data: { publishedProductId: null },
      })

      // CartItem 삭제 (또는 cascade로 자동 삭제됨)
      await prisma.cartItem.deleteMany({
        where: { publishedProductId: { in: publishedProductIds } },
      })

      // PublishedProduct 삭제
      await prisma.publishedProduct.deleteMany({
        where: { channelId: id },
      })
    }

    // 채널 이미지 파일 삭제 (있는 경우)
    if (existing.coverUrl) {
      await deleteChannelImageFile(existing.coverUrl)
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
