# 쇼핑몰 Referrer 기반 정산 시스템
작성일 : 2025.12.4
중요도 : 높음
## 개요

쇼핑몰의 상품 구조를 **채널별 분리 방식**에서 **통합 상품 + Referrer 기반 정산** 방식으로 변경합니다.

## 현재 구조 (AS-IS)

### 발행 흐름
```
[소싱앱] 도매밴드/소싱처 → 상품 가공
              ↓
         발행 시 → 소매채널별로 PublishedProduct 생성
              ↓
[쇼핑몰] 채널별로 상품 분리 표시
         ├─ A업체 섹션: 상품1, 상품2...
         ├─ B업체 섹션: 상품3, 상품4...
         └─ 자사몰(SHOP) 섹션: 상품5...
```

### 데이터 구조
```
Product (상품)
    ↓
PublishedProduct (발행된 상품)
    - productId: 상품 ID
    - channelId: 소매채널 ID (A업체, B업체 등)
    ↓
쇼핑몰에서 channelId별로 섹션 분리 표시
```

### 문제점
1. 같은 상품이 채널마다 별도 `PublishedProduct`로 관리됨
2. 쇼핑몰에서 업체별로 상품이 분리되어 이커머스 형태로 표시
3. 고객 입장에서 동일 상품이 여러 업체에서 보여 혼란

---

## 변경 후 구조 (TO-BE)

### 발행 흐름
```
[소싱앱] 도매밴드/소싱처 → 상품 가공
              ↓
         발행 시 → 두 가지 경로
         │
         ├─ 1) 소매처(밴드, 카페 등)에 발행
         │      → 외부 채널에 게시물 등록
         │      → 게시물에 쇼핑몰 상품 링크 포함 (?ref=channelId)
         │
         └─ 2) 쇼핑몰에 발행
                → 하나의 통합 상품으로 등록 (채널 무관)
              ↓
[쇼핑몰] 통합된 상품 목록 (업체 구분 없음)
         └─ 모든 상품이 하나의 목록으로 표시
```

### 쇼핑몰 접근 경로
```
고객 유입 경로:
├─ A밴드 게시물 클릭 → 쇼핑몰 상품X (?ref=A) → 구매 시 A에 정산
├─ B밴드 게시물 클릭 → 쇼핑몰 상품X (?ref=B) → 구매 시 B에 정산
├─ C밴드 게시물 클릭 → 쇼핑몰 상품X (?ref=C) → 구매 시 C에 정산
└─ 직접 접근         → 쇼핑몰 상품X          → 구매 시 자체 수익
```

### 핵심 변경점

| 구분 | 현재 (AS-IS) | 변경 후 (TO-BE) |
|------|-------------|----------------|
| 쇼핑몰 상품 | 채널별로 분리 | **하나로 통합** |
| 소매밴드 역할 | 상품 판매 주체 | **유입 경로 (Referrer)** |
| 정산 기준 | 어떤 채널에서 팔렸나 | **어떤 채널을 통해 접근했나** |
| PublishedProduct | 채널마다 별도 생성 | 쇼핑몰용 1개 + 소매처용 N개 |

---

## 데이터 모델 변경

### 1. PublishedProduct 변경

```prisma
model PublishedProduct {
  id               Int              @id @default(autoincrement())
  userId           Int              @map("user_id")
  productId        Int              @map("product_id")
  channelId        Int?             @map("channel_id")  // null = 쇼핑몰 자체 상품
  isShopProduct    Boolean          @default(false) @map("is_shop_product")  // 쇼핑몰 상품 여부
  publishedAt      DateTime?        @map("published_at")
  // ...

  @@unique([productId, channelId])  // 기존 유지
  @@unique([productId, isShopProduct], name: "unique_shop_product")  // 쇼핑몰 상품은 1개만
}
```

### 2. Order 테이블에 Referrer 추가

```prisma
model Order {
  id                 Int                 @id @default(autoincrement())
  userId             Int                 @map("user_id")
  referrerChannelId  Int?                @map("referrer_channel_id")  // 유입 경로 채널
  // ... 기존 필드들

  referrerChannel    Channel?            @relation("ReferrerOrders", fields: [referrerChannelId], references: [id])
}
```

### 3. Channel 테이블 관계 추가

```prisma
model Channel {
  // ... 기존 필드들
  referredOrders    Order[]             @relation("ReferrerOrders")  // 해당 채널을 통해 유입된 주문
}
```

---

## API 변경사항

### 1. 쇼핑몰 상품 조회 API

**Before:**
```typescript
// /api/shop/sections - 채널별로 상품 그룹화
{
  retailSections: [
    { id: 1, name: "A업체", products: [...] },
    { id: 2, name: "B업체", products: [...] },
  ]
}
```

**After:**
```typescript
// /api/shop/products - 통합 상품 목록
{
  products: [...],  // 모든 쇼핑몰 상품
  pagination: { total, limit, offset }
}
```

### 2. 상품 상세 조회

**Before:**
```
/product/[productId]?bandId=[channelId]
```

**After:**
```
/product/[productId]?ref=[channelId]  // ref는 유입 경로용
```

### 3. 장바구니/주문 API

장바구니 추가 및 주문 시 `referrerChannelId` 전달:

