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
| TR-20260610-004 | Done(코드)/배포 대기 | 2026-06-10 | - | 소싱 현황판 신설 — /sourcing/pipeline + GET /api/sourcing/pipeline-status. 수집→AI가공→소매밴드/쇼핑몰 발행 단계를 기존 상품 포함 한눈에 (단계 필터/검색/채널/기간) | Low | Claude |
| TR-20260610-003 | Done(코드)/배포 대기 + 운영DB 직접반영 완료 | 2026-06-10 | - | WholesaleWatch 활성화 — 운영 채널 40/41 bandNo 설정(82999897/85260087)+AgentDefinition seed(SQL). deleteBandPost=true (도매방 모니터링만, 소매밴드/쇼핑몰만 삭제 반영) | Medium | Claude |
| TR-20260610-002 | Done(코드)/운영 db push 대기 | 2026-06-10 | - | AgentTask/AgentLog userId 추가 (SaaS P0-2 테넌트 식별) — 이벤트 data.userId / 로그 metadata.userId 기록, null=전역 | Low | Claude |
| TR-20260610-001 | Done(코드)/운영 db push·확장 재배포 대기 | 2026-06-10 | - | 밴드 로그인 계정 설정 (SaaS P0-1/P0-4) — User.bandLoginEmail + Channel.sessionAccountEmail, save-all 계정 검증(409), status 계정별 검증, 설정 UI, 확장 v1.2.0 계정 확인 체크박스 + background 자동저장 계정 회신 | Medium | Claude |
| TR-20260527-003 | Done(코드)/db push 대기 | 2026-05-27 | - | 경영밴드 SaaS Phase 4.1: 채널별 만료정책 (Channel.expiryDaysNormal/Com/autoExpireEnabled + GET/PUT /api/channel/[id]/expiry-policy + runContentExpiry autoExpire skip & 안전 per-channel 후처리) | Medium | Claude |
| TR-20260527-002 | Done(배포완료) | 2026-05-27 | - | 경영밴드 SaaS Phase 1: Band OAuth 토큰 자동갱신(defensive — tokenExpiry 절대시각 저장 + 만료10분전 refresh, 성공시에만 덮어쓰기, 미설정시 no-op) | Medium | Claude |
| TR-20260527-001 | Done(배포완료) | 2026-05-27 | - | 경영밴드 SaaS Phase 0: Product 하드삭제 → 소프트삭제 전환 (데이터 유실 재발 방지). destructive cascade 제거, Product+발행물 soft-delete, 복원 가능 | Critical | Claude |
| TR-20260526-001 | Done | 2026-05-26 | REQ-PUBLISH-010 | 다단계 발행(fan-out) 1차: 발행대상 가격 tier(PriceTier) + 가족도매방밴드 도매가 발행 (현행 단일경로 비파괴 확장) | Medium | Claude |
| TR-20260515-013 | Done | 2026-05-15 | - | SD푸드 정책 시 가격이미지 필터 자동 스킵 (실 상품 사진 과탐 방지) | Low | Claude |
| TR-20260515-012 | Done | 2026-05-15 | - | MarketingAgent 멀티테넌트 fan-out — BandNoticeConfig.isEnabled 사용자별 발화 + scheduleTimes ±5분 매칭 | Medium | Claude |
| TR-20260515-011 | Done | 2026-05-15 | - | 다른 페이지 server-side 잡 마이그 — /sourcing/publish 재발행, /sourcing/post/list Stage2 (탭 닫아도 진행) | Medium | Claude |
| TR-20260515-010 | Done | 2026-05-15 | - | SaaS 예방책 Phase 2 — 발행 헬스 워치독 (1h success_rate 모니터 + 자동 OFF) + Phase 4 — 세션 만료 +14일 자동 + D-3/D-1/EXPIRED 알림 | Large | Claude |
| TR-20260515-009 | Done | 2026-05-15 | - | SaaS 예방책 Phase 1+3 — 매니저 대시보드 세션 헬스 배너 + pre-flight 차단 (cookie 길이 < 1000 catch) | Medium | Claude |
| TR-20260515-008 | Done | 2026-05-15 | - | 주문 엑셀 저장 — 소매밴드 + 결제 정보 4컬럼 추가 + 금액/배송비 실제 주문 값으로 수정 (상품 마스터 폴백 버그 fix) | Medium | Claude |
| TR-20260515-007 | Done | 2026-05-15 | - | 푸터 이미지 발행 0% 실패 hotfix — 내부 API 이미지 로컬 파일 직접 읽기 + 부분 실패 허용 | Critical | Claude |
| TR-20260515-006 | Done | 2026-05-15 | - | 인기상품 popularity 서비스 + ETL + ProductManagerAgent bestseller 이벤트 (5년 데이터 활용 백엔드) | Large | Claude |
| TR-20260515-005 | Done | 2026-05-15 | - | 광고&마케팅 메뉴 + 밴드공지 설정 페이지 + GET/PUT /api/admin/band-notice/config | Medium | Claude |
| TR-20260515-004 | Done | 2026-05-15 | - | BandNoticeConfig + LegacyOrder Prisma 모델 + db push (운영 적용 완료) | Medium | Claude |
| TR-20260515-003 | Done | 2026-05-15 | - | 가공상품 발행을 서버 사이드 백그라운드 잡으로 (POST /api/publish/processed-job, 탭 닫아도 진행) | Large | Claude |
| TR-20260515-002 | Done | 2026-05-15 | - | 자동화설정 흐름 제어 패널 (실행중 다건 표시 + 전체중지/재등록/stuck 정리/영구비활성화) | Medium | Claude |
| TR-20260515-001 | Done | 2026-05-15 | - | Band 세션 만료 진단 — 모든 RETAIL 채널 cookie NULL 확인, Extension 재저장 가이드 | Low | Claude |
| TR-20260424-002 | Done | 2026-04-24 | - | 카카오톡 광고 자동 생성 기능 + 신규 광고 페이지 (콜라주 발행/카톡 광고 2탭) + '상품및광고' 메뉴 재편 | Large | Claude |
| TR-20260424-001 | Done | 2026-04-24 | - | 종합발행 콜라주(Collage) 모드 추가 - 12개 상품을 배경 제거된 포스터 1장으로 합성 + 쇼핑몰 카테고리 페이지 신설 | Medium | Claude |
| TR-20260406-001 | Done | 2026-04-06 | - | 수집상품/가공상품 페이지 통합 (탭 구조), 수집게시물 AI미가공 필터링, 네비게이션 메뉴 정리 | Medium | Claude |
| TR-20260404-001 | Done | 2026-04-04 | - | 독립 어드민 패널 구현 (전용 레이아웃/사이드바/헤더) + 에이전트 대시보드 17개 에이전트 데이터 강화 + 에이전트 설정 페이지 추가 | Medium | Claude |
| TR-20260318-001 | Done | 2026-03-18 | - | 전체 파이프라인 실행 대시보드 추가 - 소싱 자동화, 주문/발주, 정산 현황을 한 화면에서 관리 | Low | Claude |
| TR-20260205-001 | Done | 2026-02-05 | - | 발행 페이지 날짜 필터 추가 및 자동화 파이프라인 오늘 상품만 발행 | Low | Claude |
| TR-20260122-001 | Done | 2026-01-22 | - | 상품 일괄 비활성화 기능 추가 | Low | Claude |
| TR-20260121-006 | Done | 2026-01-21 | - | 소싱 대시보드 수동 실행 버튼 모바일 개선 | Low | Claude |
| TR-20260121-005 | Done | 2026-01-21 | - | 소싱 섹션 현황 카드 sm 브레이크포인트 추가 | Low | Claude |
| TR-20260121-004 | Done | 2026-01-21 | - | 소싱 섹션 페이지 모바일 UI 개선 | Low | Claude |
| TR-20260121-003 | Done | 2026-01-21 | - | 쇼핑몰 섹션 페이지 모바일 UI 개선 | Low | Claude |
| TR-20260121-002 | Done | 2026-01-21 | - | 공통 UI 컴포넌트 모바일 반응형 개선 | Low | Claude |
| TR-20260121-001 | Done | 2026-01-21 | - | 레이아웃 컴포넌트 모바일 반응형 개선 | Low | Claude |
| TR-20260120-003 | Done | 2026-01-20 | - | 로그인 후 대시보드로 리다이렉트 변경 | Low | Claude |
| TR-20260120-002 | Done | 2026-01-20 | - | 외부 주문 API 타입 에러 수정 | Low | Claude |
| TR-20260120-001 | Done | 2026-01-20 | - | 외부 주문 웹훅 알림 (슬랙/디스코드) 기능 추가 | Low | Claude |
| TR-20260119-001 | Done | 2026-01-19 | - | 대시보드 마진 계산을 순수 소매가 기반으로 수정 | Low | Claude |
| TR-20260115-006 | Done | 2026-01-15 | - | 대시보드 마진 계산에 도매가 정보 추가 | Low | Claude |
| TR-20260115-005 | Done | 2026-01-15 | - | 도매주문 발주완료 상태를 PREPARING으로 변경 | Low | Claude |
| TR-20260115-004 | Done | 2026-01-15 | - | 토스페이먼츠 결제 수단 타입 정리 | Low | Claude |
| TR-20260115-003 | Done | 2026-01-15 | - | Turbopack 활성화로 개발 서버 성능 개선 | Low | Claude |
| TR-20260115-002 | Done | 2026-01-15 | - | 차트 렌더링 오류 및 CSS 파싱 오류 수정 | Low | Claude |
| TR-20260115-001 | Done | 2026-01-15 | - | 외부 주문 추가에서 합배송 반영 가격 계산 | Medium | Claude |
| TR-20260113-001 | Done | 2026-01-13 | - | 발주 이력 날짜별 필터링 버그 수정 | Low | Claude |
| TR-20260112-007 | Done | 2026-01-12 | - | 소매밴드 발행 양식 상단 링크 제거 (제목 최상단 노출) | Low | Claude |
| TR-20260112-006 | Done | 2026-01-12 | - | 토스페이먼츠 거래 API 스키마 변경 (tossPay → transfer/virtualAccount) | Low | Claude |
| TR-20260112-005 | Done | 2026-01-12 | - | 게시물 수집 날짜 선택 기능 제거 (오늘 날짜만 KST 기준) | Low | Claude |
| TR-20260112-004 | Done | 2026-01-12 | - | 매니저 관리 페이지 TypeScript 타입 오류 수정 | Low | Claude |
| TR-20260112-003 | Done | 2026-01-12 | - | 구글 시트 연동 기능 추가 (발주서 동기화) | Low | Claude |
| TR-20260112-002 | Done | 2026-01-12 | - | 정산 페이지에 결제 상태 구분 및 토스페이먼츠 현황 추가 | Low | Claude |
| TR-20260112-001 | Done | 2026-01-12 | - | 사용자 관리 메뉴를 매니저/회원으로 분리 | Low | Claude |
| TR-20260109-002 | Done | 2026-01-09 | - | ShopProduct/ChannelProduct upsert로 Soft Delete 레코드 복원 지원 | Low | Claude |
| TR-20260109-001 | Done | 2026-01-09 | - | ShopProduct/Shop Soft Delete 필터링 강화 | Low | Claude |
| TR-20260108-003 | Done | 2026-01-08 | - | 역할명 변경 (회원/매니저) | Low | Claude |
| TR-20260108-002 | Done | 2026-01-08 | - | published_product → shop_product/channel_product 스키마 마이그레이션 | Medium | Claude |
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

