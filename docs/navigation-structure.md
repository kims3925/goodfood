# 네비게이션 메뉴 구조 개선 계획

## 현재 상황 분석

### 앱 구조
| 앱 | 역할 | 포트 |
|----|------|------|
| **sourcing-app** | 소싱 + 쇼핑몰 백오피스 (하이브리드) | 3001 |
| **shop-app** | 고객용 쇼핑몰 | 3000 |

### 현재 sourcing-app에 섞여있는 기능들
- **소싱**: 채널, 게시물, 수집상품, 상품가공, 발행, 자동화
- **쇼핑몰 백오피스**: 주문관리, 정산, 고객문의

### 문제점
1. 소싱과 쇼핑몰 백오피스가 같은 메뉴 레벨에 혼재
2. 향후 쇼핑몰 백오피스 확장 시 메뉴가 더 복잡해짐
3. 역할 기반 접근 제어가 없음

---

## 권장 구조: 탭 기반 분리

### 최상위 탭 (2개 영역 분리)
```
┌─────────────────────────────────────────────────┐
│  [소싱]  [쇼핑몰]                                │
├─────────────────────────────────────────────────┤
│                                                  │
│  (선택된 탭에 따라 사이드바 메뉴 변경)            │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 소싱 탭 메뉴
```
대시보드           /sourcing/dashboard

수집
├── 채널 관리      /sourcing/channel
├── 게시물         /sourcing/post/list
└── 수집상품       /sourcing/collected-product/list

상품
├── 가공상품       /sourcing/product/list
└── 발행상품       /sourcing/published-product/list

발행
├── 소매밴드       /sourcing/publish/retail-band
└── 쇼핑몰         /sourcing/publish/shopping-mall

자동화
├── 설정           /sourcing/automation/settings
└── 실행 로그      /sourcing/automation/logs

설정
├── 정책 관리      /sourcing/policy/list
├── API 설정       /sourcing/settings/api
└── AI 설정        /sourcing/settings/ai
```

### 쇼핑몰 탭 메뉴 (현재 + 확장 예정)
```
대시보드           /shop/dashboard        (신규)

주문
├── 주문 목록      /shop/order/list
├── 배송 관리      /shop/shipping/list    (신규)
└── 반품/교환      /shop/return/list      (신규)

정산
├── 정산 목록      /shop/settlement/list
└── 정산 이력      /shop/settlement/history

고객
├── 고객 목록      /shop/customer/list    (신규)
├── 고객 문의      /shop/cs/inquiry
└── 리뷰 관리      /shop/review/list      (신규)

프로모션                                   (신규)
├── 쿠폰 관리      /shop/coupon/list
└── 기획전         /shop/promotion/list

