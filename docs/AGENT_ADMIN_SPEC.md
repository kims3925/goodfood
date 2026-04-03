# BandAuto 에이전트 관리 어드민 패널 - 구현 명세서

> sourcing-app Admin 섹션 확장 | 17개 에이전트 통합 관리
> Version 1.0 | 2026-04-02

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────┐
│                  Admin Panel UI                      │
│  ┌──────────┬──────────┬──────────┬──────────┐      │
│  │Dashboard │Registry  │Monitor   │KPI       │      │
│  │          │          │(SSE)     │(Recharts)│      │
│  └──────────┴──────────┴──────────┴──────────┘      │
├─────────────────────────────────────────────────────┤
│              REST API (/api/admin/agents/)           │
├─────────────────────────────────────────────────────┤
│              Agent Runtime Engine                     │
│  ┌──────────┬──────────┬──────────┬──────────┐      │
│  │EventBus  │Workflow  │Task      │KPI       │      │
│  │(Redis)   │Engine    │Queue     │Collector │      │
│  └──────────┴──────────┴──────────┴──────────┘      │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐      │
│  │  17 Agents (AgentBase 상속)                │      │
│  │  CORE(8) + BUSINESS(4) + INTELLIGENCE(5)  │      │
│  └───────────────────────────────────────────┘      │
├─────────────────────────────────────────────────────┤
│  Prisma ORM → MariaDB + Redis                       │
└─────────────────────────────────────────────────────┘
```

---

## 2. 파일 구조

### 2.1 신규 생성 파일 목록

```
sourcing-app/src/
├── app/
│   ├── (admin)/admin/agents/
│   │   ├── dashboard/page.tsx      ★ 에이전트 대시보드
│   │   ├── registry/page.tsx       ★ 에이전트 레지스트리
│   │   ├── monitor/page.tsx        ★ 실시간 모니터링
│   │   ├── workflows/page.tsx      ★ 워크플로우 관리
│   │   ├── kpi/page.tsx            ★ KPI 대시보드
│   │   ├── tasks/page.tsx          (기존 확장)
│   │   ├── logs/page.tsx           (기존 확장)
│   │   └── settings/page.tsx       ★ 에이전트 설정
│   └── api/admin/agents/
│       ├── route.ts                ★ GET: 에이전트 목록
│       ├── [id]/
│       │   ├── route.ts            ★ GET/PATCH: 상세/수정
│       │   ├── start/route.ts      ★ POST: 활성화
│       │   ├── stop/route.ts       ★ POST: 비활성화
│       │   └── restart/route.ts    ★ POST: 재시작
│       ├── tasks/route.ts          ★ GET: 태스크 목록
│       ├── logs/route.ts           ★ GET: 로그 조회
│       ├── kpi/route.ts            ★ GET: KPI 데이터
│       ├── dashboard/route.ts      ★ GET: 대시보드 통계
│       ├── workflows/
│       │   ├── route.ts            ★ GET/POST: 워크플로우 CRUD
│       │   └── [id]/route.ts       ★ PATCH/DELETE
│       └── events/
│           └── stream/route.ts     ★ GET: SSE 스트림
├── components/admin/agents/
│   ├── AgentCard.tsx               ★ 에이전트 카드 컴포넌트
│   ├── AgentLayerSection.tsx       ★ 레이어별 섹션
│   ├── StatusToggle.tsx            ★ 상태 토글 스위치
│   ├── MiniKpi.tsx                 ★ 미니 KPI 바
│   ├── RealtimeEventFeed.tsx       ★ 실시간 이벤트 피드
│   ├── KpiChart.tsx                ★ KPI 차트 (Recharts)
│   ├── WorkflowEditor.tsx          ★ 워크플로우 편집기
│   └── AgentLogConsole.tsx         ★ 로그 콘솔
└── modules/agents/
    ├── index.ts                    ★ 모듈 진입점
    ├── AgentBase.ts                ★ 에이전트 기본 클래스
    ├── AgentRegistry.ts            ★ 에이전트 등록/검색
    ├── AgentScheduler.ts           ★ cron 스케줄링
    ├── EventBus.ts                 ★ Redis Pub/Sub
    ├── WorkflowEngine.ts           ★ DAG 워크플로우 엔진
    ├── TaskQueue.ts                ★ Bull Queue 태스크 큐
    ├── KpiCollector.ts             ★ KPI 수집/집계
    ├── types.ts                    ★ TypeScript 타입 정의
    └── agents/                     ★ 17개 에이전트 구현
        ├── OrchestratorAgent.ts
        ├── ContentAgent.ts
        ├── AnalyticsAgent.ts
        ├── RevenueAgent.ts
        ├── GrowthAgent.ts
        ├── SupportAgent.ts
        ├── ModerationAgent.ts
        ├── NotificationAgent.ts
        ├── CommerceAgent.ts
        ├── AffiliateAgent.ts
        ├── SourcingAgent.ts
        ├── FinanceAgent.ts
        ├── RecommendationAgent.ts
        ├── FunnelAgent.ts
        ├── BrandAgent.ts
        ├── SEOAgent.ts
        └── DesignAgent.ts

