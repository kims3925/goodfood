/**
 * POST /api/shop-builder/generate-detail
 * body: { jobId: number, templateId?: string, colorScheme?, shopBranding? }
 *
 * PageGenerationJob.extractedData → AI 카피 → Handlebars 템플릿 → HTML/CSS/Meta 생성.
 * 결과를 같은 Job 의 generatedHtml/generatedCss 에 저장.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { DetailPageGenerator } from '@/modules/page-generator/detail-page.generator'
import { createUserAiClient } from '@/modules/html-import/structure-extractor'
import type { ExtractedProductData } from '@/modules/html-import/types'

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const jobId = Number(body?.jobId)
  if (!Number.isFinite(jobId)) {
    return NextResponse.json({ success: false, error: 'jobId 필수' }, { status: 400 })
  }

  const job = await prisma.pageGenerationJob.findFirst({
    where: { id: jobId, createdBy: me.userId },
    select: { id: true, extractedData: true, layoutAnalysis: true },
  })
  if (!job) return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 })
  if (!job.extractedData) {
    return NextResponse.json(
      { success: false, error: '먼저 임포트(extractedData)를 실행하세요.' },
      { status: 400 }
    )
  }

  let aiClient
  try {
    aiClient = await createUserAiClient(me.userId)
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'AI 설정 누락' },
      { status: 400 }
    )
  }

  const extracted = job.extractedData as unknown as ExtractedProductData
  const layoutAnalysis = job.layoutAnalysis as any
  const colorScheme = body?.colorScheme || layoutAnalysis?.colors || undefined
  const shopBranding = body?.shopBranding || (await defaultShopBrandingFor(me.userId))

  await prisma.pageGenerationJob.update({
    where: { id: jobId },
    data: { status: 'generating' },
  })

  try {
    const generator = new DetailPageGenerator(aiClient)
    const result = await generator.generateDetailPage(extracted, {
      templateId: body?.templateId,
      colorScheme,
      shopBranding,
    })

    await prisma.pageGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        generatedHtml: result.html,
        generatedCss: result.css || null,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        html: result.html,
        css: result.css,
        meta: result.meta,
        templateId: result.templateId,
        copy: result.copy,
      },
    })
  } catch (err: any) {
    console.error('[generate-detail] 실패:', err)
    await prisma.pageGenerationJob.update({
      where: { id: jobId },
      data: { status: 'failed', errorMessage: err?.message || 'unknown' },
    }).catch(() => {})
    return NextResponse.json(
      { success: false, error: err?.message || '상세페이지 생성 실패' },
      { status: 500 }
    )
  }
}

async function defaultShopBrandingFor(userId: number) {
  const shop = await prisma.shop.findFirst({
    where: { userId, isActive: true, deletedAt: null },
    select: { name: true, contactPhone: true, subdomain: true },
  })
  if (!shop) return undefined
  return {
    shopName: shop.name,
    contactInfo: shop.contactPhone || undefined,
  }
}
