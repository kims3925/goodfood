# API 규칙

> **관련 문서:** [STRUCTURE.md](./STRUCTURE.md) | [SECURITY.md](./SECURITY.md) | [../CLAUDE.md](../CLAUDE.md)

---

## Next.js API Routes 구조 (shop-app)

```text
app/api/
├── auth/                        # 인증
│   ├── [...nextauth]/           # NextAuth.js
│   ├── signup/                  # 회원가입
│   ├── check-email/             # 이메일 중복 확인
│   └── complete/                # 회원가입 완료
│
├── cart/                        # 장바구니
│   ├── route.ts                 # GET, POST, DELETE
│   └── items/[id]/              # 개별 아이템 관리
│
├── orders/                      # 주문 (회원)
│   ├── route.ts                 # POST (주문 생성)
│   ├── prepare/                 # 주문 준비 (결제 전)
│   ├── bank-transfer/           # 무통장 입금 주문
│   └── [id]/
│       ├── route.ts             # GET (주문 조회)
│       └── cancel/              # 주문 취소
│
├── guest-orders/                # 비회원 주문
│   ├── prepare/                 # 주문 준비
│   ├── bank-transfer/           # 무통장 입금
│   ├── lookup/                  # 주문 조회
│   └── [id]/
│       ├── route.ts             # GET
│       └── cancel/              # 취소
│
├── payments/                    # 결제
│   ├── confirm/                 # 결제 승인
│   ├── cancel/                  # 결제 취소/환불
│   ├── retry/                   # 결제 재시도
│   ├── status/                  # 결제 상태 조회
│   └── webhook/                 # Toss Payments 웹훅
│
├── guest-payments/              # 비회원 결제
│   └── confirm/                 # 비회원 결제 승인
│
├── mypage/                      # 마이페이지
│   ├── profile/                 # 프로필 조회/수정
│   ├── orders/                  # 주문 내역
│   ├── addresses/               # 배송지 관리
│   ├── coupons/                 # 쿠폰 목록
│   ├── wishlist/                # 찜 목록
│   ├── reviews/                 # 리뷰 목록
│   ├── inquiries/               # 문의 내역
│   └── returns/                 # 반품 내역
│
├── shop/                        # 쇼핑몰
│   ├── products/                # 상품 목록/상세
│   ├── product-publish/[id]/    # 발행 상품 조회
│   ├── sections/                # 메인 섹션
│   └── settings/                # 쇼핑몰 설정
│
├── cs/                          # 고객 서비스
│   └── inquiry/                 # 문의 등록
│
├── policies/                    # 정책 문서
│   └── route.ts                 # 이용약관, 개인정보처리방침
│
├── internal/                    # 내부 API
│   ├── shop/[subdomain]/        # 서브도메인별 쇼핑몰 조회
│   └── channel/[subdomain]/     # 서브도메인별 채널 조회
│
├── cron/                        # 스케줄 작업
│   └── cancel-expired-orders/   # 만료 주문 자동 취소
│
└── images/                      # 이미지 서빙
    ├── product/file/[filename]/ # 상품 이미지
    └── post/file/[filename]/    # 게시물 이미지
```

---

## 주요 API 엔드포인트

### 인증

| Method | Path | 설명 | Auth |
|--------|------|-----|------|
| POST | `/api/auth/signup` | 회원가입 | - |
| POST | `/api/auth/check-email` | 이메일 중복 확인 | - |
| POST | `/api/auth/complete` | 회원가입 완료 | - |

### 장바구니

| Method | Path | 설명 | Auth |
|--------|------|-----|------|
| GET | `/api/cart` | 장바구니 조회 | ✅ |
| POST | `/api/cart` | 장바구니 추가 | ✅ |
| DELETE | `/api/cart` | 장바구니 전체 삭제 | ✅ |
| PATCH | `/api/cart/items/[id]` | 수량 변경 | ✅ |
| DELETE | `/api/cart/items/[id]` | 아이템 삭제 | ✅ |

### 주문 (회원)

