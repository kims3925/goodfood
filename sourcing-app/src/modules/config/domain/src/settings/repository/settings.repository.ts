import prisma from '@bandauto/db'

export class SettingsRepository {
  // API Config
  async findApiConfigs(userId: number) {
    return prisma.sourcingApiConfig.findMany({
      where: { userId },
    })
  }

  // AI Prompt Config
  async findPromptConfigs(userId: number) {
    return prisma.aiPromptConfig.findMany({
      where: { userId },
    })
  }

  async findPromptConfigByType(userId: number, promptType: string) {
    return prisma.aiPromptConfig.findFirst({
      where: { userId, promptType },
    })
  }

  async upsertPromptConfig(userId: number, promptType: string, data: {
    name: string
    prompt: string
    description?: string | null
    isActive?: boolean
  }) {
    const existing = await this.findPromptConfigByType(userId, promptType)

    if (existing) {
      return prisma.aiPromptConfig.update({
        where: { id: existing.id },
        data,
      })
    }

    return prisma.aiPromptConfig.create({
      data: {
        userId,
        promptType,
        ...data,
      },
    })
  }

  async deletePromptConfig(userId: number, promptType: string) {
    const existing = await this.findPromptConfigByType(userId, promptType)
    if (existing) {
      return prisma.aiPromptConfig.delete({
        where: { id: existing.id },
      })
    }
    return null
  }

  async findApiConfigByPlatform(userId: number, platform: string) {
    return prisma.sourcingApiConfig.findFirst({
      where: { userId, platform: platform as any },
    })
  }

  // 플랫폼 공용(일괄설정) Band 토큰 — ADMIN role 사용자가 등록한 BAND 설정 중 최신.
  // 일괄설정 모드(useGlobalToken=true) 매니저의 토큰 해석에 사용된다.
  async findGlobalBandConfig() {
    return prisma.sourcingApiConfig.findFirst({
      where: {
        platform: 'BAND',
        isActive: true,
        accessToken: { not: null },
        user: { role: 'ADMIN' },
      },
      orderBy: { updatedAt: 'desc' },
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
    console.log('[upsertAiConfig] userId:', userId, 'provider:', provider, 'data:', data)

    try {
      const existing = await this.findAiConfigByProvider(userId, provider)
      console.log('[upsertAiConfig] existing:', existing)

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
    } catch (error: any) {
      console.error('[upsertAiConfig] Error:', error.message)
      console.error('[upsertAiConfig] Error code:', error.code)
      console.error('[upsertAiConfig] Error meta:', error.meta)
      throw error
    }
  }

  // Google Sheets Config
  async findGoogleSheetConfig(userId: number) {
    return prisma.googleSheetConfig.findUnique({
      where: { userId },
    })
  }

  async upsertGoogleSheetConfig(userId: number, data: {
    serviceAccountJson: string
    spreadsheetId: string
    sheetName?: string | null
    isActive?: boolean
  }) {
    const existing = await this.findGoogleSheetConfig(userId)

    if (existing) {
      return prisma.googleSheetConfig.update({
        where: { id: existing.id },
        data,
      })
    }

    return prisma.googleSheetConfig.create({
      data: {
        userId,
        ...data,
      },
    })
  }

  async deleteGoogleSheetConfig(userId: number) {
    const existing = await this.findGoogleSheetConfig(userId)
    if (existing) {
      return prisma.googleSheetConfig.delete({
        where: { id: existing.id },
      })
    }
    return null
  }

  async updateGoogleSheetLastSynced(userId: number) {
    return prisma.googleSheetConfig.update({
      where: { userId },
      data: { lastSyncedAt: new Date() },
    })
  }
}

export const settingsRepository = new SettingsRepository()
