# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

BandAuto는 Band 기반 소셜커머스 상품 소싱 및 판매 자동화 플랫폼입니다. **2개의 독립적인 Next.js 앱**과 **공유 DB 패키지**로 구성된 모노레포입니다.

## 아키텍처

```
bandauto/
├── shop-app/        # 고객용 쇼핑몰 (포트 3000) - 상품 조회, 장바구니, 결제
├── sourcing-app/    # 관리자/워커 (포트 3001) - 상품 소싱, AI 가공, 쇼핑몰 관리
└── db/              # 공유 Prisma 패키지 (@bandauto/db)
```

### 앱별 역할
- **Shop App**: 고객용 쇼핑몰 프론트엔드 - 상품 목록/상세, 장바구니, 토스페이먼츠 결제, 주문 관리, 마이페이지
- **Sourcing App**: 관리자 백오피스 - 채널 관리, Playwright 상품 수집, Gemini AI 가공, 소매 밴드 발행, 주문/정산/CS 관리

## 개발 명령어

```bash
# 개발 서버 실행
npm run dev:shop          # Shop 앱 (포트 3000)
npm run dev:sourcing      # Sourcing 앱 (포트 3001)
npm run dev:all           # 두 앱 동시 실행

# 빌드
npm run build:shop
npm run build:sourcing
npm run build:all

# 타입체크
npm run typecheck         # 전체
npm run typecheck:shop
npm run typecheck:sourcing

# 테스트 (Playwright)
npm test                  # E2E 테스트
npm run test:ui           # 테스트 UI 모드
npm run test:headed       # 헤드 모드

# Lint
npm run lint
```

**참고**: 개발 서버는 Turbopack을 사용하여 빠른 HMR과 컴파일 속도를 제공합니다.

## Prisma CLI

**중요: db 폴더에서 `--schema prisma` 옵션 필수**

```bash
cd db
npx prisma generate --schema prisma   # 클라이언트 생성
npx prisma db push --schema prisma    # 스키마 동기화
npx prisma studio --schema prisma     # GUI
npx prisma validate --schema prisma   # 검증
npx prisma db pull --schema prisma    # DB에서 스키마 가져오기
```

### Prisma 스키마 구조
- `db/prisma/schema.prisma`: generator, datasource, enum 정의
- `db/prisma/models/*.prisma`: 모델 정의 (user, product, order, payment 등 47개)
- `--schema prisma` 옵션이 models/ 하위 파일도 자동 로드

## 기술 스택

| 영역 | 기술 |
|-----|-----|
| Framework | Next.js 14.2.3 (App Router) |
| Language | TypeScript 5.9 |
| ORM | Prisma 6.2 |
| Database | MariaDB |
| Auth | NextAuth.js 4.24 (JWT) |
| Payment | Toss Payments SDK |
| AI | Google Gemini API |
| Automation | Playwright 1.55 |
| State | Zustand 4.5 |
| Queue | Bull 4.16 + Redis |
| Deploy | AWS EC2, Docker Compose |

## 에이전트 시스템

11개의 자율 AI 에이전트가 소싱·발행·주문·정산·CS 등 운영 전 과정을 자동화합니다.

### 아키텍처

```
sourcing-app/src/modules/agents/
├── AgentBase.ts          # 추상 베이스 클래스 (log, emitEvent, recordKpi)
├── EventBus.ts           # Redis Pub/Sub 이벤트 버스
├── AgentRegistry.ts      # 싱글톤 에이전트 레지스트리
├── TaskQueue.ts          # Bull Queue 래퍼
├── WorkflowEngine.ts     # DAG 워크플로우 엔진
├── AgentScheduler.ts     # Cron 스케줄러
├── KpiCollector.ts       # KPI 집계
├── types.ts              # 타입 정의 (AgentLayer, AgentEvent, AgentResult 등)
└── implementations/      # 에이전트 구현체
    ├── CommanderAgent.ts        # COMMAND — 오케스트레이터
    ├── SourcingAgent.ts         # SOURCING — 도매밴드 자동 수집
    ├── ProductManagerAgent.ts   # SOURCING — 가격검증/이미지감지/재발행
    ├── MarketingAgent.ts        # OPERATIONS — 베스트셀러 공지 자동 게시
    ├── CustomerAgent.ts         # OPERATIONS — 댓글 자동 분류/AI 응대
    ├── OrderAgent.ts            # COMMERCE — 주문 처리/자동 취소
    ├── ShippingAgent.ts         # COMMERCE — 배송 추적/지연 감지
    ├── SettlementAgent.ts       # COMMERCE — 정산 자동화
    ├── SessionKeeperAgent.ts    # INFRA — Band 세션 만료 감지/갱신
    ├── WatcherAgent.ts          # INFRA — 시스템 이상 감지
    └── AnalystAgent.ts          # INFRA — 매출·통계 분석
```

