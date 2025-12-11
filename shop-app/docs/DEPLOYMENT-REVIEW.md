# Shop-App 배포 검토 보고서

> **작성일**: 2025-12-10
> **프로젝트**: BandAuto Shop (고객용 쇼핑몰)
> **기술 스택**: Next.js 14.2.3, React 18, TypeScript, Prisma, TailwindCSS

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [보안 취약점](#3-보안-취약점)
4. [API 분석](#4-api-분석)
5. [데이터베이스](#5-데이터베이스)
6. [프론트엔드](#6-프론트엔드)
7. [성능](#7-성능)
8. [배포 준비 상태](#8-배포-준비-상태)
9. [개선사항 요약](#9-개선사항-요약)
10. [배포 전 체크리스트](#10-배포-전-체크리스트)

---

## 1. Executive Summary

### 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | shop-app (BandAuto Shop) |
| 아키텍처 | 멀티테넌트 쇼핑몰 (서브도메인 기반) |
| 주요 기능 | 상품 조회, 장바구니, 주문/결제, 마이페이지, 비회원 주문 |
| 결제 시스템 | TossPayments 연동 |

### 배포 준비 상태

| 상태 | 설명 |
|------|------|
| **빌드** | 타입 에러로 인한 빌드 실패 |
| **보안** | 기본 시크릿 키 하드코딩 문제 |
| **성능** | 이미지 최적화 미적용 |

---

## 2. 프로젝트 구조

### 디렉토리 구조

```
shop-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (shop)/             # Shop 그룹 라우트
│   │   │   ├── auth/           # 인증 (로그인, 회원가입)
│   │   │   ├── cart/           # 장바구니
│   │   │   ├── checkout/       # 결제
│   │   │   ├── mypage/         # 마이페이지
│   │   │   ├── product/[id]/   # 상품 상세
│   │   │   ├── order/          # 주문
│   │   │   ├── payment/        # 결제 결과
│   │   │   └── cs/             # 고객센터
│   │   ├── api/                # API Routes (48개)
│   │   └── layout.tsx          # 루트 레이아웃
│   ├── modules/                # 비즈니스 모듈
│   │   ├── auth/               # 인증 모듈
│   │   ├── cart/               # 장바구니 모듈
│   │   ├── order/              # 주문 모듈
│   │   ├── payments/           # 결제 모듈
│   │   └── common/             # 공통 유틸리티
│   ├── contexts/               # React Context
│   ├── components/             # 공유 컴포넌트
│   └── lib/                    # 유틸리티
├── public/                     # 정적 파일
├── package.json
├── next.config.js
└── tsconfig.json
```

### 주요 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| next | 14.2.3 | 프레임워크 |
| react | ^18.2.0 | UI 라이브러리 |
| next-auth | ^4.24.6 | 인증 |
| @tosspayments/payment-widget-sdk | ^0.12.0 | 결제 |
| zustand | ^4.5.0 | 상태 관리 |
| zod | ^3.22.4 | 스키마 검증 |
| bcryptjs | ^2.4.3 | 비밀번호 해싱 |

### next.config.js 문제점

```javascript
// 문제: 모든 이미지 호스트 허용
images: {
  remotePatterns: [{ protocol: 'https', hostname: '**' }],
}
```

**권장**: 특정 도메인만 허용하도록 수정

---

## 3. 보안 취약점

### 3.1 Critical - 하드코딩된 시크릿 키

| 파일 | 코드 | 위험도 |
|------|------|--------|
| `src/middleware.ts:167` | `'dev-internal-key'` 기본값 | **높음** |
| `src/lib/guest-token.ts:9` | `'guest-order-secret-key'` 기본값 | **높음** |

**해결 방안**:
```typescript
// Before
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key'

// After
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY
if (!INTERNAL_API_KEY) {
  throw new Error('INTERNAL_API_KEY is required')
}
```

### 3.2 High - Rate Limiting 미구현

로그인 API에 Rate limiting이 없어 브루트포스 공격에 취약합니다.

**권장**: `rate-limiter-flexible` 또는 `@upstash/ratelimit` 도입

### 3.3 Medium - 2FA 미구현

이중 인증이 구현되어 있지 않습니다.

### 3.4 양호한 점

| 항목 | 상태 |
|------|------|
| SQL 인젝션 | 안전 (Prisma ORM 사용) |
| XSS | 안전 (React 자동 이스케이핑) |
| 비밀번호 해싱 | bcrypt cost factor 12 |
| JWT 기반 세션 | 30일 만료 설정 |

---

## 4. API 분석

### 4.1 전체 엔드포인트 (48개)

#### 인증 관련
| 엔드포인트 | 메서드 | 인증 | 설명 |
|------------|--------|------|------|
| `/api/auth/[...nextauth]` | * | X | NextAuth 핸들러 |
| `/api/auth/signup` | POST | X | 회원가입 |
| `/api/auth/complete` | POST | O | 회원가입 완료 |

#### 상품/쇼핑
| 엔드포인트 | 메서드 | 인증 | 설명 |
|------------|--------|------|------|
| `/api/shop/products` | GET | X | 상품 목록 |
| `/api/shop/products/[id]` | GET | X | 상품 상세 |
| `/api/shop/products/[id]/reviews` | GET | X | 상품 리뷰 |

#### 장바구니
| 엔드포인트 | 메서드 | 인증 | 설명 |
|------------|--------|------|------|
| `/api/cart` | CRUD | X | 장바구니 |
| `/api/cart/items/[id]` | DELETE | X | 아이템 삭제 |

#### 주문/결제
| 엔드포인트 | 메서드 | 인증 | 설명 |
|------------|--------|------|------|
| `/api/orders/prepare` | POST | O | 주문 준비 |
| `/api/payments/confirm` | POST | O | 결제 승인 |
| `/api/payments/cancel` | POST | O | 결제 취소 |
| `/api/payments/webhook` | POST | X | 토스 웹훅 |

#### 마이페이지
| 엔드포인트 | 메서드 | 인증 | 설명 |
|------------|--------|------|------|
| `/api/mypage/orders` | GET | O | 주문 내역 |
| `/api/mypage/reviews` | CRUD | O | 리뷰 관리 |
| `/api/mypage/wishlist` | CRUD | O | 찜 목록 |
| `/api/mypage/addresses` | CRUD | O | 배송지 |
| `/api/mypage/profile` | GET/PUT | O | 프로필 |

### 4.2 인증 미들웨어

**문제점**: 중앙화된 인증 미들웨어가 없고 각 API에서 개별 구현

```typescript
// 현재: 각 API에서 중복 구현
const session = await getServerSession(authOptions)
if (!session?.user?.id) {
  return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
}
```

**권장**: 미들웨어에서 인증 체크 통합

### 4.3 에러 핸들링

**양호한 점**:
- 커스텀 에러 클래스 (`ValidationError`, `NotFoundError`)
- TossPayments 에러 코드 매핑
- 구조화된 로깅

**개선 필요**:
- 글로벌 에러 핸들러 미구현
- 일부 에러 메시지 그대로 노출

---

## 5. 데이터베이스

### 5.1 인덱싱 상태 (양호)

**Order 모델**
```prisma
@@index([userId])
@@index([shopId])
@@index([orderNumber])
@@index([status])
@@index([userId, status])  // 복합 인덱스
```

**Product 모델**
```prisma
@@index([userId])
@@index([categoryId])
@@index([createdAt])
```

### 5.2 잠재적 N+1 쿼리

주문 목록 조회 시 깊은 중첩 include 사용:

```typescript
prisma.order.findMany({
  include: {
    items: {
      include: {
        publishedProduct: { include: { product: {...} } },
        variant: {...},
        review: {...}
      }
    },
    payment: {...}
  }
})
```

**권장**: 필요시 select로 필드 제한

---

## 6. 프론트엔드

### 6.1 컴포넌트 구조

```
RootLayout
└── SessionProvider
    └── ToastProvider
        └── ShopLayout
            └── ShopProvider
                └── ThemeProvider
                    └── StoreLayout
                        └── CartNotificationProvider
                            └── Page Content
```

### 6.2 상태 관리

| 용도 | 라이브러리 |
|------|-----------|
| 클라이언트 상태 | Zustand |
| Shop 컨텍스트 | React Context |
| 인증 상태 | NextAuth SessionProvider |
| 장바구니 | Zustand + localStorage persist |

### 6.3 SEO

**양호한 점**:
- Shop별 동적 메타데이터
- 동적 favicon 설정

**개선 필요**:
- Open Graph 메타 태그 미설정
- 상품별 동적 메타데이터 미구현
- sitemap.xml 미생성

---

## 7. 성능

### 7.1 이미지 최적화 (개선 필요)

**문제**: 대부분 `<img>` 태그 직접 사용

**빌드 경고 (30개 이상)**:
```
Warning: Using `<img>` could result in slower LCP and higher bandwidth.
Consider using `<Image />` from `next/image`
```

**영향받는 파일**:
- StoreLayout.tsx
- ProductDetailClient.tsx
- main/page.tsx
- cart/page.tsx
- checkout/page.tsx
- mypage/reviews/page.tsx

### 7.2 캐싱 전략

**현재**:
- 미들웨어: 1분 TTL 메모리 캐시
- API: `cache: 'no-store'` 사용

**권장**:
- 상품 목록/상세 API에 revalidate 적용
- 멀티 서버 환경 시 Redis 도입

---

## 8. 배포 준비 상태

### 8.1 빌드 상태: 실패

**에러**:
```
./src/app/api/guest-payments/confirm/route.ts:339:42
Type error: Property 'FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING'
does not exist on type 'typeof TOSS_ERROR_CODES'
```

**원인**: TOSS_ERROR_CODES 상수에 없는 프로퍼티 참조

### 8.2 필수 환경 변수

| 변수명 | 용도 | 위험도 |
|--------|------|--------|
| DATABASE_URL | DB 연결 | 필수 |
| NEXTAUTH_SECRET | NextAuth | 필수 |
| NEXTAUTH_URL | 콜백 URL | 필수 |
| TOSS_PAYMENTS_SECRET_KEY | 토스 | 필수 |
| TOSS_PAYMENTS_CLIENT_KEY | 토스 | 필수 |
| INTERNAL_API_KEY | 내부 API | **기본값 위험** |
| GUEST_TOKEN_SECRET | 비회원 토큰 | **기본값 위험** |
| COOKIE_DOMAIN | 쿠키 | 권장 |
| NEXT_PUBLIC_ROOT_DOMAIN | 루트 도메인 | 권장 |

### 8.3 로깅

**구현됨**:
- 구조화된 로거
- 개발/프로덕션 환경 구분
- JSON 형식 출력

**미구현**:
- 외부 로깅 서비스 (Sentry 등)
- 성능 모니터링 (APM)

---

## 9. 개선사항 요약

### Critical (즉시 수정)

| # | 문제 | 파일 | 해결 |
|---|------|------|------|
| 1 | 빌드 실패 (타입 에러) | guest-payments/confirm/route.ts:339 | TOSS_ERROR_CODES 수정 |
| 2 | 하드코딩된 시크릿 | middleware.ts, guest-token.ts | 환경 변수 필수 체크 |

### High (배포 전 권장)

| # | 문제 | 해결 |
|---|------|------|
| 3 | 이미지 최적화 미적용 | `<Image />` 컴포넌트 교체 |
| 4 | useEffect 의존성 경고 | ESLint 경고 해결 |
| 5 | Rate limiting 미구현 | 로그인 API에 추가 |
| 6 | 이미지 도메인 전체 허용 | 특정 도메인만 허용 |

### Medium (중기 개선)

| 문제 | 해결 |
|------|------|
| 중앙화된 인증 미들웨어 부재 | 미들웨어 통합 |
| SEO 메타 태그 부족 | Open Graph 추가 |
| 외부 로깅 서비스 미연동 | Sentry 도입 |
| 2FA 미구현 | TOTP 추가 |

### Low (장기 개선)

| 문제 | 해결 |
|------|------|
| 캐싱 전략 부족 | Redis, ISR 적용 |
| 테스트 코드 부재 | Jest, Cypress |
| API 문서화 미비 | OpenAPI 문서 |

---

## 10. 배포 전 체크리스트

### 필수

- [ ] `guest-payments/confirm/route.ts` 타입 에러 수정
- [ ] 모든 환경 변수 설정 확인
- [ ] 기본 시크릿 키 제거 또는 환경 체크 추가
- [ ] `npm run build` 성공 확인
- [ ] 프로덕션 데이터베이스 연결 테스트
- [ ] TossPayments 프로덕션 키 설정
- [ ] HTTPS 인증서 설정
- [ ] 도메인 및 서브도메인 DNS 설정

### 권장

- [ ] 이미지 최적화 적용 (`<Image />` 사용)
- [ ] ESLint 경고 해결
- [ ] Rate limiting 구현
- [ ] next.config.js 이미지 도메인 제한
- [ ] Sentry 에러 모니터링 연동

### 선택

- [ ] Open Graph 메타 태그 추가
- [ ] sitemap.xml 생성
- [ ] 성능 테스트 (Lighthouse)
- [ ] 부하 테스트

---

## 아키텍처 평가

### 강점

1. **모듈화된 구조**: 비즈니스 로직이 modules 폴더에 체계적으로 분리
2. **멀티테넌트 지원**: 서브도메인 기반 Shop 분리 설계
3. **타입 안전성**: TypeScript strict 모드
4. **보안 기본**: bcrypt, JWT, Prisma ORM
5. **결제 시스템**: TossPayments 연동 및 에러 처리

### 약점

1. **테스트 부재**: 단위/통합 테스트 없음
2. **캐싱 전략 미비**: 서버 사이드 캐싱 최소화
3. **이미지 최적화 미적용**: LCP 성능 저하 예상
4. **문서화 부족**: API 문서, 개발 가이드 없음
