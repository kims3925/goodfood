# BandAuto - Modular E-commerce & Sourcing Platform

BandAuto는 도매 밴드 상품 자동화부터 AI 상세페이지 생성, 토스페이먼츠 통합 쇼핑몰까지 제공하는 풀스택 자동화 플랫폼입니다.

## 🏗️ 프로젝트 구조

이 프로젝트는 **2개의 독립적인 Next.js 앱**과 **공유 모듈**로 구성된 모노레포입니다:

```
bandauto/
├── shop-app/          # 고객용 쇼핑몰 앱 (포트 3000)
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   ├── components/      # 쇼핑몰 UI 컴포넌트
│   │   ├── stores/          # Zustand 상태 관리
│   │   └── modules/         # E-commerce 전용 모듈
│   │       ├── order/       # 주문 관리
│   │       ├── payments/    # 결제 처리 (토스페이먼츠)
│   │       ├── cart/        # 장바구니
│   │       ├── product/     # 상품 관리
│   │       └── user/        # 사용자/고객 관리
│   └── .env.local           # E-commerce 환경변수
│
├── sourcing-app/            # 관리자/워커 앱 (포트 3001)
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   ├── components/      # 관리자 UI 컴포넌트
│   │   └── modules/         # Sourcing 전용 모듈
│   │       ├── config/      # API/AI 설정
│   │       ├── sourcing/    # 도매 상품 수집
│   │       ├── transformation/  # AI 상품 가공 (게시글 → 상세페이지)
│   │       ├── catalog/     # 상품 카탈로그
│   │       ├── shop/        # 쇼핑몰 관리
│   │       └── monitoring/  # 파이프라인 모니터링
│   └── .env.local           # Sourcing 환경변수
│
├── modules/                 # 공통 모듈
│   └── common/
│       ├── kernel/          # 공통 타입 정의
│       ├── utils/           # 유틸리티 함수
│       └── ui-kit/          # 공유 UI 컴포넌트
│
├── prisma/                  # 공유 데이터베이스
│   ├── schema.prisma        # 20개 모델 정의
│   ├── dev.db               # SQLite 데이터베이스 (개발 환경)
│   └── migrations/          # 데이터베이스 마이그레이션 히스토리
│
└── docs/                    # 프로젝트 문서
    ├── api/                 # API 레퍼런스
    ├── project/             # 프로젝트 문서
    ├── migration/           # 마이그레이션 가이드
    │   └── DB-MIGRATION-GUIDE.md  # SQLite → MySQL 전환 가이드
    └── architecture/        # 아키텍처 문서
```

## 🎯 2-App 아키텍처

### Shop App (고객용 쇼핑몰)
- **포트**: 3000
- **역할**: 고객이 상품을 보고 구매하는 프론트엔드
- **핵심 기능**:
  - 상품 목록/상세 페이지
  - 장바구니 (Zustand)
  - 토스페이먼츠 결제
  - 주문 관리
  - 고객 계정 관리

### Sourcing App (관리자/워커)
- **포트**: 3001
- **역할**: 관리자가 상품을 수집하고 AI로 가공하는 백오피스
- **핵심 기능**:
  - 도매 밴드 크롤링 (Playwright)
  - AI 상품 가공 (Gemini - 게시글 → 상세페이지)
  - 상품 카탈로그 관리
  - 쇼핑몰 설정
  - 파이프라인 모니터링

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
# v1.1 브랜치 클론
git clone -b 1.1 https://github.com/abcpharm00002-spec/bandauto.git
cd bandauto

# 의존성 설치
npm install

### 2. 데이터베이스 초기화
```bash
npx prisma generate
npx prisma db push
```

### 3. 환경변수 설정

**shop-app/.env.local**
```env
DATABASE_URL="file:../prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
TOSS_PAYMENTS_CLIENT_KEY=""
TOSS_PAYMENTS_SECRET_KEY=""
```

**sourcing-app/.env.local**
```env
DATABASE_URL="file:../prisma/dev.db"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-key"
GEMINI_API_KEY=""
BAND_CLIENT_ID=""
BAND_CLIENT_SECRET=""
```

### 4. 개발 서버 실행

**각 앱 개별 실행:**
```bash
# E-commerce 앱 (포트 3000)
npm run dev:shop

# Sourcing 앱 (포트 3001)
npm run dev:sourcing
```

**두 앱 동시 실행:**
```bash
npm run dev:all
```

## 📦 모듈 접근 제어

### 앱별 모듈 접근 규칙