## TR-20260526-001: 다단계 발행(fan-out) 1차 — 발행대상 가격 tier + 가족도매방밴드 도매가 발행

| 항목 | 값 |
|-----|---|
| Status | Done (코드) / DB push 운영 적용 대기 |
| Author | Claude |
| Date | 2026-05-26 |
| REQ-ID | REQ-PUBLISH-010 |
| Risk | Medium |

### 배경
`bandauto-v2-multitier-publish-pricing-directive.md` 지시서를 현행 아키텍처에 맞게 매핑.
지시서는 신규 `PricingPolicy`/`PublicationTarget`/`Publication` 모델 + 발행 시점 PricingEngine
재계산을 제안했으나, 현행 시스템과 충돌하여 **비파괴적 최소 설계**로 재해석:
- 현행 `PricingPolicy`(Int, content/tierRules)와 이름 충돌 → 신규 모델 도입하지 않음
- 가격은 AI 가공 시점에 이미 `price`(소매)+`wholesalePrice`(도매) **둘 다 저장** → 발행 시
  재계산 대신 tier 별 **선택**만 (머니 수학 중복/괴리 방지)
- 발행 대상은 `kind=RETAIL` Channel + `AutomationConfig.channelIds` 로 이미 일반화돼 있음
  → 신규 `PublicationTarget` 대신 Channel 에 `publishPriceTier` 플래그 1개만 추가

### 변경 사항
- enum `PriceTier { WHOLESALE RETAIL }` 추가
- `Channel.publishPriceTier PriceTier @default(RETAIL)` — 발행 대상의 가격 기준. 기본 RETAIL → 기존 채널 동작 변화 0
- `ChannelProduct`: `priceTier` / `publishBatchId` / `priceSnapshot(Json)` 감사 컬럼 추가 (모두 nullable, 가격 스냅샷 보존)
- 순수 엔진 `modules/pricing/publish-tier-pricing.ts` + 골든 테스트 35건 (G1~G5 + tier 선택기)
- `publish.service.ts`: tier 별 본문(도매가/판매가 라벨) + WHOLESALE 은 쇼핑몰 연결 요구 완화·CTA 숨김 + 스냅샷 저장
- `pipelines/publish.ts`: 1차 도매(WHOLESALE) → 2차 소매(RETAIL) 정렬 + 단일 `publishBatchId` fan-out 묶음
- 채널 상세 페이지: "발행 가격 기준" 토글 (소매가/도매가) — RETAIL 채널 전용

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| db/prisma/schema.prisma | Modified | enum PriceTier 추가 |
| db/prisma/models/channel.prisma | Modified | publishPriceTier 컬럼 |
| db/prisma/models/channel-product.prisma | Modified | priceTier/publishBatchId/priceSnapshot + index |
| db/src/client.ts | Modified | PriceTier re-export |
| sourcing-app/src/modules/pricing/publish-tier-pricing.ts | Added | 순수 tier 가격 엔진 |
| sourcing-app/src/modules/pricing/__tests__/publish-tier-pricing.test.ts | Added | 골든 테스트 35건 |
| sourcing-app/src/modules/publish/publish.service.ts | Modified | tier 본문/스냅샷/쇼핑몰요구 완화 |
| sourcing-app/src/modules/publish/types.ts | Modified | publishBatchId/priceTier 필드 |
| sourcing-app/src/modules/automation/pipelines/publish.ts | Modified | 정렬 + batchId 전파 |
| sourcing-app/src/app/api/channel/[id]/route.ts | Modified | publishPriceTier 입력 |
| sourcing-app/src/modules/sourcing/domain/src/channel/{types,repository} | Modified | publishPriceTier 전달 |
| sourcing-app/src/app/(admin)/sourcing/channel/detail/[id]/page.tsx | Modified | 발행 가격 기준 토글 UI |

### 영향 분석
- [x] API Contract 변경 (PUT /api/channel/[id] 에 publishPriceTier 선택 필드)
- [x] DB Schema 변경 (db push 필요 — 운영 적용 전까지 코드만 동작)
- [x] Domain Logic 변경 (발행 본문 가격 선택)
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Unit (골든 G1~G5 + tier 선택기) | Pass (35/35) |
| Typecheck (sourcing-app tsc) | Pass (0 errors) |
| Integration | 미실행 (운영 DB push + 실밴드 발행 검증 필요) |

### 롤백 계획
1. 코드: 본 TR 의 변경 파일 revert (기존 RETAIL 경로는 default tier=RETAIL 이라 영향 없음)
2. DB: 추가 컬럼은 nullable/defaulted 라 그대로 둬도 무해. 필요 시 컬럼 drop.

