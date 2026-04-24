/**
 * POST /api/ad/kakao/generate
 *
 * 카카오톡 광고 카드 생성 — 선택한 상품 N개(1~10)에 대해
 * AI(Claude Haiku)로 콘텐츠 생성 + PNG 합성 + DB 저장
 *
 * 작업지시서: 작업지시서_카카오톡광고_자동생성.md
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { KakaoSendStatus } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { settingsService } from '@/modules/config/domain/src/settings'
import {
  generateAdContentBatch,
  type AdContentInput,
  type AdTitleColor,
} from '@/modules/ad-composer/ad-content-generator'
import {
  renderAdCardsBatch,
  cleanupAdCardFile,
  type RenderAdCardInput,
} from '@/modules/ad-composer/ad-card-renderer'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface GenerateBody {
  productIds: number[]
  date?: string                            // YYYY-MM-DD
  options?: {
    titleMaxLen?: number
    descMaxLen?: number
    forceTitleColor?: AdTitleColor
    enableBanner?: boolean
  }
}

function ymdLocal(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  let body: GenerateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 JSON 본문입니다.' }, { status: 400 })
  }

  const productIds = Array.from(new Set(body.productIds || [])).filter(
    (n): n is number => typeof n === 'number'
  )
  if (productIds.length === 0) {
    return NextResponse.json({ success: false, error: '발행할 상품을 1개 이상 선택하세요.' }, { status: 400 })
  }
  if (productIds.length > 10) {
    return NextResponse.json({ success: false, error: '한 번에 최대 10개까지 생성할 수 있습니다.' }, { status: 400 })
  }

  // Claude API 키 조회
  let apiKey = ''
  let model = 'claude-haiku-4-5-20251001'
  try {
    const ai = await settingsService.getAiSettings(user.userId)
    apiKey = ai.claude?.apiKey || ''
    if (ai.claude?.model && /haiku/i.test(ai.claude.model)) {
      model = ai.claude.model
    }
  } catch (err) {
    console.warn('[ad-generate] AI 설정 조회 실패', err)
  }
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Claude API 키가 설정되지 않았습니다. 설정 > AI/API에서 등록하세요.' },
      { status: 400 }
    )
  }

  // 상품 조회 (선택 순서 유지)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, userId: user.userId, deletedAt: null },
    include: {
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      variants: { where: { deletedAt: null }, orderBy: { id: 'asc' } },
    },
  })
  const productMap = new Map(products.map((p) => [p.id, p]))
  const ordered = productIds.map((id) => productMap.get(id)).filter(Boolean) as typeof products
  if (ordered.length === 0) {
    return NextResponse.json({ success: false, error: '선택한 상품을 찾을 수 없습니다.' }, { status: 404 })
  }

  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : ymdLocal()
  const startedAt = Date.now()

  // 1) AI 콘텐츠 생성 (병렬 3개씩)
  const aiInputs: AdContentInput[] = ordered.map((p) => ({
    productId: p.id,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    price: p.price,
    variants: p.variants.map((v) => ({ optionSummary: v.optionSummary, price: v.price })),
  }))
  const aiResults = await generateAdContentBatch(aiInputs, {
    apiKey,
    model,
    forceTitleColor: body.options?.forceTitleColor,
    enableBanner: body.options?.enableBanner ?? true,
    titleMaxLen: body.options?.titleMaxLen ?? 20,
    descMaxLen: body.options?.descMaxLen ?? 220,
  })

  // 2) 배치 + 카드 DB upsert (트랜잭션)
  const cardIds: number[] = []
  const renderInputs: RenderAdCardInput[] = []

  await prisma.$transaction(async (tx) => {
    const batch = await tx.kakaoAdBatch.upsert({
      where: { userId_date: { userId: user.userId, date } },
      create: {
        userId: user.userId,
        date,
        cardCount: aiResults.length,
      },
      update: {
        cardCount: { increment: aiResults.length },
      },
    })

    for (let i = 0; i < aiResults.length; i++) {
      const r = aiResults[i]
      const p = ordered[i]
      const sourceImageUrl = p.images[0]?.url || ''
      const created = await tx.kakaoAdCard.create({
        data: {
          userId: user.userId,
          productId: r.productId,
          batchId: batch.id,
          title: r.title,
          titleColor: r.titleColor,
          subtitle: r.subtitle,
          bannerText: r.bannerText,
          ribbonText: r.ribbonText,
          saleBadge: false,
          productName: r.productName,
          descriptionHtml: r.descriptionHtml,
          priceText: r.priceText,
          sourceImageUrl,
          aiGenerated: r.aiGenerated,
          aiTokensUsed: r.tokensUsed,
          sendStatus: KakaoSendStatus.DRAFT,
        },
      })
      cardIds.push(created.id)
      renderInputs.push({
        cardId: created.id,
        imageUrlOrPath: sourceImageUrl || null,
        card: {
          title: r.title,
          titleColor: r.titleColor,
          subtitle: r.subtitle,
          bannerText: r.bannerText,
          ribbonText: r.ribbonText,
          saleBadge: false,
          productName: r.productName,
          descriptionText: r.descriptionHtml,
          priceText: r.priceText,
        },
      })
    }
  })

  // 3) PNG 렌더 (DB 트랜잭션 밖에서 실행 — 길어질 수 있음)
  const rendered = await renderAdCardsBatch(renderInputs)

  // 렌더 결과를 DB에 반영
  for (const r of rendered) {
    await prisma.kakaoAdCard
      .update({
        where: { id: r.cardId },
        data: { renderedPngPath: r.filePath, sendStatus: KakaoSendStatus.PREVIEW },
      })
      .catch((err) => console.warn(`[ad-generate] update render path 실패 ${r.cardId}`, err))
  }

  // 4) 미리보기용 응답
  const cards = await prisma.kakaoAdCard.findMany({
    where: { id: { in: cardIds } },
    orderBy: { id: 'asc' },
  })

  const totalDurationSec = Math.round((Date.now() - startedAt) / 1000)
  await prisma.kakaoAdBatch
    .updateMany({
      where: { userId: user.userId, date },
      data: { totalDurationSec },
    })
    .catch(() => {})

  const renderedSet = new Set(rendered.map((r) => r.cardId))

  return NextResponse.json({
    success: true,
    batch: { date, totalDurationSec, generatedCount: cards.length, renderedCount: rendered.length },
    cards: cards.map((c) => ({
      id: c.id,
      productId: c.productId,
      title: c.title,
      titleColor: c.titleColor,
      subtitle: c.subtitle,
      bannerText: c.bannerText,
      ribbonText: c.ribbonText,
      saleBadge: c.saleBadge,
      productName: c.productName,
      descriptionHtml: c.descriptionHtml,
      priceText: c.priceText,
      sourceImageUrl: c.sourceImageUrl,
      previewUrl: `/api/ad/kakao/preview/${c.id}`,
      hasRendered: renderedSet.has(c.id),
      aiGenerated: c.aiGenerated,
      sendStatus: c.sendStatus,
    })),
  })
}
