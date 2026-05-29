import prisma from '@bandauto/db'
import type {
  PolicyListParams,
  PolicyCreateInput,
  PolicyUpdateInput,
  PolicyTargetInput,
} from '../types/policy.types'

// targets include 옵션 — findMany/findById 양쪽 공통
// 경영밴드 이원화 정책: 소매채널 정보 (id/name/kind) 포함해서 카드 표시에 활용
const TARGETS_INCLUDE = {
  include: {
    retailChannel: {
      select: {
        id: true,
        name: true,
        kind: true,
      },
    },
  },
} as const

const CHANNEL_INCLUDE = {
  select: {
    id: true,
    name: true,
    kind: true,
  },
} as const

function normalizeTargets(targets: PolicyTargetInput[] | undefined): PolicyTargetInput[] {
  if (!targets || targets.length === 0) return []
  // unique constraint 보장 — 같은 retailChannelId 중복 시 마지막 값 우선
  const map = new Map<number, PolicyTargetInput>()
  for (const t of targets) {
    map.set(t.retailChannelId, {
      retailChannelId: t.retailChannelId,
      applyMode: t.applyMode ?? 'INHERIT',
      customContent: t.applyMode === 'CUSTOM' ? (t.customContent ?? null) : null,
    })
  }
  return Array.from(map.values())
}

export class PolicyRepository {
  async findMany(params: PolicyListParams) {
    const { userId, channelId, search = '', page = 1, limit = 10 } = params

    const where = {
      userId,
      ...(channelId && { channelId }),
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
      include: {
        channel: CHANNEL_INCLUDE,
        targets: TARGETS_INCLUDE,
      },
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
      include: {
        channel: CHANNEL_INCLUDE,
        targets: TARGETS_INCLUDE,
      },
    })
  }

  async create(data: PolicyCreateInput) {
    const normalizedTargets = normalizeTargets(data.targets)

    return prisma.$transaction(async (tx) => {
      const policy = await tx.pricingPolicy.create({
        data: {
          userId: data.userId,
          channelId: data.channelId,
          name: data.name,
          description: data.description,
          content: data.content,
          isActive: data.isActive ?? true,
          tierRules: data.tierRules as any, // Prisma Json 컬럼 — null/object/stringified 모두 수용
        },
      })

      if (normalizedTargets.length > 0) {
        await tx.pricingPolicyTarget.createMany({
          data: normalizedTargets.map((t) => ({
            pricingPolicyId: policy.id,
            retailChannelId: t.retailChannelId,
            applyMode: t.applyMode,
            customContent: t.customContent ?? null,
          })),
        })
      }

      return tx.pricingPolicy.findFirst({
        where: { id: policy.id },
        include: {
          channel: CHANNEL_INCLUDE,
          targets: TARGETS_INCLUDE,
        },
      })
    })
  }

  async update(id: number, data: PolicyUpdateInput) {
    return prisma.$transaction(async (tx) => {
      await tx.pricingPolicy.update({
        where: { id },
        data: {
          ...(data.channelId && { channelId: data.channelId }),
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.content && { content: data.content }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          // tierRules 는 명시적으로 전달된 경우에만 갱신 (null 도 갱신 의도로 인정)
          ...(data.tierRules !== undefined && { tierRules: data.tierRules as any }),
        },
      })

      // targets 가 명시적으로 전달된 경우에만 재구성. undefined 면 그대로 둠 (하위 호환).
      if (data.targets !== undefined) {
        const normalized = normalizeTargets(data.targets)
        await tx.pricingPolicyTarget.deleteMany({
          where: { pricingPolicyId: id },
        })
        if (normalized.length > 0) {
          await tx.pricingPolicyTarget.createMany({
            data: normalized.map((t) => ({
              pricingPolicyId: id,
              retailChannelId: t.retailChannelId,
              applyMode: t.applyMode,
              customContent: t.customContent ?? null,
            })),
          })
        }
      }

      return tx.pricingPolicy.findFirst({
        where: { id },
        include: {
          channel: CHANNEL_INCLUDE,
          targets: TARGETS_INCLUDE,
        },
      })
    })
  }

  async delete(id: number) {
    return prisma.pricingPolicy.delete({
      where: { id },
    })
  }
}

export const policyRepository = new PolicyRepository()
