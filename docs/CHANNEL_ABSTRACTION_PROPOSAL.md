# 채널 추상화 스키마 제안서

## 개요

상품의 도매처(Source)와 발행처(Publish)를 추상화하여 확장성과 독립성을 확보하기 위한 스키마 변경 제안

---

## 현재 구조 vs 제안 구조

### 1. 도매처 (Source) 관리

#### 현재 구조

```
Product ──► Post ──► WholesaleBand
```

```prisma
// 현재: Product가 Post를 통해 WholesaleBand에 종속
model Product {
  id           Int           @id @default(autoincrement())
  postId       Int           @unique @map("post_id")  // Post에 종속
  // ...
  post         Post          @relation(...)
}

model Post {
  wholesaleBandId  Int  // WholesaleBand에 종속
  wholesaleBand    WholesaleBand @relation(...)
}
```

**문제점:**
- 도매밴드 외 다른 도매처(알리바바, 타오바오 등) 추가 시 스키마 대폭 변경 필요
- Post 테이블이 도매밴드 전용 구조

---

#### 제안 구조

```
Product ──► SourceChannel ──► (WholesaleBand | Ali | Taobao | ...)
```

```prisma
// 도매처 타입 정의
enum SourceChannelType {
  WHOLESALE_BAND  // 도매밴드
  ALI             // 알리바바
  TAOBAO          // 타오바오
  DIRECT          // 직접 등록
}

// 도매처 추상화 테이블
model SourceChannel {
  id        Int               @id @default(autoincrement())
  userId    Int               @map("user_id")
  type      SourceChannelType // 도매처 타입
  name      String            @db.VarChar(200)  // "도매밴드 A", "알리바바" 등
  refId     Int?              @map("ref_id")    // 원본 테이블 ID (WholesaleBand.id 등)
  config    Json?             // 채널별 설정 (API key, 인증 정보 등)
  isActive  Boolean           @default(true) @map("is_active")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relationships
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  products  Product[]

  @@index([userId])
  @@index([type])
  @@map("source_channel")
}

// Product 변경
model Product {
  id              Int           @id @default(autoincrement())
  userId          Int           @map("user_id")
  sourceChannelId Int           @map("source_channel_id")  // 도매처 참조
  sourceRefId     String?       @map("source_ref_id")      // 원본 시스템의 상품 ID

  // Basic Info
  name            String        @db.VarChar(500)
  description     String?       @db.Text
  status          ProductStatus @default(COLLECTED)
  // ... 기타 필드

  // Relationships
  sourceChannel   SourceChannel  @relation(fields: [sourceChannelId], references: [id])
  publishes       ProductPublish[]
}
```

**장점:**
- 새 도매처 추가 시 `SourceChannelType` enum만 추가
- Product는 SourceChannel만 알면 됨 (도매밴드 직접 참조 안 함)
- 각 도매처별 설정을 config JSON에 저장 가능

---

### 2. 발행처 (Publish) 관리

#### 현재 구조

```
ProductPublish ──► RetailBand (소매밴드에 종속)
```

```prisma
// 현재: ProductPublish가 RetailBand에 종속
model ProductPublish {
  id            Int           @id @default(autoincrement())
  productId     Int           @map("product_id")
  retailBandId  Int           @map("retail_band_id")  // RetailBand에 종속
  status        PublishStatus @default(PENDING)

  retailBand    RetailBand    @relation(...)

  @@unique([productId, retailBandId])
}
```

**문제점:**
- 소매밴드 외 다른 발행처(쇼핑몰, 스마트스토어, 쿠팡 등) 추가 불가
- 발행처별 독립적인 상태 관리 어려움
- 한쪽만 발행해도 다른 쪽에서 미발행 상품 조회 어려움

---

#### 제안 구조

```
ProductPublish ──► PublishChannel ──► (RetailBand | ShoppingMall | SmartStore | ...)
```

