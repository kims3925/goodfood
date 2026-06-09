# 프론트엔드 규칙

> **관련 문서:** [STRUCTURE.md](./STRUCTURE.md) | [PROJECT.md](./PROJECT.md) | [CLAUDE.md](../CLAUDE.md)

---

## 기술 스택

| 항목 | 기술 | 버전 |
|-----|-----|-----|
| Framework | Next.js (App Router) | 14.2.3 |
| Language | TypeScript | 5.9 |
| State | Zustand | 4.5 |
| Form | React Hook Form | 7.49 |
| Validation | Zod | 3.22 |
| UI | Tailwind CSS | 3.4 |
| Icons | Lucide React | - |

---

## 핵심 원칙

| 원칙 | 설명 |
|-----|-----|
| UI는 비즈니스 흐름 표현 | 복잡한 로직은 백엔드 위임 |
| 렌더링 전략 의도적 선택 | SSR/SSG/CSR 명확한 이유 |
| 상태는 가장 가까운 곳에만 | 불필요한 전역 상태 금지 |
| 단일 책임 원칙 | 한 컴포넌트 = 한 역할 |

---

## 앱별 구조

### sourcing-app (포트 3001)

```text
src/
├── app/
│   ├── (admin)/              # 인증 필요 라우트
│   │   ├── sourcing/         # 소싱 관리
│   │   │   ├── channels/     # 채널 관리
│   │   │   ├── posts/        # 게시물 관리
│   │   │   ├── products/     # 상품 관리
│   │   │   ├── automation/   # 자동화 설정
│   │   │   ├── settings/     # 설정
│   │   │   └── user/         # 매니저 관리
│   │   └── shop/             # 쇼핑몰 관리
│   │       ├── order/        # 주문 관리
│   │       ├── coupon/       # 쿠폰 관리
│   │       ├── cs/           # CS 관리
│   │       ├── settlement/   # 정산 관리
│   │       └── user/         # 회원 관리
│   └── api/                  # API Routes
├── components/
│   ├── layout/               # Header, Sidebar
│   ├── ui/                   # 공통 UI
│   ├── product/              # 상품 컴포넌트
│   └── shop/                 # 쇼핑몰 컴포넌트
├── modules/                  # 도메인 로직
└── services/                 # API 호출
```

### shop-app (포트 3000)

```text
src/
├── app/
│   ├── (shop)/               # 쇼핑몰 라우트
│   │   ├── auth/             # 로그인, 회원가입
│   │   ├── product/[id]/     # 상품 상세
│   │   ├── cart/             # 장바구니
│   │   ├── checkout/         # 결제
│   │   ├── mypage/           # 마이페이지
│   │   └── order/            # 주문
│   └── api/                  # API Routes
├── components/               # UI 컴포넌트
├── hooks/                    # Custom Hooks
└── services/                 # API 호출
```

---

## 컴포넌트 규칙

### Server Component (기본)

| 규칙 |
|-----|
| 모든 컴포넌트는 Server Component 기본 |
| 데이터 패칭은 Server Component에서 |
| `async/await` 직접 사용 |

### Client Component

| `"use client"` 허용 사유 |
|------------------------|
| 이벤트 핸들러 (onClick, onChange) |
| 브라우저 API (localStorage, window) |
| React 훅 (useState, useEffect) |
| 클라이언트 전용 라이브러리 |

---

## 상태 관리

| 상태 유형 | 도구 | 용도 |
|---------|-----|-----|
| Server State | fetch + cache | API 데이터 |
| Client State | Zustand | 전역 UI 상태 |
| Form State | React Hook Form + Zod | 폼, 유효성 검사 |
| URL State | useSearchParams | 검색, 필터, 페이지 |

### Zustand Store 패턴

```typescript
// stores/useAuthStore.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
```

---

## 폼 유효성 검사

### Zod + React Hook Form 패턴

```typescript
// schemas/product.schema.ts
import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().min(1, '상품명을 입력해주세요'),
  price: z.number().min(0, '가격은 0 이상이어야 합니다'),
  description: z.string().optional(),
})

export type ProductFormData = z.infer<typeof productSchema>
```

```typescript
// components/ProductForm.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productSchema, ProductFormData } from '@/schemas/product.schema'

export function ProductForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
    </form>
  )
}
```

---

## 에러 처리

| 규칙 |
|-----|
| 각 라우트에 `error.tsx` 배치 |
| 전역 에러는 `global-error.tsx` |
| 사용자 친화적 메시지 표시 |

