# 정적 더미 데이터 정리 가이드

이 문서는 BandAuto 프로젝트 내에 하드코딩된 정적 더미 데이터의 위치와 제거/수정 방법을 설명합니다.

## 📋 목차

1. [관리자 대시보드](#1-관리자-대시보드)
2. [소매밴드 포스팅](#2-소매밴드-포스팅)
3. [자동화 워크플로우](#3-자동화-워크플로우)
4. [쇼핑몰 상품 목록 (관리자)](#4-쇼핑몰-상품-목록-관리자)
5. [쇼핑몰 메인 페이지 (관리자)](#5-쇼핑몰-메인-페이지-관리자)
6. [고객용 쇼핑몰 메인](#6-고객용-쇼핑몰-메인)
7. [상품 상세 페이지](#7-상품-상세-페이지)
8. [자동화 설정 페이지](#8-자동화-설정-페이지)

---

## 1. 관리자 대시보드

**파일**: `src/app/(admin)/admin/page.tsx`

### 1-1. 워크플로우 단계 더미 데이터
**위치**: Line 9-50
**변수명**: `workflowSteps`

```typescript
const workflowSteps = [
  {
    step: 1,
    title: '도매밴드 수집',
    count: 45,  // ❌ 하드코딩된 카운트
    href: '/automation/collect',
  },
  {
    step: 2,
    title: 'AI 상세페이지 생성',
    count: 12,  // ❌ 하드코딩된 카운트
    href: '/products/ai-generate',
  },
  {
    step: 3,
    title: '소매밴드 포스팅',
    count: 0,   // ❌ 하드코딩된 카운트
    href: '/retail/publish',
  }
]
```

**수정 방안**:
- API 엔드포인트 `/api/dashboard/workflow-stats` 생성
- `useEffect`로 실시간 통계 데이터 로드
- DB에서 각 단계별 진행 중인 항목 수 조회

### 1-2. 최근 활동 로그
**위치**: Line 52-57
**변수명**: `recentActivities`

```typescript
const recentActivities = [
  { time: '5분 전', action: '도매밴드에서 10개 상품 수집 완료', type: 'collect' },
  { time: '12분 전', action: 'AI 상세페이지 5개 생성 완료', type: 'ai' },
  { time: '30분 전', action: '쇼핑몰 엑셀 업로드 완료 (15개)', type: 'upload' },
  { time: '1시간 전', action: '소매밴드 3개 게시물 발행', type: 'publish' },
]
```

**수정 방안**:
- Activity Log 테이블 생성 (Prisma 모델 추가)
- API 엔드포인트 `/api/dashboard/recent-activities` 생성
- 실시간 활동 로그 조회

### 1-3. 오늘의 실적 통계
**위치**: Line 137-154

```typescript
<div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
  <span className="text-sm text-gray-600">총 수집 상품</span>
  <span className="text-xl font-bold text-gray-900">156</span>  {/* ❌ 하드코딩 */}
</div>
<div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
  <span className="text-sm text-gray-600">AI 생성 완료</span>
  <span className="text-xl font-bold text-gray-900">89</span>   {/* ❌ 하드코딩 */}
</div>
<div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
  <span className="text-sm text-gray-600">쇼핑몰 업로드</span>
  <span className="text-xl font-bold text-gray-900">67</span>   {/* ❌ 하드코딩 */}
</div>
<div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
  <span className="text-sm text-gray-600">밴드 발행 완료</span>
  <span className="text-xl font-bold text-gray-900">45</span>   {/* ❌ 하드코딩 */}
</div>
```

**수정 방안**:
- API 엔드포인트 `/api/dashboard/today-stats` 생성
- DB에서 오늘 생성된 데이터 집계 (createdAt 기준)

---

## 2. 소매밴드 포스팅

**파일**: `src/app/(admin)/retail/compose/page.tsx`

### 2-1. 더미 상품 데이터
**위치**: Line 17-36
**변수명**: `availableProducts`

```typescript
const availableProducts = [
  {
    id: '1',
    name: '프리미엄 한우 세트',
    price: 65000,
    paymentLink: 'https://strk.pay/abc123',  // ❌ 더미 링크
    aiDescription: '최고급 1++ 한우로 구성된 프리미엄 선물세트입니다...',
    images: ['/api/placeholder/400/400'],    // ❌ 더미 이미지
    hashtags: '#한우 #프리미엄 #선물세트 #명절선물',
  },
  {
    id: '2',
    name: '유기농 과일 선물세트',
    price: 39000,
    paymentLink: 'https://strk.pay/def456',  // ❌ 더미 링크
    aiDescription: '100% 유기농 인증을 받은 신선한 과일로 구성된...',
    images: ['/api/placeholder/400/400'],    // ❌ 더미 이미지
    hashtags: '#유기농 #과일 #선물세트 #건강',
  },
]
```

**수정 방안**:
- `Product` 테이블에서 실제 상품 데이터 조회
- 결제링크가 설정된 상품만 필터링
- API 엔드포인트 `/api/retail/available-products` 생성

---

## 3. 자동화 워크플로우

**파일**: `src/app/(admin)/automation/workflow/page.tsx`

### 3-1. 워크플로우 단계 정의
**위치**: Line 16-45
**변수명**: `workflowSteps`

```typescript
const workflowSteps = [
  {
    id: 'collecting',
    name: '도매밴드 수집',
    description: '새로운 상품 게시물 수집',
    icon: '📦',
    duration: '2-5분',  // ❌ 정적 정보
  },
  {
    id: 'aiProcessing',
    name: 'AI 상세페이지 생성',
    description: 'AI를 통한 상품 설명 생성',
    icon: '🤖',
    duration: '5-10분',  // ❌ 정적 정보
  },
  {
    id: 'publishing',
    name: '소매밴드 발행',
    description: '결제링크 포함 게시물 발행',
    icon: '📮',
    duration: '2-3분',  // ❌ 정적 정보
  },
]
```

**수정 방안**:
- 워크플로우 단계 정의는 유지 (UI용 정적 정보)
- 진행 상태는 API로 동적 조회
- `duration`은 평균 소요 시간으로 계산하거나 제거

### 3-2. 워크플로우 설정
**위치**: Line 47-56
**변수명**: `workflowSettings`

```typescript
const workflowSettings = {
  autoRetry: true,
  maxRetries: 3,
  batchSize: 10,
  interval: 30, // minutes
  schedule: {
    enabled: true,
    times: ['09:00', '14:00', '19:00'],  // ❌ 더미 스케줄
  },
}
```

**수정 방안**:
- `AutomationSettings` 테이블에서 조회
- API 엔드포인트 `/api/automation/workflow-settings` 사용

---

## 4. 쇼핑몰 상품 목록 (관리자)

**파일**: `src/app/(admin)/shop/list/page.tsx`

### 4-1. 더미 상품 데이터
**위치**: Line 43-92
**함수명**: `getMockData()`

```typescript
const getMockData = () => [
  {
    id: '1',
    title: '프리미엄 한우 세트',
    productCode: 'SHOP-2025-001',
    link: `${window.location.origin}/shop/product/abc123`,
    shortLink: 'shop/abc123',
    originalPrice: 50000,
    salePrice: 65000,
    status: 'active',
    createdAt: '2025-01-19 10:30',
    views: 150,
    orders: 3,
    stock: 47,
    category: '식품>육류',
    images: ['https://example.com/image1.jpg'],
  },
  {
    id: '2',
    title: '유기농 과일 선물세트',
    productCode: 'SHOP-2025-002',
    // ... 더미 데이터
  },
  {
    id: '3',
    title: '수제 마카롱 세트',
    productCode: 'SHOP-2025-003',
    status: 'soldout',
    // ... 더미 데이터
  },
]
```

**수정 방안**:
- `getMockData()` 함수 완전 제거
- API 호출 실패 시 빈 배열 반환
- 에러 메시지 표시

**수정 예시**:
```typescript
const loadProducts = async () => {
  setIsLoading(true)
  try {
    const response = await fetch('/api/shop/products')
    const data = await response.json()

    if (data.success) {
      setProducts(data.products || [])
      setLastSync(new Date())
    } else {
      setProducts([])  // ✅ 빈 배열 반환
      setError(data.error)
    }
  } catch (error) {
    console.error('Failed to load products:', error)
    setProducts([])  // ✅ 빈 배열 반환
    setError('상품 목록을 불러올 수 없습니다.')
  } finally {
    setIsLoading(false)
  }
}
```

---

## 5. 쇼핑몰 메인 페이지 (관리자)

**파일**: `src/app/(admin)/shop/page.tsx`

### 5-1. 카테고리 하드코딩
**위치**: Line 95
**변수명**: `categories`

```typescript
const categories = ['all', '육류', '수산', '농산', '과일', '디저트', '가공품']
```

**수정 방안**:
- `Product` 테이블의 `productCategory` 필드에서 DISTINCT 조회
- API 엔드포인트 `/api/products/categories` 생성
- 동적으로 카테고리 목록 로드

### 5-2. 더미 상품 데이터
**함수명**: `getMockData()`

**수정 방안**:
- 4번 항목과 동일하게 처리
- `getMockData()` 함수 제거

---

## 6. 고객용 쇼핑몰 메인

**파일**: `src/app/store/page.tsx`

### 6-1. 더미 상품 목록
**위치**: Line 72+
**함수명**: `getMockData()`

```typescript
const getMockData = () => [
  {
    id: '1',
    title: '[500g 2,900원] 택배비보다 싼!! 가마솥 사골 도가니탕 2종',
    originalPrice: 4900,
    salePrice: 2900,
    discount: 41,
    images: ['https://via.placeholder.com/300x300/FF6B6B/FFFFFF?text=도가니탕'],
    category: '육류',
    rating: 4.8,
    reviews: 234,
    isTimeSale: true,
    isBest: true,
  },
  {
    id: '2',
    title: '[총 5마리 4900원!!] 구룡포직송!! 반건조 피데기오징어',
    originalPrice: 7900,
    salePrice: 4900,
    discount: 38,
    // ... 더미 데이터
  },
  // ... 더 많은 더미 상품들
]
```

**수정 방안**:
- `ShopProduct` 테이블에서 실제 상품 조회
- API 엔드포인트 `/api/store/products` 사용
- 필터링: `status = 'ACTIVE'`, `stock > 0`
- 정렬: 인기순, 최신순, 가격순 옵션 제공

---

## 7. 상품 상세 페이지

**파일**: `src/app/store/product/[id]/page.tsx`

### 7-1. 더미 상품 상세 정보
**위치**: Line 41-69
**함수명**: `getMockProduct()`

```typescript
const getMockProduct = () => ({
  id: params.id,
  title: '[500g 2,900원] 택배비보다 싼!! 가마솥 사골 도가니탕 2종',
  description: '진한 사골 육수와 쫄깃한 도가니가 들어있는 프리미엄 도가니탕입니다...',
  originalPrice: 4900,
  salePrice: 2900,
  discount: 41,
  images: [
    'https://via.placeholder.com/600x600/FF6B6B/FFFFFF?text=도가니탕1',
    'https://via.placeholder.com/600x600/4ECDC4/FFFFFF?text=도가니탕2',
    'https://via.placeholder.com/600x600/F7B731/FFFFFF?text=도가니탕3',
  ],
  category: '육류',
  stock: 234,
  rating: 4.8,
  reviews: 234,
  shippingFee: 3000,
  freeShippingAmount: 30000,
  options: [
    { name: '사골도가니탕 500g', price: 2900 },
    { name: '사골도가니탕 1kg', price: 5400 },
    { name: '사골도가니탕 2kg', price: 9900 },
  ],
  detailImages: [
    'https://via.placeholder.com/800x1200/FF6B6B/FFFFFF?text=상품상세1',
    'https://via.placeholder.com/800x1200/4ECDC4/FFFFFF?text=상품상세2',
    'https://via.placeholder.com/800x1200/F7B731/FFFFFF?text=상품상세3',
  ],
})
```

**수정 방안**:
- `getMockProduct()` 함수 완전 제거
- API 호출 실패 시 404 페이지로 리다이렉트
- 에러 상태 명확하게 표시

**수정 예시**:
```typescript
const loadProduct = async () => {
  try {
    setIsLoading(true)
    const response = await fetch(`/api/store/products/${params.id}`)
    const data = await response.json()

    if (data.success && data.product) {
      setProduct(data.product)
    } else {
      setProduct(null)  // ✅ null로 설정
      setError('상품을 찾을 수 없습니다.')
    }
  } catch (error) {
    console.error('Failed to load product:', error)
    setProduct(null)  // ✅ null로 설정
    setError('상품 정보를 불러올 수 없습니다.')
  } finally {
    setIsLoading(false)
  }
}
```

---

## 8. 자동화 설정 페이지

**파일**: `src/app/(admin)/automation/settings/page.tsx`

### 8-1. 프리셋 가격정책
**위치**: Line 10-31
**변수명**: `PRESET_POLICIES`

```typescript
const PRESET_POLICIES = [
  {
    name: '구간별 마진 정책 (기본)',
    value: '수집가격 기준 구간별 마진 적용 (19,900원 이하 +1,000원, ...)',
  },
  {
    name: '원가 그대로',
    value: '원가 그대로 판매 (단, 39,900원 이상은 구간별 마진 적용...)',
  },
  {
    name: '공급가 기준 마진',
    value: '공급가와 배송비를 분리, 공급가에만 마진 적용...',
  },
  {
    name: '30% 마진',
    value: '30% 마진 적용',
  },
  {
    name: '+5,000원 고정 마진',
    value: '+5000원 고정 마진',
  },
]
```

**수정 방안**:
- 이 데이터는 **유지 필요** (프리셋 템플릿)
- 실제 사용 중인 정책은 DB에서 조회
- 프리셋은 UI 편의 기능으로 활용

---

## 🔧 전체 수정 작업 체크리스트

### Phase 1: Mock 데이터 제거
- [ ] `src/app/(admin)/shop/list/page.tsx` - `getMockData()` 제거
- [ ] `src/app/(admin)/shop/page.tsx` - `getMockData()` 제거
- [ ] `src/app/store/page.tsx` - `getMockData()` 제거
- [ ] `src/app/store/product/[id]/page.tsx` - `getMockProduct()` 제거
- [ ] `src/app/(admin)/retail/compose/page.tsx` - `availableProducts` 제거

### Phase 2: API 엔드포인트 생성
- [ ] `/api/dashboard/workflow-stats` - 워크플로우 통계
- [ ] `/api/dashboard/recent-activities` - 최근 활동
- [ ] `/api/dashboard/today-stats` - 오늘의 실적
- [ ] `/api/retail/available-products` - 포스팅 가능 상품
- [ ] `/api/store/products` - 고객용 상품 목록
- [ ] `/api/store/products/[id]` - 상품 상세 정보
- [ ] `/api/products/categories` - 카테고리 목록

### Phase 3: 데이터 모델 추가
- [ ] `ActivityLog` 모델 추가 (Prisma Schema)
- [ ] 활동 로그 자동 기록 시스템 구현

### Phase 4: 테스트
- [ ] 모든 페이지에서 데이터 없을 때 UI 확인
- [ ] 에러 처리 확인
- [ ] 로딩 상태 확인

---

## 📝 주의사항

1. **프리셋 데이터는 유지**
   - `PRESET_POLICIES` 같은 템플릿 데이터는 유지
   - UI 편의성을 위한 정적 데이터는 제거하지 않음

2. **에러 처리 강화**
   - API 실패 시 더미 데이터 대신 에러 메시지 표시
   - 사용자에게 명확한 피드백 제공

3. **점진적 마이그레이션**
   - 한 번에 모든 페이지 수정하지 말 것
   - 페이지별로 테스트하며 진행

4. **빈 상태 UI 디자인**
   - 데이터가 없을 때 보여줄 Empty State 디자인 필요
   - "아직 등록된 상품이 없습니다" 같은 친절한 메시지

---

## 🎯 우선순위

**최고 우선순위** (즉시 제거):
1. 고객용 쇼핑몰 더미 데이터 (`store/page.tsx`, `store/product/[id]/page.tsx`)
2. 관리자 쇼핑몰 더미 데이터 (`shop/list/page.tsx`, `shop/page.tsx`)

**중간 우선순위**:
3. 대시보드 통계 데이터 (`admin/page.tsx`)
4. 소매밴드 포스팅 더미 상품 (`retail/compose/page.tsx`)

**낮은 우선순위**:
5. 워크플로우 설정 (기능 미구현 시 유지 가능)

---

**작성일**: 2025-11-14
**마지막 업데이트**: 2025-11-14
