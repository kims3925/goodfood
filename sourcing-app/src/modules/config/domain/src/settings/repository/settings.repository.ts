import prisma from '@bandauto/db'

export class SettingsRepository {
  // API Config
  async findApiConfigs(userId: number) {
    return prisma.sourcingApiConfig.findMany({
      where: { userId },
    })
  }

  async findApiConfigByPlatform(userId: number, platform: string) {
    return prisma.sourcingApiConfig.findFirst({
      where: { userId, platform: platform as any },
    })
  }

  async upsertApiConfig(userId: number, platform: string, data: any) {
    const existing = await this.findApiConfigByPlatform(userId, platform)

    if (existing) {
      return prisma.sourcingApiConfig.update({
        where: { id: existing.id },
        data,
      })
    }

    return prisma.sourcingApiConfig.create({
      data: {
        userId,
        platform,
        ...data,
      },
    })
  }

  // AI Config
  async findAiConfigs(userId: number) {
    return prisma.aiApiConfig.findMany({
      where: { userId },
    })
  }

  async findAiConfigByProvider(userId: number, provider: string) {
    return prisma.aiApiConfig.findFirst({
      where: { userId, provider: provider as any },
    })
  }

  async upsertAiConfig(userId: number, provider: string, data: any) {
    const existing = await this.findAiConfigByProvider(userId, provider)

    if (existing) {
      return prisma.aiApiConfig.update({
        where: { id: existing.id },
        data,
      })
    }

    return prisma.aiApiConfig.create({
      data: {
        userId,
        provider: provider as any,
        ...data,
      },
    })
  }
}

export const settingsRepository = new SettingsRepository()
