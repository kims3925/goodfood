/**
 * POST /api/shop-builder/import-html
 * body: { html: string, runAiEnrichment?: boolean }
 *
 * HTML 직접 입력 → cheerio 파싱 → (옵션) AI 보강 → PageGenerationJob 저장.
 * Playwright 호출 없음 (URL 임포트보다 빠름).
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { HtmlParserService } from '@/modules/html-import/html-parser.service'
import {
  StructureExtractor,
  createUserAiClient,
} from '@/modules/html-import/structure-extractor'

const MAX_HTML_BYTES = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const html: string | undefined = body?.html
  const runAiEnrichment = Boolean(body?.runAiEnrichment ?? true)

  if (!html || typeof html !== 'string') {
    return NextResponse.json(
      { success: false, error: 'html 문자열이 필요합니다.' },
      { status: 400 }
    )
  }
  if (Buffer.byteLength(html, 'utf-8') > MAX_HTML_BYTES) {
    return NextResponse.json(
      { success: false, error: 'HTML 크기 제한 (5MB) 초과' },
      { status: 413 }
    )
  }

  const job = await prisma.pageGenerationJob.create({
    data: {
      sourceType: 'html',
      sourceHtml: html.slice(0, MAX_HTML_BYTES),
      status: 'parsing',
      createdBy: me.userId,
    },
    select: { id: true },
  })

  try {
    const parser = new HtmlParserService()
    const extracted = parser.parseProductFromHtml(html)

    let enrichedData = extracted
    if (runAiEnrichment) {
      try {
        const aiClient = await createUserAiClient(me.userId)
        const extractor = new StructureExtractor(aiClient)
        enrichedData = await extractor.enrichProductData(extracted)
      } catch (aiErr: any) {
        console.warn('[import-html] AI 보강 스킵:', aiErr?.message)
      }
    }

    await prisma.pageGenerationJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        extractedData: enrichedData as any,
      },
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      data: {
        product: enrichedData,
        layout: null,
        screenshot: null,
      },
    })
  } catch (err: any) {
    console.error('[import-html] 실패:', err)
    await prisma.pageGenerationJob.update({
      where: { id: job.id },
      data: { status: 'failed', errorMessage: err?.message || 'unknown' },
    }).catch(() => {})
    return NextResponse.json(
      { success: false, error: err?.message || 'HTML 파싱 실패' },
      { status: 500 }
    )
  }
}
