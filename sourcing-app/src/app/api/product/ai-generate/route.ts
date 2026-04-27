export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { transformPostToProduct } from '@/modules/transformation'
import { settingsService } from '@/modules/config/domain/src/settings'
import prisma, { AiProvider } from '@bandauto/db'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'

function expandHomePath(p: string): string {
  if (p.startsWith('~/')) return path.join(process.env.HOME || '/home/ubuntu', p.slice(2))
  return p
}

/**
 * Gemini Vision으로 이미지에 가격 텍스트가 포함되어 있는지 판별
 */
async function hasImagePriceText(apiKey: string, imageBuffer: Buffer, mimeType: string): Promise<boolean> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString('base64'),
            },
          },
          {
            text: '이 이미지에 상품 가격 정보(숫자+원, ₩, 공급가, 판매가 등 금액 텍스트)가 포함되어 있나요? "YES" 또는 "NO"로만 답해주세요.',
          },
        ],
      }],
    })

    const answer = result.response.text().trim().toUpperCase()
    return answer.includes('YES')
  } catch (error) {
    console.error('[Image Price Check] Error:', error)
    return false // 에러 시 삭제하지 않음 (안전하게)
  }
}

/**
 * 게시물 이미지 중 가격 텍스트가 포함된 이미지를 삭제
 */
async function filterPriceImages(apiKey: string, postId: number): Promise<number> {
  const images = await prisma.collectedPostImage.findMany({
    where: { postId },
    orderBy: { sortOrder: 'asc' },
  })

  if (images.length === 0) return 0

  const storagePath = process.env.POST_IMAGE_STORAGE_PATH || 'assets/images/post'
  const imagesDir = expandHomePath(storagePath)
  let deletedCount = 0

  for (const image of images) {
    // URL에서 파일명 추출
    const parts = image.url.split('/')
    const fileName = parts[parts.length - 1]
    const filePath = path.join(imagesDir, fileName)

    // 파일이 존재하면 읽기
    if (!fs.existsSync(filePath)) continue

    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(fileName).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'

    const hasPrice = await hasImagePriceText(apiKey, buffer, mimeType)

    if (hasPrice) {
      // DB에서 이미지 레코드 삭제
      await prisma.collectedPostImage.delete({ where: { id: image.id } })
      // 파일도 삭제
      try { fs.unlinkSync(filePath) } catch { /* ignore */ }
      deletedCount++
      console.log(`[Image Price Filter] 가격 이미지 삭제: ${fileName} (postId: ${postId})`)
    }
  }

  return deletedCount
}

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

// Claude는 Anthropic API의 tier 기반 사용량 제어를 따른다(분당/토큰 한도가 실질 제약).
// 우리 앱이 인위적으로 RPD를 좁히면 사용자 등록한 키의 가용량이 무력화되므로
// OpenAI와 유사한 수준으로 lenient하게 설정.
const CLAUDE_RATE_LIMITS: Record<string, ModelRateLimit> = {
  'claude-haiku-4-5-20251001': { rpm: 60, tpm: 200000, rpd: 10000 },
  'claude-haiku-4-5': { rpm: 60, tpm: 200000, rpd: 10000 },
  'claude-sonnet-4-6': { rpm: 60, tpm: 200000, rpd: 5000 },
  'claude-opus-4-7': { rpm: 50, tpm: 200000, rpd: 2000 },
  // 레거시/비공식 모델 ID도 고려해 default 자체를 충분히 넓게
  'default': { rpm: 60, tpm: 200000, rpd: 5000 },
}

