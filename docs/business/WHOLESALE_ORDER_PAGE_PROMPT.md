# Prompt: 도매처 발주 관리 페이지 설계 및 구현

You are a senior full-stack engineer & UX designer.
Below are the **Requirements**, **Implementation Detail**, **Constraints**, and **Acceptance Tests** for building an internal "도매처 발주 페이지 (Wholesale Purchase Order Page)".
Use them to design and implement the feature end-to-end (backend + frontend), including data model, APIs, and UI/UX.

---

## 프로젝트 컨텍스트

### 현재 데이터 구조

```
Channel (kind: WHOLESALE | RETAIL)
  ├── WHOLESALE: 도매처 (도매밴드)
  └── RETAIL: 소매처 (소매밴드)

Order → OrderItem → PublishedProduct → Product → CollectedProduct → CollectedPost → Channel(도매처)

CustomerOrderStatus: PENDING | PAID | SHIPPED | DELIVERED | CANCELLED | REFUNDED
```

### 도매처 추적 경로 (현재)
```
OrderItem.publishedProductId
  → PublishedProduct.productId
    → Product.collectedProductId
      → CollectedProduct.postId
        → CollectedPost.channelId
          → Channel (kind=WHOLESALE)
```

---

## Requirements (비개발자 관점 명령형)

### 핵심 시나리오
소비자가 쇼핑몰에서 **소매처에 등록된 상품을 구매하고 결제**하면,
결제가 완료된 주문만 발주 대상으로 삼아 **도매처별로 집계**하고 **엑셀 발주서를 추출**할 수 있는 페이지를 만들어라.

### 기능 요구사항

1. **결제 완료 주문만 조회**
   - `status = 'PAID'` 이면서 `paidAt IS NOT NULL`인 주문만 발주 대상
   - 취소(`CANCELLED`), 환불(`REFUNDED`) 주문은 제외

2. **도매처별 집계 화면**
   - 기간(from~to), 소매처, 도매처 필터 제공
   - 각 도매처(Channel with kind=WHOLESALE)별로:
     - 도매처 이름
     - 총 주문 건수
     - 총 상품 수량
     - 총 공급금액 (도매가 기준)
     - 발주 상태 (준비중, 발주완료, 부분발주)
   - 카드 또는 리스트 형태로 표시

3. **도매처별 상세 주문 내역**
   - 도매처 카드 클릭 시 상세 목록 표시
   - 표시 정보:
     - 주문번호
     - 주문일시
     - 소매처(채널) 이름
     - 상품명
     - 옵션(색상/사이즈 등)
     - 수량
     - 도매 단가
     - 공급금액 (단가 × 수량)
     - 고객 이름 (마스킹 처리)
     - 메모 (운영자 비고)

4. **발주 항목 관리**
   - 특정 주문 행을 **발주 제외/포함 토글**
   - 수량 수정 (도매처 최소 수량 맞춤 등)
   - 비고 메모 입력

5. **엑셀 발주서 다운로드**
   - 도매처별 `.xlsx` 파일 생성
   - 도매처가 바로 처리할 수 있는 형식:
     - 상품명, 옵션, 수량, 단가, 공급금액, 비고
     - 마지막 행에 합계
   - 발주서 생성 이력 기록 (언제, 누가, 어떤 도매처)

6. **발주 상태 관리**
   - "발주 준비중" → "발주 완료" 등 상태 변경
   - 상태 변경 이력 저장

7. **발주 이력 조회**
   - 과거 발주 기록 조회 (도매처별, 기간별)
   - 언제, 어느 도매처에, 얼마를 발주했는지 확인

---

## Implementation Detail (개발자 관점)

### 1. 데이터 모델 수정/추가

#### 1.1 OrderItem 필드 추가 (도매처 직접 참조)

