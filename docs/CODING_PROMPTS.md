# BandAuto - VSCode 코딩 프롬프트 가이드

> To-Do List 70개 항목 기반 | 실행 주체별 분류 | 2026-04-02

---

## 사용법

VSCode 터미널에서 Claude Code를 실행하고, 아래 프롬프트를 복사-붙여넣기 하세요.
각 프롬프트는 독립적으로 실행 가능하며, Week 순서대로 진행하는 것을 권장합니다.

---

## WEEK 1 — 긴급 보안 패치 + 기초 인프라

### [S-01] create-admin API 인증 미들웨어 추가 `프로그램 자동`

```
sourcing-app/src/app/api/admin/create-admin/route.ts 파일에
NextAuth getServerSession 인증 미들웨어를 추가해줘.
import { getServerSession } from "next-auth"와 authOptions를 사용해서
ADMIN 역할의 사용자만 접근 가능하도록 수정.
미인증 → 401 Unauthorized, 권한 부족 → 403 Forbidden 반환.
```

### [S-02] 환경변수 fallback 개발키 제거 `프로그램 자동`

```
프로젝트 전체(shop-app, sourcing-app)에서
process.env.XXX || "dev_key" 또는 process.env.XXX ?? "default_secret"
같은 fallback 패턴을 Grep으로 검색해서,
환경변수가 없을 때 개발 키로 fallback하는 코드를 모두 찾아.
각각에 대해 fallback 값을 제거하고,
환경변수가 없으면 throw new Error("XXX 환경변수가 설정되지 않았습니다")로 변경해줘.
```

### [S-03] 이미지 도메인 와일드카드 정리 `프로그램 자동`

```
shop-app/next.config.js와 sourcing-app/next.config.js에서
images.remotePatterns 설정을 확인해줘.
와일드카드(*)로 설정된 도메인을 다음 실 사용 도메인으로 교체:
- band.us (밴드 이미지)
- ssl.pstatic.net (네이버 프로필)
- tosspayments.com (결제)
- lh3.googleusercontent.com (구글 프로필)
```

### [S-04] .env 파일 Git 추적 제거 확인 `프로그램 자동`

```
.gitignore 파일에 .env, .env.local, .env.*.local,
.env.development, .env.production이 포함되어 있는지 확인하고,
없으면 추가해줘.
git ls-files --cached -z | xargs -0 -I {} sh -c 'echo "{}"' | grep -i "\.env"
로 현재 추적 중인 .env 파일이 있는지도 확인해줘.
```

### [C-01] Health Check API 추가 `프로그램 자동`

```
shop-app/src/app/api/health/route.ts와
sourcing-app/src/app/api/health/route.ts를 생성해줘.
GET 요청에 대해 다음 JSON을 반환:
{
  status: "healthy" | "unhealthy",
  timestamp: ISO 문자열,
  db: "connected" | "disconnected",
  redis: "connected" | "disconnected" (sourcing-app만),
  version: process.env.APP_VERSION || "dev"
}
DB 연결은 prisma.$queryRaw`SELECT 1`로 확인.
Redis는 redis.ping()으로 확인.
에러 발생 시 status 503 반환.
```

---

## WEEK 2 — CI/CD + 코드 품질 기반 구축

### [S-05] API Rate Limiting 적용 `에이전트 팀: Security Agent`

```
sourcing-app/src/lib/rate-limiter.ts 파일을 새로 만들어줘.
Redis 기반 슬라이딩 윈도우 Rate Limiter:

설정값:
- API 일반: 분당 100회
- 인증 관련: 5분간 5회
- 결제 관련: 분당 10회
- 파일 업로드: 분당 5회

그리고 sourcing-app/src/middleware.ts와
shop-app/src/middleware.ts에서
요청 경로에 따라 적절한 rate limit을 적용하는 미들웨어를 추가해줘.
제한 초과 시 429 Too Many Requests 반환.
```

### [S-06] CORS 정책 강화 `프로그램 자동`

```
shop-app/next.config.js와 sourcing-app/next.config.js의
headers() 설정에서 Access-Control-Allow-Origin을 다음으로 제한:
- production: ["https://bandauto.com", "https://hublink.im"]
- development: 추가로 ["http://localhost:3000", "http://localhost:3001"]
NODE_ENV로 분기해줘.
```

### [S-07] JWT 토큰 만료 시간 설정 확인 `프로그램 자동`

```
sourcing-app/src/modules/auth/auth.config.ts에서
jwt.maxAge가 1800 (30분)으로,
session.maxAge가 604800 (7일)로 설정되어 있는지 확인하고,
다르면 수정해줘.
shop-app도 동일하게 확인해줘.
```

### [C-03] CI 검증 워크플로우 작성 `에이전트 팀: DevOps Agent`

```
.github/workflows/ci.yml 파일을 생성해줘.
트리거: pull_request (develop, main 브랜치 대상)

Jobs:
1. lint: pnpm run lint
2. typecheck: pnpm run typecheck (현재는 에러 무시, Phase 2부터 strict)
3. build: pnpm run build:all
4. test: pnpm test (테스트 작성 후 활성화)

pnpm/action-setup@v2, actions/setup-node@v4,
actions/cache@v3 (pnpm store 캐싱) 사용.
Node.js 20.x, pnpm 9.15.9.
```

### [C-04] GHCR Docker 이미지 빌드 파이프라인 `에이전트 팀: DevOps Agent`

```
.github/workflows/build-images.yml 파일을 생성해줘.
트리거: develop 브랜치 push

Steps:
1. GHCR 로그인 (ghcr.io, GITHUB_TOKEN)
2. shop-app Docker 이미지 빌드 + push
   태그: ghcr.io/abc-group-tech/bandauto-shop:${{ github.sha }}
3. sourcing-app Docker 이미지 빌드 + push
   태그: ghcr.io/abc-group-tech/bandauto-sourcing:${{ github.sha }}
4. latest 태그도 함께 push
```

### [Q-01] TypeScript strict 모드 단계적 적용 `에이전트 팀: QA Agent`

```
shop-app/tsconfig.json과 sourcing-app/tsconfig.json에서
Phase 1로 strictNullChecks: true를 설정해줘.
그리고 빌드해서 에러가 나는 파일 목록을 알려줘.
각 에러에 대해 optional chaining(?.)이나
nullish coalescing(??)로 수정하는 것이 적절한지 판단해서
자동 수정해줘.
```

### [Q-02] console.log 정리 (1,086개) `프로그램 자동`

```
shop-app/src와 sourcing-app/src에서
console.log를 모두 검색해서:
1. catch 블록 안의 console.error → 유지 (나중에 logger로 교체)
2. 디버그/개발용 console.log → 삭제
3. 중요 정보성 console.log → 주석 처리 (// TODO: logger.info로 교체)

삭제 전후 개수를 알려줘.
```

### [Q-04] ESLint 규칙 강화 `에이전트 팀: QA Agent`

```
프로젝트 루트와 각 앱의 .eslintrc.json에서
다음 규칙을 추가/강화해줘:
- @typescript-eslint/no-explicit-any: "warn" (Phase 1)
- @typescript-eslint/no-unused-vars: "error"
- no-console: ["warn", { allow: ["error", "warn"] }]
- eqeqeq: "error"
- curly: "error"

그리고 pnpm run lint를 실행해서
자동 수정 가능한 것들은 --fix로 수정해줘.
```

