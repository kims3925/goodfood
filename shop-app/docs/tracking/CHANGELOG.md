# 변경 추적

> **관련 문서:** [REQUIREMENTS.md](./REQUIREMENTS.md) | [FLOW.md](./FLOW.md) | [../../CLAUDE.md](../../CLAUDE.md)

---

## TR-ID 규칙

```text
TR-{YYYYMMDD}-{NUMBER}
```

| 구성 | 설명 | 예시 |
|-----|-----|-----|
| YYYYMMDD | 작업 시작일 | 20240115 |
| NUMBER | 당일 순번 | 001, 002 |

---

## 변경 인덱스

| TR-ID | Status | Date | REQ-ID | Title | Risk | Author |
|-------|--------|------|--------|-------|------|--------|
| TR-20260205-001 | Done | 2026-02-05 | - | 접속자 중복 카운트 개선 (Band 앱 → 브라우저 전환 시) | Low | Claude |
| TR-20260122-001 | Done | 2026-01-22 | - | Redis 기반 실시간 접속자 모니터링 추가 | Low | Claude |
| TR-20260120-003 | Done | 2026-01-20 | - | 무통장입금 주문 웹훅 알림 추가 | Low | Claude |
| TR-20260120-002 | Done | 2026-01-20 | - | 개발 서버 Turbopack → Webpack 전환 | Low | Claude |
| TR-20260120-001 | Done | 2026-01-20 | - | 주문 외부 알림 (슬랙/디스코드 웹훅) 기능 추가 | Low | Claude |
| TR-20260108-005 | Done | 2026-01-08 | REQ-ORDER-001 | 비회원 주문 조회 플로우 개선 | Low | Claude |
| TR-20260108-004 | Done | 2026-01-08 | - | published_product → shop_product/channel_product 스키마 마이그레이션 | Medium | Claude |
| TR-20260108-003 | Done | 2026-01-08 | - | 역할명 변경 (회원/매니저) | Low | Claude |
| TR-20260108-002 | Done | 2026-01-08 | REQ-SHOP-002 | 인기상품 페이지 신규 개발 | Medium | Lee |
| TR-20260108-001 | Done | 2026-01-08 | REQ-SHOP-001 | 모바일 메인페이지 상품 그리드 3열 변경 | Low | Lee |
| TR-20260107-001 | Done | 2026-01-07 | REQ-SETTLEMENT-001 | Product 기반 배송비로 마진 계산 개선 | Medium | Hong |
| TR-20260106-002 | Done | 2026-01-06 | - | 찜하기 페이지 가격 계산 공통 모듈 적용 | Low | Lee |
| TR-20260106-001 | Done | 2026-01-06 | REQ-SHOP-001 | 모바일 반응형 UI 개선 | Low | Lee |

### Status

| Status | 설명 |
|--------|-----|
| Draft | 작성 중 |
| In Progress | 구현 중 |
| Done | 완료 |
| Released | 배포됨 |
| Reverted | 롤백됨 |

### Risk Level

| Level | 설명 | 승인 |
|-------|-----|-----|
| Critical | 서비스 중단 가능 | Tech Lead + PM |
| High | 핵심 비즈니스 영향 | Tech Lead |
| Medium | 일부 기능 영향 | Peer Review |
| Low | 영향 최소 | Self Review |

---

## 영향도 체크 트리거

| 변경 파일 패턴 | 체크 대상 | 문서 업데이트 |
|--------------|---------|-------------|
| `*.dto.ts`, `*.types.ts` | API Contract | API.md |
| `schema.prisma`, `migrations/*` | Database | DATABASE.md |
| `*.service.ts`, `domain/*` | Domain Logic | FLOW.md |
| `auth/*`, `guard/*` | Security | SECURITY.md |

---

## 변경 상세 템플릿

```markdown
## TR-{YYYYMMDD}-{NUMBER}: {Title}

| 항목 | 값 |
|-----|---|
| Status | |
| Author | |
| Date | |
| REQ-ID | |
| Risk | |

### 변경 사항
-

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| | Added/Modified/Deleted | |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Unit | Pass/Fail |
| Integration | Pass/Fail |

### 롤백 계획
1.
2.

### 관련 항목
- REQ-ID:
- Flow-ID:
```

---

## 변경 상세

<!-- 최신 항목이 위로 -->

