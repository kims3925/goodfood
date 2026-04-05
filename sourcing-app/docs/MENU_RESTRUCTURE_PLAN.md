# 매니저 대시보드 메뉴 간소화 계획

> 작성일: 2026-04-05 | 대상: 매니저탭 + 쇼핑몰탭 (어드민 패널 제외)

---

## 1. 현재 메뉴 구조 (AS-IS)

### 매니저탭 (10개 항목, 하위 포함 16개)

```
📊 대시보드
⚡ 파이프라인
🏪 채널 관리
📂 수집 ▸
   ├── 게시물 수집
   └── 수집 상품
📦 상품 ▸
   ├── 가공상품 발행
   └── 가공 상품
⚙️ 자동화 ▸
   ├── 설정
   └── 실행 로그
🔔 알림 관리
⚙️ 설정 ▸
   ├── API
   ├── AI
   ├── 프롬프트 / 가격 정책
   └── 구글 시트
👤 매니저 관리
🛡️ 정책 관리 ▸
   ├── 이용약관
   └── 개인정보처리방침
```

### 쇼핑몰탭 (10개 항목, 하위 포함 17개)

```
📊 대시보드
🛍️ 쇼핑몰 관리
📋 주문 ▸
   ├── 주문 목록
   └── 발주 관리
💰 정산 ▸
   ├── 정산 목록
   ├── 정산 이력
   └── 도매 정산서
💬 고객 문의
⭐ 리뷰 관리
🎟️ 쿠폰
🔔 알림 관리
👥 회원 관리 ▸
   ├── 회원 목록
   └── 실시간 접속자
🛡️ 정책 관리 ▸
   ├── 이용약관
   └── 개인정보처리방침
```

---

## 2. 문제점 분석

### 2-1. 구조적 문제

| 문제 | 설명 |
|------|------|
| **메뉴 깊이 불균형** | 하위 2개뿐인 그룹(수집, 자동화, 회원 관리)은 펼쳐야 하는 불편 대비 가치가 낮음 |
| **중복 메뉴** | 정책 관리(이용약관/개인정보처리방침)가 매니저탭·쇼핑몰탭에 동일 존재, 같은 href 가리킴 |
| **알림 관리 중복** | 매니저탭·쇼핑몰탭에 각각 알림 관리 존재 |
| **설정 혼란** | 매니저탭에 "설정" 그룹 안의 "설정"(자동화)과 "설정"(전역)이 이름 충돌 |
| **대시보드 ↔ 파이프라인 역할 겹침** | 대시보드에 이미 파이프라인 요약이 포함되어 있어 별도 진입 필요성 낮음 |
| **1뎁스 메뉴 과다** | 10개 최상위 메뉴는 한눈에 파악하기 어려움 (이상적: 5~7개) |

### 2-2. 사용 흐름 관점

소싱 작업의 핵심 흐름은 **수집 → 가공 → 발행** 3단계인데, 현재 메뉴에서는 수집과 상품(가공)이 별도 그룹으로 분리되어 있어 워크플로우 흐름이 끊어짐.

쇼핑몰 탭에서는 주문~정산이 핵심인데, CS관련 항목(고객 문의, 리뷰)이 흩어져 있음.

---

## 3. 개선 계획 (TO-BE)

### 핵심 원칙

1. **최상위 메뉴 7개 이하** — 한눈에 파악 가능
2. **워크플로우 기반 그룹핑** — 작업 흐름 순서로 배치
3. **중복 제거** — 정책 관리는 한 곳에만, 알림은 통합
4. **하위 2개 그룹 해체** — 불필요한 뎁스 제거

---

### 매니저탭 개선안 (10개 → 6개)

```
📊 대시보드               ← 파이프라인 대시보드 통합 (탭 전환)
🏪 채널 관리              ← 유지
📦 소싱                   ← "수집" + "상품" 통합 (워크플로우 순서)
   ├── 게시물 수집
   ├── 수집 상품
   ├── 가공 상품
   └── 가공상품 발행
⚡ 자동화                 ← 하위 메뉴 해체, 플랫 구조로
   ├── 자동화 설정
   └── 실행 로그
⚙️ 설정                   ← "설정" + "매니저 관리" + "알림 관리" 통합
   ├── AI / API
   ├── 프롬프트 / 가격 정책
   ├── 구글 시트
   ├── 알림
   └── 매니저 관리
🛡️ 정책 관리              ← 유지 (adminOnly)
   ├── 이용약관
   └── 개인정보처리방침
```

