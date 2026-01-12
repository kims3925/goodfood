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
