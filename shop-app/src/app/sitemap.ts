/**
 * 동적 sitemap.xml 생성 — 구글/네이버 검색엔진 크롤링 최적화
 *
 * 포함 대상:
 * - 메인 페이지 + 카테고리 페이지 (8종)
 * - 활성 상품 페이지 (최근 업데이트순)
 * - 고정 페이지 (이용약관, 개인정보처리방침)
 */

import { MetadataRoute } from 'next'
import prisma from '@bandauto/db'
import { CATEGORY_CODES } from '@/lib/categories'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://familyshop.kr'

  // 고정 페이지
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/main`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/popular`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  // 카테고리 페이지 (SEA, AGR, MEA, MKT, PRC, HLT, COM, ETC)
  const categoryPages: MetadataRoute.Sitemap = CATEGORY_CODES.map((code) => ({
    url: `${siteUrl}/category/${code}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  // 활성 상품 페이지 (최대 5000개, 최근 업데이트순)
  let productPages: MetadataRoute.Sitemap = []
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    })

    productPages = products.map((product) => ({
      url: `${siteUrl}/product/${product.id}`,
      lastModified: product.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  } catch (error) {
    console.error('Failed to fetch products for sitemap:', error)
  }

  return [...staticPages, ...categoryPages, ...productPages]
}