**변경 요약:**

| 변경 | 내용 | 이유 |
|------|------|------|
| 파이프라인 → 대시보드 통합 | 대시보드 페이지에 "파이프라인" 탭 추가 | 두 페이지 정보가 90% 겹침 |
| 수집 + 상품 → "소싱" 통합 | 4개 하위메뉴로 워크플로우 순서 배치 | 수집→가공→발행 흐름 일체화 |
| 알림 관리 → 설정 하위로 | 빈도 낮은 설정성 메뉴 | 알림 확인은 헤더 벨 아이콘으로 충분 |
| 매니저 관리 → 설정 하위로 | 관리 성격 통합 | 사용 빈도 낮음 |
| AI/API 통합 | 별도 페이지 유지하되 메뉴 표시명 합침 | 둘 다 외부 서비스 연동 설정 |

---

### 쇼핑몰탭 개선안 (10개 → 6개)

```
📊 대시보드               ← 유지
🛍️ 쇼핑몰 관리            ← 유지
📋 주문/정산               ← "주문" + "정산" 통합
   ├── 주문 목록
   ├── 발주 관리
   ├── 정산 목록
   ├── 정산 이력
   └── 도매 정산서
💬 고객관리                ← "고객 문의" + "리뷰 관리" + "쿠폰" 통합
   ├── 고객 문의
   ├── 리뷰 관리
   └── 쿠폰
⚙️ 설정                   ← "회원 관리" + "알림 관리" 통합
   ├── 회원 목록
   ├── 실시간 접속자
   └── 알림
🛡️ 정책 관리              ← 유지 (adminOnly)
   ├── 이용약관
   └── 개인정보처리방침
```

**변경 요약:**

| 변경 | 내용 | 이유 |
|------|------|------|
| 주문 + 정산 통합 | "주문/정산" 하나의 그룹 | 주문→발주→정산은 하나의 흐름 |
| 고객 문의 + 리뷰 + 쿠폰 통합 | "고객관리" 그룹으로 | 모두 고객 대면 마케팅/CS 성격 |
| 회원 관리 + 알림 → "설정" | 관리 성격 통합 | 사용 빈도 낮은 운영 메뉴 |

---

## 4. 정책 관리 중복 해결

현재 매니저탭과 쇼핑몰탭 모두 정책 관리가 존재하며, 두 곳 모두 같은 URL(`/shop/policy/terms`, `/shop/policy/privacy`)을 가리킴.

**방안:** 쇼핑몰탭에만 정책 관리를 유지하고, 매니저탭에서는 제거. 이유는 이용약관/개인정보처리방침이 쇼핑몰 정책이므로 쇼핑몰탭이 자연스러운 위치.

### 최종 조정 후:

- **매니저탭: 5개** (대시보드, 채널 관리, 소싱, 자동화, 설정)
- **쇼핑몰탭: 6개** (대시보드, 쇼핑몰 관리, 주문/정산, 고객관리, 설정, 정책 관리)

---

## 5. 구현 계획

### 수정 파일

**핵심 파일 (1개):**
- `sourcing-app/src/config/navigation.ts` — 메뉴 구조 재정의

**대시보드 통합 (매니저탭):**
- `sourcing-app/src/app/(admin)/sourcing/dashboard/page.tsx` — 파이프라인 탭 추가
- `sourcing-app/src/app/(admin)/pipeline/page.tsx` → 리다이렉트 또는 제거

**메뉴 표시 연동:**
- `sourcing-app/src/components/layout/Sidebar.tsx` — 변경 시 자동 반영 (navigation.ts 기반)

### 구현 순서

```
Phase 1: navigation.ts 메뉴 구조 변경 (30분)
  - sourcingMenuItems 재구성
  - shopMenuItems 재구성
  - 정책 관리 중복 제거

Phase 2: 대시보드 + 파이프라인 통합 (1~2시간)
  - 대시보드 페이지에 탭 UI 추가
  - 기존 파이프라인 컴포넌트를 탭으로 이동
  - /pipeline 경로 → /sourcing/dashboard?tab=pipeline 리다이렉트

Phase 3: AI/API 설정 페이지 통합 (30분~1시간)
  - 설정 > AI/API 탭 기반 단일 페이지로 통합
  - 또는 메뉴 표시만 "AI / API"로 합치고 페이지는 유지

Phase 4: 테스트 및 검증 (30분)
  - 모든 메뉴 클릭 동작 확인
  - 브레드크럼 경로 정상 표시 확인
  - 모바일 사이드바 동작 확인
```

