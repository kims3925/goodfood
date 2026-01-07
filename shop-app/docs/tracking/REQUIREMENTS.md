# 요구사항 추적

> **관련 문서:** [CHANGELOG.md](./CHANGELOG.md) | [FLOW.md](./FLOW.md) | [../../CLAUDE.md](../../CLAUDE.md)

---

## REQ-ID 규칙

```text
REQ-{CATEGORY}-{NUMBER}
```

| 구성 | 설명 | 예시 |
|-----|-----|-----|
| CATEGORY | 기능 카테고리 | SOURCING, ORDER, SHOP |
| NUMBER | 순번 (001~) | 001, 042 |

---

## 카테고리

| Category | 설명 | 주요 기능 |
|----------|-----|---------|
| AUTH | 인증/인가 | 로그인, 회원가입, 권한 |
| USER | 사용자 관리 | 프로필, 설정 |
| CHANNEL | 채널 관리 | 도매채널, 소매채널, Band 연동 |
| SOURCING | 소싱 | 게시물 수집, AI 변환 |
| PRODUCT | 상품 관리 | 상품 CRUD, 옵션, 이미지 |
| PUBLISH | 발행 | 소매채널 발행, 쇼핑몰 발행 |
| AUTOMATION | 자동화 | 파이프라인, 스케줄링 |
| SHOP | 쇼핑몰 | 스토어 설정, 테마 |
| ORDER | 주문 | 주문 관리, 배송 |
| PAYMENT | 결제 | Toss 결제, 환불 |
| CART | 장바구니 | 장바구니, 체크아웃 |
| CS | 고객 서비스 | 문의, 반품, 리뷰 |
| SETTLEMENT | 정산 | 판매 정산 |
| COUPON | 쿠폰 | 쿠폰 발행, 사용 |

---

## 요구사항 인덱스

| REQ-ID | Status | Priority | Title | Owner | TR-ID |
|--------|--------|----------|-------|-------|-------|
| REQ-SETTLEMENT-001 | Done | P1 | Product 기반 배송비로 마진 계산 개선 | Hong | TR-20260107-001 |
| REQ-SHOP-001 | Done | P2 | 모바일 반응형 UI 개선 | Lee | TR-20260106-001 |

### Status

| Status | 설명 |
|--------|-----|
| Draft | 초안 |
| Review | 리뷰 중 |
| Approved | 승인됨 |
| In Progress | 구현 중 |
| Done | 완료 |
| On Hold | 보류 |

### Priority

| Priority | 설명 | SLA |
|----------|-----|-----|
| P0 | Critical | 24시간 |
| P1 | High | 1주일 |
| P2 | Medium | 2주일 |
| P3 | Low | 다음 스프린트 |

---

## 요구사항 상세 템플릿

```markdown
## REQ-{CATEGORY}-{NUMBER}: {Title}

| 항목 | 값 |
|-----|---|
| Status | |
| Priority | |
| Owner | |
| Created | |

### 배경
-

### 요구사항
-

### 완료 조건
- [ ]
- [ ]

### 관련 항목
- TR-ID:
- Flow-ID:
```

---

## 요구사항 상세

<!-- 최신 항목이 위로 -->

## REQ-SETTLEMENT-001: Product 기반 배송비로 마진 계산 개선

| 항목 | 값 |
|-----|---|
| Status | Done |
| Priority | P1 |
| Owner | Hong |
| Created | 2026-01-07 |

### 배경
- 주문 시 고객에게 무료배송을 제공하더라도 판매자는 실제 배송비를 부담함
- 기존 마진 계산은 Order.shippingFee(고객 결제 배송비, 무료배송 시 0원)만 사용
- 실제 마진 = (판매가 - 도매가) - 실제배송비 로 계산해야 정확함
- Product 테이블에 배송비/합배송 정보가 이미 존재 (shippingFee, bundleMaxQty, bundleShippingType)

### 요구사항
- 정산/대시보드에서 Product.shippingFee 기반으로 마진 계산
- 합배송 로직 적용: `ceil(총 배송단위 / bundleMaxQty) × shippingFee`
- 대시보드에 평균 마진율, 총 마진액 KPI 카드 추가
- 정산 목록에 분배된 배송비 정보 추가

### 완료 조건
- [x] 정산 API에서 Product 배송비 정보 조회
- [x] 합배송 로직을 적용한 배송비 계산 함수 구현
- [x] 마진 계산에 Product 배송비 반영 (정산, 대시보드)
- [x] 대시보드 KPI 카드 추가 (평균 마진율, 총 마진액)
- [x] OrderItem에 wholesalePrice 스냅샷 저장

### 관련 항목
- TR-ID: TR-20260107-001
- Flow-ID: 정산 흐름

---

## REQ-SHOP-001: 모바일 반응형 UI 개선

| 항목 | 값 |
|-----|---|
| Status | Done |
| Priority | P2 |
| Owner | Lee |
| Created | 2026-01-06 |

### 배경
- 모바일 환경에서 헤더가 데스크탑과 동일하게 표시되어 사용성 저하
- 모바일에서 주요 기능(홈, 장바구니, 마이페이지, 고객센터) 접근성 개선 필요
- 푸터가 세로로 너무 길게 늘어지는 문제

### 요구사항
- 모바일 헤더: 쇼핑몰 이름만 중앙에 표시
- 모바일 하단 고정 네비게이션 바 추가 (홈, 장바구니, 마이페이지, 고객센터)
- 모바일 푸터: 쇼핑몰명/고객센터 섹션 2열 가로 배치
- 데스크탑 검색창 크기 확대

### 완료 조건
- [x] 모바일 상단 헤더에 쇼핑몰 이름만 표시
- [x] 모바일 하단 고정 네비게이션 바 구현
- [x] 모바일 푸터 레이아웃 개선
- [x] 검색창 반응형 크기 조정
- [x] 데스크탑 레이아웃 기존 유지

### 관련 항목
- TR-ID: TR-20260106-001
- Flow-ID: -