```prisma
model OrderItem {
  // 기존 필드...
  id                 Int              @id @default(autoincrement())
  orderId            Int              @map("order_id")
  publishedProductId Int              @map("published_product_id")
  variantId          Int?             @map("variant_id")
  referrerChannelId  Int?             @map("referrer_channel_id")
  productName        String           @map("product_name") @db.VarChar(500)
  optionSummary      String?          @map("option_summary") @db.VarChar(500)
  thumbnailUrl       String?          @map("thumbnail_url") @db.VarChar(1000)
  quantity           Int
  unitPrice          Decimal          @map("unit_price") @db.Decimal(10, 2)
  totalPrice         Decimal          @map("total_price") @db.Decimal(12, 2)
  createdAt          DateTime         @default(now()) @map("created_at") @db.Timestamp(0)

  // 신규 필드 (도매처 발주용)
  wholesaleChannelId Int?             @map("wholesale_channel_id")  // 도매처 직접 참조
  wholesalePrice     Decimal?         @map("wholesale_price") @db.Decimal(10, 2)  // 도매 단가 스냅샷
  wholesaleOrderStatus WholesaleOrderStatus @default(PENDING) @map("wholesale_order_status")

  // Relations
  order              Order            @relation(fields: [orderId], references: [id], onDelete: Cascade)
  publishedProduct   PublishedProduct @relation(fields: [publishedProductId], references: [id])
  variant            ProductVariant?  @relation(fields: [variantId], references: [id])
  referrerChannel    Channel?         @relation("OrderItemReferrer", fields: [referrerChannelId], references: [id])
  wholesaleChannel   Channel?         @relation("OrderItemWholesale", fields: [wholesaleChannelId], references: [id])

  @@index([orderId])
  @@index([publishedProductId])
  @@index([variantId])
  @@index([referrerChannelId])
  @@index([wholesaleChannelId])
  @@index([wholesaleOrderStatus])
  @@map("order_item")
}
```

#### 1.2 도매처 발주 상태 enum 추가

```prisma
enum WholesaleOrderStatus {
  PENDING     // 발주대기
  ORDERED     // 발주완료
  SHIPPING    // 배송중
  COMPLETED   // 완료
  EXCLUDED    // 발주제외
}
```

#### 1.3 발주 배치 테이블 (신규)

```prisma
model WholesaleOrderBatch {
  id                 Int                       @id @default(autoincrement())
  wholesaleChannelId Int                       @map("wholesale_channel_id")
  periodStartDate    DateTime                  @map("period_start_date") @db.Date
  periodEndDate      DateTime                  @map("period_end_date") @db.Date
  totalQuantity      Int                       @map("total_quantity")
  totalAmount        Decimal                   @map("total_amount") @db.Decimal(12, 2)
  status             WholesaleBatchStatus      @default(PENDING)
  generatedBy        Int                       @map("generated_by")
  generatedAt        DateTime                  @default(now()) @map("generated_at") @db.Timestamp(0)
  orderedAt          DateTime?                 @map("ordered_at") @db.Timestamp(0)
  note               String?                   @db.Text
  exportedFileName   String?                   @map("exported_file_name") @db.VarChar(255)

  wholesaleChannel   Channel                   @relation("WholesaleBatches", fields: [wholesaleChannelId], references: [id])
  generatedByUser    User                      @relation(fields: [generatedBy], references: [id])
  items              WholesaleOrderBatchItem[]

  @@unique([wholesaleChannelId, periodStartDate, periodEndDate])
  @@index([wholesaleChannelId])
  @@index([status])
  @@index([generatedAt])
  @@map("wholesale_order_batch")
}

model WholesaleOrderBatchItem {
  id              Int                    @id @default(autoincrement())
  batchId         Int                    @map("batch_id")
  orderItemId     Int                    @map("order_item_id")
  originalQty     Int                    @map("original_qty")
  adjustedQty     Int                    @map("adjusted_qty")
  unitPrice       Decimal                @map("unit_price") @db.Decimal(10, 2)
  totalAmount     Decimal                @map("total_amount") @db.Decimal(12, 2)
  excluded        Boolean                @default(false)
  memo            String?                @db.VarChar(500)
  createdAt       DateTime               @default(now()) @map("created_at") @db.Timestamp(0)

  batch           WholesaleOrderBatch    @relation(fields: [batchId], references: [id], onDelete: Cascade)
  orderItem       OrderItem              @relation(fields: [orderItemId], references: [id])

  @@unique([batchId, orderItemId])
  @@index([batchId])
  @@index([orderItemId])
  @@map("wholesale_order_batch_item")
}

enum WholesaleBatchStatus {
  PENDING     // 준비중
  GENERATED   // 발주서 생성됨
  ORDERED     // 발주 완료
  PARTIAL     // 부분 발주
}
```