## TR-20260122-001: Redis 기반 실시간 접속자 모니터링 추가

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-22 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 실시간 접속자 추적 기능 추가 (Redis Sorted Set 기반)
- `/api/presence` API 엔드포인트 추가 (GET: 접속자 수 조회, POST: heartbeat 등록)
- `usePresence` 커스텀 훅 추가 (30초마다 heartbeat 전송)
- Shop 대시보드에서 실시간 접속자 수 확인 가능
- 2분간 활동 없으면 자동 만료

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/api/presence/route.ts | Added | 접속자 API 엔드포인트 |
| src/hooks/usePresence.ts | Added | 접속자 heartbeat 커스텀 훅 |
| src/lib/redis.ts | Added/Modified | Redis 클라이언트 설정 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Unit | N/A |
| Manual | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. Redis 키 정리: `DEL shop:presence:*`

### 관련 항목
- REQ-ID: -
- Flow-ID: -

---

## TR-20260120-002: 개발 서버 Turbopack → Webpack 전환

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-20 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 개발 서버 번들러를 Turbopack에서 Webpack으로 전환
- Prisma 관련 Turbopack 정적 분석 경고 제거
- 프로덕션 빌드는 기존과 동일 (항상 Webpack 사용)

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| package.json | Modified | dev 스크립트에서 --turbo 플래그 제거 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Build | Pass |

### 롤백 계획
1. package.json의 dev 스크립트에 --turbo 플래그 복원

### 관련 항목
- REQ-ID: -
- Flow-ID: -

---

## TR-20260120-001: 주문 외부 알림 (슬랙/디스코드 웹훅) 기능 추가

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-20 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 주문 생성 및 결제 완료 시 슬랙 또는 디스코드 웹훅으로 알림 전송
- `order-webhook.service.ts` 신규 생성 (슬랙 Block Kit / 디스코드 Embed 포맷 지원)
- `createOrderFromCart()`, `createOrderFromItems()` 메서드에 웹훅 호출 추가
- `handlePaymentCompleted()` 메서드에 결제 완료 웹훅 호출 추가
- 환경변수로 웹훅 타입(slack/discord) 및 URL 설정

### 환경변수 설정
```env
# 웹훅 설정 (둘 중 하나만 사용)
ORDER_WEBHOOK_TYPE=slack  # 또는 discord
ORDER_WEBHOOK_URL=https://hooks.slack.com/services/xxx
```

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/services/order-webhook.service.ts | Added | 주문 웹훅 서비스 (슬랙/디스코드) |
| src/modules/order/services/order.service.ts | Modified | 주문 생성 시 웹훅 호출 추가 |
| src/modules/payments/services/webhook-handler.service.ts | Modified | 결제 완료 시 웹훅 호출 추가 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Unit | N/A |
| Manual | Pending |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. 웹훅 호출 코드 제거

### 관련 항목
- REQ-ID: -
- Flow-ID: 주문 흐름
- 참조: sourcing-app TR-20260120-001

---

## TR-20260108-005: 비회원 주문 조회 플로우 개선

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-08 |
| REQ-ID | REQ-ORDER-001 |
| Risk | Low |

### 변경 사항
- 비회원 주문 조회 UX 개선: 주문번호 조회와 휴대폰 조회 페이지 분리
- `/order/lookup` 페이지: 주문번호만으로 조회 (휴대폰 입력 필드 제거)
- `/order/find-orders` 페이지: 휴대폰 + 이름으로 최근 90일 내 주문 목록 조회
- `/api/guest-orders/lookup` API: phone 파라미터 제거 (API 계약 변경)
- `/api/guest-orders/find-by-phone` API: 휴대폰 + 이름으로 주문 목록 반환
- 에러 응답에서 내부 정보 노출 방지 (error.message → 일반화된 메시지)
- 이벤트 핸들러에 useCallback 적용 (성능 최적화)

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(shop)/order/lookup/page.tsx | Modified | 휴대폰 입력 필드 제거, 주문번호만으로 조회 |
| src/app/(shop)/order/find-orders/page.tsx | Modified | useCallback 적용, formatPhone 외부로 이동 |
| src/app/api/guest-orders/lookup/route.ts | Modified | phone 파라미터 제거 (API 계약 변경) |
| src/app/api/guest-orders/find-by-phone/route.ts | Modified | 에러 응답 일반화 (보안 개선) |

