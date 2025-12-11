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

### 2. CartItem 테이블에 Referrer 추가 (상품별 추적)

```prisma
model CartItem {
  id                  Int       @id @default(autoincrement())
  cartId              Int       @map("cart_id")
  publishedProductId  Int       @map("published_product_id")
  quantity            Int
  referrerChannelId   Int?      @map("referrer_channel_id")  // 장바구니 담을 때의 유입 경로
  // ... 기존 필드들

  referrerChannel     Channel?  @relation("CartItemReferrer", fields: [referrerChannelId], references: [id])
}
```

### 3. Order 테이블에 Referrer 추가 (주문 전체 대표 referrer)

```prisma
model Order {
  id                 Int                 @id @default(autoincrement())
  userId             Int                 @map("user_id")
  referrerChannelId  Int?                @map("referrer_channel_id")  // 주문 전체 대표 유입 경로
  // ... 기존 필드들

  referrerChannel    Channel?            @relation("ReferrerOrders", fields: [referrerChannelId], references: [id])
}
```

### 4. OrderItem 테이블에 Referrer 추가 (상품별 정산용)

```prisma
model OrderItem {
  id                  Int       @id @default(autoincrement())
  orderId             Int       @map("order_id")
  publishedProductId  Int       @map("published_product_id")
  quantity            Int
  totalPrice          Int       @map("total_price")
  referrerChannelId   Int?      @map("referrer_channel_id")  // 상품별 유입 경로 (정산용)
  // ... 기존 필드들

  referrerChannel     Channel?  @relation("OrderItemReferrer", fields: [referrerChannelId], references: [id])
}
```

### 5. Channel 테이블 관계 추가

```prisma
model Channel {
  // ... 기존 필드들
  referredOrders      Order[]      @relation("ReferrerOrders")
  referredCartItems   CartItem[]   @relation("CartItemReferrer")
  referredOrderItems  OrderItem[]  @relation("OrderItemReferrer")
}
```

---

## Attribution 정책 (정산 귀속 규칙)

### 채택 방식: Last Click Attribution (7일)

| 정책 항목 | 적용 값 | 설명 |
|----------|--------|------|
| Attribution 모델 | **Last Click** | 마지막으로 클릭한 채널에 정산 |
| 유효 기간 | **7일** | 쿠키 만료 기간 |
| 저장 위치 | **쿠키 + 장바구니** | 쿠키 차단 시에도 추적 가능 |

### Attribution 충돌 시나리오

| 시나리오 | 결과 | 이유 |
|----------|------|------|
| A밴드 클릭 → 이탈 → B밴드 클릭 → 구매 | **B에 정산** | Last Click |
| A밴드 클릭 → 7일 후 직접 접속 → 구매 | **자체 수익** | 쿠키 만료 |
| A밴드로 상품1 담기 → B밴드로 상품2 담기 → 동시 주문 | **상품1→A, 상품2→B** | 상품별 정산 |
| 쿠키 차단 상태에서 A밴드 클릭 → 장바구니 담기 → 구매 | **A에 정산** | CartItem에 저장됨 |

### 정책 선택 이유

1. **Last Click**: 분쟁 최소화 - "마지막에 클릭한 곳"이라는 명확한 기준
2. **7일**: 합리적 기간 - 너무 짧으면 정산 누락, 너무 길면 관련 없는 채널에 정산
3. **상품별 추적**: 공정한 정산 - 여러 채널 상품 동시 구매 시 각각 정산

---

## Referrer 보안

### 1. Referrer 조작 방지

**문제:** 악의적 사용자가 URL에 `?ref=자기채널ID`를 직접 입력할 수 있음

**해결책 A: 유효성 검증 (권장)**
```typescript
// 장바구니 담기 시 검증
async function addToCart(productId: number, referrerChannelId: number | null) {
  if (referrerChannelId) {
    // 해당 채널에 해당 상품이 실제로 발행되었는지 확인
    const publishRecord = await prisma.publishedProduct.findFirst({
      where: {
        productId,
        channelId: referrerChannelId,
        status: 'PUBLISHED'
      }
    });

    if (!publishRecord) {
      // 유효하지 않은 referrer → 무시
      referrerChannelId = null;
    }
  }
  // ... 장바구니 추가 로직
}
```

