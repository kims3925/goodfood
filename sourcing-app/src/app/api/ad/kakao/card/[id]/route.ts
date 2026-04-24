/**
 * PATCH /api/ad/kakao/card/[id]
 *
 * 미리보기 모달에서 사용자가 편집한 카드 내용 저장 + PNG 재합성.
 * GET — 단일 카드 조회 (미리보기 페이지용)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { KakaoSendStatus } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { renderAdCard, cleanupAdCardFile } from '@/modules/ad-composer/ad-card-renderer'
import type { AdTitleColor } from '@/modules/ad-composer/templates/kakao-ad-card.html'

export const dynamic = 'force-dynamic'

const VALID_COLORS: AdTitleColor[] = ['red', 'blue', 'green']

interface PatchBody {
  title?: string
  titleColor?: AdTitleColor
  subtitle?: string
  bannerText?: string | null
  ribbonText?: string | null
  saleBadge?: boolean
  descriptionHtml?: string
  priceText?: string
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })

  const card = await prisma.kakaoAdCard.findFirst({
    where: { id, userId: user.userId },
  })
  if (!card) return NextResponse.json({ success: false, error: '카드를 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ success: true, card })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })

  let body: PatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 JSON 본문' }, { status: 400 })
  }

  const existing = await prisma.kakaoAdCard.findFirst({
    where: { id, userId: user.userId },
  })
  if (!existing) return NextResponse.json({ success: false, error: '카드를 찾을 수 없습니다.' }, { status: 404 })

  const titleColor = body.titleColor && VALID_COLORS.includes(body.titleColor)
    ? body.titleColor
    : existing.titleColor

  const data = {
    title: body.title?.trim() ?? existing.title,
    titleColor,
    subtitle: body.subtitle?.trim() ?? existing.subtitle,
    bannerText: body.bannerText !== undefined ? (body.bannerText?.trim() || null) : existing.bannerText,
    ribbonText: body.ribbonText !== undefined ? (body.ribbonText?.trim() || null) : existing.ribbonText,
    saleBadge: body.saleBadge ?? existing.saleBadge,
    descriptionHtml: body.descriptionHtml ?? existing.descriptionHtml,
    priceText: body.priceText?.trim() ?? existing.priceText,
    aiGenerated: false,
    editedAt: new Date(),
    sendStatus: KakaoSendStatus.PREVIEW,
  }

  const updated = await prisma.kakaoAdCard.update({ where: { id }, data })

  // 기존 PNG 정리 + 재합성
  cleanupAdCardFile(existing.renderedPngPath)
  let newPath: string | null = null
  try {
    const rendered = await renderAdCard({
      cardId: updated.id,
      imageUrlOrPath: updated.sourceImageUrl,
      card: {
        title: updated.title,
        titleColor: updated.titleColor as AdTitleColor,
        subtitle: updated.subtitle,
        bannerText: updated.bannerText,
        ribbonText: updated.ribbonText,
        saleBadge: updated.saleBadge,
        productName: updated.productName,
        descriptionText: updated.descriptionHtml,
        priceText: updated.priceText,
      },
    })
    newPath = rendered.filePath
    await prisma.kakaoAdCard.update({
      where: { id: updated.id },
      data: { renderedPngPath: newPath },
    })
  } catch (err: any) {
    console.warn(`[ad-card PATCH] 재렌더 실패 (${id})`, err?.message || err)
  }

  return NextResponse.json({
    success: true,
    card: { ...updated, renderedPngPath: newPath },
    rerendered: !!newPath,
  })
}
