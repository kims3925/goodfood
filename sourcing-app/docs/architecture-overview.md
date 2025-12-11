# BandAuto 시스템 아키텍처

> 도매 밴드 상품 자동화 플랫폼의 전체 시스템 구조와 기술 스택 문서

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [전체 아키텍처](#2-전체-아키텍처)
3. [Monorepo 구조](#3-monorepo-구조)
4. [기술 스택](#4-기술-스택)
5. [앱별 상세 구조](#5-앱별-상세-구조)
6. [데이터 흐름](#6-데이터-흐름)
7. [외부 서비스 연동](#7-외부-서비스-연동)
8. [인증 시스템](#8-인증-시스템)
9. [환경 구성](#9-환경-구성)

---

## 1. 시스템 개요

### 1.1 BandAuto란?

BandAuto는 **도매 밴드(Band) 상품을 자동으로 수집, 가공, 판매**하는 통합 플랫폼입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      BandAuto 플랫폼                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   [도매 밴드]  ──수집──▶  [상품 가공]  ──발행──▶  [소매 쇼핑몰]    │
│                              │                                    │
│                         AI 자동화                                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 핵심 기능

| 기능 | 설명 |
|------|------|
| **상품 수집** | Playwright로 네이버 밴드 상품 크롤링 |
| **AI 가공** | Google Gemini로 상품 설명 자동 생성 |
| **멀티채널 발행** | 소매 밴드/쇼핑몰로 상품 자동 배포 |
| **통합 쇼핑몰** | 토스페이먼츠 결제 연동 쇼핑몰 |
| **주문 관리** | 도매/소매 주문 통합 관리 |
| **자동화 스케줄링** | Cron 기반 파이프라인 자동 실행 |

---

## 2. 전체 아키텍처

### 2.1 시스템 구성도

```
                                    ┌──────────────────┐
                                    │   고객 브라우저    │
                                    └────────┬─────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          NGINX (리버스 프록시)                        │
│                    shop.bandauto.com / admin.bandauto.com            │
└─────────────────────────────────────────────────────────────────────┘
                    │                                │
                    ▼                                ▼
┌─────────────────────────────┐    ┌─────────────────────────────┐
│        Shop App             │    │      Sourcing App           │
│      (고객용 쇼핑몰)          │    │      (관리자 앱)             │
├─────────────────────────────┤    ├─────────────────────────────┤
│  • Next.js 14 (App Router)  │    │  • Next.js 14 (App Router)  │
│  • 포트: 3000 (HTTPS)       │    │  • 포트: 3001               │
│  • NextAuth.js 인증         │    │  • JWT 토큰 인증            │
│  • 39개 API 엔드포인트       │    │  • 66개 API 엔드포인트       │
└──────────────┬──────────────┘    └──────────────┬──────────────┘
               │                                   │
               └─────────────┬─────────────────────┘
                             │
                             ▼
               ┌──────────────────────────┐
               │     @bandauto/db         │
               │    (Prisma Client)       │
               ├──────────────────────────┤
               │  • 20개 데이터 모델       │
               │  • 공유 타입 정의         │
               │  • 트랜잭션 관리          │
               └──────────────┬───────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │        MySQL             │
               │    (Production)          │
               ├──────────────────────────┤
               │  • InnoDB 엔진           │
               │  • UTF8MB4 인코딩         │
               │  • 40+ 테이블             │
               └──────────────────────────┘
```

### 2.2 서비스 간 통신

```
┌─────────────┐         ┌─────────────┐
│  Shop App   │◀───────▶│Sourcing App │
└──────┬──────┘   API   └──────┬──────┘
       │                        │
       │    ┌──────────┐        │
       └───▶│   MySQL  │◀───────┘
            └──────────┘
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│   Redis     │     │ File System │
│ (세션/캐시)  │     │ (이미지저장) │
└─────────────┘     └─────────────┘
```

---

## 3. Monorepo 구조

### 3.1 디렉토리 구조

```
bandauto/
│
├── package.json              # 루트 워크스페이스 설정
├── package-lock.json
│
├── db/                       # 📦 @bandauto/db 패키지
│   ├── package.json          #    공유 Prisma 클라이언트
│   ├── src/
│   │   ├── client.ts         #    Prisma 인스턴스 export
│   │   └── generated/        #    생성된 Prisma Client
│   └── prisma/
│       ├── schema.prisma     #    Generator, Datasource
│       └── models/           #    20개 모델 파일
│           ├── user.prisma
│           ├── product.prisma
│           ├── order.prisma
│           └── ... (17개 더)
│
├── shop-app/                 # 🛒 고객용 쇼핑몰 앱
│   ├── package.json
│   ├── next.config.js
│   ├── server.js             #    HTTPS 개발 서버
│   └── src/
│       ├── app/              #    Next.js App Router
│       │   ├── api/          #    39개 API 라우트
│       │   ├── (shop)/       #    쇼핑몰 페이지
│       │   └── (auth)/       #    인증 페이지
│       ├── modules/          #    앱 전용 모듈
│       │   ├── auth/
│       │   ├── cart/
│       │   ├── order/
│       │   └── payments/
│       └── components/       #    UI 컴포넌트
│
├── sourcing-app/             # ⚙️ 관리자/워커 앱
│   ├── package.json
│   ├── next.config.js
│   └── src/
│       ├── app/              #    Next.js App Router
│       │   ├── api/          #    66개 API 라우트
│       │   └── (admin)/      #    관리자 페이지
│       ├── modules/          #    앱 전용 모듈
│       │   ├── auth/
│       │   ├── automation/   #    자동화 엔진
│       │   ├── sourcing/     #    상품 수집
│       │   ├── transformation/  AI 가공
│       │   ├── publish/      #    상품 발행
│       │   └── band-session/ #    밴드 로그인
│       ├── components/       #    관리자 UI
│       └── docs/             #    📚 문서 (현재 폴더)
│
└── modules/                  # 공유 모듈 (선택적)
```

### 3.2 워크스페이스 설정

```json
// package.json (루트)
{
  "name": "bandauto",
  "private": true,
  "workspaces": [
    "db",
    "shop-app",
    "sourcing-app"
  ],
  "scripts": {
    "dev:shop": "npm run dev --workspace=shop-app",
    "dev:sourcing": "npm run dev --workspace=sourcing-app",
    "dev:all": "concurrently \"npm run dev:shop\" \"npm run dev:sourcing\"",
    "build:all": "npm run build --workspaces",
    "prisma:generate": "npm run generate --workspace=db"
  }
}
```

### 3.3 패키지 의존성

```
┌─────────────────────────────────────────────────────────┐
│                    bandauto (root)                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│    ┌─────────────┐                                      │
│    │  @bandauto  │                                      │
│    │     /db     │◀─────────────────┐                   │
│    └──────┬──────┘                  │                   │
│           │                          │                   │
│           │ (import)                 │ (import)         │
│           │                          │                   │
│    ┌──────▼──────┐           ┌──────┴──────┐           │
│    │  shop-app   │           │sourcing-app │           │
│    └─────────────┘           └─────────────┘           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 기술 스택

### 4.1 프론트엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| **Next.js** | 14.2.3 | React 프레임워크 (App Router) |
| **React** | 18.2.0 | UI 라이브러리 |
| **TypeScript** | 5.3.3 | 타입 안전성 |
| **Tailwind CSS** | 3.4.1 | 스타일링 |
| **Zustand** | 4.5.0 | 상태 관리 |
| **React Hook Form** | 7.49.0 | 폼 관리 |
| **Zod** | 3.22.4 | 스키마 검증 |

### 4.2 백엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| **Next.js API Routes** | 14.2.3 | API 서버 |
| **Prisma** | 6.19.0 | ORM |
| **NextAuth.js** | 4.24.6 | 인증 (Shop App) |
| **JWT** | - | 인증 (Sourcing App) |
| **node-cron** | 4.2.1 | 스케줄링 |
| **Bull** | 4.16.5 | 작업 큐 (예정) |

### 4.3 데이터베이스

| 기술 | 버전 | 용도 |
|------|------|------|
| **MySQL** | 8.0+ | 프로덕션 DB |
| **SQLite** | - | 개발 DB (옵션) |
| **Redis** | 4.6.12 | 캐시/세션 (예정) |

### 4.4 자동화 & 크롤링

| 기술 | 버전 | 용도 |
|------|------|------|
| **Playwright** | 1.55.0 | 브라우저 자동화 |
| **Cheerio** | - | HTML 파싱 |

### 4.5 외부 서비스

| 서비스 | 용도 |
|--------|------|
| **토스페이먼츠** | 결제 처리 |
| **Google Gemini** | AI 상품 설명 생성 |
| **네이버 밴드 API** | 밴드 게시글 연동 |

---

## 5. 앱별 상세 구조

### 5.1 Shop App (고객용 쇼핑몰)

```
shop-app/src/
├── app/
│   ├── api/                      # API 라우트 (39개)
│   │   ├── auth/                 # 인증
│   │   │   └── [...nextauth]/
│   │   ├── cart/                 # 장바구니
│   │   ├── orders/               # 주문
│   │   ├── payments/             # 결제
│   │   ├── guest-orders/         # 비회원 주문
│   │   ├── mypage/               # 마이페이지
│   │   └── shop/                 # 상품 조회
│   │
│   ├── (shop)/                   # 쇼핑몰 페이지
│   │   ├── page.tsx              # 홈
│   │   ├── products/             # 상품 목록/상세
│   │   ├── cart/                 # 장바구니
│   │   └── checkout/             # 결제
│   │
│   └── (auth)/                   # 인증 페이지
│       ├── login/
│       └── signup/
│
├── modules/                      # 비즈니스 로직
│   ├── auth/
│   │   └── auth.service.ts       # NextAuth 설정
│   ├── cart/
│   │   ├── cart.service.ts
│   │   └── cart.repository.ts
│   ├── order/
│   │   ├── order.service.ts
│   │   └── order.repository.ts
│   └── payments/
│       └── toss-payments.service.ts
│
└── components/                   # UI 컴포넌트
    ├── ui/                       # 기본 UI
    ├── shop/                     # 쇼핑몰 전용
    └── layout/                   # 레이아웃
```

### 5.2 Sourcing App (관리자 앱)

```
sourcing-app/src/
├── app/
│   ├── api/                      # API 라우트 (66개)
│   │   ├── auth/                 # 인증
│   │   ├── automation/           # 자동화
│   │   ├── product/              # 상품 관리
│   │   ├── channel/              # 채널 관리
│   │   ├── order/                # 주문 관리
│   │   ├── settlement/           # 정산
│   │   └── admin/                # 관리자 기능
│   │
│   └── (admin)/                  # 관리자 페이지
│       ├── sourcing/             # 상품 소싱
│       │   ├── product/          # 상품 관리
│       │   ├── channel/          # 채널 관리
│       │   └── automation/       # 자동화 설정
│       ├── order/                # 주문 관리
│       ├── settlement/           # 정산 관리
│       └── settings/             # 설정
│
├── modules/                      # 비즈니스 로직
│   ├── auth/
│   │   └── auth.service.ts       # JWT 인증
│   ├── automation/
│   │   ├── scheduler.ts          # Cron 스케줄러
│   │   └── pipeline.ts           # 파이프라인 실행
│   ├── sourcing/
│   │   └── domain/src/
│   │       ├── channel/          # 채널 관리
│   │       └── collected-product/ # 수집 상품
│   ├── transformation/
│   │   └── ai-transform.service.ts  # AI 가공
│   ├── publish/
│   │   ├── publishers/           # 플랫폼별 발행
│   │   │   ├── band.publisher.ts
│   │   │   └── types.ts
│   │   └── publish.service.ts
│   └── band-session/
│       ├── band-session.service.ts
│       └── band-login.automation.ts  # Playwright
│
└── middleware.ts                 # JWT 인증 미들웨어
```

---

## 6. 데이터 흐름

### 6.1 상품 수집 → 발행 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                    자동화 파이프라인 흐름                          │
└─────────────────────────────────────────────────────────────────┘

1. 수집 단계
   ┌──────────┐     ┌──────────┐     ┌──────────────┐
   │ 도매밴드  │────▶│Playwright│────▶│CollectedProduct│
   │ (Band)   │     │ 크롤링    │     │    (DB)       │
   └──────────┘     └──────────┘     └──────────────┘

2. 가공 단계
   ┌──────────────┐     ┌──────────┐     ┌──────────┐
   │CollectedProduct│───▶│ Gemini   │────▶│ Product  │
   │    (DB)       │     │ AI 가공  │     │  (DB)    │
   └──────────────┘     └──────────┘     └──────────┘

3. 발행 단계
   ┌──────────┐     ┌──────────────┐     ┌──────────────────┐
   │ Product  │────▶│ Publisher    │────▶│ PublishedProduct │
   │  (DB)    │     │ (Band/쇼핑몰) │     │      (DB)        │
   └──────────┘     └──────────────┘     └──────────────────┘
```

### 6.2 주문 처리 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                      주문 처리 흐름                               │
└─────────────────────────────────────────────────────────────────┘

고객 주문 (Shop App)
   │
   ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 장바구니 담기 │────▶│  결제 요청   │────▶│ 토스페이먼츠  │
│  (Cart)      │     │  (Order)     │     │   API 호출   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  주문 완료   │◀────│  결제 승인   │
                     │  (Order)     │     │  (Payment)   │
                     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ 정산 처리    │  ←── Sourcing App
                     │(Settlement)  │
                     └──────────────┘
```

---

## 7. 외부 서비스 연동

### 7.1 토스페이먼츠

```
┌─────────────────────────────────────────────────────────────┐
│                    토스페이먼츠 연동                          │
└─────────────────────────────────────────────────────────────┘

클라이언트 (브라우저)
   │
   │ 1. 결제 위젯 초기화
   │    TOSS_PAYMENTS_CLIENT_KEY
   │
   ▼
┌──────────────────┐
│  토스 결제 위젯   │  ←── @tosspayments/payment-widget-sdk
└────────┬─────────┘
         │
         │ 2. 결제 요청 → 결제 완료
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│   Shop App API   │────▶│ 토스페이먼츠 API  │
│ /api/payments/   │     │  payments/confirm │
│    confirm       │◀────│                  │
└──────────────────┘     └──────────────────┘
         │
         │ 3. DB 저장
         ▼
   ┌─────────────┐
   │  Payment    │
   │  Order      │
   └─────────────┘
```

**환경 변수:**
```env
TOSS_PAYMENTS_CLIENT_KEY=test_gck_xxxxx  # 클라이언트용
TOSS_PAYMENTS_SECRET_KEY=test_gsk_xxxxx  # 서버용
```

### 7.2 Google Gemini AI

```
┌─────────────────────────────────────────────────────────────┐
│                    Gemini AI 연동                            │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│ CollectedProduct │
│  (원본 상품)      │
└────────┬─────────┘
         │
         │ 상품명, 설명, 이미지
         ▼
┌──────────────────┐     ┌──────────────────┐
│  AI Transform    │────▶│   Gemini API     │
│    Service       │     │  (gemini-pro)    │
└────────┬─────────┘     └──────────────────┘
         │
         │ 가공된 설명, 키워드, 카테고리
         ▼
┌──────────────────┐
│    Product       │
│  (가공된 상품)    │
└──────────────────┘
```

**환경 변수:**
```env
GEMINI_API_KEY=AIzaSyxxxxx
```

### 7.3 네이버 밴드 연동

```
┌─────────────────────────────────────────────────────────────┐
│                    밴드 API 연동                             │
└─────────────────────────────────────────────────────────────┘

방법 1: Open API (텍스트만)
   ┌──────────────┐
   │ Band Open API│  ←── accessToken 필요
   │  (글 작성)    │
   └──────────────┘

방법 2: Internal API (이미지 포함) - Playwright 필요
   ┌──────────────┐     ┌──────────────┐
   │  Playwright  │────▶│ 네이버 로그인 │
   │  (자동화)     │     │  (band.us)   │
   └──────────────┘     └──────────────┘
          │
          │ 세션 쿠키 획득
          ▼
   ┌──────────────┐
   │Band Internal │  ←── 이미지 업로드 가능
   │    API       │
   └──────────────┘
```

---

## 8. 인증 시스템

### 8.1 Shop App (NextAuth.js)

```
┌─────────────────────────────────────────────────────────────┐
│                  Shop App 인증 흐름                          │
└─────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  로그인   │────▶│  NextAuth    │────▶│   Prisma     │
│  페이지   │     │  Provider    │     │   Adapter    │
└──────────┘     └──────────────┘     └──────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │   Session    │  ←── 쿠키 기반
                 │   Cookie     │
                 └──────────────┘
```

**설정:**
```typescript
// shop-app/src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => { ... }
    })
  ],
  session: { strategy: 'jwt' }
}
```

### 8.2 Sourcing App (JWT)

```
┌─────────────────────────────────────────────────────────────┐
│                Sourcing App 인증 흐름                        │
└─────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  로그인   │────▶│  JWT 발급    │────▶│   Cookie     │
│  API     │     │ auth.service │     │  auth-token  │
└──────────┘     └──────────────┘     └──────────────┘
                                             │
                                             ▼
                                      ┌──────────────┐
                                      │  Middleware  │
                                      │  (검증)      │
                                      └──────────────┘
```

**미들웨어:**
```typescript
// sourcing-app/src/middleware.ts
export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value

  // 토큰 검증
  const user = await verifyJWT(token)
  if (!user) {
    return NextResponse.redirect('/login')
  }

  // ADMIN, MANAGER만 접근 허용
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.redirect('/unauthorized')
  }
}

export const config = {
  matcher: [
    '/((?!api/auth|login|_next|favicon.ico).*)'
  ]
}
```

---

## 9. 환경 구성

### 9.1 개발 환경

```bash
# 전체 설치
npm install

# Prisma 클라이언트 생성
cd db && npx prisma generate --schema prisma

# 개발 서버 실행
npm run dev:shop      # http://localhost:3000 (HTTPS)
npm run dev:sourcing  # http://localhost:3001

# 동시 실행
npm run dev:all
```

### 9.2 환경 변수

**db/.env**
```env
DATABASE_URL="mysql://user:password@localhost:3306/bandauto"
```

**shop-app/.env**
```env
# 앱 설정
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# 토스페이먼츠
TOSS_PAYMENTS_CLIENT_KEY=test_gck_xxxxx
TOSS_PAYMENTS_SECRET_KEY=test_gsk_xxxxx

# 도메인 설정
NEXT_PUBLIC_DOMAIN=bandauto.com
```

**sourcing-app/.env**
```env
# 앱 설정
JWT_SECRET=your-jwt-secret
NEXT_PUBLIC_API_URL=http://localhost:3001

# 외부 API
GEMINI_API_KEY=AIzaSyxxxxx
BAND_API_BASE_URL=https://openapi.band.us

# Playwright
PLAYWRIGHT_HEADLESS=true
```

### 9.3 포트 구성

| 서비스 | 포트 | 프로토콜 |
|--------|------|----------|
| Shop App | 3000 | HTTPS |
| Sourcing App | 3001 | HTTP |
| MySQL | 3306 | TCP |
| Redis | 6379 | TCP |

---

## 다음 문서

- [Docker 배포 가이드](./docker-deployment-guide.md)
- [Playwright 스케일링 전략](./playwright-scaling-strategy.md)
