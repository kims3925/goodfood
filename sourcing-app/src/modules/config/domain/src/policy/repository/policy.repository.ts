import prisma from '@bandauto/db'
import type { PolicyListParams, PolicyCreateInput, PolicyUpdateInput } from '../types/policy.types'

export class PolicyRepository {
  async findMany(params: PolicyListParams) {
    const { userId, search = '', page = 1, limit = 10 } = params

    const where = {
      userId,
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
        ],
      }),
    }

    const total = await prisma.pricingPolicy.count({ where })

    const policies = await prisma.pricingPolicy.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      data: policies,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async findById(id: number) {
    return prisma.pricingPolicy.findFirst({
      where: { id },
    })
  }

  async create(data: PolicyCreateInput) {
    return prisma.pricingPolicy.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description,
        content: data.content,
        isActive: data.isActive ?? true,
      },
    })
  }

  async update(id: number, data: PolicyUpdateInput) {
    return prisma.pricingPolicy.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.content && { content: data.content }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
  }

  async delete(id: number) {
    return prisma.pricingPolicy.delete({
      where: { id },
    })
  }
}

export const policyRepository = new PolicyRepository()
