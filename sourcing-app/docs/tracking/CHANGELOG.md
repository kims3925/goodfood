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
| TR-20260106-012 | Done | 2026-01-06 | - | PostService.createBatch 진행률 계산 수정 | Low | Lee |
| TR-20260106-011 | Done | 2026-01-06 | - | ProductService.createFromCollectedProducts 트랜잭션 적용 | Low | Lee |
| TR-20260106-010 | Done | 2026-01-06 | - | ProductCreate 파이프라인 인덱스 불일치 버그 수정 | Low | Lee |
| TR-20260106-009 | Done | 2026-01-06 | - | CollectedProductService.createBatch userId 검증 추가 | Low | Lee |
| TR-20260106-008 | Done | 2026-01-06 | - | 발행 파이프라인 totalItems 실제 발행 대상만 카운트 | Low | Lee |
| TR-20260106-007 | Done | 2026-01-06 | - | 자동화 실행 로그 발행 단계 상세 로그 표시 수정 | Low | Lee |
| TR-20260106-006 | Done | 2026-01-06 | - | 자동화 대시보드 및 로그 UI/UX 개선 | Low | Lee |
| TR-20260106-005 | Done | 2026-01-06 | - | AI 변환 파이프라인 유료 API용 최적화 | Low | Lee |
| TR-20260106-004 | Done | 2026-01-06 | - | Channel 테이블 bandPostUrl 컬럼 삭제 | Low | Lee |
| TR-20260106-003 | Done | 2026-01-06 | - | 자동화 로그 API 응답 구조 수정 | Low | Lee |
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

## TR-20260106-012: PostService.createBatch 진행률 계산 수정

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 코드 리뷰(CodeRabbit) 지적사항 반영
- `onProgress` 콜백의 `current` 계산이 `skippedCount + i`에서 실제 처리된 항목 수 기반으로 변경
- `current: result.successCount + result.skippedCount + result.failedCount - 1` 사용

### 문제 상황
- 기존 로직은 `skippedCount + i`로 진행률 계산
- 중복 항목이 `posts` 배열의 앞쪽에만 있다고 가정
- 준비 단계에서 실패한 항목이 있으면 `createdPosts[i]`와 원본 배열 인덱스가 불일치

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/modules/sourcing/domain/src/post/services/post.service.ts | Modified | `onProgress` 콜백의 `current` 계산 로직 수정 (4곳) |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [x] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| TypeScript Build | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백

### 관련 항목
- REQ-ID: -
- Flow-ID: Collection (게시물 수집)

---

## TR-20260106-011: ProductService.createFromCollectedProducts 트랜잭션 적용

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 코드 리뷰(CodeRabbit) 지적사항 반영
- `createFromCollectedProducts` 메서드의 다중 테이블 변경을 `prisma.$transaction`으로 감싸기
- 트랜잭션 내 작업: Product 생성 → ProductImage 저장 → Product 썸네일 업데이트 → CollectedProduct 상태 업데이트
- 이미지 다운로드는 외부 I/O이므로 트랜잭션 외부에서 먼저 수행
- 중간 실패 시 부분 생성 데이터가 남지 않도록 원자성 보장

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/modules/catalog/domain/src/product/services/product.service.ts | Modified | prisma.$transaction 적용 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [x] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Build | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백

### 관련 항목
- REQ-ID: -
- Flow-ID: ProductCreate (상품 생성)

---

## TR-20260106-010: ProductCreate 파이프라인 인덱스 불일치 버그 수정

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 코드 리뷰(CodeRabbit) 지적사항 반영
- ProductCreate 파이프라인에서 `onProgress` 콜백의 `current` 인덱스가 서비스 내부 배열 인덱스와 파이프라인 원본 배열 인덱스 불일치 문제 수정
- `ProgressCallback` 타입에 `itemId` 필드 추가
- `ProductService.createFromCollectedProducts()`에서 `itemId`를 콜백에 직접 전달
- 파이프라인에서 `itemId`를 우선 사용하고 fallback으로 인덱스 사용

### 문제 상황
- 파이프라인과 서비스 모두 `isConverted: false` 조건으로 필터링 조회
- 서비스 내부 배열의 인덱스(`current`)를 파이프라인이 자신의 원본 배열 인덱스로 해석
- 동시성 이슈나 필터링 결과 차이로 `channelId`와 `itemId`가 잘못 매핑될 수 있음

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/types/batch.types.ts | Modified | `ProgressCallback`에 `itemId?: number` 필드 추가 |
| src/modules/catalog/domain/src/product/services/product.service.ts | Modified | `onProgress` 콜백 호출 시 `itemId: collectedProduct.id` 전달 |
| src/modules/automation/pipelines/product-create.ts | Modified | 콜백에서 `itemId`를 우선 사용하도록 수정 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [x] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| TypeScript Build | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백

### 관련 항목
- REQ-ID: -
- Flow-ID: ProductCreate (상품 생성)

---

## TR-20260106-009: CollectedProductService.createBatch userId 검증 추가

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 코드 리뷰(CodeRabbit) 지적사항 반영
- `createBatch` 메서드에서 `data[0].userId`로 모든 항목이 동일한 userId를 가진다고 암묵적으로 가정하던 문제 수정
- 함수 초입에서 모든 항목의 userId가 동일함을 명시적으로 검증
- 불일치 시 명확한 에러 메시지 발생

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/modules/catalog/domain/src/collected-product/services/collected-product.service.ts | Modified | userId 일관성 검증 로직 추가 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [x] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Build | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백

### 관련 항목
- REQ-ID: -
- Flow-ID: Transform (AI 변환)

---