#### 1.4 Channel 모델에 관계 추가

```prisma
model Channel {
  // 기존 필드...

  // 신규 관계 추가
  wholesaleOrderItems  OrderItem[]           @relation("OrderItemWholesale")
  wholesaleBatches     WholesaleOrderBatch[] @relation("WholesaleBatches")
}
```

---

### 2. 백엔드 API 설계

#### 2.1 도매처별 집계 조회

```
GET /api/admin/wholesale-orders/summary
```

**Query Parameters:**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| from | string (YYYY-MM-DD) | O | 시작일 |
| to | string (YYYY-MM-DD) | O | 종료일 |
| wholesaleChannelId | number | - | 도매처 필터 |
| retailChannelId | number | - | 소매처 필터 |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "wholesaleChannelId": 1,
      "wholesaleChannelName": "도매밴드A",
      "totalOrders": 15,
      "totalQuantity": 120,
      "totalAmount": 1500000,
      "pendingCount": 10,
      "orderedCount": 5,
      "lastBatchStatus": "PENDING"
    }
  ]
}
```

#### 2.2 도매처별 상세 주문 목록

```
GET /api/admin/wholesale-orders/:wholesaleChannelId/items
```

**Query Parameters:**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| from | string | O | 시작일 |
| to | string | O | 종료일 |
| status | string | - | 발주상태 필터 |
| page | number | - | 페이지 (기본: 1) |
| limit | number | - | 페이지당 개수 (기본: 50) |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "orderItemId": 123,
        "orderNumber": "ORD-20241205-001",
        "orderedAt": "2024-12-05T10:30:00Z",
        "retailChannelName": "소매밴드B",
        "productName": "겨울 패딩 점퍼",
        "optionSummary": "블랙/XL",
        "quantity": 2,
        "wholesalePrice": 35000,
        "totalAmount": 70000,
        "customerName": "홍*동",
        "wholesaleOrderStatus": "PENDING",
        "memo": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 120,
      "totalPages": 3
    },
    "summary": {
      "totalQuantity": 120,
      "totalAmount": 1500000
    }
  }
}
```

#### 2.3 발주 배치 생성

```
POST /api/admin/wholesale-orders/batches
```

**Request Body:**
```json
{
  "wholesaleChannelId": 1,
  "periodStartDate": "2024-12-01",
  "periodEndDate": "2024-12-05",
  "items": [
    {
      "orderItemId": 123,
      "adjustedQty": 2,
      "excluded": false,
      "memo": "색상 확인 필요"
    },
    {
      "orderItemId": 124,
      "adjustedQty": 0,
      "excluded": true,
      "memo": "재고 없음으로 제외"
    }
  ],
  "note": "12월 1주차 발주"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "batchId": 45,
    "status": "GENERATED",
    "totalQuantity": 50,
    "totalAmount": 750000
  }
}
```

#### 2.4 엑셀 발주서 다운로드

```
GET /api/admin/wholesale-orders/batches/:batchId/export
```

**Response:** `.xlsx` 파일 다운로드

#### 2.5 발주 상태 변경

