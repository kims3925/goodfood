# 소싱앱 모바일 UI 개선 - 다중 터미널 협업 프롬프트

> 4개 터미널에서 병렬 작업을 위한 프롬프트 가이드

---

## 작업 분할 전략

```
┌─────────────────────────────────────────────────────────────────────┐
│ 터미널 1: 공통 UI 컴포넌트                                          │
│ - Modal, Table, Button, Input, Select, Pagination                   │
├─────────────────────────────────────────────────────────────────────┤
│ 터미널 2: 레이아웃 컴포넌트                                          │
│ - Header, Sidebar                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ 터미널 3: 소싱 섹션 페이지                                           │
│ - /sourcing/* (dashboard, channel, product, publish 등)             │
├─────────────────────────────────────────────────────────────────────┤
│ 터미널 4: 쇼핑몰 섹션 페이지                                          │
│ - /shop/* (order, settlement, coupon, cs 등)                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 공통 규칙 (모든 터미널)

```markdown
## 공통 컨텍스트

1. **Vercel React 스킬 활용**: `/vercel-react-best-practices` 스킬을 사용하여 React/Next.js 성능 최적화 패턴 적용
2. **모바일 우선 원칙**: min-width 미디어 쿼리 (sm: → md: → lg:) 순서
3. **터치 타겟**: 최소 44x44px 보장
4. **성능**: React.memo, useCallback, useMemo 활용 (최근 성능 개선 커밋 참고)
5. **문서 동기화**: 작업 완료 시 docs/tracking/CHANGELOG.md 업데이트

## 금지사항
- 다른 터미널 담당 파일 수정 금지
- 공유 타입/훅 변경 시 사전 협의 필요
- Hard Delete 금지 (Soft Delete 기본)
```

---

## 터미널 1: 공통 UI 컴포넌트

### 프롬프트

```markdown
# 소싱앱 모바일 UI 개선 - 공통 UI 컴포넌트

## 역할
공통 UI 컴포넌트의 모바일 반응형 개선 담당

## 담당 파일 (수정 가능)
- src/components/ui/Modal.tsx
- src/components/ui/Table.tsx
- src/components/ui/Button.tsx
- src/components/ui/Input.tsx
- src/components/ui/Select.tsx
- src/components/ui/Pagination.tsx
- src/components/ui/Card.tsx
- src/components/ui/Badge.tsx
- src/components/ui/Toast.tsx

## 작업 내용

### 1. Modal 반응형 개선 (우선순위: 최상)
현재 문제:
- max-w-{size} 고정값이 모바일에서 화면 초과
- 패딩 p-4 고정으로 좁은 화면에서 콘텐츠 영역 부족

개선 방향:
```tsx
// Before
<div className={`w-full ${sizeClasses[size]} max-h-[95vh]`}>

// After
<div className={`w-full max-w-[95vw] sm:max-w-[90vw] ${sizeClasses[size]} max-h-[90vh] sm:max-h-[95vh]`}>
```

추가 개선:
- 모바일에서 전체 화면 옵션 (fullScreenOnMobile prop)
- 하단 시트 스타일 옵션 (bottomSheet prop)
- 닫기 버튼 터치 영역 확대 (min-w-[44px] min-h-[44px])

### 2. Table 모바일 최적화 (우선순위: 최상)
현재 문제:
- 수평 스크롤만 지원, 좁은 열에서 텍스트 겹침
- 패딩/폰트 크기 고정

개선 방향:
```tsx
// 모바일 카드 뷰 옵션 추가
interface TableProps {
  mobileLayout?: 'scroll' | 'stack' | 'card';
  priorityColumns?: string[]; // 모바일에서 우선 표시할 열
}

// 반응형 패딩
<td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm">
```

### 3. Button 터치 타겟 (우선순위: 높음)
현재: py-2 px-4 (높이 약 36px)
개선: 최소 44px 보장
```tsx
// size variants 수정
const sizeClasses = {
  sm: 'min-h-[36px] sm:min-h-[32px] px-3 py-2 text-xs',
  md: 'min-h-[44px] sm:min-h-[40px] px-4 py-2 text-sm',
  lg: 'min-h-[48px] sm:min-h-[44px] px-6 py-3 text-base',
};
```

### 4. Input 터치 타겟 (우선순위: 높음)
```tsx
// 최소 높이 44px 보장
<input className="min-h-[44px] sm:min-h-[40px] px-3 py-2 text-base sm:text-sm" />
```

### 5. Pagination 모바일 최적화
- 페이지 번호 축소 (모바일: 3개, 데스크톱: 5개)
- 이전/다음 버튼 터치 영역 확대

