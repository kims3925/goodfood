# 멀티테넌트 쇼핑몰 플랫폼 전환 계획서

## 📋 프로젝트 개편 개요

**현재 구조**: 단일 공급업체를 위한 도매→소매 자동화 시스템  
**목표 구조**: 멀티테넌트 쇼핑몰 플랫폼 (입점업체별 독립 몰 운영)

### 핵심 변화
```
기존: BandAuto (단일 업체) → 소매 밴드 자동 포스팅
새로: BandAuto 플랫폼 → 입점업체별 개별 쇼핑몰 → 고객 직접 구매
```

---

## 🚨 예상 문제점 및 리스크 분석

### 1. **아키텍처 복잡성 증가**

#### 문제점
- **데이터 격리**: 입점업체별 데이터 완전 분리 필요
- **권한 관리**: 3단계 권한(플랫폼 관리자, 입점업체, 고객) 복잡성
- **성능 이슈**: 단일 데이터베이스에서 멀티테넌트 처리 시 성능 저하
- **확장성**: 입점업체 증가에 따른 시스템 부하

#### 해결 방안
```typescript
// 테넌트 기반 데이터 격리 패턴
model Store {
  id        String @id @default(cuid())
  tenantId  String // 핵심: 모든 데이터에 테넌트 ID 필수
  name      String
  products  Product[]
  orders    Order[]
}

// 미들웨어에서 테넌트 자동 필터링
middleware.ts: 모든 DB 쿼리에 tenantId 자동 추가
```

### 2. **URL 구조 및 라우팅 복잡성**

#### 문제점
- **기존**: `/dashboard/products` (단일 경로)
- **신규**: `/{store-slug}/products`, `/admin/stores/{id}/products` (다중 경로)
- **SEO 충돌**: 서로 다른 스토어의 동일 상품명 처리
- **도메인 관리**: 커스텀 도메인 지원 시 DNS/SSL 관리

#### 해결 방안
```
URL 구조 재설계:
┌─ / (메인 플랫폼 랜딩)
├─ /admin/* (플랫폼 관리자 전용)
├─ /store/{store-slug}/* (입점업체 관리)
├─ /{store-slug}/* (고객용 스토어)
└─ /api/tenant/{tenantId}/* (API 라우팅)
```

### 3. **데이터베이스 설계 문제**

#### 문제점
- **기존 데이터 마이그레이션**: 현재 데이터를 어떤 테넌트에 할당할지 결정
- **관계 복잡성**: 테넌트 간 데이터 참조 금지 규칙
- **백업/복구**: 테넌트별 독립적 백업 필요
- **GDPR 준수**: 개인정보 완전 삭제 복잡성

#### 해결 방안
```sql
-- Row Level Security (RLS) 적용 예시
CREATE POLICY tenant_isolation ON products 
FOR ALL TO authenticated_users 
USING (tenant_id = current_setting('app.tenant_id'));
```

### 4. **인증 및 권한 관리**

#### 문제점
- **다중 역할**: 한 사용자가 여러 스토어의 다른 권한 가능
- **세션 관리**: 테넌트별 세션 격리
- **API 보안**: 테넌트 간 데이터 누출 방지

#### 해결 방안
```typescript
// 역할 기반 접근 제어 (RBAC)
model UserRole {
  userId   String
  tenantId String 
  role     Role   // PLATFORM_ADMIN, STORE_OWNER, STORE_STAFF, CUSTOMER
  
  @@unique([userId, tenantId])
}
```

### 5. **결제 및 정산 복잡성**

#### 문제점
- **수수료 분배**: 플랫폼 수수료 vs 입점업체 정산
- **세금 처리**: 입점업체별 사업자등록번호 관리
- **정산 주기**: 입점업체별 다른 정산 주기
- **환불 처리**: 플랫폼 vs 입점업체 책임 분담

#### 해결 방안
```typescript
model Payment {
  // 수수료 분배 정보
  totalAmount      Int
  platformFee      Int     // 플랫폼 수수료
  storeFee        Int     // 입점업체 수수료  
  settlementDate  DateTime? // 정산 예정일
  tenantId        String  // 테넌트 격리
}
```

### 6. **성능 및 확장성 이슈**

