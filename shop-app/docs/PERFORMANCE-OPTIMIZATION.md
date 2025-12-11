# 성능 최적화 가이드

> **프로젝트**: Shop-App
> **최종 업데이트**: 2025-12-10

---

## 목차

1. [이미지 최적화](#1-이미지-최적화)
2. [번들 최적화](#2-번들-최적화)
3. [캐싱 전략](#3-캐싱-전략)
4. [데이터베이스 최적화](#4-데이터베이스-최적화)
5. [렌더링 최적화](#5-렌더링-최적화)

---

## 1. 이미지 최적화

### 현재 문제

대부분의 이미지에서 `<img>` 태그를 직접 사용하여 Next.js 이미지 최적화 미활용

**영향받는 파일**:
- `src/app/(shop)/layout.tsx` - StoreLayout
- `src/app/(shop)/product/[id]/ProductDetailClient.tsx`
- `src/app/(shop)/main/page.tsx`
- `src/app/(shop)/cart/page.tsx`
- `src/app/(shop)/checkout/page.tsx`
- `src/app/(shop)/mypage/reviews/page.tsx`

### 해결 방법

#### Before
```tsx
<img src={product.imageUrl} alt={product.name} className="w-full h-48 object-cover" />
```

#### After
```tsx
import Image from 'next/image'

<Image
  src={product.imageUrl}
  alt={product.name}
  width={400}
  height={300}
  className="w-full h-48 object-cover"
  placeholder="blur"
  blurDataURL="data:image/png;base64,..."
/>
```

### 외부 이미지 도메인 설정

```javascript
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'your-cdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
    ],
    // 이미지 최적화 설정
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/avif', 'image/webp'],
  },
}
```

### 이미지 컴포넌트 래퍼

```tsx
// src/components/OptimizedImage.tsx
import Image, { ImageProps } from 'next/image'
import { useState } from 'react'

interface OptimizedImageProps extends Omit<ImageProps, 'onError'> {
  fallbackSrc?: string
}

export function OptimizedImage({ fallbackSrc = '/images/placeholder.png', ...props }: OptimizedImageProps) {
  const [src, setSrc] = useState(props.src)

  return (
    <Image
      {...props}
      src={src}
      onError={() => setSrc(fallbackSrc)}
      placeholder="blur"
      blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+F9PQAJpAN4pokyXwAAAABJRU5ErkJggg=="
    />
  )
}
```

---

## 2. 번들 최적화

### 동적 import 활용

#### 결제 위젯 (대용량)

```tsx
// Before
import { PaymentWidget } from '@tosspayments/payment-widget-sdk'

// After
import dynamic from 'next/dynamic'

const PaymentWidget = dynamic(
  () => import('@tosspayments/payment-widget-sdk').then(mod => mod.PaymentWidget),
  {
    ssr: false,
    loading: () => <div className="h-96 animate-pulse bg-gray-200 rounded" />
  }
)
```

#### 차트 컴포넌트

```tsx
const Chart = dynamic(() => import('recharts').then(mod => mod.LineChart), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-gray-200 rounded" />
})
```

### 번들 분석

```bash
# 번들 분석 패키지 설치
npm install @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({
  // 기존 설정
})

# 분석 실행
ANALYZE=true npm run build
```

### Tree Shaking 최적화

```tsx
// Bad - 전체 라이브러리 import
import { format, parseISO, addDays } from 'date-fns'

// Good - 개별 함수 import
import format from 'date-fns/format'
import parseISO from 'date-fns/parseISO'
import addDays from 'date-fns/addDays'
```

---

## 3. 캐싱 전략

### API Route 캐싱

#### 상품 목록 (ISR 적용)

```typescript
// src/app/api/shop/products/route.ts
export const revalidate = 60 // 60초마다 재검증

export async function GET(request: NextRequest) {
  // ...
}
```

#### 상품 상세 (On-demand Revalidation)

```typescript
// src/app/api/shop/products/[id]/route.ts
import { revalidateTag } from 'next/cache'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
  })

  return NextResponse.json(product, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}

// 상품 수정 시 캐시 무효화
export async function PUT(...) {
  await prisma.product.update(...)
  revalidateTag(`product-${params.id}`)
}
```

### Redis 캐시 (멀티 서버 환경)

```bash
npm install ioredis
```

```typescript
// src/lib/redis.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 60
): Promise<T> {
  const cached = await redis.get(key)
  if (cached) {
    return JSON.parse(cached)
  }

  const data = await fetcher()
  await redis.setex(key, ttl, JSON.stringify(data))
  return data
}

// 사용 예시
const products = await getCached(
  `products:${shopId}:page:${page}`,
  () => prisma.product.findMany({ where: { shopId }, skip, take }),
  300 // 5분
)
```

### 클라이언트 캐싱 (SWR/React Query)

```bash
npm install swr
```

```typescript
// src/hooks/useProducts.ts
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function useProducts(shopId: string, page = 1) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/shop/products?shopId=${shopId}&page=${page}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1분간 중복 요청 방지
    }
  )

  return { products: data, error, isLoading, refresh: mutate }
}
```

---

## 4. 데이터베이스 최적화

### N+1 쿼리 방지

#### 문제 코드

```typescript
// Bad - N+1 쿼리
const orders = await prisma.order.findMany({ where: { userId } })
for (const order of orders) {
  order.items = await prisma.orderItem.findMany({ where: { orderId: order.id } })
}
```

#### 해결

```typescript
// Good - 단일 쿼리
const orders = await prisma.order.findMany({
  where: { userId },
  include: {
    items: {
      include: {
        publishedProduct: {
          select: { id: true, name: true, imageUrl: true }
        }
      }
    }
  }
})
```

### 필드 선택 최적화

```typescript
// Bad - 모든 필드 조회
const products = await prisma.product.findMany()

// Good - 필요한 필드만 조회
const products = await prisma.product.findMany({
  select: {
    id: true,
    name: true,
    price: true,
    imageUrl: true,
  }
})
```

### 페이지네이션 최적화

```typescript
// Cursor-based pagination (대용량 데이터에 권장)
const products = await prisma.product.findMany({
  take: 20,
  skip: 1, // cursor 다음부터
  cursor: { id: lastProductId },
  orderBy: { createdAt: 'desc' },
})
```

### 인덱스 추가 권장

```prisma
// schema.prisma
model Product {
  // ...

  @@index([shopId, status, createdAt]) // 복합 인덱스
  @@index([name]) // 검색용
}
```

---

## 5. 렌더링 최적화

### React.memo 활용

```tsx
// 상품 카드 메모이제이션
const ProductCard = memo(function ProductCard({ product }: { product: Product }) {
  return (
    <div className="border rounded-lg p-4">
      <OptimizedImage src={product.imageUrl} alt={product.name} width={300} height={200} />
      <h3>{product.name}</h3>
      <p>{product.price.toLocaleString()}원</p>
    </div>
  )
})
```

### useMemo/useCallback

```tsx
function ProductList({ products, sortBy }: Props) {
  // 정렬된 상품 목록 메모이제이션
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return 0
    })
  }, [products, sortBy])

  // 이벤트 핸들러 메모이제이션
  const handleAddToCart = useCallback((productId: string) => {
    addToCart(productId)
  }, [])

  return (
    <div className="grid grid-cols-4 gap-4">
      {sortedProducts.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={handleAddToCart}
        />
      ))}
    </div>
  )
}
```

### 가상화 (대량 목록)

```bash
npm install @tanstack/react-virtual
```

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualProductList({ products }: { products: Product[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // 예상 아이템 높이
    overscan: 5,
  })

  return (
    <div ref={parentRef} className="h-screen overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ProductCard product={products[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 성능 측정

### Lighthouse 실행

```bash
# 로컬에서 실행
npm install -g lighthouse
lighthouse http://localhost:3000 --view

# 또는 Chrome DevTools > Lighthouse 탭
```

### Web Vitals 모니터링

```typescript
// src/app/layout.tsx
import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    console.log(metric)
    // 또는 분석 서비스로 전송
    // analytics.track('web-vitals', metric)
  })

  return null
}
```

### 성능 목표

| 지표 | 목표 | 현재 (예상) |
|------|------|-------------|
| LCP (Largest Contentful Paint) | < 2.5s | 3-4s |
| FID (First Input Delay) | < 100ms | 양호 |
| CLS (Cumulative Layout Shift) | < 0.1 | 확인 필요 |
| TTI (Time to Interactive) | < 3.5s | 확인 필요 |

---

## 체크리스트

- [ ] `<img>` → `<Image />` 컴포넌트 교체
- [ ] 외부 이미지 도메인 제한 설정
- [ ] 결제 위젯 동적 import 적용
- [ ] 번들 분석 실행 및 최적화
- [ ] API 캐싱 전략 적용
- [ ] 데이터베이스 쿼리 최적화
- [ ] Lighthouse 점수 80점 이상 달성