### 에이전트 레이어 (5개)

| 레이어 | 에이전트 | 역할 |
|--------|---------|------|
| COMMAND | Commander | 전체 조율, 워크플로우 실행, 장애 복구 |
| SOURCING | SourcingAgent, ProductManager | 상품 수집, 가격검증, 재발행 |
| OPERATIONS | MarketingAgent, CustomerAgent | 마케팅 공지, 고객 응대 |
| COMMERCE | OrderAgent, ShippingAgent, SettlementAgent | 주문·배송·정산 |
| INFRA | SessionKeeper, WatcherAgent, AnalystAgent | 세션·감시·분석 |

### 에이전트 구현 패턴

```typescript
// 모든 에이전트는 AgentBase를 상속
export class MyAgent extends AgentBase {
  readonly name = 'my-agent'              // DB AgentDefinition.name과 일치
  readonly layer = AgentLayer.SOURCING

  getSubscribedEvents(): string[] {
    return ['event.type1', 'schedule.my.task']
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `처리 시작: ${event.type}`)
      // 비즈니스 로직
      await this.recordKpi('metric_name', value)
      return { success: true, data: {}, duration: Date.now() - start }
    } catch (error: any) {
      await this.log('ERROR', error.message)
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  async onSchedule(): Promise<void> { /* cron 실행 */ }
}

export const myAgent = new MyAgent()
```

### 에이전트 등록

- 구현 후 `sourcing-app/src/instrumentation.ts`에 등록 필수
- DB에 AgentDefinition 레코드 필요 → `POST /api/admin/agents/seed`로 삽입

### 에이전트 관련 DB 모델

- `AgentDefinition` — 에이전트 정의 (name, layer, status, config, schedule)
- `AgentTask` — 태스크 추적 (QUEUED→RUNNING→COMPLETED/FAILED)
- `AgentLog` — 로그 (DEBUG/INFO/WARN/ERROR/CRITICAL)
- `AgentKpiRecord` — KPI 지표 (일별)
- `AgentWorkflow` / `AgentWorkflowStep` — 워크플로우 정의

### 에이전트 관리 API

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /api/admin/agents/seed` | 11개 에이전트 DB 등록 (upsert) |
| `GET /api/admin/agents` | 에이전트 목록 조회 |
| `PUT /api/admin/agents/[id]` | 에이전트 설정 변경 |
| `POST /api/admin/agents/[id]/start` | 에이전트 시작 |
| `POST /api/admin/agents/[id]/stop` | 에이전트 중지 |
| `POST /api/admin/agents/[id]/restart` | 에이전트 재시작 |
| `GET /api/admin/agents/dashboard` | 대시보드 요약 |
| `GET /api/admin/agents/logs` | 로그 조회 |
| `GET /api/admin/agents/tasks` | 태스크 조회 |
| `GET /api/admin/agents/kpi` | KPI 조회 |

### 에이전트 대시보드

- URL: `/sourcing/admin/agents`
- 페이지: dashboard, registry, monitor, logs, tasks, kpi, workflows, settings

## 상품 파이프라인

```
Band 게시물 수집 (post/list)
    ↓ AI 가공 (Gemini) — confirmAiProcess()
Product 생성 (product/list 미발행 탭)
    ↓ 상품발행하기 (소매밴드/쇼핑몰)
