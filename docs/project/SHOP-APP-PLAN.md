# BandAuto E-Commerce App 기획서

> **문서 버전**: 1.0
> **작성일**: 2025-11-25
> **상태**: 기획 단계

---

## 1. 개요

### 1.1 프로젝트 배경

현재 **sourcing-app**은 도매밴드에서 상품을 수집하고 AI로 가공하여 소매밴드에 발행하는 B2B 관리 시스템입니다. 하지만 실제 고객에게 판매하는 **B2C 쇼핑몰**이 없어 다음과 같은 한계가 있습니다:

| 현재 방식 | 문제점 |
|-----------|--------|
| 밴드 게시물로 판매 | 결제 시스템 없음, 수동 입금 확인 |
| Google Forms 주문 | UX 불편, 재고 관리 불가 |
| 카카오톡 문의 | 응대 부담, 주문 추적 어려움 |

### 1.2 프로젝트 목표

```
┌─────────────────────────────────────────────────────────────┐
│                    BandAuto 플랫폼 구조                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   [도매밴드] ──▶ [sourcing-app] ──▶ [소매밴드]              │
│                       │                                     │
│                       ▼                                     │
│               [shop-app] ◀── 고객 주문                │
│                       │                                     │
│                       ▼                                     │
│               [토스페이먼츠] ──▶ 결제 처리                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**핵심 목표:**
1. 독립적인 온라인 쇼핑몰 구축
2. 토스페이먼츠 결제 시스템 연동
3. sourcing-app 상품 데이터 실시간 연동
4. 주문-배송-CS 통합 관리

---

## 2. 시스템 아키텍처

### 2.1 기술 스택

| 영역 | 기술 | 선정 이유 |
|------|------|-----------|
| **Frontend** | Next.js 14 (App Router) | sourcing-app과 동일, SSR/SEO |
| **Styling** | Tailwind CSS | 빠른 UI 개발, 일관된 디자인 |
| **State** | Zustand | 가벼움, TypeScript 친화적 |
| **Database** | MariaDB + Prisma | sourcing-app DB 공유 |
| **Payment** | Toss Payments | 국내 최적화, 다양한 결제수단 |
| **Auth** | JWT + httpOnly Cookie | 보안, 기존 방식 유지 |

### 2.2 데이터베이스 설계

#### 기존 테이블 재사용 (sourcing-app)
```
Product ──────── 상품 정보
ProductVariant ─ 옵션별 가격/재고
ProductOption ── 옵션 그룹 (색상, 사이즈)
PostImage ────── 상품 이미지
```

#### 신규 테이블 (e-commerce 전용)

```prisma
// =============================================
// CUSTOMER (고객)
// =============================================
model Customer {
  id            Int       @id @default(autoincrement())
  email         String    @unique @db.VarChar(255)
  password      String    @db.VarChar(255)
  name          String    @db.VarChar(100)
  phone         String?   @db.VarChar(20)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  addresses     CustomerAddress[]
  cart          CartItem[]
  orders        CustomerOrder[]

  @@map("customer")
}

// =============================================
// CUSTOMER ADDRESS (배송지)
// =============================================
model CustomerAddress {
  id            Int       @id @default(autoincrement())
  customerId    Int       @map("customer_id")

  name          String    @db.VarChar(100)     // 받는 분
  phone         String    @db.VarChar(20)
  postalCode    String    @map("postal_code") @db.VarChar(10)
  address       String    @db.VarChar(500)
  addressDetail String?   @map("address_detail") @db.VarChar(500)

  isDefault     Boolean   @default(false) @map("is_default")

  customer      Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@map("customer_address")
}

// =============================================
// CART (장바구니)
// =============================================
model CartItem {
  id            Int       @id @default(autoincrement())
  customerId    Int       @map("customer_id")
  productId     Int       @map("product_id")
  variantId     Int?      @map("variant_id")

  quantity      Int       @default(1)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  customer      Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  product       Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  variant       ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)

  @@unique([customerId, productId, variantId])
  @@map("cart_item")
}

// =============================================
// CUSTOMER ORDER (고객 주문)
// =============================================
enum CustomerOrderStatus {
  PENDING         // 결제대기
  PAID            // 결제완료
  PREPARING       // 상품준비중
  SHIPPED         // 배송중
  DELIVERED       // 배송완료
  CANCELLED       // 주문취소
  REFUND_REQUESTED // 환불요청
  REFUNDED        // 환불완료
}

