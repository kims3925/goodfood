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

### 상품 발행 플로우 (2026-04-28 통일 완료)

자동발행 / 재발행 / Stage2(post/list 가공 직후) / 가공상품(ProcessedProductTab) **네 경로 모두**
`/api/automation/execute` (`type='publish'`) 단일 호출 사용 — 자동 cron 과 100% 동일한
`runPublishPipeline → publishService.publishBatch` 경로. 옛 per-product per-channel 루프
(`/api/publish/template/publish`) 는 카드 포맷 깨짐 / 댓글 쇼핑몰 링크 누락 사고로 제거.

- **ProcessedProductTab** (`/sourcing/product/list`): "상품발행하기" → **재발행 모달과 동일** 통합
  레이아웃 (소매밴드 / 쇼핑몰 다중 체크박스 + 개별/종합 모드 + ⏱️ N분 지연 입력)
- **Stage2** (`/sourcing/post/list` AI 가공 직후): 동일 자동경로 + 활성 쇼핑몰 자동 발행 추가
- **재발행** (`/sourcing/publish`): 채널/쇼핑몰 다중 체크박스 + "자동발행 경로 사용" 토글 + ⏱️ 지연 입력
- **자동 cron**: `instrumentation.ts:initializeScheduler` 가 `AutomationConfig.cronExpression` 로
  `runPublishPipeline` 등록 (timezone Asia/Seoul)

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

## 발행 경로 통일 (자동 cron = 수동 = 재발행 = Stage2)

**현재 (2026-04-28 이후)**: 모든 밴드 발행은 `/api/automation/execute` (`type='publish'`) 단일 경로
사용. 내부에서 `executePublishPipeline → runPublishPipeline → publishService.publishBatch` 호출.
쇼핑몰 발행은 별도로 `/api/shop/publish` 를 product × shop 루프로 호출 (활성 쇼핑몰만).

| 진입점 | 호출 |
|---|---|
| 자동 cron | `AutomationConfig.cronExpression` → `executeFullPipelineWithLock` |
| `/sourcing/publish` 재발행 | `runRepublishNow` → `automation/execute` + shop loop |
| `/sourcing/product/list` 상품발행하기 | `runAutoPublishNow` → 동일 |
| `/sourcing/post/list` Stage2 발행 | `handlePublishProducts` → 동일 |

### 옛 경로 (제거됨)
- `/api/publish/template/publish` per-product per-channel 루프 — 제목 카드가 본문 사이에
  끼임 / 댓글에 쇼핑몰 링크 누락 사고. 코드 파일은 남아있지만 더 이상 호출하지 않음.
- `/api/shop/publish/stream` (SSE) — 본문 폰트 굵기 깨짐 / 이미지 중간 삽입. 호출 제거.
- 재발행 시 "Step 1 Playwright DELETE" — 세션 훼손으로 글 깨짐. 제거.

## 가격정책 시스템 (v4 체크리스트)

도매방별 가격정책을 PolicyModal 에서 작성하고, AI 가공 시 자동 적용. 정책의 "배송비:" 항목이
**모든 소싱 경로의 최우선 권위**.

### 정책 유형 4종 (`PolicyModal.tsx`)

| 유형 | 적용 도매방 | 마진 |
|---|---|---|
| `ZERO_MARGIN` | 킹도매방 | 마진 없음 (도매가 = 판매가) |
| `BRACKET_MARGIN` | 가족도매방 / 초록이네 | 3-step (~19,900→+0 / ~29,900→+1,000 / ~40,000→+2,000) |
| `BRACKET_MARGIN_EXTENDED` | 나은 / VIP / SD푸드 | 9-step + 동적 (1~19,900→+4,000 / +1,000원 단계 / 99,901+ 동적 +1,000/만원) |
| `SD_FOOD_SPECIAL` | SD푸드만 | 위 +"공급가_출처: 댓글" + "기준가: 공급가+배송비 합산" |

### 마진 구간표 (1,000원 밀린 적용, 2026-04-27)

나은/VIP/SD 의 NAUN_BRACKETS — 첫 두 구간 통합 후 모든 마진 -1,000원:
- `1~19,900 → +4,000` / `19,901~29,900 → +5,000` / ... / `89,901~99,900 → +12,000` /
  `99,901+ → +12,000~ (1만원 구간마다 +1,000)`

### 정책 일괄 시드

