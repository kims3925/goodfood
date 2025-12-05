# 🚀 BandAuto 아키텍처 리팩토링 마이그레이션 계획

> **목표**: 현재 Next.js 모노리식 구조를 `bandauto-archi.txt` 기반 **2-App + Modules 구조**로 전환

---

## 📌 목표 아키텍처

```
bandauto/
├── apps/
│   ├── shop-app/              # 고객 쇼핑몰 (BFF + 프론트)
│   └── sourcing-app/                # 관리자 + Worker (소싱/관리/모니터링)
│
└── modules/
    ├── common/                      # kernel, utils, ui-kit
    ├── config/                      # domain + api
    ├── sourcing/                    # domain + api
    ├── curation/                    # domain + api (AI 변환)
    ├── catalog/                     # domain + api (상품)
    ├── shop/                        # domain + api (주문/결제)
    └── monitoring/                  # domain + api (모니터링)
```

---

## 📊 현재 상태 분석

### ✅ 이미 생성된 것
```
apps/shop-app/     # 빈 디렉토리 (Next.js 설정 없음)
apps/sourcing-app/       # 빈 디렉토리 (src/{web 구조 시작)
modules/common/ui-kit/   # 일부 생성
```

### ❌ 필요한 작업
- Turborepo 설정 (turbo.json, pnpm-workspace.yaml)
- 각 앱 Next.js 초기화 및 package.json
- modules/ 7개 도메인 모듈 완전 구성
- 기존 코드 마이그레이션 (src/ → apps/ + modules/)
- Prisma 스키마 분리 (modules/common/db-prisma)

---

## 🗓️ 단계별 마이그레이션 일정 (총 12일)

### **Phase 1: 기반 설정** (2일)
**목표**: Turborepo 초기화 + 공통 인프라 구축

#### Day 1 - Turborepo 설정
- [ ] `turbo.json` 생성 (빌드/dev/lint/test 파이프라인)
- [ ] `pnpm-workspace.yaml` 생성
- [ ] 루트 `package.json` 수정 (workspace 설정)
- [ ] `.npmrc` 설정 (pnpm)
- [ ] `.gitignore` 업데이트

#### Day 2 - 공통 모듈 기반 구축
- [ ] `modules/common/kernel/` 생성
  - Result, DomainEvent, ValueObject, ID 등
- [ ] `modules/common/utils/` 생성
  - 날짜, 금액, 문자열, 환율 유틸리티
- [ ] `modules/common/ui-kit/` 완성
  - Button, Input, Card 등 기존 components/ui 이동
- [ ] `modules/common/db-prisma/` 생성
  - 기존 prisma/ 이동
  - Prisma Client 싱글톤 구현

---

### **Phase 2: 도메인 모듈 구축** (4일)

#### Day 3 - Config 모듈
- [ ] `modules/config/domain/` 생성
  - BandApiSettings, GeminiApiSettings, AutomationSettings 도메인 모델
  - 기존 `src/domain/` 에서 설정 관련 로직 추출
- [ ] `modules/config/api/` 생성
  - 설정 CRUD UseCase
  - 설정 조회/업데이트 컨트롤러

#### Day 4 - Sourcing 모듈
- [ ] `modules/sourcing/domain/` 생성
  - WholesaleBand, CollectedPost, PostImage, SourcingSite
  - AliExpressSourcing, AliExpressProduct
  - 기존 `src/domain/wholesale/`, `src/domain/aliexpress/` 이동
- [ ] `modules/sourcing/api/` 생성
  - 소싱 시작/중지/조회 UseCase
  - Playwright 크롤러 통합

#### Day 5 - Curation 모듈
- [ ] `modules/curation/domain/` 생성
  - AI 분석 결과 도메인 모델
  - 가격정책 도메인 (`src/domain/pricing/` 이동)
  - 텍스트/옵션/카테고리 변환 로직
- [ ] `modules/curation/api/` 생성
  - Gemini AI 분석 UseCase
  - 기존 `lib/gemini-ai.ts` (873 lines) 통합
  - 큐레이션 실행/결과 조회

#### Day 6 - Catalog + Shop 모듈
- [ ] `modules/catalog/domain/` 생성
  - Product, ProductCategory, ProductImage
  - Shop, ShopProduct, ShopSettings
  - 기존 `src/domain/products/` 이동
- [ ] `modules/catalog/api/` 생성
  - 상품 조회/검색/등록 UseCase
  - 퍼블리싱 로직

- [ ] `modules/shop/domain/` 생성
  - Cart, CartItem, Order, OrderItem
  - Payment, PaymentMethod, Refund
  - 기존 `src/domain/cart/`, `src/domain/orders/`, `src/domain/payments/` 이동
