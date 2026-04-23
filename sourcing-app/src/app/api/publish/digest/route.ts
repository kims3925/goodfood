/**
 * 종합 발행 API (Digest Publish)
 *
 * GET  /api/publish/digest?categoryId=SEA          — 카테고리별 발행 후보 상품 조회
 * POST /api/publish/digest                          — 선택한 상품들을 하나의 종합 게시글로 발행
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { bandPlaywrightService } from '@/modules/band-playwright/band-playwright.service'
import { buildDigest, type DigestProduct } from '@/modules/publish/digest-builder.service'
import {
  renderDigestCards,
  cleanupDigestCards,
  type DigestCardProduct,
} from '@/modules/publish/digest-card-renderer'
import { shiftDeadlineEarlier } from '@/modules/publish/deadline-utils'
import { CATEGORY_MAP, CATEGORY_CODES, CATEGORY_LIST, type CategoryCode } from '@/modules/category/category.keywords'

export const dynamic = 'force-dynamic'

// ───────────────────────────────────────────────────────────
// GET — 카테고리별 발행 후보 상품 조회
// ───────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoryParam = searchParams.get('categoryId') // all | SEA | AGR | ...
    const daysWithin = searchParams.get('daysWithin')

    const where: any = {
      userId: user.userId,
      deletedAt: null,
      isActive: true,
    }

    if (categoryParam && categoryParam !== 'all') {
      if (!(CATEGORY_CODES as readonly string[]).includes(categoryParam)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 카테고리 코드입니다.' },
          { status: 400 }
        )
      }
      where.categoryId = categoryParam
    }

    if (daysWithin) {
      const days = parseInt(daysWithin)
      if (!isNaN(days) && days > 0) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        cutoff.setHours(0, 0, 0, 0)
        where.createdAt = { gte: cutoff }
      }
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { where: { deletedAt: null }, orderBy: { id: 'asc' } },
        channel: {
          select: { id: true, name: true, platform: true, kind: true, orderDeadline: true },
        },
        shopProducts: {
          where: { deletedAt: null },
          include: { shop: { select: { id: true, subdomain: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    // 카테고리별 분포 집계
    const categoryCounts: Record<string, number> = {}
    const allUserProducts = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { userId: user.userId, deletedAt: null, isActive: true },
      _count: { _all: true },
    })
    for (const row of allUserProducts) {
      const key = row.categoryId || 'ETC'
      categoryCounts[key] = (categoryCounts[key] || 0) + row._count._all
    }

    const categories = CATEGORY_LIST.map((cat) => ({
      code: cat.code,
      name: cat.name,
      emoji: cat.emoji,
      label: cat.label,
      count: categoryCounts[cat.code] || 0,
    }))

    const shaped = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      thumbnailUrl: p.thumbnailUrl,
      price: p.price,
      createdAt: p.createdAt,
      lastDigestPublishedAt: p.lastDigestPublishedAt,
      channel: p.channel
        ? {
            id: p.channel.id,
            name: p.channel.name,
            platform: p.channel.platform,
            kind: p.channel.kind,
            orderDeadline: p.channel.orderDeadline || null,
          }
        : null,
      variants: p.variants.map((v) => ({
        id: v.id,
        optionSummary: v.optionSummary,
        price: v.price,
      })),
      images: p.images.map((img) => ({ url: img.url, sortOrder: img.sortOrder })),
      shopProducts: p.shopProducts.map((sp) => ({
        id: sp.id,
        shopId: sp.shopId,
        shopName: sp.shop?.name,
        shopSubdomain: sp.shop?.subdomain,
      })),
    }))

    return NextResponse.json({
      success: true,
      data: { categories, products: shaped },
    })
  } catch (error: any) {
    console.error('[digest GET] 오류:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// ───────────────────────────────────────────────────────────
// POST — 종합 발행 실행
// ───────────────────────────────────────────────────────────
interface DigestPublishRequest {
  categoryId: CategoryCode
  productIds: number[]       // 사용자가 선택한 순서 유지
  channelId: number          // 단일 채널에 발행 (클라이언트가 채널별로 순차 호출)
  headerText?: string
  footerText?: string
  maxImagesPerProduct?: number
  date?: string              // ISO 날짜. 없으면 오늘
  /**
   * 발행 모드:
   * - 'digest' (기본): 종합 카드 20장 + 본문 URL 목록 (1개 게시글)
   * - 'individual': 상품 1개당 게시글 1개 (N개 게시글, 각각 이미지1+URL1 자동 프리뷰)
   * - 'both': digest 1개 먼저, 이어서 individual N개
   * - 'incremental': 1개 상품으로 먼저 게시 후, 나머지 상품을 "수정"으로 1개씩 덧붙임 (1 게시글, N-1회 수정)
   */
  publishMode?: 'digest' | 'individual' | 'both' | 'incremental'
  /** 개별/점진 발행 시 각 게시글 사이 대기 시간(초). 기본 3초 */
  individualIntervalSec?: number
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = (await request.json()) as DigestPublishRequest
    const {
      categoryId,
      productIds,
      channelId,
      headerText,
      footerText,
      maxImagesPerProduct,
      date,
      publishMode = 'digest',
      individualIntervalSec = 3,
    } = body

    if (!categoryId || !(CATEGORY_CODES as readonly string[]).includes(categoryId)) {
      return NextResponse.json({ success: false, error: '유효한 categoryId가 필요합니다.' }, { status: 400 })
    }
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ success: false, error: '발행할 상품을 선택하세요.' }, { status: 400 })
    }
    if (!channelId || typeof channelId !== 'number') {
      return NextResponse.json({ success: false, error: '발행할 소매밴드(channelId)를 지정하세요.' }, { status: 400 })
    }

    // 상품 조회 (선택 순서 유지)
    const fetched = await prisma.product.findMany({
      where: { id: { in: productIds }, userId: user.userId, deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { where: { deletedAt: null } },
        channel: { select: { orderDeadline: true } },
        shopProducts: {
          where: { deletedAt: null },
          include: { shop: { select: { id: true, subdomain: true } } },
        },
      },
    })
    const productMap = new Map(fetched.map((p) => [p.id, p]))
    const orderedProducts = productIds.map((id) => productMap.get(id)).filter(Boolean) as typeof fetched

    const shopDomain = process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'shop.abcpharm.net'
    const digestProducts: DigestProduct[] = orderedProducts.map((p) => {
      const firstShopProduct = p.shopProducts[0]
      const subdomain = firstShopProduct?.shop?.subdomain
      const shopProductUrl = subdomain
        ? `https://${shopDomain}/${subdomain}/product/${p.id}`
        : undefined
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        variants: p.variants.map((v) => ({ optionSummary: v.optionSummary || '', price: v.price })),
        images: p.images.map((img) => ({ url: img.url, sortOrder: img.sortOrder })),
        shopProductUrl,
        deadline: p.channel?.orderDeadline || undefined,
      }
    })

    const digest = buildDigest({
      category: categoryId,
      products: digestProducts,
      date: date ? new Date(date) : undefined,
      headerText,
      footerText,
      maxImagesPerProduct: typeof maxImagesPerProduct === 'number' ? maxImagesPerProduct : 1,
    })

    // 채널 조회 (단일)
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        userId: user.userId,
        kind: ChannelKind.RETAIL,
        isActive: true,
      },
      select: { id: true, name: true, channelKey: true },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없거나 발행 권한이 없습니다.' },
        { status: 404 }
      )
    }

    if (!channel.channelKey) {
      return NextResponse.json(
        { success: false, error: '채널에 bandKey(channelKey)가 없습니다.' },
        { status: 400 }
      )
    }

    // ── 상품별 "사진(최대 4장 2×2 그리드) + 번호/제목/가격/마감/주문링크" 카드를
    //    PNG 1장으로 렌더링하고, Band에 20장까지 첨부. 본문 텍스트는 카드 밑에 첨부.
    const cardProducts: DigestCardProduct[] = orderedProducts.slice(0, 20).map((p) => {
      const firstShop = p.shopProducts[0]
      const orderUrl = firstShop?.shop?.subdomain
        ? `https://${shopDomain}/${firstShop.shop.subdomain}/product/${p.id}`
        : undefined
      const variantPrices = p.variants.map((v) => v.price).filter((x) => x > 0)
      let priceText: string | undefined
      if (variantPrices.length > 1) {
        const min = Math.min(...variantPrices)
        const max = Math.max(...variantPrices)
        priceText = min === max ? `${min.toLocaleString()}원` : `${min.toLocaleString()}원 ~ ${max.toLocaleString()}원`
      } else if (p.price) {
        priceText = `${p.price.toLocaleString()}원`
      }
      // 도매방 마감시간의 30분 전을 쇼핑몰 주문 마감으로 표시
      // 도매글에 마감시간 미표기일 경우 null → 카드에 미렌더
      const displayDeadline = shiftDeadlineEarlier(p.channel?.orderDeadline, 30)
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        priceText,
        deadline: displayDeadline,
        orderUrl,
        description: p.description,
        imageUrls: p.images
          .slice(0, 4)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((i) => i.url),
      }
    })

    let status: 'SUCCESS' | 'FAILED' = 'FAILED'
    let postKey: string | undefined
    let message: string | undefined
    const renderedCards = await renderDigestCards({ products: cardProducts }).catch((err) => {
      message = `카드 이미지 렌더링 실패: ${err?.message || err}`
      return []
    })

    if (renderedCards.length === 0 && !message) {
      message = '카드 이미지 0장 생성됨'
    }

    // ─── 발행 본문 구성 ──────────────────────────────────────
    // Band 웹 에디터는 paste/drop 해도 모든 이미지를 갤러리로 강제 분리한다.
    // 따라서 각 카드 PNG 안에 QR·URL 텍스트까지 포함시키고(digest-card-renderer),
    // 본문에는 번호 매긴 상품 링크 목록을 둔다(Band 자동 링크 프리뷰 활용).
    const buildDigestContent = () => {
      const linkLines: string[] = []
      cardProducts.forEach((p, idx) => {
        if (p.orderUrl) {
          linkLines.push(`${idx + 1}. ${p.name}`)
          linkLines.push(`   🛒 ${p.orderUrl}`)
        }
      })
      return [
        digest.title,
        (headerText || '').trim(),
        `총 ${digest.productCount}개 상품 | 신선 직송`,
        '━━━━━━━━━━━━━━━━━━━━',
        ...linkLines,
        '━━━━━━━━━━━━━━━━━━━━',
        (footerText || '').trim() ||
          '📦 배송: 마감 전 주문시 당일 출고, 마감 이후 익일 출고\n💳 결제: 카드결제 / 무통장입금',
      ]
        .filter((line, idx, arr) => {
          if (line !== '') return true
          return idx > 0 && arr[idx - 1] !== ''
        })
        .join('\n')
    }

    // 개별 발행용 본문 생성기 (상품 1개당 게시글 1개)
    const buildIndividualContent = (cp: DigestCardProduct, idx: number) => {
      const lines: string[] = []
      lines.push(`${idx + 1}. ${cp.name}`)
      if (cp.priceText) lines.push(`💰 ${cp.priceText}`)
      if (cp.deadline) lines.push(`⏰ 주문 마감: ${cp.deadline}`)
      lines.push('')
      if (cp.orderUrl) lines.push(`🛒 ${cp.orderUrl}`)
      return lines.join('\n')
    }

    // 결과 누적 (both 모드에서 양쪽 결과 기록)
    const subResults: Array<{
      mode: 'digest' | 'individual' | 'incremental'
      index?: number
      productId?: number
      status: 'SUCCESS' | 'FAILED'
      postKey?: string
      message?: string
    }> = []

    try {
      if (renderedCards.length === 0) {
        status = 'FAILED'
      } else if (publishMode === 'incremental') {
        // ── 점진발행 PoC ──────────────────────────────────────
        // 1상품 게시 후, 나머지 상품을 "게시글 수정"으로 1장씩 본문 끝에 덧붙인다.
        // 장점: 부분 성공 보장(중간 실패해도 앞까지는 이미 반영됨).
        // 단점: Band 수정모드의 이미지 삽입 경로(paste/drop)가 먹는지는 런타임 검증 필요.
        const intervalMs = Math.max(0, individualIntervalSec * 1000)

        // 첫 카드: 이미지 1 + 본문 텍스트 1 (publishWithImages로 자동 링크 프리뷰 활용)
        const firstCard = renderedCards[0]
        const firstCp =
          cardProducts.find((c) => c.id === firstCard.productId) || cardProducts[0]
        const firstContent = firstCp ? buildIndividualContent(firstCp, 0) : ''

        const firstRes = await bandPlaywrightService.publishWithImages({
          channelId: channel.id,
          bandKey: channel.channelKey,
          bandName: channel.name,
          content: firstContent,
          imageUrls: [firstCard.filePath],
        })
        subResults.push({
          mode: 'incremental',
          index: 1,
          productId: firstCp?.id,
          status: firstRes.success ? 'SUCCESS' : 'FAILED',
          postKey: firstRes.postKey,
          message: firstRes.error,
        })

        if (!firstRes.success || !firstRes.postKey) {
          status = 'FAILED'
          message = firstRes.error || '첫 게시글 발행 실패'
        } else {
          postKey = firstRes.postKey

          // 나머지 카드: 수정모드로 이미지+텍스트 덧붙이기
          for (let i = 1; i < renderedCards.length; i++) {
            const card = renderedCards[i]
            const cp = cardProducts.find((c) => c.id === card.productId) || cardProducts[i]
            if (!cp) continue
            if (intervalMs > 0) await sleep(intervalMs)

            try {
              const appendRes = await bandPlaywrightService.appendToExistingPost({
                channelId: channel.id,
                bandKey: channel.channelKey,
                bandName: channel.name,
                postKey: firstRes.postKey,
                blocks: [
                  { type: 'image', filePath: card.filePath },
                  { type: 'text', content: buildIndividualContent(cp, i) },
                ],
              })
              subResults.push({
                mode: 'incremental',
                index: i + 1,
                productId: cp.id,
                status: appendRes.success ? 'SUCCESS' : 'FAILED',
                postKey: firstRes.postKey,
                message: appendRes.error,
              })
            } catch (err: any) {
              subResults.push({
                mode: 'incremental',
                index: i + 1,
                productId: cp.id,
                status: 'FAILED',
                message: err?.message || '점진 수정 오류',
              })
            }
          }
        }
      } else {
        const runDigest = publishMode === 'digest' || publishMode === 'both'
        const runIndividual = publishMode === 'individual' || publishMode === 'both'

        // 1) 종합 발행 — 카드 전체를 하나의 게시글로
        if (runDigest) {
          const r = await bandPlaywrightService.publishWithImages({
            channelId: channel.id,
            bandKey: channel.channelKey,
            bandName: channel.name,
            content: buildDigestContent(),
            imageUrls: renderedCards.map((c) => c.filePath),
          })
          subResults.push({
            mode: 'digest',
            status: r.success ? 'SUCCESS' : 'FAILED',
            postKey: r.postKey,
            message: r.error,
          })
          if (r.success) {
            postKey = r.postKey
            message = r.error || message
          } else {
            message = r.error || message
          }
        }

        // 2) 개별 발행 — 상품 1개당 게시글 1개 (각 게시글 간 간격 두고 순차 실행)
        if (runIndividual) {
          const intervalMs = Math.max(0, individualIntervalSec * 1000)
          for (let i = 0; i < renderedCards.length; i++) {
            const card = renderedCards[i]
            const cp = cardProducts.find((c) => c.id === card.productId) || cardProducts[i]
            if (!cp) continue
            if (i > 0 && intervalMs > 0) await sleep(intervalMs)
            try {
              const r = await bandPlaywrightService.publishWithImages({
                channelId: channel.id,
                bandKey: channel.channelKey,
                bandName: channel.name,
                content: buildIndividualContent(cp, i),
                imageUrls: [card.filePath],
              })
              subResults.push({
                mode: 'individual',
                index: i + 1,
                productId: cp.id,
                status: r.success ? 'SUCCESS' : 'FAILED',
                postKey: r.postKey,
                message: r.error,
              })
            } catch (err: any) {
              subResults.push({
                mode: 'individual',
                index: i + 1,
                productId: cp.id,
                status: 'FAILED',
                message: err?.message || '개별 발행 오류',
              })
            }
          }
        }
      }

      // ── 전체 상태 판정 + 집계 메시지 (모든 모드 공통) ──
      if (subResults.length > 0) {
        status = subResults.some((r) => r.status === 'SUCCESS') ? 'SUCCESS' : 'FAILED'

        const digestRes = subResults.find((r) => r.mode === 'digest')
        const indivResults = subResults.filter((r) => r.mode === 'individual')
        const incrResults = subResults.filter((r) => r.mode === 'incremental')
        const indivSuccess = indivResults.filter((r) => r.status === 'SUCCESS').length
        const indivFail = indivResults.filter((r) => r.status === 'FAILED').length
        const incrSuccess = incrResults.filter((r) => r.status === 'SUCCESS').length
        const incrFail = incrResults.filter((r) => r.status === 'FAILED').length
        const parts: string[] = []
        if (digestRes) parts.push(`종합 ${digestRes.status === 'SUCCESS' ? '성공' : '실패'}`)
        if (indivResults.length > 0) {
          parts.push(
            `개별 ${indivSuccess}/${indivResults.length} 성공${indivFail > 0 ? `, ${indivFail} 실패` : ''}`
          )
        }
        if (incrResults.length > 0) {
          parts.push(
            `점진 ${incrSuccess}/${incrResults.length} 성공${incrFail > 0 ? `, ${incrFail} 실패` : ''}`
          )
        }
        if (parts.length > 0) message = parts.join(' · ')
      }
    } catch (err: any) {
      status = 'FAILED'
      message = err?.message || '발행 중 오류'
    } finally {
      cleanupDigestCards(renderedCards)
    }

    // 발행 성공 시 선택된 상품들에 lastDigestPublishedAt 기록
    if (status === 'SUCCESS') {
      await prisma.product.updateMany({
        where: { id: { in: productIds }, userId: user.userId },
        data: { lastDigestPublishedAt: new Date() },
      })
    }

    return NextResponse.json({
      success: status === 'SUCCESS',
      digest: {
        title: digest.title,
        productCount: digest.productCount,
        imageCount: digest.imageUrls.length,
        truncated: digest.truncated,
      },
      result: {
        channelId: channel.id,
        channelName: channel.name,
        status,
        postKey,
        message,
        publishMode,
        subResults,
      },
      categoryMeta: {
        code: categoryId,
        ...CATEGORY_MAP[categoryId],
      },
    })
  } catch (error: any) {
    console.error('[digest POST] 오류:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '발행 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