db/prisma/
├── models/
│   └── agent.prisma                ★ 에이전트 관련 모델 5개
└── seed-agents.ts                  ★ 에이전트 시드 데이터
```

### 2.2 수정 파일 목록

```
sourcing-app/src/config/navigation.ts   → adminMenuItems 확장
sourcing-app/package.json               → 의존성 추가 (ioredis, bull 등)
db/prisma/schema.prisma                 → agent.prisma import
```

---

## 3. Prisma 스키마 상세

### 3.1 Enum 정의

```prisma
// db/prisma/models/agent.prisma

enum AgentLayer {
  CORE
  BUSINESS
  INTELLIGENCE
}

enum AgentStatus {
  ACTIVE        // 정상 가동
  INACTIVE      // 비활성 (수동 중지)
  ERROR         // 오류 발생
  MAINTENANCE   // 유지보수 중
}

enum TaskStatus {
  QUEUED        // 대기 중
  RUNNING       // 실행 중
  COMPLETED     // 완료
  FAILED        // 실패
  CANCELLED     // 취소됨
}

enum TaskPriority {
  CRITICAL      // 즉시 처리
  HIGH          // 높은 우선순위
  NORMAL        // 일반
  LOW           // 낮은 우선순위
}

enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
  CRITICAL
}
```

### 3.2 모델 정의 (5개)

```prisma
model AgentDefinition {
  id            String        @id @default(cuid())
  name          String        @unique
  displayName   String
  layer         AgentLayer
  icon          String
  description   String        @db.Text
  status        AgentStatus   @default(INACTIVE)
  config        Json          // { kpiTargets, routing, claude, ... }
  priority      Int           @default(5)
  maxConcurrent Int           @default(5)
  retryPolicy   Json          // { maxRetries, backoff, delays }
  schedule      String?       // cron 표현식
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  deletedAt     DateTime?

  tasks         AgentTask[]
  logs          AgentLog[]
  kpiRecords    AgentKpiRecord[]
  workflowSteps AgentWorkflowStep[]

  @@index([layer, status])
  @@index([name])
  @@map("agent_definitions")
}

model AgentTask {
  id          String        @id @default(cuid())
  agentId     String
  agent       AgentDefinition @relation(fields: [agentId], references: [id])
  eventType   String
  payload     Json
  status      TaskStatus    @default(QUEUED)
  priority    TaskPriority  @default(NORMAL)
  result      Json?
  error       String?       @db.Text
  startedAt   DateTime?
  completedAt DateTime?
  duration    Int?          // ms
  retryCount  Int           @default(0)
  createdAt   DateTime      @default(now())

  @@index([agentId, status])
  @@index([eventType, createdAt])
  @@index([status, priority, createdAt])
  @@map("agent_tasks")
}

model AgentLog {
  id        String   @id @default(cuid())
  agentId   String
  agent     AgentDefinition @relation(fields: [agentId], references: [id])
  level     LogLevel @default(INFO)
  message   String   @db.Text
  metadata  Json?
  taskId    String?
  createdAt DateTime @default(now())

  @@index([agentId, level, createdAt])
  @@index([taskId])
  @@map("agent_logs")
}

