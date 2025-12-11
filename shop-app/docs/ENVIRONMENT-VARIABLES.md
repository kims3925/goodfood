# 환경 변수 설정 가이드

> **프로젝트**: Shop-App
> **최종 업데이트**: 2025-12-10

---

## 필수 환경 변수

### 데이터베이스

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `DATABASE_URL` | Prisma 데이터베이스 연결 문자열 | `postgresql://user:pass@localhost:5432/db` |

### 인증 (NextAuth)

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NEXTAUTH_SECRET` | JWT 암호화 키 (32자 이상 권장) | `your-super-secret-key-min-32-chars` |
| `NEXTAUTH_URL` | 애플리케이션 기본 URL | `https://yourdomain.com` |

### 결제 (TossPayments)

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `TOSS_PAYMENTS_SECRET_KEY` | 토스페이먼츠 시크릿 키 | `test_sk_...` |
| `TOSS_PAYMENTS_CLIENT_KEY` | 토스페이먼츠 클라이언트 키 | `test_ck_...` |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 클라이언트용 토스 키 | `test_ck_...` |

---

## 권장 환경 변수

### 내부 API

| 변수명 | 설명 | 기본값 (위험) |
|--------|------|---------------|
| `INTERNAL_API_KEY` | 내부 API 인증 키 | `dev-internal-key` |

### 비회원 주문

| 변수명 | 설명 | 기본값 (위험) |
|--------|------|---------------|
| `GUEST_TOKEN_SECRET` | 비회원 토큰 JWT 시크릿 | `guest-order-secret-key` |

### 도메인 설정

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NEXT_PUBLIC_ROOT_DOMAIN` | 루트 도메인 | `yourdomain.com` |
| `COOKIE_DOMAIN` | 쿠키 도메인 (서브도메인 공유용) | `.yourdomain.com` |

---

## 선택 환경 변수

### 로깅/모니터링

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `SENTRY_DSN` | Sentry 에러 추적 | `https://...@sentry.io/...` |
| `LOG_LEVEL` | 로그 레벨 | `info`, `debug`, `error` |

### 캐싱 (Redis)

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `REDIS_URL` | Redis 연결 URL | `redis://localhost:6379` |

### Rate Limiting (Upstash)

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL | `https://...upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash 토큰 | `AX...` |

---

## 환경별 설정 파일

### 개발 환경 (.env.local)

```bash
# 데이터베이스
DATABASE_URL="postgresql://postgres:password@localhost:5432/bandauto_dev"

# NextAuth
NEXTAUTH_SECRET="dev-secret-key-for-local-development"
NEXTAUTH_URL="http://localhost:3000"

# TossPayments (테스트)
TOSS_PAYMENTS_SECRET_KEY="test_sk_..."
TOSS_PAYMENTS_CLIENT_KEY="test_ck_..."
NEXT_PUBLIC_TOSS_CLIENT_KEY="test_ck_..."

# 내부 API
INTERNAL_API_KEY="dev-internal-key-local"

# 비회원 토큰
GUEST_TOKEN_SECRET="dev-guest-token-secret"

# 도메인
NEXT_PUBLIC_ROOT_DOMAIN="localhost:3000"
```

### 프로덕션 환경 (.env.production)

```bash
# 데이터베이스
DATABASE_URL="postgresql://user:pass@prod-db.example.com:5432/bandauto"

# NextAuth
NEXTAUTH_SECRET="production-super-secret-key-minimum-32-characters"
NEXTAUTH_URL="https://shop.yourdomain.com"

# TossPayments (프로덕션)
TOSS_PAYMENTS_SECRET_KEY="live_sk_..."
TOSS_PAYMENTS_CLIENT_KEY="live_ck_..."
NEXT_PUBLIC_TOSS_CLIENT_KEY="live_ck_..."

# 내부 API (강력한 키 사용)
INTERNAL_API_KEY="prod-internal-api-key-very-long-random-string"

# 비회원 토큰
GUEST_TOKEN_SECRET="prod-guest-token-secret-very-long-random"

# 도메인
NEXT_PUBLIC_ROOT_DOMAIN="yourdomain.com"
COOKIE_DOMAIN=".yourdomain.com"

# 모니터링
SENTRY_DSN="https://...@sentry.io/..."
LOG_LEVEL="info"
```

---

## 시크릿 키 생성 방법

### OpenSSL 사용

```bash
# 32바이트 랜덤 문자열
openssl rand -base64 32

# 64바이트 랜덤 문자열
openssl rand -hex 32
```

### Node.js 사용

```javascript
// 터미널에서 실행
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Vercel 배포 시 설정

Vercel Dashboard > Project Settings > Environment Variables

1. 각 환경 변수 추가
2. Environment 선택 (Production, Preview, Development)
3. 민감한 값은 "Sensitive" 체크

### 환경별 분리

```
NEXTAUTH_SECRET (Production) = "prod-secret..."
NEXTAUTH_SECRET (Preview) = "preview-secret..."
NEXTAUTH_SECRET (Development) = "dev-secret..."
```

---

## 환경 변수 검증

### 런타임 체크 코드

```typescript
// src/lib/env.ts
function getEnvVar(name: string, required = true): string {
  const value = process.env[name]

  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value || ''
}

export const env = {
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  NEXTAUTH_SECRET: getEnvVar('NEXTAUTH_SECRET'),
  NEXTAUTH_URL: getEnvVar('NEXTAUTH_URL'),
  TOSS_SECRET_KEY: getEnvVar('TOSS_PAYMENTS_SECRET_KEY'),
  INTERNAL_API_KEY: getEnvVar('INTERNAL_API_KEY'),
  GUEST_TOKEN_SECRET: getEnvVar('GUEST_TOKEN_SECRET'),
}
```

### Zod 스키마 검증

```typescript
// src/lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  TOSS_PAYMENTS_SECRET_KEY: z.string(),
  TOSS_PAYMENTS_CLIENT_KEY: z.string(),
  INTERNAL_API_KEY: z.string().min(16),
  GUEST_TOKEN_SECRET: z.string().min(16),
  NODE_ENV: z.enum(['development', 'production', 'test']),
})

export const env = envSchema.parse(process.env)
```

---

## 체크리스트

### 배포 전 필수 확인

- [ ] `DATABASE_URL` 프로덕션 DB로 설정
- [ ] `NEXTAUTH_SECRET` 강력한 키로 변경 (32자 이상)
- [ ] `NEXTAUTH_URL` 프로덕션 도메인으로 설정
- [ ] `TOSS_PAYMENTS_*` 프로덕션 키로 변경
- [ ] `INTERNAL_API_KEY` 기본값에서 변경
- [ ] `GUEST_TOKEN_SECRET` 기본값에서 변경

### 보안 확인

- [ ] .env 파일이 .gitignore에 포함되어 있는지 확인
- [ ] 기본값/테스트 키가 프로덕션에 사용되지 않는지 확인
- [ ] 모든 시크릿이 충분히 긴지 확인 (최소 32자)