1. **Shop App**
   - ✅ `modules/common/*` 접근 가능 (공통 모듈)
   - ✅ `src/modules/*` 접근 가능 (앱 전용 모듈)
   - ❌ `sourcing-app/src/modules/*` 접근 불가

2. **Sourcing App**
   - ✅ `modules/common/*` 접근 가능 (공통 모듈)
   - ✅ `src/modules/*` 접근 가능 (앱 전용 모듈)
   - ❌ `shop-app/src/modules/*` 접근 불가

3. **Common Modules**
   - 모든 앱에서 접근 가능
   - 공통 타입, 유틸리티, UI 컴포넌트

### Import 경로 예시

```typescript
// Shop App에서
import { Button } from '@common/ui-kit'                   // ✅ 공통 모듈
import { OrderService } from '@modules/order'             // ✅ 앱 전용 모듈
import { SourcingService } from '@modules/sourcing'       // ❌ ERROR (다른 앱)

// Sourcing App에서
import { Button } from '@common/ui-kit'                   // ✅ 공통 모듈
import { SourcingService } from '@modules/sourcing'       // ✅ 앱 전용 모듈
import { TransformService } from '@modules/transformation' // ✅ 앱 전용 모듈
import { OrderService } from '@modules/order'             // ❌ ERROR (다른 앱)
```

## 🛠️ 주요 명령어

### 개발
```bash
npm run dev:shop      # E-commerce 앱 실행 (포트 3000)
npm run dev:sourcing       # Sourcing 앱 실행 (포트 3001)
npm run dev:all            # 두 앱 동시 실행
```

### 빌드
```bash
npm run build:shop    # E-commerce 앱 빌드
npm run build:sourcing     # Sourcing 앱 빌드
npm run build:all          # 두 앱 모두 빌드
```

### 데이터베이스
```bash
npx prisma studio          # 데이터베이스 GUI
npx prisma db push         # 스키마 동기화
npm run seed               # 테스트 데이터 생성
```

### 테스트
```bash
npm test                   # E2E 테스트 (Playwright)
npm run test:ui            # 테스트 UI 모드
```

## 🔧 기술 스택

### Frontend
- **Framework**: Next.js 14.2.3 (App Router)
- **Styling**: Tailwind CSS 3.4
- **State**: Zustand 4.5
- **Forms**: React Hook Form + Zod
- **Payment**: 토스페이먼츠 SDK

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: SQLite (개발) / MySQL (프로덕션) + Prisma ORM 6.19
- **AI**: Google Gemini API
- **Automation**: Playwright 1.55
- **Queue**: Bull 4.16
- **Cache**: Redis 4.6

### Testing
- **E2E**: Playwright 1.55

## 🚀 구현된 API 엔드포인트

Shop App에 **11개의 REST API**가 완전히 구현되어 있습니다:

### 🛒 Cart API (5개)
```
GET    /api/cart              # 장바구니 조회
POST   /api/cart              # 상품 추가
DELETE /api/cart              # 장바구니 비우기
PATCH  /api/cart/items/:id    # 수량 변경
DELETE /api/cart/items/:id    # 아이템 삭제
```

### 📦 Orders API (4개)
```
POST   /api/orders            # 주문 생성
GET    /api/orders            # 주문 목록 조회
GET    /api/orders/:id        # 주문 상세 조회
PATCH  /api/orders/:id        # 주문 상태 업데이트 (관리자)
```

### 💳 Payments API (3개)
```
POST   /api/payments/confirm  # 결제 승인
POST   /api/payments/cancel   # 결제 취소
POST   /api/payments/webhook  # 웹훅 수신
```

**자세한 API 문서**: [docs/api/README.md](./docs/api/README.md)

## 📚 상세 문서

프로젝트 전체 문서는 `docs/` 디렉토리에서 확인하세요:

- **[프로젝트 개요](./docs/project/CLAUDE.md)** - 전체 시스템 가이드
- **[API 문서](./docs/api/README.md)** - REST API 레퍼런스 (11개 엔드포인트)
- **[데이터베이스 마이그레이션](./docs/migration/DB-MIGRATION-GUIDE.md)** - SQLite → MySQL 전환 가이드
- **[마이그레이션 가이드](./docs/migration/)** - 구조 변경 히스토리
- **[아키텍처 문서](./docs/architecture/)** - 시스템 설계 문서

## 🗄️ 데이터베이스 스키마

### 현재 데이터베이스

- **개발 환경**: SQLite (`prisma/dev.db`)
- **프로덕션**: MySQL 지원 (마이그레이션 가이드 참조)
- **ORM**: Prisma 6.19
- **마이그레이션**: [SQLite → MySQL 가이드](./docs/migration/DB-MIGRATION-GUIDE.md)