model AgentKpiRecord {
  id        String   @id @default(cuid())
  agentId   String
  agent     AgentDefinition @relation(fields: [agentId], references: [id])
  metric    String
  value     Float
  target    Float
  period    String   // "daily", "weekly", "monthly"
  date      DateTime
  createdAt DateTime @default(now())

  @@unique([agentId, metric, period, date])
  @@index([agentId, metric, date])
  @@map("agent_kpi_records")
}

model AgentWorkflow {
  id           String   @id @default(cuid())
  name         String
  triggerEvent String
  isActive     Boolean  @default(true)
  config       Json     // DAG 구성
  executionCount Int    @default(0)
  lastExecuted DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  steps        AgentWorkflowStep[]

  @@index([triggerEvent, isActive])
  @@map("agent_workflows")
}

model AgentWorkflowStep {
  id         String   @id @default(cuid())
  workflowId String
  workflow   AgentWorkflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  agentId    String
  agent      AgentDefinition @relation(fields: [agentId], references: [id])
  order      Int
  isParallel Boolean  @default(false)
  config     Json?

  @@index([workflowId, order])
  @@map("agent_workflow_steps")
}
```

---

## 4. API 엔드포인트 상세

### 4.1 에이전트 CRUD

#### GET /api/admin/agents
```typescript
// Query params: layer?, status?, search?
// Response:
{
  agents: AgentDefinition[],
  total: number,
  byLayer: { CORE: number, BUSINESS: number, INTELLIGENCE: number },
  byStatus: { ACTIVE: number, INACTIVE: number, ERROR: number }
}
```

#### GET /api/admin/agents/:id
```typescript
// Response:
{
  agent: AgentDefinition,
  recentTasks: AgentTask[],      // 최근 10건
  recentLogs: AgentLog[],        // 최근 20건
  kpiSummary: {                  // 오늘 KPI
    metric: string,
    current: number,
    target: number,
    achievement: number           // percentage
  }[]
}
```

#### PATCH /api/admin/agents/:id
```typescript
// Body:
{
  config?: Record<string, any>,
  priority?: number,
  maxConcurrent?: number,
  retryPolicy?: { maxRetries: number, backoff: string },
  schedule?: string
}
```

#### POST /api/admin/agents/:id/start
```typescript
// 에이전트 활성화
// 1. DB status → ACTIVE
// 2. AgentRegistry에서 인스턴스 시작
// 3. EventBus 구독 시작
// 4. 스케줄 등록 (있는 경우)
// Response: { success: true, agent: AgentDefinition }
```

#### POST /api/admin/agents/:id/stop
```typescript
// 에이전트 비활성화
// 1. 실행 중 태스크 완료 대기 (30초 타임아웃)
// 2. EventBus 구독 해제
// 3. 스케줄 제거
// 4. DB status → INACTIVE
// Response: { success: true, agent: AgentDefinition }
```

### 4.2 태스크/로그/KPI

#### GET /api/admin/agents/tasks
```typescript
// Query: agentId?, status?, priority?, page=1, limit=20
// Response:
{
  tasks: AgentTask[],
  total: number,
  page: number,
  totalPages: number
}
```

#### GET /api/admin/agents/logs
```typescript
// Query: agentId?, level?, search?, page=1, limit=50
// Response:
{
  logs: AgentLog[],
  total: number,
  page: number,
  totalPages: number
}
```

#### GET /api/admin/agents/kpi
```typescript
// Query: agentId?, metric?, period=daily, startDate, endDate
// Response:
{
  records: AgentKpiRecord[],
  summary: {
    agentId: string,
    agentName: string,
    metrics: { metric: string, avg: number, target: number, trend: number[] }[]
  }[]
}
```

### 4.3 대시보드 종합

#### GET /api/admin/agents/dashboard
```typescript
// Response:
{
  overview: {
    totalAgents: 17,
    activeAgents: number,
    errorAgents: number,
    tasksToday: number,
    tasksCompleted: number,
    tasksFailed: number,
    avgLatency: number,        // ms
    kpiAchievement: number     // overall %
  },
  byLayer: {
    CORE: { active: number, tasks: number, kpi: number },
    BUSINESS: { active: number, tasks: number, kpi: number },
    INTELLIGENCE: { active: number, tasks: number, kpi: number }
  },
  recentEvents: AgentEvent[],  // 최근 20건
  alerts: {                    // 주의 필요 항목
    agentId: string,
    agentName: string,
    type: "error" | "kpi_miss" | "high_latency",
    message: string
  }[]
}
```

### 4.4 SSE 실시간 스트림

#### GET /api/admin/agents/events/stream
```typescript
// Server-Sent Events
// Event types:
// - agent.status.changed: { agentId, oldStatus, newStatus }
// - agent.task.started: { taskId, agentId, eventType }
// - agent.task.completed: { taskId, agentId, duration, success }
// - agent.task.failed: { taskId, agentId, error }
// - agent.kpi.updated: { agentId, metric, value, target }
// - agent.alert: { agentId, type, message }
```

---

## 5. UI 컴포넌트 상세

### 5.1 AgentCard (에이전트 카드)

```
┌─────────────────────────────────────┐
│ 🧠 Orchestrator Agent        [ON]  │
│ Core Layer                          │
│ 중앙 이벤트 라우팅, 워크플로우 관리 │
│                                     │
│ KPI ████████░░ 85%                  │
│ Tasks: 142 today | Errors: 2        │
│ Latency: 380ms avg                  │
└─────────────────────────────────────┘
```

Props:
- agent: AgentDefinition
- onToggle: (id: string) => void
- compact?: boolean (목록 모드)

### 5.2 AgentLayerSection (레이어 섹션)

```
━━━ CORE (8 agents) ━━━━━━━━━━━━━━━
[카드] [카드] [카드] [카드]
[카드] [카드] [카드] [카드]