model CustomerOrder {
  id              Int       @id @default(autoincrement())
  customerId      Int       @map("customer_id")
  orderNumber     String    @unique @map("order_number") @db.VarChar(50)

  // 배송 정보
  recipientName   String    @map("recipient_name") @db.VarChar(100)
  recipientPhone  String    @map("recipient_phone") @db.VarChar(20)
  postalCode      String    @map("postal_code") @db.VarChar(10)
  address         String    @db.VarChar(500)
  addressDetail   String?   @map("address_detail") @db.VarChar(500)
  deliveryMemo    String?   @map("delivery_memo") @db.VarChar(500)

  // 금액
  subtotal        Int                           // 상품 합계
  shippingFee     Int       @map("shipping_fee") // 배송비
  discount        Int       @default(0)          // 할인
  totalAmount     Int       @map("total_amount") // 최종 결제금액

  // 상태
  status          CustomerOrderStatus @default(PENDING)

  // 배송 추적
  trackingNumber  String?   @map("tracking_number") @db.VarChar(100)
  trackingCompany String?   @map("tracking_company") @db.VarChar(50)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  paidAt          DateTime? @map("paid_at")
  shippedAt       DateTime? @map("shipped_at")
  deliveredAt     DateTime? @map("delivered_at")

  customer        Customer  @relation(fields: [customerId], references: [id])
  items           CustomerOrderItem[]
  payment         Payment?

  @@index([customerId])
  @@index([orderNumber])
  @@index([status])
  @@map("customer_order")
}

// =============================================
// ORDER ITEM (주문 상품)
// =============================================
model CustomerOrderItem {
  id              Int       @id @default(autoincrement())
  orderId         Int       @map("order_id")
  productId       Int       @map("product_id")
  variantId       Int?      @map("variant_id")

  // 주문 시점 스냅샷
  productName     String    @map("product_name") @db.VarChar(500)
  optionSummary   String?   @map("option_summary") @db.VarChar(500)
  thumbnailUrl    String?   @map("thumbnail_url") @db.VarChar(1000)

  quantity        Int
  unitPrice       Int       @map("unit_price")
  totalPrice      Int       @map("total_price")

  order           CustomerOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("customer_order_item")
}

// =============================================
// PAYMENT (결제 - 토스페이먼츠)
// =============================================
enum PaymentStatus {
  PENDING         // 결제대기
  DONE            // 결제완료
  CANCELED        // 결제취소
  PARTIAL_CANCELED // 부분취소
  FAILED          // 결제실패
}

model Payment {
  id              Int       @id @default(autoincrement())
  orderId         Int       @unique @map("order_id")

  // 토스페이먼츠 데이터
  paymentKey      String    @unique @map("payment_key") @db.VarChar(200)
  orderId_toss    String    @map("order_id_toss") @db.VarChar(100)

  // 결제 정보
  method          String    @db.VarChar(50)     // 카드, 가상계좌, 계좌이체
  amount          Int
  status          PaymentStatus @default(PENDING)

  // 카드 정보 (카드 결제 시)
  cardCompany     String?   @map("card_company") @db.VarChar(50)
  cardNumber      String?   @map("card_number") @db.VarChar(20)   // 마스킹됨
  installments    Int?                                            // 할부 개월

  // 가상계좌 정보 (가상계좌 결제 시)
  bankCode        String?   @map("bank_code") @db.VarChar(10)
  accountNumber   String?   @map("account_number") @db.VarChar(50)
  dueDate         DateTime? @map("due_date")

  // 현금영수증
  cashReceiptType String?   @map("cash_receipt_type") @db.VarChar(20)
  cashReceiptNumber String? @map("cash_receipt_number") @db.VarChar(50)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  approvedAt      DateTime? @map("approved_at")
  canceledAt      DateTime? @map("canceled_at")

  // 환불 정보
  cancelAmount    Int?      @map("cancel_amount")
  cancelReason    String?   @map("cancel_reason") @db.VarChar(500)

  order           CustomerOrder @relation(fields: [orderId], references: [id])

  @@index([paymentKey])
  @@index([status])
  @@map("payment")
}
```

### 2.3 ER 다이어그램

```
┌──────────────┐       ┌──────────────────┐
│   Customer   │───┬───│ CustomerAddress  │
└──────────────┘   │   └──────────────────┘
       │           │
       │           │   ┌──────────────┐
       ├───────────┼───│   CartItem   │───┐
       │           │   └──────────────┘   │
       │           │                      │
       ▼           │                      ▼
