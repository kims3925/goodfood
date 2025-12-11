# Playwright 스케일링 전략

> 사용자 증가에 따른 Playwright 서버 부하 해결 방안 및 구현 가이드

---

## 목차

1. [현재 구조 분석](#1-현재-구조-분석)
2. [스케일링 전략 5가지](#2-스케일링-전략-5가지)
3. [추천 전략: BullMQ + Worker Pool](#3-추천-전략-bullmq--worker-pool)
4. [구현 가이드](#4-구현-가이드)
5. [확장 시나리오](#5-확장-시나리오)
6. [모니터링 & 최적화](#6-모니터링--최적화)

---

## 1. 현재 구조 분석

### 1.1 현재 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    현재 Playwright 구조                      │
└─────────────────────────────────────────────────────────────┘

사용자 요청 (발행)
       │
       ▼
┌──────────────────┐
│   Sourcing App   │  ←── 단일 서버
│   (Next.js)      │
├──────────────────┤
│  ┌────────────┐  │
│  │  API Route │  │
│  │  /publish  │  │
│  └─────┬──────┘  │
│        │         │
│        ▼         │
│  ┌────────────┐  │
│  │ Playwright │  │  ←── 동기적 실행
│  │ (Chromium) │  │
│  └────────────┘  │
└──────────────────┘
```

### 1.2 문제점

| 문제 | 영향 | 심각도 |
|------|------|--------|
| **동기 실행** | API 응답 시간 30초+ | 🔴 Critical |
| **메모리 사용** | Chromium당 200-500MB | 🟡 High |
| **동시 요청** | 서버 크래시 위험 | 🔴 Critical |
| **단일 장애점** | 서버 다운 = 전체 중단 | 🔴 Critical |
| **스케일 불가** | 수평 확장 어려움 | 🟡 High |

### 1.3 리소스 사용량 분석

```
┌─────────────────────────────────────────────────────────────┐
│              Playwright 리소스 사용량 (예상)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Chromium 인스턴스 1개:                                      │
│   ├── 메모리: 200-500MB                                      │
│   ├── CPU: 0.5-1 core                                        │
│   └── 실행 시간: 10-30초                                      │
│                                                              │
│   동시 사용자 시나리오:                                        │
│   ├── 10명 동시: 2-5GB RAM 필요                              │
│   ├── 50명 동시: 10-25GB RAM 필요                            │
│   └── 100명 동시: 20-50GB RAM 필요                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 스케일링 전략 5가지

### 2.1 전략 비교표

```
┌────────────────────────────────────────────────────────────────────┐
│                     스케일링 전략 비교                               │
├──────────────┬──────────┬──────────┬──────────┬──────────┬─────────┤
│    전략      │ 복잡도   │  비용    │ 확장성   │ 권장규모  │  추천   │
├──────────────┼──────────┼──────────┼──────────┼──────────┼─────────┤
│ 세션 캐싱    │ ⭐       │ $0       │ ★★      │ ~100명   │ 필수    │
│ 작업 큐      │ ⭐⭐     │ $10-30   │ ★★★★   │ 100-10K  │ ✅ 추천 │
│ 별도 서버    │ ⭐⭐⭐   │ $30-100  │ ★★★    │ 100-1K   │ 보통    │
│ SaaS 사용    │ ⭐       │ $50-200  │ ★★★★★ │ 10K+     │ 대규모  │
│ Lambda/Fargate│⭐⭐⭐⭐ │ 사용량   │ ★★★★★ │ 1K-100K  │ 대규모  │
└──────────────┴──────────┴──────────┴──────────┴──────────┴─────────┘
```

### 2.2 전략 1: 세션 캐싱 극대화 (필수)

**개념:** Playwright 로그인 빈도를 최소화하여 부하 감소

```
┌─────────────────────────────────────────────────────────────┐
│                  세션 캐싱 전략                              │
└─────────────────────────────────────────────────────────────┘

Before (매번 로그인):
  발행 요청 → Playwright 로그인 (30초) → 발행 → 완료

After (캐싱):
  발행 요청 → 세션 있음? ─YES─▶ 바로 발행 → 완료 (5초)
                  │
                  NO
                  │
                  ▼
            Playwright 로그인 (30초)
                  │
                  ▼
            세션 저장 (14일간 유효)
                  │
                  ▼
               발행 → 완료
```

**구현:**
```typescript
// 이미 구현됨: src/modules/band-session/band-session.service.ts

class BandSessionService {
  // 세션 유효 기간 14일 (최대화)
  private SESSION_EXPIRY_DAYS = 14

  // 만료 1일 전 백그라운드 갱신
  private REFRESH_BEFORE_DAYS = 1

  async getValidSession(channelId: number) {
    const session = await this.getStoredSession(channelId)

    if (session && !this.isExpired(session)) {
      // 갱신 필요 여부 확인 (백그라운드)
      if (this.shouldRefresh(session)) {
        this.refreshSession(channelId).catch(console.error)
      }
      return session
    }

    // 세션 없거나 만료 → 새 로그인
    return this.acquireSession(channelId)
  }
}
```

**효과:**
- 로그인 빈도: 14일에 1회 (99% 감소)
- 평균 응답 시간: 30초 → 5초

---

### 2.3 전략 2: 작업 큐 + Worker Pool (추천)

**개념:** 요청을 큐에 넣고 Worker가 순차 처리

```
┌─────────────────────────────────────────────────────────────┐
│               BullMQ + Worker Pool 아키텍처                  │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  사용자 요청  │────▶│   BullMQ     │────▶│   Worker Pool    │
│  (비동기)     │     │   (Redis)    │     │  (Playwright)    │
└──────────────┘     └──────┬───────┘     └────────┬─────────┘
       │                    │                       │
       │                    │    ┌─────────────────┐│
       │                    │    │  Worker 1       ││
       │                    │    │  (Chromium)     ││
       │                    ├───▶├─────────────────┤│
       │                    │    │  Worker 2       ││
       │                    │    │  (Chromium)     ││
       │                    ├───▶├─────────────────┤│
       │                    │    │  Worker 3       ││
       │                    │    │  (Chromium)     ││
       │                    └───▶└─────────────────┘│
       │                                            │
       │              완료 알림 (WebSocket/Polling)  │
       ◀────────────────────────────────────────────┘
```

**장점:**
- 동시 요청 제어 (동시 실행 제한)
- 실패 시 자동 재시도
- 우선순위 지정 가능
- 작업 상태 모니터링

**단점:**
- Redis 필요
- 초기 구현 복잡도

---

### 2.4 전략 3: 별도 Playwright 서버

**개념:** Playwright 전용 마이크로서비스 분리

```
┌─────────────────────────────────────────────────────────────┐
│              Playwright 마이크로서비스                        │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐                  ┌──────────────────┐
│   Sourcing App   │     REST API     │  Playwright      │
│   (비즈니스 로직) │◀───────────────▶│  Service         │
└──────────────────┘                  ├──────────────────┤
                                      │  - 로그인 API    │
                                      │  - 발행 API      │
                                      │  - 스크래핑 API  │
                                      └──────────────────┘
                                              │
                                      ┌───────┴───────┐
                                      │   Chromium    │
                                      │   Pool        │
                                      └───────────────┘
```

**장점:**
- 메인 앱 성능 영향 없음
- 독립적 스케일링
- 장애 격리

**단점:**
- 서버 비용 증가
- 네트워크 지연

---

### 2.5 전략 4: Browserless.io (SaaS)

**개념:** 외부 브라우저 자동화 서비스 사용

```
┌─────────────────────────────────────────────────────────────┐
│                  Browserless.io 연동                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐                  ┌──────────────────┐
│   Sourcing App   │     WebSocket    │  Browserless.io  │
│                  │◀───────────────▶│  (외부 서비스)    │
└──────────────────┘                  ├──────────────────┤
                                      │  - 무제한 확장   │
                                      │  - 인프라 관리X  │
                                      │  - $50-200/월    │
                                      └──────────────────┘
```

**사용 예시:**
```typescript
import { chromium } from 'playwright'

// 기존
const browser = await chromium.launch()

// Browserless 사용
const browser = await chromium.connect(
  'wss://chrome.browserless.io?token=YOUR_API_KEY'
)
```

**가격:**
- Starter: $50/월 (1,000 시간)
- Professional: $200/월 (무제한)

---

### 2.6 전략 5: AWS Lambda / Fargate

**개념:** 서버리스로 필요할 때만 실행

```
┌─────────────────────────────────────────────────────────────┐
│                  AWS Fargate + ECS                           │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Sourcing App│────▶│     SQS      │────▶│  ECS Fargate     │
│              │     │  (큐)        │     │  (Auto Scaling)  │
└──────────────┘     └──────────────┘     └──────────────────┘
                                                   │
                                          ┌────────┴────────┐
                                          │ Task 1 (Chromium)│
                                          │ Task 2 (Chromium)│
                                          │ Task N (자동 확장)│
                                          └─────────────────┘
```

**장점:**
- 완전 자동 확장
- 사용한 만큼만 비용
- 무한 확장 가능

**단점:**
- Cold Start (5-15초)
- 복잡한 설정
- 디버깅 어려움

---

## 3. 추천 전략: BullMQ + Worker Pool

### 3.1 왜 BullMQ인가?

```
┌─────────────────────────────────────────────────────────────┐
│                  BullMQ 선택 이유                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ 점진적 확장 가능                                          │
│     Worker 1개 → 2개 → 10개 (코드 변경 없음)                  │
│                                                              │
│  ✅ 비용 효율적                                               │
│     초기: Redis만 추가 ($10-20/월)                           │
│     확장: Worker 서버 추가                                    │
│                                                              │
│  ✅ 안정성                                                    │
│     실패 자동 재시도                                          │
│     작업 손실 없음                                            │
│                                                              │
│  ✅ 모니터링                                                  │
│     Bull Board UI 제공                                        │
│     작업 상태 실시간 확인                                      │
│                                                              │
│  ✅ 나중에 Lambda로 전환 용이                                  │
│     큐 구조 유지하며 Worker만 교체                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                   BullMQ 아키텍처 상세                           │
└─────────────────────────────────────────────────────────────────┘

                     ┌──────────────────────┐
                     │    Sourcing App      │
                     │    (Producer)        │
                     └──────────┬───────────┘
                                │
                     addJob('band-login', data)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Redis                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Queue: band-tasks                       │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │  │
│  │  │ Job 1   │ │ Job 2   │ │ Job 3   │ │ Job 4   │ ...     │  │
│  │  │ login   │ │ publish │ │ login   │ │ publish │         │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ (Worker가 작업 가져감)
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Worker 1   │        │   Worker 2   │        │   Worker 3   │
│  ┌────────┐  │        │  ┌────────┐  │        │  ┌────────┐  │
│  │Chromium│  │        │  │Chromium│  │        │  │Chromium│  │
│  └────────┘  │        │  └────────┘  │        │  └────────┘  │
└──────────────┘        └──────────────┘        └──────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                        결과 저장 (DB/Redis)
                                │
                                ▼
                     ┌──────────────────────┐
                     │   Sourcing App       │
                     │   (결과 조회/알림)    │
                     └──────────────────────┘
```

---

## 4. 구현 가이드

### 4.1 설치

```bash
# BullMQ 및 Redis 클라이언트
npm install bullmq ioredis

# Bull Board (모니터링 UI)
npm install @bull-board/api @bull-board/express
```

### 4.2 프로젝트 구조

```
sourcing-app/src/
└── modules/
    └── queue/
        ├── index.ts              # Export
        ├── queue.config.ts       # Redis 연결 설정
        ├── band-queue.ts         # 큐 정의
        ├── band-worker.ts        # Worker 정의
        ├── job-types.ts          # Job 타입 정의
        └── bull-board.ts         # 모니터링 UI
```

### 4.3 Queue 설정

```typescript
// src/modules/queue/queue.config.ts
import IORedis from 'ioredis'

export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,  // BullMQ 필수
})

export const defaultQueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,                    // 최대 재시도 3회
    backoff: {
      type: 'exponential',
      delay: 5000,                  // 5초 → 10초 → 20초
    },
    removeOnComplete: {
      age: 3600,                    // 완료 후 1시간 보관
      count: 1000,                  // 최대 1000개 보관
    },
    removeOnFail: {
      age: 86400,                   // 실패 후 24시간 보관
    },
  },
}
```

### 4.4 Job 타입 정의

```typescript
// src/modules/queue/job-types.ts

// 밴드 로그인 Job
export interface BandLoginJob {
  type: 'band-login'
  channelId: number
  naverId: string
  naverPassword: string
}

// 밴드 발행 Job
export interface BandPublishJob {
  type: 'band-publish'
  channelId: number
  productId: number
  content: string
  images?: string[]
}

// 공통 Job 결과
export interface JobResult {
  success: boolean
  data?: any
  error?: string
}

export type BandJob = BandLoginJob | BandPublishJob
```

### 4.5 Queue 구현

```typescript
// src/modules/queue/band-queue.ts
import { Queue } from 'bullmq'
import { defaultQueueOptions } from './queue.config'
import type { BandJob, JobResult } from './job-types'

// 큐 생성
export const bandQueue = new Queue<BandJob, JobResult>('band-tasks', {
  ...defaultQueueOptions,
})

// 작업 추가 헬퍼 함수
export async function addBandLoginJob(data: {
  channelId: number
  naverId: string
  naverPassword: string
}) {
  const job = await bandQueue.add(
    'band-login',
    { type: 'band-login', ...data },
    {
      priority: 1,  // 높은 우선순위 (로그인은 빨리)
    }
  )
  return job
}

export async function addBandPublishJob(data: {
  channelId: number
  productId: number
  content: string
  images?: string[]
}) {
  const job = await bandQueue.add(
    'band-publish',
    { type: 'band-publish', ...data },
    {
      priority: 5,  // 일반 우선순위
    }
  )
  return job
}

// 작업 상태 조회
export async function getJobStatus(jobId: string) {
  const job = await bandQueue.getJob(jobId)
  if (!job) return null

  const state = await job.getState()
  return {
    id: job.id,
    state,
    data: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
    progress: job.progress,
    timestamp: job.timestamp,
  }
}
```

### 4.6 Worker 구현

```typescript
// src/modules/queue/band-worker.ts
import { Worker, Job } from 'bullmq'
import { defaultQueueOptions } from './queue.config'
import { bandSessionService } from '@/modules/band-session'
import { BandInternalClient } from '@/modules/sourcing/domain/src/channel'
import type { BandJob, JobResult } from './job-types'

// Worker 생성
export const bandWorker = new Worker<BandJob, JobResult>(
  'band-tasks',
  async (job: Job<BandJob, JobResult>) => {
    console.log(`[Worker] Processing job ${job.id}: ${job.data.type}`)

    try {
      switch (job.data.type) {
        case 'band-login':
          return await handleBandLogin(job)
        case 'band-publish':
          return await handleBandPublish(job)
        default:
          throw new Error(`Unknown job type: ${(job.data as any).type}`)
      }
    } catch (error: any) {
      console.error(`[Worker] Job ${job.id} failed:`, error)
      throw error  // 재시도 트리거
    }
  },
  {
    ...defaultQueueOptions,
    concurrency: 2,  // 동시 실행 수 (서버 사양에 맞게 조절)
    limiter: {
      max: 10,       // 10초당 최대 10개
      duration: 10000,
    },
  }
)

// 밴드 로그인 처리
async function handleBandLogin(job: Job<BandJob, JobResult>): Promise<JobResult> {
  const { channelId, naverId, naverPassword } = job.data as any

  // 진행 상황 업데이트
  await job.updateProgress(10)

  // Playwright 로그인
  const session = await bandSessionService.acquireSession({
    naverId,
    naverPassword,
  })

  await job.updateProgress(80)

  // 세션 저장
  await bandSessionService.saveSession(channelId, { naverId, naverPassword }, session)

  await job.updateProgress(100)

  return {
    success: true,
    data: { expiresAt: session.expiresAt },
  }
}

// 밴드 발행 처리
async function handleBandPublish(job: Job<BandJob, JobResult>): Promise<JobResult> {
  const { channelId, productId, content, images } = job.data as any

  await job.updateProgress(10)

  // 세션 조회 (없으면 자동 로그인)
  const session = await bandSessionService.getValidSession(channelId)
  if (!session) {
    throw new Error('세션을 획득할 수 없습니다.')
  }

  await job.updateProgress(30)

  // 발행
  const client = new BandInternalClient(session.cookies)
  const result = await client.publishProduct(
    String(channelId),  // channelKey
    content,
    images || []
  )

  await job.updateProgress(100)

  return {
    success: true,
    data: { postKey: result.postKey },
  }
}

// Worker 이벤트 리스너
bandWorker.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completed:`, result)
})

bandWorker.on('failed', (job, error) => {
  console.error(`[Worker] Job ${job?.id} failed:`, error.message)
})

bandWorker.on('progress', (job, progress) => {
  console.log(`[Worker] Job ${job.id} progress: ${progress}%`)
})
```

### 4.7 Bull Board 모니터링

```typescript
// src/modules/queue/bull-board.ts
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { bandQueue } from './band-queue'

export const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')

createBullBoard({
  queues: [new BullMQAdapter(bandQueue)],
  serverAdapter,
})

// API Route에서 사용
// src/app/api/admin/queues/[[...slug]]/route.ts
import { serverAdapter } from '@/modules/queue/bull-board'

export const GET = serverAdapter.getRouter()
export const POST = serverAdapter.getRouter()
```

### 4.8 API 연동

```typescript
// src/app/api/band/publish/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { addBandPublishJob, getJobStatus } from '@/modules/queue/band-queue'

// 발행 요청 (비동기)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { channelId, productId, content, images } = body

  // 큐에 작업 추가
  const job = await addBandPublishJob({
    channelId,
    productId,
    content,
    images,
  })

  // 즉시 응답 (작업 ID 반환)
  return NextResponse.json({
    success: true,
    jobId: job.id,
    message: '발행 작업이 큐에 추가되었습니다.',
  })
}

// 작업 상태 조회
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  const status = await getJobStatus(jobId)
  if (!status) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json(status)
}
```

### 4.9 프론트엔드 폴링

```typescript
// 프론트엔드에서 작업 상태 폴링
async function publishWithProgress(data: PublishData) {
  // 1. 작업 추가
  const response = await fetch('/api/band/publish', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  const { jobId } = await response.json()

  // 2. 상태 폴링
  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      const status = await fetch(`/api/band/publish?jobId=${jobId}`)
      const job = await status.json()

      if (job.state === 'completed') {
        clearInterval(poll)
        resolve(job.result)
      } else if (job.state === 'failed') {
        clearInterval(poll)
        reject(new Error(job.failedReason))
      }

      // 진행률 업데이트
      updateProgress(job.progress || 0)
    }, 2000)  // 2초마다 확인
  })
}
```

---

## 5. 확장 시나리오

### 5.1 단계별 확장 가이드

```
┌─────────────────────────────────────────────────────────────┐
│                    확장 시나리오                             │
└─────────────────────────────────────────────────────────────┘

