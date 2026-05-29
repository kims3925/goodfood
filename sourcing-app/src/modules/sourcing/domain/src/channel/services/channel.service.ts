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

  async getById(id: number, ownerId?: number) {
    const channel = await channelRepository.findById(id)
    // 멀티테넌트 격리: ownerId 전달 시 소유자 불일치면 노출하지 않음 (IDOR 방지)
    if (!channel || (ownerId !== undefined && channel.userId !== ownerId)) {
      return null
    }
    return channel
  }

  async create(userId: number, data: Omit<ChannelCreateInput, 'userId'>) {
    // SMARTSTORE, COUPANG, CUSTOM 플랫폼은 외부 API가 필요 없음
    const platformsRequiringApi: ChannelPlatform[] = [
      ChannelPlatform.BAND,
      ChannelPlatform.ALIEXPRESS,
      ChannelPlatform.NAVER_CAFE,
    ]

    if (platformsRequiringApi.includes(data.platform)) {
      // 사용자의 API 설정이 있는지 검증 (userId + platform으로 조회 가능)
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
    }

    // 중복 체크
    const existing = await channelRepository.findByUserAndChannelKey(userId, data.channelKey)
    if (existing) {
      throw new Error('이미 등록된 채널입니다.')
    }

    return channelRepository.create({
      userId,
      kind: data.kind,
      platform: data.platform,
      channelKey: data.channelKey,
      name: data.name,
      coverUrl: data.coverUrl || null,
    })
  }

  async update(id: number, data: ChannelUpdateInput, ownerId?: number) {
    const existing = await channelRepository.findById(id)
    // 멀티테넌트 격리: ownerId 전달 시 소유자 불일치면 존재하지 않는 것으로 처리 (IDOR 방지)
    if (!existing || (ownerId !== undefined && existing.userId !== ownerId)) {
      throw new Error('채널을 찾을 수 없습니다.')
    }

    // 이미지가 변경되면 기존 이미지 삭제
    if (data.coverUrl !== undefined && existing.coverUrl && existing.coverUrl !== data.coverUrl) {
      await deleteChannelImageFile(existing.coverUrl)
    }

    return channelRepository.update(id, data)
  }

  async delete(id: number, ownerId?: number) {
    const existing = await channelRepository.findById(id)
    // 멀티테넌트 격리: ownerId 전달 시 소유자 불일치면 존재하지 않는 것으로 처리 (IDOR 방지)
    if (!existing || (ownerId !== undefined && existing.userId !== ownerId)) {
      throw new Error('채널을 찾을 수 없습니다.')
    }

    const now = new Date()

    // RETAIL 채널인 경우, 삭제 전에 먼저 isActive를 false로 설정
    // 이렇게 하면 shop-app에서 캐시된 데이터가 있어도 즉시 접속 차단됨
    if (existing.kind === ChannelKind.RETAIL && existing.isActive) {
      await channelRepository.update(id, { isActive: false })
    }

    // 채널에 연결된 ChannelProduct 소프트 삭제 (채널 발행 추적용)
    // 참고: ShopProduct는 Shop과 연결되어 있으므로 채널 삭제와 무관함
    await prisma.channelProduct.updateMany({
      where: {
        channelId: id,
        deletedAt: null,
      },
      data: {
        deletedAt: now,
      },
    })

    // 채널에 연결된 CollectedPost 소프트 삭제
    await prisma.collectedPost.updateMany({
      where: {
        channelId: id,
        deletedAt: null,
      },
      data: {
        deletedAt: now,
      },
    })

    // 채널에 연결된 CollectedProduct 소프트 삭제 (CollectedPost를 통해 연결됨)
    await prisma.collectedProduct.updateMany({
      where: {
        post: {
          channelId: id,
        },
        deletedAt: null,
      },
      data: {
        deletedAt: now,
      },
    })

    // 자동화 설정에서 삭제되는 채널 ID 제거
    await this.removeChannelFromAutomationConfigs(id, existing.kind)

    // 채널 이미지 파일 삭제 (있는 경우)
    if (existing.coverUrl) {
      await deleteChannelImageFile(existing.coverUrl)
    }

    // shop-app 채널 캐시 무효화 (RETAIL 채널만, subdomain이 있는 경우)
    if (existing.kind === ChannelKind.RETAIL && existing.shop?.subdomain) {
      await this.invalidateEcommerceChannelCache(existing.shop.subdomain)
    }

    // 채널 소프트 삭제 (hard delete → soft delete)
    return channelRepository.update(id, {
      isActive: false,
      deletedAt: now,
    })
  }

  // shop-app 채널 캐시 무효화
  private async invalidateEcommerceChannelCache(subdomain: string) {
    try {
      const ecommerceUrl = process.env.ECOMMERCE_APP_URL || 'http://localhost:3000'
      const internalKey = process.env.INTERNAL_API_KEY || 'dev-internal-key'

      const res = await fetch(`${ecommerceUrl}/api/internal/channel/invalidate-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': internalKey,
        },
        body: JSON.stringify({ subdomain }),
      })

      if (res.ok) {
        console.log(`[Channel] shop-app 캐시 무효화 성공: ${subdomain}`)
      } else {
        console.warn(`[Channel] shop-app 캐시 무효화 실패 (HTTP ${res.status}): ${subdomain}`)
      }
    } catch (error) {
      // 캐시 무효화 실패해도 삭제는 진행 (1분 후 자동 만료됨)
      console.warn(`[Channel] shop-app 캐시 무효화 요청 실패: ${subdomain}`, error)
    }
  }

  // 자동화 설정에서 채널 ID 제거
  private async removeChannelFromAutomationConfigs(channelId: number, kind: ChannelKind) {
    // 모든 자동화 설정 조회
    const automationConfigs = await prisma.automationConfig.findMany()

    for (const config of automationConfigs) {
      let updated = false
      const updateData: { channelIds?: string; retailChannelIds?: string } = {}

      // WHOLESALE 채널인 경우 channelIds에서 제거
      if (kind === ChannelKind.WHOLESALE && config.channelIds) {
        try {
          const channelIds: number[] = JSON.parse(config.channelIds)
          const filteredIds = channelIds.filter((id) => id !== channelId)
          if (filteredIds.length !== channelIds.length) {
            updateData.channelIds = JSON.stringify(filteredIds)
            updated = true
          }
        } catch (e) {
          console.error('channelIds 파싱 오류:', e)
        }
      }

      // RETAIL 채널인 경우 retailChannelIds에서 제거
      if (kind === ChannelKind.RETAIL && config.retailChannelIds) {
        try {
          const retailChannelIds: number[] = JSON.parse(config.retailChannelIds)
          const filteredIds = retailChannelIds.filter((id) => id !== channelId)
          if (filteredIds.length !== retailChannelIds.length) {
            updateData.retailChannelIds = JSON.stringify(filteredIds)
            updated = true
          }
        } catch (e) {
          console.error('retailChannelIds 파싱 오류:', e)
        }
      }

      if (updated) {
        await prisma.automationConfig.update({
          where: { id: config.id },
          data: updateData,
        })
        console.log(`자동화 설정(${config.id})에서 채널 ID(${channelId}) 제거 완료`)
      }
    }
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
