import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { transformPostToProduct } from '@/modules/transformation'
import { settingsService } from '@/modules/config/domain/src/settings'
import prisma from '@bandauto/db'

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

    // Get AI config
    const aiConfigProvider = aiProvider || 'GEMINI'
    const aiConfig = await prisma.aiApiConfig.findFirst({
      where: {
        userId,
        provider: aiConfigProvider,
        isActive: true,
      },
    })

    if (!aiConfig) {
      return NextResponse.json(
        {
          success: false,
          error: `${aiConfigProvider} AI 설정이 없습니다. 환경 설정에서 AI를 설정해주세요.`,
        },
        { status: 400 }
      )
    }

    console.log('[AI Product Generation] Using AI config:', {
      provider: aiConfig.provider,
      model: aiConfig.model,
    })

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

    // Update AI config usage
    await prisma.aiApiConfig.update({
      where: { id: aiConfig.id },
      data: {
        usageCount: {
          increment: 1,
        },
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
