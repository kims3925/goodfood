# 데이터베이스 규칙

> **관련 문서:** [STRUCTURE.md](./STRUCTURE.md) | [PROJECT.md](./PROJECT.md) | [CLAUDE.md](../CLAUDE.md)

---

## 환경 설정

| 환경 | 데이터베이스 | 설정 |
|-----|------------|------|
| Development | MariaDB | `mysql://user:pass@localhost:3306/bandauto` |
| Production | MariaDB | AWS RDS |

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
| ChannelKind | `WHOLESALE`, `RETAIL` | 채널 유형 (도매 소스 / 소매 발행대상) |
| ChannelPlatform | `BAND`, `NAVER_CAFE`, `ALIEXPRESS`, `SMARTSTORE`, `COUPANG`, `CUSTOM` | 플랫폼 |
| SourcingPlatform | `BAND`, `ALIEXPRESS` | 소싱 플랫폼 |
| PriceTier | `WHOLESALE`, `RETAIL` | 다단계 발행 가격 tier (발행대상의 가격 기준) |

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
| bandLoginEmail | String? | 발행/삭제에 사용할 밴드 로그인 네이버 ID. 세션 저장 시 일치 검증, null=검증 생략 (2026-06-10) |

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
| sessionAccountEmail | String? | 저장된 세션이 어느 밴드 계정 것인지 기록 (저장 시점 기입, null=구버전 저장분) (2026-06-10) |
| shopId | Int? | 연결된 쇼핑몰 |
| publishPriceTier | PriceTier | 다단계 발행: 발행 가격 기준 (기본 `RETAIL`=소매가, `WHOLESALE`=도매가/가족도매방). RETAIL 채널에만 의미 |

> **가족도매방밴드 매핑**: 가족도매방밴드는 우리가 글을 **올리는 발행 대상**이므로 `kind=RETAIL`
> (발행 대상 역할) 이면서 `publishPriceTier=WHOLESALE` (도매가로 발행) 인 채널이다.
> `kind=WHOLESALE` 채널은 여전히 소싱 소스(수집 대상)를 의미한다 — 혼동 주의.

### Product (상품)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| userId | Int | 소유자 FK |
| channelId | Int? | 원본 도매채널 FK |
| name | String | 상품명 |
| wholesalePrice | Decimal? | 도매가 (옵션 없는 상품의 기본 도매가) |
| price | Int? | 소매가 |
| shippingFee | Int? | 배송비 (Order가 아닌 Product에서 관리) |
| bundleShippingType | BundleShippingType | 합배송 유형 |
| bundleMaxQty | Int? | 합배송 최대 수량 |

**Relations:**
- `variants` - 옵션 조합별 가격 (각 variant에 도매가 포함)
- `options` - 옵션 그룹/값
- `images` - 상품 이미지
- `shopProducts` - 쇼핑몰 발행 이력
- `channelProducts` - 채널 발행 이력

### ProductVariant (상품 옵션 조합)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| productId | Int | 상품 FK |
| optionSummary | String? | 옵션 조합 요약 (예: "빨강/XL") |
| price | Int | 소매가 |
| wholesalePrice | Decimal? | 도매가 (정산 시 사용) |
| bundleUnit | Int | 합배송 단위 수 (기본 1) |

> **참고:** 정산(settlement) 및 발행(publish) 시 도매가는 ProductVariant.wholesalePrice에서 조회합니다.

### Order (주문)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| userId | Int | 주문자 FK |
| orderNumber | String | 주문번호 (ORD-YYYYMMDD-XXXX) |
| status | CustomerOrderStatus | 주문 상태 |
| subtotalAmount | Decimal | 상품 금액 |
| discountAmount | Decimal | 할인 금액 |
| totalAmount | Decimal | 총 결제 금액 |
| shopId | Int? | 쇼핑몰 FK |

> **참고:** 배송비는 주문 시점에 Order에 저장하지 않고, Product.shippingFee에서 조회합니다.

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
| priceTier | PriceTier? | 다단계 발행: 발행 시점 가격 tier 스냅샷 |
| publishBatchId | String? | 다단계 발행: 동일 소스 fan-out 묶음 ID (saga 추적) |
| priceSnapshot | Json? | 다단계 발행: 발행 본문에 노출된 옵션별 단가 스냅샷 (정책 사후 변경에도 근거 보존) |

**Relations:**
- `product` - 원본 상품 (onDelete: SetNull)
- `channel` - 발행된 채널 (onDelete: Cascade)
- `user` - 소유자 (onDelete: Cascade)

**Unique Index:** `(productId, channelId)` - 같은 상품은 같은 채널에 한 번만 발행
**Index:** `(publishBatchId)` - fan-out 묶음 조회

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