┌──────────────────┴──┐            ┌───────────┐
│   CustomerOrder     │            │  Product  │ (from sourcing-app)
├─────────────────────┤            └───────────┘
│ - orderNumber       │                  │
│ - status            │                  │
│ - totalAmount       │                  ▼
└─────────────────────┘            ┌───────────────┐
       │                           │ProductVariant │
       ├───────────────────┐       └───────────────┘
       │                   │
       ▼                   ▼
┌─────────────────┐  ┌──────────┐
│CustomerOrderItem│  │ Payment  │
└─────────────────┘  └──────────┘
```

---

## 3. 기능 명세

### 3.1 페이지 구조

```
shop-app/
├── / (홈)
│   ├── 배너 슬라이더
│   ├── 인기 상품
│   └── 신상품
│
├── /products (상품 목록)
│   ├── 카테고리 필터
│   ├── 정렬 (최신순, 가격순, 인기순)
│   └── 페이지네이션
│
├── /product/[id] (상품 상세)
│   ├── 이미지 갤러리
│   ├── 상품 정보
│   ├── 옵션 선택
│   ├── 수량 선택
│   └── 장바구니/바로구매
│
├── /cart (장바구니)
│   ├── 상품 목록
│   ├── 수량 변경/삭제
│   ├── 선택 삭제
│   └── 주문하기
│
├── /checkout (주문/결제)
│   ├── 배송지 선택/입력
│   ├── 주문 상품 확인
│   ├── 결제 수단 선택
│   ├── 쿠폰/적립금 (Phase 2)
│   └── 결제하기 (토스페이먼츠)
│
├── /payment
│   ├── /success (결제 성공)
│   └── /fail (결제 실패)
│
├── /orders (주문 내역)
│   ├── 주문 목록
│   ├── 주문 상세
│   └── 배송 조회
│
├── /mypage (마이페이지)
│   ├── 회원 정보
│   ├── 배송지 관리
│   └── 비밀번호 변경
│
└── /auth
    ├── /login (로그인)
    ├── /signup (회원가입)
    └── /forgot-password (비밀번호 찾기)
```

### 3.2 API 엔드포인트

#### 인증
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/session` | 세션 확인 |

#### 상품
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/products` | 상품 목록 |
| GET | `/api/products/[id]` | 상품 상세 |
| GET | `/api/products/categories` | 카테고리 목록 |

#### 장바구니
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/cart` | 장바구니 조회 |
| POST | `/api/cart` | 장바구니 추가 |
| PATCH | `/api/cart/[id]` | 수량 변경 |
| DELETE | `/api/cart/[id]` | 삭제 |
| DELETE | `/api/cart` | 전체 삭제 |

#### 주문
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/orders` | 주문 목록 |
| GET | `/api/orders/[id]` | 주문 상세 |
| POST | `/api/orders` | 주문 생성 |
| PATCH | `/api/orders/[id]/cancel` | 주문 취소 |

#### 결제 (토스페이먼츠)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/payments/confirm` | 결제 승인 |
| POST | `/api/payments/cancel` | 결제 취소 |
| POST | `/api/payments/webhook` | 웹훅 수신 |

#### 마이페이지
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/me` | 내 정보 |
| PATCH | `/api/me` | 정보 수정 |
| GET | `/api/me/addresses` | 배송지 목록 |
| POST | `/api/me/addresses` | 배송지 추가 |
| PATCH | `/api/me/addresses/[id]` | 배송지 수정 |
| DELETE | `/api/me/addresses/[id]` | 배송지 삭제 |

### 3.3 토스페이먼츠 연동 플로우

```
┌─────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────┐
│  고객   │    │ e-commerce  │    │ 토스페이먼츠  │    │   DB    │
└────┬────┘    └──────┬──────┘    └──────┬───────┘    └────┬────┘
     │                │                   │                 │
     │ 1. 결제하기    │                   │                 │
     │───────────────▶│                   │                 │
     │                │                   │                 │
     │                │ 2. 주문 생성      │                 │
     │                │─────────────────────────────────────▶
     │                │                   │                 │
     │ 3. 결제창 표시 │                   │                 │
     │◀───────────────│                   │                 │
     │                │                   │                 │
     │ 4. 결제 정보 입력                  │                 │
     │───────────────────────────────────▶│                 │
     │                │                   │                 │
     │ 5. 결제 결과   │                   │                 │
     │◀───────────────│◀──────────────────│                 │
     │                │                   │                 │
     │                │ 6. 결제 승인 요청 │                 │
     │                │──────────────────▶│                 │
     │                │                   │                 │
     │                │ 7. 승인 결과      │                 │
     │                │◀──────────────────│                 │
     │                │                   │                 │
     │                │ 8. 주문 상태 업데이트               │
     │                │─────────────────────────────────────▶
     │                │                   │                 │
     │ 9. 결제 완료   │                   │                 │
     │◀───────────────│                   │                 │
     │                │                   │                 │
