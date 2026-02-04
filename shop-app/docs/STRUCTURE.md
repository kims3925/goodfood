# 명명 규칙 및 구조

> **관련 문서:** [PROJECT.md](./PROJECT.md) | [../CLAUDE.md](../CLAUDE.md)

---

## 명명 규칙

### 일반

| 대상 | 규칙 | 예시 |
|-----|-----|-----|
| 파일명 | kebab-case | `user-profile.tsx`, `band-session.ts` |
| 폴더명 | kebab-case | `band-session-extension/`, `shop-app/` |
| 컴포넌트 | PascalCase | `UserProfile`, `ProductCard` |
| 함수/변수 | camelCase | `getUserProfile`, `productList` |
| 상수 | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_TIMEOUT` |
| 환경변수 | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `NEXTAUTH_SECRET` |
| 타입/인터페이스 | PascalCase | `UserProfile`, `ProductVariant` |

### 데이터베이스

| 대상 | 규칙 | 예시 |
|-----|-----|-----|
| Prisma 모델 | PascalCase | `User`, `CollectedPost` |
| Prisma 필드 | camelCase | `createdAt`, `wholesalePrice` |
| FK 필드 | `{참조모델}Id` | `userId`, `productId` |
| Enum | PascalCase | `UserRole`, `OrderStatus` |
| Enum 값 | SCREAMING_SNAKE_CASE | `PENDING`, `COMPLETED` |

### API

| 대상 | 규칙 | 예시 |
|-----|-----|-----|
| API Route 폴더 | kebab-case | `/api/collected-posts/`, `/api/wholesale-bands/` |
| Query Param | camelCase | `?pageSize=10&bandKey=xxx` |
| Body 필드 | camelCase | `{ userName: "", bandKey: "" }` |
| Dynamic Route | `[param]` | `[id]/`, `[...nextauth]/` |

---

## 디렉토리 구조

```text
bandauto/
├── db/                           # 공유 Prisma 패키지 (@bandauto/db)
│   ├── prisma/
│   │   ├── schema.prisma         # generator, datasource, enum
│   │   └── models/               # 도메인별 모델 분리
│   │       ├── user.prisma
│   │       ├── product.prisma
│   │       ├── order.prisma
│   │       └── ...
│   └── src/
│       └── index.ts              # PrismaClient export
│
├── sourcing-app/                 # 소싱 관리 앱 (포트 3001)
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── (admin)/          # 인증 필요 라우트
│   │   │   │   ├── sourcing/     # 소싱 관련 페이지
│   │   │   │   └── shop/         # 쇼핑몰 관리 페이지
│   │   │   └── api/              # API Routes
│   │   ├── components/           # UI 컴포넌트
│   │   │   ├── layout/           # 레이아웃 (Header, Sidebar)
│   │   │   ├── ui/               # 공통 UI (Button, Modal)
│   │   │   ├── product/          # 상품 관련 컴포넌트
│   │   │   └── shop/             # 쇼핑몰 관련 컴포넌트
│   │   ├── modules/              # 도메인 모듈
│   │   │   ├── sourcing/         # 소싱 도메인
│   │   │   ├── catalog/          # 카탈로그 도메인
│   │   │   ├── automation/       # 자동화 도메인
│   │   │   └── transformation/   # AI 변환 도메인
│   │   ├── lib/                  # 유틸리티
│   │   ├── services/             # 서비스 레이어
│   │   ├── config/               # 앱 설정
│   │   ├── constants/            # 상수 정의
│   │   ├── contexts/             # React Context
│   │   └── types/                # TypeScript 타입
│   └── public/                   # 정적 파일
│
├── shop-app/                     # 쇼핑몰 앱 (포트 3000)
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── (shop)/           # 쇼핑몰 라우트 그룹
│   │   │   │   ├── auth/         # 인증 (로그인, 회원가입)
│   │   │   │   ├── band/         # 밴드 연동 페이지
│   │   │   │   ├── cart/         # 장바구니
│   │   │   │   ├── checkout/     # 결제
│   │   │   │   ├── cs/           # 고객 서비스 (문의)
│   │   │   │   ├── main/         # 메인 페이지
│   │   │   │   ├── mypage/       # 마이페이지
│   │   │   │   ├── order/        # 주문 관련
│   │   │   │   ├── payment/      # 결제 결과
│   │   │   │   ├── privacy/      # 개인정보처리방침
│   │   │   │   ├── product/      # 상품 상세
│   │   │   │   └── terms/        # 이용약관
│   │   │   ├── order/band/       # 밴드 주문 (별도 라우트)
│   │   │   └── api/              # API Routes
│   │   │       ├── auth/         # NextAuth 인증
│   │   │       ├── cart/         # 장바구니 API
│   │   │       ├── orders/       # 주문 API
│   │   │       ├── payments/     # 결제 API
│   │   │       ├── guest-orders/ # 비회원 주문 API
│   │   │       ├── guest-payments/ # 비회원 결제 API
│   │   │       ├── mypage/       # 마이페이지 API
│   │   │       ├── shop/         # 쇼핑몰 정보 API
│   │   │       ├── cs/           # CS API
│   │   │       ├── cron/         # 스케줄 작업
│   │   │       └── internal/     # 내부 API
│   │   ├── components/           # 공유 컴포넌트
│   │   │   ├── cart/             # 장바구니 컴포넌트
│   │   │   ├── common/           # 공통 UI
│   │   │   └── theme/            # 테마 컴포넌트
│   │   ├── modules/              # 도메인 모듈 (서비스 레이어)
│   │   │   ├── auth/             # 인증 모듈
│   │   │   │   ├── services/
│   │   │   │   └── stores/
│   │   │   ├── cart/             # 장바구니 모듈
│   │   │   │   ├── components/
│   │   │   │   ├── services/
│   │   │   │   └── stores/
│   │   │   ├── order/            # 주문 모듈
│   │   │   │   ├── repository/
│   │   │   │   └── services/
│   │   │   ├── guest-order/      # 비회원 주문 모듈
│   │   │   │   ├── repository/
│   │   │   │   └── services/
│   │   │   ├── payments/         # 결제 모듈
│   │   │   │   ├── components/
│   │   │   │   ├── constants/
│   │   │   │   ├── services/
│   │   │   │   └── stores/
│   │   │   ├── cs/               # CS 모듈
│   │   │   │   └── services/
│   │   │   └── common/           # 공통 모듈
│   │   │       ├── kernel/
│   │   │       ├── providers/
│   │   │       ├── ui-kit/
│   │   │       └── utils/
│   │   ├── hooks/                # Custom Hooks
│   │   │   ├── usePresence.ts    # 실시간 접속자 추적
│   │   │   └── useShopUrl.ts     # 쇼핑몰 URL 관리
│   │   ├── lib/                  # 유틸리티/설정
│   │   ├── services/             # 외부 서비스 연동
│   │   ├── contexts/             # React Context
│   │   └── types/                # TypeScript 타입
│   ├── public/                   # 정적 파일
│   └── docs/                     # 문서
│       ├── tracking/             # 추적 문서
│       └── *.md                  # 가이드 문서
│
├── band-session-extension/       # Chrome 확장프로그램
│   ├── manifest.json             # 확장 설정 (externally_connectable 포함)
│   ├── config.js                 # 공통 설정 (SERVER_URL, AUTO_SAVE_INTERVAL)
│   ├── background.js             # 서비스 워커 (자동 저장, 웹 연동)
│   ├── popup.html                # 팝업 UI
│   └── popup.js                  # 팝업 로직
│
├── scripts/                      # 빌드/배포 스크립트
├── docs/                         # 기존 문서
├── Claude_DOCS/                  # Claude AI 작업용 문서
├── docker/                       # Docker 설정 파일
├── docker-compose.yml            # Docker Compose 설정
└── package.json                  # 루트 workspace 설정
```

---

## 모듈 구조 (shop-app)

shop-app의 modules 폴더는 도메인별로 서비스 로직을 분리합니다:

```text
modules/{domain}/
├── components/       # 도메인 전용 UI 컴포넌트
├── services/         # 비즈니스 로직/API 호출
├── repository/       # 데이터 접근 레이어
├── stores/           # Zustand 상태 관리
├── constants/        # 상수 정의
└── types/            # 도메인 타입
```

### shop-app 주요 모듈

| 모듈 | 설명 | 주요 기능 |
|-----|-----|---------|
| auth | 인증 도메인 | 로그인, 회원가입, 세션 관리 |
| cart | 장바구니 도메인 | 장바구니 CRUD, 세션 카트 |
| order | 주문 도메인 | 주문 생성, 조회, 상태 관리 |
| guest-order | 비회원 주문 | 비회원 주문 처리 |
| payments | 결제 도메인 | Toss 결제, 환불, 가상계좌 |
| cs | 고객 서비스 | 문의, 1:1 상담 |
| common | 공통 모듈 | UI Kit, 유틸리티, Provider |

---

## App Router 패턴

### Route Groups

| 패턴 | 설명 | 예시 |
|-----|-----|-----|
| `(group)` | 레이아웃 그룹핑 | `(admin)`, `(shop)` |
| `[param]` | 동적 라우트 | `[id]`, `[slug]` |
| `[...slug]` | Catch-all | `[...nextauth]` |

### 폴더 구조 예시 (shop-app)

```text
app/(shop)/                        # 쇼핑몰 Route Group
├── auth/
│   ├── login/
│   │   └── page.tsx              # /auth/login
│   └── register/
│       └── page.tsx              # /auth/register
├── product/
│   └── [id]/
│       └── page.tsx              # /product/123
├── cart/
│   └── page.tsx                  # /cart
├── checkout/
│   └── page.tsx                  # /checkout
├── order/
│   └── [orderNumber]/
│       └── page.tsx              # /order/ORD-123
├── mypage/
│   ├── page.tsx                  # /mypage
│   ├── orders/
│   │   └── page.tsx              # /mypage/orders
│   └── profile/
│       └── page.tsx              # /mypage/profile
└── payment/
    ├── success/
    │   └── page.tsx              # /payment/success
    └── fail/
        └── page.tsx              # /payment/fail