### [D-01] 인덱스 최적화 `에이전트 팀: DB Agent`

```
db/prisma/models/ 폴더의 모든 .prisma 파일을 분석해서
자주 조회되는 패턴에 맞는 복합 인덱스를 추가해줘.

특히:
- Product 모델: channelId+deletedAt, status+createdAt, shopId+isPublished
- Order 모델: userId+status, createdAt, paymentStatus+createdAt
- User 모델: email, role+deletedAt
- Payment 모델: orderId, status+createdAt

@@index 어노테이션으로 추가하고,
npx prisma validate --schema prisma로 검증해줘.
```

### [D-05] 커넥션 풀 최적화 `에이전트 팀: DB Agent`

```
db/prisma/schema.prisma의 datasource db 블록에서
connection_limit 파라미터를 설정해줘.
개발: connection_limit=5
프로덕션: connection_limit=10

DATABASE_URL에 ?connection_limit=10&pool_timeout=10 추가.
Prisma Client의 $disconnect() 호출도 확인해줘.
```

### [I-01] Docker Compose 최적화 `에이전트 팀: DevOps Agent`

```
docker-compose.yml을 최적화해줘:
1. GHCR 이미지 사용으로 전환 (로컬 빌드 대신)
   image: ghcr.io/abc-group-tech/bandauto-shop:latest
2. healthcheck 추가 (각 서비스에 /api/health 체크)
3. restart: unless-stopped 설정
4. 리소스 제한 (deploy.resources.limits)
5. 로그 로테이션 설정 (json-file, max-size: 10m, max-file: 3)
6. .env.production 파일 참조로 env 정리
```

### [I-03] Redis 영속성 설정 `에이전트 팀: DevOps Agent`

```
docker-compose.yml의 redis 서비스에
appendonly yes 옵션을 추가하고,
redis 데이터 볼륨을 영속적으로 마운트해줘.
volumes: - redis_data:/data
command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### [DOC-02] 개발 환경 설정 가이드 `에이전트 팀: Content Agent`

```
프로젝트 루트에 docs/DEVELOPMENT.md 파일을 생성해줘.
내용:
1. 필수 요구사항 (Node 20, pnpm 9.15, Docker, MariaDB, Redis)
2. 저장소 클론 및 의존성 설치
3. 환경변수 설정 (.env.example 기반)
4. DB 마이그레이션 실행
5. 개발 서버 실행 방법
6. 테스트 실행 방법
7. Docker 기반 전체 실행
8. 트러블슈팅 FAQ
```

### [M-01] 로깅 시스템 구축 `에이전트 팀: Analytics Agent`

```
sourcing-app/src/lib/logger.ts 파일을 생성해줘.
winston + winston-daily-rotate-file 사용:

import winston from "winston";
import "winston-daily-rotate-file";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.DailyRotateFile({
      dirname: "logs",
      filename: "%DATE%.log",
      maxFiles: "7d",
      maxSize: "20m"
    })
  ]
});

export { logger };

shop-app/src/lib/logger.ts에도 동일하게 생성해줘.
package.json에 winston, winston-daily-rotate-file를 추가해줘.
```

---

## WEEK 3 — 비즈니스 로직 안정화

### [Q-03] any 타입 해소 (370개) `에이전트 팀: QA Agent`

```
sourcing-app/src/modules/ 폴더에서 any 타입을 사용하는 곳을 찾아서
적절한 타입으로 교체해줘.

타입 교체 전략:
1. Prisma 자동 생성 타입 활용: import { Product, Order, User } from "@bandauto/db"
2. API 응답: interface ApiResponse<T> { data: T; error?: string }
3. 이벤트 핸들러: React.ChangeEvent<HTMLInputElement> 등
4. 외부 라이브러리: @types 패키지 설치 또는 declare module

우선 가장 많이 사용되는 상위 20개 파일부터 시작해줘.
```

### [Q-05] 에러 핸들링 표준화 `에이전트 팀: QA Agent`

```
sourcing-app/src/lib/errors.ts 파일을 새로 만들어줘.

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR",
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource}을(를) 찾을 수 없습니다`, 404, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor() { super("인증이 필요합니다", 401, "UNAUTHORIZED"); }
}

export class ForbiddenError extends AppError {
  constructor() { super("권한이 없습니다", 403, "FORBIDDEN"); }
}

export class ValidationError extends AppError {
  constructor(message: string) { super(message, 400, "VALIDATION_ERROR"); }
}

그리고 API 라우트에서 try-catch + AppError 패턴을 적용하는
공통 핸들러 함수 withErrorHandler()도 만들어줘.
```

### [D-02] Soft Delete 미적용 테이블 수정 `에이전트 팀: DB Agent`

```
db/prisma/models/ 폴더의 모든 .prisma 모델에서
deletedAt DateTime? 필드가 없는 테이블을 찾아줘.
중요 테이블(Product, Order, User, Channel, Shop 등)에
deletedAt 필드를 추가하고,
Prisma Middleware로 자동 soft delete 필터링을 구현해줘.

db/prisma/middleware.ts:
prisma.$use(async (params, next) => {
  if (params.action === "delete") {
    params.action = "update";
    params.args.data = { deletedAt: new Date() };
  }
  if (params.action === "findMany" || params.action === "findFirst") {
    if (!params.args.where) params.args.where = {};
    params.args.where.deletedAt = null;
  }
  return next(params);
});
```

### [B-01] 결제 모듈 안정화 `에이전트 팀: Commerce Agent`

```
shop-app/src/modules/payment/ 폴더의 결제 플로우를 분석해줘.

확인 사항:
1. 토스페이먼츠 결제 요청 → 승인 → 확인 흐름이 완전한지
2. 결제 실패 시 주문 상태가 올바르게 롤백되는지
3. 부분 환불 로직이 구현되어 있는지
4. 중복 결제 방지 (idempotency key) 가 적용되어 있는지
5. 모든 결제 관련 DB 작업에 트랜잭션이 적용되어 있는지

문제가 있는 부분을 수정하고, 각 수정 사항을 알려줘.
```

### [B-02] 주문 상태 머신 검증 `에이전트 팀: Commerce Agent`

```
주문 상태 전이가 올바른지 검증해줘.
허용되는 상태 전이:
PENDING → PAID → PREPARING → SHIPPED → DELIVERED
PENDING → CANCELLED
PAID → REFUND_REQUESTED → REFUNDED
SHIPPED → RETURN_REQUESTED → RETURNED

잘못된 상태 전이를 방지하는 validateOrderTransition() 함수를 만들고,
주문 상태 변경 API에서 이 함수를 호출하도록 수정해줘.
```

### [B-03] 정산 로직 정확성 검증 `에이전트 팀: Commerce Agent`

```
sourcing-app/src/modules/settlement/ 폴더의 정산 로직을 분석해줘.

검증 사항:
1. 정산 금액 = 판매가 - 수수료 - 환불액이 정확한지
2. 수수료율이 올바르게 적용되는지 (소싱가 대비 마진율)
3. 환불 건이 정산에서 올바르게 차감되는지
4. 정산 기간 (월 단위) 계산이 정확한지
5. 소수점 처리 (원 단위 반올림)

테스트 케이스도 함께 작성해줘.
```

### [T-01] E2E 테스트 시나리오 작성 `에이전트 팀: QA Agent`

