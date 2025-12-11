# E-Commerce App 프로젝트 분석 및 개선사항

> 분석일: 2025-12-02
> 프로젝트: BandAuto E-Commerce App (ABC Market)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [아키텍처 분석](#3-아키텍처-분석)
4. [코드 품질 이슈](#4-코드-품질-이슈)
5. [보안 취약점](#5-보안-취약점)
6. [성능 개선사항](#6-성능-개선사항)
7. [데이터베이스 개선사항](#7-데이터베이스-개선사항)
8. [우선순위별 작업 목록](#8-우선순위별-작업-목록)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 정보
- **프로젝트명:** BandAuto E-Commerce App (ABC Market)
- **유형:** 고객용 쇼핑몰 애플리케이션
- **포트:** 3000 (HTTP), HTTPS 지원 (server.js)
- **상태:** 개발 진행 중 (Next.js 14)

### 1.2 프로젝트 구조
```
shop-app/
├── src/
│   ├── app/                    # Next.js App Router 페이지
│   │   ├── (shop)/             # 쇼핑몰 레이아웃 그룹
│   │   │   ├── main/           # 메인 페이지
│   │   │   ├── auth/           # 로그인/회원가입
│   │   │   ├── product/[id]/   # 상품 상세
│   │   │   ├── cart/           # 장바구니
│   │   │   ├── checkout/       # 결제
│   │   │   ├── payment/        # 결제 결과
│   │   │   ├── mypage/         # 마이페이지
│   │   │   └── cs/             # 고객센터
│   │   └── api/                # API 라우트
│   ├── components/             # 공유 컴포넌트
│   ├── contexts/               # React Context
│   ├── modules/                # 기능 모듈
│   │   ├── auth/               # 인증
│   │   ├── cart/               # 장바구니
│   │   ├── payments/           # 결제
│   │   ├── order/              # 주문
│   │   ├── cs/                 # 고객서비스
│   │   └── common/             # 공통 유틸리티
│   └── types/                  # TypeScript 타입
├── public/                     # 정적 파일
└── docs/                       # 문서
```

---

## 2. 기술 스택

### 2.1 핵심 프레임워크
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 14.2.3 | React 프레임워크 (App Router) |
| React | 18.2.0 | UI 라이브러리 |
| TypeScript | 5.9.2 | 정적 타입 시스템 |

### 2.2 상태 관리 & 폼
| 기술 | 버전 | 용도 |
|------|------|------|
| Zustand | 4.5.0 | 클라이언트 상태 관리 |
| React Hook Form | 7.49.0 | 폼 핸들링 |
| NextAuth.js | 4.24.6 | 인증 & OAuth |

### 2.3 UI & 스타일링
| 기술 | 버전 | 용도 |
|------|------|------|
| Tailwind CSS | 3.4.1 | 유틸리티 CSS |
| Lucide React | 0.321.0 | 아이콘 |

### 2.4 데이터베이스 & ORM
| 기술 | 용도 |
|------|------|
| Prisma | ORM (@bandauto/db 모노레포 패키지) |
| MySQL | 주 데이터베이스 |

### 2.5 결제 연동
| 기술 | 버전 | 용도 |
|------|------|------|
| @tosspayments/payment-sdk | 1.9.1 | 토스페이먼츠 SDK |
| @tosspayments/payment-widget-sdk | 0.12.0 | 결제 위젯 |
| @tosspayments/tosspayments-sdk | 2.4.1 | 통합 SDK |

---

## 3. 아키텍처 분석

### 3.1 강점

#### 모듈형 기능 구조
```
modules/
├── auth/           # 인증 관련 전체 기능
│   ├── auth.config.ts
│   ├── services/
│   └── stores/
├── cart/           # 장바구니 기능
│   ├── services/
│   ├── stores/
│   └── components/
└── payments/       # 결제 기능
    ├── services/
    ├── stores/
    └── components/
```
- 기능별로 서비스, 스토어, 컴포넌트 분리
- 관심사의 명확한 분리

#### 인증 시스템
- Kakao, Naver OAuth 지원
- 로컬 이메일/비밀번호 인증
- JWT 기반 세션 (30일 만료)
- 로그인 이력 추적 (IP, User-Agent)

#### 에러 핸들링 인프라
- `common/utils/src/errors/` 커스텀 에러 클래스
- 토스페이먼츠 에러 코드 매핑

### 3.2 개선 필요 영역

#### 혼합된 상태 관리
현재 4가지 상태 관리 방식이 혼재:
1. Zustand 스토어 (auth, cart)
2. React Context (CartNotification)
3. useState (로컬 데이터)
4. NextAuth 세션

**권장:** 상태 관리 전략 통합 필요

---

## 4. 코드 품질 이슈

### 4.1 TypeScript 타입 안전성 🔴 Critical

**문제:** `any` 타입 과다 사용 (202개 발견)

```typescript
// ❌ 현재 코드 (src/app/(shop)/product/[id]/page.tsx:16)
const [product, setProduct] = useState<any>(null);

// ❌ 현재 코드 (src/modules/order/repository/order.repository.ts:52-54)
subtotalAmount: any,
shippingFee: any,
discountAmount: any

// ✅ 권장
interface Product {
  id: string;
  name: string;
  price: number;
  // ...
}
const [product, setProduct] = useState<Product | null>(null);
```

**영향:**
- 타입 안전성 손실
- IDE 자동완성 기능 저하
- 런타임 에러 사전 감지 불가

### 4.2 코드 중복 🟡 High

**문제:** API 라우트와 서비스 레이어 간 중복 로직

| 파일 | 중복 내용 |
|------|----------|
| `api/orders/prepare/route.ts:110-230` | 주문 아이템 조회 및 계산 |
| `payments/services/payment.service.ts:309-375` | 동일 로직 중복 |

```typescript
// ❌ 중복된 주문번호 생성 로직
// api/orders/prepare/route.ts:13-18
const generateOrderNumber = () => { ... }

// payments/services/payment.service.ts:378-382
const generateOrderNumber = () => { ... }  // 동일 코드

// ✅ 공통 유틸리티로 추출
// utils/order.utils.ts
export const generateOrderNumber = () => { ... }
```

### 4.3 대형 컴포넌트 🟡 High

**문제:** 단일 파일에 과도한 책임

| 파일 | 라인 수 | 포함 기능 |
|------|---------|----------|
| `product/[id]/page.tsx` | 740줄 | 상품 로딩, 위시리스트, 리뷰, 이미지 갤러리, 장바구니, 탭 |

**권장 분리 구조:**
```
product/[id]/
├── page.tsx                    # 메인 레이아웃
├── components/
│   ├── ProductInfo.tsx         # 상품 정보
│   ├── ProductGallery.tsx      # 이미지 갤러리
│   ├── ProductActions.tsx      # 장바구니/구매 버튼
│   ├── ProductReviews.tsx      # 리뷰 섹션
│   └── ProductTabs.tsx         # 탭 UI
└── hooks/
    ├── useProduct.ts           # 상품 데이터 훅
    └── useWishlist.ts          # 위시리스트 훅
```

### 4.4 DOM 직접 조작 🟡 Medium

**문제:** React 패턴 위반

```typescript
// ❌ 현재 코드 (checkout/page.tsx:102-114)
const element = document.getElementById('payment-section');
element.style.display = 'block';

// ✅ 권장 (상태 기반 UI)
const [showPayment, setShowPayment] = useState(false);
{showPayment && <PaymentSection />}
```

### 4.5 세션 ID 관리 취약 🟡 Medium

**문제:** 충돌 가능성 있는 세션 ID 생성

```typescript
// ❌ 현재 코드 (product/[id]/page.tsx:231-235)
const sessionId = localStorage.getItem('sessionId') || Date.now().toString();

// ✅ 권장 (UUID 사용)
import { v4 as uuidv4 } from 'uuid';
const sessionId = localStorage.getItem('sessionId') || uuidv4();
```

---

## 5. 보안 취약점

### 5.1 쿠키 보안 🔴 Critical

**문제:** Base64 인코딩은 암호화가 아님

```typescript
// ❌ 현재 코드 (api/orders/prepare/route.ts:266)
// 주문 데이터가 Base64로만 인코딩됨 - 누구나 읽을 수 있음

// ✅ 권장
import { encrypt, decrypt } from '@/lib/crypto';
const encryptedData = encrypt(JSON.stringify(orderData), process.env.ENCRYPTION_KEY);
```

### 5.2 localStorage 민감 데이터 🔴 Critical

**문제:** XSS 공격에 취약한 데이터 저장

| 파일 | 저장 데이터 |
|------|------------|
| `product/[id]/page.tsx` | 세션 ID |
| `cart/stores/cart.store.ts` | 장바구니 데이터 |

**권장:**
- 세션 관리를 httpOnly 쿠키로 이전
- 민감 데이터는 서버 세션에 저장

### 5.3 CSRF 보호 누락 🟡 High

**문제:** POST 요청에 CSRF 토큰 없음

**권장:**
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-CSRF-Token', value: 'required' }
        ]
      }
    ]
  }
}
```

### 5.4 요청 유효성 검증 누락 🟡 High

**문제:** API 라우트에서 입력 검증 없음 (Zod 의존성은 있으나 미사용)

```typescript
// ❌ 현재 코드 - 검증 없음
export async function POST(request: Request) {
  const body = await request.json();
  // 바로 사용...
}

// ✅ 권장
import { z } from 'zod';

const OrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive()
  })),
  shippingAddressId: z.string().uuid()
});