Phase 1: 초기 (~100 사용자)
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────┐      ┌──────────────┐                     │
│  │ Sourcing App │─────▶│    Redis     │                     │
│  │ + Worker (1) │      │  (ElastiCache)│                     │
│  └──────────────┘      └──────────────┘                     │
│                                                              │
│  비용: ~$30/월 (EC2 + ElastiCache)                          │
│  처리량: 분당 20-30건                                        │
└─────────────────────────────────────────────────────────────┘

Phase 2: 성장 (~1,000 사용자)
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │ Sourcing App │─────▶│    Redis     │◀─────│ Worker x3 │ │
│  │  (Producer)  │      │              │      │  (별도EC2) │ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│                                                              │
│  비용: ~$100/월 (EC2 x2 + ElastiCache)                      │
│  처리량: 분당 60-100건                                       │
└─────────────────────────────────────────────────────────────┘

Phase 3: 확장 (~10,000 사용자)
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │ Sourcing App │─────▶│    Redis     │◀─────│ECS Fargate│ │
│  │    (ECS)     │      │  (Cluster)   │      │ Auto Scale│ │
│  └──────────────┘      └──────────────┘      │  (1-10)   │ │
│                                               └───────────┘ │
│                                                              │
│  비용: ~$300-500/월                                          │
│  처리량: 분당 200-500건                                      │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Worker 설정 가이드