```
tests/e2e/ 폴더에 Playwright E2E 테스트를 작성해줘.

1. tests/e2e/shop-auth.spec.ts
   - 회원가입 → 이메일 인증 → 로그인 → 마이페이지 접근

2. tests/e2e/shop-product.spec.ts
   - 상품 목록 조회 → 상품 상세 → 장바구니 담기

3. tests/e2e/sourcing-pipeline.spec.ts
   - 관리자 로그인 → 채널 목록 → 상품 수집 시작

4. tests/e2e/admin-agents.spec.ts
   - 관리자 로그인 → 에이전트 대시보드 → 에이전트 활성화/비활성화

playwright.config.ts도 생성해줘:
baseURL shop: http://localhost:3000
baseURL sourcing: http://localhost:3001
```

### [T-02] 결제 플로우 통합 테스트 `에이전트 팀: QA Agent`

```
tests/e2e/shop-payment.spec.ts를 작성해줘.
토스페이먼츠 테스트 모드를 사용해서:
1. 상품 장바구니 → 주문서 작성 → 결제 요청
2. 테스트 카드로 결제 승인
3. 주문 완료 페이지 확인
4. 주문 내역에 표시 확인
5. 관리자 대시보드에 주문 표시 확인
```

### [DOC-01] API 문서 자동 생성 `에이전트 팀: Content Agent`

```
sourcing-app/docs/API.md 파일을 업데이트해줘.
src/app/api/ 폴더의 모든 route.ts 파일을 스캔해서
각 API 엔드포인트의 정보를 추출:
- HTTP Method
- 경로
- 요청 파라미터 (query, body)
- 응답 형식
- 인증 필요 여부

Markdown 표 형식으로 정리해줘.
```

### [M-02] 에러 추적 시스템 도입 `에이전트 팀: Analytics Agent`

```
sourcing-app/src/lib/error-tracker.ts를 생성해줘.
에러 발생 시:
1. logger.error()로 로그 기록
2. 에러 카운트 Redis에 집계 (에러 타입별)
3. 1분 내 동일 에러 5회 이상 → 알림 발송
4. 에러 상세 정보를 DB에 저장 (최근 1000건 보관)

API 라우트의 global error handler에서 자동 호출되도록 통합.
```

---

## WEEK 4 — HubLink 연동 + 고급 기능

### [B-04] 소싱 파이프라인 안정화 `에이전트 팀: Commerce Agent`

```
sourcing-app/src/modules/automation/ 폴더의
파이프라인(수집 → AI 가공 → 발행) 흐름을 분석하고:
1. Playwright 수집 실패 시 재시도 로직 (3회, 지수 백오프)
2. Gemini AI 가공 실패 시 fallback 처리
3. 밴드 발행 실패 시 큐에 재등록
4. 각 단계별 진행 상태 DB 기록
5. 전체 파이프라인 타임아웃 설정 (30분)
```

### [H-01] Supabase Auth 브릿지 구현 `에이전트 팀`

```
sourcing-app/src/modules/auth/supabase-bridge.ts를 생성해줘.
BandAuto NextAuth 세션과 HubLink Supabase Auth 간 사용자 동기화:

1. BandAuto 사용자 가입/수정 시 → HubLink profiles 테이블에 upsert
2. HubLink 사용자 로그인 시 → BandAuto users 테이블 참조
3. @username 통합: 양쪽에서 동일한 사용자명 사용

환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY (서버사이드만)
```

### [H-02] @username 통합 체계 `에이전트 팀`

```
사용자명(@username) 예약어 검증을 양쪽 플랫폼에서 통합해줘.
1. Hub_Link/src/lib/usernameValidator.js의 예약어 목록 참조
2. BandAuto에서 사용자 생성 시 HubLink reserved words도 체크
3. HubLink에서 사용자 생성 시 BandAuto 사용자명 중복도 체크
4. 공통 API: /api/check-username?username=xxx (양쪽 DB 동시 조회)
```

### [D-04] 데이터 시드 스크립트 `에이전트 팀: DB Agent`

```
db/prisma/seed.ts 파일을 생성해줘.
개발/테스트용 시드 데이터:
1. 관리자 계정 1개 (ADMIN 역할)
2. 매니저 계정 2개 (MANAGER 역할)
3. 일반 사용자 5개
4. 채널 3개 (밴드 도매 채널)
5. 상품 20개 (다양한 카테고리)
6. 주문 10개 (다양한 상태)
7. 에이전트 정의 17개 (HubLink 에이전트)

npx prisma db seed --schema prisma로 실행 가능하도록
package.json에 prisma.seed 설정도 추가해줘.
```

---

## WEEK 5+ — 통합 테스트 + 런칭 준비

### [T-04] 부하 테스트 환경 구축 `에이전트 팀: QA Agent`

```
k6 또는 Artillery 기반 부하 테스트 스크립트를 작성해줘.
tests/load/ 폴더에:

1. shop-load.js: 상품 목록 → 상세 → 장바구니 시뮬레이션
   목표: 동시 100명, 평균 응답 500ms 이내
2. api-load.js: API 엔드포인트 부하 테스트
   목표: 초당 200 요청 처리

결과 리포트를 HTML로 출력하도록 설정.
```

### [H-03] API Gateway 프록시 설정 `에이전트 팀`

```
HubLink(hublink.im)에서 BandAuto API를 호출할 수 있도록
Vercel Serverless Function 기반 API 프록시를 설정해줘.

Hub_Link/api/bandauto-proxy.js:
- hublink.im/api/shop/* → BandAuto shop-app API 프록시
- 인증 토큰 검증 후 전달
- CORS 처리
- Rate Limiting
```

---

## 지속 관리 항목 (Ongoing)

### [Q-06] 코드 리뷰 프로세스 `사람+에이전트`

```
.github/CODEOWNERS 파일을 생성하고,
.github/pull_request_template.md도 만들어줘.

CODEOWNERS:
* @team-lead
shop-app/ @shop-team
sourcing-app/ @sourcing-team
db/ @db-admin

PR 템플릿:
## 변경 사항
## 테스트 결과
## 리뷰 체크리스트
- [ ] TypeScript 에러 없음
- [ ] 테스트 통과
- [ ] API 문서 업데이트 (해당 시)
```

### [M-05] 운영 모니터링 `에이전트 팀: Analytics Agent`

```
sourcing-app/src/app/api/admin/system/metrics/route.ts를 생성해줘.
Prometheus 형식의 메트릭 엔드포인트:
- http_requests_total (라벨: method, path, status)
- http_request_duration_seconds (히스토그램)
- active_connections
- db_query_duration_seconds
- agent_tasks_total (라벨: agent, status)
- agent_task_duration_seconds
```

### [DOC-04] 문서 유지 관리 `에이전트 팀: Content Agent`

```
소스 코드가 변경될 때마다 다음 문서를 자동 업데이트하는
스크립트를 scripts/update-docs.ts에 만들어줘:
1. API 엔드포인트 변경 → docs/API.md 업데이트
2. 컴포넌트 추가/삭제 → docs/FRONTEND.md 업데이트
3. DB 스키마 변경 → docs/DATABASE.md 업데이트
4. 파일 구조 변경 → docs/STRUCTURE.md 업데이트

Git pre-commit hook으로 자동 실행되도록 설정.
```

---

## 에이전트 관리 전용 프롬프트

