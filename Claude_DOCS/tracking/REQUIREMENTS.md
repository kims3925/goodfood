# 요구사항 추적

> **관련 문서:** [tracking/CHANGELOG.md](./tracking/CHANGELOG.md) | [FLOW.md](./FLOW.md) | [CLAUDE.md](./CLAUDE.md)

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
| | | | | | |

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
