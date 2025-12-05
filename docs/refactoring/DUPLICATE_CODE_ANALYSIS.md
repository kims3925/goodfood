# 중복 코드 분석 보고서

> 분석일: 2025-11-27
> 브랜치: hong
> 분석 범위: sourcing-app/src/app/api, sourcing-app/src/app/(admin)

---

## 개요

이 문서는 현재 코드베이스에서 발견된 중복 패턴과 리팩토링 제안을 정리합니다.

| 중복 패턴 | 영향 파일 수 | 예상 절감 라인 |
|----------|-------------|---------------|
| 인증 체크 패턴 | 10+ | ~100줄 |
| 선택/삭제 로직 | 5+ | ~150줄 |
| 날짜/가격 포맷팅 | 5+ | ~50줄 |
| Fetch 로직 | 5+ | ~200줄 |
| API Response 패턴 | 10+ | ~100줄 |
| Prisma Client 인스턴스 | 3 | 3줄 |

---

## 1. API Route 인증 체크 패턴

### 발견 파일

- `api/order/route.ts`
- `api/order/[id]/route.ts`
- `api/product/route.ts`
- `api/product/[id]/route.ts`
- `api/settlement/route.ts`
- `api/settlement/[id]/route.ts`
- `api/policy/route.ts`
- `api/policy/[id]/route.ts`
- `api/post/route.ts`
- `api/settings/ai/route.ts`

### 중복 코드

```typescript
// 패턴 A - 거의 모든 API route에서 반복
const currentUser = await getCurrentUser()
if (!currentUser) {
  return NextResponse.json(
    { success: false, error: '로그인이 필요합니다.' },
    { status: 401 }
  )
}
const userId = currentUser.userId

// 패턴 B - 에러 메시지 불일치
// 일부: '인증이 필요합니다.'
// 일부: '로그인이 필요합니다.'
```

### 리팩토링 제안

**파일 생성: `src/lib/api/auth.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getCurrentUser, TokenPayload } from '@/modules/auth/auth.service'

export type AuthResult =
  | { success: true; user: TokenPayload }
  | { success: false; response: NextResponse }

export async function requireAuth(): Promise<AuthResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }
  }

  return { success: true, user }
}
```

**사용 예시:**

```typescript
// Before
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId
    // ... 비즈니스 로직
  } catch (error) {
    // ...
  }
}

// After
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return auth.response

    const { userId } = auth.user
    // ... 비즈니스 로직
  } catch (error) {
    // ...
  }
}
```

---

## 2. 페이지 컴포넌트 선택/삭제 로직

### 발견 파일

- `(admin)/order/list/page.tsx`
- `(admin)/product/list/page.tsx`
- `(admin)/post/list/page.tsx`
- `(admin)/policy/list/page.tsx`
- `(admin)/settlement/list/page.tsx`

### 중복 코드

```typescript
// 전체 선택/해제 - 4개 이상 파일에서 동일
const handleToggleSelectAll = () => {
  if (selectAll) {
    setSelectedIds([])
    setSelectAll(false)
  } else {
    const allIds = items.map((item) => item.id)
    setSelectedIds(allIds)
    setSelectAll(true)
  }
}

// 개별 선택/해제 - 4개 이상 파일에서 동일
const handleToggleSelection = (id: number) => {
  setSelectedIds((prev) => {
    const newSelection = prev.includes(id)
      ? prev.filter((i) => i !== id)
      : [...prev, id]
    setSelectAll(newSelection.length === items.length)
    return newSelection
  })
}
```

### 리팩토링 제안

**파일 생성: `src/hooks/useSelection.ts`**

```typescript
import { useState, useCallback, useMemo } from 'react'

interface UseSelectionOptions<T> {
  items: T[]
  getId: (item: T) => number
}

export function useSelection<T>({ items, getId }: UseSelectionOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const selectAll = useMemo(
    () => items.length > 0 && selectedIds.length === items.length,
    [items.length, selectedIds.length]
  )

  const toggleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map(getId))
    }
  }, [selectAll, items, getId])

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  const isSelected = useCallback(
    (id: number) => selectedIds.includes(id),
    [selectedIds]
  )

  return {
    selectedIds,
    selectAll,
    selectedCount: selectedIds.length,
    toggleSelectAll,
    toggleSelection,
    clearSelection,
    isSelected,
  }
}
```