> AGENT_ADMIN_SPEC.md 기반 | 5 Phase 구현 | 17개 에이전트 통합 관리
> 구현 순서: Phase 1(기반) → Phase 2(API) → Phase 3(UI) → Phase 4(런타임) → Phase 5(에이전트 구현)

---

### Phase 1: 기반 (3일)

#### [AG-01] 에이전트 Prisma 스키마 추가 `프로그램 자동`

```
db/prisma/models/agent.prisma 파일을 새로 만들어줘.
에이전트 관리에 필요한 5개 모델 + 6개 Enum:

Enum 정의:
- AgentLayer: CORE, BUSINESS, INTELLIGENCE
- AgentStatus: ACTIVE(정상 가동), INACTIVE(수동 중지), ERROR(오류), MAINTENANCE(유지보수)
- TaskStatus: QUEUED(대기), RUNNING(실행), COMPLETED(완료), FAILED(실패), CANCELLED(취소)
- TaskPriority: CRITICAL(즉시), HIGH, NORMAL, LOW
- LogLevel: DEBUG, INFO, WARN, ERROR, CRITICAL

모델 1 - AgentDefinition:
  id(cuid), name(String @unique), displayName(String), layer(AgentLayer),
  icon(String), description(String @db.Text), status(AgentStatus @default(INACTIVE)),
  config(Json), priority(Int @default(5)), maxConcurrent(Int @default(5)),
  retryPolicy(Json), schedule(String?), createdAt, updatedAt, deletedAt(DateTime?)
  relations: tasks(AgentTask[]), logs(AgentLog[]), kpiRecords(AgentKpiRecord[]),
             workflowSteps(AgentWorkflowStep[])
  @@index([layer, status]), @@index([name])
  @@map("agent_definitions")

모델 2 - AgentTask:
  id(cuid), agentId(String), agent(FK→AgentDefinition),
  eventType(String), payload(Json), status(TaskStatus @default(QUEUED)),
  priority(TaskPriority @default(NORMAL)), result(Json?), error(String? @db.Text),
  startedAt(DateTime?), completedAt(DateTime?), duration(Int?), retryCount(Int @default(0)),
  createdAt(DateTime @default(now()))
  @@index([agentId, status]), @@index([eventType, createdAt]),
  @@index([status, priority, createdAt])
  @@map("agent_tasks")

모델 3 - AgentLog:
  id(cuid), agentId(String), agent(FK→AgentDefinition),
  level(LogLevel @default(INFO)), message(String @db.Text), metadata(Json?),
  taskId(String?), createdAt(DateTime @default(now()))
  @@index([agentId, level, createdAt]), @@index([taskId])
  @@map("agent_logs")

모델 4 - AgentKpiRecord:
  id(cuid), agentId(String), agent(FK→AgentDefinition),
  metric(String), value(Float), target(Float), period(String), date(DateTime),
  createdAt(DateTime @default(now()))
  @@unique([agentId, metric, period, date])
  @@index([agentId, metric, date])
  @@map("agent_kpi_records")

모델 5 - AgentWorkflow:
  id(cuid), name(String), triggerEvent(String), isActive(Boolean @default(true)),
  config(Json), executionCount(Int @default(0)), lastExecuted(DateTime?),
  createdAt, updatedAt
  relations: steps(AgentWorkflowStep[])
  @@index([triggerEvent, isActive])
  @@map("agent_workflows")

모델 6 - AgentWorkflowStep:
  id(cuid), workflowId(String), workflow(FK→AgentWorkflow, onDelete: Cascade),
  agentId(String), agent(FK→AgentDefinition), order(Int),
  isParallel(Boolean @default(false)), config(Json?)
  @@index([workflowId, order])
  @@map("agent_workflow_steps")

생성 후 npx prisma validate --schema prisma로 검증해줘.
```

#### [AG-02] 에이전트 17개 시드 데이터 등록 `프로그램 자동`

```
db/prisma/seed-agents.ts 파일을 생성해줘.
17개 에이전트를 prisma.agentDefinition.upsert로 등록하는 스크립트.

CORE 레이어 (8개):
1. orchestrator - Orchestrator Agent (brain, priority:1, maxConcurrent:30)
   중앙 이벤트 라우팅, 워크플로우 관리, 에이전트 조율
   schedule: "*/1 * * * *", kpi: event_latency 500ms
   retryPolicy: { maxRetries:5, backoff:"exponential", delays:[1000,2000,4000,8000,16000] }

2. content - Content Agent (pen-tool, priority:2, maxConcurrent:5)
   콘텐츠 자동 생성 (프로필, 링크, 상품 설명)
   kpi: ai_utilization 60%, claude: { model:"sonnet", maxTokens:2000 }

3. analytics - Analytics Agent (bar-chart-2, priority:2, maxConcurrent:10)
   클릭/방문/전환 데이터 수집 및 분석
   schedule: "*/5 * * * *", kpi: data_accuracy 99%

4. revenue - Revenue Agent (dollar-sign, priority:2, maxConcurrent:3)
   수익 최적화, 가격 전략, 업셀 유도
   schedule: "0 0 * * *", kpi: monthly_revenue_growth 15%

5. growth - Growth Agent (trending-up, priority:3, maxConcurrent:5)
   사용자 성장, 이탈 방지, 리텐션 관리
   schedule: "0 9 * * *", kpi: churn_rate 5%

6. support - Support Agent (headphones, priority:3, maxConcurrent:5)
   고객 문의 자동 응답, 티켓 관리
   kpi: auto_resolve_rate 70%

7. moderation - Moderation Agent (shield, priority:1, maxConcurrent:10)
   스팸, 사기, 유해 콘텐츠 차단
   kpi: block_rate 99%, retryPolicy: { maxRetries:1, backoff:"none" }

8. notification - Notification Agent (bell, priority:2, maxConcurrent:20)
   멀티채널 알림 통합 (이메일, 푸시, SMS, 카카오)
   kpi: email_open_rate 25%, channels: ["email","push","sms","kakao","inapp"]

BUSINESS 레이어 (4개):
9. commerce - Commerce Agent (shopping-bag, priority:3, maxConcurrent:5)
   쇼핑몰 운영 자동화 (상품, 주문, 배송)
   kpi: order_processing_time 60000ms

10. affiliate - Affiliate Agent (link-2, priority:3, maxConcurrent:3)
    제휴 마케팅 자동화 (쿠팡, 아마존, ClickBank)
    kpi: monthly_affiliate_revenue 50000

11. sourcing - Sourcing Agent (package, priority:4, maxConcurrent:3)
    도매 상품 자동 수집, 변환, 등록 (SNS_AUTO 연동)
    kpi: automation_rate 70%, pipeline timeout: 30분

12. finance - Finance Agent (credit-card, priority:2, maxConcurrent:3)
    결제, 정산, 출금, 세금 관리 (토스페이먼츠)
    kpi: payment_success_rate 98%, retryPolicy: maxRetries:5

INTELLIGENCE 레이어 (5개):
13. recommendation - Recommendation Agent (target, priority:4, maxConcurrent:5)
    개인화 추천, A/B 테스트 엔진
    schedule: "0 * * * *", kpi: recommendation_ctr 20%

14. funnel - Funnel Agent (git-merge, priority:4, maxConcurrent:3)
    전환 퍼널 분석, CTA 최적화
    kpi: funnel_conversion 8%

15. brand - Brand Agent (palette, priority:5, maxConcurrent:2)
    브랜드 전략, 스타일, 콘텐츠 방향
    schedule: "0 0 * * 1", kpi: brand_consistency 80%

16. seo - SEO Agent (search, priority:3, maxConcurrent:5)
    검색 노출, 메타태그, 사이트맵, 구조화 데이터
    schedule: "0 */6 * * *", kpi: search_traffic_growth 15%

17. design - Design Agent (figma, priority:4, maxConcurrent:3)
    테마/레이아웃 생성, OG/썸네일, 브랜딩, UI 시스템
    kpi: theme_adoption 60%

모두 초기 status는 INACTIVE로 설정.
npx prisma db seed --schema prisma 실행 가능하도록
package.json에 prisma.seed 설정도 추가해줘.
```