## Vercel 스킬 적용 포인트
- React.memo로 불필요한 리렌더링 방지
- forwardRef 패턴 유지
- CSS-in-JS 대신 Tailwind 유틸리티 클래스 사용

## 완료 기준
- [ ] 모든 컴포넌트 모바일 뷰포트(375px)에서 정상 표시
- [ ] 터치 타겟 44px 이상 보장
- [ ] 기존 데스크톱 레이아웃 유지
- [ ] TypeScript 타입 에러 없음
- [ ] docs/tracking/CHANGELOG.md 업데이트
```

---

## 터미널 2: 레이아웃 컴포넌트

### 프롬프트

```markdown
# 소싱앱 모바일 UI 개선 - 레이아웃 컴포넌트

## 역할
레이아웃 컴포넌트(Header, Sidebar)의 모바일 반응형 개선 담당

## 담당 파일 (수정 가능)
- src/components/layout/Header.tsx
- src/components/layout/Sidebar.tsx
- src/app/(admin)/layout.tsx (레이아웃 관련만)

## 작업 내용

### 1. Header 드롭다운 반응형 (우선순위: 최상)
현재 문제:
- 알림 드롭다운: w-96 (384px) 고정 → 모바일에서 화면 초과
- 사용자 메뉴: w-56 (224px) 고정

개선 방향:
```tsx
// 알림 드롭다운
// Before
<div className="absolute right-0 mt-2 w-96 ...">

// After
<div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-[384px] ...">

// 사용자 메뉴
// Before
<div className="absolute right-0 mt-2 w-56 ...">

// After
<div className="absolute right-0 mt-2 w-48 sm:w-56 ...">
```

### 2. Header 모바일 통계 표시
현재: `hidden md:flex`로 완전히 숨김
개선: 모바일에서 간소화된 통계 표시 또는 드롭다운으로 접근
```tsx
// 모바일 축소 버전
<div className="flex md:hidden items-center gap-2">
  <span className="text-xs">수집: {stats.collected}</span>
  {/* 상세 통계는 드롭다운으로 */}
</div>
```

### 3. Sidebar 모바일 UX 개선
현재 문제:
- 모바일 오버레이 닫기가 불편함
- 메뉴 항목 터치 영역 부족

개선 방향:
```tsx
// 메뉴 항목 터치 영역 확대
<Link className="flex items-center gap-3 px-3 py-3 min-h-[48px] ...">

// 스와이프로 닫기 제스처 (선택)
// 오버레이 터치 시 닫기 더 명확하게
<div
  className="fixed inset-0 bg-black/50 z-20 lg:hidden"
  onClick={closeSidebar}
  role="button"
  aria-label="메뉴 닫기"
/>
```

### 4. 모바일 네비게이션 개선
- 현재 활성 메뉴 표시 강화
- 깊은 메뉴 구조 접근성 개선
- 섹션 탭(소싱/쇼핑몰) 전환 UX 개선

## Vercel 스킬 적용 포인트
- useCallback으로 이벤트 핸들러 메모이제이션 (이미 적용됨)
- 조건부 렌더링 최적화
- CSS transform 사용 (레이아웃 쉬프트 방지)

## 완료 기준
- [ ] 드롭다운이 모바일 화면 내에서 표시
- [ ] 모든 터치 타겟 44px 이상
- [ ] 사이드바 열기/닫기 UX 자연스러움
- [ ] 기존 데스크톱 레이아웃 유지
- [ ] TypeScript 타입 에러 없음
- [ ] docs/tracking/CHANGELOG.md 업데이트
```

---

## 터미널 3: 소싱 섹션 페이지

### 프롬프트

```markdown
# 소싱앱 모바일 UI 개선 - 소싱 섹션 페이지

## 역할
소싱 섹션 페이지들의 모바일 반응형 개선 담당