### 영향 분석
- [x] API Contract 변경 (`/api/guest-orders/lookup` phone 파라미터 제거)
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경 (에러 메시지 일반화)

### API 계약 변경 상세

#### `/api/guest-orders/lookup` (POST)
| 항목 | 변경 전 | 변경 후 |
|-----|--------|--------|
| Request Body | `{ orderNumber, phone }` | `{ orderNumber }` |
| 인증 방식 | 주문번호 + 휴대폰 검증 | 주문번호만 검증 |

#### `/api/guest-orders/find-by-phone` (POST)
| 항목 | 값 |
|-----|---|
| Request Body | `{ phone, name }` |
| Response | `{ success, orders: OrderItem[], totalCount }` |
| 조회 범위 | 최근 90일, 최대 20건 |

### 테스트
| 유형 | 상태 |
|-----|-----|
| Unit | N/A |
| Manual | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. `/api/guest-orders/lookup`에 phone 파라미터 복원
3. `/order/lookup` 페이지에 휴대폰 입력 필드 복원

### 관련 항목
- REQ-ID: REQ-ORDER-001
- Flow-ID: 비회원 주문 조회

---

## TR-20260108-004: published_product → shop_product/channel_product 스키마 마이그레이션

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-08 |
| REQ-ID | - |
| Risk | Medium |

### 변경 사항
- 공유 DB 스키마 변경 (sourcing-app과 동일)
- `published_product` 테이블을 `shop_product`와 `channel_product`로 분리
  - `shop_product`: 쇼핑몰(Shop)에 발행된 상품 관리
  - `channel_product`: 채널(Band 등)에 발행된 상품 관리
- `workflow_step_log` 테이블 신규 생성
- `StepType`, `StepStatus` enum 추가
- `CartItem` 인덱스 변경: `publishedProductId` → `shopProductId`

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| db/prisma/models/publish.prisma | Modified | ShopProduct, ChannelProduct 모델로 변경 |
| db/prisma/migrations/20260108131455_remove_unused_columns/migration.sql | Added | CD 파이프라인용 마이그레이션 |

### 영향 분석
- [ ] API Contract 변경
- [x] DB Schema 변경
- [x] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Build | Pass |

### 롤백 계획
1. 마이그레이션 롤백 스크립트 실행
2. git revert로 해당 커밋 롤백

### 관련 항목
- REQ-ID: -
- Flow-ID: Publish
- 참조: sourcing-app TR-20260108-002

---

## TR-20260108-003: 역할명 변경 (회원/매니저)

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-08 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 사용자 역할 라벨 변경 (공유 DB)
  - USER: '일반 사용자' → '회원'
  - MANAGER: '쇼핑몰 관리자' → '매니저'
- 참조: sourcing-app에서 UI 변경

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| (sourcing-app 파일) | Modified | 역할 라벨 변경 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Build | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백

### 관련 항목
- REQ-ID: -
- Flow-ID: -
- 참조: sourcing-app TR-20260108-003

---

## TR-20260108-002: 인기상품 페이지 신규 개발

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-08 |
| REQ-ID | REQ-SHOP-002 |
| Risk | Medium |

### 변경 사항
- 인기상품 API 신규 개발 (/api/shop/popular)
  - OrderItem 테이블에서 shopProductId별 주문 수량 집계
  - 취소/환불 제외한 유효 주문만 카운트
  - 주문량 순 정렬 및 순위 부여
- 인기상품 페이지 신규 개발 (/popular)
  - TOP 10 인기상품 표시 (1~3위 메달 뱃지)
  - "이런 상품은 어때요?" 섹션에 일반상품 표시
  - 인기상품과 일반상품 중복 제거
- 모바일 하단 네비게이션에 인기 버튼 추가
  - 중앙 플로팅 버튼 스타일 (그라데이션, 글로우 애니메이션)
  - 트로피 아이콘 적용

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/api/shop/popular/route.ts | Added | 인기상품 API |
| src/app/(shop)/popular/page.tsx | Added | 인기상품 페이지 |
| src/app/(shop)/StoreLayout.tsx | Modified | 모바일 네비에 인기 버튼 추가 |
| src/app/globals.css | Modified | 플로팅 버튼 스타일 추가 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Unit | N/A |
| Manual | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. 추가된 파일 삭제