`POST /api/admin/policies/seed-from-checklist` — 6개 도매방(킹/가족/초록/나은/VIP/SD) 의 표준 정책을
v4 xlsx 값으로 일괄 upsert. 채널명 keyword contains 매칭. 고정 이름
"BandAuto 표준 (v4 체크리스트)" 로 저장 → 기존 정책 보존, 재호출 idempotent.
- `body.dryRun=true` 로 미리보기
- excludeAbove: 가족/초록 40,001 / 나은/VIP/SD/킹 100,001

### 배송비 결정 (정책 최우선)

`product.repository.create()` 내부 우선순위:
0. **`policyShippingType`** (정책의 "배송비:" 항목) — 있으면 최우선 (NEW)
   - `'separate'` → bundleShippingType=SEPARATE 강제
   - `'included'` → bundleShippingType=INCLUDED 강제
1. shippingInfo "배송비 별도" / "N원 추가" 키워드 → SEPARATE
2. shippingInfo "배송비 포함" / "무료배송" → INCLUDED
3. shippingFee > 0 → SEPARATE
4. else → NONE

`policyShippingType` 전달 경로:
- `productService.create` 가 `data.policyShippingType` 미전달 시 **DB 의 활성 PricingPolicy 자동 조회**
  (`parsePolicyShippingType(content)` 로 파싱) — 모든 호출 경로 자동 보강
- `/api/product/ai-generate` 응답에 `policyShippingType` 포함 → 클라이언트가 forward
- 자동 파이프라인은 `transform.ts` 가 rawMetadata 에 함께 저장

### AI 가공 정책 우선 원칙 (prompt-templates.ts)

"## 4. 배송비 및 합배송 추출" 섹션 추가 지시:
- 정책 "배송비: 별도" → 본문에 명시 없어도 `shippingInfo: "배송비 별도"`, `shippingFee: null` 유지
- 정책 "배송비: 포함" → `shippingInfo: "배송비 포함"`, `shippingFee: 0`
- 옛 텍스트 "기준가: 도매가 + 배송비 합산" 은 SD푸드 외 정책에서 **제거됨** — calculateSellingPrice
  와의 이중 합산 사고 방지 (`0d7228a`)

### excludeAbove (글로벌 + 정책별)

- 글로벌: `GLOBAL_MAX_PRICE = 100000` 이상 옵션 자동 제외 (`/api/product/ai-generate`)
- 정책별: 정책 content 의 `"40001원 이상 제외"` 패턴 파싱 → 그 값 이상 옵션 제외
- AI 응답 후처리 (Phase 3): variants 필터에서 `max(sellingPrice, price)` 로 비교 — AI 가
  sellingPrice 만 채우는 케이스 방지

## Channel 가격 범위 필터 (수집 단계, 지침서 Phase 1)

```
Channel.minSourcingPrice  Int?  // 최소 도매가 (NULL=무제한)
Channel.maxSourcingPrice  Int?  // 최대 도매가 (NULL=무제한)
```

`automation/pipelines/collection.ts` 가 게시글 본문에서 `extractPriceFromContent()`
(`lib/price-extractor.ts`) 로 가격 추출 후 범위 밖이면 **수집 자체에서 스킵** —
AI 가공 단계 토큰 낭비 방지. 가격 추출 실패 시 통과 (false negative 우선).

채널 상세 페이지(`/sourcing/channel/detail/[id]`)에 WHOLESALE 전용 입력 UI
+ 주문 마감시간(`Channel.orderDeadline`).

## 예약 발행 (N분 후 자동/재발행)

자동발행 / 재발행 모달 양쪽에 "⏱️ N분 후 자동발행" 입력. 0=즉시, N>0=클라이언트 setTimeout 으로
지연 후 같은 발행 흐름 트리거.

- 공통 헬퍼: `sourcing-app/src/lib/delayed-publish.ts`
  - `scheduleDelayedPublish(delayMinutes, run, marker?)` → cancel 함수 반환
  - localStorage 마커로 새로고침 시 stale 자동 정리 (1시간 초과)
- UI: 페이지 상단에 "⏳ 오후 X시 Y분 예약됨" 배너 + "예약 취소" 버튼
- **한계**: 탭 닫으면 setTimeout 손실 (서버 측 영속화 미구현). 안내 문구로 명시.

## URL 단일 수집 + 재수집

`POST /api/post/collect-url` — Band URL 1건 직접 스크래핑.

### 비-상품 이미지 필터 강화 (2026-04-28)

