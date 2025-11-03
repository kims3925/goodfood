# BandAuto Frontend - 프론트엔드 개발 가이드

## 프로젝트 개요

BandAuto 프론트엔드는 Next.js 14 App Router 기반의 현대적인 웹 애플리케이션입니다. 도매 밴드 상품 관리부터 AI 기반 상품 분석, 소매 판매 자동화까지의 전체 프로세스를 관리하는 사용자 인터페이스를 제공합니다.

## 기술 스택

### 프론트엔드 기술
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **Tables**: TanStack Table
- **Icons**: Lucide React
- **Authentication**: NextAuth.js

### 개발 도구
- **Linting**: ESLint
- **Formatting**: Prettier
- **Testing**: Playwright (E2E)
- **Git Hooks**: Husky

## 프로젝트 구조

```
app/                          # Next.js App Router
├── (auth)/                   # 인증 관련 페이지 그룹
│   ├── login/               # 로그인 페이지
│   └── register/            # 회원가입 페이지
├── (dashboard)/             # 대시보드 페이지 그룹
│   ├── layout.tsx          # 대시보드 공통 레이아웃
│   ├── page.tsx            # 메인 대시보드
│   ├── wholesale/          # 도매 밴드 관리
│   │   ├── page.tsx       # 도매 상품 목록
│   │   └── bands/         # 밴드 관리
│   ├── products/           # 상품 관리
│   │   ├── page.tsx       # 상품 목록
│   │   ├── new/           # 신규 상품 등록
│   │   └── [id]/          # 상품 상세/편집
│   └── settings/           # 설정 페이지
│       ├── band/          # 밴드 계정 설정
│       ├── strokepay/     # 스룩페이 설정
│       └── notifications/ # 알림 설정
├── api/                     # API Routes (Next.js)
├── layout.tsx               # 루트 레이아웃
├── page.tsx                 # 홈페이지
├── globals.css              # 전역 스타일
└── not-found.tsx           # 404 페이지

components/                   # React 컴포넌트
├── ui/                      # 기본 UI 컴포넌트 (shadcn/ui)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── modal.tsx
│   ├── table.tsx
│   └── loading.tsx
├── layout/                  # 레이아웃 컴포넌트
│   ├── header.tsx
│   ├── sidebar.tsx
│   └── footer.tsx
├── wholesale/               # 도매 관련 컴포넌트
│   ├── BandSelector.tsx
│   ├── ProductCollector.tsx
│   ├── PostCard.tsx
│   └── PostDetailModal.tsx
├── products/                # 상품 관련 컴포넌트
│   ├── ProductEditor.tsx
│   ├── AIContentEditor.tsx
│   ├── PriceCalculator.tsx
│   └── ProductTable.tsx
└── common/                  # 공통 컴포넌트
    ├── SessionProvider.tsx
    ├── LoginModal.tsx
    └── ConfirmDialog.tsx

hooks/                       # Custom React Hooks
├── useAutomation.ts
├── useBandPosts.ts
├── useOrders.ts
└── useProductCollection.ts

types/                       # TypeScript 타입 정의
├── band.d.ts
├── product.d.ts
├── order.d.ts
├── automation.d.ts
└── ui.d.ts

styles/                      # 스타일 파일
├── globals.css              # 전역 스타일
├── theme-variables.css      # 테마 변수
└── components/              # 컴포넌트별 스타일
```

## UI/UX Design System

### 색상 시스템 (White Theme)

```css
:root {
  /* Primary Colors */
  --primary-color: #2563eb;        /* 메인 브랜드 색상 (파란색) */
  --primary-hover: #1d4ed8;        /* 호버 시 어두운 파란색 */
  --primary-light: #dbeafe;        /* 밝은 파란색 배경 */
  
  /* Secondary Colors */
  --secondary-color: #10b981;      /* 보조 색상 (초록색) */
  --secondary-hover: #059669;      
  --secondary-light: #d1fae5;
  
  /* Neutral Colors */
  --background: #ffffff;            /* 메인 배경 */
  --surface: #f9fafb;              /* 카드/섹션 배경 */
  --border: #e5e7eb;               /* 테두리 색상 */
  --divider: #f3f4f6;              /* 구분선 */
  
  /* Text Colors */
  --text-primary: #111827;         /* 주요 텍스트 */
  --text-secondary: #6b7280;       /* 보조 텍스트 */
  --text-muted: #9ca3af;           /* 희미한 텍스트 */
  --text-inverse: #ffffff;         /* 반전 텍스트 */
  
  /* Status Colors */
  --success: #10b981;              /* 성공 */
  --warning: #f59e0b;              /* 경고 */
  --error: #ef4444;                /* 에러 */
  --info: #3b82f6;                 /* 정보 */
}
```

