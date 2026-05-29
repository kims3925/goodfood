/**
 * 네이버 쇼핑 EP(상품정보제공) XML 피드
 *
 * 네이버 쇼핑 검색 노출을 위한 상품 피드.
 * 네이버 커머스 센터에서 이 URL을 EP 피드로 등록:
 *   https://familyshop.kr/api/naver-shopping-feed
 *
 * 피드 스펙: https://join.shopping.naver.com/misc/download/ep_guide.nhn
 */

import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1시간 캐시

// 카테고리 코드 → 네이버 쇼핑 카테고리 매핑 (대표값)
const NAVER_CATEGORY_MAP: Record<string, string> = {
  SEA: '식품>수산물',
  AGR: '식품>농산물',
  MEA: '식품>축산물',
  MKT: '식품>간편식/밀키트',
  PRC: '식품>가공식품',
  HLT: '식품>건강식품',
  COM: '식품',
  ETC: '식품',
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://familyshop.kr'

  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      include: {
        variants: {
          orderBy: { id: 'asc' },
          take: 1,
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10000,
    })

    // TSV (Tab-Separated Values) 형식 — 네이버 EP 표준
    const header = [
      'id', 'title', 'price_pc', 'price_mobile', 'normal_price',
      'link', 'mobile_link', 'image_link', 'category_name1',
      'category_name2', 'shipping', 'condition', 'availability',
      'update_time',
    ].join('\t')

    const rows = products.map((product) => {
      const price = product.variants[0]?.price || product.price || 0
      const imageUrl = product.images?.[0]?.url || product.thumbnailUrl || ''
      const productUrl = `${siteUrl}/product/${product.id}`
      const categoryParts = (NAVER_CATEGORY_MAP[product.categoryId || 'ETC'] || '식품').split('>')
      const shipping = product.shippingFee || 0
      const updatedAt = product.updatedAt.toISOString().split('T')[0].replace(/-/g, '')

      return [
        product.id,
        product.name.replace(/\t/g, ' '),
        price,
        price,
        price,
        productUrl,
        productUrl,
        imageUrl,
        categoryParts[0] || '식품',
        categoryParts[1] || '',
        shipping === 0 ? '무료' : shipping,
        '신상품',
        '재고있음',
        updatedAt,
      ].join('\t')
    })

    const tsv = [header, ...rows].join('\n')

    return new NextResponse(tsv, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
      },
    })
  } catch (error) {
    console.error('Failed to generate Naver shopping feed:', error)
    return NextResponse.json({ error: 'Feed generation failed' }, { status: 500 })
  }
}
