import prisma from '@bandauto/db'
import type { BandListParams, BandCreateInput, BandUpdateInput } from '../types/band.types'

export class RetailBandRepository {
  async findMany(params: BandListParams) {
    const { search = '', page = 1, limit = 10 } = params

    const where = {
      ...(search && {
        name: { contains: search },
      }),
    }

    const total = await prisma.retailBand.count({ where })

    const bands = await prisma.retailBand.findMany({
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
      data: bands,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async findById(id: number) {
    return prisma.retailBand.findFirst({
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

  async findByUserAndBandKey(userId: number, bandKey: string) {
    return prisma.retailBand.findFirst({
      where: {
        userId,
        bandKey,
      },
    })
  }

  async create(data: BandCreateInput) {
    return prisma.retailBand.create({
      data: {
        userId: data.userId,
        apiConfigId: data.apiConfigId,
        bandKey: data.bandKey,
        name: data.name,
        coverUrl: data.coverUrl,
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

  async update(id: number, data: BandUpdateInput) {
    return prisma.retailBand.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
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
    return prisma.retailBand.delete({
      where: { id },
    })
  }
}

export const retailBandRepository = new RetailBandRepository()