**사용 예시:**

```typescript
// Before
const [selectedIds, setSelectedIds] = useState<number[]>([])
const [selectAll, setSelectAll] = useState(false)

const handleToggleSelectAll = () => { /* 10줄 */ }
const handleToggleSelection = (id: number) => { /* 8줄 */ }

// After
const {
  selectedIds,
  selectAll,
  selectedCount,
  toggleSelectAll,
  toggleSelection,
  clearSelection,
  isSelected,
} = useSelection({ items: products, getId: (p) => p.id })
```

---

## 3. 날짜/가격 포맷팅 함수

### 발견 파일

- `(admin)/order/list/page.tsx`
- `(admin)/order/[id]/page.tsx`
- `(admin)/product/list/page.tsx`
- `(admin)/settlement/list/page.tsx`
- `(admin)/post/list/page.tsx`

### 중복 코드

```typescript
// 가격 포맷팅 - 각 파일마다 정의
const formatPrice = (price: number | null) => {
  if (!price) return '-'
  return `${price.toLocaleString()}원`
}

// 날짜 포맷팅 - 각 파일마다 정의
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 텍스트 자르기 - 여러 파일에서 정의
const truncateText = (text: string, maxLength: number = 50) => {
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '...'
  }
  return text
}
```

### 리팩토링 제안

**파일 생성: `src/lib/formatters.ts`**

```typescript
/**
 * 가격을 한국어 형식으로 포맷팅
 */
export function formatPrice(
  price: number | null | undefined,
  options: { suffix?: string; fallback?: string } = {}
): string {
  const { suffix = '원', fallback = '-' } = options

  if (price === null || price === undefined) return fallback
  return `${price.toLocaleString('ko-KR')}${suffix}`
}

/**
 * 날짜를 한국어 형식으로 포맷팅
 */
export function formatDate(
  dateString: string | Date,
  options: { includeTime?: boolean } = {}
): string {
  const { includeTime = false } = options

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }

  return date.toLocaleDateString('ko-KR', formatOptions)
}

/**
 * 날짜/시간을 포함한 전체 포맷
 */
export function formatDateTime(dateString: string | Date): string {
  return formatDate(dateString, { includeTime: true })
}

/**
 * 텍스트를 지정된 길이로 자르기
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}

/**
 * 숫자를 단위와 함께 표시 (예: 1,234개)
 */
export function formatCount(count: number, unit: string = '개'): string {
  return `${count.toLocaleString('ko-KR')}${unit}`
}
```

---

## 4. Fetch 로직 (목록 조회)

### 발견 파일

- `(admin)/order/list/page.tsx`
- `(admin)/product/list/page.tsx`
- `(admin)/post/list/page.tsx`
- `(admin)/policy/list/page.tsx`

### 중복 코드

```typescript
// 모든 list 페이지에서 거의 동일한 패턴
const loadItems = async () => {
  try {
    setIsLoading(true)
    const response = await fetch(`/api/...?search=${searchTerm}&page=${currentPage}&limit=${itemsPerPage}`)
    const data = await response.json()
    if (data.success) {
      setItems(data.data)
      setTotalItems(data.pagination?.total || 0)
      setTotalPages(data.pagination?.totalPages || 1)
    }
  } catch (error) {
    console.error('목록 조회 실패:', error)
  } finally {
    setIsLoading(false)
  }
}

useEffect(() => {
  loadItems()
}, [currentPage, searchTerm])
```

### 리팩토링 제안

**파일 생성: `src/hooks/usePaginatedList.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'

interface FetchListParams {
  search?: string
  page?: number
  limit?: number
  [key: string]: string | number | undefined
}

interface UsePaginatedListOptions {
  endpoint: string
  itemsPerPage?: number
  initialSearch?: string
}

export function usePaginatedList<T>({
  endpoint,
  itemsPerPage = 10,
  initialSearch = '',
}: UsePaginatedListOptions) {
  const [items, setItems] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })

      const response = await fetch(`${endpoint}?${params}`)
      const result = await response.json()

      if (result.success) {
        setItems(result.data || [])
        setTotalItems(result.pagination?.total || 0)
        setTotalPages(result.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error(`${endpoint} 데이터 로드 실패:`, error)
    } finally {
      setIsLoading(false)
    }
  }, [endpoint, searchTerm, currentPage, itemsPerPage])

  useEffect(() => {
    load()
  }, [load])

  const search = useCallback(() => {
    setCurrentPage(1)
  }, [])

  return {
    items,
    isLoading,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    load,
    search,
  }
}
```

