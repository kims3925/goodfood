# 보안 체크리스트

> **프로젝트**: Shop-App
> **최종 업데이트**: 2025-12-10

---

## Critical Issues (즉시 수정 필요)

### 1. 하드코딩된 시크릿 키

#### 문제 위치

**파일**: `src/middleware.ts:167`
```typescript
// 현재 코드 (위험)
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key'
```

**파일**: `src/lib/guest-token.ts:9`
```typescript
// 현재 코드 (위험)
const JWT_SECRET = process.env.GUEST_TOKEN_SECRET || 'guest-order-secret-key'
```

#### 해결 방법

```typescript
// 수정된 코드
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY
if (!INTERNAL_API_KEY) {
  throw new Error('INTERNAL_API_KEY environment variable is required')
}
```

```typescript
// 또는 런타임 체크
if (process.env.NODE_ENV === 'production' && !process.env.INTERNAL_API_KEY) {
  throw new Error('INTERNAL_API_KEY is required in production')
}
```

---

## High Priority (배포 전 권장)

### 2. Rate Limiting 미구현

#### 문제

로그인 API에 Rate limiting이 없어 브루트포스 공격에 취약합니다.

#### 해결 방법

**옵션 1: Upstash Rate Limit (Vercel 배포 시 권장)**

```bash
npm install @upstash/ratelimit @upstash/redis
```

```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'), // 1분당 5회
  analytics: true,
})

// API에서 사용
const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
const { success, limit, remaining } = await ratelimit.limit(ip)

if (!success) {
  return NextResponse.json(
    { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    { status: 429 }
  )
}
```

**옵션 2: 메모리 기반 (단일 서버)**

```typescript
// src/lib/rate-limit.ts
const requests = new Map<string, { count: number; timestamp: number }>()

export function checkRateLimit(ip: string, maxRequests = 5, windowMs = 60000) {
  const now = Date.now()
  const record = requests.get(ip)

  if (!record || now - record.timestamp > windowMs) {
    requests.set(ip, { count: 1, timestamp: now })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}
```

### 3. 이미지 도메인 전체 허용

#### 문제

```javascript
// next.config.js (현재)
images: {
  remotePatterns: [{ protocol: 'https', hostname: '**' }],
}
```

#### 해결 방법

```javascript
// next.config.js (수정)
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'your-cdn.com' },
    { protocol: 'https', hostname: 'your-storage.s3.amazonaws.com' },
    // 필요한 도메인만 추가
  ],
}
```

---

## Medium Priority (중기 개선)

### 4. 2FA (이중 인증) 미구현

#### 권장 구현 방식

```bash
npm install otplib qrcode
```

```typescript
// src/lib/totp.ts
import { authenticator } from 'otplib'

export function generateSecret() {
  return authenticator.generateSecret()
}

export function generateQRCode(email: string, secret: string) {
  const otpauth = authenticator.keyuri(email, 'YourApp', secret)
  return otpauth
}

export function verifyToken(token: string, secret: string) {
  return authenticator.verify({ token, secret })
}
```

### 5. 입력값 검증 강화

#### 문제 위치

일부 API에서 parseInt 결과 NaN 체크 및 범위 검증 부재

#### 해결 방법

```typescript
// Zod 스키마 활용
import { z } from 'zod'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// API에서 사용
const { page, limit } = paginationSchema.parse({
  page: searchParams.get('page'),
  limit: searchParams.get('limit'),
})
```

### 6. 중앙화된 인증 미들웨어

#### 현재 문제

각 API에서 인증 로직 중복 구현

#### 해결 방법

```typescript
// src/lib/auth-middleware.ts
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/modules/auth/auth.config'

export async function withAuth(
  handler: (req: NextRequest, session: Session) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    return handler(req, session)
  }
}

// API에서 사용
export const GET = withAuth(async (req, session) => {
  // session이 보장됨
})
```

---

## Low Priority (장기 개선)

### 7. Content Security Policy (CSP)

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.tosspayments.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self';
      connect-src 'self' https://api.tosspayments.com;
    `.replace(/\n/g, ''),
  },
]

module.exports = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
```

### 8. HTTPS 강제

```typescript
// src/middleware.ts
if (
  process.env.NODE_ENV === 'production' &&
  req.headers.get('x-forwarded-proto') !== 'https'
) {
  return NextResponse.redirect(
    `https://${req.headers.get('host')}${req.nextUrl.pathname}`,
    301
  )
}
```

### 9. 세션 보안 강화

```typescript
// auth.config.ts
export const authOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
  },
}
```

---

## 보안 검증 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| SQL 인젝션 | 안전 | Prisma ORM 사용 |
| XSS | 안전 | React 자동 이스케이핑 |
| CSRF | 안전 | NextAuth 내장 보호 |
| 비밀번호 해싱 | 안전 | bcrypt (cost 12) |
| JWT 보안 | 양호 | 30일 만료 |
| 세션 관리 | 양호 | 서브도메인 공유 지원 |

---

## 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [NextAuth.js Security](https://next-auth.js.org/getting-started/security)
