/**
 * POST /api/shop-builder/import-url
 * body: { url: string, mode?: 'full' | 'product' | 'layout' }
 *
 * URL → Playwright 스크래핑 → HTML 파싱 → AI 보강 → PageGenerationJob 저장
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { UrlScraperService } from '@/modules/html-import/url-scraper.service'
import { HtmlParserService } from '@/modules/html-import/html-parser.service'
import {
  StructureExtractor,
  createUserAiClient,
} from '@/modules/html-import/structure-extractor'

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const url: string | undefined = body?.url?.trim()
  const mode: 'full' | 'product' | 'layout' = body?.mode || 'full'
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json(
      { success: false, error: 'http(s):// 로 시작하는 URL 이 필요합니다.' },
      { status: 400 }
    )
  }

  // 1. Job 생성
  const job = await prisma.pageGenerationJob.create({
    data: {
      sourceType: 'url',
      sourceUrl: url,
      status: 'parsing',
      createdBy: me.userId,
    },
    select: { id: true },
  })

  const scraper = new UrlScraperService()
  try {
    // 2. URL 스크래핑
    const scraped = await scraper.scrapeUrl(url)

    // 3. HTML 파싱
    const parser = new HtmlParserService()
    const extracted = parser.parseProductFromHtml(scraped.html)

    // og:image 가 있고 추출된 이미지가 비어있으면 추가
    if (extracted.images.length === 0 && scraped.meta.ogImage) {
      extracted.images.push(scraped.meta.ogImage)
    }

    // 4. AI 분석
    await prisma.pageGenerationJob.update({
      where: { id: job.id },
      data: { status: 'analyzing' },
    })

    let layoutAnalysis: any = null
    let enrichedData = extracted

    try {
      const aiClient = await createUserAiClient(me.userId)
      const extractor = new StructureExtractor(aiClient)
      if (mode === 'full' || mode === 'layout') {
        layoutAnalysis = await extractor.analyzePageLayout(scraped.screenshot)
      }
      if (mode === 'full' || mode === 'product') {
        enrichedData = await extractor.enrichProductData(extracted, scraped.screenshot)
      }
    } catch (aiErr: any) {
      // AI 키 미설정 등 — 추출된 데이터만 그대로 반환 (UI 에서 안내)
      console.warn('[import-url] AI 단계 스킵:', aiErr?.message)
    }

    const screenshotBase64 = `data:image/png;base64,${scraped.screenshot.toString('base64')}`

    await prisma.pageGenerationJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        extractedData: enrichedData as any,
        screenshot: screenshotBase64,
        layoutAnalysis: layoutAnalysis as any,
      },
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      data: {
        product: enrichedData,
        layout: layoutAnalysis,
        screenshot: screenshotBase64,
        meta: scraped.meta,
        images: scraped.images.slice(0, 30),
      },
    })
  } catch (err: any) {
    console.error('[import-url] 실패:', err)
    await prisma.pageGenerationJob.update({
      where: { id: job.id },
      data: { status: 'failed', errorMessage: err?.message || 'unknown' },
    }).catch(() => {})
    return NextResponse.json(
      { success: false, error: err?.message || 'URL 스크래핑 실패' },
      { status: 500 }
    )
  } finally {
    await scraper.close().catch(() => {})
  }
}
