# 빌드 에러 및 해결 방법

> **프로젝트**: Shop-App
> **최종 업데이트**: 2025-12-10

---

## 빌드 실패 원인

### Critical Error - 타입 에러

**에러 메시지**:
```
./src/app/api/guest-payments/confirm/route.ts:339:42
Type error: Property 'FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING' does not exist
on type 'typeof TOSS_ERROR_CODES'
```

**위치**: `src/app/api/guest-payments/confirm/route.ts:339`

**원인**: `TOSS_ERROR_CODES` 상수에 정의되지 않은 프로퍼티 참조

**해결 방법**:

옵션 1: TOSS_ERROR_CODES에 해당 상수 추가
```typescript
// src/modules/payments/constants/toss-error-codes.ts
export const TOSS_ERROR_CODES = {
  // 기존 코드들...
  FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING: {
    code: 'FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING',
    message: '결제 처리 중 내부 시스템 오류가 발생했습니다.'
  },
}
```

옵션 2: 해당 라인의 코드를 기존 에러 코드로 대체
```typescript
// 변경 전
TOSS_ERROR_CODES.FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING

// 변경 후 (적절한 기존 에러 코드 사용)
TOSS_ERROR_CODES.FAILED_INTERNAL_SYSTEM_PROCESSING
// 또는
{ code: 'INTERNAL_ERROR', message: '결제 처리 중 오류가 발생했습니다.' }
```

---

## ESLint 경고

### 1. Image 최적화 미적용 (30개 이상)

**경고 메시지**:
```
Warning: Using `<img>` could result in slower LCP and higher bandwidth.
Consider using `<Image />` from `next/image`
```

**영향받는 파일**:
- `src/app/(shop)/layout.tsx`
- `src/app/(shop)/product/[id]/ProductDetailClient.tsx`
- `src/app/(shop)/main/page.tsx`
- `src/app/(shop)/cart/page.tsx`
- `src/app/(shop)/checkout/page.tsx`
- `src/app/(shop)/mypage/reviews/page.tsx`
- 외 다수

**해결 방법**:
```tsx
// Before
<img src={url} alt={alt} />

// After
import Image from 'next/image'
<Image src={url} alt={alt} width={300} height={200} />
```

### 2. useEffect 의존성 경고

**경고 메시지**:
```
React Hook useEffect has missing dependencies
```

**해결 방법**:
```tsx
// Before
useEffect(() => {
  fetchData(id)
}, []) // 경고: id가 의존성에 없음

// After
useEffect(() => {
  fetchData(id)
}, [id])

// 또는 의도적으로 무시
useEffect(() => {
  fetchData(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

---

## 환경 변수 관련 경고

### 필수 환경 변수 누락 시 런타임 에러

다음 환경 변수가 설정되지 않으면 런타임 에러 발생:

| 변수 | 에러 메시지 |
|------|-------------|
| DATABASE_URL | PrismaClientInitializationError |
| NEXTAUTH_SECRET | NextAuth Error |
| TOSS_PAYMENTS_SECRET_KEY | 결제 승인 실패 |

**해결**: 프로덕션 배포 전 모든 환경 변수 설정 확인

---

## 빌드 명령어

```bash
# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build

# 타입 체크만
npx tsc --noEmit

# ESLint 체크만
npm run lint

# 빌드 + ESLint 경고 무시
npm run build -- --no-lint
```

---

## 빌드 체크리스트

- [ ] `npm run build` 성공
- [ ] TypeScript 에러 0개
- [ ] ESLint 에러 0개 (경고는 허용)
- [ ] 모든 환경 변수 설정
- [ ] Prisma 클라이언트 생성 (`npx prisma generate --schema prisma`)
