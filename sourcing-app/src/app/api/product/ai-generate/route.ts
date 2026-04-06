export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { transformPostToProduct } from '@/modules/transformation'
import { settingsService } from '@/modules/config/domain/src/settings'
import prisma, { AiProvider } from '@bandauto/db'

// =============================================
// MODEL-SPECIFIC RATE LIMITS
// =============================================

interface ModelRateLimit {
  rpm: number
  tpm: number
  rpd: number
}

const GEMINI_RATE_LIMITS: Record<string, ModelRateLimit> = {
  'gemini-2.5-flash': { rpm: 5, tpm: 250000, rpd: 20 },
  'gemini-2.5-flash-lite': { rpm: 10, tpm: 250000, rpd: 20 },
  'gemini-3-flash': { rpm: 5, tpm: 250000, rpd: 20 },
  'default': { rpm: 5, tpm: 250000, rpd: 20 },
}

const OPENAI_RATE_LIMITS: Record<string, ModelRateLimit> = {
  'gpt-4o': { rpm: 500, tpm: 800000, rpd: 10000 },
  'gpt-4o-mini': { rpm: 500, tpm: 2000000, rpd: 10000 },
  'gpt-4.1-mini': { rpm: 500, tpm: 2000000, rpd: 10000 },
  'gpt-4.1-nano': { rpm: 500, tpm: 2000000, rpd: 10000 },
  'gpt-4-turbo': { rpm: 500, tpm: 800000, rpd: 10000 },
  'default': { rpm: 60, tpm: 150000, rpd: 10000 },
}

function getModelRateLimit(provider: AiProvider, model: string): ModelRateLimit {
  if (provider === AiProvider.GEMINI) {
    return GEMINI_RATE_LIMITS[model] || GEMINI_RATE_LIMITS['default']
  } else if (provider === AiProvider.OPENAI) {
    return OPENAI_RATE_LIMITS[model] || OPENAI_RATE_LIMITS['default']
  }
  return { rpm: 5, tpm: 250000, rpd: 20 }
}

/**
 * 로컬 날짜 문자열 반환 (YYYY-MM-DD)
 */
function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * DB 저장용 로컬 날짜 생성 (UTC 변환 시 날짜가 밀리지 않도록 정오 기준)
 * 로컬 00:00 → UTC 변환 시 하루 전이 될 수 있음
 * 로컬 12:00 → UTC 변환 시에도 같은 날짜 유지
 */
function getLocalNoonDate(): Date {
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  return now
}

/**
 * 일일 사용량 체크 및 리셋
 */
async function checkAndResetDailyUsage(aiConfigId: number): Promise<number> {
  const now = new Date()
  const todayStr = getLocalDateString(now) // 로컬 시간 기준 "2025-12-18"

  const aiConfig = await prisma.aiApiConfig.findUnique({
    where: { id: aiConfigId },
    select: { dailyUsageCount: true, dailyResetDate: true },
  })

  if (!aiConfig) return 0

  // DB에서 가져온 날짜를 로컬 날짜 문자열로 변환
  const resetDateStr = aiConfig.dailyResetDate
    ? getLocalDateString(new Date(aiConfig.dailyResetDate))
    : null

  console.log('[Daily Usage Check]', {
    todayStr,
    resetDateStr,
    currentCount: aiConfig.dailyUsageCount,
    needsReset: resetDateStr !== todayStr
  })

  if (resetDateStr !== todayStr) {
    await prisma.aiApiConfig.update({
      where: { id: aiConfigId },
      data: {
        dailyUsageCount: 0,
        dailyResetDate: getLocalNoonDate(),  // UTC 변환 시에도 같은 날짜 유지
      },
    })
    console.log('[Daily Usage Check] Reset to 0')
    return 0
  }

  return aiConfig.dailyUsageCount
}