- [ ] `modules/shop/api/` 생성
  - 장바구니/주문/결제 UseCase
  - 토스페이먼츠 통합

---

### **Phase 3: 앱 구축** (4일)

#### Day 7 - shop-app 초기화
- [ ] Next.js 14 초기화
  - `package.json`, `tsconfig.json`, `next.config.js`
- [ ] `src/app/` 구조 생성
  - (shop)/ 레이아웃
  - page.tsx (홈페이지)
  - products/ (상품 목록/상세)
  - cart/ (장바구니)
  - checkout/ (주문서)
- [ ] `src/api/` BFF 레이어
  - cart/, order/, payments/ API Routes

#### Day 8 - shop-app UI 구현
- [ ] 기존 `src/app/store/` 페이지 마이그레이션
- [ ] modules/common/ui-kit 통합
- [ ] modules/catalog/api 연동
- [ ] modules/shop/api 연동
- [ ] 장바구니/결제 플로우 구현

#### Day 9 - sourcing-app 초기화
- [ ] Next.js 14 초기화
- [ ] `src/web/app/` 구조 생성
  - (admin)/ 레이아웃
  - dashboard/ (홈)
  - settings/ (설정)
    - api/ (통합 API 설정)
    - ai/ (AI 설정)
  - wholesale/ (Band 도매)
  - aliexpress/ (AliExpress)
  - products/ (상품 관리)
  - monitoring/ (모니터링)

#### Day 10 - sourcing-app Worker 구현
- [ ] `src/web/api/` API Routes
  - config/ → modules/config/api 연동
  - sourcing/ → modules/sourcing/api 연동
  - curation/ → modules/curation/api 연동
  - catalog/ → modules/catalog/api 연동
  - monitoring/ → modules/monitoring/api 연동
- [ ] Background Job 시스템
  - Bull Queue 통합
  - 소싱 → 큐레이션 → 퍼블리싱 파이프라인

---

### **Phase 4: 마이그레이션 완료 및 검증** (2일)

#### Day 11 - 코드 마이그레이션 완료
- [ ] 기존 `src/` 코드 전체 이동 완료 확인
- [ ] import 경로 수정
  - `@/lib/` → `@modules/common/utils/`
  - `@/domain/` → `@modules/{domain}/domain/`
- [ ] TypeScript 빌드 에러 해결
- [ ] 환경변수 분리
  - apps/shop-app/.env.local
  - apps/sourcing-app/.env.local

#### Day 12 - 통합 테스트 및 문서화
- [ ] Turborepo 빌드 테스트
  - `pnpm build` 전체 성공
- [ ] 개발 서버 실행 테스트
  - `pnpm dev` - 두 앱 동시 실행
  - shop-app: localhost:3000
  - sourcing-app: localhost:3001
- [ ] 기능 테스트
  - [ ] 관리자: Band 소싱 → AI 분석 → 상품 등록
  - [ ] 관리자: AliExpress 소싱 → AI 분석 → 상품 등록
  - [ ] 쇼핑몰: 상품 조회 → 장바구니 → 주문 → 결제
- [ ] 문서 업데이트
  - [ ] README.md 업데이트
  - [ ] CLAUDE.md 업데이트
  - [ ] 각 모듈별 README.md 작성

---

## 📦 모듈별 상세 구조

### modules/common/
```
common/
├── kernel/
│   ├── src/
│   │   ├── Result.ts              # Result<T, E> 타입
│   │   ├── DomainEvent.ts         # 도메인 이벤트 베이스
│   │   ├── ValueObject.ts         # VO 베이스 클래스
│   │   ├── ID.ts                  # ID 생성 유틸
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── utils/
│   ├── src/
│   │   ├── date.ts                # 날짜 유틸
│   │   ├── money.ts               # 금액 계산
│   │   ├── currency.ts            # 환율 계산
│   │   ├── string.ts              # 문자열 유틸
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── ui-kit/
│   ├── src/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── index.tsx
│   ├── package.json
│   └── tsconfig.json
│
└── db-prisma/
    ├── prisma/
    │   ├── schema.prisma          # 기존 20개 모델
    │   └── seed.ts
    ├── src/
    │   ├── client.ts              # Prisma Client 싱글톤
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

### modules/config/
```
config/
├── domain/
│   ├── src/
│   │   ├── BandApiSettings.ts
│   │   ├── GeminiApiSettings.ts
│   │   ├── AutomationSettings.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
└── api/
    ├── src/
    │   ├── getConfig.ts           # 설정 조회 UseCase
    │   ├── updateConfig.ts        # 설정 업데이트 UseCase
    │   ├── testConnection.ts      # 연결 테스트 UseCase
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