```
PATCH /api/admin/wholesale-orders/batches/:batchId/status
```

**Request Body:**
```json
{
  "status": "ORDERED",
  "note": "밴드 메시지로 발주 전달 완료"
}
```

#### 2.6 발주 이력 조회

```
GET /api/admin/wholesale-orders/batches
```

**Query Parameters:**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| wholesaleChannelId | number | - | 도매처 필터 |
| status | string | - | 상태 필터 |
| from | string | - | 생성일 시작 |
| to | string | - | 생성일 종료 |
| page | number | - | 페이지 |
| limit | number | - | 개수 |

---

### 3. 집계 쿼리 로직

```typescript
// 도매처별 집계 쿼리 (Prisma)
const summary = await prisma.$queryRaw`
  SELECT
    oi.wholesale_channel_id,
    c.name AS wholesale_channel_name,
    COUNT(DISTINCT oi.order_id) AS total_orders,
    SUM(oi.quantity) AS total_quantity,
    SUM(oi.wholesale_price * oi.quantity) AS total_amount,
    SUM(CASE WHEN oi.wholesale_order_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
    SUM(CASE WHEN oi.wholesale_order_status = 'ORDERED' THEN 1 ELSE 0 END) AS ordered_count
  FROM order_item oi
  INNER JOIN \`order\` o ON oi.order_id = o.id
  INNER JOIN channel c ON oi.wholesale_channel_id = c.id
  WHERE o.status = 'PAID'
    AND o.paid_at IS NOT NULL
    AND o.ordered_at >= ${from}
    AND o.ordered_at <= ${to}
    AND c.kind = 'WHOLESALE'
  GROUP BY oi.wholesale_channel_id, c.name
  ORDER BY total_amount DESC
`;
```

---

### 4. 프론트엔드 구조

#### 4.1 페이지 경로
```
/admin/wholesale-orders          # 발주 관리 메인
/admin/wholesale-orders/history  # 발주 이력
```

#### 4.2 레이아웃 구성

```
┌─────────────────────────────────────────────────────────────────┐
│  필터 영역                                                       │
│  [기간: 2024-12-01 ~ 2024-12-05] [소매처: 전체 ▼] [도매처: 전체 ▼] │
│  [조회]                                                          │
├─────────────────────────────────────────────────────────────────┤
│  도매처별 요약 카드                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ 도매밴드A     │ │ 도매밴드B     │ │ 도매밴드C     │             │
│  │ 15건 / 120개  │ │ 8건 / 45개   │ │ 22건 / 180개  │             │
│  │ ₩1,500,000   │ │ ₩680,000     │ │ ₩2,340,000   │             │
│  │ [준비중]      │ │ [발주완료]    │ │ [준비중]      │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  상세 주문 목록 (도매처 카드 클릭 시)                              │
│  ┌────┬──────────┬────────┬──────────┬────┬──────┬────────┬───┐ │
│  │ □  │ 주문번호  │ 주문일  │ 소매처    │수량│ 단가  │ 금액    │메모│ │
│  ├────┼──────────┼────────┼──────────┼────┼──────┼────────┼───┤ │
│  │ ☑  │ ORD-001  │ 12/05  │ 밴드A    │ 2  │35,000│ 70,000 │   │ │
│  │ ☑  │ ORD-002  │ 12/05  │ 밴드B    │ 3  │35,000│105,000 │   │ │
│  │ ☐  │ ORD-003  │ 12/04  │ 밴드A    │ 1  │35,000│ 35,000 │제외│ │
│  └────┴──────────┴────────┴──────────┴────┴──────┴────────┴───┘ │
│                                                                  │
│  합계: 5개 / ₩175,000                    [발주서 생성] [엑셀 다운로드] │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3 컴포넌트 구조

```
src/app/admin/wholesale-orders/
├── page.tsx                    # 메인 페이지
├── components/
│   ├── WholesaleOrderFilter.tsx    # 필터 영역
│   ├── WholesaleSummaryCard.tsx    # 도매처 요약 카드
│   ├── WholesaleOrderTable.tsx     # 상세 주문 테이블
│   ├── BatchCreateModal.tsx        # 발주 배치 생성 모달
│   └── ExcelDownloadButton.tsx     # 엑셀 다운로드 버튼
├── history/
│   └── page.tsx                # 발주 이력 페이지
└── hooks/
    ├── useWholesaleOrderSummary.ts
    ├── useWholesaleOrderItems.ts
    └── useWholesaleBatch.ts
```

---

### 5. 엑셀 생성 형식

#### 5.1 시트 구조

```
┌─────────────────────────────────────────────────────────────┐
│                     도매 발주서                              │
├─────────────────────────────────────────────────────────────┤
│ 도매처: 도매밴드A                                            │
│ 발주기간: 2024-12-01 ~ 2024-12-05                           │
│ 생성일시: 2024-12-05 14:30                                  │
│ 담당자: 관리자                                               │
├─────────────────────────────────────────────────────────────┤
│ 상품명      │ 옵션        │ 수량 │ 단가    │ 공급금액   │ 비고 │
├─────────────────────────────────────────────────────────────┤
│ 겨울 패딩   │ 블랙/XL     │  2   │ 35,000  │   70,000  │      │
│ 겨울 패딩   │ 네이비/L    │  3   │ 35,000  │  105,000  │      │
│ 니트 가디건 │ 베이지/F    │  5   │ 28,000  │  140,000  │      │
├─────────────────────────────────────────────────────────────┤
│                    합계 │ 10   │         │  315,000  │      │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2 서버 사이드 구현 (exceljs)

```typescript
import ExcelJS from 'exceljs';

async function generateWholesaleOrderExcel(batch: WholesaleOrderBatch) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('발주서');

  // 헤더 정보
  sheet.addRow(['도매 발주서']);
  sheet.addRow([`도매처: ${batch.wholesaleChannel.name}`]);
  sheet.addRow([`발주기간: ${batch.periodStartDate} ~ ${batch.periodEndDate}`]);
  sheet.addRow([`생성일시: ${format(batch.generatedAt, 'yyyy-MM-dd HH:mm')}`]);
  sheet.addRow([]);

  // 테이블 헤더
  sheet.addRow(['상품명', '옵션', '수량', '단가', '공급금액', '비고']);

  // 데이터
  let totalQty = 0;
  let totalAmount = 0;

  for (const item of batch.items.filter(i => !i.excluded)) {
    sheet.addRow([
      item.orderItem.productName,
      item.orderItem.optionSummary || '-',
      item.adjustedQty,
      item.unitPrice,
      item.totalAmount,
      item.memo || ''
    ]);
    totalQty += item.adjustedQty;
    totalAmount += Number(item.totalAmount);
  }

  // 합계
  sheet.addRow(['합계', '', totalQty, '', totalAmount, '']);

  return workbook;
}
```

---

## Constraints (제약조건)

1. **결제 완료 주문만** 발주 대상
   - `status = 'PAID'` AND `paidAt IS NOT NULL`
   - `CANCELLED`, `REFUNDED` 상태 제외

2. **도매처 식별**
   - `Channel.kind = 'WHOLESALE'`인 채널만 도매처로 인식
   - OrderItem에 `wholesaleChannelId` 직접 저장하여 JOIN 최소화

3. **N+1 방지**
   - 집계 쿼리는 GROUP BY 사용
   - 상세 조회는 필요한 관계만 include

4. **중복 배치 방지**
   - 동일 도매처 + 동일 기간에 대해 unique 제약
   - 중복 시도 시 기존 배치 수정 안내

5. **개인정보 보호**
   - 엑셀에 고객 상세주소, 연락처 미포함
   - 고객명은 마스킹 처리 (홍*동)

6. **권한 제어**
   - `/api/admin/*` 경로는 관리자(SOURCING_USER, ADMIN) 권한 필요
   - 세션/토큰 인증 필수

7. **페이징**
   - 상세 목록은 서버 사이드 페이징 (기본 50건)
   - 대량 데이터 처리 시 스트리밍 고려

---

## Acceptance Tests (검증 조건)

### 1. 결제 필터링 테스트
- [ ] `status = 'PAID'` 주문만 집계에 포함
- [ ] `PENDING`, `CANCELLED`, `REFUNDED` 주문 미포함 확인
- [ ] 요약/상세/엑셀 모두 동일 필터 적용 확인

### 2. 도매처별 집계 정확도 테스트
- [ ] 도매처 A: 3건, 10개, ₩100,000 → 정확히 표시
- [ ] 도매처 B: 2건, 5개, ₩50,000 → 정확히 표시
- [ ] 엑셀 합계와 화면 합계 일치

### 3. 기간 필터 테스트
- [ ] from~to 범위 내 주문만 집계
- [ ] 경계값(시작일/종료일) 포함 확인
- [ ] 시간대(timezone) 처리 정확성

### 4. 소매처/도매처 필터 테스트
- [ ] 특정 소매처 선택 시 해당 주문만 표시
- [ ] 특정 도매처 선택 시 해당 상품만 표시
- [ ] 복합 필터 조합 정상 동작

### 5. 발주 제외/수량 수정 테스트
- [ ] "발주 제외" 체크 시 배치에서 제외
- [ ] 수량 수정 시 금액 재계산
- [ ] 수정 내역 DB 저장 확인

### 6. 엑셀 다운로드 테스트
- [ ] `.xlsx` 파일 정상 생성
- [ ] 파일 내 컬럼/값/합계 정확성
- [ ] 한글 깨짐 없음 확인

### 7. 발주 배치 생성/이력 테스트
- [ ] 배치 생성 시 DB 저장 확인
- [ ] 이력 탭에서 조회 가능
- [ ] 상태 변경 후 즉시 반영

### 8. 권한 테스트
- [ ] 비로그인 사용자 API 접근 거부 (401)
- [ ] 일반 고객(CUSTOMER) 접근 거부 (403)
- [ ] 관리자(ADMIN, SOURCING_USER) 정상 접근

### 9. 성능 테스트
- [ ] 1,000건 주문 기준 집계 조회 < 2초
- [ ] 페이지네이션 정상 동작
- [ ] 엑셀 생성 < 5초 (1,000행 기준)

---

## 파일 구조

```
sourcing-app/
├── src/
│   ├── app/
│   │   └── admin/
│   │       └── wholesale-orders/
│   │           ├── page.tsx
│   │           ├── history/
│   │           │   └── page.tsx
│   │           └── components/
│   │               ├── WholesaleOrderFilter.tsx
│   │               ├── WholesaleSummaryCard.tsx
│   │               ├── WholesaleOrderTable.tsx
│   │               ├── BatchCreateModal.tsx
│   │               └── ExcelDownloadButton.tsx
│   └── lib/
│       └── api/
│           └── wholesale-orders/
│               ├── route.ts
│               ├── [wholesaleChannelId]/
│               │   └── items/
│               │       └── route.ts
│               └── batches/
│                   ├── route.ts
│                   └── [batchId]/
│                       ├── route.ts
│                       ├── export/
│                       │   └── route.ts
│                       └── status/
│                           └── route.ts

db/
├── prisma/
│   ├── schema.prisma          # enum 추가
│   └── models/
│       ├── order.prisma       # OrderItem 필드 추가
│       └── wholesale.prisma   # 신규: 발주 배치 테이블
```

---

## 관련 문서

- [도매처 발주 시나리오](./WHOLESALE_ORDER_SCENARIO.md)
- [소매처 정산 시스템](./SHOP_REFERRER_SYSTEM.md)
