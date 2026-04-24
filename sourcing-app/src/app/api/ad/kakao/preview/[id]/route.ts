/**
 * GET /api/ad/kakao/preview/[id]
 *
 * 카드의 렌더된 PNG 이미지 스트림. <img src="/api/ad/kakao/preview/123"> 형태로 사용.
 * PNG 파일이 없거나(서버 재시작 등) 만료됐으면 즉석 재합성.
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { renderAdCard } from '@/modules/ad-composer/ad-card-renderer'
import type { AdTitleColor } from '@/modules/ad-composer/templates/kakao-ad-card.html'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return new NextResponse('Bad Request', { status: 400 })

  const card = await prisma.kakaoAdCard.findFirst({
    where: { id, userId: user.userId },
  })
  if (!card) return new NextResponse('Not Found', { status: 404 })

  let path = card.renderedPngPath
  let buf: Buffer | null = null

  if (path && fs.existsSync(path)) {
    try {
      buf = fs.readFileSync(path)
    } catch {
      buf = null
    }
  }

  if (!buf) {
    try {
      const rendered = await renderAdCard({
        cardId: card.id,
        imageUrlOrPath: card.sourceImageUrl,
        card: {
          title: card.title,
          titleColor: card.titleColor as AdTitleColor,
          subtitle: card.subtitle,
          bannerText: card.bannerText,
          ribbonText: card.ribbonText,
          saleBadge: card.saleBadge,
          productName: card.productName,
          descriptionText: card.descriptionHtml,
          priceText: card.priceText,
        },
      })
      buf = fs.readFileSync(rendered.filePath)
      await prisma.kakaoAdCard
        .update({ where: { id: card.id }, data: { renderedPngPath: rendered.filePath } })
        .catch(() => {})
    } catch (err: any) {
      console.warn(`[ad-preview] 재렌더 실패 ${id}`, err?.message || err)
      return new NextResponse('Render Failed', { status: 500 })
    }
  }

  // Node Buffer → 신선한 ArrayBuffer (BodyInit 타입 호환)
  const ab = new ArrayBuffer(buf.byteLength)
  new Uint8Array(ab).set(buf)
  return new NextResponse(ab, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'Content-Length': String(buf.length),
    },
  })
}
