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
| TR-20260108-001 | Done | 2026-01-08 | - | AutomationConfig 테이블에서 pricing_policy_id 컬럼 및 관계 삭제 | Low | Claude |
| TR-20260107-012 | Done | 2026-01-07 | - | API.md SSE 발행 스트림 문서 추가 (uploadProgress 필드 포함) | Low | Hong |
| TR-20260107-011 | Done | 2026-01-07 | - | FLOW.md 발행 흐름 다이어그램 중복 블록 제거 | Low | Hong |
| TR-20260107-010 | Done | 2026-01-07 | - | AWS EC2 MariaDB 일일 자동 백업 설정 | Low | Hong |
| TR-20260107-009 | Done | 2026-01-07 | - | 밴드 세션 확장 자동 저장 간격 상수 추가 | Low | Hong |
| TR-20260107-008 | Done | 2026-01-07 | - | 도매주문 엑셀 '보내는사람' 헤더 표현 수정 | Low | Hong |
| TR-20260107-007 | Done | 2026-01-07 | - | 파이프라인 알림 메시지 형식 개선 (화살표 연결) | Low | Hong |
| TR-20260107-006 | Done | 2026-01-07 | - | 브랜드명 변경 (BandAuto → SNS Auto) | Low | Hong |
| TR-20260107-005 | Done | 2026-01-07 | - | 쇼핑몰 목록 게스트 주문 카운트 반영 | Low | Hong |
| TR-20260107-004 | Done | 2026-01-07 | - | 날짜 표시 포맷 24시간제 통일 | Low | Hong |
| TR-20260107-003 | Done | 2026-01-07 | - | 발행된 상품 삭제 차단 기능 추가 | Low | Hong |
| TR-20260107-002 | Done | 2026-01-07 | - | 쇼핑몰 상품 검색 기능 추가 | Low | Hong |
| TR-20260107-001 | Done | 2026-01-07 | - | 발행 UI에 이미지 업로드 진행률 실시간 표시 | Low | Hong |
| TR-20260106-014 | Done | 2026-01-06 | - | 발행 결과 타입 명시적 구분자 추가 (Shop/Channel) | Low | Lee |
| TR-20260106-013 | Done | 2026-01-06 | - | 발행 파이프라인 순서 변경 (쇼핑몰 먼저) | Low | Lee |
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

## TR-20260107-010: AWS EC2 MariaDB 일일 자동 백업 설정

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Hong |
| Date | 2026-01-07 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- AWS EC2 인스턴스에 설치된 MariaDB 일일 자동 백업 설정
- cron + mysqldump 방식으로 매일 새벽 3시 자동 백업
- 7일 이상 된 백업 파일 자동 삭제
- 백업 로그 기록

### 설정 내용
| 항목 | 값 |
|-----|-----|
| 백업 시간 | 매일 03:00 (KST) |
| 백업 위치 | /home/ubuntu/backups/ |
| 백업 대상 | sourcing_db |
| 보관 기간 | 7일 |
| 로그 파일 | /home/ubuntu/backups/backup.log |

### 설정 파일
| 파일 | 설명 |
|-----|-----|
| /home/ubuntu/backup-db.sh | 백업 스크립트 |
| crontab (root) | 스케줄 설정 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Manual | Pass |

### 롤백 계획
1. `sudo crontab -e`로 cron 항목 삭제
2. 백업 스크립트 삭제: `rm /home/ubuntu/backup-db.sh`

### 관련 항목
- REQ-ID: -
- Flow-ID: -

---

## TR-20260107-009: 밴드 세션 확장 자동 저장 간격 상수 추가

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Hong |
| Date | 2026-01-07 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 밴드 세션 확장 프로그램에 `AUTO_SAVE_INTERVAL` 상수 추가 (1시간 = 3600000ms)

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| band-session-extension/config.js | Modified | AUTO_SAVE_INTERVAL 상수 추가 |

### 영향 분석
- [ ] API Contract 변경
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

## TR-20260107-008: 도매주문 엑셀 '보내는사람' 헤더 표현 수정

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Hong |
| Date | 2026-01-07 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 도매주문 엑셀 내보내기 헤더에서 '보내는 사람' → '보내는사람(받는분과 다른경우만 작성)'으로 변경
- 사용자에게 입력 조건을 명확히 안내

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/api/admin/wholesale-orders/[wholesaleChannelId]/export/route.ts | Modified | 엑셀 헤더 텍스트 변경 |

