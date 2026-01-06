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
