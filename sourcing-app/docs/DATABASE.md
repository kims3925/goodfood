# 데이터베이스 규칙

> **관련 문서:** [STRUCTURE.md](./STRUCTURE.md) | [PROJECT.md](./PROJECT.md) | [CLAUDE.md](../CLAUDE.md)

---

## 환경 설정

| 환경 | 데이터베이스 | 설정 |
|-----|------------|------|
| Development | SQLite | `file:./dev.db` |
| Production | MySQL 8.0 | AWS RDS |

### Prisma 설정

```bash
# db 폴더에서 실행 (반드시 --schema prisma 옵션 필요)
cd db
npx prisma generate --schema prisma
npx prisma db push --schema prisma
npx prisma studio --schema prisma
```

---

## 핵심 원칙

| 원칙 | 설명 |
|-----|-----|
| 데이터 정합성 최우선 | 코드 편의성보다 우선 |
| 모든 변경은 추적 가능 | Audit Trail |
| Soft Delete 기본 | Hard Delete 금지 |

---

## Enum 정의

### 사용자 & 인증

| Enum | 값 | 설명 |
|------|---|-----|
| UserRole | `USER`, `MANAGER`, `ADMIN` | 사용자 권한 (회원/매니저/슈퍼관리자) |
| AiProvider | `GEMINI`, `OPENAI` | AI 서비스 제공자 |

### 채널 & 플랫폼

| Enum | 값 | 설명 |
|------|---|-----|
| ChannelKind | `WHOLESALE`, `RETAIL` | 채널 유형 (도매/소매) |
| ChannelPlatform | `BAND`, `NAVER_CAFE`, `ALIEXPRESS`, `SMARTSTORE`, `COUPANG`, `CUSTOM` | 플랫폼 |
| SourcingPlatform | `BAND`, `ALIEXPRESS` | 소싱 플랫폼 |

### 주문 & 결제

| Enum | 값 | 설명 |
|------|---|-----|
| CustomerOrderStatus | `PENDING`, `PAID`, `PREPARING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `REFUNDED` | 주문 상태 |
| TossPaymentMethod | `CARD`, `VIRTUAL_ACCOUNT`, `TRANSFER`, `MOBILE`, `BANK_TRANSFER`, ... | 결제 수단 |
| TossPaymentStatus | `READY`, `IN_PROGRESS`, `WAITING_FOR_DEPOSIT`, `DONE`, `CANCELED`, `EXPIRED`, ... | 결제 상태 |

### 자동화

| Enum | 값 | 설명 |
|------|---|-----|
| WorkflowType | `COLLECT`, `TRANSFORM`, `PUBLISH`, `FULL_PIPELINE` | 워크플로우 유형 |
| WorkflowStatus | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `PARTIAL_SUCCESS` | 워크플로우 상태 |
| TriggerType | `MANUAL`, `SCHEDULED` | 실행 트리거 |
| StepType | `COLLECTION`, `TRANSFORM`, `PRODUCT_CREATE`, `PUBLISH` | 파이프라인 단계 유형 |
| StepStatus | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED` | 단계 실행 상태 |

### CS & 반품

| Enum | 값 | 설명 |
|------|---|-----|
| InquiryType | `PRODUCT`, `DELIVERY`, `ORDER`, `PAYMENT`, `RETURN`, `EXCHANGE`, `GENERAL` | 문의 유형 |
| InquiryStatus | `PENDING`, `ANSWERED` | 문의 상태 |
| ReturnType | `CANCEL`, `RETURN`, `EXCHANGE` | 반품 유형 |
| ReturnStatus | `REQUESTED`, `REVIEWING`, `APPROVED`, `REJECTED`, `PROCESSING`, `COMPLETED` | 반품 상태 |

### 상품 & 배송

