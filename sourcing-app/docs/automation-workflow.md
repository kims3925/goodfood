# Automation Workflow System

자동화 워크플로우 시스템 기술 문서

## 개요

BandAuto의 자동화 워크플로우 시스템은 도매밴드에서 게시물을 수집하고, AI를 통해 상품으로 변환한 후, 소매밴드에 자동으로 발행하는 파이프라인입니다.

### 주요 기능
- **게시물 수집**: 도매밴드에서 새 게시물을 주기적으로 수집
- **AI 변환**: Gemini/OpenAI를 사용하여 게시물을 상품 정보로 변환
- **자동 발행**: 변환된 상품을 소매밴드에 자동 발행
- **중복 방지**: 게시물, 상품, 발행 이력의 중복 체크
- **스케줄링**: 1시간~24시간 주기로 자동 실행

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Automation Pipeline                       │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│  Collection │  Transform  │   Publish   │  Workflow Log    │
│  Pipeline   │  Pipeline   │  Pipeline   │  (Monitoring)    │
├─────────────┴─────────────┴─────────────┴──────────────────┤
│                    BatchContext                             │
├─────────────────────────────────────────────────────────────┤
│                    node-cron Scheduler                       │
└─────────────────────────────────────────────────────────────┘
```

## 데이터베이스 스키마

### AutomationConfig
사용자별 자동화 설정

```prisma
model AutomationConfig {
  id              Int       @id @default(autoincrement())
  userId          Int       @unique
  isEnabled       Boolean   @default(false)
  cronExpression  String?   // "0 * * * *" (매 1시간)
  collectFromAllBands Boolean @default(true)
  wholesaleBandIds    Json?
  aiProvider      AiProvider @default(GEMINI)
  pricingPolicyId Int?
  autoPublish     Boolean   @default(false)
  retailBandIds   Json?
  lastRunAt       DateTime?
  nextRunAt       DateTime?
}
```

### WorkflowLog
워크플로우 실행 로그

```prisma
model WorkflowLog {
  id              Int
  userId          Int
  workflowType    WorkflowType   // COLLECT, TRANSFORM, PUBLISH, FULL_PIPELINE
  status          WorkflowStatus // PENDING, RUNNING, COMPLETED, FAILED, PARTIAL_SUCCESS
  startedAt       DateTime
  completedAt     DateTime?
  totalItems      Int
  successCount    Int
  failedCount     Int
  details         Json?
  errorMessage    String?
}
```

### PublishHistory
발행 이력 (중복 방지)

```prisma
model PublishHistory {
  id            Int
  userId        Int
  productId     Int
  retailBandId  Int
  postKey       String?      // Band API 반환값
  status        PublishStatus
  errorMessage  String?
  publishedAt   DateTime

  @@unique([productId, retailBandId]) // 중복 발행 방지
}
```

## 코어 모듈

### 파일 구조
```
src/modules/automation/
├── types.ts              # 타입 정의
├── context.ts            # BatchContext 관리
├── workflow-service.ts   # WorkflowLog 관리
├── scheduler.ts          # node-cron 스케줄러
├── executor.ts           # 파이프라인 실행기
├── pipelines/
│   ├── collection.ts     # 수집 파이프라인
│   ├── transform.ts      # 변환 파이프라인
│   └── publish.ts        # 발행 파이프라인
└── index.ts              # 모듈 진입점
```

### BatchContext

배치 작업에서 사용자 인증을 처리합니다. 쿠키 기반 인증 대신 직접 사용자 정보를 주입합니다.

```typescript
import { withUserContext, executeFullPipeline } from '@/modules/automation'

// 사용자 컨텍스트 내에서 파이프라인 실행
await withUserContext(userId, async () => {
  await executeFullPipeline(userId)
})
```

### 파이프라인 실행

```typescript
import {
  executeCollectionPipeline,
  executeTransformPipeline,
  executePublishPipeline,
  executeFullPipeline
} from '@/modules/automation'

// 개별 실행
const collectionResult = await executeCollectionPipeline(userId)
const transformResult = await executeTransformPipeline(userId)
const publishResult = await executePublishPipeline(userId, { retailBandIds: [1, 2] })

