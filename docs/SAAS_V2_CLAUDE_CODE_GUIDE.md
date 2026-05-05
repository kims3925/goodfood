# SaaS v2 — Claude Code 개발 지침서 (잔여 78%)

> **이 문서의 역할**: v2 마이그레이션의 **실행 절차 가이드**.
> 무엇을·어떤 순서로·어떻게 Claude Code 세션에서 진행할지의 손에 잡히는 매뉴얼.
>
> **다른 문서와의 분담**:
> - `SAAS_ROADMAP.md` — 20주 큰 그림
> - `SAAS_V2_MIGRATION.md` — 트래커 (어디까지 됐나)
> - `SAAS_V2_DECISIONS.md` — 자율 판단 기록 (왜 이렇게)
> - `BandAuto_SaaS_매니저패널_마이그레이션_개발계획서_v2.docx` — 11주 마스터 플랜
> - **본 문서** — 위 4개를 코드로 옮기는 단계별 실행 가이드
>
> 작성: 2026-04-29 / 기준 진행도: ~22% (P0 거의 완료, P0.5 일부, P1.1 1/7, P2 1/4)

---

## 0. 이 가이드를 사용하는 법

각 프로세스(P1.2 등)는 **하나의 Claude Code 세션 = 하나의 PR** 단위로 설계되어 있습니다.

```
[프로세스 시작]
  ↓
1) 사전조건 체크 (운영 안정 + 선행 PR 머지)
  ↓
2) 브랜치 생성 (이름 규칙: feat/saas-v2-pX-yyy)
  ↓
3) 본 가이드의 "Claude Code 프롬프트" 를 복사하여 새 세션 시작
  ↓
4) Claude 가 작업 → 검증 명령 실행 → 빌드 통과
  ↓
5) commit + PR 생성 → 리뷰 → 머지
  ↓
6) `SAAS_V2_MIGRATION.md` 트래커 업데이트
  ↓
[다음 프로세스]
```

---

## 1. 작업 시작 전 — 매번 확인할 5가지

### 1.1 운영 안정성 (PASS/HOLD)

다음 중 하나라도 해당되면 **v2 작업 보류**, 운영 안정화 우선:

- [ ] 자동발행 cron 이 실패 또는 stuck 인 워크플로우가 있다
- [ ] `agent_definitions` 가 비어있다 (또는 product-manager 가 status≠ACTIVE)
- [ ] 어제~오늘 운영 hotfix 가 main 에 푸시됐고 24시간 이상 무사고 검증이 안 됐다
- [ ] 백로그 (>7일 미삭제 ChannelProduct) 가 1,000건 이상 증가 추세다

**점검 명령** (SSM 또는 admin diagnose API):
```bash
# Diagnose API
GET /api/admin/automation/diagnose
GET /api/admin/band-deletion/status

# 또는 SSM 으로 직접 SQL
docker compose exec mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" sourcing_db -e "
  SELECT COUNT(*) as running FROM workflow_log WHERE status='RUNNING';
  SELECT COUNT(*) as agents FROM agent_definitions WHERE status='ACTIVE';
"
```

### 1.2 선행 PR 머지 확인

각 프로세스의 "사전조건" 섹션에 적힌 PR 들이 main 에 머지 완료된 상태인지 확인.

### 1.3 브랜치 stack 정리

stacked PR 7개가 `feat/saas-v2-prep → p0 → p05 → p1 → p2-retail-bands → p1-order-v2` 로 쌓여 있는 게 출발점.
**가장 먼저 할 일은 이 stack 을 main 에 순차 머지하는 것**(아래 "Stage A: 기존 stack 머지" 참조).

### 1.4 환경 준비

```bash
cd code
git checkout main
git pull --ff-only origin main
pnpm install  # 의존성 동기화
npm run typecheck   # 타입 베이스라인 (실패 0 확인)
```

### 1.5 Claude Code 세션 토큰 예산

각 프로세스는 1~3시간 분량으로 설계됨. 이를 초과하는 경우 (예: P3a 의 6,000줄 분할):
- **Plan agent 로 사전 설계** → 사람이 검토 → Claude 직접 Edit 으로 분할
- 한 번에 끝내려 하지 말고 **commit 단위로 끊어서** 진행 (각 commit 단위 빌드 통과 확인)

---

## 2. Stage A — 기존 stacked 브랜치 정리 (선결과제)

> **현재 7개 브랜치가 main 에 단 한 줄도 머지되지 않았음**. 이걸 정리하지 않고 새 작업을 시작하면 충돌·drift 가 누적됨.

### A.1 — 브랜치 검증 + super-set 확정

**목표**: 가장 위쪽 브랜치(`feat/saas-v2-p1-order-v2`)가 다른 모든 stacked 브랜치를 포함하는 super-set 인지 확인.