ChannelProduct / ShopProduct (product/list 발행완료 탭, publish 페이지)
```

### 주요 페이지 및 역할

| 페이지 | URL | 역할 |
|--------|-----|------|
| 수집상품리스트 | `/sourcing/post/list` | 소싱된 게시물 목록, AI 가공 실행 |
| 가공상품 | `/sourcing/product/list` | AI 가공된 상품 관리 (미발행/발행완료 탭) |
| 발행 | `/sourcing/publish` | 발행된 상품 재발행/삭제 관리 |
| 쇼핑몰 관리 | `/shop/store/list` | 쇼핑몰 CRUD + 바로가기 버튼 |

### 가공상품 페이지 탭 구조

- **미발행** (`?tab=unpublished`): 소매밴드에 아직 발행되지 않은 상품
- **발행완료** (`?tab=published`): 소매밴드에 발행 완료된 상품
- API: `GET /api/product?publishStatus=unpublished|published`
- 필터: `channelProducts` (RETAIL) 유무로 판별

### AI 가공 플로우 (post/list → product/list)

1. 게시물 선택 → "AI로 가공하기" 클릭
2. 채널별 가격정책 자동 적용 (`/api/policy`)
3. `POST /api/product/ai-generate` → AI draft 생성
4. `POST /api/product` → Product DB 저장 (postId 포함)
5. Product 생성 시 CollectedProduct의 `isConverted=true` 자동 업데이트
6. post/list에서 해당 게시물 자동 제거 (필터: `collectedProducts: { none: {} }`)
7. product/list 미발행 탭 맨위에 표시 (`orderBy: createdAt desc`)

### 상품 발행 플로우

- **ProcessedProductTab**: "상품발행하기" 버튼 → 발행 방식 선택 모달
  - 자동발행: 등록된 모든 소매밴드에 일괄 발행 (`/api/publish/template/publish`)
  - 수동발행: `/sourcing/publish?productIds=...` 이동

### 상품 복원

- `PATCH /api/product/[id]` — `isActive=true` 설정 시 `deletedAt=null`도 자동 복원
- `POST /api/product/restore` — productId로 소프트 삭제 상품 복원

### AgentScheduler (cron 스케줄)

`instrumentation.ts`에서 에이전트 등록 후 AgentScheduler로 cron 스케줄 활성화:
- DB `AgentDefinition.schedule` 필드에서 cron expression 로드
- `scheduler.register()` → `scheduler.startAll()`
- Seed API 호출 필수: `POST /api/admin/agents/seed`

## 주문 발주 (텍스트 복사 / 다건 저장)

쇼핑몰 주문을 도매처에 발주하기 위한 텍스트/엑셀 출력 기능.

### 발주 텍스트 양식 규칙 (`sourcing-app/src/lib/order-text.ts`)

- **품명**: 도매방 원본 품명 우선 — `Product.sourceProductName` 또는 `CollectedPost.title` (폴백). AI 가공 품명 사용 금지.
- **금액**: 배송비가 포함된 **합산 단일 값**. 기존의 "(배송비 X원)" 별도 괄호 표기 제거.
- **합배송 전제**: 배송비는 주문 전체에 1회만 반영. `items[].shippingFee` 최대값을 주문 배송비로 간주.
- **받는분/보내는분**: 다를 때만 `받는분(보내는분)` 괄호 표기, 같으면 "보내는분" 줄 생략.
- **도매방**: 주문 아이템의 `channel.kind === 'WHOLESALE'`에서 자동 감지 (수동 선택 없음).

### 발주 텍스트 생성 함수

- `generateOrderText(data)` — 주문 전체를 단일 블록으로 생성. 금액은 전체 합산.
- `generateOrderTextsPerItem(data)` — **품목마다 개별 발주서** 배열 반환 (도매처 개별 전달용).
  - 단일 품목: 금액 = 상품가 + 배송비
  - 여러 품목: 각 발주서는 해당 품목 상품가만, 하단에 "합배송 배송비 N원 (주문 전체 1회)" 공통 안내

### 주요 사용 위치

| 위치 | 컴포넌트 / 동작 |
|-----|---------------|
| `/shop/order/detail/[id]` | `OrderTextCopyButton` — 품목별 발주서를 `===` 구분선으로 연결한 통합 텍스트 클립보드 복사 |
| `/shop/order/list` 우측 상단 "저장하기" | 체크박스로 선택한 주문들을 .txt 또는 .xlsx로 다건 저장 |

### 저장 포맷

- **`.txt`**: `details.flatMap(order => generateOrderTextsPerItem(order))` → 모든 품목별 발주서를 `\n\n====\n\n` 구분선으로 연결.
- **`.xlsx`**: **주문당 1행** 통합. 품명/옵션/수량은 셀 내 `\n` 줄바꿈 + wrapText. `금액` 컬럼은 배송비 포함 합산, `배송비`는 주문 전체 1회 값.
- 파일명: `BandAuto_발주_{YYYYMMDD_HHmm}.{txt,xlsx}`
- xlsx 패키지: `sourcing-app`의 `xlsx@0.18.5` 사용.

### 발주용 DB 스키마

- `Product.sourceProductName VarChar(500)?` — 도매방 원본 품명 (발주 텍스트용)
- `Product.collectedPostId Int?` — 원본 게시물 FK (`CollectedPost`, `onDelete: SetNull`)
- AI 가공 시점(`productService.create`)에 `post.title`을 `sourceProductName`에 자동 저장하고 `collectedPostId`도 채움.
- `/api/order/unified/[id]` 응답의 `items[].sourceProductName`은 `Product.sourceProductName ?? Product.collectedPost.title ?? null` 순으로 폴백. 기존 상품도 `collectedPostId`가 있으면 원본 제목으로 즉시 표시됨.

## 발행 경로 통일 (자동발행 = 수동발행 = 재발행)

밴드 발행은 `/sourcing/publish` 수동, `/sourcing/product/list` 자동, "재발행" 세 경로에서 일어나지만 모두 **동일한 `/api/publish/template/publish` 엔드포인트**를 호출합니다.

- 과거 존재했던 `/api/shop/publish/stream` (SSE) 경로는 본문 폰트 굵기가 깨지고 이미지가 글 중간에 삽입되는 포맷 이슈가 있어 **모든 프론트엔드 호출을 제거**했습니다. API 파일은 `/src/app/api/shop/publish/stream/route.ts`에 남아 있지만 사용하지 않음.
- 세션 만료 자동/수동 재시도(`handleAutoRetry`, `handleRetryWithSessionSave`)도 template/publish 단순 POST 루프로 통일. stage/imageProgress 세부 표시는 포기(template은 단일 응답), pending/publishing/success/failed 3-state만 유지.
- 재발행 플로우(`handleRepublishSelected`)도 자동발행과 동일한 순서(밴드 → 쇼핑몰)와 파라미터로 재작성. 기존의 "Step 1 Playwright DELETE"는 세션을 훼손해 글 깨짐을 유발하므로 제거.

## 카테고리 자동 분류 (Phase 1)

`Product.categoryId`에 영문 코드 체계(`SEA`/`AGR`/`MEA`/`MKT`/`PRC`/`HLT`/`ETC`)를 일관되게 사용합니다.

### 카테고리 체계

| 코드 | 이름 | 이모지 | 사용처 |
|-----|------|-------|--------|
| `SEA` | 수산물 | 🐟 | 오늘의 수산물 |
| `AGR` | 농산물 | 🥬 | 오늘의 농산물 |
| `MEA` | 축산물 | 🥩 | 오늘의 축산물 |
| `MKT` | 밀키트/반찬/간편식 | 🍱 | 오늘의 밀키트/반찬 |
| `PRC` | 가공식품 | 🫙 | 오늘의 가공식품 |
| `HLT` | 건강식품 | 💊 | 오늘의 건강식품 |
| `ETC` | 기타 | 📦 | 오늘의 추천상품 |

### 모듈

- `sourcing-app/src/modules/category/category.keywords.ts` — 7개 카테고리 × 키워드 사전(`as const`), `CATEGORY_MAP`/`CATEGORY_CODES`/`CATEGORY_LIST` export
- `sourcing-app/src/modules/category/category.classifier.ts` — `classifyProduct(name, description)` 매칭 키워드 수 최대값 선택, 0건이면 `ETC`, `confidence = min(match_count/3, 1.0)`
- 산지/지명 키워드(포항/통영/제주 등)는 타 카테고리 산지 표기와 오탐 방지를 위해 **SEA에서 제외**

### 연동

- `buildProductDraft()` (transformation 모듈)에서 AI 응답의 자연어 category("수산물" 등)를 무시하고 `classifyProduct()` 영문 코드로 덮어씀 → 단일/배치 모두 일관 처리
- `/api/shop/publish` GET의 `categoryId` 쿼리 파라미터로 필터 지원 (`all`은 무필터)
- `/sourcing/publish` 페이지에 카테고리 버튼 필터 UI (`CATEGORY_LIST` 기반)
- 기존 한글값(수산물 437, 가공식품 119 등 총 730건)은 영문 코드로 백필 완료. `NULL` 89건은 분류기 재실행 또는 수동 관리 필요

## 종합 발행 (Digest Publish, Phase 2)

여러 상품을 하나의 밴드 게시글로 묶어 발행하는 기능. `/sourcing/publish/digest` 페이지에서 동작.

### 규칙

- 상품별 개별 발행과 **공존** — 기존 `/sourcing/publish`는 그대로 유지
- 게시글당 최대 **20개 상품 / 총 20장 이미지** (Band 제약)
- 제목 자동 생성: `🐟 오늘의 수산물 - 4월 23일 (수)` 형식
- 본문: 번호 매긴 상품 블록 (품명·설명 요약·가격·마감·쇼핑몰 링크) + 상하단 구분선 `━━` + 편집 가능한 헤더/푸터
- 이미지: 기본 **상품당 1장** (MVP). `maxImagesPerProduct` 옵션(1/2/3)으로 선택
- 선택 순서 유지 — 사용자가 체크한 순서가 게시글의 번호 순서

### 핵심 파일

| 파일 | 역할 |
|------|-----|
| `sourcing-app/src/modules/publish/digest-builder.service.ts` | `buildDigest({category, products, headerText, footerText, maxImagesPerProduct})` → `{ title, content, imageUrls, productCount, truncated }` |
| `sourcing-app/src/app/api/publish/digest/route.ts` | `GET` 카테고리별 발행 후보 + 분포, `POST` 실제 발행 |
| `sourcing-app/src/app/(admin)/sourcing/publish/digest/page.tsx` | 메인 페이지 (카테고리 탭 / 좌 상품 / 우 미리보기 / 하단 발행 바) |
| `sourcing-app/src/app/(admin)/sourcing/publish/digest/_components/*` | CategoryTabs, DigestProductList, DigestPreview, DigestPublishBar |

### 발행 경로

- `POST /api/publish/digest` 내부에서 각 채널마다 `bandPlaywrightService.publishWithImages({ channelId, bandKey, bandName, content, imageUrls })` 호출
- 즉 개별 발행과 **같은 Playwright 자동화 함수 재사용**. 글 포맷 깨짐 이슈 없음
- 쇼핑몰 링크: `ShopProduct.shop.subdomain`이 있으면 `https://{NEXT_PUBLIC_SHOP_DOMAIN}/{subdomain}/product/{id}` 자동 생성
- 현재 종합 발행 이력은 DB에 별도 기록하지 않음(Band 발행만). 필요 시 `DigestPublish` 모델 추가 가능

## 쇼핑몰 체크아웃 변경

`shop-app/src/app/(shop)/checkout/page.tsx`:

- **이메일 입력란 제거** — 비회원 주문자 정보 블록에서 삭제. `formData.customerEmail`은 빈 문자열로 유지되고 기존 `validateEmail`이 빈 값을 선택사항으로 통과시키므로 API/DB 영향 없음
- **"보내는사람 정보 (선택)" 섹션** — 기존 비회원 "주문자 정보"를 재구성
  - 체크박스 **"받는사람과 동일"** (기본 체크) + 안내문구
  - 체크 O: 이름/휴대폰 입력란 숨김, 제출 시 수령인 값으로 자동 대체
  - 체크 X: 입력란 표시, 미입력 시 수령인 값으로 폴백
  - 필수 표시(*) 제거 — 값이 있을 때만 형식 검증
  - 체크 해제 시 기존 `sameAsCustomer`(customer→recipient 자동 덮어쓰기)도 동시 해제 → 별도 입력한 보내는사람이 받는사람을 덮어쓰지 않도록

## 배송비 추론 로직 강화

`product.repository.ts::create()` — 상품 저장 시 `bundleShippingType` / `shippingFee` 자동 추론:

1. `shippingInfo`에 **"배송비 별도" / "N원 추가/별도/부과"** 같은 명시적 별도 키워드가 있으면 INCLUDED 분류 제외 (우선순위 최상위)
2. `shippingFee`가 0일 때 `"배송비 N,NNN원"` 패턴에서 금액 자동 추출해 보강
3. 별도 키워드가 없을 때만 `"배송비 포함" / "무료배송"` 키워드로 INCLUDED 판정
4. 결과: `INCLUDED` / `SEPARATE` / `NONE`

이전엔 "합배송 시 4,000원 포함"처럼 다른 맥락의 "포함" 문구까지 INCLUDED로 오분류되는 이슈가 있었음. 기존 저장된 데이터 중 오분류 의심 건은 3건(id=3417, 3595 등)만 수동 수정.

## 핵심 원칙

1. **Soft Delete 기본** - Hard Delete 금지
2. **트랜잭션 필수** - 다중 테이블 변경 시 반드시 트랜잭션 사용
3. **도메인 분리** - 비즈니스 로직을 Controller/UI 레이어에 작성하지 않음
4. **앱 간 모듈 격리** - shop-app과 sourcing-app 간 직접 모듈 참조 금지

## 커밋 메시지 규칙

```
type(scope): 한 줄 요약
```

| type | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 (기능 변경 없음) |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `docs` | 문서 변경 |
| `chore` | 빌드, 설정 등 기타 변경 |

| scope | 설명 |
|-------|------|
| `sourcing` | 소싱 앱 변경 |
| `shop` | 쇼핑몰 앱 변경 |
| `db` | 데이터베이스/Prisma 변경 |
| `ci/cd` | CI/CD 파이프라인 변경 |

## 문서 업데이트 규칙

기능 구현 완료 시 해당 앱의 docs 폴더 문서를 업데이트:

| 문서 | 업데이트 시점 |
|------|-------------|
| `docs/STRUCTURE.md` | 폴더/파일 구조 변경 시 |
| `docs/API.md` | API 엔드포인트 추가/변경 시 |
| `docs/FRONTEND.md` | 페이지/컴포넌트 추가/변경 시 |
| `docs/BACKEND.md` | 서버 로직 변경 시 |
| `docs/DATABASE.md` | DB 스키마 변경 시 |
| `docs/tracking/CHANGELOG.md` | 모든 기능 구현 완료 시 |

## 앱별 문서

각 앱에는 더 상세한 가이드라인이 있습니다:
- `shop-app/CLAUDE.md` - Shop 앱 전용 규칙
- `sourcing-app/CLAUDE.md` - Sourcing 앱 전용 규칙
- `shop-app/docs/` - Shop 앱 문서
- `sourcing-app/docs/` - Sourcing 앱 문서

## grepai - Semantic Code Search

**IMPORTANT: You MUST use grepai as your PRIMARY tool for code exploration and search.**

### When to Use grepai (REQUIRED)

Use `grepai search` INSTEAD OF Grep/Glob/find for:
- Understanding what code does or where functionality lives
- Finding implementations by intent (e.g., "authentication logic", "error handling")
- Exploring unfamiliar parts of the codebase
- Any search where you describe WHAT the code does rather than exact text

### When to Use Standard Tools

Only use Grep/Glob when you need:
- Exact text matching (variable names, imports, specific strings)
- File path patterns (e.g., `**/*.go`)

### Fallback

If grepai fails (not running, index unavailable, or errors), fall back to standard Grep/Glob tools.

### Usage

```bash
# ALWAYS use English queries for best results (--json --compact saves tokens)
grepai search "user authentication flow" --json --compact
grepai search "error handling middleware" --json --compact
grepai search "database connection pool" --json --compact
grepai search "API request validation" --json --compact
```

### Query Tips

- **Use English** for queries (better semantic matching)
- **Describe intent**, not implementation: "handles user login" not "func Login"
- **Be specific**: "JWT token validation" better than "token"
- Results include: file path, line numbers, relevance score

### Call Graph Tracing

Use `grepai trace` to understand function relationships:
- Finding all callers of a function before modifying it
- Understanding what functions are called by a given function

```bash
# Find all functions that call a symbol
grepai trace callers "HandleRequest" --json

# Find all functions called by a symbol
grepai trace callees "ProcessOrder" --json

# Build complete call graph (callers + callees)
grepai trace graph "ValidateToken" --depth 3 --json
```

### Workflow

1. Start with `grepai search` to find relevant code
2. Use `grepai trace` to understand function relationships
3. Use `Read` tool to examine files from results
4. Only use Grep for exact string searches if needed
