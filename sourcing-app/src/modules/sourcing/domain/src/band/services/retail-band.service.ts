import prisma from '@bandauto/db'
import { retailBandRepository } from '../repository/retail-band.repository'
import type { BandListParams, BandUpdateInput } from '../types/band.types'

export class RetailBandService {
  async getList(params: BandListParams) {
    return retailBandRepository.findMany(params)
  }

  async getById(id: number) {
    return retailBandRepository.findById(id)
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
    const existing = await retailBandRepository.findByUserAndBandKey(userId, data.bandKey)
    if (existing) {
      throw new Error('이미 등록된 밴드입니다.')
    }

    return retailBandRepository.create({
      userId,
      apiConfigId: apiConfig.id,
      bandKey: data.bandKey,
      name: data.name,
      coverUrl: data.coverUrl || null,
    })
  }

  async update(id: number, data: BandUpdateInput) {
    const existing = await retailBandRepository.findById(id)
    if (!existing) {
      throw new Error('밴드를 찾을 수 없습니다.')
    }

    return retailBandRepository.update(id, data)
  }

  async delete(id: number) {
    const existing = await retailBandRepository.findById(id)
    if (!existing) {
      throw new Error('밴드를 찾을 수 없습니다.')
    }

    return retailBandRepository.delete(id)
  }
}

export const retailBandService = new RetailBandService()