━━━ BUSINESS (4 agents) ━━━━━━━━━━━
[카드] [카드] [카드] [카드]

━━━ INTELLIGENCE (5 agents) ━━━━━━━
[카드] [카드] [카드] [카드] [카드]
```

### 5.3 RealtimeEventFeed (실시간 이벤트)

```
┌─ 실시간 이벤트 ──────────────────────┐
│ 🟢 14:23:05 Analytics  link.clicked  │
│ 🟢 14:23:04 Growth     user.signup   │
│ 🔴 14:23:03 Commerce   payment FAIL  │
│ 🟢 14:23:02 Content    content.gen   │
│ 🟡 14:23:01 SEO        meta.update   │
│ ...                                   │
└───────────────────────────────────────┘
```

### 5.4 KpiChart (KPI 차트)

Recharts 기반:
- BarChart (가로): 에이전트별 KPI 달성률
- LineChart: 일별 KPI 추이
- 색상 코딩: 100%+ 녹색, 70~99% 노란색, <70% 빨간색

### 5.5 WorkflowEditor (워크플로우 편집기)

```
┌─ user.signup ────────────────────────┐
│                                      │
│  [Growth] → ┬─ [Brand]    ┐         │
│             └─ [Content]   ├→ [SEO]  │
│                            │         │
│             [Notification] ┘         │
│                                      │
│  [+ Add Step]  [Save]  [Test Run]   │
└──────────────────────────────────────┘
```

---

## 6. 에이전트 런타임 엔진

### 6.1 AgentBase 클래스

모든 17개 에이전트가 상속하는 기본 클래스:

```typescript
// sourcing-app/src/modules/agents/AgentBase.ts

export abstract class AgentBase {
  abstract name: string;
  abstract layer: "CORE" | "BUSINESS" | "INTELLIGENCE";

  protected id: string;        // DB의 AgentDefinition.id
  protected eventBus: EventBus;
  protected config: Record<string, any>;
  protected isRunning: boolean = false;

  constructor(eventBus: EventBus, config: Record<string, any>) {
    this.eventBus = eventBus;
    this.config = config;
  }

  // 필수 구현 메서드
  abstract handleEvent(event: AgentEvent): Promise<AgentResult>;
  abstract getSubscribedEvents(): string[];

  // 선택 구현 메서드
  async onSchedule?(): Promise<void>;
  async healthCheck(): Promise<HealthCheckResult>;