### 시니어 리뷰 게이트 (미배선 / 후속)
- PricingEngine 의 MARKUP/FIXED_MARGIN **라이브 소매 배선** — 현행 정책 엔진과 괴리 위험, 정산 영향 (지시서 §3.2·§7)
- 정산 분리 집계 / Hublink tier 별 분리 (지시서 §4.2·§7) — 데이터 토대(priceTier 태깅)만 확보
- saga 2차 실패 재시도 큐(BullMQ) — 현재는 기존 순차 실패 처리 유지

### 관련 항목
- REQ-ID: REQ-PUBLISH-010
- 지시서: bandauto-v2-multitier-publish-pricing-directive.md

---

## TR-20260121-003: 쇼핑몰 섹션 페이지 모바일 UI 개선

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-21 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 주문 목록 페이지: 모바일 카드 뷰 추가 (lg:hidden), 페이지네이션 터치 타겟 확보
- 주문 상세 페이지: 상품 목록 모바일 레이아웃 최적화 (이미지, 정보, 가격 분리)
- 정산 관리 페이지: 토스페이먼츠 현황 모바일 레이아웃 개선, 기간 선택 UI 터치 친화적 변경, 쇼핑몰 상세 모바일 카드 뷰 추가
- CS 문의 목록: 모바일 카드 뷰 추가 (lg:hidden), 필터 버튼 터치 타겟 44px 확보, 통계 카드 그리드 반응형 개선
- 발주 관리 페이지: 통계 카드 그리드 반응형 개선 (cols-2 sm:cols-3 md:cols-5), 도매처 카드 그리드 sm 브레이크포인트 추가
- 리뷰 목록 페이지: 통계 카드 그리드 반응형 개선 (cols-2 sm:cols-2 md:cols-4)
- 정산 이력 페이지: 통계 카드 그리드 반응형 개선 (cols-2 sm:cols-3 md:cols-3)
- 회원 목록 페이지: 통계 카드 그리드 반응형 개선 (cols-2 sm:cols-3 md:cols-3)
- 쇼핑몰 목록 페이지: 통계 카드 그리드 반응형 개선 (cols-2 sm:cols-3 md:cols-6)
- 알림 페이지: 통계 카드 그리드 반응형 개선 (cols-2 sm:cols-3 md:cols-5)
- 모든 페이지 min-h-[44px] 적용으로 터치 접근성 개선

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(admin)/shop/order/list/page.tsx | Modified | 모바일 카드 뷰 추가, 페이지네이션 개선 |
| src/app/(admin)/shop/order/detail/[id]/page.tsx | Modified | 상품 목록 모바일 레이아웃 분리 |
| src/app/(admin)/shop/settlement/list/page.tsx | Modified | 토스페이먼츠 헤더, 필터, 상세 목록 모바일 개선, 통계 카드 그리드 반응형 |
| src/app/(admin)/shop/cs/inquiry/list/page.tsx | Modified | 모바일 카드 뷰 추가, 필터 터치 타겟 확보, 통계 카드 그리드 반응형 |
| src/app/(admin)/shop/wholesale-orders/page.tsx | Modified | 통계 카드/도매처 카드 그리드 반응형 개선 |
| src/app/(admin)/shop/reviews/list/page.tsx | Modified | 통계 카드 그리드 반응형 개선 |
| src/app/(admin)/shop/settlement/history/page.tsx | Modified | 통계 카드 그리드 반응형 개선 |
| src/app/(admin)/shop/user/list/page.tsx | Modified | 통계 카드 그리드 반응형 개선 |
| src/app/(admin)/shop/store/list/page.tsx | Modified | 통계 카드 그리드 반응형 개선 |
| src/app/(admin)/shop/notification/page.tsx | Modified | 통계 카드 그리드 반응형 개선 |

---

## TR-20260121-002: 공통 UI 컴포넌트 모바일 반응형 개선

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-21 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- Modal: 모바일에서 max-width를 화면 너비에 맞게 조정, 닫기 버튼 터치 타겟 44px 확보
- Table: 반응형 패딩 및 폰트 크기 적용 (px-2 py-2 sm:px-4 sm:py-3)
- Button: 모바일 터치 타겟 44px 이상 보장 (min-h-[44px])
- Input: 최소 높이 44px, iOS 확대 방지를 위해 text-base 유지
- Select: 최소 높이 44px, 반응형 패딩 적용
- Pagination: 반응형 레이아웃, 버튼 터치 타겟 44px 확보
- Vercel React Best Practices 적용: memo, useCallback 메모이제이션

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/components/ui/Modal.tsx | Modified | 반응형 max-width, 닫기 버튼 터치 타겟, fullScreenOnMobile prop |
| src/components/ui/Table.tsx | Modified | 반응형 패딩, memo 적용 |
| src/components/ui/Button.tsx | Modified | 터치 타겟 44px, memo 적용 |
| src/components/ui/Input.tsx | Modified | 터치 타겟 44px, text-base 유지, memo 적용 |
| src/components/ui/Select.tsx | Modified | 터치 타겟 44px, useCallback/memo 적용 |
| src/components/ui/Pagination.tsx | Modified | 반응형 레이아웃, 터치 타겟 44px, memo/useCallback 적용 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| TypeCheck | Pass |
| Build | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백

### 관련 항목
- REQ-ID: -
- Flow-ID: -

---

## TR-20260120-002: 외부 주문 API 타입 에러 수정

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-20 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 외부 주문 조회 API에서 nullable 필드 타입 체크 추가
- `guestOrder.shop`, `memberOrder.shop` null 체크 추가
- `item.shopProduct.product` null 체크 추가 (OrderItem의 productName/thumbnailUrl 폴백)
- 외부 회원 주문 삭제 시 `deletedAt` → `status: CANCELLED` 방식으로 변경
  - Order 모델에 deletedAt 필드가 없어 기존 cancelledAt/status 필드 활용

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/api/order/external/[orderNumber]/route.ts | Modified | null 체크 추가 (6개 에러 수정) |
| src/app/api/order/external/member/[id]/route.ts | Modified | deletedAt → 취소 처리로 변경 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| TypeCheck | Pass |
| Build | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백

### 관련 항목
- REQ-ID: -
- Flow-ID: -

---

## TR-20260120-001: 외부 주문 웹훅 알림 (슬랙/디스코드) 기능 추가

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-20 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 외부 주문 생성 시 슬랙 또는 디스코드 웹훅으로 알림 전송
- `order-webhook.service.ts` 신규 생성 (슬랙 Block Kit / 디스코드 Embed 포맷 지원)
- `createExternalOrder()` 메서드에 웹훅 호출 추가
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
| src/services/order-webhook.service.ts | Added | 외부 주문 웹훅 서비스 (슬랙/디스코드) |
| src/services/order.service.ts | Modified | 외부 주문 생성 시 웹훅 호출 추가 |

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
- Flow-ID: 외부 주문 흐름
- 참조: shop-app TR-20260120-001

---

## TR-20260113-001: 발주 이력 날짜별 필터링 버그 수정

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-13 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항

도매처별 발주 완료 이력 페이지에서 날짜 필터가 작동하지 않던 버그 수정:

**문제**
- 발주 완료 이력 페이지에서 날짜를 변경해도 모든 날짜의 데이터가 동일하게 표시됨
- 프론트엔드에서 `from`, `to` 파라미터를 전송하지만 API에서 무시됨

**해결**
- API에서 `from`, `to` 쿼리 파라미터를 파싱하여 날짜 필터 적용
- 회원 주문(`OrderItem`)과 비회원 주문(`GuestOrderItem`) 모두에 `orderedAt` 필터 적용
- `from` 날짜는 00:00:00, `to` 날짜는 23:59:59로 시간 설정

### 변경 파일

| 파일 | 유형 | 설명 |
|-----|-----|-----|
| sourcing-app/src/app/api/admin/wholesale-orders/[wholesaleChannelId]/items/route.ts | Modified | from/to 날짜 필터 파싱 및 적용 |

### 영향 분석

- [x] API Contract 변경 (기존 파라미터 동작 수정)
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트