### 영향 분석
- [ ] API Contract 변경
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

## TR-20260107-007: 파이프라인 알림 메시지 형식 개선 (화살표 연결)

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Hong |
| Date | 2026-01-07 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 파이프라인 완료 알림 메시지를 쉼표(,)에서 화살표(→)로 변경
- 기존: `수집 10건, 변환 8건, 발행 8건`
- 변경: `수집 10 → 변환 8 → 상품생성 8 → 발행 8`
- 중복 알림 방지: executor.ts에서 생성하므로 execute/route.ts에서 중복 호출 제거

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/modules/automation/notification-helper.ts | Modified | 메시지 형식을 화살표로 변경, '건' 단위 제거 |
| src/app/api/automation/execute/route.ts | Modified | 중복 알림 생성 코드 제거 |

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
- Flow-ID: Automation

---

## TR-20260107-006: 브랜드명 변경 (BandAuto → SNS Auto)

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Hong |
| Date | 2026-01-07 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 헤더 브랜드명을 'BandAuto'에서 'SNS Auto'로 변경
- 릴리즈 배지(release-1) 제거

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/components/layout/Header.tsx | Modified | 브랜드명 변경, 릴리즈 배지 제거 |

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

---

## TR-20260107-005: 쇼핑몰 목록 게스트 주문 카운트 반영

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Hong |
| Date | 2026-01-07 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 쇼핑몰 목록에서 주문 수 통계에 게스트 주문(guestOrders)도 포함
- 기존: `orders` 카운트만 표시
- 변경: `orders + guestOrders` 합산 표시

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(admin)/shop/store/list/page.tsx | Modified | guestOrders 카운트 합산 |
| src/app/api/shop/route.ts | Modified | _count에 guestOrders 포함 |