**Claude Code 프롬프트**:
```
다음 7개 브랜치의 stack 관계를 검증해주세요. 가장 위쪽 브랜치인
feat/saas-v2-p1-order-v2 가 모든 하위 브랜치 변경을 포함하는 super-set 인지
확인하고, 만약 누락된 변경이 있으면 어느 브랜치의 어느 파일이 빠졌는지
보고해주세요. 보고만 하고 코드 수정은 하지 마세요.

브랜치 (아래쪽이 base):
- feat/saas-v2-prep
- feat/saas-v2-p0
- feat/saas-v2-p05
- feat/saas-v2-p1
- feat/saas-v2-p2-retail-bands
- feat/saas-v2-p1-order-v2 (가장 위)

검증 명령:
1) git log --oneline origin/main..origin/feat/saas-v2-p1-order-v2
2) 각 하위 브랜치 commit 이 super-set 에 포함됐는지: git cherry origin/feat/saas-v2-p1-order-v2 origin/feat/saas-v2-p0
3) 누락 발견 시 cherry-pick 후보 SHA 와 파일 목록 출력
```

**검증**:
- super-set 이 맞으면 → A.2 로
- 누락이 있으면 → 누락분을 super-set 에 cherry-pick 하여 보강

**완료 기준**: `feat/saas-v2-p1-order-v2` 가 모든 v2 변경을 포함한다고 확인됨.

---

### A.2 — Squash merge to main (단일 PR)

**목표**: super-set 브랜치를 main 에 squash merge 해서 v2 스캐폴딩을 main 에 안착.

**원칙**:
- 운영 영향 0 (모든 v2 코드는 `/v2/*` 라우트 + `(admin-v2)` 폴더에만 존재, 옛 패널 미수정)
- 단일 squash commit 으로 머지 (역사 단순화)
- 머지 후 stacked 브랜치 6개는 origin 에서 삭제

**Claude Code 프롬프트**:
```
feat/saas-v2-p1-order-v2 를 main 에 squash merge 할 PR을 준비해주세요.

작업:
1) 브랜치를 main 에 rebase 시도 (충돌 없어야 함, Option A 경로분리라 옛 폴더 미수정)
2) typecheck:sourcing + typecheck:shop 통과 확인
3) build:sourcing + build:shop 통과 확인 (NODE_OPTIONS=--max-old-space-size=4096)
4) PR 생성: gh pr create --base main --head feat/saas-v2-p1-order-v2
   - title: "feat(sourcing): SaaS v2 P0~P2 스캐폴딩 — /v2 라우트 트리 + 사이드바 + 빌링/소매밴드/주문관리 실구현"
   - body: 변경 요약 (P0~P2.1 까지) + 검증 결과 + 베타 토글 사용법

원칙:
- 옛 /sourcing/*, /shop/*, /admin/* 폴더는 절대 수정 금지
- 충돌 발생 시 작업 중단하고 사람에게 보고
- 빌드 실패 시 작업 중단

완료 기준:
- PR URL 출력
- main 머지 후 운영 검증 (cookie saas-v2 미설정 시 옛 패널 그대로, saas-v2=on 시 /v2)
```

**완료 기준**:
- PR 머지 완료
- 운영 배포 후 cookie 로 옛 패널 / 신 패널 토글 가능
- `/v2/dashboard`, `/v2/order/list`, `/v2/channel/retail-bands`, `/v2/system/billing` 4개 페이지 정상 렌더
- 나머지 13개 stub 페이지는 stub 화면 표시 (의도된 상태)

**위험 + 롤백**:
- 운영 자동발행/에이전트 영향 0 (변경 범위 완전 분리)
- 문제 시: cookie 끄기 → 옛 패널 즉시 복귀
- 최악: `git revert <merge-sha>` → 5분 내 롤백 가능

**예상 소요**: 1시간 (검증 + PR 생성)

---

### A.3 — 잔여 stacked 브랜치 정리

A.2 머지 완료 후, 옛 stacked 브랜치 6개는 origin 에서 삭제하고 로컬도 정리.

```bash
# origin 삭제
for b in feat/saas-v2-prep feat/saas-v2-p0 feat/saas-v2-p05 feat/saas-v2-p1 feat/saas-v2-p2-retail-bands; do
  git push origin --delete "$b"
done
# 로컬 정리
git fetch origin --prune
git branch -D feat/saas-v2-prep feat/saas-v2-p0 feat/saas-v2-p05 feat/saas-v2-p1 feat/saas-v2-p2-retail-bands feat/saas-v2-p1-order-v2 2>/dev/null
```

이 단계 이후 모든 v2 작업은 main 에 직접 또는 단기 feature 브랜치로 진행 (Option A 단일 main 원칙).

---

## 3. 프로세스별 작업 가이드 (Stage A 후 시작)

### 작업 우선순위 매트릭스

| 우선 | 프로세스 | 가치 | 위험 | 소요 |
|---|---|---|---|---|
| 🥇 1 | P2.3 CS 인박스 배지 | 매니저 즉시 효과 | 낮음 | 0.5일 |
| 🥇 2 | P2.2 분석 대시보드 | 매니저 신뢰도 | 중간 | 2주 |
| 🥈 3 | P1.2 Shop 라우트 6개 이전 | 사이드바 일관성 | 낮음 | 3일 |
| 🥈 4 | P2.1 배송 추적 | 매니저 일일업무 | 낮음 | 3일 |
| 🥈 5 | P2.4 feature-gate 연동 | SaaS 가치 명확화 | 낮음 | 2일 |
| 🥉 6 | P1.3 Admin API 12폴더 이전 | 정합성 (운영 가치 낮음) | 낮음 | 3일 |
| 🥉 7 | P1.4 middleware/rewrites | 옛 URL 호환 | 낮음 | 0.5일 |
| 🚧 8 | P3a 대형 파일 분할 | 분할만 (가치 낮음) | 높음 | 1.5주 |
| 🚧 9 | P3b 4탭 통합 UI | 사용자 가시 변화 | 높음 | 2주 |
| 🏁 10 | P4 베타 + 정리 | 출시 | 중간 | 1.5주 |