// 전체 파이프라인 실행
const result = await executeFullPipeline(userId)
```

## API 엔드포인트

### GET/POST /api/automation/config
자동화 설정 조회/저장

```typescript
// Request Body (POST)
{
  isEnabled: boolean,
  cronInterval: '1h' | '3h' | '6h' | '12h' | '24h',
  collectFromAllBands: boolean,
  wholesaleBandIds: number[],
  aiProvider: 'GEMINI' | 'OPENAI',
  pricingPolicyId: number | null,
  autoPublish: boolean,
  retailBandIds: number[]
}
```

### POST /api/automation/execute
파이프라인 수동 실행

```typescript
// Request Body
{
  type: 'collect' | 'transform' | 'publish' | 'full',
  config?: { ... } // 선택적 설정 오버라이드
}
```

### GET /api/automation/stats
헤더 통계 조회

```typescript
// Response
{
  todayCollected: number,    // 오늘 수집된 게시물
  pendingTransform: number,  // AI 변환 대기
  readyToPublish: number,    // 발행 준비
  todayPublished: number     // 오늘 발행
}
```

### GET /api/automation/logs
워크플로우 로그 조회

```typescript
// Query Params
?type=COLLECT|TRANSFORM|PUBLISH|FULL_PIPELINE
&page=1
&limit=20
&stats=daily // 일별 통계
&days=7
```

## UI 페이지

- `/automation/dashboard` - 대시보드 (통계, 수동 실행)
- `/automation/settings` - 자동화 설정
- `/automation/logs` - 실행 로그

## 스케줄러

node-cron을 사용하여 설정된 주기에 따라 자동 실행됩니다.

### 실행 주기 옵션
| 값 | Cron 표현식 | 설명 |
|---|---|---|
| 1h | `0 * * * *` | 매 1시간 |
| 3h | `0 */3 * * *` | 3시간마다 |
| 6h | `0 */6 * * *` | 6시간마다 |
| 12h | `0 */12 * * *` | 12시간마다 |
| 24h | `0 0 * * *` | 매일 자정 |

### 스케줄러 관리

```typescript
import { initializeScheduler, updateScheduler, stopAllSchedulers } from '@/modules/automation'

// 앱 시작 시 초기화
await initializeScheduler()

// 설정 변경 시 업데이트
await updateScheduler(userId)

// 앱 종료 시 정리
stopAllSchedulers()
```

## 중복 방지 전략

### 1. 게시물 중복
- `Post` 테이블의 `wholesaleBandId + externalId` 유니크 제약
- 수집 시 기존 게시물 존재 여부 확인

### 2. 상품 중복
- `Product` 테이블의 `postId` 유니크 제약
- 하나의 게시물에서 하나의 상품만 생성

### 3. 발행 중복
- `PublishHistory` 테이블의 `productId + retailBandId` 유니크 제약
- 같은 상품을 같은 밴드에 중복 발행 방지

## 확장 포인트

### 이미지 업로드
현재 이미지 업로드는 별도로 구현 필요합니다. `pipelines/publish.ts`의 `publishToBand` 함수에서 이미지 업로드 로직을 추가하세요.

### 새로운 플랫폼 추가
1. `SourcingPlatform` enum에 새 플랫폼 추가
2. 해당 플랫폼의 API 클라이언트 구현
3. `pipelines/collection.ts`에 플랫폼별 수집 로직 추가

### 새로운 AI 제공자 추가
1. `AiProvider` enum에 새 제공자 추가
2. `ai.client.ts`에 새 클라이언트 클래스 구현
3. `createAiClient` 팩토리에 케이스 추가

## 트러블슈팅

### 스케줄러가 실행되지 않음
1. `AutomationConfig.isEnabled`가 `true`인지 확인
2. `cronExpression`이 올바른 형식인지 확인
3. 서버 로그에서 `[Scheduler]` 접두사 확인

### AI 변환 실패
1. `AiApiConfig`에 유효한 API 키가 있는지 확인
2. API 사용량 한도 확인
3. 게시물 내용이 너무 짧거나 빈 경우 확인

### 발행 실패
1. Band API 토큰 유효성 확인
2. 소매밴드 권한 확인
3. `PublishHistory`에서 오류 메시지 확인
