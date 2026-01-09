# Database Schema Documentation

이 문서는 Bandauto 프로젝트의 데이터베이스 스키마 변경사항과 테이블 구조를 설명합니다.

## 목차

- [스키마 변경 이력](#스키마-변경-이력)
- [테이블 구조](#테이블-구조)
  - [shop_product](#shop_product)
  - [channel_product](#channel_product)
  - [workflow_step_log](#workflow_step_log)
- [Soft Delete 패턴](#soft-delete-패턴)

---

## 스키마 변경 이력

### 2026-01-08: published_product 테이블 분리 마이그레이션

**TR-ID**: TR-20260108-002

**마이그레이션 파일**: `20260108131455_remove_unused_columns`

#### 주요 변경사항

| 변경 유형 | 대상 | 설명 |
|-----------|------|------|
| 테이블 생성 | `shop_product` | 쇼핑몰 발행 상품 관리 (published_product에서 분리) |
| 테이블 생성 | `channel_product` | 채널별 상품 발행 관리 (published_product에서 분리) |
| 테이블 생성 | `workflow_step_log` | 자동화 파이프라인 단계별 진행 추적 |
| 컬럼 추가 | `workflow_log.current_step` | 현재 진행 중인 워크플로우 단계 표시 |
| 테이블 삭제 | `published_product` | shop_product/channel_product로 데이터 마이그레이션 후 삭제 |

#### 영향받는 FK 변경

다음 테이블들의 `published_product_id` 컬럼과 관련 FK가 삭제되었습니다:

| 테이블 | 삭제된 FK | 삭제된 컬럼 |
|--------|-----------|-------------|
| `cart_item` | `cart_item_published_product_id_fkey` | `published_product_id` |
| `order_item` | `order_item_published_product_id_fkey` | `published_product_id` |
| `guest_order_item` | `guest_order_item_published_product_id_fkey` | `published_product_id` |
| `inquiry` | `inquiry_published_product_id_fkey` | `published_product_id` |

---

## 테이블 구조

### shop_product

쇼핑몰에 발행된 상품을 관리하는 테이블입니다. 기존 `published_product` 테이블에서 쇼핑몰 관련 데이터가 분리되었습니다.

#### 역할

- 사용자의 상품을 특정 쇼핑몰(shop)에 발행한 기록 관리
- 발행 일시, 삭제 상태 등 상품 발행 메타데이터 저장
- `product`와 `shop` 간의 다대다 관계 중간 테이블

#### 컬럼 구조

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INT (PK, AUTO_INCREMENT) | 고유 식별자 |
| `user_id` | INT (FK, NOT NULL) | 소유 사용자 ID |
| `product_id` | INT (FK, NULL) | 연결된 상품 ID |
| `shop_id` | INT (FK, NOT NULL) | 발행된 쇼핑몰 ID |
| `published_at` | TIMESTAMP | 발행 일시 |
| `deleted_at` | TIMESTAMP | Soft Delete 일시 |
| `created_at` | TIMESTAMP | 생성 일시 |
| `updated_at` | TIMESTAMP | 수정 일시 |

#### 인덱스

| 인덱스명 | 컬럼 | 용도 |
|----------|------|------|
| `idx_user_id` | `user_id` | 사용자별 발행 상품 조회 |
| `idx_product_id` | `product_id` | 상품별 발행 현황 조회 |
| `idx_shop_id` | `shop_id` | 쇼핑몰별 상품 조회 |
| `idx_deleted_at` | `deleted_at` | Soft Delete 필터링 |
| `uk_product_shop` (UNIQUE) | `product_id`, `shop_id` | 동일 상품 중복 발행 방지 |

#### FK 제약조건

| 제약조건명 | 참조 테이블 | ON DELETE | ON UPDATE |
|------------|-------------|-----------|-----------|
| `fk_shop_product_product_id` | `product` | SET NULL | CASCADE |
| `fk_shop_product_shop_id` | `shop` | RESTRICT | CASCADE |
| `fk_shop_product_user_id` | `user` | RESTRICT | CASCADE |

> **참고**: `shop_id` FK가 `RESTRICT`인 이유는 Shop 테이블이 Soft Delete 패턴을 사용하기 때문입니다. Shop을 삭제하려면 먼저 연결된 shop_product를 처리해야 합니다.

---

### channel_product

채널(네이버, 쿠팡 등)에 발행된 상품을 관리하는 테이블입니다.

#### 역할

- 외부 판매 채널에 상품 발행 기록 관리
- `post_key`를 통해 외부 채널의 상품 ID 연동
- 채널별 활성화 상태(`is_active`) 관리

#### 컬럼 구조

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INT (PK, AUTO_INCREMENT) | 고유 식별자 |
| `user_id` | INT (FK, NOT NULL) | 소유 사용자 ID |
| `product_id` | INT (FK, NULL) | 연결된 상품 ID |
| `channel_id` | INT (FK, NOT NULL) | 발행된 채널 ID |
| `post_key` | VARCHAR(255) | 외부 채널의 상품 식별자 |
| `is_active` | BOOLEAN | 채널 내 활성화 상태 (기본값: TRUE) |
| `published_at` | TIMESTAMP | 발행 일시 |
| `deleted_at` | TIMESTAMP | Soft Delete 일시 |
| `created_at` | TIMESTAMP | 생성 일시 |
| `updated_at` | TIMESTAMP | 수정 일시 |
| `legacy_published_product_id` | INT | 롤백용 원본 published_product ID |

#### 인덱스

| 인덱스명 | 컬럼 | 용도 |
|----------|------|------|
| `idx_user_id` | `user_id` | 사용자별 채널 상품 조회 |
| `idx_product_id` | `product_id` | 상품별 채널 발행 현황 조회 |
| `idx_channel_id` | `channel_id` | 채널별 상품 조회 |
| `idx_deleted_at` | `deleted_at` | Soft Delete 필터링 |
| `idx_legacy_id` | `legacy_published_product_id` | 롤백 시 원본 ID 매핑 |
| `uk_product_channel` (UNIQUE) | `product_id`, `channel_id` | 동일 상품 중복 발행 방지 |

#### FK 제약조건

| 제약조건명 | 참조 테이블 | ON DELETE | ON UPDATE |
|------------|-------------|-----------|-----------|
| `fk_channel_product_product_id` | `product` | SET NULL | CASCADE |
| `fk_channel_product_channel_id` | `channel` | CASCADE | CASCADE |
| `fk_channel_product_user_id` | `user` | RESTRICT | CASCADE |

> **참고**: `user_id` FK가 `RESTRICT`인 이유는 User 테이블이 Soft Delete 패턴을 사용하기 때문입니다. 사용자 삭제 전 연결된 channel_product를 먼저 처리해야 합니다.

---

### workflow_step_log

자동화 파이프라인의 각 단계별 실행 상태를 추적하는 테이블입니다.

#### 역할

- 워크플로우 실행 시 각 단계(수집, 변환, 상품생성, 발행)의 진행 상황 기록
- 단계별 처리 건수, 성공/실패 카운트 추적
- 에러 발생 시 상세 메시지 저장

#### 컬럼 구조

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INT (PK, AUTO_INCREMENT) | 고유 식별자 |
| `workflow_id` | INT (FK, NOT NULL) | 부모 워크플로우 로그 ID |
| `step_type` | ENUM | 단계 유형 |
| `step_order` | INT | 단계 실행 순서 |
| `status` | ENUM | 단계 상태 |
| `started_at` | TIMESTAMP | 단계 시작 시간 |
| `completed_at` | TIMESTAMP | 단계 완료 시간 |
| `total_items` | INT | 처리 대상 총 건수 (기본값: 0) |
| `processed_items` | INT | 처리 완료 건수 (기본값: 0) |
| `success_count` | INT | 성공 건수 (기본값: 0) |
| `failed_count` | INT | 실패 건수 (기본값: 0) |
| `details` | LONGTEXT | 상세 처리 결과 (JSON) |
| `error_message` | TEXT | 에러 메시지 |
| `deleted_at` | TIMESTAMP | Soft Delete 일시 |

#### ENUM 타입 설명

**step_type** (단계 유형):

| 값 | 설명 |
|----|------|
| `COLLECTION` | 소싱 데이터 수집 단계 |
| `TRANSFORM` | 데이터 변환/가공 단계 |
| `PRODUCT_CREATE` | 상품 생성 단계 |
| `PUBLISH` | 채널/쇼핑몰 발행 단계 |

**status** (단계 상태):

| 값 | 설명 |
|----|------|
| `PENDING` | 대기 중 |
| `RUNNING` | 실행 중 |
| `COMPLETED` | 완료 |
| `FAILED` | 실패 |
| `SKIPPED` | 건너뜀 |

#### 인덱스

| 인덱스명 | 컬럼 | 용도 |
|----------|------|------|
| `idx_workflow_id` | `workflow_id` | 워크플로우별 단계 조회 |
| `idx_status` | `status` | 상태별 필터링 |
| `idx_deleted_at` | `deleted_at` | Soft Delete 필터링 |
| `uk_workflow_step` (UNIQUE) | `workflow_id`, `step_type` | 워크플로우당 단계 유형 중복 방지 |

#### FK 제약조건

| 제약조건명 | 참조 테이블 | ON DELETE | ON UPDATE |
|------------|-------------|-----------|-----------|
| `workflow_step_log_workflow_id_fkey` | `workflow_log` | CASCADE | CASCADE |

---

### workflow_log.current_step 컬럼

#### 용도

현재 실행 중인 워크플로우 단계를 표시합니다. 이를 통해:

- 워크플로우 진행 상황을 빠르게 파악
- UI에서 현재 단계 하이라이트 표시
- 실패 시 재시작 지점 결정

#### 타입

```sql
ENUM('COLLECTION', 'TRANSFORM', 'PRODUCT_CREATE', 'PUBLISH') NULL
```

NULL 값은 워크플로우가 아직 시작되지 않았거나 완료되었음을 의미합니다.

---

## Soft Delete 패턴

Bandauto 프로젝트는 데이터 무결성과 감사 추적을 위해 Soft Delete 패턴을 사용합니다.

### 구현 방식

모든 주요 테이블에 `deleted_at` 컬럼이 포함되어 있습니다:

```sql
deleted_at TIMESTAMP NULL
```

- **NULL**: 활성 레코드
- **값 존재**: 삭제된 레코드 (삭제 시점 기록)

### Soft Delete 적용 테이블

Soft Delete 패턴이 적용된 테이블 목록:

- `shop_product` - 쇼핑몰 발행 상품
- `channel_product` - 채널 발행 상품
- `channel` - 채널 (도매/소매)
- `collected_post` - 수집된 게시물
- `collected_product` - 수집된 상품
- `workflow_step_log` - 워크플로우 단계 로그
- `user` - 사용자
- `shop` - 쇼핑몰

### 조회 시 주의사항

쿼리 작성 시 삭제된 레코드를 제외하려면 항상 `deleted_at IS NULL` 조건을 추가해야 합니다:

```sql
SELECT * FROM shop_product WHERE deleted_at IS NULL;
```

#### Prisma 조회 예시

```typescript
// ✅ Good: deletedAt 필터 포함
const shopProducts = await prisma.shopProduct.findMany({
  where: {
    userId,
    deletedAt: null, // Soft Delete 필터링
  },
})

// ❌ Bad: deletedAt 필터 누락 (삭제된 레코드도 조회됨)
const shopProducts = await prisma.shopProduct.findMany({
  where: { userId },
})
```

### 삭제 핸들러 구현 주의사항

Soft Delete를 사용하는 테이블은 `delete()` 대신 `update()`를 사용해야 합니다:

```typescript
// ✅ Good: Soft Delete 사용
await prisma.shop.update({
  where: { id },
  data: { deletedAt: new Date() },
})

// ❌ Bad: Hard Delete 사용 (FK Restrict 제약조건으로 에러 발생 가능)
await prisma.shop.delete({
  where: { id },
})
```

### FK 제약조건과 Soft Delete

| FK onDelete 설정 | 삭제 방식 | 설명 |
|------------------|----------|------|
| `CASCADE` | Hard Delete 가능 | 자식 레코드도 함께 삭제됨 |
| `SET NULL` | Hard Delete 가능 | 자식의 FK가 NULL로 설정됨 |
| `RESTRICT` | **Soft Delete 필수** | 자식 레코드 있으면 삭제 불가 |

> **중요**: `onDelete: Restrict`가 설정된 관계에서는 반드시 Soft Delete를 사용해야 합니다. 그렇지 않으면 FK 제약조건 위반 에러가 발생합니다.

Prisma에서는 미들웨어나 쿼리 확장을 통해 자동 필터링을 구현할 수 있습니다.