**제안 진행 시나리오**:
- **시나리오 B** (권장): 1~7 만 진행 → 6월 초 베타 → P3 보류
- **시나리오 풀**: 1~10 진행 → 7월 초 베타

---

### P2.3 — CS 인박스 배지 (가장 작은 가치 큰 작업)

**목표**: 사이드바 "CS 인박스" 메뉴에 PENDING InboxMessage 건수 빨간 배지 표시.

**영향 파일**:
- `code/sourcing-app/src/config/navigation-v2.ts` — `MenuItem.badge` 추가
- `code/sourcing-app/src/components/layout/SidebarV2.tsx` — badge 렌더 + polling
- `code/sourcing-app/src/app/api/v2/cs/inbox/pending-count/route.ts` (신규) — 카운트 API

**사전조건**: Stage A 완료.

**Claude Code 프롬프트**:
```
v2 사이드바의 CS 인박스 메뉴에 PENDING 건수 빨간 배지를 추가해주세요.

작업:
1) 신규 API 추가: GET /api/v2/cs/inbox/pending-count
   - 응답: { count: number }
   - DB 쿼리: prisma.inboxMessage.count({ where: { userId, status: 'PENDING' } })
   - admin auth (getCurrentUser 사용, 다른 v2 API 와 동일 패턴)

2) navigation-v2.ts 의 CS/분석 그룹 → 'CS 인박스' MenuItem 에 badge 옵션 활성화

3) SidebarV2.tsx 에서:
   - useEffect + setInterval(30000) 으로 카운트 polling
   - count>0 시 메뉴 우측에 빨간 원 안에 숫자 표시
   - count=0 시 배지 숨김

검증:
- npm run typecheck:sourcing 통과
- /v2/cs/inbox 메뉴에 배지 노출 (운영에서 PENDING 건수 만큼)
- 30초 polling 으로 자동 갱신 확인
- 옛 /sourcing/* 사이드바에는 영향 없음

완료 기준:
- API + UI 작동
- 빌드 성공
- PR 생성 (gh pr create --base main)
```

**완료 기준**: 사이드바에 빨간 배지 노출 + 30초 polling.

**위험 + 롤백**: 거의 없음. 새 API 1개 + UI 컴포넌트 일부 수정. 문제 시 PR revert.

**예상 소요**: 0.5일

---

### P2.1 — 배송 추적 페이지

**목표**: `/v2/order/shipping` 신규 페이지 — 주문별 운송장/상태 목록 + 일괄 송장 업로드.

**영향 파일**:
- `code/sourcing-app/src/app/(admin-v2)/v2/order/shipping/page.tsx` (현재 stub 16줄 → 실구현)
- `code/sourcing-app/src/app/(admin-v2)/v2/order/shipping/_components/*` (신규)
- `code/sourcing-app/src/app/api/v2/order/shipping/route.ts` (신규)
- `code/sourcing-app/src/app/api/v2/order/shipping/bulk-upload/route.ts` (신규)

**사전조건**: Stage A 완료.

**Claude Code 프롬프트**:
```
/v2/order/shipping 페이지를 신규 구현해주세요.

스펙 (개발계획서 v2 §8.2):
- 주문별 택배사/송장번호/현재상태 목록 테이블
- 상태별 필터: 배송전 / 배송중 / 배송완료 / 반품
- 송장번호 일괄 입력: 엑셀 업로드 (xlsx 패키지 사용, sourcing-app 에 이미 설치됨)
- 배송 지연 알림: 3일 이상 미배송 행을 빨간 하이라이트
- DB: Order + Shipment 모델 (혹은 Shipment 가 없다면 Order 자체) 조합 조회

API:
- GET /api/v2/order/shipping — 주문 목록 + 배송 상태 (page/filter 지원)
- POST /api/v2/order/shipping/bulk-upload — 엑셀 파일 업로드, 송장번호 일괄 반영
- 옛 /api/admin/* 의 송장 관련 API 가 있으면 같은 모델/로직 재사용 (코드 중복 OK)

UI:
- shadcn/ui Table + Filter (다른 v2 페이지와 동일 톤)
- /v2/order/list 의 디자인 패턴 참고 (이미 구현됨)

검증:
- typecheck/build 통과
- 빈 DB 에서도 페이지 렌더 (empty state)
- 엑셀 1행짜리 sample 업로드 → 1건 반영 확인

완료 기준: 페이지 렌더 + 엑셀 업로드 1건 동작 + PR 생성
```

**위험 + 롤백**: Order 모델 스키마 의존성. 모델에 송장 컬럼이 없으면 DB 스키마 변경 필요(별도 PR). 그런 경우 작업 중단 후 사람에게 보고.

**예상 소요**: 3일

---

