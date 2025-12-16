# 쇼핑몰 SEO 구현 가이드

검색엔진(Google, Naver)에서 쇼핑몰을 찾을 수 있도록 하기 위한 SEO 설정 가이드입니다.

## 현재 구현 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| 기본 메타데이터 | 부분 구현 | 상품 페이지만 완료 |
| sitemap.xml | 미구현 | |
| robots.txt | 미구현 | |
| Open Graph | 부분 구현 | 상품 페이지만 |
| JSON-LD 구조화 데이터 | 미구현 | |

## 필수 구현 항목

### 1. sitemap.ts 생성

**파일 경로**: `src/app/sitemap.ts`

```typescript
import { MetadataRoute } from 'next'
import { prisma } from '@bandauto/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.com'

  // 정적 페이지
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]

  // 상품 페이지 (DB에서 조회)
  const products = await prisma.product.findMany({
    select: { id: true, updatedAt: true },
    where: { status: 'ACTIVE' }, // 활성 상품만
  })

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/product/${product.id}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // 밴드(카테고리) 페이지 (DB에서 조회)
  const bands = await prisma.retailBand.findMany({
    select: { id: true, updatedAt: true },
    where: { status: 'ACTIVE' },
  })

  const bandPages: MetadataRoute.Sitemap = bands.map((band) => ({
    url: `${baseUrl}/band/${band.id}`,
    lastModified: band.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [...staticPages, ...productPages, ...bandPages]
}
```

### 2. robots.ts 생성

**파일 경로**: `src/app/robots.ts`

```typescript
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/mypage/',
          '/checkout/',
          '/api/',
          '/auth/',
          '/cart/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
```

### 3. 루트 레이아웃 메타데이터 개선

**파일 경로**: `src/app/layout.tsx`

```typescript
import { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: {
    default: '쇼핑몰 | 최고의 상품을 최저가로',
    template: '%s | 쇼핑몰',
  },
  description: '신선한 상품과 다양한 혜택을 만나보세요.',
  keywords: ['쇼핑몰', '온라인쇼핑', '할인', '특가'],
  // Naver 사이트 인증 (Search Advisor 등록 후 발급받은 코드 입력)
  verification: {
    // google: 'google-site-verification-code',
    // other: {
    //   'naver-site-verification': 'naver-verification-code',
    // },
  },
}
```

## 검색엔진 등록 방법

### Google Search Console

1. [Google Search Console](https://search.google.com/search-console) 접속
2. 속성 추가 > URL 접두어 방식으로 사이트 URL 입력
3. HTML 태그 방식으로 인증 (메타태그 발급)
4. 발급받은 코드를 `layout.tsx`의 `verification.google`에 입력
5. sitemap.xml 제출: 색인 > Sitemaps > 새 사이트맵 추가

### Naver Search Advisor

1. [Naver Search Advisor](https://searchadvisor.naver.com) 접속
2. 웹마스터 도구 > 사이트 관리 > 사이트 추가
3. HTML 태그 방식으로 인증
4. 발급받은 코드를 `layout.tsx`의 `verification.other['naver-site-verification']`에 입력
5. 요청 > 사이트맵 제출

## 확인 방법

배포 후 아래 URL로 접근하여 정상 동작 확인:

- `https://your-domain.com/sitemap.xml`
- `https://your-domain.com/robots.txt`

## 추가 최적화 (선택)

### JSON-LD 구조화 데이터

상품 페이지에 추가하면 검색 결과에 가격, 재고 등 정보가 표시됩니다.

```typescript
// src/app/(shop)/product/[id]/page.tsx
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: product.name,
  description: product.description,
  image: product.images[0],
  offers: {
    '@type': 'Offer',
    price: product.price,
    priceCurrency: 'KRW',
    availability: 'https://schema.org/InStock',
  },
}

// 컴포넌트 내에서
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

### Canonical URL

중복 콘텐츠 방지를 위해 각 페이지에 추가:

```typescript
export const metadata: Metadata = {
  alternates: {
    canonical: 'https://your-domain.com/product/123',
  },
}
```