### 영향 분석
- [x] API Contract 변경 (`_count.guestOrders` 필드 추가)
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
- Flow-ID: -
- API 문서: [docs/API.md](../API.md#get-apishop)

---

## TR-20260107-004: 날짜 표시 포맷 24시간제 통일

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Hong |
| Date | 2026-01-07 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 날짜 표시 형식을 24시간제로 통일
- 포맷: `YYYY-MM-DD HH:mm` (예: 2026-01-07 14:30)
- 적용 페이지: 상품 목록, 주문 목록

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(admin)/sourcing/product/list/page.tsx | Modified | 생성일시 포맷 변경 |
| src/app/(admin)/shop/order/list/page.tsx | Modified | 주문일시 포맷 변경 |

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

---

## TR-20260107-003: 발행된 상품 삭제 차단 기능 추가

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Hong |
| Date | 2026-01-07 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 소매밴드에 발행된 기록이 있는 상품은 삭제 불가
- 단일 삭제 및 일괄 삭제 모두 차단
- 삭제 시도 시 경고 모달 표시 (발행된 상품 목록 표시)
- 주문 관리 및 데이터 무결성 보장 목적

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(admin)/sourcing/product/list/page.tsx | Modified | hasPublishHistory 체크, 경고 모달 추가 |

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
- Flow-ID: Product Management

---

## TR-20260107-002: 쇼핑몰 상품 검색 기능 추가

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Hong |
| Date | 2026-01-07 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 쇼핑몰 메인 페이지에 상품 검색 기능 추가
- URL 쿼리 파라미터로 검색어 전달 (`?search=검색어`)
- 검색 모드에서는 추천 상품 섹션 숨김
- 검색 결과 없을 때 안내 메시지 및 전체 상품 보기 버튼 제공
- 검색 초기화 버튼 제공

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| shop-app/src/app/(shop)/main/page.tsx | Modified | 검색 UI 및 로직 추가 |
| shop-app/src/app/api/shop/sections/route.ts | Modified | search 파라미터 처리, 상품명 필터링 |

### 영향 분석
- [x] API Contract 변경 (search 파라미터 추가)
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
- Flow-ID: Shop

---

## TR-20260107-001: 발행 UI에 이미지 업로드 진행률 실시간 표시

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Hong |
| Date | 2026-01-07 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 발행 모달에서 이미지 업로드 진행 상황을 실시간으로 표시
- `📤 1/10 (10%)` 형태로 현재 업로드 중인 파일 번호와 전체 진행률 표시
- EventEmitter 패턴을 사용하여 자동화 파이프라인과 SSE 스트림 모두에서 업로드 진행 정보 전달

### 구현 구조
```text
band-post.automation.ts (업로드 모니터링)
        │
        ▼
uploadProgressEmitter (EventEmitter 싱글톤)
        │
        ├─→ publish.ts 파이프라인 (자동화 워크플로우 → DB 저장)
        │
        └─→ createPostWithImages (SSE 스트림 → onStageProgress → 프론트엔드)
```

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/modules/band-playwright/upload-progress-emitter.ts | Added | EventEmitter 싱글톤으로 업로드 진행 이벤트 발행 |
| src/modules/band-playwright/band-post.automation.ts | Modified | uploadProgressEmitter 구독 → onStageProgress 전달, cleanup 로직 추가 |
| src/modules/automation/pipelines/publish.ts | Modified | uploadProgressEmitter 구독 → DB 업데이트에 포함, cleanup 로직 추가 |
| src/modules/publish/types.ts | Modified | PublishDetailedProgress에 uploadProgress 필드 추가 |
| src/modules/publish/publish.service.ts | Modified | SSE 이벤트에 uploadProgress 포함 |
| src/app/(admin)/sourcing/publish/page.tsx | Modified | PublishProgressItem 타입에 uploadProgress 추가, UI 표시 |

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
- Flow-ID: Publish (소매밴드 발행)

---

## TR-20260106-014: 발행 결과 타입 명시적 구분자 추가 (Shop/Channel)

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 코드 리뷰(CodeRabbit) 지적사항 반영
- `ChannelPublishResult`와 `PublishedProductResult` 타입에 명시적 타입 구분자 추가
- 기존: `channelId: -shopId` (음수로 Shop 구분 - 암시적)
- 변경: `targetType: 'SHOP' | 'CHANNEL'`, `targetId`, `targetName` (명시적)
- 하위 호환성을 위해 `channelId`, `channelName` 필드를 `@deprecated`로 유지
- Shop 결과에도 `channelName` deprecated 필드 일관되게 채움
- 팀 코딩 컨벤션 "암시적 동작보다 명시적 설계를 우선" 준수

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/modules/automation/types.ts | Modified | `PublishTargetType` 타입 추가, `ChannelPublishResult`/`PublishedProductResult`에 명시적 필드 추가 |
| src/modules/automation/pipelines/publish.ts | Modified | 음수 ID 제거, 명시적 `targetType`/`targetId`/`targetName` 사용 |

### 영향 분석
- [x] API Contract 변경 (타입 필드 추가, 하위 호환)
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
- Flow-ID: Publish (소매밴드 발행)

---

## TR-20260106-013: 발행 파이프라인 순서 변경 (쇼핑몰 먼저)

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 발행 파이프라인에서 쇼핑몰(Shop) 발행을 먼저 수행하고, 채널(Band) 발행을 나중에 수행하도록 순서 변경
- 기존: 채널(Band) 발행 → 쇼핑몰(Shop) 발행
- 변경: 쇼핑몰(Shop) 발행 → 채널(Band) 발행

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/modules/automation/pipelines/publish.ts | Modified | 쇼핑몰 발행 로직을 채널 발행 전으로 이동 |

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
- Flow-ID: Publish (소매밴드 발행)

---

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

## TR-20260106-008: 발행 파이프라인 totalItems 실제 발행 대상만 카운트

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Lee |
| Date | 2026-01-06 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 발행 파이프라인에서 `totalItems`가 전체 상품 수가 아닌 실제 발행 대상 상품 수만 카운트하도록 수정
- 이미 발행된 상품이나 스킵된 상품은 `totalItems`에서 제외
- 진행률 표시가 더 정확하게 표시됨

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/modules/automation/pipelines/publish.ts | Modified | totalItems 계산 로직 수정 |

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
- Flow-ID: Publish (소매밴드 발행)

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