### P2.2 — 분석 대시보드 (가장 큰 작업)

**목표**: `/v2/analytics` — Recharts 차트 + Redis 캐싱 + feature-gate 플랜 제한.

**영향 파일** (대규모):
- `code/sourcing-app/src/app/(admin-v2)/v2/analytics/page.tsx` (현재 stub 17줄 → 대규모 실구현)
- `code/sourcing-app/src/app/(admin-v2)/v2/analytics/_components/*` (5~8개 차트 컴포넌트)
- `code/sourcing-app/src/app/api/v2/analytics/sales/route.ts` (신규)
- `code/sourcing-app/src/app/api/v2/analytics/channels/route.ts` (신규)
- `code/sourcing-app/src/app/api/v2/analytics/products/route.ts` (신규)
- `code/sourcing-app/src/app/api/v2/analytics/customers/route.ts` (신규)
- `code/sourcing-app/src/app/api/v2/analytics/agents/route.ts` (신규)
- `code/sourcing-app/src/lib/analytics-cache.ts` (신규 — Redis 5분 TTL 래퍼)

**사전조건**:
- Stage A 완료
- recharts 패키지 설치 (`pnpm add recharts -F sourcing-app`)
- Redis 동작 확인 (이미 운영에서 Bull queue 로 사용 중)

**작업 분할 권장**: 한 번에 다 하지 말고 4개 PR 로 분할

#### P2.2-A — 매출 추이 차트 (가장 단순한 것부터)

**Claude Code 프롬프트**:
```
/v2/analytics 페이지의 첫 번째 섹션으로 매출 추이 차트를 구현해주세요.

스펙:
- 일/주/월 단위 토글
- Recharts LineChart (X: 날짜, Y: 매출 금액)
- 기간: 최근 30일 (Free 플랜) / 최근 1년 (Pro 이상) — feature-gate 사용
- API: GET /api/v2/analytics/sales?period=daily|weekly|monthly
- 응답 캐싱: Redis 5분 TTL (analytics-cache.ts 신규 작성)

집계 쿼리:
- prisma.order.groupBy({ by: ['paidAt'], _sum: { totalAmount } })
  status='PAID' 만, deletedAt=null
- 결제일 기준 (createdAt 아님)

UI:
- Recharts ResponsiveContainer + LineChart
- 색상은 BandAuto 메인 컬러 (cobalt blue)
- 빈 데이터 empty state

검증:
- typecheck/build
- 빈 DB 에서도 empty 차트 렌더
- 캐시 hit/miss 로그 확인 (5분 안에 두 번 호출 시 두 번째는 캐시)

완료: PR 생성, 다음 PR(P2.2-B 채널별 성과) 의 베이스가 될 페이지 컨테이너 작성 포함
```

#### P2.2-B — 채널별 성과 비교
도매채널 / 소매밴드 / 쇼핑몰별 매출 막대그래프. (위와 동일 패턴)

#### P2.2-C — 상품 TOP 20 + 고객 통계
정렬 가능한 테이블 + 신규/재구매/이탈 코호트 차트.

#### P2.2-D — 에이전트 자동화 효과
AgentLog 집계 (agent_kpi_records 활용). 수동 vs 자동 발행 비율 등.

**위험 + 롤백**:
- 집계 쿼리가 무거우면 운영 DB 부하 → Redis 캐싱 + 인덱스 점검 필수
- 빌드 실패 시 (recharts SSR 이슈) → `'use client'` 명시 + dynamic import
- 각 PR 단위로 롤백 가능

**예상 소요**: 2주 (4개 PR × 2~3일)

---

### P1.2 — Shop 라우트 6개 v2 이전

**목표**: 옛 `/shop/*` 페이지들을 `/v2/*` 트리에 복제 이식 (옛 폴더는 미수정).

**대상**:
| 옛 경로 | 신 경로 | 현재 v2 상태 |
|---|---|---|
| `/shop/order/list` | `/v2/order/list` | ✅ 이미 구현 (스킵) |
| `/shop/order/detail/[id]` | `/v2/order/detail/[id]` | ⛔ stub 없음 → 신규 폴더 |
| `/shop/wholesale-orders` | `/v2/order/purchase` | 🔵 stub |
| `/shop/settlement` | `/v2/order/settlement` | 🔵 stub |
| `/shop/cs/*` | `/v2/cs/inbox` | 🔵 stub |
| `/shop/store/list` | `/v2/channel/shops` | 🔵 stub |

**사전조건**: Stage A 완료.

**Claude Code 프롬프트** (각 페이지마다 1회씩 반복):
```
옛 /shop/wholesale-orders 페이지를 /v2/order/purchase 로 복제 이식해주세요 (Option A).

원칙 (절대 위반 금지):
- 옛 폴더 (sourcing-app/src/app/(admin)/shop/wholesale-orders/) 는 절대 수정·삭제 금지
- 신 경로에 옛 page.tsx 를 그대로 복사
- import 경로는 그대로 유지 (모듈/API/Prisma 모델은 같은 것 재사용)
- v2 사이드바(SidebarV2.tsx) 가 이미 이 경로를 가리키고 있어야 함 (navigation-v2.ts 확인)

작업:
1) cp sourcing-app/src/app/(admin)/shop/wholesale-orders/page.tsx
      sourcing-app/src/app/(admin-v2)/v2/order/purchase/page.tsx (덮어쓰기)
2) 페이지 내부에서 useRouter 의 path 를 /v2/order/purchase 로 사용하는 곳이 있는지
   확인 (옛 경로 하드코딩 있으면 수정)
3) typecheck:sourcing + build:sourcing 통과 확인

검증:
- /v2/order/purchase 가 /shop/wholesale-orders 와 동일 동작 (cookie saas-v2=on)
- /shop/wholesale-orders 는 그대로 옛 동작 (회귀 0)

완료: PR 생성. 6개 페이지 모두 끝나면 단일 PR 로 합치거나 6개로 분할 (작업자 판단)
```

