/**
 * POST /api/admin/lite/ad-cards/generate
 * body: { userId: number, productIds?: number[] }
 *
 * 라이트 셀러의 활성 ShopProduct 중 9개(고정 3×3)를 콜라주로 합성하여 PNG 생성.
 * productIds 미지정 시 매출 상위/최신 9개 자동 선정.
 *
 * 반환: { imageUrl: string, products: [{...}], shareText: { kakao, insta, band, shopUrl } }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import {
  renderCollagePoster,
  cleanupCollagePoster,
  type CollageCardProduct,
} from '@/modules/publish/digest-collage-renderer'

const GRID_COLS = 3
const GRID_ROWS = 3
const TOTAL = GRID_COLS * GRID_ROWS // 9

// 생성된 PNG는 public/lite-ad-cards/ 에 저장 (간단한 파일 호스팅).
// 운영에서는 S3/CloudFront 권장. 여기서는 MVP 로 로컬 디스크 사용.
const PUBLIC_DIR = path.join(process.cwd(), 'public', 'lite-ad-cards')

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })
  if (me.role !== 'ADMIN')
    return NextResponse.json({ success: false, error: '관리자 권한 필요' }, { status: 403 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }
  const userId = Number(body?.userId)
  const productIds: number[] = Array.isArray(body?.productIds) ? body.productIds.map(Number) : []
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ success: false, error: 'userId 누락' }, { status: 400 })
  }

  // 셀러 + 쇼핑몰 조회
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      mode: true,
      shops: {
        where: { isActive: true, deletedAt: null },
        select: { id: true, name: true, subdomain: true },
        take: 1,
      },
    },
  })
  if (!user || user.mode !== 'lite' || user.shops.length === 0) {
    return NextResponse.json(
      { success: false, error: '라이트 셀러 또는 쇼핑몰 없음' },
      { status: 404 }
    )
  }
  const shop = user.shops[0]

  // 상품 선정 — 명시적이면 그대로, 아니면 최신순 9개
  const candidates = await prisma.shopProduct.findMany({
    where: {
      shopId: shop.id,
      userId,
      deletedAt: null,
      ...(productIds.length > 0 ? { id: { in: productIds } } : {}),
      product: { isActive: true, deletedAt: null },
    },
    select: {
      id: true,
      product: {
        select: { id: true, name: true, thumbnailUrl: true, price: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: productIds.length > 0 ? productIds.length : TOTAL,
  })

  if (candidates.length < TOTAL) {
    return NextResponse.json(
      {
        success: false,
        error: `상품이 ${TOTAL}개 미만입니다 (현재 ${candidates.length}개). 자동 발행 후 재시도하세요.`,
      },
      { status: 400 }
    )
  }

  const products: CollageCardProduct[] = candidates.slice(0, TOTAL).map((sp) => ({
    id: sp.product?.id ?? sp.id,
    name: sp.product?.name || '',
    spec: '',
    priceText: sp.product?.price
      ? `${Math.round(Number(sp.product.price)).toLocaleString('ko-KR')}원`
      : '',
    imageUrl: sp.product?.thumbnailUrl || '',
  }))

  // 임시 파일에 렌더 → public/lite-ad-cards 로 복사
  let rendered
  try {
    rendered = await renderCollagePoster({
      title: shop.name,
      subtitle: `/${shop.subdomain}`,
      products,
      gridCols: GRID_COLS,
      gridRows: GRID_ROWS,
      removeBackground: false, // 3x3 광고카드는 원본 유지 (속도/안정성 우선)
      topBadgeText: '지금 만나요 🛒',
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || '콜라주 렌더링 실패' },
      { status: 500 }
    )
  }

  // public 으로 이동
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })
  const fileName = `ad-${userId}-${Date.now()}.png`
  const dest = path.join(PUBLIC_DIR, fileName)
  fs.copyFileSync(rendered.filePath, dest)
  cleanupCollagePoster(rendered.filePath)

  const publicHost =
    process.env.NEXT_PUBLIC_SHOP_DOMAIN ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') ||
    'snsauto.kr'
  const shopUrl = `https://${shop.subdomain}.${publicHost}`
  const imageUrl = `/lite-ad-cards/${fileName}`

  const shareText = {
    shopUrl,
    kakao: buildKakaoText(shop.name, shopUrl, products),
    insta: buildInstaCaption(shop.name, shopUrl, products),
    band: buildBandText(shop.name, shopUrl, products),
  }

  return NextResponse.json({
    success: true,
    data: {
      imageUrl,
      shopUrl,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        priceText: p.priceText,
        imageUrl: p.imageUrl,
      })),
      shareText,
    },
  })
}

function buildKakaoText(shopName: string, shopUrl: string, products: CollageCardProduct[]): string {
  return `🛒 ${shopName} 신상품 9종
가격은 이미지 그대로! 클릭 한 번으로 주문 완료 ✅

👉 ${shopUrl}

오늘 만나는 베스트:
${products
  .slice(0, 3)
  .map((p) => `• ${p.name} ${p.priceText}`)
  .join('\n')}`
}

function buildInstaCaption(shopName: string, shopUrl: string, products: CollageCardProduct[]): string {
  return `${shopName}의 오늘의 9가지 ✨
프로필 링크에서 바로 주문!

#소셜커머스 #${shopName.replace(/\s+/g, '')} #신상품 #직거래 #산지직송
${shopUrl}`
}

function buildBandText(shopName: string, shopUrl: string, products: CollageCardProduct[]): string {
  return `📣 ${shopName} 신상품 안내

오늘 들어온 9가지 상품을 한장으로 정리했습니다.
이미지 속 가격 그대로 — 마음에 드시면 바로 주문 가능합니다.

🔗 쇼핑몰: ${shopUrl}

📦 오늘의 상품:
${products.map((p, i) => `${i + 1}. ${p.name} — ${p.priceText}`).join('\n')}`
}
