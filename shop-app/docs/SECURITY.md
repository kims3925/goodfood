# 보안 규칙

> **관련 문서:** [DEPLOYMENT.md](./DEPLOYMENT.md) | [PROJECT.md](./PROJECT.md) | [../CLAUDE.md](../CLAUDE.md)

---

## 핵심 원칙

| 원칙 | 설명 |
|-----|-----|
| Defense in Depth | 다중 보안 레이어 |
| Least Privilege | 최소 권한 원칙 |
| Secure by Default | 기본값은 안전하게 |
| Never Trust Input | 모든 입력 검증 |

---

## 인증 (Authentication)

### NextAuth.js 설정

| 항목 | 값 |
|-----|---|
| Provider | Credentials, (소셜 로그인 확장 가능) |
| Session | JWT |
| Secret | NEXTAUTH_SECRET (환경변수) |

### 세션 관리

| 항목 | 규칙 |
|-----|-----|
| JWT 만료 | 24시간 |
| 세션 쿠키 | HttpOnly, Secure, SameSite=Lax |
| 비밀번호 해싱 | bcrypt |

---

## 권한 (Authorization)

### 사용자 역할 (RBAC)

| 역할 | 설명 | 주요 권한 |
|-----|-----|---------|
| USER (고객) | 쇼핑몰 회원 | 상품 구매, 주문 관리, 리뷰 작성 |
| GUEST (비회원) | 비로그인 사용자 | 비회원 주문, 주문 조회 |

### 권한 체크 패턴

```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware'

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token
  }
})

export const config = {
  matcher: ['/mypage/:path*', '/checkout/:path*']
}
```

### 리소스 접근 규칙

| Resource | GUEST | USER |
|----------|-------|------|
| 상품 조회 | O | O |
| 장바구니 (비회원) | O | O |
| 장바구니 (회원) | X | O |
| 비회원 주문 | O | X |
| 회원 주문 | X | O |
| 마이페이지 | X | O |
| 배송지 관리 | X | O |
| 주문 내역 | X | O |

---

## 입력 검증

### Zod 스키마 검증

```typescript
import { z } from 'zod'

const orderSchema = z.object({
  email: z.string().email('올바른 이메일을 입력하세요'),
  phone: z.string().regex(/^01[0-9]{8,9}$/, '올바른 전화번호를 입력하세요'),
  amount: z.number().positive('금액은 양수여야 합니다'),
})
```

### 검증 대상

| 대상 | 검증 |
|-----|-----|
| Email | RFC 5322 형식 |
| Phone | 한국 휴대폰 형식 |
| URL | 허용 도메인 체크 |
| 금액 | 양수, 최대값 제한 |

---

## SQL Injection 방지

| 규칙 |
|-----|
| Prisma ORM 파라미터 바인딩 사용 |
| 문자열 연결 쿼리 금지 |
| `$queryRawUnsafe` 사용 금지 |

### 안전한 쿼리 예시

```typescript
// Good - 파라미터 바인딩
const user = await prisma.user.findUnique({
  where: { email: userInput }
})

// Bad - 문자열 연결
const user = await prisma.$queryRawUnsafe(
  `SELECT * FROM user WHERE email = '${userInput}'`  // 금지!
)
```

---

## XSS 방지

| 규칙 |
|-----|
| React 기본 이스케이프 활용 |
| `dangerouslySetInnerHTML` 사용 시 DOMPurify 필수 |
| 사용자 입력 HTML 렌더링 금지 |

---

## CSRF 방지

| 규칙 |
|-----|
| SameSite Cookie 설정 |
| NextAuth CSRF 토큰 활용 |
| API Route는 세션 검증 |

---

## 결제 보안 (Toss Payments)

### 결제 검증

| 단계 | 검증 |
|-----|-----|
| 결제 요청 | 금액, 주문번호 검증 |
| 결제 승인 | paymentKey, orderId 검증 |
| 웹훅 | 시그니처 검증 |

### 환불 처리

| 규칙 |
|-----|
| 환불은 서버에서만 처리 |
| 환불 사유 필수 기록 |
| 트랜잭션으로 원자성 보장 |

---

## 외부 API 보안

### Band API

| 항목 | 보안 조치 |
|-----|---------|
| 세션 쿠키 | DB 암호화 저장 |
| API 호출 | Rate Limiting |
| 토큰 만료 | 자동 갱신 처리 |

### AI API (Gemini/OpenAI)

| 항목 | 보안 조치 |
|-----|---------|
| API Key | 환경변수 저장 |
| 사용량 | 일일 사용량 제한 |
| 로깅 | 요청/응답 로깅 (PII 제외) |

---

## 민감 데이터 처리

### 데이터 분류

| Level | 데이터 | 보호 |
|-------|-------|-----|
| Critical | 비밀번호, 결제 정보 | 암호화, 로그 금지 |
| High | 이메일, 전화번호 | 마스킹, 접근 제어 |
| Medium | 이름, 주소 | 접근 제어 |

### 마스킹 규칙

```typescript
// 이메일 마스킹: test@example.com → te**@example.com
// 전화번호 마스킹: 01012345678 → 010****5678
// 카드번호 마스킹: 1234567890123456 → 1234-****-****-3456
```

---

## 시크릿 관리

### 환경변수

| 규칙 |
|-----|
| `.env*` 파일 커밋 금지 |
| 환경변수로만 주입 |
| Jenkins Credentials 활용 |

### .gitignore 설정

```text
.env
.env.*
*.local
```

### 배포 시 .env 백업/복원 보안 절차

