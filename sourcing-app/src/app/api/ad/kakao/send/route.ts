/**
 * POST /api/ad/kakao/send
 *
 * Phase 1: 선택한 카드들의 PNG를 ZIP으로 묶어 다운로드 스트림 반환.
 * Phase 2 (추후): 카카오톡 채널 API로 자동 발송.
 *
 * Body:
 *  { batchId: number }         — 배치의 모든 카드
 *  { cardIds: number[] }       — 개별 카드 지정
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import archiver from 'archiver'
import { PassThrough } from 'stream'
import prisma, { KakaoSendStatus } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { renderAdCard } from '@/modules/ad-composer/ad-card-renderer'
import type { AdTitleColor } from '@/modules/ad-composer/templates/kakao-ad-card.html'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface SendBody {
  batchId?: number
  cardIds?: number[]
  /** 'zip' (기본, Phase 1) | 'kakao' (Phase 2, 미구현) */
  mode?: 'zip' | 'kakao'
}

function sanitizeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|\n\r\t]/g, '_').slice(0, 80) || 'card'
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  let body: SendBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 JSON 본문' }, { status: 400 })
  }

  const mode = body.mode ?? 'zip'
  if (mode === 'kakao') {
    return NextResponse.json(
      { success: false, error: '카카오 API 자동 발송은 아직 준비 중입니다. ZIP 다운로드를 사용해주세요.' },
      { status: 501 }
    )
  }

  // 카드 조회
  const where: any = { userId: user.userId }
  if (body.batchId) where.batchId = body.batchId
  else if (body.cardIds && body.cardIds.length > 0) where.id = { in: body.cardIds }
  else {
    return NextResponse.json({ success: false, error: 'batchId 또는 cardIds가 필요합니다.' }, { status: 400 })
  }

  const cards = await prisma.kakaoAdCard.findMany({ where, orderBy: { id: 'asc' } })
  if (cards.length === 0) {
    return NextResponse.json({ success: false, error: '발송할 카드가 없습니다.' }, { status: 404 })
  }

  // 결측 PNG는 즉석 재합성
  const pathByCard = new Map<number, string>()
  for (const c of cards) {
    let p = c.renderedPngPath
    if (!p || !fs.existsSync(p)) {
      try {
        const r = await renderAdCard({
          cardId: c.id,
          imageUrlOrPath: c.sourceImageUrl,
          card: {
            title: c.title,
            titleColor: c.titleColor as AdTitleColor,
            subtitle: c.subtitle,
            bannerText: c.bannerText,
            ribbonText: c.ribbonText,
            saleBadge: c.saleBadge,
            productName: c.productName,
            descriptionText: c.descriptionHtml,
            priceText: c.priceText,
          },
        })
        p = r.filePath
        await prisma.kakaoAdCard
          .update({ where: { id: c.id }, data: { renderedPngPath: p } })
          .catch(() => {})
      } catch (err: any) {
        console.warn(`[ad-send] 재렌더 실패 ${c.id}`, err?.message || err)
        continue
      }
    }
    pathByCard.set(c.id, p!)
  }

  if (pathByCard.size === 0) {
    return NextResponse.json({ success: false, error: 'PNG 합성에 실패했습니다.' }, { status: 500 })
  }

  // ZIP 스트림 구성
  const passthrough = new PassThrough()
  const zip = archiver('zip', { zlib: { level: 6 } })
  zip.on('error', (err) => {
    console.error('[ad-send] archiver 오류', err)
    passthrough.destroy(err)
  })
  zip.pipe(passthrough)

  let idx = 1
  for (const c of cards) {
    const p = pathByCard.get(c.id)
    if (!p) continue
    const baseName = `${String(idx).padStart(2, '0')}_${sanitizeFilename(c.productName || `card-${c.id}`)}.png`
    zip.file(p, { name: baseName })
    idx++
  }
  zip.finalize().catch((err) => console.error('[ad-send] finalize 오류', err))

  // 발송 상태 업데이트 (ZIP 다운로드 = SENT 간주)
  await prisma.kakaoAdCard
    .updateMany({
      where: { id: { in: Array.from(pathByCard.keys()) } },
      data: { sendStatus: KakaoSendStatus.SENT, sentAt: new Date() },
    })
    .catch(() => {})

  if (body.batchId) {
    await prisma.kakaoAdBatch
      .update({
        where: { id: body.batchId },
        data: { sentCount: { increment: pathByCard.size } },
      })
      .catch(() => {})
  }

  const dateLabel = new Date().toISOString().slice(0, 10)
  const filename = `kakao-ads-${dateLabel}.zip`

  return new NextResponse(passthrough as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
