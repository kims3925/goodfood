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