**예상 소요**: 3일 (6개 페이지 × 0.5일)

---

### P1.3 — Admin API 12 폴더 이전

**목표**: `/api/admin/*` 의 37개 route 를 새 경로 트리로 이동 + 옛 경로는 next.config rewrites 로 6개월 프록시.

**상세 매핑**:
| 옛 경로 | 신 경로 | route 수 |
|---|---|---|
| `/api/admin/agents/*` | `/api/v2/system/agents/*` | 14 |
| `/api/admin/automation/*` | `/api/v2/system/automation/*` | 3 |
| `/api/admin/users/*` | `/api/v2/system/users/*` | 3 |
| `/api/admin/settlement/*` | `/api/v2/order/settlement/*` | 1 |
| `/api/admin/wholesale-orders/*` | `/api/v2/order/wholesale/*` | 1 |
| `/api/admin/band-deletion/*` | `/api/v2/system/band-deletion/*` | 2 |
| `/api/admin/products/*` | `/api/v2/products/*` | 2 |
| `/api/admin/policies/*` | `/api/v2/policies/*` | 1 |
| `/api/admin/cleanup-posts/*` | `/api/v2/system/cleanup-posts/*` | ? |
| `/api/admin/notifications/*` | `/api/v2/notifications/*` | ? |
| `/api/admin/platform/*` | `/api/v2/system/platform/*` | ? |
| `/api/admin/reviews/*` | `/api/v2/reviews/*` | ? |

**원칙**:
- **옛 폴더 삭제 금지** (Phase 4 까지 보존)
- 신 폴더에 옛 route.ts 복사 (코드 중복 의도)
- 옛 경로 → 신 경로 rewrites (next.config.js)
- 옛 폴더 코드 안에서 다른 옛 폴더 import 가 있으면 그대로 유지

**Claude Code 프롬프트** (12개 폴더 일괄 작업이라 큰 작업):
```
Admin API 12 폴더를 신 경로 트리로 복제 이전해주세요. 매핑은 본 가이드 P1.3 표 참조.

작업 (각 폴더당):
1) 옛 폴더 (예: src/app/api/admin/agents/) 의 모든 route.ts 를
   신 위치 (src/app/api/v2/system/agents/) 로 cp -r 복사
2) 신 폴더 의 route.ts import 경로 검증 (대부분 절대 경로 @/ 사용이라 그대로 동작)
3) next.config.js 의 rewrites 에 다음 추가 (단, 옛 경로 우선이 아니라 신 경로 우선):
   { source: '/api/admin/agents/:path*', destination: '/api/v2/system/agents/:path*' }
   (옛 코드는 보존하되, 옛 경로로 들어오는 요청을 신 경로로 redirect)

검증:
- typecheck:sourcing + build:sourcing 통과
- curl localhost:3001/api/admin/agents → 신 경로 응답 (rewrites 동작)
- curl localhost:3001/api/v2/system/agents → 직접 신 경로

원칙:
- 옛 src/app/api/admin/* 폴더 절대 삭제 금지 (P4 까지 보존)
- 단, /api/admin/* 요청은 rewrites 로 신 경로가 처리 — 의도된 중복

완료: 12개 폴더 모두 이전, rewrites 12 줄 추가, PR 생성
```

**위험 + 롤백**: rewrites 가 잘못 작성되면 모든 admin API 호출 실패 → 매니저 화면 깨짐. 검증을 빠뜨리지 말 것. 문제 시 next.config.js 의 rewrites 만 revert 하면 즉시 옛 경로 복귀.

**예상 소요**: 3일

---

### P1.4 — middleware 페이지 리다이렉트