postArea 셀렉터 **좁은 것부터 폴백**: `.dPostBody → .postBody → 텍스트 부모 → #post_detail`.
키워드 차단 확장 (cover/bandcover/avatar/badge/reaction/rcmd/profileimage 등).
본문 안이라도 댓글/프로필/스티커/리액션 컨테이너 내부 이미지는 `closest()` 로 제외.
200x200 미만 이미지 자동 제거. → 밴드 커버/프로필 사진 / 리액션 스티커 침입 차단.

### 강제 재수집 (force=true)

가공이 잘못되어 사용자가 Product 삭제 후 다시 수집·가공 필요한 케이스:
- 1차 호출 시 가공 이력 있으면 `409 + code:'ALREADY_PROCESSED'` 반환
- UI 가 자동 confirm 다이얼로그 → "확인" 시 `force:true` 로 재시도
- API 가 `prisma.$transaction` 으로 `CollectedPostImage / Comment / CollectedProduct / CollectedPost`
  순차 삭제 후 재생성. Product 자체는 onDelete:SetNull 로 보존 (collectedPostId 만 NULL)

## 자동화 cron 진단/복구

### 진단 엔드포인트

`GET /api/admin/automation/diagnose` — 사용자별 cron 상태 한눈 진단:
- `config` (DB 상태 — isEnabled, cronExpression, lastRunAt, nextRunAt, pipelineSteps)
- `scheduler.isRegisteredInMemory` (이 Node 프로세스 메모리 등록 여부)
- `scheduler.activeUserIds` / `scheduler.nodeCronTasks` (라이브러리 내부 registry)
- `runningWorkflows` (status='RUNNING' 워크플로우 — 멈춤 식별)
- `recentRuns[].steps[]` (단계별 status / processedItems / errorMessage)
- `recentPublishes` (최근 1시간 ChannelProduct/ShopProduct 카운트)
- `diagnosis` (자동 진단 메시지 + 권고)

### 복구 액션

`POST /api/admin/automation/diagnose body={"action":"reregister"}` — 메모리에 cron 만 재등록 (실행 X).
다음 일정에 자동 실행. 트리거 액션은 사용자 요청에 따라 비활성.

### 스케줄러 자체 (`modules/automation/scheduler.ts`)

- node-cron v4 + timezone `Asia/Seoul` 하드코딩
- `initializeScheduler` 명시적 select 로 스키마 드리프트 방어 (24c628c)
- 시작 시 상세 로깅: `[Scheduler] ✓ user=X cron="0 10 * * *" 등록 완료` / 실패 시 원인 표시

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

### 콜라주(Collage) 모드 — 작업지시서_종합발행_콜라주모드.md

- `publishMode='collage'`: N×M(기본 3×4=12) 상품을 **포스터 PNG 1장**으로 합성해 발행
- 본문은 **쇼핑몰 카테고리 링크 1줄**만 포함 (상품별 링크 없음)
- 할인율 표시 금지 — 각 셀: 스펙(용량/갯수) + 배경 제거된 상품 이미지 + 상품명 + 가격(첫 variant)
- 핵심 파일: `sourcing-app/src/modules/publish/digest-collage-renderer.ts` (`renderCollagePoster`, `extractSpec`)
- 배경 제거: `@imgly/background-removal-node` (서버 CPU, ONNX U2-Net). 실패 시 원본으로 폴백
- 카테고리 링크: `shop-app/src/app/(shop)/category/[code]/page.tsx` — `/{subdomain}/category/SEA` 형태
- UI 진입점:
  - `/sourcing/publish/digest` 상단 `📋 발행조건 설정` 패널 (기존 종합발행 페이지에 통합)
  - **`/sourcing/publish/ad` 탭 1**: 광고 페이지의 콜라주 발행 탭 (메뉴: "광고")
- 선택 개수 ≠ 그리드 크기면 발행 버튼 비활성, 카테고리당 정확히 N개 선택 필요

## 광고 페이지 (Ad) — 작업지시서_카카오톡광고_자동생성.md

`/sourcing/publish/ad` — 사이드바 "상품및광고 > 광고" 메뉴. 2개 탭으로 구성.

### 탭 1: 🖼️ 콜라주 발행
- 12개 상품을 배경 제거된 포스터 1장으로 합성 → 소매밴드 발행
- 종합발행 페이지의 콜라주 모드와 동일 API(`POST /api/publish/digest`, `publishMode='collage'`) 호출
- 차이점: 종합발행 페이지에서 분리된 단일 모드 전용 UI

