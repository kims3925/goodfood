# 데이터/비즈니스 흐름

> **관련 문서:** [PROJECT.md](../PROJECT.md) | [DATABASE.md](../DATABASE.md) | [CLAUDE.md](../../CLAUDE.md)

---

## 핵심 비즈니스 흐름

### 전체 파이프라인

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        SOURCING FLOW                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. 수집 (Collect)                                                   │
│     도매밴드 → Band API → CollectedPost → CollectedPostImage        │
│                                                                      │
│  2. 변환 (Transform)                                                 │
│     CollectedPost → AI (Gemini/OpenAI) → CollectedProduct → Product │
│                                                                      │
│  3. 발행 (Publish)                                                   │
│     Product → Band API → PublishedProduct → 소매밴드/쇼핑몰         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SALES FLOW                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  4. 판매 (Sales)                                                     │
│     고객 → Cart → Checkout → Order → Toss Payments → Payment        │
│                                                                      │
│  5. 정산 (Settlement)                                                │
│     Order (DELIVERED) → Settlement → 정산 완료                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. 수집 (Collection) 흐름

### 트리거

| 트리거 | 설명 |
|-------|-----|
| 수동 | 사용자가 "수집" 버튼 클릭 |
| 자동 | AutomationConfig의 cron 스케줄 |

### 데이터 흐름

```text
도매밴드 (Band Open API)
        │
        ▼
┌─────────────────┐
│ CollectedPost   │ ── 게시물 원본 저장
├─────────────────┤
│ - externalId    │ ── 밴드 게시물 고유 ID
│ - title         │
│ - content       │
│ - author        │
│ - channelId     │ ── 도매채널 FK
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ CollectedPost   │
│ Image           │ ── 게시물 이미지
├─────────────────┤
│ - url           │
│ - fileHash      │ ── 중복 방지
│ - sortOrder     │
└─────────────────┘
```

### 중복 방지

- `(channelId, externalId)` Unique 제약
- 이미 수집된 게시물은 스킵

---

## 2. 변환 (Transformation) 흐름

### 트리거

| 트리거 | 설명 |
|-------|-----|
| 수동 | 수집 후 "변환" 버튼 클릭 |
| 자동 | 파이프라인 자동 실행 |

### AI 변환 프로세스

```text
CollectedPost (원본 게시물)
        │
        ▼
┌─────────────────┐
│ AI 프롬프트     │ ── AiPromptConfig에서 로드
│ (Gemini/OpenAI) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ CollectedProduct│ ── AI 추출 결과
├─────────────────┤
│ - name          │ ── 상품명
│ - price         │ ── 도매가 추출
│ - options       │ ── 옵션 정보 (JSON)
│ - shippingInfo  │ ── 배송 정보
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Product         │ ── 최종 상품
├─────────────────┤
│ - wholesalePrice│ ── 도매가
│ - price         │ ── 소매가 (정책 적용)
│ - shippingFee   │ ── 배송비
└─────────────────┘
```

### 가격 계산 (PricingPolicy)

```text
소매가 = 도매가 × 마진율 + 기본마진
배송비 = 정책에 따른 배송비 계산
```

---

## 3. 발행 (Publishing) 흐름

### 트리거

| 트리거 | 설명 |
|-------|-----|
| 수동 | 상품 선택 후 "발행" 버튼 |
| 자동 | 파이프라인 자동 발행 |

### 데이터 흐름

```text
Product (변환된 상품)
        │
        ▼
┌─────────────────┐
│ 발행 대상 선택   │
├─────────────────┤
│ - 소매채널(Band)│ ── Channel (kind: RETAIL)
│ - 쇼핑몰(Shop)  │ ── Shop
└────────┬────────┘
         │
         ├──────────────────────┐
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│ Band API 발행   │    │ Shop 발행       │
│ (게시물 작성)    │    │ (PublishedProduct)│
└────────┬────────┘    └────────┬────────┘
         │                      │
         └──────────┬───────────┘
                    ▼
           ┌─────────────────┐
           │ PublishedProduct│
           ├─────────────────┤
           │ - productId     │
           │ - channelId     │
           │ - shopId        │
           │ - postKey       │ ── Band 게시물 키 (취소용)
           │ - publishedAt   │
           └─────────────────┘
```

---

## 4. 주문 (Order) 흐름

### 상태 전이

```text
PENDING ──(결제완료)─→ PAID ──(상품준비)─→ PREPARING
    │                    │                     │
    │                    │                     ▼
    └─(주문취소)─────────┴─(배송시작)────→ SHIPPED
                                              │
                                              ▼
                         REFUNDED ←─────── DELIVERED
                             ↑                 │
                             └──(반품/환불)────┘
```

