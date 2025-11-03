# BandAuto - 에러 핸들링 가이드

## 📋 목차
1. [개요](#개요)
2. [커스텀 에러 클래스](#커스텀-에러-클래스)
3. [에러 로깅](#에러-로깅)
4. [사용 예제](#사용-예제)
5. [Best Practices](#best-practices)

---

## 🎯 개요

이 시스템은 **에러 추적을 용이하게** 하기 위해 다음 기능을 제공합니다:

### 주요 기능
- ✅ **명확한 에러 분류** (Repository, Service, Validation 등)
- ✅ **구조화된 에러 로깅** (timestamp, context, stack trace)
- ✅ **에러 컨텍스트 정보** (어디서, 왜 발생했는지)
- ✅ **사용자 친화적 메시지** 자동 변환
- ✅ **개발/프로덕션 환경 구분** 로깅

---

## 🏗️ 커스텀 에러 클래스

### 1. AppError (기본 에러)

모든 커스텀 에러의 부모 클래스입니다.

```typescript
throw new AppError(
  '에러 메시지',
  500,  // HTTP 상태 코드
  true, // 운영 가능한 에러인지 (복구 가능)
  { key: 'value' }  // 컨텍스트 정보
)
```

### 2. RepositoryError (데이터 접근 에러)

```typescript
import { RepositoryError } from '@/lib/errors/custom-errors'

throw new RepositoryError(
  '장바구니 조회 중 오류가 발생했습니다.',
  {
    method: 'findBySessionOrUser',
    sessionId: 'abc123'
  },
  originalError  // 원본 에러 (선택)
)
```

**언제 사용:**
- Repository 레이어에서 DB 작업 실패 시
- Prisma 쿼리 오류 시
- 데이터 무결성 문제 시

### 3. ServiceError (비즈니스 로직 에러)

```typescript
import { ServiceError } from '@/lib/errors/custom-errors'

throw new ServiceError(
  '재고가 부족합니다.',
  400,  // HTTP 상태 코드
  {
    productId: 'prod-123',
    requestedQuantity: 10,
    availableStock: 5
  }
)
```

**언제 사용:**
- Service 레이어에서 비즈니스 규칙 위반 시
- 외부 API 호출 실패 시
- 복잡한 처리 로직 오류 시

### 4. ValidationError (검증 에러)

```typescript
import { ValidationError } from '@/lib/errors/custom-errors'

throw new ValidationError(
  '입력값이 유효하지 않습니다.',
  {
    email: ['이메일 형식이 올바르지 않습니다.'],
    password: ['비밀번호는 8자 이상이어야 합니다.']
  }
)
```

**HTTP 상태 코드:** 400

### 5. NotFoundError (리소스 없음)

```typescript
import { NotFoundError } from '@/lib/errors/custom-errors'

throw new NotFoundError('상품', 'product-123')
// 메시지: "상품(을)를 찾을 수 없습니다: product-123"
```

**HTTP 상태 코드:** 404

### 6. UnauthorizedError (인증 필요)

```typescript
import { UnauthorizedError } from '@/lib/errors/custom-errors'

throw new UnauthorizedError('로그인이 필요합니다.')
```

**HTTP 상태 코드:** 401

### 7. ForbiddenError (권한 없음)

```typescript
import { ForbiddenError } from '@/lib/errors/custom-errors'

throw new ForbiddenError('관리자만 접근할 수 있습니다.')
```

**HTTP 상태 코드:** 403

### 8. BusinessLogicError (비즈니스 규칙 위반)

```typescript
import { BusinessLogicError } from '@/lib/errors/custom-errors'

throw new BusinessLogicError(
  '배송 완료된 주문은 취소할 수 없습니다.',
  { orderId: 'order-123', status: 'DELIVERED' }
)
```

**HTTP 상태 코드:** 422

---

## 📝 에러 로깅

### 1. logError (에러 로깅)

```typescript
import { logError } from '@/lib/utils/error-logger'

try {
  // 작업 수행
} catch (error) {
  logError(error as Error, {
    userId: 'user-123',
    requestId: 'req-456',
    path: '/api/cart',
    method: 'POST'
  })
  throw error
}
```

**출력 예시 (개발 환경):**
```
========== ERROR LOG ==========
Timestamp: 2025-10-30T12:34:56.789Z
Level: ERROR
Error: RepositoryError
Message: 장바구니 조회 중 오류가 발생했습니다.
Status Code: 500
Operational: true
Error Context: {
  "method": "findBySessionOrUser",
  "sessionId": "abc123",
  "layer": "Repository"
}
Request Context: {
  "userId": "user-123",
  "path": "/api/cart"
}
Stack: RepositoryError: 장바구니 조회 중...
    at CartRepository.findBySessionOrUser (...)
===============================
```

### 2. logWarning (경고 로깅)

```typescript
import { logWarning } from '@/lib/utils/error-logger'

logWarning('캐시 연결 실패, DB로 폴백', {
  cacheKey: 'products:page:1'
})
```

### 3. logPerformance (성능 로깅)

```typescript
import { logPerformance } from '@/lib/utils/error-logger'

const start = Date.now()
const result = await someOperation()
const duration = Date.now() - start

logPerformance('someOperation', duration, {
  userId: 'user-123'
})
```

**1초 이상 소요 시 자동으로 경고 로그 발생**

---

## 💡 사용 예제

### 1. Repository에서 에러 처리

```typescript
// lib/repositories/cart-repository-improved.ts

import { RepositoryError, NotFoundError } from '@/lib/errors/custom-errors'
import { logError } from '@/lib/utils/error-logger'

export class CartRepository {
  async findById(cartId: string): Promise<Cart | null> {
    try {
      // 입력 검증
      if (!cartId) {
        throw new RepositoryError('장바구니 ID가 필요합니다.', {
          method: 'findById',
          cartId
        })
      }

      // DB 조회
      const cart = await prisma.cart.findUnique({
        where: { id: cartId }
      })

      return cart
    } catch (error) {
      // 이미 RepositoryError인 경우 그대로 throw
      if (error instanceof RepositoryError) {
        throw error
      }

      // Prisma Not Found 에러 처리
      if ((error as any).code === 'P2025') {
        throw new NotFoundError('장바구니', cartId, {
          method: 'findById'
        })
      }

      // 다른 에러는 로깅 후 RepositoryError로 래핑
      logError(error as Error, {
        repository: 'CartRepository',
        method: 'findById',
        cartId
      })

      throw new RepositoryError(
        '장바구니 조회 중 오류가 발생했습니다.',
        { method: 'findById', cartId },
        error as Error
      )
    }
  }
}
```

### 2. Service에서 에러 처리

```typescript
// lib/services/order-service.ts

import { ServiceError, BusinessLogicError } from '@/lib/errors/custom-errors'

export class OrderService {
  async cancelOrder(orderId: string): Promise<Order> {
    try {
      const order = await this.orderRepo.findById(orderId)

      if (!order) {
        throw new ServiceError('주문을 찾을 수 없습니다.', 404, {
          orderId
        })
      }

      // 비즈니스 규칙 검증
      if (order.shippingStatus === 'DELIVERED') {
        throw new BusinessLogicError(
          '배송 완료된 주문은 취소할 수 없습니다.',
          {
            orderId,
            shippingStatus: order.shippingStatus
          }
        )
      }

      // 주문 취소 처리
      return await this.orderRepo.updateStatus(orderId, 'CANCELED')
    } catch (error) {
      // AppError는 그대로 throw
      if (error instanceof ServiceError || error instanceof BusinessLogicError) {
        throw error
      }

      // 다른 에러는 ServiceError로 래핑
      throw new ServiceError(
        '주문 취소 중 오류가 발생했습니다.',
        500,
        { orderId },
        error as Error
      )
    }
  }
}
```

### 3. API Route에서 에러 처리

**방법 1: handleAPIError 사용 (권장)**

```typescript
// app/api/cart/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { handleAPIError } from '@/lib/middleware/error-handler'
import { getCartService } from '@/lib/services/cart-service'

const cartService = getCartService()

export async function GET(request: NextRequest) {
  return handleAPIError(async () => {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      throw new ValidationError('세션 ID가 필요합니다.')
    }

    const cart = await cartService.getCart(sessionId)

    return NextResponse.json({
      success: true,
      cart
    })
  }, request)
}
```

**방법 2: try-catch 수동 처리**

```typescript
export async function POST(request: NextRequest) {
  try {
    const { sessionId, productId, quantity } = await request.json()

    const cart = await cartService.addToCart(sessionId, productId, quantity)

    return NextResponse.json({
      success: true,
      cart
    })
  } catch (error) {
    // AppError 처리
    if (isAppError(error)) {
      logError(error, {
        path: request.url,
        method: request.method
      })

      return NextResponse.json(
        {
          success: false,
          error: error.message
        },
        { status: error.statusCode }
      )
    }

    // 일반 에러 처리
    logError(error as Error, {
      path: request.url,
      method: request.method
    })

    return NextResponse.json(
      {
        success: false,
        error: '오류가 발생했습니다.'
      },
      { status: 500 }
    )
  }
}
```

### 4. 성능 측정과 에러 처리 결합

```typescript
import { measurePerformance } from '@/lib/utils/error-logger'

export class ProductService {
  async getProducts(page: number) {
    return measurePerformance(
      'getProducts',
      async () => {
        // 로직 수행
        const products = await this.productRepo.findMany({ page })
        return products
      },
      { page }
    )()
  }
}
```

**효과:**
- 성능 자동 측정 및 로깅
- 에러 발생 시 자동 로깅 (에러 + 성능 정보)

---

## ✅ Best Practices

### 1. 에러는 가능한 빨리 발생시키기

```typescript
// ✅ 좋은 예
async function addToCart(sessionId: string, productId: string) {
  if (!sessionId) {
    throw new ValidationError('세션 ID가 필요합니다.')
  }
  if (!productId) {
    throw new ValidationError('상품 ID가 필요합니다.')
  }
  // ... 로직
}

// ❌ 나쁜 예
async function addToCart(sessionId: string, productId: string) {
  // ... 로직 수행 후
  if (!sessionId) {
    return null  // 에러를 숨김
  }
}
```

### 2. 에러 메시지는 명확하게

```typescript
// ✅ 좋은 예
throw new ServiceError('재고가 부족합니다. 요청: 10개, 재고: 5개', 400, {
  requestedQuantity: 10,
  availableStock: 5
})

// ❌ 나쁜 예
throw new Error('에러 발생')
```

### 3. 에러 컨텍스트 정보 포함

```typescript
// ✅ 좋은 예
throw new RepositoryError('주문 조회 실패', {
  method: 'findById',
  orderId,
  userId,
  timestamp: new Date()
})

// ❌ 나쁜 예
throw new Error('주문 조회 실패')
```

### 4. 원본 에러 보존

```typescript
// ✅ 좋은 예
try {
  await prisma.cart.findUnique(...)
} catch (error) {
  throw new RepositoryError(
    '장바구니 조회 실패',
    { cartId },
    error as Error  // 원본 에러 전달
  )
}

// ❌ 나쁜 예
try {
  await prisma.cart.findUnique(...)
} catch (error) {
  throw new Error('장바구니 조회 실패')  // 원본 정보 손실
}
```

### 5. 에러 타입별 분리

```typescript
// ✅ 좋은 예
if (!user) {
  throw new UnauthorizedError('로그인이 필요합니다.')
}

if (user.role !== 'ADMIN') {
  throw new ForbiddenError('관리자 권한이 필요합니다.')
}

if (!product) {
  throw new NotFoundError('상품', productId)
}

// ❌ 나쁜 예
if (!user || user.role !== 'ADMIN' || !product) {
  throw new Error('에러')
}
```

---

## 📊 에러 추적 시스템

### 개발 환경
```
========== ERROR LOG ==========
✅ Timestamp: 2025-10-30T12:34:56.789Z
✅ Level: ERROR
✅ Error: RepositoryError
✅ Message: 명확한 메시지
✅ Status Code: 500
✅ Context: 상세한 컨텍스트 정보
✅ Stack Trace: 전체 스택
===============================
```

### 프로덕션 환경
```json
{
  "timestamp": "2025-10-30T12:34:56.789Z",
  "level": "error",
  "name": "RepositoryError",
  "message": "장바구니 조회 중 오류 발생",
  "statusCode": 500,
  "context": {
    "method": "findById",
    "cartId": "cart-123",
    "layer": "Repository"
  }
}
```

**로그 수집 도구 연동 가능:**
- Sentry
- LogRocket
- Datadog
- CloudWatch

---

## 🎯 요약

### 에러 처리 플로우
```
1. Repository: RepositoryError 발생
   ↓
2. Service: ServiceError로 래핑 (필요시)
   ↓
3. API Route: handleAPIError로 처리
   ↓
4. Response: 사용자 친화적 메시지 반환
```

### 장점
- ✅ **추적 용이**: 명확한 에러 컨텍스트
- ✅ **디버깅 빠름**: 구조화된 로그
- ✅ **유지보수 쉬움**: 일관된 에러 처리
- ✅ **사용자 경험**: 친화적 메시지

---

**이제 에러 추적이 훨씬 쉬워졌습니다!** 🎉
