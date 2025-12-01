# 코드 리팩토링 및 정리 목록

> 생성일: 2024-11-30

---

## 1. 삭제 가능한 파일들

### 1.1 빌드 캐시 파일 (.old) - 즉시 삭제 가능

```
e-commerce-app/.next/cache/webpack/client-development/index.pack.gz.old
e-commerce-app/.next/cache/webpack/server-development/index.pack.gz.old
sourcing-app/.next/cache/webpack/client-development/index.pack.gz.old
sourcing-app/.next/cache/webpack/client-production/index.pack.old
sourcing-app/.next/cache/webpack/edge-server-development/index.pack.gz.old
sourcing-app/.next/cache/webpack/edge-server-production/index.pack.old
sourcing-app/.next/cache/webpack/server-development/index.pack.gz.old
sourcing-app/.next/cache/webpack/server-production/index.pack.old
```

**삭제 명령어:**
```bash
find . -name "*.old" -path "*/.next/*" -delete
```

### 1.2 전체 빌드 아티팩트 (선택적)

| 경로 | 크기 | 설명 |
|------|------|------|
| `e-commerce-app/.next` | ~96MB | 빌드 시 자동 생성 |
| `sourcing-app/.next` | ~265MB | 빌드 시 자동 생성 |

**총 361MB 절감 가능** (git에는 이미 .gitignore로 제외됨)

### 1.3 오래된 문서

```
docs/project/README-old.md
```

### 1.4 개발용 스크립트 (선택적)

```
db/scripts/cleanup-dummy.ts   # 더미 데이터 정리
db/scripts/check-data.ts      # 데이터 확인용
db/scripts/check-orders.ts    # 주문 확인용
```

---

## 2. 리팩토링 가능한 부분

### 2.1 인증 로직 중복 (높은 우선순위)

**현재 상태:** 10개 이상의 API 라우트에서 동일한 패턴 반복

```typescript
// 반복되는 코드 (~10줄 x 10개 파일 = 100줄)
const currentUser = await getCurrentUser()
if (!currentUser) {
  return NextResponse.json(
    { success: false, error: '로그인이 필요합니다.' },
    { status: 401 }
  )
}
const userId = currentUser.userId
```

**영향 파일:**
- `e-commerce-app/src/app/api/cart/route.ts`
- `e-commerce-app/src/app/api/cart/items/[id]/route.ts`
- `e-commerce-app/src/app/api/orders/route.ts`
- `e-commerce-app/src/app/api/orders/[id]/route.ts`
- `e-commerce-app/src/app/api/mypage/*/route.ts` (6개)
- `sourcing-app/src/app/api/*/route.ts` (10개 이상)

**개선안:**
```typescript
// libs/api-middleware.ts
export function withAuth(handler: Function) {
  return async (req: NextRequest, context: any) => {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    return handler(req, { ...context, userId: currentUser.userId })
  }
}

// 사용 예시
export const GET = withAuth(async (req, { userId }) => {
  // 바로 userId 사용 가능
})
```

**예상 절감:** ~100줄

---

### 2.2 인증 서비스 구조 불일치

| 앱 | 파일 | 줄 수 | 패턴 |
|----|------|-------|------|
| e-commerce-app | `modules/auth/services/auth.service.ts` | 163줄 | 클래스 기반 |
| sourcing-app | `modules/auth/auth.service.ts` | 90줄 | 함수 기반 |

**개선안:** 공유 라이브러리로 통합
```
db/src/shared/auth/
├── password.utils.ts  # bcryptjs 래퍼
├── jwt.utils.ts       # jose 래퍼
└── types.ts
```

---

### 2.3 주문 서비스 구조 차이

| 앱 | 파일 | 내용 |
|----|------|------|
| e-commerce-app | `modules/order/services/order.service.ts` | 주문 생성, 결제, 환불 등 복합 로직 |
| sourcing-app | `modules/sourcing/domain/src/order/services/order.service.ts` | 단순 조회/생성 (33줄) |