### 관련 항목
- REQ-ID: REQ-SHOP-002
- Flow-ID: -

---

## TR-20260108-001: 모바일 메인페이지 상품 그리드 3열 변경

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-08 |
| REQ-ID | REQ-SHOP-001 |
| Risk | Low |

### 변경 사항
- 모바일 화면에서 전체 상품 그리드를 2열에서 3열로 변경
- 스켈레톤 UI도 동일하게 3열 적용
- 3열 레이아웃에 맞게 간격(gap) 축소 (gap-3 → gap-2)
- 스켈레톤 개수 3의 배수로 조정 (10개 → 12개)

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(shop)/main/page.tsx | Modified | grid-cols-2 → grid-cols-3, gap 조정 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Unit | N/A (UI 변경) |
| Manual | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. grid-cols-3 → grid-cols-2 복원

### 관련 항목
- REQ-ID: REQ-SHOP-001
- Flow-ID: -

---

## TR-20260107-001: Product 기반 배송비로 마진 계산 개선

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Hong |
| Date | 2026-01-07 |
| REQ-ID | REQ-SETTLEMENT-001 |
| Risk | Medium |

### 변경 사항
- 정산/대시보드에서 마진 계산 시 Order.shippingFee 대신 Product.shippingFee 사용
- Product 배송비 + 합배송 로직 적용: `ceil(총 배송단위 / bundleMaxQty) × shippingFee`
- 상품별 배송비를 주문 아이템에 가격 비율로 분배하여 마진 계산
- 대시보드 KPI 카드에 평균 마진율, 총 마진액 추가
- OrderItem에 wholesalePrice 스냅샷 저장 (이력 관리)

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| sourcing-app/src/app/api/settlement/route.ts | Modified | Product 기반 배송비 계산, 합배송 로직 적용 |
| sourcing-app/src/app/api/dashboard/shop/route.ts | Modified | 동일한 마진 계산 로직 적용 |
| db/prisma/models/order.prisma | Modified | OrderItem.wholesalePrice 필드 추가 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경 (OrderItem.wholesalePrice 추가)
- [x] Domain Logic 변경 (마진 계산 로직)
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Unit | N/A |
| Manual | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. OrderItem.wholesalePrice 필드 제거 (optional이므로 무해)

### 관련 항목
- REQ-ID: REQ-SETTLEMENT-001
- Flow-ID: 정산 흐름

---

## TR-20260106-002: 찜하기 페이지 가격 계산 공통 모듈 적용

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 찜하기 API에서 가격 계산 시 공통 모듈(calculateSellingPrice) 사용하도록 수정
- 배송비(shippingFee), 합배송 타입(bundleShippingType) 정보를 조회하여 실제 판매가 계산
- 장바구니, 상품상세 페이지와 동일한 가격 로직 적용

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/api/mypage/wishlist/route.ts | Modified | calculateSellingPrice 적용, 배송비/합배송 타입 조회 추가 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [x] Domain Logic 변경 (가격 계산 로직 일관성 적용)
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Unit | N/A |
| Manual | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. 이전 wishlist/route.ts 복원

### 관련 항목
- REQ-ID: -
- Flow-ID: -

---

## TR-20260106-001: 모바일 반응형 UI 개선

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | REQ-SHOP-001 |
| Risk | Low |

### 변경 사항
- 모바일 상단 헤더: 쇼핑몰 이름(로고+텍스트)만 중앙에 표시
- 모바일 하단 고정 네비게이션 바 추가 (홈, 장바구니, 마이페이지, 고객센터)
- 모바일 헤더 아이콘(배송지, 찜하기, 장바구니) 숨김 처리
- 모바일 푸터 레이아웃 개선 (쇼핑몰명/고객센터 2열 배치)
- 검색창 반응형 크기 조정 (md: 500px, lg: 600px)
- 모바일 하단 네비 CSS 스타일 추가 (safe-area 대응)

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(shop)/StoreLayout.tsx | Modified | 모바일 헤더, 하단 네비, 푸터 레이아웃 변경 |
| src/app/globals.css | Modified | 모바일 하단 네비게이션 CSS 추가, 검색창 크기 조정 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Unit | N/A (UI 변경) |
| Manual | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. 이전 StoreLayout.tsx, globals.css 복원

### 관련 항목
- REQ-ID: REQ-SHOP-001
- Flow-ID: -