```typescript
// POST /api/cart
{
  publishedProductId: 123,
  quantity: 1,
  referrerChannelId: 5  // 유입 경로 (optional)
}

// POST /api/orders
{
  items: [...],
  referrerChannelId: 5  // 세션에서 가져오거나 쿠키에서 추적
}
```

---

## Referrer 추적 방식

### 1. URL 파라미터 방식
```
https://shop.example.com/product/123?ref=5
```
- 소매밴드 게시물에 `?ref=channelId` 파라미터 포함
- 쇼핑몰에서 해당 파라미터를 세션/쿠키에 저장

### 2. 세션 저장
```typescript
// 상품 페이지 접근 시
if (searchParams.ref) {
  sessionStorage.setItem('referrerChannelId', searchParams.ref)
  // 또는 쿠키에 저장 (서버 사이드 추적용)
}
```

### 3. 주문 시 적용
```typescript
// 주문 생성 시
const referrerChannelId = sessionStorage.getItem('referrerChannelId')
// → Order 테이블에 저장
```

### 4. Referrer 유효 기간
- 옵션 1: 세션 동안만 유지
- 옵션 2: 쿠키로 N일간 유지 (예: 7일)
- 옵션 3: 마지막 클릭 기준 (Last Click Attribution)

---

## 정산 로직 변경

### 현재 정산
```sql
-- 채널별 판매 금액 집계
SELECT
  pp.channel_id,
  SUM(oi.total_price) as total_sales
FROM order_item oi
JOIN published_product pp ON oi.published_product_id = pp.id
GROUP BY pp.channel_id
```

### 변경 후 정산
```sql
-- Referrer 채널별 판매 금액 집계
SELECT
  o.referrer_channel_id,
  SUM(oi.total_price) as total_sales
FROM order o
JOIN order_item oi ON o.id = oi.order_id
WHERE o.referrer_channel_id IS NOT NULL
GROUP BY o.referrer_channel_id
```

### 정산 시나리오

| 유입 경로 | 정산 대상 | 비고 |
|----------|----------|------|
| A밴드 게시물 클릭 | A업체에 정산 | referrer_channel_id = A |
| B밴드 게시물 클릭 | B업체에 정산 | referrer_channel_id = B |
| 직접 접근 | 자체 수익 | referrer_channel_id = NULL |
| 쇼핑몰 내 검색 | 최초 유입 기준 | 세션/쿠키 기반 |

---

## UI 변경사항

### 쇼핑몰 메인 페이지

**Before:**
```
├─ 추천 상품 캐러셀
├─ A업체 섹션
├─ B업체 섹션
├─ C업체 섹션
└─ 자사몰 공식 상품 섹션
```

**After:**
```
├─ 추천 상품 캐러셀
├─ 카테고리별 상품 (또는 통합 상품 목록)
└─ (업체 구분 없음)
```

### 상품 상세 페이지
- 업체 정보 표시 제거
- 순수 상품 정보만 표시

---

## 마이그레이션 계획

### Phase 1: 스키마 변경
1. `Order` 테이블에 `referrer_channel_id` 컬럼 추가
2. `PublishedProduct` 테이블에 `is_shop_product` 컬럼 추가

### Phase 2: 발행 로직 변경
1. 쇼핑몰 발행 시 `isShopProduct = true`, `channelId = null`로 생성
2. 소매처 발행은 기존 방식 유지

### Phase 3: 쇼핑몰 UI 변경
1. 채널별 섹션 제거
2. 통합 상품 목록으로 변경
3. Referrer 파라미터 처리 로직 추가

### Phase 4: 정산 로직 변경
1. Referrer 기반 정산 쿼리로 변경
2. 정산 관리 UI 수정

### Phase 5: 데이터 마이그레이션
1. 기존 채널별 PublishedProduct → 통합 쇼핑몰 상품으로 변환
2. 기존 주문 데이터는 그대로 유지 (referrer_channel_id = NULL)

---

## 관련 파일

### 수정 필요 파일 목록

**DB 스키마:**
- `db/prisma/models/order.prisma`
- `db/prisma/models/publish.prisma`
- `db/prisma/models/channel.prisma`

**소싱앱 (발행 로직):**
- `sourcing-app/src/modules/publish/services/publish.service.ts`
- `sourcing-app/src/app/(admin)/product/publish/` 관련 파일들

**쇼핑몰 (UI 및 API):**
- `e-commerce-app/src/app/(shop)/main/page.tsx`
- `e-commerce-app/src/app/api/shop/sections/route.ts`
- `e-commerce-app/src/app/api/shop/products/route.ts`
- `e-commerce-app/src/app/(shop)/product/[id]/page.tsx`
- `e-commerce-app/src/modules/cart/services/cart.service.ts`
- `e-commerce-app/src/modules/order/services/order.service.ts`

**정산:**
- `sourcing-app/src/app/api/settlement/route.ts`
- `sourcing-app/src/app/(admin)/settlement/` 관련 파일들

---

## 작성일
- 2024-12-04

## 상태
- [ ] Phase 1: 스키마 변경
- [ ] Phase 2: 발행 로직 변경
- [ ] Phase 3: 쇼핑몰 UI 변경
- [ ] Phase 4: 정산 로직 변경
- [ ] Phase 5: 데이터 마이그레이션