**개선안:** 공통 조회 로직 분리

---

## 3. 정리 필요한 부분

### 3.1 console.log 디버깅 코드

| 앱 | 총 개수 | 정리 대상 (log/debug) |
|----|--------|----------------------|
| e-commerce-app | 187개 | ~60개 |
| sourcing-app | 308개 | ~69개 |
| **합계** | 495개 | ~129개 |

**주요 파일:**
```
e-commerce-app/src/app/api/cart/route.ts
e-commerce-app/src/app/api/orders/route.ts
e-commerce-app/src/modules/payments/services/payment.service.ts
e-commerce-app/src/app/store/payment/success/page.tsx
sourcing-app/src/app/(admin)/product/list/page.tsx
sourcing-app/src/modules/automation/executor.ts
sourcing-app/src/modules/automation/pipelines/publish.ts
sourcing-app/src/components/product/ProductFormModal.tsx
```

**개선안:**
```typescript
// 기존 logger 활용 (e-commerce-app/src/modules/common/utils/src/helpers/logger.ts)
import { logger } from '@/modules/common/utils/src/helpers/logger'

// 변경 전
console.log('Order created:', orderId)

// 변경 후
logger.debug('Order created:', orderId)
```

---

### 3.2 TODO/FIXME 주석

| 파일 | 라인 | 내용 | 우선순위 |
|------|------|------|----------|
| `e-commerce-app/.../webhook-handler.service.ts` | 366 | 이메일 발송 로직 구현 (결제 완료 알림) | **높음** |
| `e-commerce-app/.../webhook-handler.service.ts` | 396 | 관리자 이메일 발송 구현 | **높음** |
| `sourcing-app/.../post/list/page.tsx` | 207 | userId를 세션에서 가져와야 함 | **높음** |
| `e-commerce-app/.../logger.ts` | 72 | 외부 로깅 서비스 연동 (Sentry 등) | 중간 |

---

### 3.3 하드코딩된 URL

| 파일 | 라인 | 문제 |
|------|------|------|
| `e-commerce-app/.../order.service.ts` | 213-214 | localhost URL |
| `e-commerce-app/.../toss-payments.service.ts` | 189-190 | localhost URL |
| `sourcing-app/.../shopping-mall/page.tsx` | 660 | `href="http://localhost:3000/store"` |

**개선안:**
```typescript
// config/urls.ts
export const SHOP_URLS = {
  store: process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3000',
  success: `${process.env.NEXT_PUBLIC_BASE_URL}/store/payment/success`,
  fail: `${process.env.NEXT_PUBLIC_BASE_URL}/store/payment/fail`,
} as const
```

---

## 4. 우선순위 정리

### 즉시 처리 (5분)
- [ ] .old 캐시 파일 삭제
- [ ] README-old.md 삭제

### 단기 (1-2시간)
- [ ] TODO: 이메일 발송 로직 구현
- [ ] TODO: userId 세션 조회 수정
- [ ] 하드코딩된 URL 환경변수로 변경

### 중기 (반나절)
- [ ] console.log 정리 (logger 사용)
- [ ] 인증 미들웨어 추출

### 장기 (추후)
- [ ] 인증 서비스 통합
- [ ] 주문 서비스 공통화
- [ ] 외부 로깅 서비스 연동

---

## 5. 요약

| 항목 | 수량/크기 | 예상 효과 |
|------|----------|----------|
| 삭제 가능 캐시 | ~361MB | 저장공간 확보 |
| 중복 인증 코드 | ~100줄 | 미들웨어로 통합 |
| console.log | 129개 | 코드 정결성 |
| TODO 주석 | 4개 | 기능 완성 |
| 하드코딩 URL | 5개 | 유지보수성 |

**총 예상 개선:** 500줄+ 중복 제거, 코드 가독성 향상