**TR-ID**: [TR-20260108-002](./tracking/CHANGELOG.md#tr-20260108-002-published_product--shop_productchannel_product-스키마-마이그레이션)

#### 변경 영향도 요약

| 구분 | 내용 |
|-----|-----|
| **생성된 테이블** | `shop_product`, `channel_product`, `workflow_step_log` |
| **삭제된 테이블** | `published_product` |
| **추가된 컬럼** | `workflow_log.current_step` |
| **삭제된 컬럼** | `automation_config.pricing_policy_id`, `cart_item.published_product_id`, `order_item.published_product_id`, `guest_order_item.published_product_id`, `inquiry.published_product_id` |
| **변경된 FK** | CartItem, OrderItem, GuestOrderItem, Inquiry → `shop_product_id` 참조로 변경 |
| **추가된 Enum** | `StepType` (COLLECTION, TRANSFORM, PRODUCT_CREATE, PUBLISH), `StepStatus` (PENDING, RUNNING, COMPLETED, FAILED, SKIPPED) |
| **API 영향** | 없음 (내부 스키마 변경, API 계약 유지) |
| **Risk Level** | Medium |

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
```

---

### 2026-01-09: Product 관련 모델 인덱스명 명시

**TR-ID**: TR-20260109-001

#### 변경 내용

Prisma 스키마의 인덱스 이름을 명시적으로 지정하여 DB 인덱스명과 동기화 문제 방지

| 모델 | 인덱스 | 명시된 이름 |
|------|--------|------------|
| Product | `[userId]` | `product_user_id_idx` |
| Product | `[channelId]` | `product_channel_id_idx` |
| Product | `[categoryId]` | `product_category_id_idx` |
| Product | `[createdAt]` | `product_created_at_idx` |
| Product | `[deletedAt]` | `product_deleted_at_idx` |
| ProductVariant | `[productId]` | `product_variant_product_id_idx` |
| ProductVariant | `[deletedAt]` | `product_variant_deleted_at_idx` |
| ProductOption | `[productId]` | `product_option_product_id_idx` |
| ProductOption | `[groupName]` | `product_option_group_name_idx` |
| ProductImage | `[productId]` | `product_image_product_id_idx` |
| ProductImage | `[fileHash]` | `product_image_file_hash_idx` |

#### 변경 이유

- Prisma 자동 생성 인덱스명과 실제 DB 인덱스명 불일치 방지
- 마이그레이션 시 스키마-DB 동기화 문제 해결
- 인덱스 관리 및 디버깅 용이성 향상

#### 변경 파일

- `db/prisma/models/product.prisma`

#### Risk Level

Low (스키마 메타데이터 변경, 기존 데이터 영향 없음)

---

### 2026-01-12: GoogleSheetConfig 모델 추가

**TR-ID**: TR-20260112-003

#### 변경 내용

구글 시트 연동 설정을 저장하는 `GoogleSheetConfig` 모델 추가

#### GoogleSheetConfig (구글 시트 설정)

| 필드 | 타입 | 설명 |
|-----|-----|-----|
| id | Int | PK |
| userId | Int | 사용자 FK (Unique) |
| serviceAccountJson | String | 서비스 계정 JSON (LongText) |
| spreadsheetId | String | 스프레드시트 ID |
| sheetName | String? | 시트 탭 이름 (선택) |
| isActive | Boolean | 활성 상태 (기본: true) |
| lastSyncedAt | DateTime? | 마지막 동기화 시각 |
| createdAt | DateTime | 생성일시 |
| updatedAt | DateTime | 수정일시 |

**Relations:**
- `user` - 소유자 (onDelete: Cascade)

**Unique:** `userId` - 사용자당 1개 설정만 가능

**인덱스:**
- `google_sheet_config_user_id_idx` - userId
- `google_sheet_config_is_active_idx` - isActive

#### 용도

- 도매 주문 발주서를 구글 시트로 동기화
- 서비스 계정 기반 인증으로 사용자 개입 없이 자동 동기화 지원

#### Risk Level

Low (신규 테이블 추가, 기존 스키마 영향 없음)


## 2026-05-15 변경사항

자세한 내역은 docs/tracking/CHANGELOG.md TR-20260515-001 ~ TR-20260515-013 참조.

### 신규 모델

#### `band_notice_config` (BandNoticeConfig)
인기상품 1일 N회 자동공지 설정. 사용자당 1행 (`@unique userId`).
- `scheduleTimes` JSON `["11:00","13:00","17:00"]` — 공지 시각 다건
- `topN` 1~10 (기본 5), `pinAsImportant` 중요공지 게시 여부
- `retailChannelIds` / `sourceChannelIds` / `categoryCodes` — JSON 필터
- `toneHint` — Gemini 프롬프트 보조 텍스트

#### `legacy_order` (LegacyOrder)
5년치 좋은친구도매방 주문장 (xlsx 6파일). ETL 스크립트로 적재.
- `@@unique([orderDate, rowIndex, channelName])` — 멱등 ETL 보장
- `buyerHash` SHA-256 — PII 보호
- `productName` length(100) 인덱스 — popularity LIKE 매칭용

### 부작용 (운영 적용 시)

운영 DB push (2026-05-15) 시 다음 부작용 발생:
- `pricing_policy.tier_rules` 컬럼 드롭 — HEAD schema 에 없어서. 데이터 1행 손실
- 사전 변경(워킹트리 +2줄) 정리 시 함께 부활 필요

## 2026-06-10 변경사항 (밴드 로그인 계정 + 에이전트 테넌트 식별)

- `User.bandLoginEmail String?` — 이 사용자의 발행/삭제 작업에 사용할 밴드 로그인 네이버 ID. 세션 저장(save-all) 시 확장이 보낸 계정과 일치해야 저장 허용. null=검증 생략(하위호환).
- `Channel.sessionAccountEmail String?` — 현재 bandSessionCookie 가 어느 밴드 계정의 세션인지 기록. 세션 상태 API 가 이 값별로 그룹핑해 계정당 1회씩 실제 검증.
- `AgentTask.userId Int?` / `AgentLog.userId Int?` — SaaS 테넌트 식별 (P0-2). 이벤트 data.userId / 로그 metadata.userId 가 있으면 기록. null=전역/시스템. `@@index([userId, createdAt])` 추가.
- 로컬 db push 적용 완료. **운영 DB 반영 필요** (nullable 컬럼+인덱스 추가만 — 비파괴적).
