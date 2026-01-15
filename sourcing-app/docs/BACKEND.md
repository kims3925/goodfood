# 백엔드 규칙

> **관련 문서:** [STRUCTURE.md](./STRUCTURE.md) | [API.md](./API.md) | [DATABASE.md](./DATABASE.md) | [CLAUDE.md](../CLAUDE.md)

---

## 기술 스택

| 항목 | 기술 |
|-----|-----|
| Framework | Next.js 14.2.3 (App Router) |
| Language | TypeScript 5.9 |
| ORM | Prisma 6.19 |
| Auth | NextAuth.js 4.24 (JWT) |
| Validation | Zod |

---

## 핵심 원칙

| 원칙 | 설명 |
|-----|-----|
| 비즈니스 도메인 최우선 표현 | 기술보다 비즈니스 |
| Route Handler 얇게, Service 두껍게 | 로직은 Service에 |
| 암시적보다 명시적 | 예측 가능한 동작 |
| 단기 편의 < 장기 안정성 | 유지보수 우선 |

---

## 계층 구조

```
Route Handler → Service → Repository (Prisma)
```

| Layer | 책임 | 위치 |
|-------|-----|-----|
| Route Handler | 요청/응답 처리, 인증 검증 | `app/api/` |
| Service | 비즈니스 로직, 트랜잭션 | `lib/services/` |
| Repository | 데이터 접근 | `lib/repositories/` 또는 Prisma 직접 |

### 예시

```typescript
// app/api/products/route.ts (Route Handler)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return unauthorized()

  const body = await request.json()
  const result = await productService.create(body, session.user.id)
  return NextResponse.json({ success: true, data: result })
}

// lib/services/product.ts (Service)
export async function create(data: CreateProductInput, userId: number) {
  // 비즈니스 검증
  // Prisma 트랜잭션
  // 결과 반환
}
```

---

## Route Handler 규칙

| 규칙 |
|-----|
| 인증/권한 검증만 수행 |
| 입력값 Zod 검증 |
| Service 단일 호출 |
| try-catch로 에러 핸들링 |
| Prisma 직접 호출 금지 (Service 사용) |

### 패턴

```typescript
// app/api/orders/route.ts
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 검증
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH.UNAUTHORIZED' } },
        { status: 401 }
      )
    }

    // 2. 입력값 검증
    const body = await request.json()
    const result = orderSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: 'COMMON.VALIDATION_ERROR' } },
        { status: 422 }
      )
    }

    // 3. Service 호출
    const order = await orderService.create(result.data, session.user.id)

    // 4. 응답
    return NextResponse.json({ success: true, data: order }, { status: 201 })

  } catch (error) {
    console.error('Order creation failed:', error)
    return NextResponse.json(
      { success: false, error: { code: 'COMMON.INTERNAL_ERROR' } },
      { status: 500 }
    )
  }
}
```

---

## Service 규칙

| 규칙 |
|-----|
| 하나의 함수 = 하나의 유스케이스 |
| 여러 테이블 변경 시 Prisma 트랜잭션 사용 |
| 비즈니스 검증 로직 포함 |
| 외부 API 호출 시 에러 핸들링 |

### 트랜잭션 패턴

```typescript
// lib/services/order.ts
export async function create(data: CreateOrderInput, userId: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. 재고 확인
    const product = await tx.product.findUnique({
      where: { id: data.productId }
    })
    if (product.stock < data.quantity) {
      throw new Error('PRODUCT.OUT_OF_STOCK')
    }

    // 2. 재고 차감
    await tx.product.update({
      where: { id: data.productId },
      data: { stock: { decrement: data.quantity } }
    })

    // 3. 주문 생성
    const order = await tx.order.create({
      data: {
        userId,
        ...data
      }
    })

    return order
  })
}
```

---

## Prisma 사용 규칙

| 규칙 |
|-----|
| N+1 방지: `include` 사용 |
| Soft Delete: `deletedAt` 필드 사용 |
| 조회 시 `deletedAt: null` 조건 |
| 복잡한 쿼리는 Raw Query 허용 (parameterized) |

### N+1 방지

```typescript
// Bad - N+1 발생
const orders = await prisma.order.findMany()
for (const order of orders) {
  order.items = await prisma.orderItem.findMany({
    where: { orderId: order.id }
  })
}

// Good - include 사용
const orders = await prisma.order.findMany({
  include: { items: true }
})
```

### Soft Delete

```typescript
// 삭제
await prisma.product.update({
  where: { id },
  data: { deletedAt: new Date() }
})

// 조회 (삭제되지 않은 것만)
await prisma.product.findMany({
  where: { deletedAt: null }
})
```

---

## 외부 API 연동

### Band API

```typescript
// lib/services/band.ts
export async function fetchPosts(channelId: string, sessionCookie: string) {
  try {
    const response = await fetch(`${BAND_API_URL}/posts`, {
      headers: { Cookie: sessionCookie }
    })
    if (!response.ok) {
      throw new Error('SOURCING.BAND_API_ERROR')
    }
    return await response.json()
  } catch (error) {
    console.error('Band API error:', error)
    throw error
  }
}
```

### Toss Payments

