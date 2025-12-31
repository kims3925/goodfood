# 명명 규칙 및 구조

> **관련 문서:** [PROJECT.md](./PROJECT.md) | [CLAUDE.md](./CLAUDE.md)

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

```
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
│   │   │   ├── (shop)/           # 쇼핑몰 라우트
│   │   │   │   ├── auth/         # 인증 (로그인, 회원가입)
│   │   │   │   ├── product/      # 상품 상세
│   │   │   │   ├── cart/         # 장바구니
│   │   │   │   ├── checkout/     # 결제
│   │   │   │   ├── mypage/       # 마이페이지
│   │   │   │   └── order/        # 주문
│   │   │   └── api/              # API Routes
│   │   ├── components/           # UI 컴포넌트
│   │   ├── hooks/                # Custom Hooks
│   │   ├── modules/              # 도메인 모듈
│   │   ├── lib/                  # 유틸리티
│   │   ├── services/             # 서비스 레이어
│   │   └── contexts/             # React Context
│   └── public/                   # 정적 파일
│
├── band-session-extension/       # Chrome 확장프로그램
│   ├── manifest.json
│   ├── popup.html
│   └── scripts/
│
├── scripts/                      # 빌드/배포 스크립트
├── docs/                         # 기존 문서
├── Claude_DOCS/                  # Claude AI 작업용 문서
├── cd-Jenkinsfile                # CD 파이프라인
├── ci-Jenkinsfile                # CI 파이프라인
└── package.json                  # 루트 workspace 설정
```

---

## 모듈 구조 (Domain-Driven)

sourcing-app의 modules 폴더는 DDD 패턴을 따릅니다:

```
modules/{feature}/
├── domain/
│   └── src/
│       └── {subdomain}/
│           ├── repository/       # 데이터 접근 인터페이스
│           ├── services/         # 비즈니스 로직
│           └── types/            # 도메인 타입
```

### 주요 모듈

| 모듈 | 설명 | 주요 기능 |
|-----|-----|---------|
| sourcing | 소싱 도메인 | 채널 관리, 게시물 수집, CS |
| catalog | 카탈로그 도메인 | 상품 관리, 변환 |
| automation | 자동화 도메인 | 파이프라인, 스케줄링 |
| transformation | 변환 도메인 | AI 상품 변환 |
| config | 설정 도메인 | 정책, 시스템 설정 |
| publish | 발행 도메인 | 소매채널 발행 |

---

## App Router 패턴

### Route Groups

| 패턴 | 설명 | 예시 |
|-----|-----|-----|
| `(group)` | 레이아웃 그룹핑 | `(admin)`, `(shop)` |
| `[param]` | 동적 라우트 | `[id]`, `[slug]` |
| `[...slug]` | Catch-all | `[...nextauth]` |

### 폴더 구조 예시

```
app/(admin)/sourcing/
├── channels/
│   ├── wholesale/
│   │   ├── list/
│   │   │   └── page.tsx          # /sourcing/channels/wholesale/list
│   │   ├── new/
│   │   │   └── page.tsx          # /sourcing/channels/wholesale/new
│   │   └── detail/
│   │       └── [id]/
│   │           └── page.tsx      # /sourcing/channels/wholesale/detail/123
│   └── retail/
│       └── ...
├── posts/
│   ├── collected/
│   └── published/
└── settings/
    ├── ai/
    ├── automation/
    └── general/
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

```
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

```
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
