/**
 * robots.txt 동적 생성 — 구글/네이버 크롤러 안내
 *
 * 허용: 전체 공개 페이지 (메인, 상품, 카테고리)
 * 차단: 관리자, API, 인증, 결제, 마이페이지 등 비공개 경로
 */

import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://familyshop.kr'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/main',
          '/popular',
          '/product/',
          '/category/',
          '/terms',
          '/privacy',
        ],
        disallow: [
          '/api/',
          '/auth/',
          '/mypage/',
          '/cart',
          '/checkout',
          '/order/',
          '/payment/',
          '/admin/',
        ],
      },
      // 네이버 검색봇 전용 허용 (보다 적극적)
      {
        userAgent: 'Yeti',
        allow: '/',
        disallow: ['/api/', '/auth/', '/mypage/', '/cart', '/checkout', '/order/', '/payment/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