**사용 예시:**

```typescript
// Before (약 30줄)
const [products, setProducts] = useState([])
const [isLoading, setIsLoading] = useState(true)
const [searchTerm, setSearchTerm] = useState('')
const [currentPage, setCurrentPage] = useState(1)
const [totalPages, setTotalPages] = useState(1)
// + loadProducts 함수 + useEffect

// After (1줄)
const {
  items: products,
  isLoading,
  searchTerm,
  setSearchTerm,
  currentPage,
  setCurrentPage,
  totalPages,
  load: loadProducts,
} = usePaginatedList<Product>({ endpoint: '/api/product' })
```

---

## 5. API Response 패턴

### 발견 파일

모든 API route 파일

### 중복 코드

```typescript
// 성공 응답 - 매번 동일한 구조
return NextResponse.json({
  success: true,
  data: result,
})

// 에러 응답 - 매번 동일한 구조
return NextResponse.json(
  { success: false, error: '에러 메시지' },
  { status: 400 }
)
```

### 리팩토링 제안

**파일 생성: `src/lib/api/response.ts`**

```typescript
import { NextResponse } from 'next/server'

export function successResponse<T>(data: T, message?: string) {
  return NextResponse.json({
    success: true,
    data,
    ...(message && { message }),
  })
}

export function errorResponse(error: string, status: number = 500) {
  return NextResponse.json(
    { success: false, error },
    { status }
  )
}

export function paginatedResponse<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number }
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  })
}

// 사전 정의된 에러 응답
export const ApiErrors = {
  unauthorized: () => errorResponse('인증이 필요합니다.', 401),
  notFound: (resource: string) => errorResponse(`${resource}을(를) 찾을 수 없습니다.`, 404),
  badRequest: (message: string) => errorResponse(message, 400),
  serverError: (action: string) => errorResponse(`${action}에 실패했습니다.`, 500),
}
```

---

## 6. Prisma Client 인스턴스

### 발견 파일

```typescript
// ❌ 직접 생성 (문제)
// api/order/route.ts
// api/band/wholesale/route.ts
// api/band/retail/route.ts
import { PrismaClient } from '@bandauto/db'
const prisma = new PrismaClient()

// ✅ 싱글톤 사용 (올바름)
// 대부분의 다른 파일
import prisma from '@/lib/prisma'
```

### 문제점

- 매번 `new PrismaClient()` 호출 시 개발 환경에서 연결 풀 고갈
- 일관성 없는 import 패턴

### 해결 방법

모든 파일에서 `import prisma from '@/lib/prisma'` 사용으로 통일

---

## 리팩토링 우선순위

| 순서 | 항목 | 난이도 | 효과 | 예상 소요 |
|------|------|--------|------|----------|
| 1 | Prisma Client 통일 | ⭐ | 연결 풀 안정성 | 10분 |
| 2 | 포맷팅 유틸리티 | ⭐ | ~50줄 절감 | 30분 |
| 3 | API Response 헬퍼 | ⭐⭐ | ~100줄 절감 | 1시간 |
| 4 | 인증 헬퍼 함수 | ⭐⭐ | ~100줄 절감 | 1시간 |
| 5 | useSelection 훅 | ⭐⭐ | ~150줄 절감 | 1시간 |
| 6 | usePaginatedList 훅 | ⭐⭐⭐ | ~200줄 절감 | 2시간 |

---

## 생성할 파일 목록

```
sourcing-app/src/
├── lib/
│   ├── api/
│   │   ├── auth.ts        # requireAuth 헬퍼
│   │   └── response.ts    # API 응답 헬퍼
│   └── formatters.ts      # 포맷팅 유틸리티
└── hooks/
    ├── useSelection.ts    # 선택 관리 훅
    └── usePaginatedList.ts # 페이지네이션 훅
```

---

## 참고

- 이 분석은 sourcing-app을 기준으로 작성되었습니다.
- shop-app에도 유사한 패턴이 존재할 수 있습니다.
- 리팩토링 시 테스트를 통해 기능이 정상 동작하는지 확인이 필요합니다.