### 타이포그래피

```css
/* 폰트 패밀리 */
--font-sans: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "Fira Code", "Courier New", monospace;

/* 폰트 크기 */
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
--text-4xl: 2.25rem;    /* 36px */
```

### 컴포넌트 디자인 패턴

#### 버튼 컴포넌트
```tsx
// Primary Button
<button className="
  px-4 py-2 
  bg-primary-color text-white 
  rounded-md 
  font-medium 
  hover:bg-primary-hover 
  transition-colors 
  duration-200
  focus:outline-none 
  focus:ring-2 
  focus:ring-primary-color 
  focus:ring-offset-2
">
  버튼 텍스트
</button>

// Secondary Button  
<button className="
  px-4 py-2 
  bg-white text-primary-color 
  border border-primary-color 
  rounded-md 
  font-medium 
  hover:bg-primary-light 
  transition-colors 
  duration-200
">
  버튼 텍스트
</button>
```

#### 카드 컴포넌트
```tsx
const Card = ({ children, className = "" }) => (
  <div className={`
    bg-white 
    border border-border 
    rounded-lg 
    shadow-sm 
    hover:shadow-md 
    transition-shadow 
    duration-200
    ${className}
  `}>
    {children}
  </div>
);
```

#### 모달 컴포넌트
```tsx
const Modal = ({ isOpen, onClose, children }) => (
  <>
    {/* 오버레이 */}
    <div className="
      fixed inset-0 
      bg-black/50 
      backdrop-blur-sm 
      z-40
    " onClick={onClose} />
    
    {/* 모달 콘텐츠 */}
    <div className="
      fixed 
      top-1/2 left-1/2 
      transform -translate-x-1/2 -translate-y-1/2 
      bg-white 
      rounded-xl 
      shadow-xl 
      p-6 
      z-50 
      max-w-md 
      w-full
    ">
      {children}
    </div>
  </>
);
```

## 반응형 디자인

### 브레이크포인트
```css
/* Tailwind 기본 브레이크포인트 */
sm: 640px   /* 모바일 가로 */
md: 768px   /* 태블릿 */
lg: 1024px  /* 데스크톱 */
xl: 1280px  /* 큰 데스크톱 */
2xl: 1536px /* 초대형 화면 */
```

### 레이아웃 예시
```tsx
// 반응형 그리드
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* 그리드 아이템 */}
</div>

// 사이드바 레이아웃
<div className="flex flex-col lg:flex-row gap-6">
  <aside className="w-full lg:w-64 flex-shrink-0">
    {/* 사이드바 */}
  </aside>
  <main className="flex-1">
    {/* 메인 콘텐츠 */}
  </main>
</div>
```

## 주요 페이지별 기능

### 1. 홈페이지 (`/`)
- 메인 랜딩 페이지
- 서비스 소개 및 주요 기능 안내
- 로그인/회원가입 링크

### 2. 인증 페이지 (`/login`, `/register`)
- NextAuth.js 기반 인증
- 이메일/비밀번호 로그인
- 회원가입 폼
- 소셜 로그인 (추후 확장)

### 3. 대시보드 (`/dashboard`)
- 전체 시스템 현황 개요
- 수집된 상품 통계
- 최근 활동 로그
- 빠른 작업 링크

### 4. 도매 밴드 관리 (`/dashboard/wholesale`)
- 도매 밴드 등록/관리
- 상품 수집 실행
- 수집된 게시물 목록 (3가지 뷰모드)
- AI 분석 결과 확인
- 소싱 확정 처리

### 5. 상품 관리 (`/dashboard/products`)
- 소싱 확정된 상품 목록
- 상품 정보 편집
- AI 생성 콘텐츠 수정
- 가격 마진 설정
- 스룩페이 연동 상태

### 6. 설정 페이지 (`/dashboard/settings`)
- 밴드 API 연동 설정
- 스룩페이 계정 설정
- 알림 설정
- 사용자 프로필 관리

## 상태 관리