| Enum | 값 | 설명 |
|------|---|-----|
| BundleShippingType | `NONE`, `INCLUDED`, `SEPARATE` | 합배송 유형 |
| DiscountType | `PERCENTAGE`, `FIXED_AMOUNT`, `FIXED`, `FREE_SHIPPING` | 할인 유형 |
| NotificationType | `ORDER`, `CANCEL`, `REFUND`, `INQUIRY`, `SETTLEMENT`, `COLLECT`, `TRANSFORM`, `PUBLISH`, `ERROR`, `INFO` | 알림 유형 |

---

## ERD 개요

### 핵심 도메인 관계

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER DOMAIN                                │
├─────────────────────────────────────────────────────────────────────┤
│  User ──┬── SourcingApiConfig (Band API 설정)                        │
│         ├── AiApiConfig (Gemini/OpenAI 설정)                         │
│         ├── AiPromptConfig (AI 프롬프트)                              │
│         └── AutomationConfig (자동화 설정)                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CHANNEL DOMAIN                               │
├─────────────────────────────────────────────────────────────────────┤
│  Channel ──┬── kind: WHOLESALE (도매밴드)                            │
│            └── kind: RETAIL (소매밴드)                               │
│                                                                      │
│  User ─── 1:N ─── Channel                                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SOURCING FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│  Channel(WHOLESALE) → CollectedPost → CollectedProduct → Product    │
│                              │                                       │
│                              ├── CollectedPostImage                  │
│                              └── CollectedPostComment                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PRODUCT DOMAIN                               │
├─────────────────────────────────────────────────────────────────────┤
│  Product ──┬── ProductVariant (옵션 조합별 가격)                      │
│            ├── ProductOption (옵션 그룹/값)                          │
│            └── ProductImage (상품 이미지)                            │
│                                                                      │
│  Product → ShopProduct → Shop (쇼핑몰 발행)                          │
│  Product → ChannelProduct → Channel(RETAIL) (채널 발행)              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          SHOP DOMAIN                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Shop ──┬── ShopTheme (테마 설정)                                    │
│         ├── ShopProduct (쇼핑몰 발행 상품)                            │
│         ├── Order (주문)                                             │
│         └── Settlement (정산)                                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          ORDER DOMAIN                                │
├─────────────────────────────────────────────────────────────────────┤
│  Order ──┬── OrderItem                                               │
│          ├── Payment (Toss Payments)                                 │
│          ├── ShippingAddress                                         │
│          └── RefundAccount                                           │
│                                                                      │
│  Cart ─── CartItem ─── ShopProduct + ProductVariant                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 주요 모델 상세

### User (사용자)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| email | String | 이메일 (Unique) |
| password | String? | 비밀번호 (소셜 로그인은 null) |
| name | String? | 이름 |
| phone | String? | 전화번호 |
| role | UserRole | 권한 (USER/MANAGER/ADMIN) |
| shopId | Int? | 가입된 쇼핑몰 FK |

**Relations:**
- `channels`, `products`, `orders` - 사용자 소유 데이터
- `aiApiConfigs`, `sourcingApiConfigs` - API 설정
- `registeredShop` - 고객으로 가입한 쇼핑몰

### Channel (채널)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| userId | Int | 소유자 FK |
| kind | ChannelKind | WHOLESALE / RETAIL |
| platform | ChannelPlatform | BAND, NAVER_CAFE 등 |
| channelKey | String | 밴드 고유 키 |
| name | String | 채널명 |
| bandSessionCookie | String? | Band 세션 쿠키 |
| sessionExpiresAt | DateTime? | 세션 만료일 |
| shopId | Int? | 연결된 쇼핑몰 |

### Product (상품)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| userId | Int | 소유자 FK |
| channelId | Int? | 원본 도매채널 FK |
| name | String | 상품명 |
| wholesalePrice | Int? | 도매가 |
| price | Int? | 소매가 |
| shippingFee | Int? | 배송비 |
| bundleShippingType | BundleShippingType | 합배송 유형 |
| bundleMaxQty | Int? | 합배송 최대 수량 |