```typescript
// lib/services/payment.ts
export async function confirmPayment(paymentKey: string, orderId: string, amount: number) {
  const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ paymentKey, orderId, amount })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error('PAYMENT.CONFIRM_FAILED')
  }

  return await response.json()
}
```

---

## 에러 처리

### 커스텀 에러 클래스

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message?: string
  ) {
    super(message || code)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource.toUpperCase()}.NOT_FOUND`, 404)
  }
}

export class ValidationError extends AppError {
  constructor(message?: string) {
    super('COMMON.VALIDATION_ERROR', 422, message)
  }
}
```

### Route Handler에서 사용

```typescript
try {
  const product = await productService.findById(id)
  if (!product) {
    throw new NotFoundError('product')
  }
  return NextResponse.json({ success: true, data: product })
} catch (error) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false, error: { code: error.code } },
      { status: error.statusCode }
    )
  }
  return NextResponse.json(
    { success: false, error: { code: 'COMMON.INTERNAL_ERROR' } },
    { status: 500 }
  )
}
```

---

## 환경 변수

| 변수 | 용도 |
|-----|-----|
| DATABASE_URL | Prisma DB 연결 |
| NEXTAUTH_SECRET | NextAuth 암호화 |
| NEXTAUTH_URL | 인증 콜백 URL |
| TOSS_SECRET_KEY | Toss 결제 API |
| BAND_CLIENT_ID | Band API |
| GEMINI_API_KEY | AI 변환 |

### 접근 패턴

```typescript
// 서버 컴포넌트/API Route에서만
const apiKey = process.env.TOSS_SECRET_KEY

// 클라이언트 노출 시 NEXT_PUBLIC_ 접두사
const publicKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
```

---

## 금지사항

| 금지 | 이유 |
|-----|-----|
| Route Handler에 비즈니스 로직 | 테스트/재사용 어려움 |
| 트랜잭션 없이 다중 테이블 변경 | 데이터 정합성 |
| 하드코딩 설정값 | 환경변수 사용 |
| Prisma 직접 호출 (Route Handler) | Service 계층 사용 |
| 민감정보 로깅 | 보안 |
| try-catch 없이 외부 API 호출 | 서버 크래시 방지 |

---

## 주요 서비스

### Order Service (`src/services/order.service.ts`)

**외부 주문 생성 (`createExternalOrder`)**

외부 채널(밴드, 문자 등)에서 받은 주문을 시스템에 등록하는 서비스입니다.

**주요 기능:**

1. **배송비 포함 판매가 계산**
   ```typescript
   // calculateSellingPrice 함수 사용
   const sellingPrice = calculateSellingPrice(basePrice, shippingFee, bundleShippingType)
   ```

2. **합배송 규칙 적용**
   ```typescript
   if (bundleShippingType === 'INCLUDED') {
     // 배송비 포함 상품: unitPrice * quantity
     totalPrice = unitPrice.mul(quantity)
   } else {
     // 배송비 별도 상품: (basePrice * quantity) + shippingFee (1회만)
     totalPrice = new Decimal(basePrice).mul(quantity).add(shippingFee)
   }
   ```

3. **결제금액 수동 조정**
   ```typescript
   if (customTotalAmount !== undefined && customTotalAmount !== null) {
     finalTotalAmount = new Decimal(customTotalAmount)
     discountAmount = subtotal.sub(finalTotalAmount)
   } else {
     finalTotalAmount = subtotal
     discountAmount = new Decimal(0)
   }
   ```

**파라미터:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| userId | number | O | 사용자 ID |
| shopId | number | O | 쇼핑몰 ID |
| guestName | string | O | 고객명 |
| guestPhone | string | O | 전화번호 |
| items | array | O | 주문 상품 목록 |
| customTotalAmount | number | X | 수동 입력 결제금액 |

**변경 이력:**
- TR-20260115-007: 배송비 반영 및 결제금액 수동 조정 기능 추가

---

## 가격 계산

### Price Calculator (`src/lib/price-calculator.ts`)

**배송비 포함 판매가 계산 (`calculateSellingPrice`)**

```typescript
export function calculateSellingPrice(
  basePrice: number,
  shippingFee: number,
  bundleShippingType: BundleShippingType | string | null
): number {
  if (bundleShippingType === 'INCLUDED') {
    return basePrice // 배송비 이미 포함
  }
  return basePrice + shippingFee // 배송비 추가
}
```

**배송 타입:**

| 타입 | 설명 | 계산 방식 |
|------|------|----------|
| INCLUDED | 배송비 포함 | 판매가 = 소매가 |
| SEPARATE | 배송비 별도 | 판매가 = 소매가 + 배송비 |
| NONE | 합배송 없음 | 판매가 = 소매가 + 배송비 |

**마진 계산:**

```
마진액 = (판매가 - 도매가) - 실제 배송비용

- INCLUDED: 마진 = (소매가 - 도매가) - 0
- SEPARATE: 마진 = (소매가 - 도매가) - 배송비 (1회)
- NONE: 마진 = (소매가 - 도매가) - (배송비 × 아이템 수)
```

**변경 이력:**
- TR-20260115-008: 대시보드 마진액 계산 버그 수정 (INCLUDED 타입 처리)