#### [AG-03] 에이전트 네비게이션 메뉴 업데이트 `프로그램 자동`

```
sourcing-app/src/config/navigation.ts 파일에서
adminMenuItems의 "에이전트 팀" children을 다음으로 교체:

{
  label: "에이전트 관리",
  icon: "Bot",
  children: [
    { label: "대시보드", path: "/admin/agents/dashboard" },
    { label: "레지스트리", path: "/admin/agents/registry" },
    { label: "실시간 모니터링", path: "/admin/agents/monitor" },
    { label: "워크플로우", path: "/admin/agents/workflows" },
    { label: "KPI", path: "/admin/agents/kpi" },
    { label: "태스크", path: "/admin/agents/tasks" },
    { label: "로그", path: "/admin/agents/logs" },
    { label: "설정", path: "/admin/agents/settings" },
  ]
}
```

---

### Phase 2: API (3일)

#### [AG-04] 에이전트 CRUD API 라우트 생성 `에이전트 팀`

```
sourcing-app/src/app/api/admin/agents/ 폴더에
에이전트 CRUD API 라우트들을 생성해줘.
모든 API에 ADMIN 권한 검증 (getServerSession + authOptions) 적용.

1. route.ts → GET: 에이전트 목록
   Query params: layer?, status?, search?
   Response: {
     agents: AgentDefinition[],
     total: number,
     byLayer: { CORE: number, BUSINESS: number, INTELLIGENCE: number },
     byStatus: { ACTIVE: number, INACTIVE: number, ERROR: number }
   }

2. [id]/route.ts → GET: 에이전트 상세 + PATCH: 설정 변경
   GET Response: {
     agent: AgentDefinition,
     recentTasks: AgentTask[] (최근 10건),
     recentLogs: AgentLog[] (최근 20건),
     kpiSummary: { metric, current, target, achievement }[]
   }
   PATCH Body: { config?, priority?, maxConcurrent?, retryPolicy?, schedule? }
```

#### [AG-05] 에이전트 시작/중지/재시작 API `에이전트 팀`

```
sourcing-app/src/app/api/admin/agents/[id]/ 폴더에
에이전트 제어 API를 생성해줘:

1. start/route.ts → POST: 에이전트 활성화
   처리: DB status→ACTIVE, AgentRegistry 인스턴스 시작,
         EventBus 구독 시작, 스케줄 등록 (있는 경우)
   Response: { success: true, agent: AgentDefinition }

2. stop/route.ts → POST: 에이전트 비활성화
   처리: 실행 중 태스크 완료 대기 (30초 타임아웃),
         EventBus 구독 해제, 스케줄 제거, DB status→INACTIVE
   Response: { success: true, agent: AgentDefinition }

3. restart/route.ts → POST: 에이전트 재시작
   처리: stop() → start() 순차 실행
   Response: { success: true, agent: AgentDefinition }

모든 API에 ADMIN 권한 검증 적용.
```

#### [AG-06] 태스크/로그/KPI 조회 API `에이전트 팀`

```
sourcing-app/src/app/api/admin/agents/ 폴더에
데이터 조회 API를 생성해줘:

1. tasks/route.ts → GET: 태스크 목록
   Query: agentId?, status?, priority?, page=1, limit=20
   Response: { tasks, total, page, totalPages }
   include: { agent: { select: { name: true, displayName: true } } }

2. logs/route.ts → GET: 로그 조회
   Query: agentId?, level?, search?, page=1, limit=50
   Response: { logs, total, page, totalPages }
   search는 message 필드 contains 검색

3. kpi/route.ts → GET: KPI 데이터
   Query: agentId?, metric?, period=daily, startDate, endDate
   Response: {
     records: AgentKpiRecord[],
     summary: [{
       agentId, agentName,
       metrics: [{ metric, avg, target, trend: number[] }]
     }]
   }

모든 API에 ADMIN 권한 검증, 페이지네이션, 에러 핸들링 포함.
```

#### [AG-07] 대시보드 종합 통계 API `에이전트 팀`

```
sourcing-app/src/app/api/admin/agents/dashboard/route.ts를 생성해줘.

GET Response:
{
  overview: {
    totalAgents: 17,
    activeAgents: number,
    errorAgents: number,
    tasksToday: number,
    tasksCompleted: number,
    tasksFailed: number,
    avgLatency: number (ms),
    kpiAchievement: number (overall %)
  },
  byLayer: {
    CORE: { active: number, tasks: number, kpi: number },
    BUSINESS: { active: number, tasks: number, kpi: number },
    INTELLIGENCE: { active: number, tasks: number, kpi: number }
  },
  recentEvents: AgentEvent[] (최근 20건),
  alerts: [{
    agentId, agentName,
    type: "error" | "kpi_miss" | "high_latency",
    message: string
  }]
}

오늘 날짜 기준 데이터 집계.
alerts는 ERROR 상태 에이전트, KPI 70% 미달, 평균 지연 1초 초과 에이전트 포함.
```

#### [AG-08] SSE 실시간 이벤트 스트림 API `에이전트 팀`

```
sourcing-app/src/app/api/admin/agents/events/stream/route.ts를 생성해줘.

Server-Sent Events 방식으로 실시간 에이전트 이벤트를 스트리밍.
ReadableStream을 사용하여 구현.

이벤트 타입:
- agent.status.changed: { agentId, oldStatus, newStatus }
- agent.task.started: { taskId, agentId, eventType }
- agent.task.completed: { taskId, agentId, duration, success }
- agent.task.failed: { taskId, agentId, error }
- agent.kpi.updated: { agentId, metric, value, target }
- agent.alert: { agentId, type, message }

구현 핵심:
const stream = new ReadableStream({
  start(controller) {
    const subscriber = (event) => {
      controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
    };
    eventBus.subscribe("agent.*", subscriber);
    req.signal.addEventListener("abort", () => {
      eventBus.unsubscribe("agent.*", subscriber);
      controller.close();
    });
  }
});
return new Response(stream, {
  headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
});
```

#### [AG-09] 워크플로우 CRUD API `에이전트 팀`

```
sourcing-app/src/app/api/admin/agents/workflows/ 폴더에
워크플로우 관리 API를 생성해줘:

1. route.ts → GET: 워크플로우 목록 (isActive 필터)
   include: { steps: { include: { agent: true }, orderBy: { order: "asc" } } }

2. route.ts → POST: 워크플로우 생성
   Body: { name, triggerEvent, config, steps: [{ agentId, order, isParallel, config? }] }
   steps는 nested create로 함께 생성

3. [id]/route.ts → PATCH: 워크플로우 수정
   기존 steps 삭제 후 새 steps로 교체 (트랜잭션)

4. [id]/route.ts → DELETE: 워크플로우 삭제 (Soft Delete - deletedAt 아닌 isActive: false)

모든 API에 ADMIN 권한 검증 적용.
```