export async function POST(request: Request) {
  const body = await request.json();
  const validated = OrderSchema.parse(body);
  // 안전하게 사용
}
```

---

## 6. 성능 개선사항

### 6.1 데이터 페칭 라이브러리 없음 🟡 High

**현재:** 직접 `fetch()` 호출, 캐싱/재시도 없음

```typescript
// ❌ 현재 패턴 (product/[id]/page.tsx:53-74)
useEffect(() => {
  fetch(`/api/shop/products/${id}`)
    .then(res => res.json())
    .then(data => setProduct(data));
}, [id]);

// ✅ 권장 (SWR 사용)
import useSWR from 'swr';

const { data: product, error, isLoading } = useSWR(
  `/api/shop/products/${id}`,
  fetcher,
  { revalidateOnFocus: false }
);
```

**SWR/React Query 도입 이점:**
- 자동 캐싱
- 중복 요청 제거
- 자동 재시도
- 낙관적 업데이트

### 6.2 불필요한 리렌더링 🟡 Medium

**문제:** useEffect 의존성 최적화 필요

```typescript
// ❌ 현재 코드 (product/[id]/page.tsx:36-51)
useEffect(() => {
  // 여러 의존성으로 인한 과도한 호출
}, [id, sortBy, page, user]);

// ✅ 권장
const fetchReviews = useCallback(async () => {
  // 리뷰 로딩 로직
}, [id]);