#### 문제점
- **N+1 쿼리**: 테넌트별 필터링으로 인한 쿼리 증가
- **캐시 복잡성**: 테넌트별 캐시 키 관리
- **이미지 저장**: 테넌트별 이미지 격리 및 CDN 관리
- **검색 성능**: 전체 플랫폼 vs 개별 스토어 검색 성능

#### 해결 방안
```typescript
// 캐시 키에 테넌트 ID 포함
const cacheKey = `products:${tenantId}:${category}:${page}`

// 이미지 경로에 테넌트 포함
const imagePath = `/uploads/${tenantId}/${productId}/image.jpg`
```

---

## 🏗️ 시스템 재구성 계획

### Phase 1: 기반 구조 변경 (2주)

#### 1.1 데이터베이스 스키마 재설계
```prisma
// 새로운 코어 모델들
model Platform {
  id          String   @id @default(cuid())
  name        String   @default("BandAuto Platform")
  domain      String   @unique
  settings    Json     @default("{}")
  createdAt   DateTime @default(now())
  stores      Store[]
}

model Store {
  id              String   @id @default(cuid())
  platformId      String   // 플랫폼 참조
  slug            String   @unique // URL용 슬러그
  name            String   // 스토어명
  description     String?
  logo            String?
  customDomain    String?  // 커스텀 도메인
  businessNumber  String?  // 사업자등록번호
  isActive        Boolean  @default(true)
  settings        Json     @default("{}")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // 관계
  platform        Platform @relation(fields: [platformId], references: [id])
  users           StoreUser[]
  products        Product[]
  orders          Order[]
  
  @@index([slug])
  @@index([platformId])
}

model StoreUser {
  id        String    @id @default(cuid())
  storeId   String
  userId    String
  role      StoreRole // OWNER, ADMIN, STAFF
  createdAt DateTime  @default(now())
  
  store     Store @relation(fields: [storeId], references: [id])
  user      User  @relation(fields: [userId], references: [id])
  
  @@unique([storeId, userId])
}

enum StoreRole {
  OWNER
  ADMIN
  STAFF
}
```

#### 1.2 기존 모델 수정
```prisma
// 모든 비즈니스 모델에 storeId 추가
model Product {
  id       String @id @default(cuid())
  storeId  String // 새로 추가
  // ... 기존 필드들
  
  store    Store @relation(fields: [storeId], references: [id])
  
  @@index([storeId]) // 새로 추가
}

model Order {
  id      String @id @default(cuid())
  storeId String // 새로 추가
  // ... 기존 필드들
  
  store   Store @relation(fields: [storeId], references: [id])
  
  @@index([storeId]) // 새로 추가
}

// User 모델도 확장
model User {
  id         String      @id @default(cuid())
  email      String      @unique
  // ... 기존 필드들
  
  storeUsers StoreUser[] // 새로 추가
  platformRole PlatformRole @default(CUSTOMER)
}

enum PlatformRole {
  SUPER_ADMIN    // 플랫폼 최고 관리자
  PLATFORM_ADMIN // 플랫폼 관리자  
  STORE_OWNER    // 스토어 소유자
  CUSTOMER       // 일반 고객
}
```

### Phase 2: 라우팅 및 미들웨어 구현 (1주)

#### 2.1 URL 구조 재설계
```
app/
├── (platform)/              # 플랫폼 메인
│   ├── page.tsx             # 메인 랜딩페이지
│   ├── stores/              # 스토어 목록
│   └── about/               # 플랫폼 소개
├── (admin)/                 # 플랫폼 관리자 전용
│   └── admin/
│       ├── dashboard/       # 플랫폼 대시보드
│       ├── stores/          # 스토어 관리
│       ├── users/           # 사용자 관리
│       └── analytics/       # 전체 분석
├── (store-management)/      # 스토어 관리자용
│   └── store/
│       └── [storeSlug]/
│           ├── dashboard/   # 스토어 대시보드
│           ├── products/    # 상품 관리
│           ├── orders/      # 주문 관리
│           └── settings/    # 스토어 설정
└── (storefront)/            # 고객용 스토어
    └── [storeSlug]/
        ├── page.tsx         # 스토어 메인
        ├── products/        # 상품 목록/상세
        ├── cart/            # 장바구니
        └── checkout/        # 결제
```

