# BandAuto SaaS 전환 로드맵

> 출처: `BandAuto_SaaS_종합계획서.docx` (2026-04-28)
> 상태 추적: 각 항목 ✅ 완료 / 🚧 진행 / ⬜ 미착수 표시

---

## 전체 일정 (20주)

| Phase | 기간 | 목표 | 상태 |
|---|---|---|---|
| Phase 0 — 기반 구축 | 4주 | 멀티테넌시·요금제·새 UI 프레임 | 🚧 부분 진행 |
| Phase 1 — 핵심 SaaS화 | 6주 | 소싱·상품·주문 센터 UI 재설계 | ⬜ |
| Phase 2 — 쇼핑몰·마케팅 | 6주 | 테마·HubLink·알림톡·통합 인박스 | ⬜ |
| Phase 3 — 정산·분석·EE | 4주 | 정산 자동화·분석·팀·API Key | ⬜ |

---

## Phase 0: 기반 구축 (4주)

### DB 스키마

| # | 항목 | 파일 | 상태 |
|---|---|---|---|
| 0.1 | SubscriptionPlan 모델 | `db/prisma/models/subscription.prisma` | ✅ 추가 (db push 필요) |
| 0.2 | UserSubscription 모델 | 〃 | ✅ 추가 |
| 0.3 | UsageLog 모델 (일별 카운터) | 〃 | ✅ 추가 |
| 0.4 | User.subscriptionPlanId FK | `db/prisma/models/user.prisma` | ✅ subscription/usageLogs 백릴레이션 |
| 0.5 | AuditLog 모델 | (신규) | ⬜ |
| 0.6 | Shop.customDomain / themePreset / logoUrl | `db/prisma/models/shop.prisma` | ⬜ |
| 0.7 | Order.source (SHOP/BAND/HUBLINK/EXTERNAL) | `db/prisma/models/order.prisma` | ⬜ |
| 0.8 | Product.stockQuantity / lowStockThreshold | `db/prisma/models/product.prisma` | ⬜ |
| 0.9 | PurchaseOrderItem.receivedQty | `db/prisma/models/purchase-order.prisma` (사용자 WIP) | ⬜ |
| 0.10 | TeamMember 모델 | (신규) | ⬜ |
| 0.11 | ApiKey 모델 | (신규) | ⬜ |
| 0.12 | NotificationTemplate 모델 | (신규) | ⬜ |
| 0.13 | PurchaseOrderTemplate 모델 | (신규) | ⬜ |

### 미들웨어/유틸

| # | 항목 | 파일 | 상태 |
|---|---|---|---|
| 0.14 | feature-gate (요금제 한도 체크) | `sourcing-app/src/lib/feature-gate.ts` | ✅ |
| 0.15 | tenant (멀티테넌시 헬퍼) | `sourcing-app/src/lib/tenant.ts` | ✅ |
| 0.16 | Prisma 미들웨어 (자동 userId 필터) | `db/src/middleware/tenant.middleware.ts` (신규) | ⬜ |
| 0.17 | 사용량 카운터 자동 갱신 (incrementUsage 통합) | 각 API endpoint | ⬜ |

### UI

| # | 항목 | 파일 | 상태 |
|---|---|---|---|
| 0.18 | 새 SaaS 레이아웃 (사이드바·헤더·콘텐츠) | `components/layout/SaaSLayout.tsx` (신규) | ⬜ |
| 0.19 | 온보딩 마법사 (가입→채널→정책→소싱) | `OnboardingWizard.tsx` (신규) | ⬜ |
| 0.20 | 새 대시보드 홈 (KPI·파이프라인·할일) | `SaaSDashboard.tsx` (신규) | ⬜ |

---

## Phase 1: 핵심 SaaS화 (6주)

| # | 항목 | 파일 | 상태 |
|---|---|---|---|
| 1.1 | 소싱 센터 통합 (탭 네비) | `SourcingCenter.tsx` (신규) | ⬜ |
| 1.2 | 상품 관리 재설계 (목록·일괄수정·재고) | `ProductManager.tsx` (신규) | 🚧 부분 (`/shop/products/list` 개선) |
| 1.3 | 주문 센터 통합 (모든 주문 + 발주 + 배송) | `OrderCenter.tsx` (신규) | ⬜ |
| 1.4 | 발주서 양식 템플릿 시스템 | `PurchaseOrderTemplate.tsx` (신규) | ⬜ |
| 1.5 | 밴드 댓글 주문 자동 파싱 | `band-playwright/CommentOrderParser.ts` | ⬜ |
| 1.6 | 채널 가격 제한 필드 (Phase 1 체크리스트) | `Channel.minSourcingPrice/maxSourcingPrice` | ✅ 완료 (`36723fc`) |

---

## Phase 2: 쇼핑몰·마케팅 (6주)