## 담당 파일 (수정 가능)
- src/app/(admin)/sourcing/dashboard/page.tsx
- src/app/(admin)/sourcing/channel/* (list, detail)
- src/app/(admin)/sourcing/collected-product/*
- src/app/(admin)/sourcing/product/* (list, detail)
- src/app/(admin)/sourcing/post/* (list, detail)
- src/app/(admin)/sourcing/publish/page.tsx
- src/app/(admin)/sourcing/automation/*
- src/app/(admin)/sourcing/settings/*
- src/components/product/* (ProductFormModal, PostSelectionModal 등)
- src/components/channel/ChannelFormModal.tsx
- src/components/automation/*
- src/components/dashboard/sourcing/*

## 작업 내용

### 1. 대시보드 카드 레이아웃 (우선순위: 높음)
```tsx
// 통계 카드 그리드
// Before
<div className="grid grid-cols-4 gap-4">

// After
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">

// 카드 내부 패딩 조정
<div className="p-3 sm:p-4 lg:p-6">
```

#### 1-1. 소싱 대시보드 수동 실행 버튼 개선 (우선순위: 높음)
현재 문제:
- 버튼 카드 패딩 `p-4` 고정 → 모바일에서 과다
- 아이콘 `w-10 h-10` 고정 → 모바일에서 과다
- 아이콘 마진 `mb-3` 고정 → 모바일에서 간격 과다

개선 방향:
```tsx
// 버튼 카드 (607행~)
// Before
<button className="... p-4 rounded-xl ...">
  <div className="w-10 h-10 rounded-lg ... mb-3">
  <p className="font-medium text-sm">
  <p className="text-xs mt-1">

// After
<button className="... p-3 sm:p-4 rounded-xl ...">
  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg ... mb-2 sm:mb-3">
  <p className="font-medium text-xs sm:text-sm">
  <p className="text-[10px] sm:text-xs mt-0.5 sm:mt-1">
```

변경 파일: `src/app/(admin)/sourcing/dashboard/page.tsx` (약 607~812행, 5개 버튼 모두)

### 2. 상품 목록 모바일 뷰 (우선순위: 최상)
현재: 테이블 레이아웃
개선: 모바일에서 카드 레이아웃 옵션
```tsx
// 그리드 뷰 토글
<div className="hidden lg:block">
  <Table ... /> {/* 데스크톱: 테이블 */}
</div>
<div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
  {products.map(p => <ProductCard key={p.id} />)} {/* 모바일: 카드 */}
</div>
```

### 3. ProductFormModal 모바일 최적화
- 이미지 업로드 영역 터치 친화적
- 옵션 입력 폼 세로 스택
- 가격 입력 숫자 키패드 활성화

```tsx
<input
  type="number"
  inputMode="numeric"
  pattern="[0-9]*"
  className="..."
/>
```

### 4. 채널 목록/상세 모바일 개선
- 채널 카드 레이아웃
- 상태 뱃지 가독성 향상
- 액션 버튼 그룹화

### 5. 발행 페이지 모바일 개선
- 상품 선택 UI 터치 친화적
- 발행 대상 선택 체크박스 크기 확대
- 진행 상태 표시 개선

### 6. 현황 카드 반응형 개선 (우선순위: 높음)
sm 브레이크포인트가 없는 현황 카드 페이지들:

| 페이지 | 위치 | 현재 | 개선 |
|--------|------|------|------|
| notification | 415행 | `grid-cols-1 md:grid-cols-5` | `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` |
| user/list | 129행 | `grid-cols-1 md:grid-cols-3` | `grid-cols-2 sm:grid-cols-3 md:grid-cols-3` |
| post/list | 555행 | `grid-cols-1 md:grid-cols-4` | `grid-cols-2 sm:grid-cols-2 md:grid-cols-4` |
| collected-product/list | 784행 | `grid-cols-1 md:grid-cols-4` | `grid-cols-2 sm:grid-cols-2 md:grid-cols-4` |

```tsx
// 공통 패턴
// Before
<div className="grid grid-cols-1 md:grid-cols-{N} gap-4 mb-6">

// After
<div className="grid grid-cols-2 sm:grid-cols-{ceil(N/2)} md:grid-cols-{N} gap-3 sm:gap-4 mb-6">
```

## Vercel 스킬 적용 포인트
- 이미지 lazy loading (next/image)
- 리스트 가상화 고려 (대량 상품)
- 조건부 렌더링으로 모바일/데스크톱 분기

## 완료 기준
- [ ] 모든 페이지 모바일 뷰포트(375px)에서 정상 작동
- [ ] 이미지/카드 레이아웃 반응형
- [ ] 폼 입력이 모바일에서 편리함
- [ ] TypeScript 타입 에러 없음
- [ ] docs/tracking/CHANGELOG.md 업데이트
```

---

## 터미널 4: 쇼핑몰 섹션 페이지

### 프롬프트