**Relations:**
- `variants` - 옵션 조합별 가격
- `options` - 옵션 그룹/값
- `images` - 상품 이미지
- `shopProducts` - 쇼핑몰 발행 이력
- `channelProducts` - 채널 발행 이력

### Order (주문)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| userId | Int | 주문자 FK |
| orderNumber | String | 주문번호 (ORD-YYYYMMDD-XXXX) |
| status | CustomerOrderStatus | 주문 상태 |
| subtotalAmount | Decimal | 상품 금액 |
| shippingFee | Decimal | 배송비 |
| discountAmount | Decimal | 할인 금액 |
| totalAmount | Decimal | 총 결제 금액 |
| shopId | Int? | 쇼핑몰 FK |

**상태 이력 타임스탬프:**
- `orderedAt`, `paidAt`, `preparingAt`, `shippedAt`, `deliveredAt`, `cancelledAt`

### Payment (결제)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| orderId | Int | 주문 FK (1:1) |
| paymentKey | String | Toss 결제 키 |
| tossOrderId | String | Toss 주문 ID |
| method | TossPaymentMethod | 결제 수단 |
| status | TossPaymentStatus | 결제 상태 |
| amount | Decimal | 결제 금액 |
| rawResponse | String? | Toss API 원본 응답 |

### ShopProduct (쇼핑몰 발행 상품)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| userId | Int | 소유자 FK |
| productId | Int? | 상품 FK (삭제 시 NULL) |
| shopId | Int | 쇼핑몰 FK |
| publishedAt | DateTime? | 발행일시 |
| deletedAt | DateTime? | Soft Delete 시각 |
| createdAt | DateTime | 생성일시 |
| updatedAt | DateTime | 수정일시 |

**Relations:**
- `product` - 원본 상품 (onDelete: SetNull)
- `shop` - 발행된 쇼핑몰 (onDelete: Cascade)
- `user` - 소유자 (onDelete: Cascade)
- `cartItems`, `orderItems`, `guestOrderItems`, `inquiries` - 연관 데이터

**Unique Index:** `(productId, shopId)` - 같은 상품은 같은 쇼핑몰에 한 번만 발행

### ChannelProduct (채널 발행 상품)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| userId | Int | 소유자 FK |
| productId | Int? | 상품 FK (삭제 시 NULL) |
| channelId | Int | 채널 FK (소매 밴드 등) |
| postKey | String? | 밴드 게시물 키 |
| isActive | Boolean | 활성 상태 (기본: true) |
| publishedAt | DateTime? | 발행일시 |
| deletedAt | DateTime? | Soft Delete 시각 |
| createdAt | DateTime | 생성일시 |
| updatedAt | DateTime | 수정일시 |

**Relations:**
- `product` - 원본 상품 (onDelete: SetNull)
- `channel` - 발행된 채널 (onDelete: Cascade)
- `user` - 소유자 (onDelete: Cascade)

**Unique Index:** `(productId, channelId)` - 같은 상품은 같은 채널에 한 번만 발행

### WorkflowStepLog (워크플로우 단계 로그)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| workflowId | Int | WorkflowLog FK |
| stepType | StepType | 단계 유형 (COLLECTION/TRANSFORM/PRODUCT_CREATE/PUBLISH) |
| stepOrder | Int | 단계 순서 |
| status | StepStatus | 상태 (PENDING/RUNNING/COMPLETED/FAILED/SKIPPED) |
| startedAt | DateTime? | 시작 시각 |
| completedAt | DateTime? | 완료 시각 |
| totalItems | Int | 전체 항목 수 |
| processedItems | Int | 처리된 항목 수 |
| successCount | Int | 성공 수 |
| failedCount | Int | 실패 수 |
| details | String? | 상세 JSON (LongText) |
| errorMessage | String? | 에러 메시지 |
| deletedAt | DateTime? | Soft Delete 시각 |

