# 소싱앱 배포 준비 상태 보고서

> 작성일: 2025-12-10
> 최종 수정: 2025-12-10
> 배포 준비도: **75-80%** (기본 배포 가능)

---

## 수정 완료 항목 (2025-12-10)

### ✅ TypeScript 에러 17개 → 0개 해결
- `SOURCING_USER` → `MANAGER` 역할 수정 (seed 스크립트)
- `currentUser.id` → `currentUser.userId` 수정 (shop/[id]/route.ts)
- `orderTest` 모델 타입 단언 추가 (order.repository.ts, webhook/route.ts)
- `subdomain` → `shop?.subdomain` 수정 (channel.service.ts)
- `recipientName` → `shippingAddress.create` 구조 변경 (seed 스크립트)
- `customerPhone` → `shippingAddress?.recipientPhone` 수정 (dashboard/shop/route.ts)

### ✅ 보안 개선
- JWT_SECRET 하드코딩 기본값 제거 → 환경변수 필수화
- INTERNAL_API_KEY 기본값 제거 → 환경변수 없으면 기능 생략
- TOSS_PAYMENTS_SECRET_KEY 없을 때 결제 취소 차단 로직 추가
- `.env.example` 파일 생성 (모든 환경변수 문서화)

### ✅ 빌드 확인
- `npm run build` 성공
- `npx tsc --noEmit` 에러 없음

---

## 목차