**해결책 B: 서명된 토큰 (고도화 시)**
```typescript
// 발행 시 서명된 토큰 생성
const token = jwt.sign(
  { channelId: 5, productId: 123, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 },
  SECRET_KEY
);
// URL: ?ref=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// 검증 시
try {
  const decoded = jwt.verify(token, SECRET_KEY);
  referrerChannelId = decoded.channelId;
} catch {
  referrerChannelId = null;
}
```

### 2. 쿠키 보안 설정

```typescript
// 쿠키 설정 시 보안 옵션
setCookie('referrer', channelId, {
  maxAge: 7 * 24 * 60 * 60,  // 7일
  httpOnly: false,           // 클라이언트에서 읽어야 함
  secure: true,              // HTTPS만
  sameSite: 'lax',           // CSRF 방지
  path: '/'
});
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

### 3. 장바구니 API (상품별 referrer 저장)

```typescript
// POST /api/cart
{
  publishedProductId: 123,
  quantity: 1,
  referrerChannelId: 5  // 이 상품을 담을 때의 유입 경로
}

// GET /api/cart 응답
{
  items: [
    {
      id: 1,
      publishedProductId: 123,
      quantity: 1,
      referrerChannelId: 5  // 상품별로 저장됨
    },
    {
      id: 2,
      publishedProductId: 456,
      quantity: 2,
      referrerChannelId: 8  // 다른 채널
    }
  ]
}
```

### 4. 주문 API (상품별 referrer 전달)

```typescript
// POST /api/orders
{
  items: [
    { cartItemId: 1 },  // CartItem의 referrerChannelId가 OrderItem으로 복사됨
    { cartItemId: 2 }
  ]
}

// 서버 처리
items.forEach(item => {
  const cartItem = await prisma.cartItem.findUnique({ where: { id: item.cartItemId } });
  await prisma.orderItem.create({
    data: {
      orderId,
      publishedProductId: cartItem.publishedProductId,
      quantity: cartItem.quantity,
      referrerChannelId: cartItem.referrerChannelId  // 상품별 referrer 복사
    }
  });
});
```

---

## Referrer 추적 구현

### 1. URL 파라미터 방식
```
https://shop.example.com/product/123?ref=5
```
- 소매밴드 게시물에 `?ref=channelId` 파라미터 포함
- 쇼핑몰에서 해당 파라미터를 쿠키에 저장

### 2. 쿠키 저장 (7일 유지)
```typescript
// 상품 페이지 접근 시 (클라이언트)
useEffect(() => {
  const ref = searchParams.get('ref');
  if (ref) {
    // Last Click: 항상 최신 referrer로 덮어씀
    setCookie('referrer', ref, {
      maxAge: 7 * 24 * 60 * 60,  // 7일
      path: '/'
    });
  }
}, [searchParams]);
```

### 3. 장바구니 담기 시 저장
```typescript
// 장바구니 담기 버튼 클릭 시
const handleAddToCart = async () => {
  const referrerChannelId = getCookie('referrer') || null;

  await fetch('/api/cart', {
    method: 'POST',
    body: JSON.stringify({
      publishedProductId,
      quantity,
      referrerChannelId  // 상품별로 저장
    })
  });
};
```

### 4. 주문 생성 시 복사
```typescript
// 주문 생성 API
const orderItems = cartItems.map(cartItem => ({
  publishedProductId: cartItem.publishedProductId,
  quantity: cartItem.quantity,
  price: cartItem.price,
  referrerChannelId: cartItem.referrerChannelId  // CartItem → OrderItem 복사
}));
```

---

## 정산 로직 변경

### 현재 정산 (채널별 PublishedProduct 기준)
```sql
-- 채널별 판매 금액 집계
SELECT
  pp.channel_id,
  SUM(oi.total_price) as total_sales
FROM order_item oi
JOIN published_product pp ON oi.published_product_id = pp.id
GROUP BY pp.channel_id
```

### 변경 후 정산 (OrderItem의 referrer 기준)
```sql
-- Referrer 채널별 판매 금액 집계 (상품별 정산)
SELECT
  oi.referrer_channel_id,
  SUM(oi.total_price) as total_sales