```prisma
// 발행처 타입 정의
enum PublishChannelType {
  RETAIL_BAND    // 소매밴드
  SHOPPING_MALL  // 자체 쇼핑몰
  SMART_STORE    // 네이버 스마트스토어
  COUPANG        // 쿠팡
  ELEVEN_ST      // 11번가
}

// 발행처 추상화 테이블
model PublishChannel {
  id        Int                @id @default(autoincrement())
  userId    Int                @map("user_id")
  type      PublishChannelType // 발행처 타입
  name      String             @db.VarChar(200)  // "소매밴드 A", "내 스마트스토어" 등
  refId     Int?               @map("ref_id")    // 원본 테이블 ID (RetailBand.id 등)
  config    Json?              // 채널별 설정 (API key, 인증 정보 등)
  isActive  Boolean            @default(true) @map("is_active")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relationships
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  publishes ProductPublish[]

  @@index([userId])
  @@index([type])
  @@map("publish_channel")
}

// ProductPublish 변경
model ProductPublish {
  id               Int            @id @default(autoincrement())
  userId           Int            @map("user_id")
  productId        Int            @map("product_id")
  publishChannelId Int            @map("publish_channel_id")  // 발행처 참조

  status           PublishStatus  @default(PENDING)
  externalId       String?        @map("external_id")  // 외부 시스템의 상품 ID
  externalUrl      String?        @map("external_url") @db.VarChar(1000)  // 발행된 URL

  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  // Relationships
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  product          Product        @relation(fields: [productId], references: [id], onDelete: Cascade)
  publishChannel   PublishChannel @relation(fields: [publishChannelId], references: [id], onDelete: Cascade)

  // E-Commerce Relations (쇼핑몰 발행 시)
  orderItems       OrderItem[]
  cartItems        CartItem[]

  @@unique([productId, publishChannelId])  // 같은 상품을 같은 채널에 중복 발행 방지
  @@index([userId])
  @@index([productId])
  @@index([publishChannelId])
  @@index([status])
  @@map("product_publish")
}
```

**장점:**
- 새 발행처 추가 시 `PublishChannelType` enum만 추가
- 발행처별 완전 독립적인 상태 관리
- 소매밴드만 발행해도 쇼핑몰에서는 미발행으로 조회 가능

---

### 3. 상품 상태 (ProductStatus) 관리

#### 현재 구조

```prisma
enum ProductStatus {
  COLLECTED   // 수집됨
  PUBLISHED   // 발행됨 (어디에? 불명확)
}
```

**문제점:**
- 어느 발행처에 발행됐는지 알 수 없음
- 한쪽만 발행해도 PUBLISHED로 바뀌면 다른 쪽에서 조회 어려움

---

#### 제안 구조

```prisma
enum ProductStatus {
  COLLECTED  // 수집됨 - 활성 상태 (발행 가능)
  ARCHIVED   // 보관됨 - 비활성 상태 (숨김 처리)
}
```

**핵심 변경:**
- `ProductStatus`는 상품의 **라이프사이클 상태**만 관리
- **발행 여부와 무관하게** 수집된 상품은 계속 `COLLECTED` 유지
- 발행 상태는 오직 `ProductPublish` 테이블에서만 관리

**발행현황 계산 (UI 레벨):**
```typescript
// API 응답 시 동적 계산
const publishedCount = product.publishes.filter(p => p.status === 'SUCCESS').length
const totalChannels = await prisma.publishChannel.count({ where: { userId, isActive: true } })

const publishStatus =
  publishedCount === 0 ? '미발행' :
  publishedCount < totalChannels ? '부분발행' : '발행완료'
```

---

## 비교 요약표

| 항목 | 현재 | 제안 |
|------|------|------|
| **도매처 참조** | Post → WholesaleBand | Product → SourceChannel |
| **발행처 참조** | ProductPublish → RetailBand | ProductPublish → PublishChannel |
| **새 도매처 추가** | 스키마 변경 필요 | enum 추가 + 데이터 insert |
| **새 발행처 추가** | 스키마 변경 필요 | enum 추가 + 데이터 insert |
| **발행처별 독립 관리** | 불가능 | 가능 |
| **Product.status 역할** | 발행 여부 (불명확) | 라이프사이클 상태 |
| **발행 상태 추적** | Product.status | ProductPublish 테이블 |

---

## 구조 다이어그램

### 현재 구조

```
┌─────────────┐      ┌─────────────┐      ┌─────────────────┐
│ Wholesale   │◄─────│    Post     │◄─────│     Product     │
│   Band      │      │             │      │                 │
└─────────────┘      └─────────────┘      └────────┬────────┘
                                                   │
                                                   ▼
┌─────────────┐      ┌─────────────────────────────────────┐
│  Retail     │◄─────│          ProductPublish             │
│   Band      │      │  (소매밴드에만 발행 가능)             │
└─────────────┘      └─────────────────────────────────────┘
```

### 제안 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│                        도매처 (Source)                              │
├─────────────────────────────────────────────────────────────────────┤
│  SourceChannel                                                      │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐     │
│  │ WHOLESALE    │ WHOLESALE    │     ALI      │   TAOBAO     │     │
│  │ _BAND        │ _BAND        │              │              │     │
│  │ refId: 1     │ refId: 2     │ refId: null  │ refId: null  │     │
│  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘     │
│         │              │              │              │              │
└─────────┼──────────────┼──────────────┼──────────────┼──────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           Product                                   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ sourceChannelId로 도매처 참조                                │    │
│  │ status: COLLECTED (발행과 무관하게 유지)                      │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────┬──────────────┬──────────────┬──────────────┬──────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        ProductPublish                               │
│           publishChannelId로 발행처별 독립 관리                       │
└─────────┬──────────────┬──────────────┬──────────────┬──────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        발행처 (Publish)                             │
├─────────────────────────────────────────────────────────────────────┤
│  PublishChannel                                                     │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐     │
│  │ RETAIL_BAND  │ SHOPPING     │ SMART_STORE  │   COUPANG    │     │
│  │ refId: 1     │ _MALL        │ refId: null  │ refId: null  │     │
│  │              │ refId: null  │              │              │     │
│  └──────────────┴──────────────┴──────────────┴──────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 조회 로직 예시