**목표**: 베타 토글이 켜진 사용자에 한해 옛 페이지 URL 클릭 시 /v2/* 로 자동 이동.

**Claude Code 프롬프트**:
```
src/middleware.ts 에 SaaS v2 베타 토글 사용자용 페이지 리다이렉트 맵을 추가해주세요.

조건:
- request.cookies.get('saas-v2')?.value === 'on'
- 그리고 pathname 이 옛 경로면 /v2/* 신 경로로 308 redirect

매핑 (10개):
/sourcing/dashboard → /v2/dashboard
/sourcing/post/list → /v2/post/list
/sourcing/product/list → /v2/product/management
/sourcing/publish/digest → /v2/publish/digest
/sourcing/publish/ad → /v2/publish/ad
/sourcing/channel/list → /v2/channel/wholesale
/shop/store/list → /v2/channel/shops
/shop/order/list → /v2/order/list
/shop/wholesale-orders → /v2/order/purchase
/shop/settlement → /v2/order/settlement
/shop/cs → /v2/cs/inbox
/admin/agents → /v2/system/agents

코드 위치: src/middleware.ts (이미 있는 파일에 추가)
- 기존 미들웨어 로직 손상 금지 (auth 등)

검증:
- cookie 미설정 → 옛 경로 그대로 (회귀 0)
- cookie saas-v2=on 설정 → /sourcing/dashboard 클릭 시 /v2/dashboard 로 이동

완료: PR 생성
```

**예상 소요**: 0.5일

---

### P2.4 — feature-gate 연동

**목표**: SubscriptionPlan 기반으로 v2 메뉴 노출/숨김 + 일부 기능 게이팅.

**Claude Code 프롬프트**:
```
src/lib/feature-gate.ts 를 v2 사이드바 + 분석 대시보드에 연동해주세요.

작업:
1) navigation-v2.ts 의 MenuItem 에 'requiredFeature' 옵션 추가 (옵셔널 string)
   - 예: { label: '분석', requiredFeature: 'analytics_advanced' }
2) SidebarV2.tsx 에서 useFeatureGate() 훅으로 현재 사용자 플랜 조회
   - gate.hasFeature(item.requiredFeature) 가 false 면 메뉴 항목 숨김 또는 잠금 아이콘
3) /v2/analytics 페이지 에서 Pro 미만 플랜은 기본 3개 차트만, 나머지는 잠금 표시 + 업그레이드 CTA
4) gate.checkLimit('aiCalls', currentUsage) 로 월 한도 도달 시 화면에 경고 배너

검증:
- 미구독 (Free) 계정 — 메뉴 일부 숨김 확인
- Pro 계정 — 모든 메뉴 노출
- limit 도달 시 배너 노출

완료: PR 생성
```

**예상 소요**: 2일

---

### P3a — 대형 파일 분할 (UI 변경 없음)

**목표**: 회귀 위험 최소화 — UI 동작 100% 동일하게 유지하면서 파일 구조만 분할.

#### P3a.1 — ProcessedProductTab.tsx (2,701줄) 분할

**대상 파일**: `code/sourcing-app/src/app/(admin)/sourcing/product/list/_components/ProcessedProductTab.tsx`

> **이 작업은 옛 폴더의 파일을 직접 수정합니다** — Option A 의 예외. 분할 결과는 `/v2` 트리에서도 import 해서 재사용.

**Claude Code 프롬프트**:
```
ProcessedProductTab.tsx (2,701줄) 를 다음 추출 파일로 분할해주세요.
원칙: UI 동작 100% 동일 유지. 필터/정렬/일괄작업 모든 인터랙션 그대로.

추출 계획 (예상 줄수):
- hooks/useProductFilter.ts (~250줄) — 필터/정렬 로직
- hooks/useBulkActions.ts (~200줄) — 일괄 작업 로직
- components/ProductCard.tsx (~300줄) — 상품 카드
- components/ProductDetailModal.tsx (~280줄) — 상세 모달
- components/ProductFilterBar.tsx (~200줄) — 필터바
- 본체 ProcessedProductTab.tsx 는 ~500줄 이하로 축소 (조립만 담당)

작업 절차 (commit 단위로 끊어서 진행, 각 commit 빌드 통과 확인):
1) git checkout -b feat/v2-p3a-split-processed-tab
2) 가장 응집도 높은 단위 (필터바) 부터 추출 → commit → 빌드 확인
3) 다음 단위 (카드) 추출 → commit → 빌드 확인
4) ... 5단위 모두 완료 후 본체 정리 → commit
5) E2E 검증: /sourcing/product/list?tab=processed 페이지에서
   필터/정렬/카드 클릭/일괄선택/일괄발행 모든 동작 회귀 0 확인

원칙:
- 절대 로직 변경 금지 (단순 추출만)
- prop drilling 발생해도 OK (다음 단계 P3b 에서 정리)
- TypeScript 타입은 추출 위치에 맞게 export

검증:
- 각 commit 마다 npm run build:sourcing 통과
- 페이지 동작 회귀 테스트 (수동 또는 Playwright E2E)

완료: 5개 추출 파일 + 본체 축소, PR 생성
```

**위험**: 가장 회귀 위험 큰 작업. **PR 머지 전 사람이 반드시 화면에서 동작 검증**.

**예상 소요**: 1주

#### P3a.2 — Publish page.tsx (3,196줄) 분할

같은 패턴, 추출 대상:
- `hooks/usePublishStatus.ts` (~300줄)
- `components/PublishMatrix.tsx` (~280줄)
- `components/PublishExecutor.tsx` (~250줄)

**예상 소요**: 0.5주

---

### P3b — 4탭 통합 UI

**목표**: P3a 추출물을 활용해 `/v2/product/management` 에 4탭 UI 신규 구현.

**Claude Code 프롬프트**:
```
/v2/product/management 페이지를 4탭 통합 UI 로 신규 구현해주세요.

탭 구조 (?tab= 쿼리로 라우팅):
- ?tab=products    — 전체 상품 (P3a 의 ProductCard/FilterBar/useProductFilter 활용)
- ?tab=status      — 발행현황 매트릭스 (P3a 의 PublishMatrix 활용)
- ?tab=execute     — 발행 실행 (P3a 의 PublishExecutor 활용 + SSE)
- ?tab=history     — 발행 이력 (신규)

신규 구현:
1) 4탭 컨테이너 (shadcn Tabs)
2) 탭 상단 요약 카드 (전체 상품수, 발행 대기, 발행 완료, 오류) — 4개 stat
3) 발행 이력 API: GET /api/v2/products/publish-history
   - 시간순 발행 로그 + 필터 (channelId, status, date range) + 재시도 액션
4) 탭 간 상태 연동: ?tab=products 에서 선택한 productIds → ?tab=execute 로 자동 전달
5) feature-gate: 일괄 발행은 Pro+, 자동 발행은 Business+

원칙:
- P3a 추출물 import 만 사용 (옛 옵션을 재구현하지 말 것)
- 옛 /sourcing/product/list 는 미수정 (계속 동작)

검증:
- 4탭 전환 + 탭 간 상태 전달 동작
- 발행 이력 API 응답 확인
- feature-gate 동작 확인 (Free/Pro 계정 전환 테스트)

완료: PR 생성
```

**예상 소요**: 2주

---

## 4. 공통 패턴 + 실전 팁

### 4.1 Claude Code 도구 선택 가이드

| 작업 | 도구 | 예시 |
|---|---|---|
| 영향 범위 파악 | `grepai search` 또는 Explore agent | "어디서 ProductCard 가 사용되는가" |
| 함수 호출 관계 | `grepai trace callers/callees` | "publishService 를 누가 호출하는가" |
| 단일 파일 편집 | Edit 도구 | 버그 fix, 라우트 추가 |
| 신규 파일 생성 | Write 도구 | API route, component |
| 다단계 설계 | Plan agent | DB 스키마 변경 + API + UI 동시 변경 |
| 빌드/테스트 | Bash | `npm run typecheck:sourcing`, `npm run build:sourcing` |
| 외부 영향 큰 작업 | 사람 검토 필수 | DB 마이그레이션, prisma db push, 결제 |

### 4.2 자주 쓰는 명령 시퀀스

**작업 시작**:
```bash
git checkout main && git pull --ff-only origin main
git checkout -b feat/v2-pX-yyy
```

**검증 (빌드 통과 확인)**:
```bash
npm run typecheck:sourcing       # 타입 에러 0
npm run typecheck:shop           # 타입 에러 0
npm run build:sourcing           # 빌드 통과
NODE_OPTIONS=--max-old-space-size=4096 npm run build:sourcing
```

**커밋 + PR**:
```bash
git add <파일들>
git commit -m "type(scope): 한 줄 요약

상세 설명...

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin feat/v2-pX-yyy
gh pr create --base main --title "..." --body "..."
```

### 4.3 빌드 실패 패턴 + 대응

| 증상 | 원인 | 대응 |
|---|---|---|
| `Cannot find module '@/...'` | tsconfig paths 누락 | tsconfig.json paths 확인 |
| `Type ... is not assignable to ...` | prisma client outdated | `cd db && npx prisma generate --schema prisma` |
| `out of memory` (build) | Node heap | `NODE_OPTIONS=--max-old-space-size=4096` |
| `.next/types/.../route.ts` 에러 | 빌드 캐시 stale | `.next` 폴더 삭제 후 재빌드 (이미 알려진 운영 무관 에러) |
| Recharts SSR 에러 | server component | 컴포넌트 상단에 `'use client'` 추가 |

### 4.4 옛 폴더 수정 절대 금지 원칙

다음 폴더는 **P4 베타 전환 완료 전까지 무수정**:
```
sourcing-app/src/app/(admin)/sourcing/*
sourcing-app/src/app/(admin)/shop/*
sourcing-app/src/app/(admin)/admin/*
sourcing-app/src/app/api/admin/*  (rewrites 만 추가, 코드 미수정)
```

**예외**: P3a 의 대형 파일 분할 (ProcessedProductTab, Publish page) — 추출만 하고 본체 인터페이스는 그대로 유지.

### 4.5 일감별 PR 사이즈 기준

- **0.5일 이하**: 단일 파일 ~50줄 변경 → 단일 commit, 단일 PR
- **1~3일**: 1개 기능 — PR 1개, commit 3~5개로 분할
- **1주 이상**: feature 브랜치 + 다중 PR (각 PR 단위로 main 머지)

PR 1개가 1,000줄 넘으면 분할 권장.

---

## 5. 운영 사고 발생 시 — v2 작업 중단 절차

### 5.1 중단 트리거

다음 중 하나라도 발생 시 **모든 v2 작업 즉시 중단**:
- 자동발행 cron 실패 (workflow_log status=FAILED 또는 stuck >30분)
- 매니저로부터 화면 깨짐/에러 보고
- 운영 hotfix 가 필요한 시급 버그
- DB 스키마 변경이 필요한 사고

### 5.2 중단 절차

1. 현재 v2 작업 commit + push (WIP 표시)
2. main 으로 checkout: `git checkout main && git pull`
3. 운영 hotfix 작업 (별도 hotfix 브랜치 또는 main 직접)
4. hotfix 배포 + 24시간 모니터링
5. v2 작업 재개: 작업 브랜치로 돌아가서 main rebase

### 5.3 hotfix 우선순위 표

| 사고 | 우선순위 | 처리 |
|---|---|---|
| 자동발행 stuck/실패 | 🔴 즉시 | stop-all + 진단 + fix |
| 결제/주문 오류 | 🔴 즉시 | 매뉴얼 처리 후 fix |
| Band 세션 만료 | 🟡 1시간 내 | 세션 재로그인 + watcher 점검 |
| 분석 통계 어긋남 | 🟢 1일 내 | 다음 cron 에서 자동 보정 가능한지 먼저 확인 |
| UI 깨짐 (옛 패널) | 🟡 1시간 내 | hotfix |
| UI 깨짐 (v2, 베타 사용자만) | 🟢 1일 내 | cookie 끄게 안내 → 정식 fix |

---

## 6. 작업 완료 체크리스트 (DoD)

각 PR 머지 전 확인:

### 코드
- [ ] 옛 폴더 (`(admin)/*`, `api/admin/*`) 수정 없음 (P3a 예외)
- [ ] typecheck:sourcing + typecheck:shop 통과
- [ ] build:sourcing + build:shop 통과
- [ ] 새 환경변수 추가 시 `.env.example` 업데이트
- [ ] 새 의존성 추가 시 pnpm-lock.yaml 커밋

### 동작
- [ ] cookie saas-v2 미설정 → 옛 패널 동작 0 회귀
- [ ] cookie saas-v2=on → /v2 신 페이지 정상 동작
- [ ] 빈 DB / 신규 사용자 케이스 empty state 처리
- [ ] feature-gate 적용 시 Free/Pro 플랜 차이 검증

### 문서
- [ ] `docs/SAAS_V2_MIGRATION.md` 트래커 업데이트 (해당 작업 ✅ 표시)
- [ ] API 추가 시 `docs/API.md` 반영
- [ ] DB 스키마 변경 시 `docs/DATABASE.md` 반영
- [ ] 자율 판단 발생 시 `docs/SAAS_V2_DECISIONS.md` 추가 기록

### PR
- [ ] PR title: `type(scope): 한 줄 요약` 형식
- [ ] PR body: 변경 요약 + 검증 결과 + 회귀 테스트 결과
- [ ] Co-Authored-By: Claude Opus 4.7 표시

---

## 7. 베타 출시 + 전환 (P4)

### P4.1 — 베타 토글 출시

**목표**: 일부 매니저에게 cookie `saas-v2=on` 부여 → 1~2주 검증.

**작업**:
1. 관리자 대시보드에 "새 패널 미리보기" 토글 버튼 추가 (cookie 설정/해제)
2. 매니저별 베타 opt-in 명단 관리 (DB User.saasV2Beta = true 컬럼 추가)
3. 매뉴얼 1장 (스크린샷 포함) 작성 — 옛 → 신 메뉴 매핑

### P4.2 — 매니저 학습/매뉴얼

매뉴얼 페이지(`/sourcing/settings/manual` 또는 v2 의 시스템>설정>매뉴얼)에 다음 추가:
- 옛 메뉴 → 신 메뉴 매핑 표
- 4탭 상품관리 사용법 (P3 완료 시)
- 분석 대시보드 차트 해석 가이드
- 자주 묻는 질문 (FAQ)

### P4.3 — 전체 전환 + 옛 코드 정리

**전환 절차**:
1. middleware.ts 의 cookie 체크 → 기본값 ON 으로 변경
2. 옛 패널 사이드바를 비활성화 (또는 SidebarV2 로 통일)
3. 1주 모니터링 — 사고 0 이면 옛 코드 삭제 단계로
4. `(admin)/sourcing/*`, `(admin)/shop/*`, `(admin)/admin/*` 폴더 삭제
5. `/api/admin/*` 폴더 삭제 (rewrites 도 제거)
6. SAAS_V2_MIGRATION.md 트래커 모든 항목 ✅
7. 6개월 후: 옛 URL 리다이렉트도 제거 (검색엔진 인덱스 갱신 후)

---

## 8. 의사결정 필요 항목 (작업 중 발생 시 자율 판단 → DECISIONS.md 기록)

| 상황 | 자율 판단 기준 |
|---|---|
| 모달 디자인 옛 vs 신 톤 충돌 | 신 톤 (shadcn/ui) 우선 |
| 발행이력 시간 표기 | KST 절대 시각 + ISO 8601 (UTC) 둘 다 |
| 빈 데이터 empty state | 일러스트 없이 텍스트 + CTA 버튼 |
| API 응답 페이지네이션 | 기본 limit=20, cursor 기반 우선, page=N 도 지원 |
| 폼 validation 라이브러리 | zod (다른 v2 페이지와 동일) |
| 쿼리 필터 URL state vs 컴포넌트 state | URL state 우선 (북마크/공유 가능) |
| 위 외 모호 케이스 | DECISIONS.md "단순성 > 확장성 > 성능" 적용 |

---

## 9. 변경 이력

- 2026-04-29 v1: 최초 작성 (P0~P2.1 완료 시점, 잔여 78% 가이드)