## TR-20260106-007: 자동화 실행 로그 발행 단계 상세 로그 표시 수정

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 발행 파이프라인 단독 실행 시 details 구조가 로그 페이지 기대 구조와 불일치하던 버그 수정
- 세션 만료로 조기 반환될 때 channelResults가 빈 배열로 저장되던 버그 수정

**문제 1: 파이프라인 단독 실행 시 details 구조 불일치**
- 로그 페이지는 `details.publish.channelResults` 구조 기대
- PUBLISH 단독 실행 시 `details.channelResults`로 저장 (래핑 없음)
- 다른 파이프라인(COLLECT, TRANSFORM)도 동일 문제

**문제 2: 세션 만료 시 channelResults 누락**
- 세션 만료 에러 감지 후 `channelResult`를 배열에 추가하기 전에 반환
- `channelResults`가 빈 배열 `[]`로 저장되어 상세 로그 미표시

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/modules/automation/executor.ts | Modified | 각 파이프라인 단독 실행 시 details를 `{ collection/transform/productCreate/publish: result.details }` 구조로 래핑 |
| src/modules/automation/pipelines/publish.ts | Modified | `channelResult` 생성 및 push를 세션 만료 체크 앞으로 이동 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [x] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| TypeScript Build | Pass |
| Manual | Pending |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. executor.ts, publish.ts 이전 버전 복원

### 관련 항목
- REQ-ID: -
- Flow-ID: Automation Log View

---

## TR-20260106-006: 자동화 대시보드 및 로그 UI/UX 개선

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 대시보드 최근 실행 기록이 표시되지 않던 버그 수정 (API 응답 파싱 오류)
- 파이프라인 진행률이 각 단계 시작 시 0%로 리셋되던 버그 수정
- 설정 페이지에서 불필요한 PipelineStatusPanel 제거
- 대시보드 수동실행 버튼에서 '클릭하여 중단' 취소 기능 제거
  - 실행 중일 때 버튼 disabled + 실행 중 표시로 변경
  - 취소는 하단 PipelineStatusPanel에서만 가능

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(admin)/sourcing/dashboard/page.tsx | Modified | 1) API 파싱 수정 (`logsData.data?.logs`) 2) 수동실행 버튼 5개 취소 기능 제거, 실행 중 표시로 변경 3) Loader2 아이콘 import 추가 |
| src/modules/automation/pipelines/publish.ts | Modified | `updateWorkflowProgress(id, n, 0, 0)` 초기화 코드 제거 |
| src/modules/automation/pipelines/transform.ts | Modified | `updateWorkflowProgress(id, n, 0, 0)` 초기화 코드 제거 |
| src/app/(admin)/sourcing/automation/settings/page.tsx | Modified | PipelineStatusPanel 렌더링 코드 제거 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [x] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Build | Pass |
| Manual | Pending |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. 각 파일의 이전 버전 복원

### 관련 항목
- REQ-ID: -
- Flow-ID: Dashboard, Automation Settings

---

## TR-20260106-005: AI 변환 파이프라인 유료 API용 최적화

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 배치 크기 변경: 10개/요청 → 1개/요청 (유료 API는 rate limit 충분)
- 요청 간 대기 시간 제거: 응답 오면 즉시 다음 요청 (순차 처리)
- RPD(일일 요청 한도) 체크 비활성화: 유료 API는 한도 충분
- 재시도 대기 시간 단축: 10초 → 5초
- AI 설정은 AutomationConfig.aiProvider → AiApiConfig(해당 provider) 순으로 조회

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/modules/automation/pipelines/transform.ts | Modified | BATCH_SIZE=1, 대기 시간 제거, RPD 체크 비활성화 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [x] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| TypeScript Build | Pass |
| Manual | Pending |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. BATCH_SIZE=10, 대기 시간 로직 복원

### 관련 항목
- REQ-ID: -
- Flow-ID: Transform (AI 변환)

---

## TR-20260106-004: Channel 테이블 bandPostUrl 컬럼 삭제

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- Channel 테이블에서 사용하지 않는 `band_post_url` 컬럼 삭제
- 관련 타입 정의(BandPublishParams, BandPublishResult 등)에서 bandPostUrl 필드 삭제
- 발행 서비스에서 bandPostUrl 저장/전달 로직 삭제
- Band 자동화에서 직접 URL 접속 로직 제거 (항상 밴드 홈에서 채널명으로 검색)

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| db/prisma/models/channel.prisma | Modified | bandPostUrl 필드 삭제 |
| src/modules/publish/publish.service.ts | Modified | bandPostUrl 파라미터 전달 및 저장 로직 삭제 |
| src/modules/band-playwright/types.ts | Modified | 4개 인터페이스에서 bandPostUrl 필드 삭제 |
| src/modules/band-playwright/band-post.automation.ts | Modified | navigateToBand() 파라미터, 직접 접속 로직, 반환값에서 삭제 |

### 영향 분석
- [ ] API Contract 변경
- [x] DB Schema 변경
- [x] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Prisma Generate | Pass |
| DB Push | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. npx prisma db push --schema prisma로 컬럼 복원

### 관련 항목
- REQ-ID: -
- Flow-ID: Publish (소매밴드 발행)

---

## TR-20260106-003: 자동화 로그 API 응답 구조 수정

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 자동화 로그 API 응답 구조를 프론트엔드 기대 형식에 맞게 수정
- 기존: `{ success, data: [...logs], totalPages }`
- 변경: `{ success, data: { logs: [...], pagination: { total, page, limit, totalPages } } }`
- 로그 페이지에서 데이터가 있어도 표시되지 않던 버그 수정

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/api/automation/logs/route.ts | Modified | 응답 구조 변경 |

### 영향 분석
- [x] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Manual | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백

### 관련 항목
- REQ-ID: -
- Flow-ID: -

---

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