| Method | Path | 설명 | Auth |
|--------|------|-----|------|
| POST | `/api/orders/prepare` | 주문 준비 (결제 전) | ✅ |
| POST | `/api/orders` | 주문 생성 | ✅ |
| POST | `/api/orders/bank-transfer` | 무통장 입금 주문 | ✅ |
| GET | `/api/orders/[id]` | 주문 상세 조회 | ✅ |
| POST | `/api/orders/[id]/cancel` | 주문 취소 | ✅ |

### 비회원 주문

| Method | Path | 설명 | Auth |
|--------|------|-----|------|
| POST | `/api/guest-orders/prepare` | 비회원 주문 준비 | - |
| POST | `/api/guest-orders/bank-transfer` | 비회원 무통장 입금 | - |
| POST | `/api/guest-orders/lookup` | 비회원 주문 조회 | - |
| GET | `/api/guest-orders/[id]` | 주문 상세 | - |
| POST | `/api/guest-orders/[id]/cancel` | 주문 취소 | - |

### 결제

| Method | Path | 설명 | Auth |
|--------|------|-----|------|
| POST | `/api/payments/confirm` | 결제 승인 | ✅ |
| POST | `/api/payments/cancel` | 결제 취소 | ✅ |
| POST | `/api/payments/retry` | 결제 재시도 | ✅ |
| GET | `/api/payments/status` | 결제 상태 조회 | ✅ |
| POST | `/api/payments/webhook` | Toss 웹훅 (가상계좌) | - |
| POST | `/api/guest-payments/confirm` | 비회원 결제 승인 | - |

### 마이페이지

| Method | Path | 설명 | Auth |
|--------|------|-----|------|
| GET | `/api/mypage/profile` | 프로필 조회 | ✅ |
| PATCH | `/api/mypage/profile` | 프로필 수정 | ✅ |
| GET | `/api/mypage/orders` | 주문 내역 | ✅ |
| GET | `/api/mypage/addresses` | 배송지 목록 | ✅ |
| POST | `/api/mypage/addresses` | 배송지 추가 | ✅ |
| PATCH | `/api/mypage/addresses/[id]` | 배송지 수정 | ✅ |
| DELETE | `/api/mypage/addresses/[id]` | 배송지 삭제 | ✅ |
| GET | `/api/mypage/coupons` | 쿠폰 목록 | ✅ |

### 쇼핑몰

| Method | Path | 설명 | Auth |
|--------|------|-----|------|
| GET | `/api/shop/products` | 상품 목록 | - |
| GET | `/api/shop/products/[id]` | 상품 상세 | - |
| GET | `/api/shop/products/[id]/reviews` | 상품 리뷰 | - |
| GET | `/api/shop/sections` | 메인 섹션 | - |
| GET | `/api/shop/settings` | 쇼핑몰 설정 | - |

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

### 장바구니 (CART)

| Code | HTTP | 설명 |
|------|------|-----|
| CART.ITEM_NOT_FOUND | 404 | 장바구니 아이템 없음 |
| CART.EMPTY | 422 | 장바구니 비어있음 |
| CART.MAX_QUANTITY_EXCEEDED | 422 | 최대 수량 초과 |
| CART.INVALID_QUANTITY | 422 | 잘못된 수량 |

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

### Toss Payments

| 항목 | 값 |
|-----|---|
| Base URL | `https://api.tosspayments.com/v1` |
| Auth | Basic Auth (Secret Key) |
| Widget SDK | `@tosspayments/payment-widget-sdk` |

#### 주요 API

| Method | Endpoint | 설명 |
|--------|----------|-----|
| POST | `/payments/confirm` | 결제 승인 |
| POST | `/payments/{paymentKey}/cancel` | 결제 취소/환불 |
| GET | `/payments/orders/{orderId}` | 주문 ID로 결제 조회 |
| GET | `/payments/{paymentKey}` | 결제 키로 조회 |

#### 결제 수단별 처리

| 결제 수단 | 처리 방식 |
|----------|---------|
| 카드 | 즉시 승인 |
| 가상계좌 | 입금 대기 → 웹훅으로 완료 처리 |
| 계좌이체 | 즉시 승인 |
| 휴대폰 | 즉시 승인 |

---

## 페이지네이션

### 쿼리 파라미터

| Param | Type | Default | Max |
|-------|------|---------|-----|
| page | number | 1 | - |
| size | number | 20 | 100 |
| sort | string | - | field 및 방향(asc/desc) 지정 |

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
