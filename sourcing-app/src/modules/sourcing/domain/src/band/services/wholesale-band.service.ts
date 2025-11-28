import prisma from '@bandauto/db'
import { wholesaleBandRepository } from '../repository/wholesale-band.repository'
import type { BandListParams, BandUpdateInput } from '../types/band.types'

export class WholesaleBandService {
  async getList(params: BandListParams) {
    return wholesaleBandRepository.findMany(params)
  }

  async getById(id: number) {
    return wholesaleBandRepository.findById(id)
  }

  async create(userId: number, data: { bandKey: string; name: string; coverUrl?: string }) {
    // 사용자의 Band API 설정 조회
    const apiConfig = await prisma.sourcingApiConfig.findFirst({
      where: {
        userId,
        platform: 'BAND',
        isActive: true,
      },
    })

    if (!apiConfig) {
      throw new Error('Band API 설정을 먼저 등록해주세요.')
    }

    // 중복 체크
    const existing = await wholesaleBandRepository.findByUserAndBandKey(userId, data.bandKey)
    if (existing) {
      throw new Error('이미 등록된 밴드입니다.')
    }

    return wholesaleBandRepository.create({
      userId,
      apiConfigId: apiConfig.id,
      bandKey: data.bandKey,
      name: data.name,
      coverUrl: data.coverUrl || null,
    })
  }

  async update(id: number, data: BandUpdateInput) {
    const existing = await wholesaleBandRepository.findById(id)
    if (!existing) {
      throw new Error('밴드를 찾을 수 없습니다.')
    }

    return wholesaleBandRepository.update(id, data)
  }

  async delete(id: number) {
    const existing = await wholesaleBandRepository.findById(id)
    if (!existing) {
      throw new Error('밴드를 찾을 수 없습니다.')
    }

    return wholesaleBandRepository.delete(id)
  }
}

export const wholesaleBandService = new WholesaleBandService()