---

### Phase 3: UI (5일)

#### [AG-10] 에이전트 공통 컴포넌트 생성 `에이전트 팀`

```
sourcing-app/src/components/admin/agents/ 폴더에
다음 공통 컴포넌트들을 생성해줘:

1. AgentCard.tsx - 에이전트 카드
   Props: agent(AgentDefinition), onToggle(id→void), compact?(boolean)
   레이어별 색상: CORE(blue-50/blue-200), BUSINESS(purple-50/purple-200),
                  INTELLIGENCE(amber-50/amber-200)
   내용: 아이콘, displayName, description, 상태 토글, KPI 미니바, 태스크 수

2. AgentLayerSection.tsx - 레이어별 섹션
   Props: layer(string), agents(AgentDefinition[])
   레이어 이름 + 에이전트 수 헤더, 카드 그리드 (grid-cols-4)

3. StatusToggle.tsx - 상태 토글 스위치
   Props: checked(boolean), onChange(→void), loading?(boolean)
   ON/OFF 시각적 토글, 로딩 중 스피너 표시

4. MiniKpi.tsx - 미니 KPI 바
   Props: label(string), value(number), max?(number)
   가로 프로그레스바 + 퍼센트 표시
   색상: ≥100% 녹색, ≥70% 노란색, <70% 빨간색

5. RealtimeEventFeed.tsx - 실시간 이벤트 피드
   Props: events(AgentEvent[])
   시간, 에이전트명, 이벤트타입, 상태 아이콘 표시
   최대 50건 표시, 자동 스크롤

6. KpiChart.tsx - KPI 차트 (Recharts)
   Props: data(KpiData[]), period("daily"|"weekly"|"monthly")
   Recharts BarChart(가로): 에이전트별 달성률
   LineChart: 일별 추이
   색상: 100%+ 녹색, 70~99% 노란색, <70% 빨간색

7. WorkflowEditor.tsx - 워크플로우 편집기
   Props: workflow?(AgentWorkflow), agents(AgentDefinition[]),
          onSave(data→void)
   이벤트 트리거 입력, 에이전트 체인 drag&drop
   순차/병렬 설정, 저장/테스트 실행 버튼

8. AgentLogConsole.tsx - 로그 콘솔
   Props: logs(AgentLog[]), onFilter(filter→void)
   레벨별 색상(DEBUG:gray, INFO:blue, WARN:yellow, ERROR:red, CRITICAL:purple)
   실시간 업데이트, 검색/필터 기능

Tailwind CSS + lucide-react 아이콘 사용.
```

#### [AG-11] 에이전트 대시보드 페이지 `에이전트 팀`

```
sourcing-app/src/app/(admin)/admin/agents/dashboard/page.tsx를 생성해줘.

"use client" 페이지.
/api/admin/agents/dashboard에서 데이터 fetch.
/api/admin/agents에서 에이전트 목록 fetch.
SSE(/api/admin/agents/events/stream)로 실시간 이벤트 수신.

레이아웃:
상단 - 4개 KPI 카드 (grid-cols-4):
  1. Bot 아이콘 - "활성 에이전트" - {active}/17
  2. Zap 아이콘 - "오늘 처리 태스크" - {tasksToday}
  3. Clock 아이콘 - "평균 응답시간" - {avgLatency}ms
  4. TrendingUp 아이콘 - "KPI 달성률" - {kpiAchievement}%

중단 - 레이어별 에이전트 그리드:
  ["CORE", "BUSINESS", "INTELLIGENCE"].map으로 AgentLayerSection 렌더링
  각 섹션은 해당 레이어 에이전트만 필터링

하단 - 실시간 이벤트 피드:
  RealtimeEventFeed 컴포넌트, SSE에서 받은 이벤트 표시
  최근 50건 유지

로딩 상태와 에러 처리 포함.
lucide-react에서 Bot, Activity, AlertTriangle, CheckCircle,
Zap, TrendingUp, Clock, RefreshCw 아이콘 사용.
```

#### [AG-12] 에이전트 레지스트리 페이지 `에이전트 팀`

```
sourcing-app/src/app/(admin)/admin/agents/registry/page.tsx를 생성해줘.

17개 에이전트를 등록/관리/활성화하는 페이지.

상단 - 레이어별 필터 탭: 전체 | CORE | BUSINESS | INTELLIGENCE
검색 바: 에이전트 이름/설명 검색

메인 - 에이전트 카드 그리드 (grid-cols-4):
  각 AgentCard에 포함:
  - lucide-react 아이콘 + displayName
  - 레이어 배지 + description
  - StatusToggle (활성화/비활성화)
  - MiniKpi 바 (KPI 달성률)
  - 오늘 태스크 수 + 에러율
  - 클릭 시 /admin/agents/{id} 상세 페이지 이동

레이어별 색상 구분:
  CORE: bg-blue-50 border-blue-200
  BUSINESS: bg-purple-50 border-purple-200
  INTELLIGENCE: bg-amber-50 border-amber-200

토글 클릭 시 /api/admin/agents/{id}/start 또는 stop POST 호출.
```

#### [AG-13] 실시간 모니터링 페이지 `에이전트 팀`

```
sourcing-app/src/app/(admin)/admin/agents/monitor/page.tsx를 생성해줘.

SSE(/api/admin/agents/events/stream) 연결로 이벤트 버스 시각화.

레이아웃:
상단 - 필터 바:
  이벤트 타입 필터 (전체/status.changed/task.started/completed/failed/kpi.updated/alert)
  에이전트별 필터 (드롭다운)
  실시간 토글 (일시정지/재개)

메인 - 이벤트 스트림:
  타임라인 형식으로 이벤트 표시
  각 이벤트: 타임스탬프, 에이전트 아이콘+이름, 이벤트타입, 데이터 요약
  상태 아이콘: 🟢성공, 🔴실패, 🟡경고
  최근 100건 유지, 자동 스크롤

우측 사이드바 - 에이전트 상태 요약:
  17개 에이전트 미니 목록
  각각 이름 + 현재 상태 도트 (ACTIVE:녹색, INACTIVE:회색, ERROR:빨간색)
```

#### [AG-14] KPI 대시보드 페이지 `에이전트 팀`

```
sourcing-app/src/app/(admin)/admin/agents/kpi/page.tsx를 생성해줘.

/api/admin/agents/kpi에서 데이터 fetch.
Recharts 라이브러리 사용 (recharts 패키지 필요).

레이아웃:
상단 - 기간 선택:
  탭: 일별 | 주별 | 월별
  날짜 범위 선택기 (startDate, endDate)

메인 - 가로 BarChart:
  Recharts BarChart (layout="vertical")
  Y축: 에이전트 이름 (displayName)
  X축: KPI 달성률 (0~100%)
  Cell 색상: ≥100% #38A169(녹색), ≥70% #D69E2E(노란색), <70% #E53E3E(빨간색)

하단 - 추이 LineChart:
  에이전트 선택 드롭다운
  선택한 에이전트의 KPI 메트릭별 일별 추이
  여러 메트릭 라인 오버레이

각 에이전트 클릭 시 상세 KPI 모달:
  메트릭 이름, 현재값, 목표값, 달성률, 최근 7일 추이
```

