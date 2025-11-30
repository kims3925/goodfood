# 주문서 통합 계획

## 현재 상태 (2024년 기준)

### 테이블 구조

| 테이블 | 용도 | userId 의미 |
|--------|------|-------------|
| `Order` | 쇼핑몰 주문 (TossPayments 결제) | 쇼핑몰 **고객** ID |
| `OrderTest` | 밴드 주문 (Google Forms 웹훅) | sourcing-app **관리자** ID |

### 주요 차이점

| 항목 | Order (쇼핑몰) | OrderTest (밴드) |
|------|---------------|-----------------|
| **상품 구조** | OrderItem[] (N개 상품) | 단일 상품 (테이블 내 저장) |
| **고객 정보** | recipientName, recipientPhone (필수) | customerName만 |
| **배송 정보** | postalCode, address, addressDetail (필수) | 없음 |
| **금액 타입** | Decimal | Int |
| **상태 관리** | CustomerOrderStatus enum | 없음 |
| **결제 정보** | Payment 테이블 연결 | 없음 |

---

## 통합 목표

**OrderTest 테이블을 삭제하고 Order 테이블에서 모든 주문을 통합 관리**

### 배경
- 소매밴드 발행 시 쇼핑몰 자체 주문서 사용 예정
- 구글폼 대신 자체 주문서로 밴드 주문 수집
- 단일 테이블로 관리하여 정산/통계 단순화

---

## 통합 방안

### Phase 1: Order 스키마 수정

```prisma
model Order {
  id             Int                 @id @default(autoincrement())

  // 새로 추가: 주문 출처 구분
  source         OrderSource         @default(SHOPPING_MALL)

  // 새로 추가: 관리자 ID (밴드 주문 조회용)
  adminUserId    Int?                @map("admin_user_id")

  // 기존 필드 (nullable로 변경)
  userId         Int                 @map("user_id")           // 고객 ID (쇼핑몰) 또는 null (밴드)
  recipientPhone String?             @map("recipient_phone")   // nullable로 변경
  postalCode     String?             @map("postal_code")       // nullable로 변경
  address        String?                                       // nullable로 변경

  // ... 나머지 필드 유지
}

enum OrderSource {
  SHOPPING_MALL    // 쇼핑몰 주문 (결제 O, 배송정보 O)
  BAND_ORDER       // 밴드 주문 (결제 X, 배송정보 X)
}
```

### Phase 2: 데이터 마이그레이션

1. OrderTest 데이터를 Order로 이전
2. OrderTest의 단일 상품 → OrderItem으로 변환
3. source = 'BAND_ORDER' 설정
4. adminUserId 설정

### Phase 3: 코드 수정

| 파일 | 수정 내용 |
|------|----------|
| `/api/order/webhook/route.ts` | OrderTest → Order에 저장 |
| `/api/order/unified/route.ts` | 통합 API → Order만 조회 |
| 정산 관련 코드 | OrderTest 참조 제거 |

### Phase 4: OrderTest 테이블 삭제

---

## 현재 구현 상태 (임시)

### 통합 주문 목록 API
- **경로**: `/api/order/unified`
- **기능**: Order + OrderTest 두 테이블 조회하여 통합 반환
- **조회 방식**:
  - Order: `items.productPublish.userId = 관리자ID` (관리자가 발행한 상품 포함된 주문)
  - OrderTest: `userId = 관리자ID` (직접 연결)

### 통합 주문 목록 페이지
- **경로**: `/order/list`
- **기능**:
  - 출처별 필터 (전체/쇼핑몰/밴드)
  - 검색 (주문번호, 고객명, 연락처)
  - 상세보기 모달

---

## 작업 우선순위

1. **[완료]** 통합 조회 API/페이지 구현
2. **[보류]** Order 스키마 수정 (source, adminUserId 추가)
3. **[보류]** 밴드 자체 주문서 개발
4. **[보류]** 데이터 마이그레이션
5. **[보류]** OrderTest 테이블 삭제

---

## 주의사항

- Order 테이블의 배송 관련 필드 nullable 변경 시, 기존 e-commerce-app 코드에서 null 체크 필요
- 마이그레이션 전 OrderTest 데이터 백업 필수
- 정산 로직이 OrderTest 참조하는 경우 사전 확인 필요

---

## 관련 파일

- `db/prisma/models/order.prisma` - Order, OrderItem, OrderTest 스키마
- `sourcing-app/src/app/api/order/unified/route.ts` - 통합 주문 API
- `sourcing-app/src/app/(admin)/order/list/page.tsx` - 통합 주문 목록 페이지
- `sourcing-app/src/app/api/order/webhook/route.ts` - 구글폼 웹훅 (현재 OrderTest에 저장)
