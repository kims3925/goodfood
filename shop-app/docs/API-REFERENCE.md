# API Reference

> **프로젝트**: Shop-App
> **최종 업데이트**: 2025-12-10
> **총 엔드포인트**: 48개

---

## 목차

1. [인증 API](#1-인증-api)
2. [상품/쇼핑 API](#2-상품쇼핑-api)
3. [장바구니 API](#3-장바구니-api)
4. [주문/결제 API](#4-주문결제-api)
5. [마이페이지 API](#5-마이페이지-api)
6. [비회원 API](#6-비회원-api)
7. [내부 API](#7-내부-api)
8. [공통 응답 형식](#8-공통-응답-형식)

---

## 1. 인증 API

### POST /api/auth/signup
회원가입

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "홍길동",
  "phone": "010-1234-5678"
}
```

**Response**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "홍길동"
  }
}
```

### POST /api/auth/complete
회원가입 완료 (추가 정보 입력)

**인증**: 필요

### GET/POST /api/auth/[...nextauth]
NextAuth 핸들러 (로그인, 로그아웃, 세션)

---

## 2. 상품/쇼핑 API

### GET /api/shop/products
상품 목록 조회

**Query Parameters**
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| page | number | 1 | 페이지 번호 |
| limit | number | 20 | 페이지당 개수 |
| categoryId | string | - | 카테고리 필터 |
| sort | string | 'latest' | 정렬 (latest, price_asc, price_desc) |
| search | string | - | 검색어 |

**Response**
```json
{
  "products": [
    {
      "id": "uuid",
      "name": "상품명",
      "price": 10000,
      "imageUrl": "https://...",
      "status": "ACTIVE"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### GET /api/shop/products/[id]
상품 상세 조회

**Response**
```json
{
  "id": "uuid",
  "name": "상품명",
  "description": "상품 설명",
  "price": 10000,
  "originalPrice": 12000,
  "imageUrl": "https://...",
  "images": ["https://..."],
  "options": [
    {
      "id": "uuid",
      "name": "사이즈",
      "values": ["S", "M", "L"]
    }
  ],
  "variants": [
    {
      "id": "uuid",
      "name": "S",
      "price": 10000,
      "stock": 50
    }
  ]
}
```

### GET /api/shop/products/[id]/reviews
상품 리뷰 목록

**Query Parameters**
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| page | number | 1 | 페이지 번호 |
| limit | number | 10 | 페이지당 개수 |

### GET /api/shop/sections
메인 페이지 섹션 조회

### GET /api/shop/settings
Shop 설정 조회

### GET /api/shop/categories
카테고리 목록 조회

### GET /api/shop/banners
배너 목록 조회

---

## 3. 장바구니 API

### GET /api/cart
장바구니 조회

**Response**
```json
{
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "variantId": "uuid",
      "quantity": 2,
      "product": {
        "name": "상품명",
        "imageUrl": "https://..."
      },
      "variant": {
        "name": "옵션명",
        "price": 10000
      }
    }
  ],
  "totalAmount": 20000
}
```

### POST /api/cart
장바구니에 상품 추가

**Request Body**
```json
{
  "productId": "uuid",
  "variantId": "uuid",
  "quantity": 1
}
```

### PUT /api/cart
장바구니 아이템 수량 변경

**Request Body**
```json
{
  "itemId": "uuid",
  "quantity": 3
}
```

### DELETE /api/cart
장바구니 비우기 또는 선택 삭제

**Request Body**
```json
{
  "itemIds": ["uuid1", "uuid2"]
}
```

### DELETE /api/cart/items/[id]
장바구니 아이템 단일 삭제

---

## 4. 주문/결제 API

### POST /api/orders/prepare
주문 준비 (결제 전)

**인증**: 필요

**Request Body**
```json
{
  "items": [
    {
      "productId": "uuid",
      "variantId": "uuid",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "name": "홍길동",
    "phone": "010-1234-5678",
    "address": "서울시 강남구...",
    "zipCode": "12345"
  },
  "memo": "배송 메모"
}
```

**Response**
```json
{
  "orderId": "uuid",
  "orderNumber": "ORD-20251210-001",
  "amount": 20000,
  "paymentKey": "toss_payment_key"
}
```

### POST /api/orders/bank-transfer
무통장입금 주문

**인증**: 필요

### POST /api/payments/confirm
결제 승인 (TossPayments)

**인증**: 필요

**Request Body**
```json
{
  "paymentKey": "toss_payment_key",
  "orderId": "uuid",
  "amount": 20000
}
```

### POST /api/payments/cancel
결제 취소

**인증**: 필요

**Request Body**
```json
{
  "paymentKey": "toss_payment_key",
  "cancelReason": "고객 요청"
}
```

### POST /api/payments/webhook
TossPayments 웹훅 (서버 to 서버)

---

## 5. 마이페이지 API

### GET /api/mypage/orders
주문 내역 조회

**인증**: 필요

**Query Parameters**
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| page | number | 1 | 페이지 번호 |
| status | string | - | 주문 상태 필터 |

**Response**
```json
{
  "orders": [
    {
      "id": "uuid",
      "orderNumber": "ORD-20251210-001",
      "status": "PAID",
      "totalAmount": 20000,
      "orderedAt": "2025-12-10T00:00:00Z",
      "items": [...]
    }
  ],
  "pagination": {...}
}
```

### GET /api/mypage/orders/[id]
주문 상세 조회

**인증**: 필요

### GET /api/mypage/reviews
내 리뷰 목록

**인증**: 필요

### POST /api/mypage/reviews
리뷰 작성

**인증**: 필요

**Request Body**
```json
{
  "orderItemId": "uuid",
  "rating": 5,
  "content": "리뷰 내용",
  "images": ["https://..."]
}
```

### PUT /api/mypage/reviews/[id]
리뷰 수정

**인증**: 필요

### DELETE /api/mypage/reviews/[id]
리뷰 삭제

**인증**: 필요

### GET /api/mypage/wishlist
찜 목록

**인증**: 필요

### POST /api/mypage/wishlist
찜 추가

**인증**: 필요

### DELETE /api/mypage/wishlist/[id]
찜 삭제

**인증**: 필요

### GET /api/mypage/addresses
배송지 목록

**인증**: 필요

### POST /api/mypage/addresses
배송지 추가

**인증**: 필요

### PUT /api/mypage/addresses/[id]
배송지 수정

**인증**: 필요

### DELETE /api/mypage/addresses/[id]
배송지 삭제

**인증**: 필요

### GET /api/mypage/profile
프로필 조회

**인증**: 필요

### PUT /api/mypage/profile
프로필 수정

**인증**: 필요

---

## 6. 비회원 API

### POST /api/guest-orders/create
비회원 주문 생성

**Request Body**
```json
{
  "items": [...],
  "ordererInfo": {
    "name": "홍길동",
    "phone": "010-1234-5678",
    "email": "guest@example.com"
  },
  "shippingAddress": {...},
  "password": "1234"
}
```

### POST /api/guest-orders/lookup
비회원 주문 조회

**Request Body**
```json
{
  "orderNumber": "ORD-20251210-001",
  "phone": "010-1234-5678",
  "password": "1234"
}
```

### POST /api/guest-payments/confirm
비회원 결제 승인

### POST /api/guest-payments/cancel
비회원 결제 취소

---

## 7. 내부 API

> 미들웨어 전용 (Internal API Key 필요)

### GET /api/internal/shop/[subdomain]
Shop 정보 조회

**Headers**
```
x-internal-api-key: {INTERNAL_API_KEY}
```

### POST /api/internal/shop/invalidate-cache
Shop 캐시 무효화

**Headers**
```
x-internal-api-key: {INTERNAL_API_KEY}
```

---

## 8. 공통 응답 형식

### 성공 응답

```json
{
  "success": true,
  "data": {...}
}
```

또는 데이터 직접 반환

### 에러 응답

```json
{
  "error": "에러 메시지",
  "code": "ERROR_CODE"
}
```

### HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 429 | 요청 제한 초과 |
| 500 | 서버 에러 |

### 에러 코드

| 코드 | 설명 |
|------|------|
| VALIDATION_ERROR | 입력값 검증 실패 |
| NOT_FOUND | 리소스 없음 |
| UNAUTHORIZED | 인증 필요 |
| FORBIDDEN | 권한 없음 |
| PAYMENT_FAILED | 결제 실패 |
| OUT_OF_STOCK | 재고 부족 |
| DUPLICATE_ENTRY | 중복 데이터 |