```markdown
# 소싱앱 모바일 UI 개선 - 쇼핑몰 섹션 페이지

## 역할
쇼핑몰 섹션 페이지들의 모바일 반응형 개선 담당

## 담당 파일 (수정 가능)
- src/app/(admin)/shop/dashboard/page.tsx
- src/app/(admin)/shop/order/* (list, detail, external)
- src/app/(admin)/shop/settlement/*
- src/app/(admin)/shop/coupon/*
- src/app/(admin)/shop/cs/inquiry/*
- src/app/(admin)/shop/user/*
- src/app/(admin)/shop/store/*
- src/app/(admin)/shop/reviews/*
- src/app/(admin)/shop/wholesale-orders/*
- src/components/shop/ShopFormModal.tsx
- src/components/settlement/SettlementModal.tsx

## 작업 내용

### 1. 쇼핑몰 대시보드 모바일 개선 (우선순위: 최상)
현재 문제:
- 헤더 레이아웃 `w-48` 고정 + `flex justify-center` → 모바일에서 깨짐
- 기간 필터 버튼 터치 타겟 부족 (`px-4 py-2`)
- KPI 카드 `p-6` 고정 패딩, `text-2xl` 고정 크기

개선 방향:
```tsx
// 헤더 레이아웃 (248~288행)
// Before
<div className="flex items-center justify-between">
  <div className="w-48">
  <div className="flex-1 flex items-center justify-center gap-3">
  <div className="w-48" />

// After
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
  <div className="w-full sm:w-48">
  <div className="flex-1 flex flex-wrap items-center justify-start sm:justify-center gap-2 sm:gap-3 w-full sm:w-auto">
  {/* w-48 spacer 제거 또는 hidden sm:block */}

// 기간 필터 버튼 (267행)
// Before
<button className="rounded-lg px-4 py-2 text-sm font-medium ...">

// After
<button className="rounded-lg px-3 sm:px-4 py-2 text-sm font-medium min-h-[44px] sm:min-h-[40px] ...">

// KPI 카드 컴포넌트 (121행)
// Before
<div className="... p-6 ...">
  <div className="rounded-xl bg-white/20 p-3">
  <p className="mt-1 text-2xl font-bold">

// After
<div className="... p-4 sm:p-6 ...">
  <div className="rounded-xl bg-white/20 p-2 sm:p-3">
  <p className="mt-1 text-xl sm:text-2xl font-bold">
```

변경 파일: `src/app/(admin)/shop/dashboard/page.tsx`

### 2. 주문 목록 모바일 뷰 (우선순위: 최상)
최근 개선: a2446795 "주문 상세 페이지 모바일 최적화"
추가 개선:
```tsx
// 주문 카드 레이아웃 (모바일)
<div className="lg:hidden space-y-3">
  {orders.map(order => (
    <div key={order.id} className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <span className="font-medium">{order.orderNumber}</span>
        <Badge>{order.status}</Badge>
      </div>
      <div className="text-sm text-gray-600">
        {order.customerName} · {formatDate(order.createdAt)}
      </div>
      <div className="mt-2 font-semibold">
        {formatPrice(order.totalAmount)}
      </div>
    </div>
  ))}
</div>
```

### 2. 주문 상세 모바일 개선
- 주문 정보 섹션 카드화
- 상태 변경 버튼 하단 고정
- 배송 정보 폼 세로 스택

### 3. 외부 주문 관리 모바일 개선
- 밴드 댓글 주문 목록 가독성
- 주문 생성 폼 모바일 최적화
- 상품 검색/선택 UI 개선

### 4. 발주 관리 모바일 개선
최근 개선: 6df88675 "발주 관리 모달 모바일 UX 개선"
추가 개선:
- 발주 상태 필터 드롭다운화
- 공급자별 그룹핑 뷰
- 일괄 처리 UI 개선

#### 4-1. 발주 현황 카드 반응형 개선 (우선순위: 높음)
현재 문제:
- 통계 카드: `grid-cols-1 md:grid-cols-5` → sm 브레이크포인트 없음
- 도매처 카드: `grid-cols-1 md:grid-cols-2` → 작은 태블릿에서 1열 유지

개선 방향:
```tsx
// 통계 카드 (519행): 모바일 2열 → sm 3열 → md 5열
// Before
<div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">

// After
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-6">

// 도매처 카드 (596행): sm 브레이크포인트 추가
// Before
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// After
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
```

변경 파일: `src/app/(admin)/shop/wholesale-orders/page.tsx`

### 5. 정산 페이지 모바일 개선
- 정산 요약 카드
- 상세 내역 아코디언
- 기간 선택 UI 터치 친화적

#### 5-1. 정산 현황 카드 반응형 개선 (우선순위: 높음)
현재 문제:
- 통계 카드: `grid-cols-1 md:grid-cols-4` → sm 브레이크포인트 없음

개선 방향:
```tsx
// 통계 카드 (440행): 모바일 2열 → sm 2열 → md 4열
// Before
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