useEffect(() => {
  fetchReviews();
}, [fetchReviews, sortBy, page]);
```

### 6.3 비효율적 데이터 조회 🟡 Medium

**문제:** 전체 목록 조회 후 필터링

```typescript
// ❌ 현재 코드 (product/[id]/page.tsx:80-92)
// 모든 위시리스트 가져온 후 하나만 사용
const wishlists = await fetch('/api/mypage/wishlist');
const isWished = wishlists.find(w => w.productId === id);

// ✅ 권장 (특정 항목만 조회)
const isWished = await fetch(`/api/mypage/wishlist/check?productId=${id}`);
```

### 6.4 N+1 쿼리 문제 🟡 Medium

```typescript
// ❌ 현재 코드 (api/orders/prepare/route.ts:190-229)
for (const item of items) {
  const product = await prisma.publishedProduct.findUnique(...);  // 루프 내 쿼리
}

// ✅ 권장 (배치 조회)
const productIds = items.map(item => item.publishedProductId);
const products = await prisma.publishedProduct.findMany({
  where: { id: { in: productIds } }
});
```

---

## 7. 데이터베이스 개선사항

### 7.1 Cascade Delete 위험 🔴 Critical

**문제:** 상품 삭제 시 주문 데이터도 삭제됨

```prisma
// ❌ 현재 스키마 (OrderItem)
model OrderItem {
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
}