```

---

## 4. 화면 설계

### 4.1 상품 목록 (와이어프레임)

```
┌────────────────────────────────────────────────────────┐
│  [로고]              검색...          [장바구니] [MY]  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  카테고리: [전체] [의류] [잡화] [식품]                  │
│  정렬: [최신순 ▼]                                      │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  [이미지] │  │  [이미지] │  │  [이미지] │              │
│  │          │  │          │  │          │              │
│  │ 상품명   │  │ 상품명   │  │ 상품명   │              │
│  │ 15,000원 │  │ 23,000원 │  │ 8,900원  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  [이미지] │  │  [이미지] │  │  [이미지] │              │
│  │          │  │          │  │          │              │
│  │ 상품명   │  │ 상품명   │  │ 상품명   │              │
│  │ 12,000원 │  │ 35,000원 │  │ 19,000원 │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                        │
│              [1] [2] [3] [4] [5]                       │
└────────────────────────────────────────────────────────┘
```

### 4.2 상품 상세

```
┌────────────────────────────────────────────────────────┐
│  [◀ 뒤로]                              [장바구니] [MY]  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌────────────────────────┐   상품명                   │
│  │                        │   ─────────────────────    │
│  │                        │                            │
│  │       [메인 이미지]     │   15,000원                 │
│  │                        │                            │
│  │                        │   색상: [빨강] [파랑] [검정]│
│  └────────────────────────┘                            │
│  [썸1] [썸2] [썸3] [썸4]    사이즈: [S] [M] [L] [XL]   │
│                                                        │
│                             수량: [-] 1 [+]            │
│                                                        │
│                             ─────────────────────────  │
│                             총 금액: 15,000원          │
│                                                        │
│                             [장바구니] [바로구매]       │
│                                                        │
├────────────────────────────────────────────────────────┤
│  상품 설명                                             │
│  ────────────────────────────────────────────          │
│  [상세 이미지들...]                                    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 4.3 장바구니

```
┌────────────────────────────────────────────────────────┐
│  장바구니 (2)                                          │
├────────────────────────────────────────────────────────┤
│  [✓] 전체선택 (2/2)                    [선택삭제]      │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [✓] [이미지]  상품명                             │  │
│  │              빨강 / L                            │  │
│  │              [-] 2 [+]           30,000원   [X]  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [✓] [이미지]  상품명                             │  │
│  │              검정 / M                            │  │
│  │              [-] 1 [+]           15,000원   [X]  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│                          상품금액:         45,000원    │
│                          배송비:           + 3,000원   │
│                          ─────────────────────────     │
│                          총 결제금액:      48,000원    │
│                                                        │
│                          [주문하기]                    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 4.4 결제 (토스페이먼츠)

```
┌────────────────────────────────────────────────────────┐
│  주문/결제                                             │
├────────────────────────────────────────────────────────┤
│                                                        │
│  배송지                                    [변경]      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  홍길동 (010-1234-5678)                          │  │
│  │  서울시 강남구 테헤란로 123, 456호               │  │
│  │  [문 앞에 놓아주세요 ▼]                          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  주문상품 (2개)                             [펼치기]   │
│                                                        │
│  결제수단                                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │  [●] 신용/체크카드                               │  │
│  │  [ ] 계좌이체                                    │  │
│  │  [ ] 가상계좌                                    │  │
│  │  [ ] 카카오페이                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│                          상품금액:         45,000원    │
│                          배송비:           + 3,000원   │
│                          ─────────────────────────     │
│                          총 결제금액:      48,000원    │
│                                                        │
│  [✓] 주문 내용을 확인하였으며, 결제에 동의합니다.     │
│                                                        │
│                    [48,000원 결제하기]                 │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 5. 개발 로드맵

### Phase 1: 기반 구축 (1주)

