# 📦 BandAuto → Turborepo 모노레포 마이그레이션 설계서  
_최종 버전 (Config / Sourcing / Transformation / Publishing / ShopFront / Monitoring)_

---

## 0. 목적

현재 단일 Next.js 프로젝트(`bandauto/`)를

- **Config System**
- **Sourcing System**
- **Transformation System**
- **Publishing System**
- **ShopFront System**
- **Monitoring System**

으로 나누고,  
내부적으로는 **domain / app / infra / client / shared** 모듈 구조로 재구성하여

- 도메인별 분리
- 기능/역할별 시스템 분리
- 공통 로직 재사용
- 장기적인 확장성/유지보수성 확보

를 목표로 한다.

---

## 1. 현재 프로젝트 상태 요약

### 1.1 기술 스택

```json
{
  "framework": "Next.js 14.2.3 (App Router)",
  "runtime": "Node.js 20.x",
  "database": "SQLite + Prisma ORM 6.19.0",
  "ui": "React 18.2 + Tailwind CSS 3.4",
  "auth": "NextAuth.js 4.24.6",
  "ai": "Google Gemini API 0.24.1",
  "payment": "토스페이먼츠 SDK",
  "automation": "Playwright 1.55.0",
  "state": "Zustand 4.5.0",
  "validation": "Zod 3.22.4 + React Hook Form 7.49.0"
}
1.2 현재 프로젝트 디렉터리 구조 (요약)
txt
코드 복사
bandauto/
├── src/
│   ├── app/
│   │   ├── (auth)/         # 인증
│   │   ├── (admin)/        # 관리자 대시보드
│   │   ├── store/          # 고객 쇼핑몰
│   │   ├── dashboard/      # 사용자 대시보드
│   │   ├── api/            # 백엔드 API 라우트
│   │   │   ├── auth/
│   │   │   ├── payments/
│   │   │   ├── products/
│   │   │   ├── shop/
│   │   │   ├── wholesale/
│   │   │   ├── retail/
│   │   │   ├── aliexpress/
│   │   │   └── settings/
│   ├── components/
│   ├── lib/
│   ├── domain/             # 도메인 로직 (DDD 스타일)
│   │   ├── auth/
│   │   ├── products/
│   │   ├── payments/
│   │   ├── cart/
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── wholesale/
│   │   ├── retail/
│   │   ├── aliexpress/
│   │   ├── band/
│   │   └── pricing/
│   ├── types/
│   ├── stores/
│   └── styles/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── dev.db
└── 기타 설정/문서 파일들...
1.3 주요 기능들
인증: NextAuth 기반

AI 분석: Gemini 기반 상품 분석 (lib/gemini-ai.ts)

결제: 토스 페이먼츠

장바구니/주문/결제 도메인

도매/소매/알리익스프레스 소싱 & 자동화

Band API 연동, Band → 소매/쇼핑몰 연계

1.4 DB 주요 모델 그룹 (요약)
코어

User, Customer, CustomerAddress

상품/카탈로그

Product, ProductCategory, ProductImage

Shop, ShopProduct, ShopSettings

주문/결제

Order, OrderItem, Payment, PaymentMethod, Refund, Cart, CartItem

소싱/도매/소매

WholesaleBand, CollectedPost, PostImage, SourcingSite

RetailBand, RetailSettings, RetailPost, RetailPostImage

AliExpressSourcing, AliExpressProduct, AliExpressProductImage, AliExpressProductReview

API/자동화 설정

BandApiSettings, GeminiApiSettings, AutomationSettings

2. 내부 시스템 정의 (최종 6개 System)
2.1 Config System
API/자동화/AI/소싱 플랫폼 설정 관리

BandApiSettings, GeminiApiSettings, AutomationSettings, ShopSettings 일부 포함

2.2 Sourcing System
외부 플랫폼(Band, AliExpress, 도매 사이트 등)에서 소싱/수집 담당

WholesaleBand, CollectedPost, PostImage, SourcingSite, AliExpressSourcing 등

2.3 Transformation System
소싱된 Raw 데이터 + AI(Gemini 등)를 사용해

상품 후보/요약/옵션/카테고리/가격 정책 적용 등 도메인 모델로 변환

CollectedPost → “우리 시스템의 후보/중간 모델”로 가공

2.4 Publishing System
Transformation 결과(후보)를 실제 **쇼핑몰 상품(ShopProduct / Product 등)**으로 등록/갱신

소매 밴드 포스팅(RetailPost, RetailPostImage)과도 연계 가능

ex) “쇼핑몰 상품 ↔ 소매 밴드 포스팅” 싱크

2.5 ShopFront System
고객용 쇼핑몰 프론트

Shop, ShopProduct, Product(Category/Image), Cart, Order, Payment 등 조회/생성

2.6 Monitoring System
Config / Sourcing / Transformation / Publishing 전체 파이프라인 모니터링

Job 실행 이력, 실패/재시도, 에러 로그, 처리시간 등

3. Turborepo 최종 구조 (시스템/모듈 반영)
txt
코드 복사
bandauto-monorepo/
├── apps/
│   ├── config-service/          # Config System
│   ├── sourcing-service/        # Sourcing System
│   ├── transform-service/       # Transformation System (AI 포함)
│   ├── publishing-service/      # Publishing System
│   ├── shopfront-web/           # ShopFront System (Next.js)
│   └── monitoring-service/      # Monitoring System
│
├── packages/
│   ├── domain/                  # DDD 도메인 계층
│   │   ├── config/              # BandApiSettings, GeminiApiSettings, AutomationSettings, ShopSettings 등
│   │   ├── sourcing/            # WholesaleBand, CollectedPost, PostImage, SourcingSite, AliExpressSourcing 등
│   │   ├── curation/            # 소싱 결과 → 후보/분석 결과 (CollectedPost 확장 모델 등)
│   │   ├── catalog/             # Product, ProductCategory, ProductImage, ShopProduct 등
│   │   └── monitoring/          # JobExecution, PipelineLog, ErrorLog 등 (필요 시 설계)
│   │
│   ├── app/                     # UseCase / Application Layer
│   │   ├── config/              # 설정 CRUD / 검증 / 테스트
│   │   ├── sourcing/            # 소싱 Job 실행, 소싱 정책 적용
│   │   ├── curation/            # Transformation/AI 적용 유즈케이스
│   │   ├── publishing/          # 후보 → ShopProduct/소매 포스팅
│   │   ├── shop/                # 쇼핑몰 조회/주문 관련 유즈케이스
│   │   └── monitoring/          # 파이프라인 로그 조회 유즈케이스
│   │
│   ├── infra/                   # 기술 구현체
│   │   ├── db-prisma/           # Prisma Repository 구현 (모든 도메인)
│   │   ├── messaging/           # 이벤트 버스(Kafka/Redis/SQS 등, 현재는 추상화 인터페이스만 가능)
│   │   └── cache-redis/         # Redis 캐시
│   │
│   ├── client/                  # 외부 시스템 클라이언트
│   │   ├── platform/            # Band, 도매 사이트, AliExpress 등 API 클라이언트
│   │   ├── ai/                  # Gemini / (향후 OpenAI, Claude 등)
│   │   └── payment/             # Toss Payments
│   │
│   └── shared/                  # 공통 모듈
│       ├── kernel/              # 공통 타입, Domain Event, Result, ID 등
│       ├── utils/               # 날짜/금액/문자열 유틸
│       ├── ui-kit/              # 공통 UI 컴포넌트
│       ├── config-ts/           # 공통 tsconfig
│       ├── config-eslint/       # 공통 ESLint
│       └── config-tailwind/     # 공통 Tailwind 설정
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .env.example
✅ 여기서 collecting 이라는 단어는 전부 sourcing 으로 통일함
(collecting-service → sourcing-service, domain/collecting → domain/sourcing 등)

4. 도메인 → 모듈 매핑 (현재 DB/도메인 기준)
4.1 Config Domain (packages/domain/config)
BandApiSettings

GeminiApiSettings

AutomationSettings

ShopSettings 의 환경설정 성격 필드들

추후 다른 플랫폼/API 설정도 이 도메인으로 편입

4.2 Sourcing Domain (packages/domain/sourcing)
도매/소싱 관련

WholesaleBand

SourcingSite

소싱/수집 결과

CollectedPost

PostImage

외부 소싱 플랫폼(AliExpress 등)

AliExpressSourcing

AliExpressProduct (+ Image/Review는 Transformation/Curation과 상의 후 분리 가능)

4.3 Curation (Transformation) Domain (packages/domain/curation)
CollectedPost 기반 추가 변환/분석 결과

AI 분석 결과 구조화

상품 후보/옵션/카테고리 추천

가격 정책 적용(기존 pricing 도메인 로직 이관)

실제 DB 모델을 새로 만들 수도 있고,
CollectedPost의 확장 개념으로 구성할 수도 있음

4.4 Catalog Domain (packages/domain/catalog)
쇼핑몰/상품 도메인

Product, ProductCategory, ProductImage

Shop, ShopProduct, ShopSettings 의 카탈로그 성격 필드

Publishing System에서 최종적으로 다루는 “공식 Product/ShopProduct” 도메인

4.5 Shop/Sales Domain (ShopFront 측)
Order, OrderItem, Cart, CartItem, Payment, PaymentMethod, Refund 등은
필요시 packages/domain/shop 또는 packages/domain/sales 로 별도 분리 가능
(ShopFront System에서 사용)

4.6 Monitoring Domain (packages/domain/monitoring)
파이프라인 실행/오류 도메인

JobExecution, PipelineStage, ErrorLog 등
(현재 DB에는 없으나, 향후 추가 예정)

5. 시스템별 모듈 조합
5.1 Config System (apps/config-service)
사용 모듈:

domain/config

app/config

infra/db-prisma

shared/kernel, shared/utils

역할:

API/소싱/AI/자동화 설정 CRUD

다른 시스템들은 설정을 이 서비스의 API로 조회

5.2 Sourcing System (apps/sourcing-service)
사용 모듈:

domain/config (소싱 관련 설정 읽기)

domain/sourcing

app/sourcing

client/platform (Band, 도매 사이트, AliExpress)

infra/db-prisma

infra/messaging

shared/kernel

역할:

외부 플랫폼에서 게시물/상품 소싱

CollectedPost, PostImage 등 저장

“소싱 완료” 이벤트(SourcingCompleted 등) 발행

5.3 Transformation System (apps/transform-service)
사용 모듈:

domain/config (AI 프로필/프롬프트)

domain/sourcing (소싱된 원본 접근)

domain/curation

app/curation

client/ai (Gemini 등)

infra/db-prisma

infra/messaging

shared/kernel

역할:

소싱 데이터 → 우리 도메인에 맞는 구조로 변환

AI로 상품 후보/옵션/가격/카테고리 등 생성

“변환 완료/후보 준비됨” 이벤트 발행

5.4 Publishing System (apps/publishing-service)
사용 모듈:

domain/curation (후보 읽기)

domain/catalog

app/publishing

infra/db-prisma

infra/messaging

shared/kernel

역할:

후보 → 실제 ShopProduct/Product 로 생성/갱신

필요 시 소매 밴드 포스팅(RetailPost)까지 처리

“상품 게시됨/업데이트됨” 이벤트 발행

5.5 ShopFront System (apps/shopfront-web)
사용 모듈:

domain/catalog

(필요 시) domain/shop or domain/sales

app/shop

shared/ui-kit, shared/kernel, shared/utils

Next.js, Tailwind

역할:

고객용 쇼핑몰 UI

상품/카테고리/장바구니/주문/결제

5.6 Monitoring System (apps/monitoring-service)
사용 모듈:

domain/monitoring

app/monitoring

infra/db-prisma 또는 infra/messaging (이벤트 소비)

shared/kernel

역할:

Config / Sourcing / Transformation / Publishing 전체 상태 모니터링

파이프라인별 실행 이력/에러 조회

6. 시스템 간 통신 규칙
설정 조회:

각 시스템 → config-service REST/HTTP 호출

파이프라인 흐름 (Sourcing → Transformation → Publishing):

이벤트 기반 (메시지 큐 / PubSub) 추천

예:

Sourcing: SourcingCompletedEvent 발행

Transformation: TransformationCompletedEvent 발행

Publishing: ProductPublishedEvent 발행

ShopFront:

publishing-service 혹은 별도 Catalog API를 통해 상품 조회

파이프라인 이벤트는 직접 알 필요 없음

Monitoring:

모든 이벤트 구독 → 대시보드/로그 구성

7. 마이그레이션 단계 제안
Turborepo 셋업

turbo.json, pnpm-workspace.yaml 생성

apps/, packages/ 기본 폴더 생성

공통 설정(shared/config-*) 추출

기존 tsconfig, eslint, tailwind 설정을 packages/shared로 이동

Prisma/DB 분리

packages/infra/db-prisma 생성

기존 prisma/ 및 DB 관련 코드 이동

도메인 분리

src/domain/ * 를

packages/domain/config

packages/domain/sourcing

packages/domain/curation

packages/domain/catalog

(필요 시 domain/shop, domain/monitoring)
로 이동/분해

애플리케이션 레이어 분리

src/app/api/ *의 비즈니스 로직을

packages/app/config

packages/app/sourcing

packages/app/curation

packages/app/publishing

packages/app/shop

packages/app/monitoring
로 유즈케이스 단위로 추출

외부 클라이언트 분리

Band/Gemini/Toss/Playwright 관련 로직을

packages/client/platform

packages/client/ai

packages/client/payment
로 이동

UI 공통 모듈 분리

공통 Button/Input/Card 등 → packages/shared/ui-kit

각 System(apps/ *) 구성

위에서 정의한 조합대로 config-service, sourcing-service, transform-service, publishing-service, shopfront-web, monitoring-service 구현

이 문서를 기준으로:

모든 “Collecting” 관련 명칭은 Sourcing으로 교체됨

내부 시스템 이름은 Config / Sourcing / Transformation / Publishing / ShopFront / Monitoring 으로 고정

현재 프로젝트의 도메인/DB/기능 요구사항을 이 구조에 반영

AI에게 이 MD를 넘길 때는:

“이 문서의 구조/네이밍을 기준으로, 현재 bandauto 프로젝트를 Turborepo 모노레포로 마이그레이션해줘.”

라고 요청하면 된다.