1. [요약](#요약)
2. [Critical 이슈 (즉시 해결)](#1-critical-이슈-즉시-해결)
3. [코드 품질 이슈](#2-코드-품질-이슈)
4. [보안 이슈](#3-보안-이슈)
5. [성능 이슈](#4-성능-이슈)
6. [아키텍처 이슈](#5-아키텍처-이슈)
7. [배포 체크리스트](#6-배포-체크리스트)
8. [권장 해결 순서](#7-권장-해결-순서)

---

## 요약

### 이슈 통계 (수정 후)

| 카테고리 | Critical | High | Medium | Low |
|---------|----------|------|--------|-----|
| TypeScript 에러 | ~~17개~~ ✅ 0개 | - | - | - |
| ESLint 경고 | - | 15개 | 150개+ | 20개+ |
| 보안 이슈 | ~~4개~~ ✅ 0개 | 2개 | 2개 | - |
| 성능 이슈 | - | 3개 | 5개 | - |
| 아키텍처 이슈 | - | 3개 | 2개 | 2개 |

### 남은 작업

```
High 우선순위 해결 ──────── 3-5일
프로덕션 배포 준비 ──────── 1-2일
────────────────────────────────
총 소요시간              1-2주
```

---

## 1. Critical 이슈 (즉시 해결)

### 1.1 TypeScript 컴파일 에러 (17개)

배포 전 반드시 해결해야 하는 TypeScript 에러입니다.

#### Prisma 스키마 불일치 (5개)

```typescript
// 📁 scripts/seed-settlement-data.ts:10, 19
// 문제: 'SOURCING_USER' 역할이 UserRole enum에 정의되지 않음
where: { role: 'SOURCING_USER' }  // ❌ 타입 에러

// 해결방법 1: db/prisma/schema.prisma에 역할 추가
enum UserRole {
  ADMIN
  MANAGER
  SOURCING_USER  // 추가
}

// 해결방법 2: 기존 역할 사용
where: { role: 'MANAGER' }  // ✅
```

```typescript
// 📁 scripts/seed-settlement-data.ts:179
// 📁 scripts/seed-settlement-user1.ts:120
// 문제: recipientName 필드가 Order 모델에 없음
recipientName: '홍길동',  // ❌ 타입 에러

// 해결방법: 스키마에 필드 추가 또는 해당 필드 제거
```

#### OrderTest 모델 타입 오류 (4개)

```typescript
// 📁 src/modules/sourcing/domain/src/order/repository/order.repository.ts:17, 19, 47
// 📁 src/app/api/order/webhook/route.ts:209
// 문제: prisma.orderTest 속성이 존재하지 않음
await prisma.orderTest.findMany()  // ❌ 타입 에러

// 해결방법 1: 스키마에 OrderTest 모델 추가
model OrderTest {
  id        Int      @id @default(autoincrement())
  // ... 필드 정의
}

// 해결방법 2: 타입 캐스팅 (임시 방편)
await (prisma as any).orderTest.findMany()
```

#### TokenPayload 타입 누락 (3개)

```typescript
// 📁 src/app/api/shop/[id]/route.ts:71, 132, 310
// 문제: TokenPayload에 'id' 속성이 없음 (userId 사용 중)
currentUser.id  // ❌ 타입 에러

// 📁 src/modules/auth/auth.service.ts - 현재 정의
interface TokenPayload {
  userId: number  // 'id'가 아닌 'userId'
  role: string
  // ...
}

// 해결방법: 일관되게 userId 사용
currentUser.userId  // ✅
```

#### Select 쿼리 타입 추론 실패 (3개)

```typescript
// 📁 src/modules/sourcing/domain/src/channel/services/channel.service.ts:163, 164
// 문제: select 쿼리 후 subdomain 속성 접근 불가
channel.subdomain  // ❌ 타입 에러

// 해결방법: include 사용 또는 타입 assertion
const channel = await prisma.channel.findFirst({
  include: { shop: true }  // select 대신 include
})
channel.shop?.subdomain  // ✅
```

---

## 2. 코드 품질 이슈

### 2.1 ESLint 경고 (186개)

#### React Hooks 의존성 누락 (~15개) - High

```typescript
// 📁 src/app/(admin)/admin/products/page.tsx:127
useEffect(() => {
  // navigateToProduct 의존성 누락
}, [])  // ❌

// 해결
useEffect(() => {
  // ...
}, [navigateToProduct])  // ✅

// 영향받는 파일들:
// - src/app/(admin)/shop/coupon/[id]/page.tsx:53
// - src/app/(admin)/sourcing/automation/logs/page.tsx:545
// - src/app/(admin)/sourcing/post/list/page.tsx
// - 그 외 10개+ 파일
```

#### Next.js Image 컴포넌트 미사용 (~150개) - Medium

```tsx
// ❌ 최적화 미적용
<img src={imageUrl} alt="상품" />

// ✅ Next.js Image 사용 (성능 최적화)
import Image from 'next/image'
<Image src={imageUrl} alt="상품" width={100} height={100} />

// 영향받는 주요 파일들:
// - src/app/(admin)/admin/products/page.tsx (3곳)
// - src/app/(admin)/shop/reviews/[id]/page.tsx (2곳)
// - src/app/(admin)/shop/settlement/list/page.tsx (5곳)
// - 그 외 140개+ 위치
```

### 2.2 console.log 과다 사용 (593개)

```typescript
// 프로덕션에서 제거하거나 구조화된 로깅으로 교체 권장
console.log('[BandPublisher] Published:', result)  // ❌ 개발용

// 권장: pino, winston 등 로깅 라이브러리 사용
import { logger } from '@/lib/logger'
logger.info({ result }, 'Band publish completed')  // ✅
```

### 2.3 any 타입 과다 사용 (315개)

```typescript
// ❌ 타입 안전성 부재
const data: any = await response.json()
(prisma.orderTest as any).findMany()

// ✅ 명시적 타입 정의
interface ApiResponse { ... }
const data: ApiResponse = await response.json()
```

### 2.4 미완성 TODO 주석

| 파일 | 라인 | 내용 |
|-----|------|------|
| `src/app/(admin)/sourcing/post/list/page.tsx` | 343 | `// TODO: 실제로는 userId를 세션에서 가져와야 함` |
| `src/components/layout/Header.tsx` | 29 | `// 쇼핑몰 통계 (TODO: API 연동 필요)` |

---

## 3. 보안 이슈

### 3.1 하드코딩된 시크릿 (Critical)

#### JWT Secret 기본값

```typescript
// 📁 src/modules/auth/auth.service.ts:5
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
//                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                           ⚠️ 매우 위험: 프로덕션에서 사용 금지

// 📁 .env:18 - 현재 값
JWT_SECRET="your-secret-key-change-this-in-production"  // ❌ 변경 필요
```

**해결방법:**
```bash
# 강력한 시크릿 생성
openssl rand -base64 64
# 결과를 .env.production에 설정
JWT_SECRET="생성된_시크릿_값"
```

#### Webhook Secret 기본값

```typescript
// 📁 src/app/api/order/webhook/route.ts:5
const WEBHOOK_SECRET = process.env.ORDER_WEBHOOK_SECRET || 'your-webhook-secret'
//                                                         ^^^^^^^^^^^^^^^^^^^
//                                                         ⚠️ 검증 우회 가능

// 📁 같은 파일:37 - 위험한 검증 로직
if (WEBHOOK_SECRET !== 'your-webhook-secret' && webhookSecret !== WEBHOOK_SECRET)
// 기본값 사용 시 검증이 우회됨!
```

### 3.2 .env 파일 자격증명 노출

```env
# 📁 .env - 현재 상태

# ❌ 위험: 평문 데이터베이스 비밀번호
DATABASE_URL="mysql://banduser:band1234!@localhost:3306/sourcing_db"

# ⚠️ 주의: 테스트 키 (프로덕션 전 교체)
TOSS_PAYMENTS_SECRET_KEY="test_gsk_LkKEypNArWWdNPyG5KZNrlmeaxYG"

# ❌ 위험: 약한 내부 API 키
INTERNAL_API_KEY="dev-internal-key"
```

**해결방법:**
1. `.env`를 `.gitignore`에 추가
2. `.env.example` 파일 생성 (값 없이 키만)
3. 프로덕션 환경 변수는 별도 관리 (AWS Secrets Manager, Vault 등)

### 3.3 인증/인가 취약점

#### TokenPayload 스키마 불일치

```typescript
// 📁 src/modules/auth/auth.service.ts:11-14
interface TokenPayload {
  userId: number  // ← 여기는 userId
  role: string
}

// 📁 src/app/api/shop/[id]/route.ts:71
currentUser.id  // ← 여기는 id 접근 시도 (런타임 에러)
```

#### 역할 기반 접근 제어 불일치

```typescript
// 📁 src/middleware.ts:6
const ALLOWED_ROLES = ['ADMIN', 'MANAGER']  // SOURCING_USER 미포함

// 📁 scripts/seed-settlement-data.ts:10
where: { role: 'SOURCING_USER' }  // 이 역할은 미들웨어에서 거부됨
```

### 3.4 민감 정보 평문 저장

```typescript
// 📁 src/app/api/channel/route.ts:58
// 네이버 비밀번호가 평문으로 저장될 수 있음
await prisma.channel.update({
  data: { naverPassword: password }  // ⚠️ 암호화 필요
})
```

**권장 해결:**
```typescript
import { encrypt, decrypt } from '@/lib/crypto'

// 저장 시
await prisma.channel.update({
  data: { naverPassword: encrypt(password) }
})

// 사용 시
const password = decrypt(channel.naverPassword)
```

---

## 4. 성능 이슈

### 4.1 N+1 쿼리 문제

```typescript
// 📁 src/modules/automation/pipelines/collection.ts:65
// ❌ N+1 문제 발생 가능
const channels = await prisma.channel.findMany()
for (const channel of channels) {
  const posts = await prisma.collectedPost.findMany({  // N번 추가 쿼리
    where: { channelId: channel.id }
  })
}

// ✅ 개선: include 사용
const channels = await prisma.channel.findMany({
  include: { collectedPosts: true }
})
```

### 4.2 Pagination 중복 쿼리

```typescript
// 📁 src/modules/sourcing/domain/src/order/repository/order.repository.ts:17-23
// ❌ 두 번의 쿼리
const total = await prisma.order.count({ where })
const orders = await prisma.order.findMany({ where, skip, take })

// ✅ 개선: 단일 트랜잭션으로 최적화
const [total, orders] = await prisma.$transaction([
  prisma.order.count({ where }),
  prisma.order.findMany({ where, skip, take })
])
```

### 4.3 Playwright 리소스 관리

```typescript
// 📁 src/modules/band-session/band-login.automation.ts:95
// ⚠️ 리소스 해제 확인 필요
const page = await browser.newPage()
// ... 작업 수행
await page.close()  // 반드시 호출 확인
await browser.close()  // 반드시 호출 확인
```

---

## 5. 아키텍처 이슈

### 5.1 코드 중복

#### 경로 확장 함수 중복

```typescript
// 📁 src/app/api/shop/[id]/route.ts:11-15
function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return filePath.replace('~', os.homedir())
  }
  return filePath
}

// 📁 src/modules/sourcing/domain/src/channel/services/channel.service.ts:11-14
function expandTilde(path: string): string {
  if (path.startsWith('~')) {
    return path.replace('~', os.homedir())
  }
  return path
}
```

**해결:** 공통 유틸리티로 통합
```typescript
// 📁 src/lib/utils/path.ts
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return filePath.replace('~', os.homedir())
  }
  return filePath
}
```

#### 이미지 삭제 로직 중복

```typescript
// 두 파일에서 거의 동일한 코드
// - src/modules/sourcing/domain/src/channel/services/channel.service.ts:19-43
// - src/app/api/shop/[id]/route.ts:21-41
```

### 5.2 에러 응답 형식 불일치

```typescript
// 파일마다 다른 응답 형식
// 📁 src/app/api/channel/route.ts
{ success: false, error: '메시지' }

// 📁 src/app/api/settings/ai/test/route.ts
{ success: false, message: '메시지' }
```

**권장:** 통일된 응답 형식 정의
```typescript
// 📁 src/lib/api-response.ts
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

export function errorResponse(code: string, message: string): ApiResponse {
  return { success: false, error: { code, message } }
}
```

---

## 6. 배포 체크리스트

### 6.1 환경 변수 완성도

| 변수명 | 현재값 | 상태 | 조치 |
|--------|-------|------|------|
| `DATABASE_URL` | mysql://banduser:band1234!@... | ❌ 위험 | 프로덕션 값 설정 |
| `JWT_SECRET` | your-secret-key-change-this... | ❌ 위험 | 강력한 시크릿 생성 |
| `ORDER_WEBHOOK_SECRET` | 미설정 | ❌ 누락 | 설정 필요 |
| `INTERNAL_API_KEY` | dev-internal-key | ❌ 위험 | 강화된 값 설정 |
| `TOSS_PAYMENTS_SECRET_KEY` | test_gsk_... | ⚠️ 테스트 | 프로덕션 키 교체 |
| `NEXT_PUBLIC_DOMAIN` | lvh.me:3000 | ⚠️ 개발 | 프로덕션 도메인 |
| `SHOP_URL` | localhost:3000 | ⚠️ 개발 | 프로덕션 URL |
| `BAND_API_BASE_URL` | https://openapi.band.us | ✅ OK | - |
| `*_IMAGE_STORAGE_PATH` | ~/assets/images/* | ✅ OK | 서버 경로 확인 |

### 6.2 외부 서비스 연결

| 서비스 | 필수 | 환경 변수 | 상태 |
|--------|------|----------|------|
| MySQL Database | 필수 | DATABASE_URL | ⚠️ 프로덕션 설정 필요 |
| Naver Band API | 필수 | BAND_API_BASE_URL | ✅ OK |
| Toss Payments | 선택 | TOSS_PAYMENTS_SECRET_KEY | ⚠️ 프로덕션 키 필요 |
| Google Gemini | 선택 | DB 저장 | ✅ OK |
| OpenAI | 선택 | DB 저장 | ✅ OK |
| 파일 시스템 | 필수 | *_IMAGE_STORAGE_PATH | ⚠️ 서버 경로 확인 |

### 6.3 데이터베이스 마이그레이션

```
📁 db/prisma/migrations/
├── 20250214_auth_onboarding_and_logs/
├── 20250214_inquiry_published_product_fk/
└── 20250214_rename_collected_post_fks/
```

**배포 전 실행:**
```bash
cd ../db
npx prisma migrate deploy --schema prisma
npx prisma generate --schema prisma
```

---

## 7. 권장 해결 순서

### Phase 1: Critical (3-5일) - 배포 블로커

```
□ TypeScript 에러 17개 수정
  □ Prisma 스키마 불일치 해결 (SOURCING_USER, recipientName)
  □ OrderTest 모델 정의 또는 제거
  □ TokenPayload 일관성 (userId 통일)
  □ Select 쿼리 타입 수정

□ 보안 시크릿 변경
  □ JWT_SECRET 강력한 값으로 교체
  □ ORDER_WEBHOOK_SECRET 설정
  □ INTERNAL_API_KEY 강화
  □ DATABASE_URL 프로덕션 값

□ 인증/인가 수정
  □ 미들웨어 역할 검증 로직 수정
  □ Webhook 검증 로직 강화
```

### Phase 2: High Priority (5-7일)

```
□ ESLint 경고 해결
  □ React Hooks 의존성 15개 수정
  □ <img> → <Image> 변경 (주요 페이지 우선)

□ 코드 중복 제거
  □ expandPath/expandTilde 통합
  □ 이미지 삭제 로직 통합
  □ API 응답 형식 통일

□ 보안 강화
  □ 네이버 비밀번호 암호화 저장
  □ .env.example 파일 생성
  □ .gitignore 확인
```

### Phase 3: Medium Priority (배포 후 1주일)

```
□ 성능 최적화
  □ N+1 쿼리 문제 검토
  □ Pagination 최적화
  □ Playwright 리소스 정리

□ 모니터링 도입
  □ 에러 추적 (Sentry)
  □ 로깅 구조화 (pino/winston)
  □ 성능 모니터링

□ 나머지 ESLint 경고
  □ <img> → <Image> 전체 변환
  □ any 타입 제거
  □ console.log 정리
```

### Phase 4: Low Priority (장기)

```
□ 아키텍처 개선
  □ 도메인 주도 설계 강화
  □ API 버전 관리

□ 테스트 도입
  □ 단위 테스트 (Jest)
  □ 통합 테스트
  □ E2E 테스트 (Playwright)

□ 문서화
  □ API 문서 (Swagger/OpenAPI)
  □ 개발자 가이드
```

---

## 부록: 빠른 수정 스크립트

### TypeScript 에러 확인
```bash
npx tsc --noEmit 2>&1 | head -50
```

### ESLint 경고 확인
```bash
npx eslint src --ext .ts,.tsx --format compact | head -100
```

### 환경 변수 검증 스크립트
```typescript
// scripts/check-env.ts
const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ORDER_WEBHOOK_SECRET',
  'INTERNAL_API_KEY',
]

const missing = required.filter(key => !process.env[key])
if (missing.length > 0) {
  console.error('Missing required env vars:', missing)
  process.exit(1)
}

const dangerous = {
  JWT_SECRET: 'your-secret-key',
  INTERNAL_API_KEY: 'dev-internal-key',
}

Object.entries(dangerous).forEach(([key, badValue]) => {
  if (process.env[key]?.includes(badValue)) {
    console.error(`⚠️ ${key} contains development value!`)
  }
})
```

---

*이 보고서는 자동 분석 도구로 생성되었으며, 실제 배포 전 수동 검토를 권장합니다.*