| 유형 | 상태 |
|-----|-----|
| TypeScript Build | Pass |

### 롤백 계획

1. git revert로 해당 커밋 롤백

### 관련 항목

- REQ-ID: -
- Flow-ID: Wholesale Orders
- 문서 업데이트:
  - [docs/API.md](../API.md#get-apiadminwholesale-orderswholesalechanneliditems): 날짜 필터 파라미터 문서화

---

## TR-20260112-007: 소매밴드 발행 양식 상단 링크 제거 (제목 최상단 노출)

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-12 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항

소매밴드 발행 양식에서 상단 쇼핑몰 링크를 제거하고 제목이 최상단에 노출되도록 변경:

- 기존: `🔗 쇼핑몰 링크\n\n제목\n...`
- 변경: `제목\n\n본문...\n🔗 쇼핑몰 링크`

### 변경 파일

| 파일 | 유형 | 설명 |
|-----|-----|-----|
| sourcing-app/src/modules/band-playwright/band-post.automation.ts | Modified | 발행 양식 상단 링크 제거, 하단으로 이동 |

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
- Flow-ID: Publish (소매밴드 발행)

---

## TR-20260112-006: 토스페이먼츠 거래 API 스키마 변경 (tossPay → transfer/virtualAccount)

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-12 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항

토스페이먼츠 거래 조회 API 응답 스키마를 개선하여 타입 안전성 강화:

**1. TossTransaction 인터페이스 정의**
- `any[]` 타입을 명시적인 `TossTransaction[]` 인터페이스로 변경
- db 패키지에 공통 타입 정의 추가

**2. 요약 데이터 스키마 변경**
- `tossPayAmount/tossPayCount` 제거
- `transferAmount/transferCount` 추가 (계좌이체)
- `virtualAccountAmount/virtualAccountCount` 추가 (가상계좌)

### 변경 파일

| 파일 | 유형 | 설명 |
|-----|-----|-----|
| db/src/types/toss-payments.types.ts | Added | TossTransaction 공통 타입 정의 |
| db/src/client.ts | Modified | 공통 타입 export 추가 |
| sourcing-app/src/app/(admin)/shop/settlement/list/page.tsx | Modified | TossTransaction 인터페이스 적용 |
| sourcing-app/src/app/api/settlement/toss-transactions/route.ts | Modified | 공통 타입 사용 |
| shop-app/src/modules/payments/services/toss-payments.service.ts | Modified | 공통 타입 사용 |

### 영향 분석

- [x] API Contract 변경 (응답 타입 구조 변경)
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
- Flow-ID: Settlement
- 문서 업데이트:
  - [docs/API.md](../API.md#get-apisettlementtoss-transactions): 거래 조회 API 응답 스키마 업데이트 (transfer/virtualAccount 필드)

---

## TR-20260112-005: 게시물 수집 날짜 선택 기능 제거 (오늘 날짜만 KST 기준)

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-12 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항

게시물 수집 모달에서 날짜 범위 선택 기능을 제거하고, 오늘 날짜(KST 기준) 게시물만 수집하도록 단순화:

**1. UI 변경**
- 날짜 선택(DatePicker) UI 제거
- "오늘 (KST 기준) 작성된 게시물만 표시됩니다" 안내 메시지로 대체

**2. API 단순화**
- 날짜 범위 파라미터(startDate, endDate) 제거
- 페이지네이션 로직(after 파라미터, MAX_PAGES) 제거
- `todayOnly=true` 파라미터만 사용

### 변경 파일

| 파일 | 유형 | 설명 |
|-----|-----|-----|
| sourcing-app/src/app/(admin)/sourcing/post/list/page.tsx | Modified | 날짜 선택 UI 제거, 안내 메시지 추가 |
| sourcing-app/src/app/api/post/available/route.ts | Modified | 날짜 범위 파라미터 제거, 페이지네이션 제거 |

### 영향 분석

- [x] API Contract 변경 (파라미터 제거)
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
- Flow-ID: Collection (게시물 수집)
- 문서 업데이트:
  - [docs/API.md](../API.md#get-apipostavailable): GET /api/post/available API 문서 추가

---

## TR-20260112-004: 매니저 관리 페이지 TypeScript 타입 오류 수정

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-12 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항

매니저 관리 페이지에서 TypeScript 타입 오류 수정:

**문제**
- `onClick={fetchUsers}` 에서 타입 불일치 오류
- `fetchUsers(overridePage?: number)` 함수에 `MouseEvent`가 전달됨

**해결**
- `onClick={() => fetchUsers()}` 로 변경하여 인자 없이 호출

### 변경 파일

| 파일 | 유형 | 설명 |
|-----|-----|-----|
| sourcing-app/src/app/(admin)/sourcing/user/list/page.tsx | Modified | onClick 핸들러 타입 수정 |

### 영향 분석

- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트

| 유형 | 상태 |
|-----|-----|
| TypeScript Build | Pass |

### 롤백 계획

1. git revert로 해당 커밋 롤백

### 관련 항목

- REQ-ID: -
- Flow-ID: -

---

## TR-20260112-003: 구글 시트 연동 기능 추가 (발주서 동기화)

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-12 |
| REQ-ID | - |
| Risk | Medium |

### 변경 사항

도매 발주서를 구글 시트로 동기화하는 기능 추가:

**1. 구글 시트 설정 페이지**
- `/sourcing/settings/google-sheets` 페이지 신규 생성
- Google Cloud 서비스 계정 JSON 파일 업로드
- 스프레드시트 URL/ID 입력
- 연결 테스트 기능
- 사용자별 설정 저장 (SaaS 모델 지원)

**2. 발주서 동기화**
- 발주서 페이지에 "구글시트" 버튼 추가
- 엑셀 내보내기와 동일한 양식/서식으로 구글 시트에 동기화
- 날짜별 그룹핑, 소계/총합계, 발주완료 행 구분

**3. 엑셀과 동일한 서식 적용**
- 글꼴: Calibri
- 타이틀: 16pt 굵게, 가운데 정렬, 셀 병합
- 타이틀 정보: 12pt
- 날짜 구분선: 파란색(#4472C4) 배경, 흰색 12pt 굵은 글씨, 셀 병합
- 헤더: 회색(#E0E0E0) 배경, 11pt 굵은 글씨, 가운데 정렬, 테두리
- 데이터 행: 11pt, 테두리
- 발주 완료 행: 진한 회색(#D0D0D0) 배경, 테두리
- 소계: 연파란색(#D9E1F2) 배경, 굵은 글씨, 테두리
- 총합계: 연노란색(#FFF0C0) 배경, 12pt 굵은 글씨, 테두리
- 숫자: 천단위 콤마 포맷

**4. API 신규 추가**
- `GET /api/settings/google-sheets` - 설정 조회
- `POST /api/settings/google-sheets` - 설정 저장
- `DELETE /api/settings/google-sheets` - 설정 삭제
- `POST /api/settings/google-sheets/test` - 연결 테스트
- `POST /api/admin/wholesale-orders/[id]/sync-sheets` - 동기화 실행

**5. DB 스키마**
- `GoogleSheetConfig` 모델 추가 (사용자별 구글 시트 설정 저장)

### 변경 파일

| 파일 | 유형 | 설명 |
|-----|-----|-----|
| db/prisma/models/user.prisma | Modified | GoogleSheetConfig 모델 추가 |
| sourcing-app/src/services/google-sheets.service.ts | Added | 구글 시트 동기화 서비스 |
| sourcing-app/src/app/api/settings/google-sheets/route.ts | Added | 설정 API (GET, POST, DELETE) |
| sourcing-app/src/app/api/settings/google-sheets/test/route.ts | Added | 연결 테스트 API |
| sourcing-app/src/app/api/admin/wholesale-orders/[wholesaleChannelId]/sync-sheets/route.ts | Added | 동기화 API |
| sourcing-app/src/app/(admin)/sourcing/settings/google-sheets/page.tsx | Added | 설정 UI 페이지 |
| sourcing-app/src/app/(admin)/shop/wholesale-orders/page.tsx | Modified | 구글시트 버튼 추가 |
| sourcing-app/src/modules/config/domain/src/settings/settings.repository.ts | Modified | GoogleSheetConfig 메서드 추가 |
| sourcing-app/src/modules/config/domain/src/settings/settings.service.ts | Modified | GoogleSheetConfig 서비스 메서드 추가 |
| sourcing-app/src/modules/config/domain/src/settings/settings.types.ts | Modified | GoogleSheetSettings 타입 추가 |

### 영향 분석

- [x] API Contract 변경 (신규 API 5개)
- [x] DB Schema 변경 (GoogleSheetConfig 모델)
- [x] Domain Logic 변경 (설정 서비스)
- [x] Security 변경 (서비스 계정 인증 정보 관리)

### 테스트

| 유형 | 상태 |
|-----|-----|
| Build | Pass |
| Manual | Pass |

### 롤백 계획

1. git revert로 해당 커밋 롤백
2. npx prisma db push로 GoogleSheetConfig 테이블 삭제

### 관련 항목

- REQ-ID: -
- Flow-ID: Wholesale Orders
- 문서 업데이트:
  - [docs/API.md](../API.md#google-sheets-api-tr-20260112-003): Google Sheets API 문서 추가
  - [docs/DATABASE.md](../DATABASE.md#2026-01-12-googlesheetconfig-모델-추가): GoogleSheetConfig 모델 문서 추가

---

## TR-20260112-002: 정산 페이지에 결제 상태 구분 및 토스페이먼츠 현황 추가

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-12 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항

정산 페이지에 결제 상태 구분 기능과 토스페이먼츠 거래 현황 대시보드를 추가:

**1. 결제 상태 구분 표시**
- 카드 결제: "결제완료" (초록색)
- 가상계좌 입금대기: "결제대기" (노란색)
- 가상계좌 입금완료: "계좌입금완료" (초록색)
- 기타/알 수 없음: "확인필요" (회색)

**2. 토스페이먼츠 거래 현황 대시보드**
- 해당 월의 총 거래 금액/건수
- 카드 결제 금액/건수
- 취소 금액/건수
- 토스페이먼츠 API에서 실시간 조회

**3. API 변경**
- `/api/settlement` 응답에 `paymentMethod`, `paymentStatus` 필드 추가
- `/api/settlement/toss-transactions` 신규 엔드포인트 추가

### 변경 파일

| 파일 | 유형 | 설명 |
|-----|-----|-----|
| sourcing-app/src/app/(admin)/shop/settlement/list/page.tsx | Modified | 결제 상태 컬럼 추가, 토스페이먼츠 현황 섹션 추가 |
| sourcing-app/src/app/api/settlement/route.ts | Modified | 응답에 payment 정보 포함 |
| sourcing-app/src/app/api/settlement/toss-transactions/route.ts | Added | 토스페이먼츠 거래 조회 API |
| shop-app/src/modules/payments/services/toss-payments.service.ts | Modified | fetchTransactions, getTransactions 메서드 추가 |

### 영향 분석

- [x] API Contract 변경 (settlement API 응답 필드 추가, 신규 API)
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
- Flow-ID: Settlement
- 문서 업데이트:
  - [docs/API.md](../API.md#get-apisettlementtoss-transactions): 토스페이먼츠 거래 조회 API 문서 추가

---

## TR-20260112-001: 사용자 관리 메뉴를 매니저/회원으로 분리

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-12 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항

기존 `/shop/user/list` 페이지를 역할별로 분리:
- `/sourcing/user/list` - 매니저 관리 (MANAGER 역할만 조회)
- `/shop/user/list` - 회원 관리 (USER 역할만 조회)

**주요 변경:**
- 소싱 앱 사이드바에 "매니저 관리" 메뉴 추가
- 쇼핑몰 탭 "사용자 관리" → "회원 관리"로 명칭 변경
- 각 페이지에서 해당 역할만 필터링하여 표시
- 매니저 상세 페이지 신규 생성

### 변경 파일

| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/config/navigation.ts | Modified | 매니저 관리 메뉴 추가, 회원 관리 명칭 변경 |
| src/app/(admin)/sourcing/user/list/page.tsx | Added | 매니저 목록 페이지 |
| src/app/(admin)/sourcing/user/detail/[id]/page.tsx | Added | 매니저 상세 페이지 |
| src/app/(admin)/shop/user/list/page.tsx | Modified | USER 역할만 조회하도록 변경 |

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
- Flow-ID: User Management

---

## TR-20260109-002: ShopProduct/ChannelProduct upsert로 Soft Delete 레코드 복원 지원

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-09 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항

CodeRabbit 리뷰 피드백 반영. `findFirst` + `create` 패턴을 `upsert`로 변경하여 soft-deleted 레코드 복원 지원.

**문제점**:
- 기존 `findFirst` + `create` 로직은 soft-deleted 레코드를 놓침
- `(productId, channelId)` 또는 `(productId, shopId)` unique constraint로 인해 soft-deleted 레코드가 있으면 create 시 에러 발생

**해결책**:
- `upsert`를 사용하여 원자적으로 처리
- soft-deleted 레코드가 있으면 `deletedAt: null`로 복원하고 `publishedAt` 갱신
- 레코드가 없으면 새로 생성

### 변경 파일

| 파일 | 유형 | 설명 |
|-----|-----|-----|
| sourcing-app/src/modules/publish/publish.service.ts | Modified | `publishToChannel`, `publishToShop`, `publishToChannelWithProgress` 메서드에 upsert 적용 |

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
- Flow-ID: Publish
- 참조 문서: [docs/DATABASE.md](../DATABASE.md#soft-delete-패턴)

---

## TR-20260109-001: ShopProduct/Shop Soft Delete 필터링 강화

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-09 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항

**1. ShopProduct 조회 쿼리에 `deletedAt: null` 조건 추가**

CodeRabbit 리뷰 피드백 반영. Soft Delete된 ShopProduct가 조회되지 않도록 모든 조회 쿼리에 필터링 조건 추가.

**2. Shop 삭제 핸들러 Soft Delete로 변경**

ShopProduct 모델의 FK 제약조건(`onDelete: Restrict`)으로 인해 Hard Delete 시 에러 발생 가능. `prisma.shop.delete()` 대신 `prisma.shop.update({ data: { deletedAt: new Date() } })` 사용으로 변경.

### 변경 파일

| 파일 | 유형 | 설명 |
|-----|-----|-----|
| sourcing-app/src/app/api/shop/publish/route.ts | Modified | ShopProduct 조회에 `deletedAt: null` 추가 |
| sourcing-app/src/modules/publish/publish.service.ts | Modified | 발행 여부 확인 시 `deletedAt: null` 추가 |
| sourcing-app/src/modules/catalog/domain/src/product/services/product.service.ts | Modified | 관련 ShopProduct 조회에 `deletedAt: null` 추가 |
| sourcing-app/src/app/api/order/unified/route.ts | Modified | 사용자 ShopProduct 조회에 `deletedAt: null` 추가 |
| sourcing-app/src/app/api/channel/stats/route.ts | Modified | Shop 발행 수 카운트에 `deletedAt: null` 추가 |
| sourcing-app/src/app/api/shop/[id]/route.ts | Modified | DELETE 핸들러 Soft Delete로 변경, 조회에 `deletedAt: null` 추가 |
| sourcing-app/src/app/api/shop/route.ts | Modified | DELETE 핸들러 Soft Delete로 변경, 조회에 `deletedAt: null` 추가 |

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
- Flow-ID: Publish, Shop Management
- 참조 문서: [docs/DATABASE.md](../DATABASE.md#soft-delete-패턴)

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
- 사용자 역할 라벨 변경
  - USER: '일반 사용자' → '회원'
  - MANAGER: '쇼핑몰 관리자' → '매니저'
- unauthorized 페이지에서 '관리자' 표현 통일

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(admin)/shop/user/list/page.tsx | Modified | roleLabels 변경 |
| src/app/(admin)/shop/user/detail/[id]/page.tsx | Modified | roleLabels 변경 |
| src/app/(auth)/unauthorized/page.tsx | Modified | 역할 표시 텍스트 변경 |

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

## TR-20260108-002: published_product → shop_product/channel_product 스키마 마이그레이션

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-08 |
| REQ-ID | - |
| Risk | Medium |

### 변경 사항

**1. 테이블 분리 (published_product → shop_product + channel_product)**
- `shop_product`: 쇼핑몰(Shop)에 발행된 상품 관리
- `channel_product`: 채널(Band 등)에 발행된 상품 관리
- 기존 `published_product` 데이터를 양쪽 테이블로 마이그레이션 후 테이블 삭제

**2. 워크플로우 추적 테이블 추가**
- `workflow_step_log` 테이블 신규 생성 (자동화 파이프라인 단계별 추적)
- `workflow_log.current_step` 컬럼 추가
- `StepType` enum 추가: COLLECTION, TRANSFORM, PRODUCT_CREATE, PUBLISH
- `StepStatus` enum 추가: PENDING, RUNNING, COMPLETED, FAILED, SKIPPED

**3. FK 참조 변경 (published_product 제거에 따른)**
- `cart_item.published_product_id` FK 삭제 → `cart_item.shop_product_id` FK로 대체
- `order_item.published_product_id` FK 삭제 → `order_item.shop_product_id` FK로 대체
- `guest_order_item.published_product_id` FK 삭제 → `guest_order_item.shop_product_id` FK로 대체
- `inquiry.published_product_id` FK 삭제 → `inquiry.shop_product_id` FK로 대체

### 영향받는 모델
| 모델 | 변경 내용 |
|-----|---------|
| ShopProduct | 신규 (published_product의 shop 발행 데이터 승계) |
| ChannelProduct | 신규 (published_product의 channel 발행 데이터 승계) |
| WorkflowStepLog | 신규 (파이프라인 단계별 추적) |
| WorkflowLog | current_step 컬럼 추가 |
| CartItem | FK: publishedProductId → shopProductId |
| OrderItem | FK: publishedProductId → shopProductId |
| GuestOrderItem | FK: publishedProductId → shopProductId |
| Inquiry | FK: publishedProductId → shopProductId |

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| db/prisma/models/publish.prisma | Modified | ShopProduct, ChannelProduct 모델로 변경 |
| db/prisma/models/workflow.prisma | Modified | WorkflowStepLog 모델 추가, WorkflowLog에 currentStep 추가 |
| db/prisma/models/cart.prisma | Modified | CartItem FK 변경 |
| db/prisma/models/order.prisma | Modified | OrderItem FK 변경 |
| db/prisma/models/inquiry.prisma | Modified | Inquiry FK 변경 |
| db/prisma/schema.prisma | Modified | StepType, StepStatus enum 추가 |
| db/prisma/migrations/20260108131455_remove_unused_columns/migration.sql | Added | CD 파이프라인용 마이그레이션 (orphaned 컬럼 정리 포함) |
| db/prisma/migrations/20260108131455_remove_unused_columns/rollback.sql | Added | 마이그레이션 롤백 스크립트 |

### 영향 분석
- [ ] API Contract 변경
- [x] DB Schema 변경
- [x] Domain Logic 변경
- [ ] Security 변경

### 도메인 로직 영향
- 장바구니(Cart): ShopProduct 참조로 변경
- 주문(Order): ShopProduct 참조로 변경
- 문의(Inquiry): ShopProduct 참조로 변경
- 발행(Publish): Shop/Channel 발행 분리 처리

### 테스트
| 유형 | 상태 |
|-----|-----|
| Prisma Generate | Pass |
| DB Push | Pass |
| Build | Pass |

### 롤백 계획
1. `rollback.sql` 스크립트 실행: `mysql -u [user] -p [database] < rollback.sql`
2. git revert로 해당 커밋 롤백
3. npx prisma db push로 이전 스키마 복원

### 관련 항목
- REQ-ID: -
- Flow-ID: Publish

---

## TR-20260108-001: AutomationConfig 테이블에서 pricing_policy_id 컬럼 및 관계 삭제

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-08 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- AutomationConfig 테이블에서 사용하지 않는 `pricing_policy_id` 컬럼 삭제
- PricingPolicy와의 외래키 관계 제거
- 자동화 설정에서 가격 정책은 별도로 관리하므로 불필요한 연결 정리

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| db/prisma/models/automation.prisma | Modified | pricingPolicyId 필드 및 pricingPolicy 관계 삭제 |

### 영향 분석
- [ ] API Contract 변경
- [x] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Prisma Generate | Pass |
| DB Push | Pass |

### 롤백 계획
1. git revert로 해당 커밋 롤백
2. npx prisma db push로 컬럼 복원

### 관련 항목
- REQ-ID: -
- Flow-ID: -
- Flow-ID: Publish, Cart, Order, Inquiry
- 참조 문서: [docs/DATABASE.md](../DATABASE.md)

---

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

---

## TR-20260115-007: 외부 주문 배송비 반영 및 결제금액 수동 조정

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-15 |
| REQ-ID | - |
| Risk | Medium |

### 변경 사항
- 외부 주문 생성 시 배송비를 포함한 판매가 계산 로직 구현
- 합배송 규칙 적용 (INCLUDED: 배송비 포함, SEPARATE: 1회만 부과)
- 결제금액 수동 입력 기능 추가 (할인/협의 가격 지원)
- 수동 금액 입력 시 할인액 자동 계산 (subtotal - customTotalAmount)

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/services/order.service.ts | Modified | 배송비 포함 판매가 계산, customTotalAmount 지원 |
| src/app/api/order/external/route.ts | Modified | customTotalAmount 파라미터 추가 및 검증 |
| src/app/(admin)/shop/order/external/new/page.tsx | Modified | 결제금액 수동 입력 UI 추가 |
| src/lib/price-calculator.ts | Referenced | calculateSellingPrice 함수 사용 |

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
| Integration | Manual |

### 롤백 계획
1. git revert 2777d5df

### 관련 항목
- REQ-ID: -
- Flow-ID: 외부 주문 생성

---

## TR-20260115-008: 대시보드 마진액 계산 오류 수정

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-15 |
| REQ-ID | - |
| Risk | High |

### 변경 사항
- 배송비포함(INCLUDED) 상품의 배송비를 중복으로 차감하던 버그 수정
- 소매가에 이미 배송비가 포함된 경우 별도 배송비 계산 제외
- 정확한 마진 계산 공식 적용
  - INCLUDED: 마진 = (소매가 - 도매가) - 0
  - SEPARATE: 마진 = (소매가 - 도매가) - 배송비 (1회)
  - NONE: 마진 = (소매가 - 도매가) - (배송비 × 아이템 수)

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/api/dashboard/shop/route.ts | Modified | 배송비 계산 로직 수정 (INCLUDED 타입 처리) |

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
| Manual | Pass |

### 롤백 계획
1. git revert 34683e35

### 관련 항목
- REQ-ID: -
- Flow-ID: 대시보드 통계

---

## TR-20260115-009: 도매 주문 이력에 PREPARING 상태 포함

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-15 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 발주 완료(발주 확정) 처리된 주문의 상태가 PREPARING으로 변경됨
- 도매 주문 이력 조회 시 PREPARING 상태도 포함하도록 수정
- 상태 필터: PREPARING, SHIPPED, DELIVERED

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/api/admin/wholesale-orders/history/route.ts | Modified | PREPARING 상태 포함 |
| src/app/api/admin/wholesale-orders/summary/route.ts | Modified | PREPARING 상태 포함 |
| src/app/api/admin/wholesale-orders/[wholesaleChannelId]/items/route.ts | Modified | PREPARING 상태 포함 |
| src/app/(admin)/shop/wholesale-orders/page.tsx | Modified | 상태 필터 개선 |

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
1. git revert e6c2d199

### 관련 항목
- REQ-ID: -
- Flow-ID: 도매 주문 관리

---

## TR-20260115-010: 외부 주문 수정 및 삭제 기능 추가

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-15 |
| REQ-ID | - |
| Risk | Medium |

### 변경 사항
- 주문 목록 페이지에서 외부 주문(주문번호 'X'로 시작) 수정/삭제 버튼 추가
- 외부 주문 판별 로직 구현 (주문번호 소문자 'x'로 시작)
- 삭제 확인 모달 추가
- 주문 상세 페이지에서 외부 주문 정보 표시 개선

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(admin)/shop/order/list/page.tsx | Modified | 외부 주문 수정/삭제 UI 추가 |
| src/app/(admin)/shop/order/detail/[id]/page.tsx | Modified | 외부 주문 정보 표시 개선 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Lint | Pass |
| Build | Pass |
| Integration | N/A |

### 롤백 계획
1. git revert bc5bf000

### 관련 항목
- REQ-ID: -
- Flow-ID: 주문 관리

---

## TR-20260115-011: 외부 주문 CRUD API 및 수정 페이지 구현

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-15 |
| REQ-ID | - |
| Risk | Medium |

### 변경 사항
- 외부 주문 전체 생명주기 관리 API 구현
- GET /api/order/external/[orderNumber] - 주문번호로 상세 조회
- GET /api/order/external/guest/[id] - 비회원 주문 상세 조회
- GET /api/order/external/member/[id] - 회원 주문 상세 조회
- DELETE /api/order/external/guest/[id] - 비회원 주문 삭제 (Soft Delete)
- DELETE /api/order/external/member/[id] - 회원 주문 삭제 (Soft Delete)
- 외부 주문 수정 페이지: /shop/order/external/edit/[orderNumber]

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/api/order/external/[orderNumber]/route.ts | Added | 주문번호로 조회 API |
| src/app/api/order/external/guest/[id]/route.ts | Added | 비회원 주문 조회/삭제 API |
| src/app/api/order/external/member/[id]/route.ts | Added | 회원 주문 조회/삭제 API |
| src/app/(admin)/shop/order/external/edit/[orderNumber]/page.tsx | Added | 외부 주문 수정 페이지 |

### 영향 분석
- [x] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Lint | Pass |
| Build | Pass |
| Integration | N/A |

### 롤백 계획
1. git revert a7a03d9c
2. 추가된 파일 삭제

### 관련 항목
- REQ-ID: -
- Flow-ID: 외부 주문 관리

---

## TR-20260115-012: 구글 시트 연동 해제 확인 모달 추가

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-15 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 구글 시트 연동 설정 삭제 시 confirm() 대신 모달 UI 사용
- 삭제 불가 안내 메시지 추가
- 취소/삭제 버튼 제공

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(admin)/sourcing/settings/google-sheets/page.tsx | Modified | 삭제 확인 모달 추가 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Lint | Pass |
| Build | Pass |
| Integration | N/A |

### 롤백 계획
1. git revert 918a3d3d

### 관련 항목
- REQ-ID: -
- Flow-ID: 구글 시트 연동

---

## TR-20260121-005: 소싱 섹션 현황 카드 sm 브레이크포인트 추가

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-21 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- notification 페이지: `grid-cols-1 md:grid-cols-5` → `grid-cols-2 sm:grid-cols-3 md:grid-cols-5`
- user/list 페이지: `grid-cols-1 md:grid-cols-3` → `grid-cols-2 sm:grid-cols-3 md:grid-cols-3`
- post/list 페이지: `grid-cols-1 md:grid-cols-4` → `grid-cols-2 sm:grid-cols-2 md:grid-cols-4`
- collected-product/list 페이지: `grid-cols-1 md:grid-cols-4` → `grid-cols-2 sm:grid-cols-2 md:grid-cols-4`
- 모든 현황 카드에 반응형 스타일 적용 (패딩, 간격, 아이콘 크기, 텍스트 크기)

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(admin)/sourcing/notification/page.tsx | Modified | 알림 현황 카드 sm 브레이크포인트 추가 |
| src/app/(admin)/sourcing/user/list/page.tsx | Modified | 매니저 현황 카드 sm 브레이크포인트 추가 |
| src/app/(admin)/sourcing/post/list/page.tsx | Modified | 게시물 현황/액션 카드 sm 브레이크포인트 추가 |
| src/app/(admin)/sourcing/collected-product/list/page.tsx | Modified | 수집 상품 현황/액션 카드 sm 브레이크포인트 추가 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Lint | Pass |
| Build | Pass |
| Integration | N/A |

### 롤백 계획
1. git revert {commit-hash}

### 관련 항목
- REQ-ID: -
- Flow-ID: 소싱 UI

---

## TR-20260121-006: 소싱 대시보드 수동 실행 버튼 모바일 개선

| 항목 | 값 |
|-----|---|
| Status | Done |
| Author | Claude |
| Date | 2026-01-21 |
| REQ-ID | - |
| Risk | Low |

### 변경 사항
- 5개 수동 실행 버튼 모바일 반응형 개선 (게시물 수집, AI 변환, 상품 등록, 발행, 전체 실행)
- 패딩: `p-4` → `p-3 sm:p-4`
- 아이콘 컨테이너: `w-10 h-10` → `w-8 h-8 sm:w-10 sm:h-10`
- 아이콘 마진: `mb-3` → `mb-2 sm:mb-3`
- 아이콘 크기: `size={20}` → `size={18} className="sm:w-5 sm:h-5"`
- 제목 텍스트: `text-sm` → `text-xs sm:text-sm`
- 설명 텍스트: `text-xs mt-1` → `text-[10px] sm:text-xs mt-0.5 sm:mt-1`

### 변경 파일
| 파일 | 유형 | 설명 |
|-----|-----|-----|
| src/app/(admin)/sourcing/dashboard/page.tsx | Modified | 수동 실행 버튼 5개 모바일 반응형 적용 |

### 영향 분석
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] Domain Logic 변경
- [ ] Security 변경

### 테스트
| 유형 | 상태 |
|-----|-----|
| Lint | Pass |
| Build | Pass |
| Integration | N/A |

### 롤백 계획
1. git revert {commit-hash}

### 관련 항목
- REQ-ID: -
- Flow-ID: 소싱 대시보드

---

## TR-20260424-001 — 종합발행 콜라주(Collage) 모드 추가

| 항목 | 값 |
|-----|-----|
| Status | Done |
| Date | 2026-04-24 |
| REQ-ID | - (작업지시서: `작업지시서_종합발행_콜라주모드.md`) |
| Risk | Medium |
| Author | Claude |

### 요약
- `/sourcing/publish/digest`에 콜라주 모드 추가: N×M(기본 3×4=12) 상품을 배경 제거된 상품 이미지 + 스펙 + 상품명 + 가격으로 합성한 포스터 PNG 1장으로 발행.
- 본문은 쇼핑몰 카테고리 링크 1줄만 포함. 상품별 링크는 표시하지 않음.
- 할인율은 표시하지 않음 (작업지시서 절대 준수 규칙).
- 옵션 있는 상품은 첫 번째 variant 가격만 사용 (min/max 범위 금지).

### 구현 파일
- 신규
  - `sourcing-app/src/modules/publish/digest-collage-renderer.ts` — 콜라주 렌더러 + `extractSpec()` (variant→description→name 3단 폴백)
  - `sourcing-app/src/app/(admin)/sourcing/publish/digest/_components/DigestSettingsPanel.tsx` — 발행조건 설정 패널
  - `shop-app/src/app/(shop)/category/[code]/page.tsx` + `CategoryClient.tsx` — 쇼핑몰 카테고리 페이지
  - `shop-app/src/lib/categories.ts` — shop-app 독립 카테고리 상수 (앱 간 모듈 격리)
- 수정
  - `sourcing-app/src/app/api/publish/digest/route.ts` — `publishMode='collage'` 분기 추가
  - `sourcing-app/src/app/(admin)/sourcing/publish/digest/page.tsx` — 패널 통합, payload 확장
  - `sourcing-app/src/app/(admin)/sourcing/publish/digest/_components/DigestPublishBar.tsx` — collage 모드 옵션 + 검증
  - `sourcing-app/package.json` — `@imgly/background-removal-node@^1.4.5` 추가
  - `sourcing-app/next.config.js` — serverComponentsExternalPackages에 imgly/onnxruntime-node/sharp 추가
  - `docker/Dockerfile.sourcing` — 모델 사전 다운로드 + runner 단계 패키지 설치

### 핵심 동작
1. UI에서 `🖼️ 콜라주` 모드 선택 + 정확히 N개 상품 체크
2. POST `/api/publish/digest` (publishMode=collage, collageOptions={gridCols,gridRows,removeBackground,title,topBadgeText})
3. 서버: `renderCollagePoster()` 호출 — 각 이미지에 `@imgly/background-removal-node` 적용 (실패 시 원본 폴백)
4. Playwright chromium으로 1200×N HTML→PNG 합성
5. `bandPlaywrightService.publishWithImages()`로 포스터 1장 + 카테고리 링크 본문 발행
6. 성공 시 `Product.lastDigestPublishedAt` 갱신

### 영향도
- [ ] DB 변경 없음
- [ ] API 변경: POST `/api/publish/digest` body에 `publishMode='collage'`, `collageOptions` 추가 (기존 호출 호환)
- [ ] 기존 digest/individual/both/incremental 모드 미변경
- [ ] shop-app 신규 라우트: `/{subdomain}/category/{code}` (404 처리 포함)

### 테스트
| 유형 | 상태 |
|-----|-----|
| Lint | Pass |
| Typecheck | Pass (sourcing-app, shop-app) |
| Build | 미수행 (CI/CD에서 검증) |
| Integration | 운영 배포 후 실제 발행 1건 검증 필요 |

### 롤백 계획
1. `git revert {commit-hash}` (커밋 6개 일괄 되돌리기)
2. `pnpm install` 재실행 (Dockerfile 변경분도 롤백)

### 관련 항목
- 작업지시서: `C:\Users\kims3\SNS_AUTO\작업지시서_종합발행_콜라주모드.md`
- Flow: 종합 발행 → 콜라주 모드

---

## TR-20260424-002 — 카카오톡 광고 자동 생성 + 신규 광고 페이지 + 메뉴 재편

| 항목 | 값 |
|-----|-----|
| Status | Done |
| Date | 2026-04-24 |
| REQ-ID | - (작업지시서: `작업지시서_카카오톡광고_자동생성.md`) |
| Risk | Large |
| Author | Claude |

### 요약
- 사이드바 메뉴 "소싱" → **"상품및광고"** 로 재편, 신규 하위 메뉴 "광고" 추가
- 신규 페이지 `/sourcing/publish/ad` (광고) — 2탭 구조
  - 탭 1: 🖼️ 콜라주 발행 (기존 종합발행의 콜라주 모드를 단일 모드 전용 UI로 분리 노출. 동일 API 사용)
  - 탭 2: 📱 카톡 광고 발행 (신규)
- 카톡 광고: 1~10개(권장 6개) 상품 → AI(Claude Haiku)가 카드별 카피 자동 생성 → 720×1280 PNG 카드 → ZIP 다운로드
- 종합발행 페이지(`/sourcing/publish/digest`)는 그대로 유지 (콜라주 모드 포함)

### 신규 파일
- DB
  - `db/prisma/models/kakao-ad.prisma` — `KakaoAdCard`, `KakaoAdBatch`, `KakaoSendStatus` enum
- 모듈 (`sourcing-app/src/modules/ad-composer/`)
  - `ad-content-generator.ts` — Claude 호출 4종(title/subtitle/desc/banner) + 카테고리→색상 규칙 + 리본 정규식
  - `ad-card-renderer.ts` — Playwright 720×1280 PNG 합성 (배치 모드 포함)
  - `templates/kakao-ad-card.html.ts` — 3D 윤곽선 타이틀 + 회색 서브박스 + 옵션 리본/배지/배너
  - `prompts/{title,subtitle,description,banner}.prompt.ts` — Haiku 프롬프트
- API (`sourcing-app/src/app/api/ad/kakao/`)
  - `generate/route.ts` — POST: 카드 N개 AI 생성 + DB upsert + PNG 합성
  - `card/[id]/route.ts` — GET 조회, PATCH 편집(저장 시 즉시 재합성)
  - `preview/[id]/route.ts` — GET PNG 스트림 (결측 시 즉석 재합성)
  - `send/route.ts` — POST ZIP 다운로드 (Phase 1)
  - `batches/route.ts` — GET 최근 배치 이력
- UI (`sourcing-app/src/app/(admin)/sourcing/publish/ad/`)
  - `page.tsx` — 2탭 컨테이너
  - `_components/CollageTab.tsx` — 콜라주 탭 (DigestSettingsPanel 재사용)
  - `_components/KakaoAdTab.tsx` — 카톡 광고 탭 (옵션 패널 + 생성 버튼)
  - `_components/KakaoAdPreviewModal.tsx` — 미리보기 그리드 + 인라인 편집 + ZIP 다운로드
  - `_hooks/useAdProducts.ts` — 카테고리/날짜 필터 + 상품 로드 공유 훅

### 수정 파일
- `sourcing-app/src/config/navigation.ts`
  - 부모 메뉴 "소싱" → "상품및광고"
  - 자식 메뉴에 "광고" (`/sourcing/publish/ad`, Megaphone 아이콘) 추가
- `db/prisma/models/user.prisma` — `kakaoAdCards`, `kakaoAdBatches` 역관계 추가
- `db/prisma/models/product.prisma` — `kakaoAdCards` 역관계 추가

### AI 동작 (Claude Haiku, claude-haiku-4-5-20251001)
- 카드당 4 호출(title/subtitle/desc/banner) 병렬 실행, subtitle은 title 의존성으로 순차
- 동시성 3 → rate limit 회피
- 실패 시 폴백: 상품명/원본설명을 그대로 사용 → `aiGenerated=false` 표시
- 타이틀 색상 매핑(코드 상수): SEA=blue, AGR/MEA/MKT/PRC/COM/ETC=red, HLT=green
- 리본 정규식 감지: "국내산"/"유기농"/"친환경"

### 동작 플로우
1. `/sourcing/publish/ad` 접속 → 카톡 광고 탭
2. 카테고리/날짜 필터 → 상품 1~10개 선택
3. 옵션(타이틀 색상, 강조 배너) → "🎨 광고 카드 생성"
4. POST `/api/ad/kakao/generate` → AI 생성 + DB(KakaoAdCard, KakaoAdBatch) + PNG 합성
5. 미리보기 모달: 카드 그리드 + 클릭 시 인라인 편집 (PATCH 시 즉시 재합성)
6. "📦 ZIP 다운로드" → 카카오톡 채널에 수동 첨부

### 영향도
- DB 변경: `kakao_ad_card`, `kakao_ad_batch` 테이블 신설 (배포 시 `prisma db push` 자동 실행됨)
- API 신규: `/api/ad/kakao/*` 5개
- 라우트 신규: `/sourcing/publish/ad`
- 사이드바 라벨 변경: "소싱" → "상품및광고"
- 기존 `/sourcing/publish/digest` 무영향

### 의존성
- 기존 `@anthropic-ai/sdk` 재사용 (Claude 클라이언트)
- 기존 `archiver` 재사용 (ZIP)
- 기존 `playwright` 재사용 (HTML→PNG)

### 비용 (Claude Haiku)
- 카드당 ~2000 토큰 → 6장 ≈ $0.015
- 일 1회 사용 시 월 ≈ $0.45

### 테스트
| 유형 | 상태 |
|-----|-----|
| Lint | Pass |
| Typecheck | Pass (sourcing-app, shop-app) |
| Build | 미수행 (CI/CD에서 검증) |
| Integration | 운영 배포 후 실제 1배치 생성 + ZIP 다운로드 검증 필요 |

### Phase 2 (후속)
- 카카오톡 채널 비즈메시지 API 직접 발송
- KakaoAdAgent (매일 08:30 자동 Draft 생성)
- 발송 이력 탭 UI

### 관련 항목
- 작업지시서: `C:\Users\kims3\SNS_AUTO\작업지시서_카카오톡광고_자동생성.md`
- Flow: 광고 → 카톡 광고 자동 생성

