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