### Zustand Store 예시
```typescript
// stores/useProductStore.ts
interface ProductStore {
  products: Product[]
  selectedProducts: string[]
  viewMode: 'card' | 'list' | 'table'
  filters: ProductFilters
  
  setProducts: (products: Product[]) => void
  toggleProductSelection: (id: string) => void
  setViewMode: (mode: 'card' | 'list' | 'table') => void
  updateFilters: (filters: ProductFilters) => void
}

const useProductStore = create<ProductStore>((set) => ({
  products: [],
  selectedProducts: [],
  viewMode: 'card',
  filters: {},
  
  setProducts: (products) => set({ products }),
  toggleProductSelection: (id) => set((state) => ({
    selectedProducts: state.selectedProducts.includes(id)
      ? state.selectedProducts.filter(p => p !== id)
      : [...state.selectedProducts, id]
  })),
  setViewMode: (viewMode) => set({ viewMode }),
  updateFilters: (filters) => set({ filters })
}))
```

## Custom Hooks

### API 호출 Hook 예시
```typescript
// hooks/useProductCollection.ts
export const useProductCollection = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const collectProducts = async (bandIds: string[]) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/wholesale/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bandIds })
      })
      
      if (!response.ok) throw new Error('수집 실패')
      
      // Server-Sent Events로 진행률 추적
      const eventSource = new EventSource(`/api/wholesale/collect/progress`)
      eventSource.onmessage = (event) => {
        const { progress } = JSON.parse(event.data)
        setProgress(progress)
      }
      
      return response.json()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    collectProducts,
    isLoading,
    progress,
    error
  }
}
```

## 폼 관리 (React Hook Form + Zod)

```typescript
// schemas/productSchema.ts
import { z } from 'zod'

export const productSchema = z.object({
  title: z.string().min(1, '제목을 입력하세요').max(50, '제목은 50자 이하로 입력하세요'),
  price: z.number().min(0, '가격은 0 이상이어야 합니다'),
  category: z.enum(['SEAFOOD', 'MEAT', 'AGRICULTURE', 'PROCESSED', 'OTHER']),
  description: z.string().min(10, '설명은 최소 10자 이상 입력하세요'),
  images: z.array(z.string()).min(1, '최소 1개 이상의 이미지가 필요합니다')
})

// components/ProductForm.tsx
const ProductForm = ({ product, onSubmit }) => {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product || {}
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          제목
        </label>
        <input
          {...form.register('title')}
          className="mt-1 block w-full border-gray-300 rounded-md"
        />
        {form.formState.errors.title && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>
      
      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full btn-primary"
      >
        {form.formState.isSubmitting ? '저장 중...' : '저장'}
      </button>
    </form>
  )
}
```

## 테스팅

### E2E 테스트 (Playwright)
```typescript
// tests/homepage.spec.ts
import { test, expect } from '@playwright/test'

test('홈페이지 로딩 테스트', async ({ page }) => {
  await page.goto('http://localhost:3000')
  
  // 페이지 제목 확인
  await expect(page).toHaveTitle(/BandAuto/)
  
  // 주요 요소 확인
  await expect(page.locator('h1')).toContainText('BandAuto')
  await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
  
  // 로그인 버튼 클릭 테스트
  await page.click('[data-testid="login-button"]')
  await expect(page.locator('[data-testid="login-modal"]')).toBeVisible()
})

test('대시보드 접근 테스트', async ({ page }) => {
  // 로그인 후 대시보드 접근
  await page.goto('http://localhost:3000/login')
  await page.fill('[name="email"]', 'test@bandauto.com')
  await page.fill('[name="password"]', 'test123!@#')
  await page.click('button[type="submit"]')
  
  // 대시보드 페이지 확인
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.locator('h1')).toContainText('대시보드')
})
```

## 성능 최적화

### 이미지 최적화
```tsx
import Image from 'next/image'

// Next.js Image 컴포넌트 사용
<Image
  src={product.imageUrl}
  alt={product.title}
  width={300}
  height={200}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
  priority={isAboveTheFold}
/>
```

### 동적 임포트
```tsx
// 큰 컴포넌트는 동적 임포트
const AIContentEditor = dynamic(() => import('./AIContentEditor'), {
  loading: () => <div className="animate-pulse">로딩 중...</div>,
  ssr: false
})
```

### 메모화
```tsx
// 비용이 큰 계산은 useMemo로 메모화
const expensiveValue = useMemo(() => {
  return products.reduce((sum, product) => sum + product.price, 0)
}, [products])

// 콜백 함수는 useCallback으로 메모화
const handleProductSelect = useCallback((productId: string) => {
  setSelectedProducts(prev => 
    prev.includes(productId) 
      ? prev.filter(id => id !== productId)
      : [...prev, productId]
  )
}, [])
```