app/api/                           # API Routes
├── auth/
│   └── [...nextauth]/
│       └── route.ts              # NextAuth.js
├── cart/
│   └── route.ts                  # GET, POST, DELETE
├── orders/
│   ├── route.ts                  # POST (주문 생성)
│   └── [orderNumber]/
│       └── route.ts              # GET (주문 조회)
└── payments/
    ├── confirm/
    │   └── route.ts              # POST (결제 승인)
    └── virtual-account/
        └── webhook/
            └── route.ts          # POST (가상계좌 입금 웹훅)
```

---

## 파일 패턴

| 유형 | 패턴 | 위치 |
|-----|-----|-----|
| 페이지 | `page.tsx` | `app/{route}/` |
| 레이아웃 | `layout.tsx` | `app/{route}/` |
| 로딩 | `loading.tsx` | `app/{route}/` |
| 에러 | `error.tsx` | `app/{route}/` |
| API Route | `route.ts` | `app/api/{route}/` |
| 컴포넌트 | `{Name}.tsx` | `components/{category}/` |
| 훅 | `use{Name}.ts` | `hooks/` |
| 서비스 | `{name}.service.ts` | `services/` |
| 타입 | `{name}.types.ts` | `types/` |

---

## 임포트 순서

```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 2. 외부 패키지
import { z } from 'zod'
import { toast } from 'sonner'