### 에러 바운더리 패턴

```typescript
// app/(admin)/sourcing/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="p-4 bg-red-50 rounded-lg">
      <h2>오류가 발생했습니다</h2>
      <p>{error.message}</p>
      <button onClick={reset}>다시 시도</button>
    </div>
  )
}
```

---

## 로딩 상태

| 규칙 |
|-----|
| 각 라우트에 `loading.tsx` 배치 |
| Suspense로 부분 로딩 |
| 스켈레톤 UI 사용 |

```typescript
// app/(admin)/sourcing/products/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
      <div className="h-4 bg-gray-200 rounded w-full mb-2" />
      <div className="h-4 bg-gray-200 rounded w-3/4" />
    </div>
  )
}
```

---

## 이미지 처리

### next/image 사용

```typescript
import Image from 'next/image'

// 외부 이미지 (Band 등)
<Image
  src={imageUrl}
  alt={productName}
  width={300}
  height={300}
  unoptimized  // 외부 도메인은 unoptimized 사용
/>
```

### 이미지 Fallback

```typescript
// components/ui/ImageWithFallback.tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'

export function ImageWithFallback({ src, alt, ...props }) {
  const [error, setError] = useState(false)

  return (
    <Image
      src={error ? '/placeholder.png' : src}
      alt={alt}
      onError={() => setError(true)}
      {...props}
    />
  )
}
```

---

## 성능 규칙

| 항목 | 구현 |
|-----|-----|
| 렌더링 | Server Component 우선 |
| 재렌더링 | React.memo, useMemo, useCallback |
| 이미지 | next/image 필수 |
| 코드 분할 | dynamic import, Suspense |

### useCallback 패턴

```typescript
// 의존성이 있는 함수는 useCallback으로 메모이제이션
const loadNotifications = useCallback(async () => {
  const response = await fetch('/api/notifications')
  setNotifications(await response.json())
}, [currentSection])  // 의존성 명시

useEffect(() => {
  loadNotifications()
}, [loadNotifications])  // eslint-disable 대신 의존성 추가
```

### 함수형 상태 업데이트

```typescript
// Stale Closure 방지를 위해 함수형 업데이트 사용
setSettings(prev => ({
  ...prev,
  geminiApiKey: data.settings.gemini?.apiKey || '',
}))
```

---

## Tailwind CSS 규칙

| 규칙 |
|-----|
| 디자인 토큰 기반 스타일링 |
| 컴포넌트별 스타일 응집 |
| 임의 값 사용 최소화 (`[123px]` 등) |

### 공통 컬러 팔레트

```text
primary: blue-600
secondary: gray-600
success: green-600
warning: amber-600
error: red-600
```

---

## 접근성

| 항목 | 기준 |
|-----|-----|
| 텍스트 대비 | 최소 4.5:1 (WCAG AA) |
| 키보드 | 모든 인터랙티브 요소 접근 가능 |
| Focus | 키보드 포커스 시각적 표시 |
| Alt Text | 모든 의미 있는 이미지 |
| Touch Target | 최소 44x44px |

---

## 금지사항

| 금지 | 이유 |
|-----|-----|
| 라우트 레벨에 비즈니스 로직 | 유지보수 어려움 |
| 공통 컴포넌트 복사 사용 | 중복 코드 |
| `dangerouslySetInnerHTML` (미정화) | XSS 위험 |
| 디자인 토큰 무시 임의 스타일 | 일관성 파괴 |
| `any` 타입 | 타입 안전성 |
| 프로덕션 `console.log` | 보안/성능 |
| eslint-disable 남용 | 코드 품질 저하 |

---

## 주요 페이지

### 외부 주문 관리

**외부 주문 추가 (`/shop/order/external/new`)**

- 외부 채널(밴드 댓글, 문자 등)에서 받은 주문을 시스템에 등록
- 배송비 포함 판매가 자동 계산
- 결제금액 수동 조정 기능 (할인/협의 가격)
- 주문 생성 성공 모달

**주요 기능:**
```typescript
// 자동 계산 금액 표시
const calculateAutoTotal = () => {
  // 합배송 규칙 적용하여 자동 계산
}

// 최종 결제금액 (수동 입력 우선)
const finalAmount = customTotalAmount ?? calculateAutoTotal()
```

**외부 주문 수정 (`/shop/order/external/edit/[orderNumber]`)**

- 외부 주문 정보 조회 및 표시
- 주문 정보 수정 (현재 조회만 가능)

**주문 목록 (`/shop/order/list`)**