function getModelRateLimit(provider: AiProvider, model: string): ModelRateLimit {
  if (provider === AiProvider.GEMINI) {
    return GEMINI_RATE_LIMITS[model] || GEMINI_RATE_LIMITS['default']
  } else if (provider === AiProvider.OPENAI) {
    return OPENAI_RATE_LIMITS[model] || OPENAI_RATE_LIMITS['default']
  } else if (provider === AiProvider.CLAUDE) {
    return CLAUDE_RATE_LIMITS[model] || CLAUDE_RATE_LIMITS['default']
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

    // Fetch collected post with images and comments
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
        comments: {
          orderBy: {
            createdAt: 'asc',
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

    // ── SD푸드 특수 처리: 댓글 공급가 추출 + 본문 판매가 검사 ──
    const isSdFoodSpecial = policyContent?.includes('공급가_출처: 댓글에서 추출') ?? false
    let sdFoodSupplyPrice: number | null = null
    let sdFoodHasBodyPrice = false

    if (isSdFoodSpecial) {
      // 1) 본문에 판매가 키워드 + 금액 패턴 확인
      const bodyPriceMatch = post.content.match(
        /(?:판매가|판매\s*가격|Price)[\s:：]*(\d[\d,]*)\s*원/
      )
      sdFoodHasBodyPrice = !!bodyPriceMatch

      // 2) 본문에 판매가 없으면 → 댓글에서 공급가 추출
      if (!sdFoodHasBodyPrice && post.comments && post.comments.length > 0) {
        for (const comment of post.comments) {
          const supplyMatch = comment.content.match(
            /(?:공급가|원가|공급\s*가격)[\s:：]*(\d[\d,]*)\s*원/
          )
          if (supplyMatch) {
            sdFoodSupplyPrice = parseInt(supplyMatch[1].replace(/,/g, ''), 10)
            break // 첫 번째 매칭 사용
          }
        }
      }

      console.log('[AI Product Generation] SD푸드 특수 처리:', {
        hasBodyPrice: sdFoodHasBodyPrice,
        supplyPrice: sdFoodSupplyPrice,
        commentCount: post.comments?.length ?? 0,
      })
    }

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
      sdFoodContext: isSdFoodSpecial
        ? {
            hasBodyPrice: sdFoodHasBodyPrice,
            supplyPrice: sdFoodSupplyPrice,
            comments: (post.comments ?? []).map((c) => ({ author: c.author, content: c.content })),
          }
        : undefined,
    })

    console.log('[AI Product Generation] Draft generated:', {
      name: draft.name,
      optionCount: draft.options.length,
      variantCount: draft.variants.length,
    })

    // ── 가격 기준 옵션(variants) 필터링 ──
    // 1) 모든 채널: 판매가 100,000원 이상 옵션 제외 (글로벌 상한)
    // 2) BRACKET_MARGIN (가족도매방/초록이네): 정책 excludeAbove(40001원) 이상 옵션 제외
    // 3) 모든 옵션이 제외되면 가공 실패 처리 (상품 생성 불가)
    const GLOBAL_MAX_PRICE = 100000
    let policyExcludeAbove: number | null = null
    if (policyContent) {
      // BRACKET_MARGIN 정책의 "40001원 이상 제외" 패턴 추출
      const exMatch = policyContent.match(/(\d[\d,]*)\s*원?\s*이상\s*제외/)
      if (exMatch) {
        policyExcludeAbove = parseInt(exMatch[1].replace(/,/g, ''), 10)
      }
    }

    if (draft.variants && draft.variants.length > 0) {
      const originalCount = draft.variants.length
      const filteredVariants = draft.variants.filter((v: any) => {
        const price = typeof v.price === 'number' ? v.price : parseInt(String(v.price ?? '0').replace(/[^0-9]/g, ''), 10) || 0
        if (price <= 0) return true // 가격 미상 옵션은 통과
        if (price >= GLOBAL_MAX_PRICE) return false
        if (policyExcludeAbove !== null && price >= policyExcludeAbove) return false
        return true
      })

      const removedCount = originalCount - filteredVariants.length
      if (removedCount > 0) {
        console.log(`[AI Product Generation] 가격 필터: ${removedCount}개 옵션 제외 (글로벌 ${GLOBAL_MAX_PRICE.toLocaleString()}원${policyExcludeAbove ? ` / 정책 ${policyExcludeAbove.toLocaleString()}원` : ''} 이상)`)
      }

      if (filteredVariants.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `모든 옵션이 가격 제한(글로벌 ${GLOBAL_MAX_PRICE.toLocaleString()}원${policyExcludeAbove ? ` / 정책 ${policyExcludeAbove.toLocaleString()}원` : ''} 이상)으로 제외되어 가공할 수 없습니다.`,
            code: 'ALL_VARIANTS_EXCLUDED',
          },
          { status: 400 }
        )
      }

      draft.variants = filteredVariants
    }

    // 단일 상품(variants 없음)인 경우: draft.price 자체를 검증
    if ((!draft.variants || draft.variants.length === 0) && draft.price) {
      const singlePrice = typeof draft.price === 'number' ? draft.price : 0
      if (singlePrice >= GLOBAL_MAX_PRICE || (policyExcludeAbove !== null && singlePrice >= policyExcludeAbove)) {
        return NextResponse.json(
          {
            success: false,
            error: `상품 판매가(${singlePrice.toLocaleString()}원)가 가격 제한(글로벌 ${GLOBAL_MAX_PRICE.toLocaleString()}원${policyExcludeAbove ? ` / 정책 ${policyExcludeAbove.toLocaleString()}원` : ''} 이상)을 초과하여 가공할 수 없습니다.`,
            code: 'PRICE_EXCEEDS_LIMIT',
          },
          { status: 400 }
        )
      }
    }

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

    // 가격 이미지 필터링: 임시 비활성화 (2026-04-11)
    // 사유: Gemini Vision 오탐으로 정상 상품 이미지가 대량 삭제되는 사고 발생
    // 재활성화 시 테스트 환경에서 정확도 검증 후 신중하게 적용할 것
    // try {
    //   const deletedImages = await filterPriceImages(aiConfig.apiKey, postId)
    //   if (deletedImages > 0) {
    //     console.log(`[AI Product Generation] 가격 이미지 ${deletedImages}개 삭제 (postId: ${postId})`)
    //   }
    // } catch (filterError) {
    //   console.error('[AI Product Generation] 이미지 필터링 실패 (무시):', filterError)
    // }

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
