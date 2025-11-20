# BandAuto E-Commerce API Documentation

## 개요

BandAuto E-Commerce App의 REST API 문서입니다. 모든 API는 `/api` 경로를 기본으로 합니다.

**Base URL**: `http://localhost:3000/api`

---

## 🛒 Cart API

장바구니 관리 API

### GET /api/cart
장바구니 조회

**인증**: 선택 (비회원 가능)

**응답**:
```json
{
  "cart": {
    "id": 1,
    "sessionId": "uuid-session-id",
    "userId": 1,
    "items": [
      {
        "id": 1,
        "productId": 1,
        "quantity": 2,
        "priceAt": 15000,
        "product": {
          "id": 1,
          "title": "상품명",
          "salePrice": 15000,
          "images": "image-url",
          "isAvailable": true,
          "shippingFee": 3000
        }
      }
    ],
    "totalItems": 2,
    "totalAmount": 30000,
    "shippingFee": 0,
    "finalAmount": 30000
  },
  "sessionId": "uuid-session-id"
}
```

---

### POST /api/cart
장바구니에 상품 추가

**인증**: 선택 (비회원 가능)

**요청 Body**:
```json
{
  "productId": 1,
  "quantity": 2
}
```

**응답**:
```json
{
  "cart": { /* 장바구니 객체 */ },
  "sessionId": "uuid-session-id"
}
```

**에러**:
- `400`: 상품 ID 누락
- `404`: 상품을 찾을 수 없음
- `400`: 구매 불가 상품

---

### PATCH /api/cart/items/:id
장바구니 아이템 수량 변경

**인증**: 선택 (비회원 가능)

**URL 파라미터**:
- `id`: 장바구니 아이템 ID

**요청 Body**:
```json
{
  "quantity": 3
}
```

**응답**:
```json
{
  "cart": { /* 업데이트된 장바구니 */ }
}
```

**에러**:
- `400`: 유효하지 않은 수량
- `401`: 세션 또는 로그인 필요

---

### DELETE /api/cart/items/:id
장바구니 아이템 삭제

**인증**: 선택 (비회원 가능)

**URL 파라미터**:
- `id`: 장바구니 아이템 ID

**응답**:
```json
{
  "cart": { /* 업데이트된 장바구니 */ }
}
```

---

### DELETE /api/cart
장바구니 전체 비우기

**인증**: 선택 (비회원 가능)

**응답**:
```json
{
  "success": true,
  "message": "장바구니가 비워졌습니다"
}
```

---

## 📦 Orders API

주문 관리 API

### POST /api/orders
주문 생성

**인증**: 선택 (비회원 가능)

**요청 Body**:
```json
{
  "productId": 1,
  "quantity": 2,
  "customerInfo": {
    "name": "홍길동",
    "phone": "010-1234-5678",
    "email": "user@example.com",
    "memo": "배송 메모"
  },
  "shippingAddress": {
    "zipCode": "12345",
    "address": "서울시 강남구 테헤란로 123",
    "detailAddress": "456호"
  }
}
```

**응답**:
```json
{
  "success": true,
  "order": {
    "id": "ORDER_123_abc",
    "orderNumber": "ORDER_123_abc",
    "totalAmount": 33000,
    "status": "PENDING",
    "paymentStatus": "PENDING",
    "customer": {
      "id": 1,
      "name": "홍길동",
      "phone": "010-1234-5678",
      "email": "user@example.com"
    },
    "product": {
      "id": 1,
      "title": "상품명",
      "salePrice": 15000,
      "images": "image-url"
    },
    "quantity": 2,
    "shippingAddress": { /* 배송 주소 */ },
    "createdAt": "2025-01-20T12:00:00Z"
  },
  "payment": {
    "amount": 33000,
    "orderId": "ORDER_123_abc",
    "orderName": "상품명 외 1건",
    "customerEmail": "user@example.com",
    "successUrl": "http://localhost:3000/payment/success",
    "failUrl": "http://localhost:3000/payment/fail"
  },
  "message": "주문이 성공적으로 생성되었습니다"
}
```

**에러**:
- `400`: 필수 파라미터 누락
- `404`: 상품을 찾을 수 없음
- `400`: 구매 불가 상품

---