// After
<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
```

변경 파일: `src/app/(admin)/shop/settlement/list/page.tsx`

### 6. CS 문의 모바일 개선
- 문의 목록 카드 뷰
- 답변 작성 UI 개선
- 이미지 첨부 모바일 최적화

### 7. 쇼핑몰 현황 카드 반응형 개선 (우선순위: 높음)
sm 브레이크포인트가 없는 현황 카드 페이지들:

| 페이지 | 위치 | 현재 | 개선 |
|--------|------|------|------|
| reviews/list | 175행 | `grid-cols-1 md:grid-cols-4` | `grid-cols-2 sm:grid-cols-2 md:grid-cols-4` |
| settlement/history | 227행 | `grid-cols-1 md:grid-cols-3` | `grid-cols-2 sm:grid-cols-3 md:grid-cols-3` |
| user/list | 135행 | `grid-cols-1 md:grid-cols-3` | `grid-cols-2 sm:grid-cols-3 md:grid-cols-3` |
| cs/inquiry/list | 172행 | `grid-cols-1 md:grid-cols-3` | `grid-cols-2 sm:grid-cols-3 md:grid-cols-3` |
| store/list | 248행 | `grid-cols-1 md:grid-cols-6` | `grid-cols-2 sm:grid-cols-3 md:grid-cols-6` |
| notification | 283행 | `grid-cols-1 md:grid-cols-5` | `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` |

```tsx
// 공통 패턴
// Before
<div className="grid grid-cols-1 md:grid-cols-{N} gap-4 mb-6">

// After
<div className="grid grid-cols-2 sm:grid-cols-{ceil(N/2)} md:grid-cols-{N} gap-3 sm:gap-4 mb-6">
```

## Vercel 스킬 적용 포인트
- 조건부 렌더링으로 모바일/데스크톱 분기
- 데이터 페칭 최적화 (SWR/React Query 패턴)
- 폼 상태 관리 최적화

## 완료 기준
- [ ] 모든 페이지 모바일 뷰포트(375px)에서 정상 작동
- [ ] 주문 플로우 모바일에서 완료 가능
- [ ] 정산 정보 모바일에서 확인 가능
- [ ] TypeScript 타입 에러 없음
- [ ] docs/tracking/CHANGELOG.md 업데이트
```

---

## 협업 규칙

### 파일 충돌 방지

| 터미널 | 담당 영역 | 금지 영역 |
|--------|----------|----------|
| 1 | src/components/ui/* | layout/*, pages |
| 2 | src/components/layout/* | ui/*, pages |
| 3 | src/app/(admin)/sourcing/*, src/components/{product,channel,automation,dashboard}/* | shop/*, ui/*, layout/* |
| 4 | src/app/(admin)/shop/*, src/components/{shop,settlement}/* | sourcing/*, ui/*, layout/* |

### 공유 리소스 변경 시

다음 파일 변경 시 **모든 터미널에 공지** 필요:
- `src/types/*.ts` (공통 타입)
- `src/hooks/*.ts` (공통 훅)
- `tailwind.config.ts` (스타일 설정)
- `src/lib/*.ts` (유틸리티)

### 커밋 규칙

```bash
# 터미널별 커밋 prefix
# 터미널 1
fix(sourcing): [UI] 모바일 모달 반응형 개선

# 터미널 2
fix(sourcing): [Layout] 헤더 드롭다운 모바일 최적화

# 터미널 3
fix(sourcing): [Sourcing] 상품 목록 모바일 카드 뷰 추가

# 터미널 4
fix(sourcing): [Shop] 주문 목록 모바일 레이아웃 개선
```

### 진행 상황 공유

각 터미널 작업 완료 시 `docs/tracking/CHANGELOG.md`에 기록:

```markdown
## TR-{YYYYMMDD}-{NNN}: 모바일 UI 개선 - {영역}

- **작업자**: 터미널 {N}
- **상태**: Done
- **변경 파일**:
  - src/components/ui/Modal.tsx
  - ...
- **주요 변경**:
  - 모달 max-width 반응형 적용
  - ...
```

---

## 시작 명령어

각 터미널에서 개발 서버 실행 후 작업 시작:

```bash
# 모든 터미널 공통
cd <프로젝트-경로>/bandauto
npm run dev:sourcing  # 포트 3001에서 실행
```

---

## Vercel 스킬 활용

각 터미널에서 작업 시작 전 Vercel React 베스트 프랙티스 스킬 참조:

```
/vercel-react-best-practices
```

주요 적용 포인트:
1. **컴포넌트 메모이제이션**: React.memo, useMemo, useCallback
2. **이미지 최적화**: next/image 컴포넌트 사용
3. **코드 스플리팅**: dynamic import 활용
4. **렌더링 최적화**: 조건부 렌더링, 키 관리