  // 공통 메서드 (자동 제공)
  async start(): Promise<void>;
  async stop(): Promise<void>;
  protected async log(level: LogLevel, message: string, metadata?: any): Promise<void>;
  protected async recordKpi(metric: string, value: number): Promise<void>;
  protected async emitEvent(eventType: string, data: any): Promise<void>;
}
```

### 6.2 EventBus (Redis Pub/Sub)

```typescript
// sourcing-app/src/modules/agents/EventBus.ts

export interface AgentEvent {
  id: string;
  type: string;          // "user.signup", "link.clicked" 등
  data: any;
  source: string;        // 발생 소스
  timestamp: Date;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
}

export class EventBus {
  subscribe(pattern: string, handler: EventHandler): void;
  unsubscribe(pattern: string, handler: EventHandler): void;
  publish(event: AgentEvent): Promise<void>;
  getRecentEvents(limit?: number): Promise<AgentEvent[]>;
}
```

### 6.3 WorkflowEngine (DAG 엔진)

```typescript
// sourcing-app/src/modules/agents/WorkflowEngine.ts

export class WorkflowEngine {
  // 이벤트 발생 시 매칭되는 워크플로우 실행
  async executeWorkflow(event: AgentEvent): Promise<WorkflowResult>;

  // 워크플로우 단계 실행 (순차 + 병렬 지원)
  private async executeStep(step: WorkflowStep, context: any): Promise<StepResult>;

  // 에러 처리 + 재시도
  private async handleStepError(step: WorkflowStep, error: Error): Promise<void>;
}
```

### 6.4 TaskQueue (Bull Queue)

```typescript
// sourcing-app/src/modules/agents/TaskQueue.ts

export class TaskQueue {
  constructor(redisUrl: string);

  // 태스크 추가 (우선순위 기반)
  async addTask(agentId: string, event: AgentEvent): Promise<string>;

  // 태스크 처리 (워커)
  processTask(handler: TaskHandler): void;

  // 태스크 상태 조회
  async getTaskStatus(taskId: string): Promise<TaskStatus>;

  // 대기 중/실행 중 태스크 수
  async getQueueStats(): Promise<QueueStats>;
}
```

---

## 7. 17개 에이전트 등록 시드 데이터

```typescript
// db/prisma/seed-agents.ts