### GET /api/orders
주문 목록 조회

**인증**: 필수

**Query 파라미터**:
- `page` (기본값: 1): 페이지 번호
- `limit` (기본값: 10): 페이지당 항목 수
- `status` (선택): 주문 상태 필터

**응답**:
```json
{
  "orders": [
    {
      "id": "ORDER_123_abc",
      "orderNumber": "ORDER_123_abc",
      "totalAmount": 33000,
      "status": "CONFIRMED",
      "paymentStatus": "PAID",
      "customer": { /* 고객 정보 */ },
      "product": { /* 상품 정보 */ },
      "quantity": 2,
      "createdAt": "2025-01-20T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

**에러**:
- `401`: 로그인 필요

---

### GET /api/orders/:id
주문 상세 조회

**인증**: 필수

**URL 파라미터**:
- `id`: 주문 번호

**응답**:
```json
{
  "order": {
    "id": "ORDER_123_abc",
    "orderNumber": "ORDER_123_abc",
    "totalAmount": 33000,
    "status": "CONFIRMED",
    "paymentStatus": "PAID",
    "customer": { /* 고객 정보 */ },
    "product": { /* 상품 정보 */ },
    "quantity": 2,
    "shippingAddress": { /* 배송 주소 */ },
    "payments": [
      {
        "id": 1,
        "paymentKey": "payment-key",
        "method": "카드",
        "amount": 33000,
        "status": "DONE",
        "approvedAt": "2025-01-20T12:05:00Z"
      }
    ],
    "createdAt": "2025-01-20T12:00:00Z",
    "paidAt": "2025-01-20T12:05:00Z"
  }
}
```

**에러**:
- `401`: 로그인 필요
- `404`: 주문을 찾을 수 없음
- `403`: 접근 권한 없음

---

### PATCH /api/orders/:id
주문 상태 업데이트 (관리자 전용)

**인증**: 필수 (관리자)

**URL 파라미터**:
- `id`: 주문 번호

**요청 Body**:
```json
{
  "status": "SHIPPED"
}
```

**응답**:
```json
{
  "success": true,
  "order": { /* 업데이트된 주문 */ },
  "message": "주문 상태가 업데이트되었습니다"
}
```

**에러**:
- `403`: 관리자 권한 필요
- `400`: 상태값 누락

---

## 💳 Payments API

토스페이먼츠 결제 API

### POST /api/payments/confirm
결제 승인

**인증**: 선택

**요청 Body**:
```json
{
  "paymentKey": "payment-key-from-toss",
  "orderId": "ORDER_123_abc",
  "amount": 33000
}
```

**응답**:
```json
{
  "success": true,
  "payment": {
    "paymentKey": "payment-key",
    "orderId": "ORDER_123_abc",
    "orderName": "상품명 외 1건",
    "method": "카드",
    "totalAmount": 33000,
    "status": "DONE",
    "approvedAt": "2025-01-20T12:05:00Z",
    "receipt": {
      "url": "https://receipt-url"
    }
  },
  "order": {
    "id": "ORDER_123_abc",
    "orderNumber": "ORDER_123_abc",
    "status": "CONFIRMED"
  }
}
```

**에러**:
- `400`: 필수 파라미터 누락
- `400`: 유효하지 않은 결제 금액
- `404`: 주문을 찾을 수 없음
- `400`: 주문 금액 불일치
- `400`: 결제 승인 실패

---

### POST /api/payments/cancel
결제 취소

**인증**: 필수

**요청 Body**:
```json
{
  "paymentKey": "payment-key",
  "cancelReason": "고객 변심",
  "cancelAmount": 33000  // 선택 (부분 취소 시)
}
```

**응답**:
```json
{
  "success": true,
  "refund": {
    "paymentKey": "payment-key",
    "status": "CANCELED",
    "cancels": [
      {
        "cancelAmount": 33000,
        "cancelReason": "고객 변심",
        "canceledAt": "2025-01-20T14:00:00Z"
      }
    ]
  },
  "message": "결제가 성공적으로 취소되었습니다"
}
```

**에러**:
- `401`: 로그인 필요
- `403`: 취소 권한 없음
- `404`: 결제 정보를 찾을 수 없음
- `400`: 이미 취소된 결제
- `400`: 결제 취소 실패

---

### POST /api/payments/webhook
토스페이먼츠 웹훅 수신

**인증**: 웹훅 서명 검증

**요청 Body**:
```json
{
  "eventType": "PAYMENT_STATUS_CHANGED",
  "createdAt": "2025-01-20T12:05:00Z",
  "data": {
    "paymentKey": "payment-key",
    "orderId": "ORDER_123_abc",
    "status": "DONE",
    "totalAmount": 33000,
    "method": "카드",
    "approvedAt": "2025-01-20T12:05:00Z"
  }
}
```

**응답**:
```json
{
  "success": true,
  "message": "결제 상태 업데이트 완료"
}
```

**에러**:
- `400`: 서명 검증 실패
- `500`: 웹훅 처리 실패

---

### GET /api/payments/webhook
웹훅 엔드포인트 상태 확인

**인증**: 없음

**응답**:
```json
{
  "status": "ok",
  "message": "토스페이먼츠 웹훅 엔드포인트가 정상 작동 중입니다",
  "endpoint": "/api/payments/webhook",
  "methods": ["POST"],
  "webhookSecret": "설정됨"
}
```

---

## 🔐 인증

### 세션 기반 인증
- 비회원: `cart_session` 쿠키로 세션 관리
- 회원: NextAuth.js 세션 인증

### 쿠키
- `cart_session`: 장바구니 세션 ID (HttpOnly, 7일 유효)
- `next-auth.session-token`: NextAuth 세션 토큰

---

## 🚨 에러 코드

| 코드 | 의미 |
|------|------|
| 400 | Bad Request - 잘못된 요청 |
| 401 | Unauthorized - 인증 필요 |
| 403 | Forbidden - 권한 없음 |
| 404 | Not Found - 리소스를 찾을 수 없음 |
| 500 | Internal Server Error - 서버 오류 |

### 에러 응답 형식
```json
{
  "error": "에러 메시지",
  "details": "상세 정보 (선택)"
}
```

---

## 📊 주문 상태

### Order Status
- `PENDING`: 결제 대기
- `PAYMENT_WAITING`: 입금 대기 (가상계좌)
- `CONFIRMED`: 결제 완료
- `PROCESSING`: 처리 중
- `SHIPPED`: 배송 중
- `DELIVERED`: 배송 완료
- `CANCELLED`: 취소됨

### Payment Status
- `PENDING`: 결제 대기
- `PAID`: 결제 완료
- `FAILED`: 결제 실패
- `REFUNDED`: 환불 완료

---

## 🧪 테스트

### 로컬 테스트
```bash
# 장바구니 조회
curl http://localhost:3000/api/cart