**Relations:**
- `workflow` - 부모 WorkflowLog (onDelete: Cascade)

**Unique Index:** `(workflowId, stepType)` - 워크플로우당 단계 유형은 하나씩

---

## 인덱스 전략

### 복합 인덱스

| 모델 | 인덱스 | 용도 |
|-----|-------|-----|
| Channel | `(userId, channelKey)` | 채널 중복 방지 |
| CollectedPost | `(channelId, externalId)` | 게시물 중복 방지 |
| Order | `(userId, status)` | 사용자별 주문 조회 |
| WorkflowLog | `(userId, workflowType, startedAt)` | 워크플로우 이력 |
| CartItem | `(cartId, shopProductId, variantId)` | 장바구니 중복 방지 |

### 단일 인덱스 (필수)

| 대상 | 이유 |
|-----|-----|
| 모든 FK 컬럼 | JOIN 성능 |
| `isActive` | Soft Delete 필터링 |
| 상태 컬럼 (status) | WHERE 최적화 |
| 정렬 기준 (createdAt) | ORDER BY 최적화 |

---

## 명명 규칙

| 대상 | 규칙 | 예시 |
|-----|-----|-----|
| Prisma 모델 | PascalCase | `CollectedPost` |
| Prisma 필드 | camelCase | `wholesalePrice` |
| DB 테이블 | snake_case (@map) | `collected_post` |
| DB 컬럼 | snake_case (@map) | `wholesale_price` |
| FK 필드 | `{참조모델}Id` | `userId`, `channelId` |

---

## 삭제 정책

| 규칙 |
|-----|
| **Soft Delete 기본** (`isActive = false`) |
| Hard Delete 금지 (예외 시 명시적 선언) |

### FK 삭제 정책

| 관계 | 정책 | 설명 |
|-----|-----|-----|
| User → Channel | `Cascade` | 사용자 삭제 시 채널도 삭제 |
| User → Order | 없음 | 주문 있는 사용자 삭제 불가 |
| Product → ShopProduct | `SetNull` | 상품 삭제해도 발행 기록 유지 |
| Product → ChannelProduct | `SetNull` | 상품 삭제해도 채널 발행 기록 유지 |
| Order → OrderItem | `Cascade` | 주문 삭제 시 항목도 삭제 |
| Channel → CollectedPost | `Cascade` | 채널 삭제 시 게시물도 삭제 |

---

## 트랜잭션 규칙

### 필수 트랜잭션 케이스

| 작업 | 관련 테이블 |
|-----|-----------|
| 주문 생성 | Order, OrderItem, Payment, ShippingAddress |
| 결제 완료 | Order (status), Payment (status) |
| 상품 발행 | Product, ShopProduct, ChannelProduct, ProductImage |
| 워크플로우 | CollectedPost, CollectedProduct, Product, WorkflowLog |

### 사용 예시

```typescript
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ ... })
  await tx.orderItem.createMany({ ... })
  await tx.payment.create({ ... })
  return order
})
```

| 규칙 |
|-----|
| 여러 테이블 변경 시 필수 |
| 금액/상태 변경은 원자성 최우선 |
| 타임아웃 설정 (기본 30초) |
| 외부 API 호출은 트랜잭션 외부로 분리 |

---

## 마이그레이션 규칙

### 명령어

```bash
cd db

# 개발: 스키마 푸시 (마이그레이션 없이)
npx prisma db push --schema prisma

# 운영: 마이그레이션 생성 및 적용
npx prisma migrate dev --schema prisma --name "add_new_field"
npx prisma migrate deploy --schema prisma
```

### 주의사항

| 규칙 |
|-----|
| 운영 DB 스키마 변경 전 백업 필수 |
| 컬럼 삭제/이름 변경 시 데이터 마이그레이션 스크립트 작성 |
| FK 추가 시 기존 데이터 정합성 확인 |
| 대용량 테이블 인덱스 추가는 저부하 시간대 적용 |