#### 2.2 미들웨어 구현
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 1. 스토어 슬러그 추출
  const storeSlugMatch = pathname.match(/^\/([^\/]+)/)
  const storeSlug = storeSlugMatch?.[1]
  
  // 2. 플랫폼 경로 체크
  if (pathname.startsWith('/admin')) {
    return handleAdminRoute(request)
  }
  
  if (pathname.startsWith('/store')) {
    return handleStoreManagement(request)
  }
  
  // 3. 스토어프론트 경로 처리
  if (storeSlug && !['api', '_next', 'favicon.ico'].includes(storeSlug)) {
    return handleStorefront(request, storeSlug)
  }
  
  return NextResponse.next()
}

async function handleStorefront(request: NextRequest, storeSlug: string) {
  // 스토어 존재 여부 확인
  const store = await getStoreBySlug(storeSlug)
  
  if (!store || !store.isActive) {
    return new NextResponse('Store not found', { status: 404 })
  }
  
  // 헤더에 스토어 정보 추가
  const response = NextResponse.next()
  response.headers.set('x-store-id', store.id)
  response.headers.set('x-store-slug', store.slug)
  
  return response
}
```

### Phase 3: API 재구성 (1.5주)

#### 3.1 테넌트 인식 API 구조
```
api/
├── admin/                   # 플랫폼 관리자 API
│   ├── stores/             
│   ├── users/              
│   └── analytics/          
├── store/                   # 스토어 관리 API
│   └── [storeId]/
│       ├── products/       
│       ├── orders/         
│       └── settings/       
├── storefront/              # 고객용 API  
│   └── [storeSlug]/
│       ├── products/       
│       ├── cart/           
│       └── checkout/       
└── shared/                  # 공통 API
    ├── auth/               
    ├── upload/             
    └── payments/           
```

#### 3.2 테넌트 격리 유틸리티
```typescript
// lib/tenant/isolation.ts
export class TenantService {
  static async getStoreFromRequest(request: NextRequest): Promise<Store | null> {
    const storeId = request.headers.get('x-store-id')
    const storeSlug = request.headers.get('x-store-slug')
    
    if (storeId) {
      return await prisma.store.findUnique({ where: { id: storeId } })
    }
    
    if (storeSlug) {
      return await prisma.store.findUnique({ where: { slug: storeSlug } })
    }
    
    return null
  }
  
  static async validateStoreAccess(
    userId: string, 
    storeId: string, 
    requiredRole: StoreRole
  ): Promise<boolean> {
    const userRole = await prisma.storeUser.findUnique({
      where: {
        storeId_userId: { storeId, userId }
      }
    })
    
    return userRole && this.hasPermission(userRole.role, requiredRole)
  }
}
```

### Phase 4: 프론트엔드 재구성 (2주)

#### 4.1 레이아웃 시스템 재설계
```typescript
// app/(platform)/layout.tsx - 플랫폼 메인 레이아웃
export default function PlatformLayout({ children }) {
  return (
    <html>
      <body>
        <PlatformHeader />
        <main>{children}</main>
        <PlatformFooter />
      </body>
    </html>
  )
}

// app/(storefront)/[storeSlug]/layout.tsx - 스토어프론트 레이아웃  
export default function StorefrontLayout({ 
  children, 
  params: { storeSlug } 
}) {
  return (
    <StoreProvider storeSlug={storeSlug}>
      <StorefrontHeader />
      <main>{children}</main>
      <StorefrontFooter />
    </StoreProvider>
  )
}

// components/store/StoreProvider.tsx
export function StoreProvider({ storeSlug, children }) {
  const { data: store } = useStore(storeSlug)
  
  return (
    <StoreContext.Provider value={store}>
      <ThemeProvider theme={store?.theme}>
        {children}
      </ThemeProvider>
    </StoreContext.Provider>
  )
}
```

#### 4.2 상태 관리 재구성
```typescript
// hooks/useStore.ts
export function useStore(storeSlug?: string) {
  return useQuery({
    queryKey: ['store', storeSlug],
    queryFn: () => fetchStore(storeSlug),
    enabled: !!storeSlug
  })
}