### 탭 2: 📱 카톡 광고 발행
- 1~10개(권장 6개) 상품에 대해 **AI(Claude Haiku)가 카드별 카피 자동 생성**
- 720×1280 세로 PNG 카드 → ZIP 다운로드 → 카카오톡 채널에 수동 첨부 발송 (Phase 1)
- 각 카드: 3D 윤곽선 타이틀(빨강/파랑/녹색) + 회색 서브타이틀 박스 + 원본 상품 이미지(배경 유지) + 옵션 리본/배지/배너 + 본문 + 가격
- 타이틀 색상: 카테고리 자동 매핑 (수산물=파랑 / 농산물·축산물·반찬·가공=빨강 / 건강식품=녹색)
- 핵심 파일:
  - `sourcing-app/src/modules/ad-composer/ad-content-generator.ts` (Claude 호출 4종: title/subtitle/desc/banner)
  - `sourcing-app/src/modules/ad-composer/ad-card-renderer.ts` (Playwright HTML→PNG)
  - `sourcing-app/src/modules/ad-composer/templates/kakao-ad-card.html.ts`
  - `sourcing-app/src/app/api/ad/kakao/{generate,card/[id],preview/[id],send,batches}/route.ts`
- DB: `KakaoAdCard`, `KakaoAdBatch` (사용자별 일 단위 배치) + enum `KakaoSendStatus`
- 미리보기 모달에서 카드별 편집(타이틀/색상/배너/본문/가격) 후 PATCH로 저장 시 즉시 PNG 재합성
- ZIP 다운로드: `POST /api/ad/kakao/send` (Phase 2 카카오 API 자동 발송은 미구현)

## 쇼핑몰 체크아웃 변경

`shop-app/src/app/(shop)/checkout/page.tsx`:

- **이메일 입력란 제거** — 비회원 주문자 정보 블록에서 삭제. `formData.customerEmail`은 빈 문자열로 유지되고 기존 `validateEmail`이 빈 값을 선택사항으로 통과시키므로 API/DB 영향 없음
- **"보내는사람 정보 (선택)" 섹션** — 기존 비회원 "주문자 정보"를 재구성
  - 체크박스 **"받는사람과 동일"** (기본 체크) + 안내문구
  - 체크 O: 이름/휴대폰 입력란 숨김, 제출 시 수령인 값으로 자동 대체
  - 체크 X: 입력란 표시, 미입력 시 수령인 값으로 폴백
  - 필수 표시(*) 제거 — 값이 있을 때만 형식 검증
  - 체크 해제 시 기존 `sameAsCustomer`(customer→recipient 자동 덮어쓰기)도 동시 해제 → 별도 입력한 보내는사람이 받는사람을 덮어쓰지 않도록

## 배송비 추론 (참고 — 위 "가격정책 시스템" 섹션 참조)

`product.repository.ts::create()` 의 우선순위는 위 "배송비 결정 (정책 최우선)" 섹션 참조.
정책 우선화 도입 이전(`7cde665` 이전) 흐름은 키워드 추론만 — 본문에 "배송비 N원" 명시
없으면 NONE 으로 잘못 분류되어 발행 시 배송비 미합산 사고가 있었음 (예: band/64442308/post/173980).

옛 데이터 중 오분류 의심 건은 3건(id=3417, 3595 등)만 수동 수정. 신규 가공은 정책 자동 적용.

## 상품 상세 변형상품 표 (5열, 2026-04-28)

`/sourcing/product/detail/[id]` 의 변형상품 테이블:

| 옵션 | 도매원가 | 마진조정가 | 배송비 | 판매가 |
|---|---|---|---|---|
| `optionSummary` | `variant.wholesalePrice` | `variant.price` (정책 마진 적용) | `+N원` 또는 "포함" | 마진조정가+배송비 (파란색 강조) |

배송비 표기:
- `bundleShippingType=INCLUDED` → 녹색 "포함" 라벨
- `SEPARATE/NONE` → `+N원` (`product.shippingFee`)

## 수집 게시물 목록 날짜 필터

`/sourcing/post/list` 의 검색창 옆에 📅 시작~종료 date input + 초기화 버튼.
KST 기준, "YYYY-MM-DD" 형식. `/api/post?startDate=...&endDate=...` 쿼리 추가.
`PostListParams.startDate/endDate` 추가. 시간 없는 입력은 종료일 자정까지 자동 포함.

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
