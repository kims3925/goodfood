/**
 * POST /api/lite/products/upload
 * Lite Manager — 셀러 마이샵에 상품 게재 (C3)
 *
 * Body:
 *  {
 *    productIds: number[],          // 5~10개 권장 (서버 검증)
 *    reasons?: Record<number, string>, // 상품별 선택 이유 태그 (학습 로그)
 *  }
 *
 * 동작:
 *  1) 셀러의 첫 active Shop 결정 (없으면 가입 안내 에러)
 *  2) 각 productId 에 대해 ShopProduct upsert (이미 게재 중이면 skip)
 *  3) 카톡/밴드 공유용 URL 생성 (shop.subdomain + product/{id})
 *  4) 결과 반환 — 성공/스킵/실패 + shareUrls
 *
 * 명세 (F5):
 *  - 자동 발주 / 자동 광고 / 완전 자동 업로드 절대 금지
 *  - 셀러가 직접 선택 → 직접 클릭하여 업로드 (학습 강제)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const MIN_PRODUCTS = 1 // 일단 minimal — UI 가 5~10 권장 enforce
const MAX_PRODUCTS = 20

interface UploadResult {
  productId: number
  status: 'success' | 'skipped' | 'failed'
  message?: string
  shareUrl?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const productIds: number[] = Array.isArray(body.productIds)
      ? body.productIds.filter((x: any) => typeof x === 'number' && x > 0)
      : []
    const reasons: Record<string, string> =
      body.reasons && typeof body.reasons === 'object' ? body.reasons : {}

    if (productIds.length < MIN_PRODUCTS) {
      return NextResponse.json(
        { success: false, error: `최소 ${MIN_PRODUCTS}개 상품을 선택해주세요.` },
        { status: 400 }
      )
    }
    if (productIds.length > MAX_PRODUCTS) {
      return NextResponse.json(
        { success: false, error: `최대 ${MAX_PRODUCTS}개까지 한 번에 업로드 가능합니다.` },
        { status: 400 }
      )
    }

    // 1) 셀러의 첫 active Shop 결정
    const shop = await prisma.shop.findFirst({
      where: { userId: user.userId, isActive: true },
      select: { id: true, name: true, subdomain: true },
      orderBy: { id: 'asc' },
    })
    if (!shop) {
      return NextResponse.json(
        {
          success: false,
          error: '아직 운영 중인 쇼핑몰이 없습니다. 마이샵 가입 안내를 따라주세요.',
          code: 'NO_SHOP',
        },
        { status: 400 }
      )
    }

    // 2) 대상 상품 일괄 조회 (active + 본인이 보유한 product 인지 무관 — Lite 는 추천 풀 사용)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    // 3) 각 productId 별 ShopProduct upsert
    const shopDomain = process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'shop.abcpharm.net'
    const results: UploadResult[] = []

    for (const productId of productIds) {
      const product = productMap.get(productId)
      if (!product) {
        results.push({ productId, status: 'failed', message: '상품을 찾을 수 없습니다' })
        continue
      }

      try {
        // 이미 게재된 활성 ShopProduct 가 있나?
        const existing = await prisma.shopProduct.findFirst({
          where: { productId, shopId: shop.id, deletedAt: null },
          select: { id: true },
        })

        if (existing) {
          const shareUrl = shop.subdomain
            ? `https://${shopDomain}/${shop.subdomain}/product/${productId}`
            : null
          results.push({
            productId,
            status: 'skipped',
            message: '이미 마이샵에 게재 중',
            shareUrl,
          })
          continue
        }

        // upsert (soft-deleted 가 있으면 복원)
        const created = await prisma.shopProduct.upsert({
          where: { productId_shopId: { productId, shopId: shop.id } },
          update: {
            deletedAt: null,
            publishedAt: new Date(),
          },
          create: {
            userId: user.userId,
            productId,
            shopId: shop.id,
            publishedAt: new Date(),
          },
          select: { id: true },
        })

        const shareUrl = shop.subdomain
          ? `https://${shopDomain}/${shop.subdomain}/product/${productId}`
          : null

        results.push({ productId, status: 'success', shareUrl })

        // 학습 로그 (Phase 1 minimal — coaching_tip 에 reason 기록)
        const reason = reasons[productId] || reasons[String(productId)]
        if (reason) {
          try {
            await prisma.coachingTip.create({
              data: {
                userId: user.userId,
                ruleKey: 'select_reason',
                message: `[${product.name}] 선택 이유: ${reason}`,
                ctaUrl: shareUrl,
                shown: true,
              },
            })
          } catch {
            // 로그 실패는 무시
          }
        }
      } catch (err: any) {
        results.push({
          productId,
          status: 'failed',
          message: err?.message || '업로드 실패',
        })
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const skippedCount = results.filter((r) => r.status === 'skipped').length
    const failedCount = results.filter((r) => r.status === 'failed').length

    // 카톡/밴드 공유용 통합 텍스트 — 셀러가 클립보드에 복사해서 공유
    const successUrls = results
      .filter((r) => r.status === 'success' && r.shareUrl)
      .map((r) => {
        const product = productMap.get(r.productId)
        return `📦 ${product?.name || '상품'}\n${r.shareUrl}`
      })

    const shopMainUrl = shop.subdomain ? `https://${shopDomain}/${shop.subdomain}` : null
    const shareText =
      successUrls.length > 0
        ? [
            `✨ 신상품 ${successCount}개 입고했습니다!`,
            '',
            ...successUrls,
            '',
            shopMainUrl ? `🛒 마이샵 전체 보기 👉 ${shopMainUrl}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        : ''

    return NextResponse.json({
      success: successCount > 0 || skippedCount > 0,
      summary: { total: productIds.length, success: successCount, skipped: skippedCount, failed: failedCount },
      results,
      shop: { id: shop.id, name: shop.name, subdomain: shop.subdomain, mainUrl: shopMainUrl },
      shareText,
    })
  } catch (error: any) {
    console.error('[Lite Upload] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