---

## 금지사항

| 금지 | 이유 |
|-----|-----|
| Hard Delete 전제 설계 | 복구 불가 |
| FK 없이 관계 추측 | 무결성 불가 |
| SELECT * 사용 | 불필요한 데이터 로드 |
| N+1 쿼리 | 성능 저하 |
| 트랜잭션 없이 다중 테이블 변경 | 정합성 파괴 |

---

## 최근 스키마 변경사항

### 2026-01-08: published_product → shop_product/channel_product 전환

#### 변경 내용

| 변경 | 설명 |
|-----|-----|
| `published_product` 테이블 삭제 | `shop_product`, `channel_product`로 분리 |
| `shop_product` 테이블 생성 | 쇼핑몰별 상품 발행 관리 |
| `channel_product` 테이블 생성 | 채널별 상품 발행 관리 (Band 등) |
| `workflow_step_log` 테이블 생성 | 자동화 파이프라인 단계별 추적 |
| `workflow_log.current_step` 컬럼 추가 | 현재 실행 중인 단계 추적 |

#### 삭제된 컬럼

| 테이블 | 컬럼 | 이유 |
|-------|-----|-----|
| `automation_config` | `pricing_policy_id` | 가격 정책 기능 제거 (채널별 정책으로 대체) |
| `cart_item` | `published_product_id` | `shop_product_id`로 대체 (orphaned FK 정리) |
| `order_item` | `published_product_id` | `shop_product_id`로 대체 (orphaned FK 정리) |
| `guest_order_item` | `published_product_id` | `shop_product_id`로 대체 (orphaned FK 정리) |
| `inquiry` | `published_product_id` | `shop_product_id`로 대체 (orphaned FK 정리) |

#### 가격 정책 처리 방식 변경

**이전**: `AutomationConfig.pricingPolicyId` FK로 참조

**현재**: `CollectedProduct.rawMetadata.pricingPolicyContent`에 적용된 정책 내용 저장

```typescript
// CollectedProduct 생성 시 가격 정책 전달
await collectedProductService.create({
  userId,
  postId,
  name,
  rawMetadata: { ... },
  pricingPolicyContent: batchPolicyContent,  // 적용된 가격 정책 내용
})

// rawMetadata에 저장되는 구조
{
  "category": "...",
  "variants": [...],
  "pricingPolicyContent": "가격 정책 내용..."  // 적용된 정책 저장
}
```

#### 마이그레이션 파일

- **마이그레이션**: `db/prisma/migrations/20260108131455_remove_unused_columns/migration.sql`
- **롤백 스크립트**: `db/prisma/migrations/20260108131455_remove_unused_columns/rollback.sql`

**주요 작업**:
1. 새 테이블 생성 (`shop_product`, `channel_product`, `workflow_step_log`)
2. `workflow_log.current_step` 컬럼 추가
3. `published_product` 데이터를 `shop_product`/`channel_product`로 마이그레이션
4. FK 삭제 후 `published_product` 테이블 삭제
5. Orphaned 컬럼 정리 (`cart_item`, `order_item`, `guest_order_item`, `inquiry`의 `published_product_id` 삭제)

**롤백 방법**:
```bash
# 백업 후 롤백 실행
mysqldump -u [user] -p [database] shop_product channel_product > backup.sql
mysql -u [user] -p [database] < db/prisma/migrations/20260108131455_remove_unused_columns/rollback.sql
```

#### 트랜잭션 적용

자동화 파이프라인에서 `CollectedProduct` 생성과 `AiApiConfig` 사용량 업데이트는 트랜잭션으로 묶어 원자성 보장:

```typescript
await prisma.$transaction(async (tx) => {
  // CollectedProduct 생성
  const created = await collectedProductService.create({...}, { tx })

  // AI 사용량 업데이트
  await tx.aiApiConfig.update({...})

  return created
})