### 주문 생성 흐름

```text
Cart (장바구니)
        │
        ▼
┌─────────────────┐
│ Checkout        │ ── 주문 정보 입력
├─────────────────┤
│ - 배송지        │ → ShippingAddress
│ - 쿠폰 적용     │ → discountAmount
│ - 결제 수단     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐
│ Order           │───→│ OrderItem       │
├─────────────────┤    ├─────────────────┤
│ - orderNumber   │    │ - quantity      │
│ - totalAmount   │    │ - unitPrice     │
│ - status:PENDING│    │ - variantId     │
└────────┬────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Toss Payments   │ ── 결제 요청
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Payment         │
├─────────────────┤
│ - paymentKey    │
│ - status: DONE  │
└─────────────────┘
         │
         ▼
    Order.status: PAID
```

---

## 5. 결제 (Payment) 흐름

### Toss Payments 연동

```text
1. 결제 요청 (클라이언트)
   → tossPayments.requestPayment()

2. 결제 성공 콜백
   → /payment/success?paymentKey=xxx&orderId=xxx&amount=xxx

3. 결제 승인 (서버)
   → POST https://api.tosspayments.com/v1/payments/confirm

4. 결제 완료
   → Order.status = PAID
   → Payment.status = DONE
```

### 결제 상태

| 상태 | 설명 |
|-----|-----|
| READY | 결제 준비 |
| IN_PROGRESS | 결제 진행 중 |
| WAITING_FOR_DEPOSIT | 가상계좌 입금 대기 |
| DONE | 결제 완료 |
| CANCELED | 결제 취소 |
| EXPIRED | 결제 만료 |

---

## 6. 자동화 (Automation) 흐름

### 파이프라인 구성

```text
AutomationConfig
        │
        ├── channelIds (도매채널 목록)
        ├── retailChannelIds (소매채널 목록)
        ├── shopIds (쇼핑몰 목록)
        ├── pipelineSteps (실행 단계)
        │     └── ["COLLECT", "TRANSFORM", "PUBLISH"]
        └── cronExpression (스케줄)
```

### 실행 로그

```text
WorkflowLog
├── workflowType: FULL_PIPELINE
├── triggerType: SCHEDULED | MANUAL
├── status: PENDING → RUNNING → COMPLETED | FAILED
├── totalItems: 100
├── successCount: 95
├── failedCount: 5
└── details: JSON (상세 결과)
```

---

## 외부 시스템 통합

| 시스템 | 용도 | Protocol | Auth |
|--------|------|----------|------|
| Band Open API | 게시물 조회/작성 | REST | OAuth2 + Session Cookie |
| Toss Payments | 결제 처리 | REST | Secret Key |
| Gemini AI | 상품 변환 | REST | API Key |
| OpenAI | 상품 변환 (대체) | REST | API Key |

---

## 상태 전이 규칙

### Order Status

| Current | Event | Next | Guard | Action |
|---------|-------|------|-------|--------|
| PENDING | 결제 완료 | PAID | Payment.status=DONE | 재고 차감 |
| PAID | 상품 준비 | PREPARING | - | 알림 발송 |
| PREPARING | 배송 시작 | SHIPPED | 송장번호 입력 | 알림 발송 |
| SHIPPED | 배송 완료 | DELIVERED | - | 리뷰 요청 |
| * | 취소 요청 | CANCELLED | 취소 가능 상태 | 환불 처리 |

### Workflow Status

| Current | Event | Next | Guard | Action |
|---------|-------|------|-------|--------|
| PENDING | 실행 시작 | RUNNING | - | 로그 시작 |
| RUNNING | 완료 | COMPLETED | 모든 항목 성공 | 로그 완료 |
| RUNNING | 부분 실패 | PARTIAL_SUCCESS | 일부 항목 실패 | 로그 완료 |
| RUNNING | 전체 실패 | FAILED | 전체 실패 | 에러 기록 |

---

## 알림 흐름

### 알림 유형

| 유형 | 트리거 | 대상 |
|-----|-------|-----|
| ORDER | 새 주문 접수 | 판매자 |
| CANCEL | 주문 취소 | 판매자 |
| COLLECT | 수집 완료 | 사용자 |
| TRANSFORM | 변환 완료 | 사용자 |
| PUBLISH | 발행 완료 | 사용자 |
| ERROR | 오류 발생 | 사용자 |

### 알림 저장

```text
Notification
├── userId
├── shopId (shop 알림인 경우)
├── type: NotificationType
├── title
├── message
├── isRead: false
├── createdAt
└── metadata: JSON (추가 정보)
```