# 상품 추가
curl -X POST http://localhost:3000/api/cart \
  -H "Content-Type: application/json" \
  -d '{"productId": 1, "quantity": 2}'

# 주문 생성
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "quantity": 2,
    "customerInfo": {
      "name": "홍길동",
      "phone": "010-1234-5678",
      "email": "test@example.com"
    },
    "shippingAddress": {
      "zipCode": "12345",
      "address": "서울시 강남구 테헤란로 123",
      "detailAddress": "456호"
    }
  }'
```

---

## 📝 환경변수

API 동작에 필요한 환경변수:

```env
# 데이터베이스
DATABASE_URL="file:../prisma/dev.db"

# 인증
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# 토스페이먼츠
TOSS_PAYMENTS_CLIENT_KEY="test_ck_..."
TOSS_PAYMENTS_SECRET_KEY="test_sk_..."
TOSS_PAYMENTS_WEBHOOK_SECRET="webhook_secret"

# 결제 설정
PAYMENT_SUCCESS_URL="http://localhost:3000/payment/success"
PAYMENT_FAIL_URL="http://localhost:3000/payment/fail"

# 쇼핑몰 설정
FREE_SHIPPING_AMOUNT="30000"
DEFAULT_SHIPPING_FEE="3000"
SHOP_ADMIN_EMAIL="admin@example.com"
```

---

## 📚 추가 리소스

- [토스페이먼츠 API 문서](https://docs.tosspayments.com/reference)
- [NextAuth.js 문서](https://next-auth.js.org)
- [Prisma 문서](https://www.prisma.io/docs)