#### [AG-15] 워크플로우 관리 페이지 `에이전트 팀`

```
sourcing-app/src/app/(admin)/admin/agents/workflows/page.tsx를 생성해줘.

이벤트 기반 워크플로우(DAG)를 시각적으로 관리.

메인 - 워크플로우 테이블:
  컬럼: 워크플로우명, 트리거 이벤트, 에이전트 체인, 실행 횟수, 상태, 액션
  에이전트 체인은 시각적 표시: [Growth] → [Brand] ∥ [Content] → [SEO]
  (∥는 병렬 실행을 의미)

상단 - "워크플로우 추가" 버튼 → 생성 모달 오픈

생성/수정 모달 (WorkflowEditor 사용):
  트리거 이벤트 입력 (예: user.signup, link.clicked, payment.completed)
  에이전트 체인 편집:
    에이전트 드롭다운에서 선택 → 체인에 추가
    순서(order) 드래그로 변경
    isParallel 토글 (같은 순서 = 병렬 실행)
  [Save] [Test Run] [Cancel] 버튼

기본 워크플로우 예시:
  user.signup → Growth → Brand ∥ Content → Notification → SEO
  link.clicked → Analytics → Recommendation
  payment.completed → Finance → Commerce → Notification
```

#### [AG-16] 태스크/로그/설정 페이지 `에이전트 팀`

```
sourcing-app/src/app/(admin)/admin/agents/ 폴더에
추가 페이지들을 생성해줘:

1. tasks/page.tsx - 태스크 관리
   /api/admin/agents/tasks에서 fetch (페이지네이션)
   필터: 에이전트별, 상태별(QUEUED/RUNNING/COMPLETED/FAILED/CANCELLED), 우선순위별
   테이블: taskId, 에이전트명, 이벤트타입, 상태 배지, 우선순위, 시작시간, 소요시간
   상태별 색상: QUEUED(gray), RUNNING(blue), COMPLETED(green), FAILED(red), CANCELLED(yellow)

2. logs/page.tsx - 로그 조회
   /api/admin/agents/logs에서 fetch (페이지네이션)
   필터: 에이전트별, 레벨별(DEBUG/INFO/WARN/ERROR/CRITICAL), 텍스트 검색
   AgentLogConsole 컴포넌트 사용
   레벨별 색상, metadata JSON 토글 표시

3. settings/page.tsx - 에이전트 설정
   17개 에이전트의 config, priority, maxConcurrent, retryPolicy, schedule을
   폼으로 수정 가능
   PATCH /api/admin/agents/{id}로 저장
   설정 변경 시 확인 모달 표시
```

---

### Phase 4: 런타임 엔진 (5일)

#### [AG-17] AgentBase 기본 클래스 구현 `에이전트 팀`

```
sourcing-app/src/modules/agents/AgentBase.ts를 생성해줘.
모든 17개 에이전트가 상속하는 기본 추상 클래스.

import { prisma } from "@bandauto/db";
import { EventBus } from "./EventBus";
import { logger } from "@/lib/logger";

export abstract class AgentBase {
  abstract name: string;
  abstract layer: "CORE" | "BUSINESS" | "INTELLIGENCE";

  protected id: string;           // DB AgentDefinition.id
  protected eventBus: EventBus;
  protected config: Record<string, any>;
  protected isRunning: boolean = false;

  constructor(eventBus: EventBus, config: Record<string, any>);

  // 필수 구현 메서드
  abstract handleEvent(event: AgentEvent): Promise<AgentResult>;
  abstract getSubscribedEvents(): string[];

  // 선택 구현 메서드
  async onSchedule?(): Promise<void>;

  // 공통 메서드 (자동 제공)
  async start(): Promise<void>;    // isRunning=true, EventBus 구독, 로그 기록
  async stop(): Promise<void>;     // isRunning=false, EventBus 해제, 로그 기록

  async healthCheck(): Promise<{ healthy: boolean; details: any }>;

  protected async log(level: LogLevel, message: string, metadata?: any): Promise<void>;
    // prisma.agentLog.create + logger[level]

  protected async recordKpi(metric: string, value: number): Promise<void>;
    // prisma.agentKpiRecord.upsert (agentId+metric+period+date unique)

  protected async emitEvent(eventType: string, data: any): Promise<void>;
    // eventBus.publish
}

타입 정의도 sourcing-app/src/modules/agents/types.ts에 함께 생성:
AgentEvent, AgentResult, HealthCheckResult, TaskHandler 인터페이스
```

#### [AG-18] EventBus (Redis Pub/Sub) 구현 `에이전트 팀`

```
sourcing-app/src/modules/agents/EventBus.ts를 생성해줘.
Redis Pub/Sub 기반 이벤트 버스.

import Redis from "ioredis";

export interface AgentEvent {
  id: string;              // cuid
  type: string;            // "user.signup", "link.clicked" 등
  data: any;
  source: string;          // 발생 소스
  timestamp: Date;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
}

export class EventBus {
  private pub: Redis;
  private sub: Redis;
  private handlers: Map<string, Set<Function>>;

  constructor(redisUrl?: string);    // process.env.REDIS_URL 사용

  subscribe(pattern: string, handler: EventHandler): void;
    // psubscribe 사용 (패턴 매칭, 예: "agent.*")
  unsubscribe(pattern: string, handler: EventHandler): void;
  publish(event: AgentEvent): Promise<void>;
    // publish + prisma.agentTask.create (eventType, payload, status:QUEUED)
  getRecentEvents(limit?: number): Promise<AgentEvent[]>;
    // Redis list에서 최근 이벤트 조회

  private setupSubscriber(): void;
    // sub.on("pmessage") 핸들러 설정
}

이벤트 발행 시 최근 이벤트 Redis list에도 lpush (최대 1000건 유지).
```

#### [AG-19] TaskQueue (Bull Queue) 구현 `에이전트 팀`

```
sourcing-app/src/modules/agents/TaskQueue.ts를 생성해줘.
Bull Queue 기반 우선순위 태스크 큐.

import Bull from "bull";

export class TaskQueue {
  private queue: Bull.Queue;

  constructor(redisUrl?: string);

  // 태스크 추가 (우선순위 기반)
  async addTask(agentId: string, event: AgentEvent): Promise<string>;
    // Bull job 추가, priority 매핑: CRITICAL=1, HIGH=2, NORMAL=3, LOW=4
    // DB에 AgentTask 생성 (status: QUEUED)

  // 태스크 처리 (워커)
  processTask(handler: TaskHandler): void;
    // queue.process: status→RUNNING, handler 실행, 완료→COMPLETED/FAILED
    // duration 계산, result/error 기록

  // 태스크 상태 조회
  async getTaskStatus(taskId: string): Promise<TaskStatus>;

  // 대기 중/실행 중 태스크 수
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }>;
}

재시도 정책은 AgentDefinition.retryPolicy에서 가져와 적용.
```

#### [AG-20] WorkflowEngine (DAG 엔진) 구현 `에이전트 팀`