> **상세 내용:** [DEPLOYMENT.md](./DEPLOYMENT.md#1-env-파일-보호) 참조

배포 파이프라인(cd-Jenkinsfile)에서 git reset 시 .env 파일 보호를 위한 보안 절차:

#### 1. 안전한 백업 디렉토리 생성

```bash
# 프로젝트 디렉토리 내 전용 백업 폴더 사용 (Jenkins 권한 문제 해결)
ENV_BACKUP_DIR="${PROJECT_PATH}/.env-backup-$$"
mkdir -p "$ENV_BACKUP_DIR"
chmod 700 "$ENV_BACKUP_DIR"  # 소유자만 접근 가능
```

| 항목 | 설명 |
|-----|-----|
| 경로 | `${PROJECT_PATH}/.env-backup-$$` (프로젝트 내, 프로세스 ID 기반) |
| 디렉토리 권한 | `chmod 700` (소유자만 rwx) |
| `/tmp`, `/home/ubuntu` 미사용 이유 | 권한 문제 또는 다른 사용자 접근 가능 |

#### 2. 가드된 복사 (안전한 에러 처리)

```bash
# 파일 존재 시에만 복사, 실패해도 파이프라인 중단 방지
[ -f .env ] && cp .env "$ENV_BACKUP_DIR/.env.backup" || true
[ -f db/.env ] && cp db/.env "$ENV_BACKUP_DIR/.env.db.backup" || true
[ -f shop-app/.env ] && cp shop-app/.env "$ENV_BACKUP_DIR/.env.shop.backup" || true
[ -f shop-app/.env.local ] && cp shop-app/.env.local "$ENV_BACKUP_DIR/.env.shop.local.backup" || true
[ -f sourcing-app/.env ] && cp sourcing-app/.env "$ENV_BACKUP_DIR/.env.sourcing.backup" || true
[ -f sourcing-app/.env.local ] && cp sourcing-app/.env.local "$ENV_BACKUP_DIR/.env.sourcing.local.backup" || true

# 백업 파일 권한 제한
chmod 600 "$ENV_BACKUP_DIR"/.env.* 2>/dev/null || true
```

| 보안 조치 | 설명 |
|---------|-----|
| `[ -f ] && cp` | 파일 존재 확인 후 복사 |
| `\|\| true` | 실패 시에도 파이프라인 계속 |
| `chmod 600` | 소유자만 읽기/쓰기 |
| `2>/dev/null` | 에러 메시지 숨김 (파일 없는 경우) |

#### 3. 복원 및 정리

```bash
# git reset 후 복원
git reset --hard origin/main

[ -f "$ENV_BACKUP_DIR/.env.backup" ] && cp "$ENV_BACKUP_DIR/.env.backup" .env || true
[ -f "$ENV_BACKUP_DIR/.env.db.backup" ] && cp "$ENV_BACKUP_DIR/.env.db.backup" db/.env || true
# ... (각 앱별 복원)

# 복원 후 즉시 삭제 (민감 정보 노출 시간 최소화)
rm -rf "$ENV_BACKUP_DIR"
```

| 단계 | 보안 목적 |
|-----|---------|
| 복원 | 원본 .env 파일 유지 |
| `rm -rf` | 임시 백업 즉시 삭제 |

#### 4. 로깅 (상세 진행 상황)

```bash
echo ">>> Creating secure backup directory: $ENV_BACKUP_DIR"
echo ">>> Backing up .env files..."
echo ">>> Restoring .env files..."
echo ">>> Cleaning up temporary backup directory..."
```

> **주의:** 로그에 .env 파일 내용이나 경로의 민감 정보가 노출되지 않도록 주의

#### 보안 체크리스트

- [ ] `/tmp` 대신 사용자 홈 디렉토리 사용
- [ ] 백업 디렉토리 `chmod 700` 적용
- [ ] 백업 파일 `chmod 600` 적용
- [ ] 복원 후 즉시 `rm -rf`로 삭제
- [ ] 가드된 복사 (`[ -f ] && cp || true`) 사용
- [ ] 프로세스 ID 기반 고유 디렉토리 (`$$`) 사용

---

## 보안 헤더

### Next.js 설정 (next.config.js)

```javascript
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
]
```

---

## 로깅 규칙

### 로그 포함 금지

| 금지 데이터 |
|-----------|
| 비밀번호 |
| API 키 |
| 결제 정보 (카드번호) |
| 개인 식별 정보 (PII) |

### 로그 포함 권장

| 권장 데이터 |
|-----------|
| 요청 ID |
| 사용자 ID |
| 액션 타입 |
| 타임스탬프 |
| 에러 메시지 |

---

## 코드 리뷰 체크리스트

- [ ] 하드코딩 시크릿 없음
- [ ] SQL Injection 취약점 없음
- [ ] XSS 취약점 없음
- [ ] 적절한 인증/인가 적용
- [ ] 입력값 검증 적용
- [ ] 민감 데이터 마스킹
- [ ] 로그에 민감 정보 미포함

---

## 배포 보안 체크리스트

- [ ] HTTPS 강제
- [ ] 보안 헤더 설정
- [ ] 불필요한 포트 차단
- [ ] DB 외부 접근 차단
- [ ] 시크릿 환경변수 설정
- [ ] .env 파일 미커밋 확인

---

## 금지사항

| 금지 | 이유 |
|-----|-----|
| 하드코딩 시크릿 | 유출 위험 |
| 인증 우회 | 보안 취약점 |
| 민감정보 로깅 | 개인정보 유출 |
| 프로덕션 console.log | 정보 노출 |
| 비암호화 통신 | 중간자 공격 |