// ✅ 권장 (참조 제한)
model OrderItem {
  product   Product @relation(fields: [productId], references: [id], onDelete: Restrict)
}
```

### 7.2 누락된 복합 인덱스 🟡 High

**권장 인덱스 추가:**

```prisma
// Product 모델
@@index([channelId, createdAt])
@@index([status, createdAt])

// Order 모델
@@index([userId, status])
@@index([status, createdAt])

// CartItem 모델
@@index([cartId, productVariantId])

// Review 모델
@@index([productId, rating])
@@index([userId, createdAt])
```

**예상 성능 개선:**
- 상품 조회: 200ms → 50ms (4배 향상)
- 주문 조회: 500ms → 100ms (5배 향상)

### 7.3 외래키 제약 누락 🟡 High

**문제:** `repliedBy`, `adminId` 필드가 외래키로 연결되지 않음

```prisma
// ❌ 현재 (문자열만 저장)
repliedBy    String?

// ✅ 권장 (외래키 관계)
repliedBy    String?
repliedByUser User?   @relation("Replies", fields: [repliedBy], references: [id])
```

---

## 8. 우선순위별 작업 목록

### 8.1 즉시 처리 (Critical) 🔴

| # | 작업 | 예상 시간 | 파일 |
|---|------|----------|------|
| 1 | 쿠키 데이터 암호화 | 4h | `api/orders/prepare/route.ts` |
| 2 | httpOnly 쿠키로 세션 이전 | 6h | 인증 모듈 전체 |
| 3 | OrderItem Cascade Delete 수정 | 1h | `db/prisma/models/order.prisma` |

### 8.2 높은 우선순위 (High) 🟡

| # | 작업 | 예상 시간 | 파일 |
|---|------|----------|------|
| 4 | `any` 타입 제거 및 인터페이스 정의 | 8h | 전체 코드베이스 |
| 5 | 중복 주문 로직 추출 | 4h | 주문/결제 서비스 |
| 6 | 데이터 페칭 라이브러리 도입 (SWR) | 6h | 클라이언트 컴포넌트 |
| 7 | 상품 페이지 컴포넌트 분리 | 4h | `product/[id]/page.tsx` |
| 8 | 요청 유효성 검증 추가 (Zod) | 6h | API 라우트 전체 |
| 9 | 복합 인덱스 추가 | 2h | Prisma 스키마 |

### 8.3 중간 우선순위 (Medium) 🟢

| # | 작업 | 예상 시간 | 파일 |
|---|------|----------|------|
| 10 | console.log 제거, 로깅 서비스 도입 | 3h | 전체 |
| 11 | SEO 메타 태그 추가 | 4h | 페이지 컴포넌트 |
| 12 | 컴포넌트 메모이제이션 최적화 | 4h | 클라이언트 컴포넌트 |
| 13 | 테스트 코드 작성 | 16h+ | 새로 생성 |
| 14 | 접근성(a11y) 개선 | 8h | UI 컴포넌트 |

### 8.4 낮은 우선순위 (Low) 🔵

| # | 작업 | 예상 시간 |
|---|------|----------|
| 15 | API 네이밍 통일 (band → channel) | 2h |
| 16 | 매직 넘버 상수화 | 2h |
| 17 | 불필요한 인덱스 제거 | 1h |

---

## 부록: 테스트 전략 권장사항

### 단위 테스트 (Unit Tests)
```
tests/
├── modules/
│   ├── auth/
│   │   └── auth.service.test.ts
│   ├── cart/
│   │   └── cart.service.test.ts
│   └── payments/
│       └── payment.service.test.ts
```

### 통합 테스트 (Integration Tests)
```
tests/
├── api/
│   ├── orders.test.ts
│   ├── payments.test.ts
│   └── cart.test.ts
```

### E2E 테스트 (End-to-End)
```
e2e/
├── checkout.spec.ts
├── auth.spec.ts
└── mypage.spec.ts
```

### 권장 테스트 라이브러리
- Jest + React Testing Library (단위/통합)
- Playwright 또는 Cypress (E2E)

---

## 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2025-12-02 | 1.0 | 최초 작성 |