| 작업 | 상세 | 우선순위 |
|------|------|----------|
| 프로젝트 세팅 | Next.js 14, Tailwind, Zustand | P0 |
| DB 스키마 확장 | Customer, Cart, Order, Payment | P0 |
| 고객 인증 | 회원가입, 로그인, 로그아웃 | P0 |
| 레이아웃 | Header, Footer, 반응형 | P0 |

### Phase 2: 상품/장바구니 (1주)

| 작업 | 상세 | 우선순위 |
|------|------|----------|
| 상품 목록 | 필터, 정렬, 페이지네이션 | P0 |
| 상품 상세 | 이미지, 옵션 선택, 수량 | P0 |
| 장바구니 | CRUD, 수량 변경, 선택 삭제 | P0 |
| 상태관리 | Zustand cart store | P0 |

### Phase 3: 주문/결제 (2주)

| 작업 | 상세 | 우선순위 |
|------|------|----------|
| 주문서 | 배송지, 결제수단 선택 | P0 |
| 토스 연동 | SDK 설치, 결제창 호출 | P0 |
| 결제 승인 | confirm API, 웹훅 | P0 |
| 결제 취소 | cancel API, 환불 처리 | P1 |
| 결제 완료/실패 | 결과 페이지 | P0 |

### Phase 4: 마이페이지 (1주)

| 작업 | 상세 | 우선순위 |
|------|------|----------|
| 주문 내역 | 목록, 상세, 상태 표시 | P0 |
| 배송 조회 | 택배사 API 연동 (선택) | P2 |
| 배송지 관리 | CRUD, 기본 배송지 | P1 |
| 회원 정보 | 수정, 비밀번호 변경 | P1 |

### Phase 5: 관리자 연동 (1주)

| 작업 | 상세 | 우선순위 |
|------|------|----------|
| 주문 동기화 | sourcing-app 주문 목록 | P0 |
| 상태 변경 | 배송중, 배송완료 처리 | P0 |
| 재고 관리 | 주문 시 재고 차감 | P1 |
| 매출 통계 | 일별/월별 매출 (선택) | P2 |

---

## 6. 비기능 요구사항

### 6.1 성능

| 항목 | 목표 |
|------|------|
| 첫 페이지 로드 | < 3초 (LCP) |
| 상품 목록 로드 | < 1초 |
| 결제 프로세스 | < 5초 |

### 6.2 보안

- [ ] HTTPS 필수
- [ ] JWT httpOnly 쿠키
- [ ] 비밀번호 bcrypt 해싱
- [ ] SQL Injection 방지 (Prisma)
- [ ] XSS 방지 (React 기본)
- [ ] CSRF 토큰 (선택)
- [ ] 결제 데이터 암호화 (토스 처리)

### 6.3 모바일 대응

- 반응형 디자인 (모바일 퍼스트)
- 터치 친화적 UI
- 모바일 결제 최적화

---

## 7. 환경 설정

### 7.1 환경 변수

```env
# Database
DATABASE_URL="mysql://user:password@localhost:3306/bandauto"

# Auth
JWT_SECRET="your-super-secret-key-at-least-32-chars"

# Toss Payments
TOSS_CLIENT_KEY="test_ck_..."
TOSS_SECRET_KEY="test_sk_..."
TOSS_WEBHOOK_SECRET="..."

# App
NEXT_PUBLIC_BASE_URL="http://localhost:3002"
```

### 7.2 포트 설정

| 앱 | 포트 |
|-----|------|
| sourcing-app | 3001 |
| shop-app | 3002 |

---

## 8. 참고 자료

### 8.1 토스페이먼츠

- [개발자 센터](https://developers.tosspayments.com/)
- [API 문서](https://docs.tosspayments.com/reference)
- [테스트 카드](https://docs.tosspayments.com/resources/testing)

### 8.2 배송 관련 API(Delivery Tracker)

- [API 문서](https://tracker.delivery/docs/tracking-api)

### 8.3 기존 코드 참조

- `sourcing-app/prisma/schema.prisma` - DB 스키마
- `sourcing-app/src/modules/auth/` - 인증 로직
- `sourcing-app/src/app/(admin)/order/new/` - 주문서 UI 참조

---

## 9. 변경 이력

| 버전 | 날짜 | 작성자 | 내용 |
|------|------|--------|------|
| 1.0 | 2025-11-25 | Claude | 초안 작성 |