const AGENT_SEEDS = [
  // ── CORE (8) ──
  {
    name: "orchestrator",
    displayName: "Orchestrator Agent",
    layer: "CORE",
    icon: "brain",
    description: "중앙 이벤트 라우팅, 워크플로우 관리, 에이전트 조율",
    priority: 1,
    maxConcurrent: 30,
    retryPolicy: { maxRetries: 5, backoff: "exponential", delays: [1000, 2000, 4000, 8000, 16000] },
    schedule: "*/1 * * * *",  // 1분마다 헬스체크
    config: {
      kpiTargets: { event_latency: 500 },
      routing: { maxConcurrent: 30, defaultTimeout: 30000 }
    }
  },
  {
    name: "content",
    displayName: "Content Agent",
    layer: "CORE",
    icon: "pen-tool",
    description: "콘텐츠 자동 생성 (프로필, 링크, 상품 설명)",
    priority: 2,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [1000, 2000, 4000] },
    config: {
      kpiTargets: { ai_utilization: 60 },
      claude: { model: "sonnet", maxTokens: 2000 },
      generation: { maxLength: 150, timeout: 3000 }
    }
  },
  {
    name: "analytics",
    displayName: "Analytics Agent",
    layer: "CORE",
    icon: "bar-chart-2",
    description: "클릭/방문/전환 데이터 수집 및 분석",
    priority: 2,
    maxConcurrent: 10,
    retryPolicy: { maxRetries: 3, backoff: "linear", delays: [500, 1000, 1500] },
    schedule: "*/5 * * * *",  // 5분마다 집계
    config: {
      kpiTargets: { data_accuracy: 99 },
      anomaly: { zScoreThreshold: 3.0, minSamples: 100 }
    }
  },
  {
    name: "revenue",
    displayName: "Revenue Agent",
    layer: "CORE",
    icon: "dollar-sign",
    description: "수익 최적화, 가격 전략, 업셀 유도",
    priority: 2,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [2000, 4000, 8000] },
    schedule: "0 0 * * *",  // 매일 자정
    config: {
      kpiTargets: { monthly_revenue_growth: 15 },
      pricing: { maxDailyChange: 15, minMargin: 10 },
      upsell: { freeToProTarget: 10, proToBusinessTarget: 5 }
    }
  },
  {
    name: "growth",
    displayName: "Growth Agent",
    layer: "CORE",
    icon: "trending-up",
    description: "사용자 성장, 이탈 방지, 리텐션 관리",
    priority: 3,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [1000, 2000, 4000] },
    schedule: "0 9 * * *",  // 매일 9시
    config: {
      kpiTargets: { churn_rate: 5 },
      onboarding: { sequences: [0, 1, 3, 7] },
      retention: { warningDays: [7, 14, 30] },
      maxNotifications: 3
    }
  },
  {
    name: "support",
    displayName: "Support Agent",
    layer: "CORE",
    icon: "headphones",
    description: "고객 문의 자동 응답, 티켓 관리",
    priority: 3,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [1000, 2000] },
    config: {
      kpiTargets: { auto_resolve_rate: 70 },
      escalation: { confidenceThreshold: 70, repeatThreshold: 3 }
    }
  },
  {
    name: "moderation",
    displayName: "Moderation Agent",
    layer: "CORE",
    icon: "shield",
    description: "스팸, 사기, 유해 콘텐츠 차단",
    priority: 1,
    maxConcurrent: 10,
    retryPolicy: { maxRetries: 1, backoff: "none", delays: [0] },
    config: {
      kpiTargets: { block_rate: 99 },
      safeBrowsing: { enabled: true },
      falsePositiveTarget: 1
    }
  },
  {
    name: "notification",
    displayName: "Notification Agent",
    layer: "CORE",
    icon: "bell",
    description: "멀티채널 알림 통합 (이메일, 푸시, SMS, 카카오)",
    priority: 2,
    maxConcurrent: 20,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [1000, 2000, 4000] },
    config: {
      kpiTargets: { email_open_rate: 25 },
      channels: ["email", "push", "sms", "kakao", "inapp"],
      throttle: { maxPerUserPerDay: 5 },
      templates: { languages: ["ko", "en"] }
    }
  },

  // ── BUSINESS (4) ──
  {
    name: "commerce",
    displayName: "Commerce Agent",
    layer: "BUSINESS",
    icon: "shopping-bag",
    description: "쇼핑몰 운영 자동화 (상품, 주문, 배송)",
    priority: 3,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [2000, 4000, 8000] },
    config: {
      kpiTargets: { order_processing_time: 60000 },
      orderStates: ["PENDING","PAID","PREPARING","SHIPPED","DELIVERED"],
      carriers: ["cj", "hanjin", "lotte"]
    }
  },
  {
    name: "affiliate",
    displayName: "Affiliate Agent",
    layer: "BUSINESS",
    icon: "link-2",
    description: "제휴 마케팅 자동화 (쿠팡, 아마존, ClickBank)",
    priority: 3,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [1000, 2000, 4000] },
    config: {
      kpiTargets: { monthly_affiliate_revenue: 50000 },
      platforms: { coupang: { commission: "3-7%" }, amazon: { commission: "1-10%" } }
    }
  },
  {
    name: "sourcing",
    displayName: "Sourcing Agent",
    layer: "BUSINESS",
    icon: "package",
    description: "도매 상품 자동 수집, 변환, 등록 (SNS_AUTO 연동)",
    priority: 4,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [5000, 10000, 20000] },
    config: {
      kpiTargets: { automation_rate: 70 },
      pipeline: { timeout: 1800000, minMargin: 30 },
      channels: ["band", "aliexpress", "1688"]
    }
  },
  {
    name: "finance",
    displayName: "Finance Agent",
    layer: "BUSINESS",
    icon: "credit-card",
    description: "결제, 정산, 출금, 세금 관리 (토스페이먼츠)",
    priority: 2,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 5, backoff: "exponential", delays: [1000, 2000, 4000, 8000, 16000] },
    config: {
      kpiTargets: { payment_success_rate: 98 },
      settlement: { minWithdrawal: 10000, settlementDay: 15 },
      fees: { free: 5, pro: 3, business: 1 }
    }
  },

  // ── INTELLIGENCE (5) ──
  {
    name: "recommendation",
    displayName: "Recommendation Agent",
    layer: "INTELLIGENCE",
    icon: "target",
    description: "개인화 추천, A/B 테스트 엔진",
    priority: 4,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [1000, 2000] },
    schedule: "0 * * * *",  // 1시간마다
    config: {
      kpiTargets: { recommendation_ctr: 20 },
      weights: { category: 0.3, popularity: 0.2, commission: 0.2, conversion: 0.2, trend: 0.1 },
      abTest: { minSamples: 100 }
    }
  },
  {
    name: "funnel",
    displayName: "Funnel Agent",
    layer: "INTELLIGENCE",
    icon: "git-merge",
    description: "전환 퍼널 분석, CTA 최적화",
    priority: 4,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [1000, 2000] },
    config: {
      kpiTargets: { funnel_conversion: 8 },
      stages: ["visit", "view", "scroll", "click", "external", "convert"],
      bottleneck: { weights: { dropoff: 0.4, traffic: 0.3, revenue: 0.3 } }
    }
  },
  {
    name: "brand",
    displayName: "Brand Agent",
    layer: "INTELLIGENCE",
    icon: "palette",
    description: "브랜드 전략, 스타일, 콘텐츠 방향",
    priority: 5,
    maxConcurrent: 2,
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [2000, 4000] },
    schedule: "0 0 * * 1",  // 매주 월요일
    config: {
      kpiTargets: { brand_consistency: 80 },
      categories: ["beauty", "tech", "food", "fitness", "business"],
      claude: { model: "opus", maxTokens: 4000 }
    }
  },
  {
    name: "seo",
    displayName: "SEO Agent",
    layer: "INTELLIGENCE",
    icon: "search",
    description: "검색 노출, 메타태그, 사이트맵, 구조화 데이터",
    priority: 3,
    maxConcurrent: 5,
    retryPolicy: { maxRetries: 3, backoff: "exponential", delays: [2000, 4000, 8000] },
    schedule: "0 */6 * * *",  // 6시간마다
    config: {
      kpiTargets: { search_traffic_growth: 15 },
      schemas: ["Person", "Product", "BreadcrumbList", "FAQ"],
      sitemap: { maxUrls: 50000, changefreq: "daily" }
    }
  },
  {
    name: "design",
    displayName: "Design Agent",
    layer: "INTELLIGENCE",
    icon: "figma",
    description: "테마/레이아웃 생성, OG/썸네일, 브랜딩, UI 시스템",
    priority: 4,
    maxConcurrent: 3,
    retryPolicy: { maxRetries: 2, backoff: "linear", delays: [2000, 4000] },
    config: {
      kpiTargets: { theme_adoption: 60 },
      presets: 8,
      claude: { haiku: "color-classify", sonnet: "theme-recommend", opus: "design-strategy" },
      accessibility: { standard: "WCAG-AA" }
    }
  }
];
```

---

## 8. 구현 순서 (추천)

### Phase 1: 기반 (3일)
1. `agent.prisma` 스키마 생성 + `prisma db push`
2. `seed-agents.ts` 실행 → 17개 에이전트 등록
3. `navigation.ts` 메뉴 확장

### Phase 2: API (3일)
4. 에이전트 CRUD API (route.ts, [id]/route.ts)
5. 시작/중지/재시작 API
6. 태스크/로그/KPI 조회 API
7. 대시보드 통계 API

### Phase 3: UI (5일)
8. AgentCard, StatusToggle, MiniKpi 컴포넌트
9. dashboard/page.tsx (대시보드)
10. registry/page.tsx (레지스트리)
11. kpi/page.tsx (KPI 차트)
12. workflows/page.tsx (워크플로우)

### Phase 4: 런타임 (5일)
13. AgentBase 클래스
14. EventBus (Redis Pub/Sub)
15. TaskQueue (Bull Queue)
16. WorkflowEngine (DAG)
17. monitor/page.tsx + SSE 스트림

### Phase 5: 에이전트 구현 (지속)
18. Core 에이전트 8개 구현
19. Business 에이전트 4개 구현
20. Intelligence 에이전트 5개 구현