## 접근성 (Accessibility)

### 기본 원칙
- 의미있는 HTML 시맨틱 태그 사용
- 모든 인터랙티브 요소에 키보드 접근 가능
- 충분한 색상 대비 (WCAG AA 기준)
- 적절한 `aria-label` 및 `role` 속성

### 예시 코드
```tsx
// 접근 가능한 버튼
<button
  aria-label="상품 삭제"
  onClick={handleDelete}
  className="p-2 text-red-500 hover:bg-red-50 rounded"
>
  <TrashIcon size={16} />
</button>

// 접근 가능한 모달
<div
  role="dialog"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
  aria-modal="true"
>
  <h2 id="modal-title">확인</h2>
  <p id="modal-description">정말 삭제하시겠습니까?</p>
</div>
```

## 개발 환경 설정

### 필수 확장 프로그램 (VS Code)
- ES7+ React/Redux/React-Native snippets
- Tailwind CSS IntelliSense
- TypeScript Importer
- Auto Rename Tag
- Prettier - Code formatter
- ESLint

### 개발 서버 실행
```bash
# 개발 서버 시작 (자동 포트 정리)
npm run dev

# 포트 정리 없이 직접 시작
npm run dev:direct

# 타입 체크
npm run type-check

# 린트 검사
npm run lint

# E2E 테스트
npm test
```

## 코딩 규칙 및 컨벤션

### 네이밍 컨벤션
- **컴포넌트**: PascalCase (`ProductCard.tsx`)
- **함수/변수**: camelCase (`handleSubmit`, `isLoading`)
- **상수**: UPPER_SNAKE_CASE (`API_ENDPOINTS`)
- **CSS 클래스**: kebab-case 또는 Tailwind utility

### 파일 구조 규칙
```tsx
// 파일 상단: imports (React → 라이브러리 → 로컬)
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Card } from '@/components/ui/card'
import { useProductStore } from '@/stores/useProductStore'

// 타입 정의
interface Props {
  product: Product
  onEdit: (product: Product) => void
}

// 메인 컴포넌트
export const ProductCard: React.FC<Props> = ({ product, onEdit }) => {
  // hooks
  const [isLoading, setIsLoading] = useState(false)
  
  // handlers
  const handleEdit = () => {
    onEdit(product)
  }
  
  // render
  return (
    <Card className="p-4">
      {/* JSX */}
    </Card>
  )
}

// 기본 export
export default ProductCard
```

## 트러블슈팅

### 자주 발생하는 이슈

1. **Hydration Mismatch**
   ```tsx
   // 잘못된 방법
   const [mounted, setMounted] = useState(false)
   useEffect(() => setMounted(true), [])
   if (!mounted) return null
   
   // 올바른 방법
   const Component = dynamic(() => import('./Component'), { ssr: false })
   ```

2. **무한 리렌더링**
   ```tsx
   // 잘못된 방법
   const [data, setData] = useState([])
   useEffect(() => {
     fetchData().then(setData)
   }, [data]) // 의존성 배열에 data 포함
   
   // 올바른 방법
   useEffect(() => {
     fetchData().then(setData)
   }, []) // 빈 의존성 배열
   ```

3. **NextAuth 세션 이슈**
   ```tsx
   // SessionProvider로 앱 전체 감싸기
   import { SessionProvider } from 'next-auth/react'
   
   export default function App({ Component, pageProps: { session, ...pageProps } }) {
     return (
       <SessionProvider session={session}>
         <Component {...pageProps} />
       </SessionProvider>
     )
   }
   ```

## 배포 및 최적화

### Vercel 배포 설정
```json
// vercel.json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 60
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

### 성능 모니터링
- Vercel Analytics 연동
- Web Vitals 측정
- Bundle Analyzer를 통한 번들 크기 최적화

### SEO 최적화
```tsx
// app/layout.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BandAuto - 밴드 자동화 판매 시스템',
  description: '도매 밴드 상품을 AI로 분석하여 소매 판매를 자동화하는 시스템',
  keywords: ['밴드', '자동화', 'AI', '상품관리'],
  openGraph: {
    title: 'BandAuto',
    description: '밴드 자동화 판매 시스템',
    url: 'https://bandauto.vercel.app',
    siteName: 'BandAuto'
  }
}
```