### 데이터 모델 (총 20개)

**핵심 시스템:**
- User, Customer, CustomerAddress
- Product, ProductCategory, ProductImage
- Order, OrderItem

**도매/소매 관리:**
- WholesaleBand, CollectedPost, PostImage
- RetailBand, RetailSettings, RetailPost, RetailPostImage
- SourcingSite

**결제 시스템:**
- Payment, PaymentMethod, Refund

**쇼핑몰:**
- Shop, ShopProduct, ShopSettings
- Cart, CartItem

**AliExpress 통합:**
- AliExpressSourcing, AliExpressProduct
- AliExpressProductImage, AliExpressProductReview

**API 설정:**
- BandApiSettings, GeminiApiSettings
- AutomationSettings

자세한 스키마는 `prisma/schema.prisma` 참조 (844 lines)

## 🔐 보안 및 환경변수

각 앱은 독립적인 `.env.local` 파일을 사용합니다:

**공통 환경변수:**
- `DATABASE_URL`: 데이터베이스 연결 문자열
  - 개발: `file:../prisma/dev.db` (SQLite)
  - 프로덕션: `mysql://user:pass@host:3306/bandauto` (MySQL)
- `NEXTAUTH_SECRET`: 세션 암호화 키
- `NEXTAUTH_URL`: 앱 URL

**Shop App 전용:**
- `TOSS_PAYMENTS_CLIENT_KEY`: 토스페이먼츠 클라이언트 키
- `TOSS_PAYMENTS_SECRET_KEY`: 토스페이먼츠 시크릿 키
- `TOSS_PAYMENTS_WEBHOOK_SECRET`: 웹훅 검증 시크릿

**Sourcing App 전용:**
- `GEMINI_API_KEY`: Google Gemini AI API 키
- `BAND_CLIENT_ID`: Band API 클라이언트 ID
- `BAND_CLIENT_SECRET`: Band API 클라이언트 시크릿

⚠️ **환경변수는 절대로 Git에 커밋하지 마세요.**

## 📊 개발 현황

### ✅ 완료된 기능 (92%)

**아키텍처 & 인프라:**
- ✅ 2-App 모노레포 아키텍처 완성
- ✅ 모듈 분리 및 src/ 통합 (DDD 패턴)
- ✅ 공통 모듈 구조화 (`modules/common/`)
- ✅ TypeScript 경로 별칭 설정 (`@/`, `@modules/*`, `@common/*`)
- ✅ 독립 실행 환경 구축 (포트 3000, 3001)

**데이터베이스:**
- ✅ Prisma 스키마 완전 구현 (20개 모델, 844 lines)
- ✅ SQLite 개발 환경 구축
- ✅ MySQL 마이그레이션 가이드 작성
- ✅ 데이터베이스 마이그레이션 히스토리 관리

**백엔드 API:**
- ✅ **REST API 완전 구현** (11개 엔드포인트)
  - 🛒 Cart API (5개): 장바구니 CRUD
  - 📦 Orders API (4개): 주문 생성/조회/관리
  - 💳 Payments API (3개): 결제 승인/취소/웹훅
- ✅ 서비스 레이어 완성 (Repository-Service 패턴)
- ✅ NextAuth.js 인증 시스템
- ✅ 세션 기반 장바구니 (비회원 지원)

**프론트엔드:**
- ✅ 관리자 대시보드 (Sourcing App)
- ✅ 도매 밴드 관리 시스템
- ✅ AI 상품 분석 시스템 (Gemini)
- ✅ 소매 밴드 자동화 시스템

**문서화:**
- ✅ API 문서 (11개 엔드포인트 상세)
- ✅ 데이터베이스 마이그레이션 가이드
- ✅ 프로젝트 아키텍처 문서
- ✅ README 최신화

### 🚧 진행 중 (8%)
- 🚧 고객용 쇼핑몰 UI (상품 상세, 장바구니, 주문서 페이지)
- 🚧 토스페이먼츠 API 키 설정 및 테스트
- 🚧 프론트엔드-백엔드 연동 통합 테스트
- 🚧 MySQL 프로덕션 환경 전환

## 🤝 기여 가이드

1. 각 앱은 독립적으로 개발
2. 공통 기능은 `modules/common/`에 추가
3. 앱 간 직접 모듈 참조 금지
4. 모든 문서는 `docs/`에 보관

## 📄 라이센스

MIT License

---

**Made with ❤️ by BandAuto Team**