```
sourcing-app/src/modules/agents/WorkflowEngine.ts를 생성해줘.
이벤트 기반 DAG 워크플로우 실행 엔진.

export class WorkflowEngine {
  constructor(
    private registry: AgentRegistry,
    private eventBus: EventBus,
    private taskQueue: TaskQueue
  );

  // 이벤트 발생 시 매칭되는 워크플로우 조회 + 실행
  async executeWorkflow(event: AgentEvent): Promise<WorkflowResult>;
    // 1. DB에서 triggerEvent 매칭 + isActive 워크플로우 조회
    // 2. steps를 order 순으로 그룹핑
    // 3. 같은 order의 steps 중 isParallel=true면 Promise.all로 병렬 실행
    // 4. 각 step의 결과를 다음 step context로 전달
    // 5. executionCount++, lastExecuted 업데이트

  // 워크플로우 단계 실행
  private async executeStep(step: WorkflowStep, context: any): Promise<StepResult>;
    // registry에서 agent 인스턴스 가져오기
    // taskQueue에 태스크 추가
    // 결과 대기 + 반환

  // 에러 처리 + 재시도
  private async handleStepError(step: WorkflowStep, error: Error): Promise<void>;
    // retryPolicy에 따라 재시도 or 에러 로그 기록
}
```

#### [AG-21] AgentRegistry + KpiCollector + AgentScheduler 구현 `에이전트 팀`

```
sourcing-app/src/modules/agents/ 폴더에 3개 파일을 생성해줘:

1. AgentRegistry.ts - 에이전트 등록/검색/관리
   singleton 패턴
   register(agent: AgentBase): void
   get(name: string): AgentBase | undefined
   getAll(): AgentBase[]
   getByLayer(layer: AgentLayer): AgentBase[]
   startAll(): Promise<void>
   stopAll(): Promise<void>

2. KpiCollector.ts - KPI 수집/집계
   collectAll(): Promise<void>          // 모든 에이전트 KPI 수집
   getAgentKpi(agentId: string, period: string): Promise<KpiData[]>
   getOverallAchievement(): Promise<number>  // 전체 달성률
   getAlerts(): Promise<Alert[]>        // KPI 70% 미달 에이전트 목록

3. AgentScheduler.ts - cron 스케줄링
   node-cron 또는 Bull의 repeatable job 사용
   registerSchedule(agent: AgentBase): void
     // agent.schedule이 있으면 cron 등록
   removeSchedule(agentName: string): void
   getSchedules(): { agentName, schedule, nextRun }[]

그리고 index.ts (모듈 진입점)도 생성:
  모든 모듈 export
  initializeAgents() 함수: DB에서 에이전트 로드 → 인스턴스 생성 → 레지스트리 등록
```

---

### Phase 5: 에이전트 구현 (지속)

#### [AG-22] Core 에이전트 8개 구현 `에이전트 팀`

```
sourcing-app/src/modules/agents/agents/ 폴더에
CORE 레이어 8개 에이전트를 구현해줘.
모두 AgentBase를 상속하고, handleEvent와 getSubscribedEvents를 구현.

1. OrchestratorAgent.ts
   구독: "agent.*" (모든 에이전트 이벤트)
   역할: 이벤트 라우팅, 워크플로우 트리거, 헬스체크 (1분마다)
   onSchedule: 전체 에이전트 healthCheck 실행

2. ContentAgent.ts
   구독: "content.generate", "profile.update", "product.describe"
   역할: Gemini/Claude API로 콘텐츠 자동 생성

3. AnalyticsAgent.ts
   구독: "link.clicked", "page.viewed", "conversion.*"
   역할: 클릭/방문/전환 집계, 이상 탐지 (z-score)
   onSchedule: 5분마다 데이터 집계

4. RevenueAgent.ts
   구독: "payment.completed", "subscription.*", "upsell.*"
   역할: 수익 분석, 가격 전략, 업셀 유도
   onSchedule: 매일 자정 일간 수익 리포트

5. GrowthAgent.ts
   구독: "user.signup", "user.login", "user.inactive"
   역할: 온보딩 시퀀스, 이탈 경고, 리텐션 캠페인
   onSchedule: 매일 9시 리텐션 분석

6. SupportAgent.ts
   구독: "ticket.created", "ticket.replied", "faq.search"
   역할: 자동 응답, 티켓 분류, 에스컬레이션

7. ModerationAgent.ts
   구독: "content.submitted", "link.reported", "user.reported"
   역할: 스팸 탐지, 유해 콘텐츠 차단, Safe Browsing

8. NotificationAgent.ts
   구독: "notification.send", "notification.schedule"
   역할: 이메일/푸시/SMS/카카오 발송, 일일 제한 (5건/사용자)

각 에이전트는 handleEvent에서 로직 처리 후
this.log()으로 기록, this.recordKpi()로 KPI 갱신,
this.emitEvent()로 후속 이벤트 발행.
초기에는 로깅 + KPI 기록 위주로 skeleton 구현.
```

#### [AG-23] Business 에이전트 4개 구현 `에이전트 팀`

```
sourcing-app/src/modules/agents/agents/ 폴더에
BUSINESS 레이어 4개 에이전트를 구현해줘:

9. CommerceAgent.ts
   구독: "order.*", "product.*", "shipping.*"
   역할: 주문 처리 자동화, 배송 추적, 재고 관리
   주문 상태 전이 검증 포함

10. AffiliateAgent.ts
    구독: "affiliate.click", "affiliate.convert", "affiliate.payout"
    역할: 쿠팡/아마존 제휴 링크 관리, 커미션 추적

11. SourcingAgent.ts
    구독: "sourcing.start", "sourcing.complete", "product.import"
    역할: 도매 상품 수집 (Playwright), AI 가공 (Gemini), 밴드 발행
    파이프라인: 수집→변환→등록, 타임아웃 30분

12. FinanceAgent.ts
    구독: "payment.*", "settlement.*", "withdrawal.*"
    역할: 토스페이먼츠 결제 처리, 월간 정산, 출금 관리
    retryPolicy: maxRetries:5 (결제는 재시도 중요)
```

#### [AG-24] Intelligence 에이전트 5개 구현 `에이전트 팀`

```
sourcing-app/src/modules/agents/agents/ 폴더에
INTELLIGENCE 레이어 5개 에이전트를 구현해줘:

13. RecommendationAgent.ts
    구독: "user.viewed", "user.clicked", "user.purchased"
    역할: 개인화 추천 (가중치: 카테고리0.3, 인기0.2, 커미션0.2, 전환0.2, 트렌드0.1)
    A/B 테스트 엔진 (minSamples: 100)
    onSchedule: 1시간마다 추천 모델 갱신

14. FunnelAgent.ts
    구독: "funnel.*", "conversion.*"
    역할: 전환 퍼널 분석 (visit→view→scroll→click→external→convert)
    병목 탐지 (dropoff 0.4, traffic 0.3, revenue 0.3 가중치)

15. BrandAgent.ts
    구독: "brand.audit", "content.review", "style.check"
    역할: 브랜드 일관성 점검, 스타일 가이드 자동 적용
    Claude opus 사용 (디자인 전략), onSchedule: 매주 월요일

16. SEOAgent.ts
    구독: "page.published", "page.updated", "sitemap.refresh"
    역할: 메타태그 자동 생성, 사이트맵 갱신, 구조화 데이터 (Person/Product/FAQ)
    onSchedule: 6시간마다 검색 노출 분석

17. DesignAgent.ts
    구독: "theme.generate", "thumbnail.create", "og.generate"
    역할: 테마 프리셋 생성 (8개), OG 이미지, 썸네일
    Claude 모델 분리: haiku(색상분류), sonnet(테마추천), opus(디자인전략)
    WCAG-AA 접근성 표준 준수
```