- 외부 주문(주문번호 'X'로 시작) 판별
- 수정/삭제 버튼 표시 (외부 주문에만)
- 삭제 확인 모달

**변경 이력:**
- TR-20260115-007: 외부 주문 배송비 반영 및 결제금액 수동 조정
- TR-20260115-010: 외부 주문 수정 및 삭제 기능 추가
- TR-20260115-011: 외부 주문 CRUD API 및 수정 페이지 구현

---

### 파이프라인 통합 대시보드

**URL:** `/pipeline`

**설명:** 소싱 자동화, 주문/발주, 정산 현황을 한 화면에서 통합 관리하는 대시보드입니다.

**주요 기능:**
- 소싱 섹션: 자동화 실행 횟수, 수집/발행 통계
- 주문/발주 섹션: 대기 중인 발주 수량, 완료된 발주 현황
- 정산 섹션: 월별 결제액, 거래 건수, 상태별 현황
- 기간 선택: 주/월/분기별 조회 가능
- 데이터 갱신: 주기적 자동 갱신 및 수동 새로고침

**변경 이력:**
- TR-20260318-001: 페이지 추가



## 2026-05-15 변경사항

자세한 내역은 docs/tracking/CHANGELOG.md TR-20260515-001 ~ TR-20260515-013 참조.

### 신규 페이지

- `/sourcing/publish/ad/notice` — 밴드공지 설정 (광고&마케팅 메뉴 하위)
  · 활성화 토글, 공지 시간(HH:MM 다건), Top N, 중요공지, 발행 대상 소매밴드, 도매방 출처 필터, 카테고리 필터, 톤 힌트

### 신규 컴포넌트

- `components/automation/AutomationFlowControl.tsx` — 자동화설정 페이지의 흐름 제어 패널
  · 실행 중 워크플로우 다건 표시, 메모리 cron 등록 상태, 액션: 전체 중지/cron 재등록/stuck 정리/영구 비활성화
- `components/band-session/SessionHealthBanner.tsx` — 매니저 대시보드 최상단 세션 헬스 알림
  · HEALTHY 면 렌더 안 함, WARNING 노란, CRITICAL 빨강. 30초 폴링

### 메뉴 라벨 변경

- '광고' → '광고&마케팅' (하위메뉴 '밴드공지' 추가)

### 페이지 동작 변경

- `/sourcing/product/list` ProcessedProductTab, `/sourcing/publish` 재발행, `/sourcing/post/list` Stage2 — 모두 백그라운드 잡으로 (탭 닫아도 진행)

## 2026-06-10 변경사항

### `/sourcing/settings/api` (API 설정)

- Band API 탭 상단에 **"밴드 로그인 계정"** 섹션 추가 — `User.bandLoginEmail` 입력/저장
  (`GET/PUT /api/settings/band-account`, 기존 SourcingApiConfig 저장과 별개 상태/버튼).
- 발행·삭제 작업에 사용할 밴드 마스터 계정을 등록하면 세션 저장 시 계정 일치를 서버가 검증.

### Header 세션 인디케이터

- 세션 상태 툴팁의 채널 행에 저장된 세션의 밴드 계정(`sessionAccountEmail`) 표시 (보라색 작은 글씨).

### Chrome 확장 (band-session-extension v1.2.0)

- 팝업: 서버에 설정된 밴드 로그인 계정 표시 + 확인 체크박스 (체크 전 저장 버튼 비활성).
- 저장 시 `bandAccountEmail` 회신, 성공 시 `chrome.storage.local.confirmedBandAccountEmail` 저장.
- background 자동저장(1시간 주기)은 팝업에서 확인된 계정을 회신 — 미확인 상태로 409 거부되면
  팝업을 열어 1회 수동 저장하면 이후 자동저장이 재개됨.

### `/sourcing/pipeline` (소싱 현황판, 2026-06-10 신설)

- 사이드바 "상품 > 소싱 현황" 메뉴. 기존 post/list(미가공만)와 달리 **가공·발행된 기존 게시물 포함 전체**를 보여줌.
- 단계 요약 카드 4개(전체/수집됨·미가공/가공완료·미발행/발행완료)가 클릭 필터로 동작.
- 행: 수집일 / 도매채널 / 원본 상품명(+가공명) / AI가공 시각 / 소매밴드 발행 칩 / 쇼핑몰 발행 칩 / 바로가기(가공상품 상세·도매 원본글).
- 검색·도매채널·수집일 범위 필터 + 20/50/100 페이지네이션.