---

## 6. navigation.ts 변경 코드 (미리보기)

```typescript
// 매니저 탭 메뉴 (개선안)
export const sourcingMenuItems: MenuItem[] = [
  { label: '대시보드', href: '/sourcing/dashboard', icon: LayoutDashboard },
  { label: '채널 관리', href: '/sourcing/channel/list', icon: Store },
  {
    label: '소싱',
    icon: Package,
    children: [
      { label: '게시물 수집', href: '/sourcing/post/list', icon: FileText },
      { label: '수집 상품', href: '/sourcing/collected-product/list', icon: Database },
      { label: '가공 상품', href: '/sourcing/product/list', icon: Package },
      { label: '가공상품 발행', href: '/sourcing/publish', icon: Upload },
    ],
  },
  {
    label: '자동화',
    icon: Zap,
    children: [
      { label: '자동화 설정', href: '/sourcing/automation/settings', icon: Cog },
      { label: '실행 로그', href: '/sourcing/automation/logs', icon: History },
    ],
  },
  {
    label: '설정',
    icon: Settings,
    children: [
      { label: 'AI / API', href: '/sourcing/settings/ai', icon: Bot },
      { label: '프롬프트 / 가격 정책', href: '/sourcing/settings/prompt', icon: FileText },
      { label: '구글 시트', href: '/sourcing/settings/google-sheets', icon: FileSpreadsheet },
      { label: '알림', href: '/sourcing/notification', icon: Bell },
      { label: '매니저 관리', href: '/sourcing/user/list', icon: Users },
    ],
  },
]

// 쇼핑몰 탭 메뉴 (개선안)
export const shopMenuItems: MenuItem[] = [
  { label: '대시보드', href: '/shop/dashboard', icon: LayoutDashboard },
  { label: '쇼핑몰 관리', href: '/shop/store/list', icon: ShoppingBag },
  {
    label: '주문/정산',
    icon: ClipboardList,
    children: [
      { label: '주문 목록', href: '/shop/order/list', icon: ClipboardList },
      { label: '발주 관리', href: '/shop/wholesale-orders', icon: Truck },
      { label: '정산 목록', href: '/shop/settlement/list', icon: Calculator },
      { label: '정산 이력', href: '/shop/settlement/history', icon: History },
      { label: '도매 정산서', href: '/shop/settlement/wholesale', icon: FileSpreadsheet },
    ],
  },
  {
    label: '고객관리',
    icon: MessageSquare,
    children: [
      { label: '고객 문의', href: '/shop/cs/inquiry/list', icon: MessageSquare },
      { label: '리뷰 관리', href: '/shop/reviews/list', icon: Star },
      { label: '쿠폰', href: '/shop/coupon/list', icon: Ticket },
    ],
  },
  {
    label: '설정',
    icon: Settings,
    children: [
      { label: '회원 목록', href: '/shop/user/list', icon: Users },
      { label: '실시간 접속자', href: '/shop/visitors', icon: Eye },
      { label: '알림', href: '/shop/notification', icon: Bell },
    ],
  },
  {
    label: '정책 관리',
    icon: Shield,
    adminOnly: true,
    children: [
      { label: '이용약관', href: '/shop/policy/terms', icon: ScrollText, adminOnly: true },
      { label: '개인정보처리방침', href: '/shop/policy/privacy', icon: Lock, adminOnly: true },
    ],
  },
]
```

---

## 7. 전후 비교 요약

| 구분 | AS-IS | TO-BE | 감소율 |
|------|-------|-------|--------|
| 매니저탭 1뎁스 | 10개 | 5개 | **-50%** |
| 매니저탭 전체 | 16개 | 13개 | -19% |
| 쇼핑몰탭 1뎁스 | 10개 | 6개 | **-40%** |
| 쇼핑몰탭 전체 | 17개 | 16개 | -6% |
| 중복 메뉴 | 2건 (정책·알림) | 0건 | 제거 |

핵심은 **1뎁스 메뉴를 절반 가까이 줄여** 사이드바를 스크롤 없이 한눈에 볼 수 있게 하면서, 하위 메뉴는 워크플로우 기반으로 논리적으로 그룹핑하는 것입니다.