### modules/sourcing/
```
sourcing/
├── domain/
│   ├── src/
│   │   ├── WholesaleBand.ts
│   │   ├── CollectedPost.ts
│   │   ├── AliExpressSourcing.ts
│   │   ├── AliExpressProduct.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
└── api/
    ├── src/
    │   ├── startSourcing.ts       # 소싱 시작
    │   ├── stopSourcing.ts        # 소싱 중지
    │   ├── getSourcingResults.ts  # 결과 조회
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

### modules/curation/
```
curation/
├── domain/
│   ├── src/
│   │   ├── AnalysisResult.ts     # AI 분석 결과
│   │   ├── PricingPolicy.ts      # 가격정책
│   │   ├── CategoryMapping.ts    # 카테고리 매핑
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
└── api/
    ├── src/
    │   ├── analyzeWithAI.ts       # Gemini AI 분석
    │   ├── applyPricing.ts        # 가격정책 적용
    │   ├── getCurationResults.ts  # 결과 조회
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

### modules/catalog/
```
catalog/
├── domain/
│   ├── src/
│   │   ├── Product.ts
│   │   ├── ProductCategory.ts
│   │   ├── ShopProduct.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
└── api/
    ├── src/
    │   ├── getProducts.ts         # 상품 조회
    │   ├── searchProducts.ts      # 상품 검색
    │   ├── publishProduct.ts      # 상품 등록
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

### modules/shop/
```
shop/
├── domain/
│   ├── src/
│   │   ├── Cart.ts
│   │   ├── Order.ts
│   │   ├── Payment.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
└── api/
    ├── src/
    │   ├── addToCart.ts           # 장바구니 추가
    │   ├── createOrder.ts         # 주문 생성
    │   ├── processPayment.ts      # 결제 처리
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

### modules/monitoring/
```
monitoring/
├── domain/
│   ├── src/
│   │   ├── JobExecution.ts       # Job 실행 이력
│   │   ├── PipelineLog.ts        # 파이프라인 로그
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
└── api/
    ├── src/
    │   ├── getJobHistory.ts       # Job 이력 조회
    │   ├── getPipelineStatus.ts   # 파이프라인 상태
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

---

## 🔧 Turborepo 설정

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    }
  }
}
```

### pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'modules/*'
  - 'modules/*/domain'
  - 'modules/*/api'
  - 'modules/common/*'
```

---

## 📊 모듈 간 의존성

```
apps/shop-app
├── modules/common/kernel
├── modules/common/utils
├── modules/common/ui-kit
├── modules/common/db-prisma
├── modules/catalog/api
└── modules/shop/api

apps/sourcing-app
├── modules/common/kernel
├── modules/common/utils
├── modules/common/ui-kit
├── modules/common/db-prisma
├── modules/config/api
├── modules/sourcing/api
├── modules/curation/api
├── modules/catalog/api
└── modules/monitoring/api

modules/{domain}/api
└── modules/{domain}/domain
```

---

## ✅ 체크리스트

### Phase 1 (Day 1-2)
- [ ] turbo.json 생성
- [ ] pnpm-workspace.yaml 생성
- [ ] modules/common/kernel 완성
- [ ] modules/common/utils 완성
- [ ] modules/common/ui-kit 완성
- [ ] modules/common/db-prisma 완성

### Phase 2 (Day 3-6)
- [ ] modules/config 완성
- [ ] modules/sourcing 완성
- [ ] modules/curation 완성
- [ ] modules/catalog 완성
- [ ] modules/shop 완성
- [ ] modules/monitoring 완성

### Phase 3 (Day 7-10)
- [ ] apps/shop-app 완성
- [ ] apps/sourcing-app 완성
- [ ] 모든 기존 코드 마이그레이션 완료

### Phase 4 (Day 11-12)
- [ ] TypeScript 빌드 성공
- [ ] pnpm dev 실행 성공
- [ ] 기능 테스트 통과
- [ ] 문서화 완료

---

## 🚀 시작 명령어

```bash
# Phase 1 시작
cd C:\Users\hsw48\Desktop\ABC\bandauto

# 1. Turborepo 설정 생성
# (Day 1 작업)

# 2. 공통 모듈 생성
# (Day 2 작업)

# 3. 의존성 설치
pnpm install

# 4. Prisma 생성
cd modules/common/db-prisma
pnpm db:generate

# 5. 개발 서버 실행 (Phase 3 이후)
cd ../../../
pnpm dev
```

---

## 📝 다음 작업

**즉시 시작 가능한 작업 (Day 1):**

1. `turbo.json` 생성
2. `pnpm-workspace.yaml` 생성
3. 루트 `package.json` 수정
4. `.npmrc` 생성

준비되셨다면 바로 시작하겠습니다! 🚀