FROM order_item oi
WHERE oi.referrer_channel_id IS NOT NULL
GROUP BY oi.referrer_channel_id
```

### 정산 시나리오

| 유입 경로 | 정산 대상 | 비고 |
|----------|----------|------|
| A밴드 게시물 클릭 → 상품1 구매 | A업체에 정산 | OrderItem.referrer_channel_id = A |
| B밴드 게시물 클릭 → 상품2 구매 | B업체에 정산 | OrderItem.referrer_channel_id = B |
| 직접 접근 → 구매 | 자체 수익 | referrer_channel_id = NULL |
| A밴드로 상품1, B밴드로 상품2 동시 주문 | 상품1→A, 상품2→B | 상품별로 분리 정산 |

### 정산 리포트 쿼리 예시
```sql
-- 기간별 채널 정산 리포트
SELECT
  c.name as channel_name,
  DATE(o.created_at) as order_date,
  COUNT(DISTINCT o.id) as order_count,
  SUM(oi.quantity) as total_quantity,
  SUM(oi.total_price) as total_sales
FROM order_item oi
JOIN "order" o ON oi.order_id = o.id
LEFT JOIN channel c ON oi.referrer_channel_id = c.id
WHERE o.created_at BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY c.name, DATE(o.created_at)
ORDER BY order_date, total_sales DESC
```

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
1. `CartItem` 테이블에 `referrer_channel_id` 컬럼 추가
2. `Order` 테이블에 `referrer_channel_id` 컬럼 추가
3. `OrderItem` 테이블에 `referrer_channel_id` 컬럼 추가
4. `PublishedProduct` 테이블에 `is_shop_product` 컬럼 추가

### Phase 2: 발행 로직 변경
1. 쇼핑몰 발행 시 `isShopProduct = true`, `channelId = null`로 생성
2. 소매처 발행은 기존 방식 유지

### Phase 3: 쇼핑몰 UI 변경
1. 채널별 섹션 제거
2. 통합 상품 목록으로 변경
3. Referrer 파라미터 처리 로직 추가 (쿠키 저장)
4. 장바구니 담기 시 referrer 전달 로직 추가

### Phase 4: 정산 로직 변경
1. OrderItem 레벨 Referrer 기반 정산 쿼리로 변경
2. 정산 관리 UI 수정
3. 정산 리포트에 Referrer 출처 표시 추가

### Phase 5: 데이터 마이그레이션
1. 기존 채널별 PublishedProduct → 통합 쇼핑몰 상품으로 변환
2. 기존 주문 데이터는 그대로 유지 (referrer_channel_id = NULL)

---

## 관련 파일

### 수정 필요 파일 목록

**DB 스키마:**
- `db/prisma/models/order.prisma`
- `db/prisma/models/cart.prisma`
- `db/prisma/models/publish.prisma`
- `db/prisma/models/channel.prisma`

**소싱앱 (발행 로직):**
- `sourcing-app/src/modules/publish/services/publish.service.ts`
- `sourcing-app/src/app/(admin)/product/publish/` 관련 파일들

**쇼핑몰 (UI 및 API):**
- `shop-app/src/app/(shop)/main/page.tsx`
- `shop-app/src/app/api/shop/sections/route.ts`
- `shop-app/src/app/api/shop/products/route.ts`
- `shop-app/src/app/(shop)/product/[id]/page.tsx`
- `shop-app/src/modules/cart/services/cart.service.ts`
- `shop-app/src/modules/order/services/order.service.ts`

**정산:**
- `sourcing-app/src/app/api/settlement/route.ts`
- `sourcing-app/src/app/(admin)/settlement/` 관련 파일들

---

## 작성일
- 2025-12-04

## 상태
- [ ] Phase 1: 스키마 변경
- [ ] Phase 2: 발행 로직 변경
- [ ] Phase 3: 쇼핑몰 UI 변경
- [ ] Phase 4: 정산 로직 변경
- [ ] Phase 5: 데이터 마이그레이션