| # | 항목 | 파일 | 상태 |
|---|---|---|---|
| 2.1 | 쇼핑몰 테마 시스템 (5+ 프리셋 + 커스텀) | `ThemeEditor.tsx` (신규) | ⬜ |
| 2.2 | HubLink 마이샵 연동 API | `/api/hublink/*` (신규) | ⬜ |
| 2.3 | 카카오 알림톡 연동 (주문/배송) | `notification/kakao-alimtalk.service.ts` | ⬜ |
| 2.4 | 마케팅 대시보드 (광고·쿠폰·다이제스트) | `MarketingHub.tsx` (신규) | ⬜ |
| 2.5 | 고객 통합 인박스 | `UnifiedInbox.tsx` (신규) | ⬜ |
| 2.6 | 결제 수단 확장 (카카오페이/네이버페이) | `payments` 모듈 | ⬜ |

---

## Phase 3: 정산·분석·엔터프라이즈 (4주)

| # | 항목 | 파일 | 상태 |
|---|---|---|---|
| 3.1 | 정산 자동화 + 리포트 PDF/엑셀 | `SettlementReport.tsx` (신규) | ⬜ |
| 3.2 | 분석 대시보드 (다차원) | `AnalyticsDashboard.tsx` (신규) | ⬜ |
| 3.3 | 팀 관리 (Owner/Manager/Staff RBAC) | `TeamManager.tsx` (신규) | ⬜ |
| 3.4 | API Key 발급 (Enterprise) | `auth/api-key.service.ts` | ⬜ |
| 3.5 | 플랫폼 어드민 (테넌트 모니터링) | `PlatformAdmin.tsx` (신규) | ⬜ |
| 3.6 | 세금계산서 연동 조사 (홈택스 API) | 기술 스펙 문서 | ⬜ |

---

## 요금제 정의 (계획서 1.4 참조)

| 요금제 | 월 요금 | 채널 | AI 가공 | 자동 발행 | 다중 쇼핑몰 | 광고 표시 |
|---|---|---|---|---|---|---|
| Free | ₩0 | 1개 | 50건/월 | ❌ | ❌ | 표시됨 |
| Starter | ₩29,000 | 3개 | 500건/월 | 스케줄 | ❌ | 제거됨 |
| Pro | ₩79,000 | 10개 | 무제한 | 풀 자동화 | ✅ | 제거됨 |
| Enterprise | 협의 | 무제한 | 무제한 | 풀 + API | ✅ | 화이트라벨 |

`SubscriptionPlan` 시드는 별도 작업 — `POST /api/admin/subscription/seed-plans` (미구현).

---

## 적용 순서 권장

1. **DB 스키마 마이그레이션** — `cd db && npx prisma db push --schema prisma`
   (Subscription/Usage 테이블 생성. User 백릴레이션 반영)
2. **요금제 시드** — 4 요금제 (Free/Starter/Pro/Enterprise) DB 등록 endpoint 추가
3. **feature-gate / tenant 모듈 호출 적용** — 한도 큰 endpoint 부터 단계적
   - `/api/product/ai-generate` 에 `getFeatureGate(userId).isWithinLimit('aiCallsPerMonth', 1, currentMonthly)` 가드 추가
   - `/api/automation/execute` 에 autoPublish 기능 게이트
4. **UI 재설계는 별도 디자인 검토 후 단계적 진행** — Phase 1 부터

---

## 코드 재사용률 (계획서 Part 10)

전체 약 **85~90% 재사용**. UI 컴포넌트만 새로 만들고 비즈니스 로직과 API 는 대부분 그대로 사용.

| 모듈 | 재사용률 | 변경 내용 |
|---|---|---|
| auth | 90% | OAuth 추가, 구독 연결 |
| sourcing (channel/post) | 95% | 가격 필터 추가 (✅) |
| automation | 95% | 테넌트 필터만 |
| transformation (AI) | 100% | 변경 없음 |
| publish | 90% | HubLink 발행 추가 |
| order | 85% | 출처 추적 + 댓글 주문 파싱 |
| payment | 80% | PG 추가 (카카오/네이버) |
| settlement | 85% | 리포트 엔진 |
| cs/inquiry | 90% | 통합 인박스 |
| ad-composer | 100% | 변경 없음 |
| agents | 90% | 테넌트 컨텍스트 |
| admin | 60% | 플랫폼 어드민 분리 |
| shop-app 전체 | 75% | 테마/도메인/HubLink |

---

## 의사결정 필요 항목 (운영자 검토 후)

- Postgres 전환 (Row Level Security 활용 가능, 현재 MariaDB) — Phase 0
- ECS Fargate 이전 (현재 EC2) — Phase 2~3
- BullMQ 업그레이드 (현재 Bull 4.16) — Phase 0
- Sentry/Datadog 도입 — Phase 0~1
- Toss 정기결제 (구독 PG) — Phase 0~1

---

## 다음 액션 (즉시)

1. ⏳ `prisma db push` 로 SubscriptionPlan / UserSubscription / UsageLog 테이블 생성
2. ⏳ 요금제 4종 (Free/Starter/Pro/Enterprise) 시드 endpoint 추가
3. ⏳ `/api/product/ai-generate` 에 feature-gate 호출 — 월 한도 초과 시 거절

이후는 매니저/디자이너 리뷰 후 Phase 1 UI 재설계 착수.
