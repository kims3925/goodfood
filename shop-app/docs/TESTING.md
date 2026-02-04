# 테스트 규칙

> **관련 문서:** [FRONTEND.md](./FRONTEND.md) | [BACKEND.md](./BACKEND.md) | [../CLAUDE.md](../CLAUDE.md)

---

## 현재 상태

| 항목 | 상태 |
|-----|-----|
| 테스트 프레임워크 | 미적용 |
| CI 테스트 | 빌드 성공 여부만 체크 |
| 커버리지 측정 | 미설정 |

**참고:** 현재 프로젝트는 테스트 프레임워크가 도입되지 않은 상태입니다. 아래 내용은 향후 테스트 도입 시 권장 가이드라인입니다.

---

## 권장 테스트 스택

| 유형 | 도구 | 용도 |
|-----|-----|-----|
| Unit | Jest | 함수/컴포넌트 단위 테스트 |
| Integration | Jest + MSW | API 연동 테스트 |
| Component | React Testing Library | React 컴포넌트 테스트 |
| E2E | Playwright | 전체 흐름 테스트 |

### 설치 명령어 (도입 시)

```bash
# Jest + React Testing Library
npm install -D jest @testing-library/react @testing-library/jest-dom

# MSW (API Mocking)
npm install -D msw

# Playwright (E2E)
npm install -D @playwright/test
```

---

## 핵심 원칙

| 원칙 |
|-----|
| 테스트 없는 코드 불허 (예외 시 명시적 사유) |
| AI 생성 코드도 테스트 필수 |
| 빠른 피드백 우선: Unit > Integration > E2E |
| 테스트도 코드다 (가독성, 유지보수성) |

---

## 테스트 유형

| 유형 | 범위 | 필수 | 시점 |
|-----|-----|-----|-----|
| Unit | 함수/메서드 | 필수 | 모든 변경 |
| Integration | 모듈 간 연동 | 필수 | API, DB 연동 |
| E2E | 전체 흐름 | 조건부 | 핵심 시나리오 |

---

## 우선순위 (도입 시)

### 1순위: 핵심 비즈니스 로직

| 영역 | 테스트 대상 |
|-----|-----------|
| 결제 | Toss 결제 승인, 환불 처리, 금액 검증 |
| 주문 | 주문 상태 전이, 주문 생성, 취소 처리 |
| 장바구니 | 상품 추가/삭제, 수량 변경, 금액 계산 |
| 비회원 주문 | 게스트 주문 생성, 조회 |

### 2순위: API Routes

| 영역 | 테스트 대상 |
|-----|-----------|
| 인증 | 로그인, 회원가입, 세션 검증 |
| 장바구니 | `/api/cart` CRUD |
| 주문 | `/api/orders`, `/api/guest-orders` |
| 결제 | `/api/payments/confirm`, `/api/payments/webhook` |
| 마이페이지 | `/api/mypage/*` API |

### 3순위: E2E 시나리오

| 시나리오 | 설명 |
|---------|-----|
| 회원 구매 플로우 | 로그인 → 장바구니 → 결제 → 주문완료 |
| 비회원 구매 플로우 | 상품 선택 → 결제 → 주문 조회 |
| 주문 취소 | 주문 취소 → 환불 처리 |

---

## 네이밍 규칙

```text
{테스트대상}_{시나리오}_{기대결과}
```

예시:
- `calculatePrice_whenMarginApplied_returnsCorrectPrice`
- `createOrder_whenStockInsufficient_throwsException`
- `transformProduct_whenAiResponseValid_createsProduct`

---

## 테스트 구조 (AAA)

```text
Arrange (준비) → Act (실행) → Assert (검증)
```

```typescript
// 예시: 가격 계산 테스트
describe('calculatePrice', () => {
  it('마진율 적용 시 올바른 소매가를 반환한다', () => {
    // Arrange
    const wholesalePrice = 10000
    const marginRate = 1.3
    const baseMargin = 1000

    // Act
    const result = calculatePrice(wholesalePrice, marginRate, baseMargin)

    // Assert
    expect(result).toBe(14000) // 10000 * 1.3 + 1000
  })
})
```

---

## Mock 규칙

### 허용

| 대상 | 이유 |
|-----|-----|
| Band API | 외부 API 의존성 제거 |
| Toss Payments | 결제 테스트 격리 |
| Gemini/OpenAI | AI API 비용/속도 |
| 시간 (Date/Time) | 결정적 테스트 |
| 랜덤 값 | 재현 가능성 |

### 금지

| 대상 | 이유 |
|-----|-----|
| Domain 로직 | 핵심 로직은 실제 테스트 |
| 가격 계산 | 비즈니스 검증 필수 |
| 상태 전이 | 실제 동작 검증 필수 |

---

## 테스트 데이터

| 규칙 |
|-----|
| Factory 패턴 사용 |
| 실제 운영 데이터 사용 금지 |
| PII (개인정보) 포함 금지 |
| Band 세션 쿠키 등 민감정보 금지 |

---

## CI 통합 (도입 시)

```yaml
# GitHub Actions 예시 (.github/workflows/test.yml)
- name: Run Tests
  run: |
    npm run test
    npm run test:coverage
```

| 규칙 |
|-----|
| PR 머지 전 테스트 필수 |
| 실패 시 머지 차단 |
| 커버리지 리포트 자동 생성 |

---

## 금지사항

| 금지 | 이유 |
|-----|-----|
| 테스트 생략 | 품질 보장 불가 |
| 운영 데이터로 테스트 | 보안 위험 |
| Band API 직접 호출 | CI 불안정, 쿠키 만료 |
| 테스트 간 의존성 | 격리 원칙 |
| 하드코딩된 sleep | Flaky 테스트 |
| 빈 테스트 케이스 | 의미없는 커버리지 |