// hooks/useStoreProducts.ts  
export function useStoreProducts(storeSlug: string) {
  return useQuery({
    queryKey: ['products', storeSlug],
    queryFn: () => fetchStoreProducts(storeSlug)
  })
}
```

---

## 📊 데이터 마이그레이션 계획

### 기존 데이터 처리 방안

#### Option A: 기본 스토어 생성 (추천)
```sql
-- 1. 기본 플랫폼 생성
INSERT INTO Platform (id, name, domain) 
VALUES ('platform-1', 'BandAuto Platform', 'localhost:3000');

-- 2. 기본 스토어 생성  
INSERT INTO Store (id, platformId, slug, name) 
VALUES ('store-1', 'platform-1', 'bandauto', 'BandAuto Store');

-- 3. 기존 데이터에 storeId 할당
UPDATE Product SET storeId = 'store-1' WHERE storeId IS NULL;
UPDATE Order SET storeId = 'store-1' WHERE storeId IS NULL;

-- 4. 기존 사용자를 스토어 오너로 설정
INSERT INTO StoreUser (storeId, userId, role)
SELECT 'store-1', id, 'OWNER' FROM User WHERE bandAccessToken IS NOT NULL;
```

#### Option B: 사용자별 개별 스토어 생성
```sql
-- 각 기존 사용자마다 개별 스토어 생성
-- 더 복잡하지만 완전한 격리 제공
```

---

## ⚠️ 위험 요소 및 대응책

### 1. **대규모 코드 변경으로 인한 버그**
- **대응**: 단계적 마이그레이션 + 철저한 테스트
- **백업**: 전체 데이터베이스 백업 후 진행

### 2. **기존 사용자 혼란**
- **대응**: 점진적 UI 변경 + 사용자 가이드 제공
- **알림**: 사전 공지 및 마이그레이션 일정 안내

### 3. **성능 저하**
- **대응**: 데이터베이스 인덱스 최적화
- **모니터링**: 성능 지표 실시간 추적

### 4. **SEO 영향**
- **대응**: 301 리다이렉트 설정
- **사이트맵**: 새 URL 구조 반영

---

## 🚀 실행 계획 타임라인

### Week 1-2: Phase 1 (기반 구조)
- [ ] 데이터베이스 스키마 설계 및 마이그레이션
- [ ] 기존 데이터 백업 및 변환
- [ ] 테넌트 격리 유틸리티 개발

### Week 3: Phase 2 (라우팅)
- [ ] URL 구조 재설계
- [ ] 미들웨어 구현 및 테스트
- [ ] 기본 레이아웃 분리

### Week 4-5: Phase 3 (API)  
- [ ] API 엔드포인트 재구성
- [ ] 테넌트 격리 로직 구현
- [ ] API 테스트 및 문서화

### Week 6-7: Phase 4 (프론트엔드)
- [ ] 플랫폼 메인 페이지 구현
- [ ] 스토어 관리 대시보드 구현  
- [ ] 고객용 스토어프론트 구현

### Week 8: 테스트 및 배포
- [ ] 통합 테스트
- [ ] 성능 테스트
- [ ] 프로덕션 배포

---

## 💰 비용 및 리소스 추정

### 개발 리소스
- **개발자**: 1명 x 8주 = 약 2개월
- **테스트**: 추가 1-2주
- **문서화**: 1주

### 인프라 비용 증가 예상
- **데이터베이스**: 약 30% 증가 (테넌트별 격리)
- **CDN**: 약 50% 증가 (스토어별 이미지)
- **모니터링**: 새 도구 필요

### ROI 예상
- **수수료 수익**: 입점업체당 5-10% 수수료
- **월 구독료**: 스토어당 월 30,000원
- **추가 서비스**: 커스텀 도메인, 고급 분석 등

---

## 🎯 성공 지표

### 기술적 지표
- **응답 시간**: 평균 2초 이내 유지
- **업타임**: 99.9% 이상
- **테넌트 격리**: 100% 데이터 격리 보장

### 비즈니스 지표
- **입점업체 수**: 첫 3개월 내 10개 스토어
- **GMV**: 기존 대비 300% 성장 목표
- **사용자 만족도**: NPS 70 이상

이 계획에 대해 어떻게 생각하시나요? 특정 부분에 대해 더 자세한 설명이나 수정이 필요한가요?