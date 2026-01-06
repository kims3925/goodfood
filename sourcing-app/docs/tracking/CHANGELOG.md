# 변경 추적

> **관련 문서:** [REQUIREMENTS.md](./REQUIREMENTS.md) | [FLOW.md](./FLOW.md) | [../CLAUDE.md](../CLAUDE.md)

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
| TR-20260106-002 | Done | 2026-01-06 | - | 자동화 파이프라인과 수동 실행 로직 통일 | Medium | Lee |
| TR-20260106-001 | Done | 2026-01-06 | - | 자동화 설정 채널설정 버튼 제거 | Low | Lee |

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

## TR-20260106-002: 자동화 파이프라인과 수동 실행 로직 통일

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Medium |

### 변경 사항
- 자동화 파이프라인(Collection, Transform, ProductCreate)이 수동 실행과 동일한 서비스 레이어 사용
- Collection: PostService.createBatch() 사용 (이미지 로컬 다운로드 포함)
- Transform: CollectedProductService.create() 사용 (수동 API와 동일)
- ProductCreate: ProductService.createFromCollectedProducts() 사용
- 공통 배치 타입(BatchResult, ProgressCallback) 정의

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/types/batch.types.ts | Added | 공통 배치 처리 타입 정의 |
| src/modules/sourcing/domain/src/post/repository/post.repository.ts | Modified | createMany(), findManyByExternalIds() 추가 |
| src/modules/sourcing/domain/src/post/services/post.service.ts | Modified | createBatch() 메서드 추가 |
| src/modules/catalog/domain/src/collected-product/services/collected-product.service.ts | Added | CollectedProduct 서비스 생성 |
| src/modules/catalog/domain/src/collected-product/index.ts | Added | 모듈 exports |
| src/modules/catalog/domain/src/product/services/product.service.ts | Modified | createFromCollectedProducts() 메서드 추가 |
| src/modules/automation/pipelines/collection.ts | Modified | PostService 사용으로 변경 |
| src/modules/automation/pipelines/transform.ts | Modified | CollectedProductService 사용으로 변경 |
| src/modules/automation/pipelines/product-create.ts | Modified | ProductService 사용으로 변경 |
| src/app/api/collected-product/route.ts | Modified | CollectedProductService 사용으로 리팩토링 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [x] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Lint | Pass |
| Build | Pass |
| Integration | N/A |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. 기존 직접 Prisma 호출 코드 복원

### 관련 항목
- REQ-ID: -
- Flow-ID: Collection → Transform → ProductCreate → Publish

---

## TR-20260106-001: 자동화 설정 채널설정 버튼 제거

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 자동화 설정 페이지에서 '채널 설정' 바로가기 버튼 제거
- UI 간소화를 위한 불필요한 네비게이션 버튼 정리

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(admin)/sourcing/automation/settings/page.tsx | Modified | 채널 설정 버튼 제거 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Unit | N/A |
| Integration | N/A |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. 채널 설정 버튼 코드 복원

### 관련 항목
- REQ-ID: -
- Flow-ID: -