```typescript
// 서버 사양별 권장 Worker 설정

// t3.small (2 vCPU, 2GB RAM)
concurrency: 1

// t3.medium (2 vCPU, 4GB RAM)
concurrency: 2

// t3.large (2 vCPU, 8GB RAM)
concurrency: 3-4

// t3.xlarge (4 vCPU, 16GB RAM)
concurrency: 5-8
```

---

## 6. 모니터링 & 최적화

### 6.1 핵심 메트릭

```typescript
// src/modules/queue/metrics.ts
import { bandQueue } from './band-queue'

export async function getQueueMetrics() {
  const [waiting, active, completed, failed] = await Promise.all([
    bandQueue.getWaitingCount(),
    bandQueue.getActiveCount(),
    bandQueue.getCompletedCount(),
    bandQueue.getFailedCount(),
  ])

  return {
    waiting,      // 대기 중
    active,       // 실행 중
    completed,    // 완료
    failed,       // 실패
    total: waiting + active + completed + failed,
  }
}
```

### 6.2 알림 설정

```typescript
// Worker 실패 알림 (예: Slack)
bandWorker.on('failed', async (job, error) => {
  if (job && job.attemptsMade >= job.opts.attempts!) {
    // 모든 재시도 실패 → 알림
    await sendSlackAlert({
      title: '⚠️ Playwright Job 최종 실패',
      text: `Job ID: ${job.id}\nError: ${error.message}`,
    })
  }
})
```