/**
 * POST /api/product/ai-generate
 *
 * Generate product draft from post using AI
 *
 * Request Body:
 * - postId: number - Post ID to transform
 * - aiProvider?: 'GEMINI' | 'OPENAI' - AI provider (optional, uses user's active config if not provided)
 * - policyContent?: string - 가격 정책 내용 (DB에서 가져온 정책 content)
 *
 * Response:
 * - success: boolean
 * - draft?: ProductDraft - Generated product draft
 * - error?: string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postId, aiProvider, policyContent } = body

    console.log('[AI Product Generation] Request:', { postId, aiProvider, hasPolicy: !!policyContent })

    // Authentication
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    // Validate input
    if (!postId) {
      return NextResponse.json(
        { success: false, error: 'postId가 필요합니다.' },
        { status: 400 }
      )
    }

    // Fetch collected post with images
    const post = await prisma.collectedPost.findUnique({
      where: {
        id: postId,
        userId, // Ensure user owns the post
      },
      include: {
        images: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    })

    if (!post) {
      return NextResponse.json(
        { success: false, error: '게시물을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Note: 가공상품이 생성되면 CollectedPost가 삭제되므로
    // 위의 findUnique에서 자연스럽게 404가 반환됨 (중복 생성 방지)

    // Get AI config - aiProvider가 없으면 가장 최근에 업데이트된 활성 설정 사용
    let aiConfig
    if (aiProvider) {
      aiConfig = await prisma.aiApiConfig.findFirst({
        where: {
          userId,
          provider: aiProvider,
          isActive: true,
        },
      })
    } else {
      // 가장 최근에 업데이트된 활성 AI 설정 조회
      aiConfig = await prisma.aiApiConfig.findFirst({
        where: {
          userId,
          isActive: true,
        },
        orderBy: { updatedAt: 'desc' },
      })
    }

    if (!aiConfig) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI 설정이 없습니다. 환경 설정에서 AI를 설정해주세요.',
        },
        { status: 400 }
      )
    }

    console.log('[AI Product Generation] Using AI config:', {
      provider: aiConfig.provider,
      model: aiConfig.model,
    })

    // RPD 제한 체크
    const rateLimit = getModelRateLimit(aiConfig.provider, aiConfig.model)
    const currentDailyUsage = await checkAndResetDailyUsage(aiConfig.id)

    console.log('[AI Product Generation] Daily usage:', `${currentDailyUsage}/${rateLimit.rpd} RPD`)

    if (currentDailyUsage >= rateLimit.rpd) {
      return NextResponse.json(
        {
          success: false,
          error: `일일 API 호출 한도(${rateLimit.rpd}회)에 도달했습니다. 내일 다시 시도해주세요.`,
          code: 'RPD_LIMIT_EXCEEDED',
          dailyUsage: currentDailyUsage,
          dailyLimit: rateLimit.rpd,
        },
        { status: 429 }
      )
    }

    // Get custom prompt if exists
    const promptConfig = await settingsService.getPromptByType(userId, 'product_extraction')
    const customPrompt = promptConfig?.prompt || undefined
    console.log('[AI Product Generation] Custom prompt:', customPrompt ? '사용자 정의 프롬프트 사용' : '기본 프롬프트 사용')

    // Transform post to product using AI
    const config = aiConfig.config as any
    const draft = await transformPostToProduct({
      post,
      aiProvider: aiConfig.provider,
      aiConfig: {
        apiKey: aiConfig.apiKey,
        model: aiConfig.model,
        temperature: config?.temperature || 0.7,
      },
      policyContent: policyContent || undefined,
      customPrompt,
    })

    console.log('[AI Product Generation] Draft generated:', {
      name: draft.name,
      optionCount: draft.options.length,
      variantCount: draft.variants.length,
    })

    // 가격 정책 적용 로깅 (경고만, 실패 처리하지 않음)
    // 가격 정책에서 "판매가 그대로 사용" 등의 조건이 있을 수 있으므로
    // wholesalePrice === price 인 경우도 정책에 따른 정상 결과일 수 있음
    if (policyContent && draft.variants && draft.variants.length > 0) {
      const samePriceVariants = draft.variants.filter(v =>
        v.wholesalePrice !== undefined &&
        v.wholesalePrice !== null &&
        v.price !== undefined &&
        v.wholesalePrice === v.price
      )

      if (samePriceVariants.length > 0) {
        const options = samePriceVariants.map(v => v.optionSummary || '기본').join(', ')
        console.log(`[AI Product Generation] 참고: ${samePriceVariants.length}개 옵션의 도매가와 소매가 동일 (${options}) - 가격 정책에 따른 정상 결과일 수 있음`)
      }
    }

    // Update AI config usage (총 사용량 + 일일 사용량)
    await prisma.aiApiConfig.update({
      where: { id: aiConfig.id },
      data: {
        usageCount: { increment: 1 },
        dailyUsageCount: { increment: 1 },
        dailyResetDate: getLocalNoonDate(),  // UTC 변환 시에도 같은 날짜 유지
        lastUsedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      draft,
    })
  } catch (error: any) {
    console.error('[AI Product Generation] Error:', error)

    // Handle transformation errors
    if (error.name === 'ProductTransformationError') {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'AI 상품 생성 중 오류가 발생했습니다.',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