설정
├── 배송 설정      /shop/settings/shipping (신규)
└── 결제 설정      /shop/settings/payment  (신규)
```

---

## 구현 방식: URL prefix 방식

- `/sourcing/*` - 소싱 관련 모든 페이지
- `/shop/*` - 쇼핑몰 백오피스 모든 페이지
- 장점: 명확한 분리, 권한 관리 용이, URL 공유 가능

---

## 상세 구현 계획

### Step 1: 메뉴 설정 파일 생성
**파일**: `src/config/navigation.ts`

```typescript
export type AppSection = 'sourcing' | 'shop'

export const sourcingMenuItems: MenuItem[] = [
  { label: '대시보드', href: '/sourcing/dashboard', icon: LayoutDashboard },
  {
    label: '수집',
    icon: Download,
    children: [
      { label: '채널 관리', href: '/sourcing/channel' },
      { label: '게시물', href: '/sourcing/post/list' },
      { label: '수집상품', href: '/sourcing/collected-product/list' },
    ]
  },
  // ... 나머지 메뉴
]

export const shopMenuItems: MenuItem[] = [
  { label: '대시보드', href: '/shop/dashboard', icon: LayoutDashboard },
  {
    label: '주문',
    icon: ShoppingCart,
    children: [
      { label: '주문 목록', href: '/shop/order/list' },
      { label: '배송 관리', href: '/shop/shipping/list' },
    ]
  },
  // ... 나머지 메뉴
]
```

### Step 2: 라우트 그룹 재구성
**현재 구조**:
```
src/app/
├── (admin)/          ← 현재 모든 관리 페이지
│   ├── channel/
│   ├── order/
│   └── ...
```

**변경 후 구조**:
```
src/app/
├── (admin)/
│   ├── sourcing/     ← 소싱 관련 페이지
│   │   ├── dashboard/
│   │   ├── channel/
│   │   ├── post/
│   │   ├── collected-product/
│   │   ├── product/
│   │   ├── published-product/
│   │   ├── publish/
│   │   ├── automation/
│   │   ├── policy/
│   │   └── settings/
│   │
│   └── shop/         ← 쇼핑몰 백오피스 페이지
│       ├── dashboard/
│       ├── order/
│       ├── settlement/
│       ├── cs/
│       ├── customer/     (향후)
│       ├── review/       (향후)
│       ├── coupon/       (향후)
│       └── settings/
```

### Step 3: Sidebar 컴포넌트 수정
**파일**: `src/components/layout/Sidebar.tsx`

변경 사항:
1. 현재 URL에서 섹션(sourcing/shop) 감지
2. 섹션에 따라 다른 메뉴 렌더링
3. 섹션 전환 탭 UI 추가

```typescript
// pathname에서 현재 섹션 추출
const currentSection = pathname.startsWith('/shop') ? 'shop' : 'sourcing'
const menuItems = currentSection === 'shop' ? shopMenuItems : sourcingMenuItems
```

### Step 4: 섹션 전환 탭 UI (두 곳 배치)

**1. 사이드바 상단** - 탭 전환 버튼
```
┌──────────────────────────┐
│ 로고                     │
├──────────────────────────┤
│ [소싱] [쇼핑몰]          │  ← 탭 버튼
├──────────────────────────┤
│ 대시보드                 │
│ 수집                     │
│   ├─ 채널 관리           │
│   └─ ...                 │
└──────────────────────────┘
```

**2. 헤더 왼쪽** - 현재 섹션 표시 + 빠른 전환
```
┌─────────────────────────────────────────────────────┐
│ [소싱 ▼]  |  대시보드 > 수집상품            [알림] [프로필]│
└─────────────────────────────────────────────────────┘
     ↑ 드롭다운으로 섹션 전환 가능
```

### Step 5: 기존 페이지 마이그레이션

| 현재 경로 | 변경 경로 | 비고 |
|-----------|-----------|------|
| `/automation/dashboard` | `/sourcing/dashboard` | 소싱 대시보드 |
| `/channel` | `/sourcing/channel` | |
| `/post/list` | `/sourcing/post/list` | |
| `/collected-product/list` | `/sourcing/collected-product/list` | |
| `/product/list` | `/sourcing/product/list` | |
| `/published-product/list` | `/sourcing/published-product/list` | |
| `/publish/*` | `/sourcing/publish/*` | |
| `/automation/*` | `/sourcing/automation/*` | |
| `/policy/list` | `/sourcing/policy/list` | |
| `/admin/settings/*` | `/sourcing/settings/*` | |
| `/order/list` | `/shop/order/list` | 쇼핑몰로 이동 |
| `/settlement/*` | `/shop/settlement/*` | 쇼핑몰로 이동 |
| `/cs/inquiry` | `/shop/cs/inquiry` | 쇼핑몰로 이동 |

### Step 6: 리다이렉트 설정 (호환성)
**파일**: `next.config.js` 또는 미들웨어

기존 URL → 새 URL 리다이렉트 설정으로 북마크/링크 호환성 유지

---

## 작업 순서 (우선순위)

1. **`src/config/navigation.ts`** 생성 - 메뉴 정의 분리
2. **`src/components/layout/Sidebar.tsx`** 수정 - config import, 섹션 감지
3. **라우트 폴더 재구성** - sourcing/, shop/ 폴더 생성 및 페이지 이동
4. **리다이렉트 설정** - 기존 URL 호환성
5. **탭 UI 추가** - 섹션 전환 버튼

---

## 주요 파일
- `src/components/layout/Sidebar.tsx` - 사이드바 (313줄)
- `src/components/layout/Header.tsx` - 헤더 (238줄)
- `src/app/(admin)/layout.tsx` - 어드민 레이아웃