### 6.3 최적화 팁

```
┌─────────────────────────────────────────────────────────────┐
│                    성능 최적화 팁                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 브라우저 재사용                                          │
│     - 매번 새 브라우저 대신 브라우저 풀 유지                   │
│     - 메모리 사용량 50% 감소                                  │
│                                                              │
│  2. 불필요한 리소스 차단                                      │
│     - 이미지, CSS, 폰트 로드 비활성화                         │
│     - 로딩 시간 70% 단축                                      │
│                                                              │
│  3. 동시성 제한                                               │
│     - 서버 RAM / 500MB = 최대 동시 실행 수                   │
│     - 예: 4GB RAM → 최대 8개                                 │
│                                                              │
│  4. 헤드리스 모드                                             │
│     - PLAYWRIGHT_HEADLESS=true                               │
│     - 30% 메모리 절약                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 다음 단계

1. **즉시 적용**: 세션 캐싱 극대화 (이미 구현됨)
2. **1주 내**: Redis 설치 및 BullMQ 기본 구현
3. **2주 내**: Worker 분리 및 모니터링 설정
4. **1개월 내**: 부하 테스트 및 Worker 수 최적화

---

## 관련 문서

- [아키텍처 개요](./architecture-overview.md)
- [Docker 배포 가이드](./docker-deployment-guide.md)