### 수집상품관리 페이지

```typescript
// 상품 목록 조회 (발행 현황 포함)
const products = await prisma.product.findMany({
  where: {
    userId,
    status: 'COLLECTED'  // 활성 상품만
  },
  include: {
    sourceChannel: {
      select: { type: true, name: true }
    },
    publishes: {
      where: { status: 'SUCCESS' },
      include: {
        publishChannel: {
          select: { type: true, name: true }
        }
      }
    }
  }
})

// 응답 가공
const formattedProducts = products.map(product => {
  const publishedChannels = product.publishes.map(p => p.publishChannel.type)

  return {
    ...product,
    sourceType: product.sourceChannel.type,
    sourceName: product.sourceChannel.name,
    publishStatus: {
      retailBand: publishedChannels.includes('RETAIL_BAND'),
      shoppingMall: publishedChannels.includes('SHOPPING_MALL'),
      smartStore: publishedChannels.includes('SMART_STORE'),
    },
    publishSummary:
      publishedChannels.length === 0 ? '미발행' :
      publishedChannels.length < totalChannels ? '부분발행' : '발행완료'
  }
})
```

### 소매밴드 발행 페이지

```typescript
// 소매밴드 미발행 상품만 조회
const products = await prisma.product.findMany({
  where: {
    userId,
    status: 'COLLECTED',
    NOT: {
      publishes: {
        some: {
          publishChannel: { type: 'RETAIL_BAND' },
          status: 'SUCCESS'
        }
      }
    }
  }
})
```

### 쇼핑몰 발행 페이지

```typescript
// 쇼핑몰 미발행 상품만 조회
const products = await prisma.product.findMany({
  where: {
    userId,
    status: 'COLLECTED',
    NOT: {
      publishes: {
        some: {
          publishChannel: { type: 'SHOPPING_MALL' },
          status: 'SUCCESS'
        }
      }
    }
  }
})
```

---

## 마이그레이션 전략

### 1단계: 새 테이블 생성
- SourceChannel, PublishChannel 테이블 생성
- enum 추가 (SourceChannelType, PublishChannelType)

### 2단계: 데이터 마이그레이션
```sql
-- 기존 WholesaleBand → SourceChannel 마이그레이션
INSERT INTO source_channel (user_id, type, name, ref_id, is_active)
SELECT user_id, 'WHOLESALE_BAND', name, id, is_active
FROM wholesale_band;

-- 기존 RetailBand → PublishChannel 마이그레이션
INSERT INTO publish_channel (user_id, type, name, ref_id, is_active)
SELECT user_id, 'RETAIL_BAND', name, id, is_active
FROM retail_band;

-- 쇼핑몰 발행 채널 추가
INSERT INTO publish_channel (user_id, type, name, is_active)
SELECT DISTINCT user_id, 'SHOPPING_MALL', '쇼핑몰', true
FROM retail_band;
```

### 3단계: Product 테이블 수정
- sourceChannelId 컬럼 추가
- 기존 데이터 업데이트

### 4단계: ProductPublish 테이블 수정
- publishChannelId 컬럼 추가
- 기존 retailBandId 데이터를 publishChannelId로 변환

### 5단계: 기존 컬럼 제거 (선택적)
- Product.postId 관계 재검토
- ProductPublish.retailBandId 제거

---

## 예상 효과

| 항목 | 효과 |
|------|------|
| **도매처 확장** | 알리바바, 타오바오 등 추가 시 코드 변경 최소화 |
| **발행처 확장** | 스마트스토어, 쿠팡 등 추가 시 코드 변경 최소화 |
| **독립적 발행 관리** | 소매밴드만 발행해도 쇼핑몰에서 미발행으로 조회 |
| **UI 명확성** | 수집상품관리에서 발행처별 상태 한눈에 확인 |
| **유지보수성** | 채널 추가/수정 시 enum + 데이터만 변경 |

---

## 결론

이 제안은 현재의 강결합 구조를 추상화 레이어를 통해 느슨하게 연결함으로써:

1. **도매처/발행처 확장성** 확보
2. **발행처별 독립적 상태 관리** 가능
3. **스키마 변경 최소화** (새 채널 추가 시)
4. **기존 테이블(WholesaleBand, RetailBand) 유지** 가능

를 달성합니다.
