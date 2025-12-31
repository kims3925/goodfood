# API 규칙

> **관련 문서:** [../STRUCTURE.md](../STRUCTURE.md) | [../SECURITY.md](../SECURITY.md) | [../CLAUDE.md](../CLAUDE.md)

---

## Next.js API Routes 구조

```text
app/api/
├── auth/                    # NextAuth.js 인증
│   └── [...nextauth]/
├── sourcing/               # 소싱 도메인
│   ├── channels/
│   ├── posts/
│   └── products/
├── shop/                   # 쇼핑몰 도메인
│   ├── products/
│   ├── orders/
│   └── cart/
├── payment/                # 결제
│   ├── confirm/
│   └── webhook/
└── automation/             # 자동화
    └── pipeline/
```

---

## Route Handler 패턴

### 기본 구조

```typescript
// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH.UNAUTHORIZED' } },
      { status: 401 }
    )
  }

  // 비즈니스 로직
  return NextResponse.json({ success: true, data: {} })
}
```

### 동적 라우트

```typescript
// app/api/products/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  // ...
}
```

---

## 인증

### NextAuth.js 세션

| 항목 | 값 |
|-----|---|
| Provider | Credentials |
| Session Strategy | JWT |
| Token 저장 | HttpOnly Cookie |
| 만료 | 24시간 |

### 세션 검증 패턴

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// API Route 내부
const session = await getServerSession(authOptions)
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const userId = session.user.id
```

---

## 응답 형식

### 성공

```json
{
  "success": true,
  "data": {}
}
```

### 목록 (페이지네이션)

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "size": 20,
      "totalItems": 150,
      "totalPages": 8
    }
  }
}
```

### 에러

```json
{
  "success": false,
  "error": {
    "code": "DOMAIN.ERROR_NAME",
    "message": "사용자 친화적 메시지"
  }
}
```

---

## HTTP 상태 코드

| Status | 용도 |
|--------|-----|
| 200 | 조회/수정 성공 |
| 201 | 생성 성공 |
| 204 | 삭제 성공 |
| 400 | 잘못된 요청 형식 |
| 401 | 인증 필요/실패 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복) |
| 422 | 비즈니스 규칙 위반 |
| 500 | 서버 오류 |

---

## 에러 코드

### 공통

| Code | HTTP | 설명 |
|------|------|-----|
| COMMON.VALIDATION_ERROR | 422 | 입력값 검증 실패 |
| COMMON.NOT_FOUND | 404 | 리소스 없음 |
| COMMON.INTERNAL_ERROR | 500 | 서버 내부 오류 |

### 인증 (AUTH)

| Code | HTTP | 설명 |
|------|------|-----|
| AUTH.UNAUTHORIZED | 401 | 인증 필요 |
| AUTH.INVALID_CREDENTIALS | 401 | 잘못된 자격증명 |
| AUTH.SESSION_EXPIRED | 401 | 세션 만료 |
| AUTH.FORBIDDEN | 403 | 권한 부족 |

### 소싱 (SOURCING)

| Code | HTTP | 설명 |
|------|------|-----|
| SOURCING.BAND_API_ERROR | 502 | Band API 호출 실패 |
| SOURCING.BAND_SESSION_EXPIRED | 401 | Band 세션 만료 |
| SOURCING.AI_TRANSFORM_FAILED | 422 | AI 변환 실패 |
| SOURCING.CHANNEL_NOT_FOUND | 404 | 채널 없음 |

### 상품 (PRODUCT)

| Code | HTTP | 설명 |
|------|------|-----|
| PRODUCT.NOT_FOUND | 404 | 상품 없음 |
| PRODUCT.OUT_OF_STOCK | 422 | 재고 없음 |
| PRODUCT.INVALID_OPTION | 422 | 잘못된 옵션 |

### 주문 (ORDER)

| Code | HTTP | 설명 |
|------|------|-----|
| ORDER.NOT_FOUND | 404 | 주문 없음 |
| ORDER.INVALID_STATUS | 422 | 잘못된 상태 전이 |
| ORDER.ALREADY_CANCELLED | 409 | 이미 취소됨 |

### 결제 (PAYMENT)

| Code | HTTP | 설명 |
|------|------|-----|
| PAYMENT.CONFIRM_FAILED | 422 | 결제 승인 실패 |
| PAYMENT.AMOUNT_MISMATCH | 422 | 금액 불일치 |
| PAYMENT.REFUND_FAILED | 422 | 환불 실패 |

---

## 입력 검증 (Zod)

```typescript
import { z } from 'zod'

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.number(),
    variantId: z.number().optional(),
    quantity: z.number().positive()
  })),
  shippingAddress: z.object({
    name: z.string().min(1),
    phone: z.string().regex(/^01[0-9]{8,9}$/),
    address: z.string().min(1),
    detail: z.string().optional()
  })
})

// Route Handler에서 사용
const body = await request.json()
const result = orderSchema.safeParse(body)
if (!result.success) {
  return NextResponse.json(
    { success: false, error: { code: 'COMMON.VALIDATION_ERROR', details: result.error.issues } },
    { status: 422 }
  )
}
```

---

## 외부 API 연동

### Band Open API

| 항목 | 값 |
|-----|---|
| Base URL | `https://openapi.band.us` |
| Auth | OAuth2 + Session Cookie |
| Rate Limit | 100 req/min |

### Toss Payments

| 항목 | 값 |
|-----|---|
| Base URL | `https://api.tosspayments.com/v1` |
| Auth | Basic Auth (Secret Key) |
| 결제 승인 | POST `/payments/confirm` |

### Gemini AI

| 항목 | 값 |
|-----|---|
| Base URL | `https://generativelanguage.googleapis.com` |
| Auth | API Key |
| 용도 | 상품 정보 추출 |

---

## 페이지네이션

### 쿼리 파라미터

| Param | Type | Default | Max |
|-------|------|---------|-----|
| page | number | 1 | - |
| size | number | 20 | 100 |
| sort | string | - | `field:asc|desc` |

### 사용 예시

```typescript
// URL: /api/products?page=2&size=10&sort=createdAt:desc

const url = new URL(request.url)
const page = Number(url.searchParams.get('page')) || 1
const size = Math.min(Number(url.searchParams.get('size')) || 20, 100)
const skip = (page - 1) * size

const [items, total] = await Promise.all([
  prisma.product.findMany({ skip, take: size }),
  prisma.product.count()
])

return NextResponse.json({
  success: true,
  data: {
    items,
    pagination: {
      page,
      size,
      totalItems: total,
      totalPages: Math.ceil(total / size)
    }
  }
})
```

---

## 금지사항

| 금지 | 이유 |
|-----|-----|
| try-catch 없이 외부 API 호출 | 서버 크래시 방지 |
| 민감정보 응답 노출 | 보안 |
| 하드코딩된 에러 메시지 | 일관성 |
| 인증 없이 민감 데이터 반환 | 보안 |