// 3. 내부 패키지
import { prisma } from '@bandauto/db'

// 4. 내부 모듈 (@/)
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

// 5. 상대 경로
import { ProductCard } from './ProductCard'

// 6. 타입 (별도)
import type { Product } from '@/types/product.types'
```

---

## 레이어 의존성

```text
┌─────────────────┐
│   app/pages     │  ← UI Layer
├─────────────────┤
│   components    │  ← Presentation Layer
├─────────────────┤
│   services      │  ← Application Layer
├─────────────────┤
│   modules       │  ← Domain Layer
├─────────────────┤
│   lib/prisma    │  ← Infrastructure Layer
└─────────────────┘
```

| 규칙 |
|-----|
| 상위 → 하위 의존만 허용 |
| Domain Layer는 Infrastructure에 직접 의존 금지 |
| Repository 인터페이스를 통해 의존성 역전 |

---

## Prisma 스키마 구조

```text
db/prisma/
├── schema.prisma                 # generator, datasource, enum 정의
└── models/
    ├── user.prisma               # User, SourcingApiConfig, AiApiConfig
    ├── channel.prisma            # WholesaleBand, RetailBand
    ├── post.prisma               # CollectedPost
    ├── collected-product.prisma  # CollectedProduct
    ├── product.prisma            # Product, ProductVariant, ProductOption
    ├── publish.prisma            # ProductPublish, PublishHistory
    ├── order.prisma              # Order, OrderItem
    ├── payment.prisma            # Payment
    ├── cart.prisma               # SessionCart, SessionCartItem, CartItem
    ├── coupon.prisma             # Coupon, CouponUsage
    ├── review.prisma             # Review
    ├── settlement.prisma         # Settlement
    ├── automation.prisma         # AutomationPipeline, PipelineLog
    └── ...
```

### Prisma CLI 사용 시 주의

```bash
# 반드시 db 폴더에서 --schema prisma 옵션 사용
cd db
npx prisma generate --schema prisma
npx prisma db push --schema prisma
npx prisma studio --schema prisma
```
