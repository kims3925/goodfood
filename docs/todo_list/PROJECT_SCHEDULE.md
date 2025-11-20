# 📅 BandAuto 프로젝트 작업 일정 계획서

> **프로젝트명**: BandAuto - 밴드 자동화 + 토스페이먼츠 통합 쇼핑몰 시스템
> **작업 기간**: 2025.11.17 ~ 2025.12.31
> **작성일**: 2025.11.17

---

## 📊 전체 일정 요약

| 기간 | 주요 작업 | 상태 |
|------|----------|------|
| ~ 25.11.21 | Web Application 스터디 | 🔄 진행중 |
| 25.11.24 ~ 25.11.28 | 테이블/디렉토리/API 재정의, 로그인/회원가입 | 📅 예정 |
| 25.12.01 ~ 25.12.05 | 환경 설정 기능, 사용자 시나리오 재정의 | 📅 예정 |
| 25.12.08 ~ 25.12.12 | 소싱/포스팅/자동화 기능 | 📅 예정 |
| 25.12.15 ~ 25.12.19 | 쇼핑몰 서버 분리 및 기본 기능 | 📅 예정 |
| 25.12.22 ~ 25.12.31 | 쇼핑몰 고급 기능 (장바구니, 검색, 게시판) | 📅 예정 |

---

## 🎯 Phase 1: Web Application 스터디

**기간**: 현재 ~ 2025.11.21 (5일)

### 목표
- Next.js 14 App Router 학습
- Prisma ORM 이해
- TypeScript 기본 문법
- Tailwind CSS 활용

### 체크리스트
- [ ] Next.js 공식 튜토리얼 완료
- [ ] Prisma 기본 CRUD 실습
- [ ] TypeScript 타입 시스템 학습
- [ ] Tailwind CSS 컴포넌트 작성 연습

### 참고 자료
- Next.js 공식 문서: https://nextjs.org/docs
- Prisma 공식 문서: https://www.prisma.io/docs
- TypeScript Handbook: https://www.typescriptlang.org/docs/

---

## 🎯 Phase 2: 기본 구조 재정의

**기간**: 2025.11.24 ~ 2025.11.28 (5일)

### 📋 작업 항목

#### 1. 테이블 재정의 (1일)
- [ ] 현재 Prisma 스키마 분석
- [ ] 테이블 네이밍 컨벤션 정리
- [ ] 필드명 통일 (camelCase vs snake_case)
- [ ] 관계(Relation) 재검토
- [ ] 인덱스 추가 필요 항목 정리

**파일**: `prisma/schema.prisma`

**주요 작업**:
```prisma
// Before
model collected_posts { ... }

// After (네이밍 통일)
model CollectedPost {
  @@map("collected_posts")
}
```

#### 2. 디렉토리 구조 재정의 (1일)
- [ ] 현재 `src/` 구조 분석
- [ ] 도메인별 폴더 정리
- [ ] 공통 컴포넌트 분리
- [ ] 유틸리티 함수 정리

**현재 구조**:
```
src/
├── app/ 페이지 라우팅 API 엔드 포인트(Next.js)
├── domain/ 비즈니스 로직 (DDD 패턴)
├── lib/ 공통 라이브러리
├── components/ 재사용 UI 컴포넌트
├── types/ TypeScript 타입
├── stores/ 클라이언트 상태 관리
└── style/ 글로벌 CSS
```

**개선 필요 사항**:
- 도메인별 명확한 경계 설정
- 공통 로직 중복 제거

#### 3. API URL 재정의 (1일)
- [ ] 현재 62개 API 엔드포인트 정리
- [ ] RESTful 규칙 적용
- [ ] API 버저닝 검토 (`/api/v1/...`)
- [ ] 엔드포인트 문서화

**작업 예시**:
```typescript
// Before
POST /api/wholesale/collect-playwright

// After (명확한 네이밍)
POST /api/v1/wholesale/posts/collect
```

#### 4. 사용자 시나리오 정리 (1일)
- [ ] 관리자 사용 시나리오 작성
- [ ] 고객 사용 시나리오 작성
- [ ] 주요 플로우 다이어그램 작성
- [ ] 예외 상황 정리

**문서 위치**: `docs/user-scenarios/`

**시나리오 예시**:
```
1. 관리자 - 도매 상품 수집
   1.1. 도매 밴드 등록
   1.2. 상품 게시물 수집
   1.3. AI 분석 실행
   1.4. 소싱 확정

2. 고객 - 상품 구매
   2.1. 상품 검색/조회
   2.2. 장바구니 담기
   2.3. 주문서 작성
   2.4. 결제
```

#### 5. 로그인/회원가입 기능 (1일)
- [ ] NextAuth.js 설정 검토
- [ ] 회원가입 페이지 개선
- [ ] 로그인 페이지 개선
- [ ] 비밀번호 찾기 기능
- [ ] 이메일 인증 (선택)

**파일**:
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/api/auth/[...nextauth]/route.ts`

**체크리스트**:
- [ ] 폼 검증 (Zod)
- [ ] 에러 메시지 처리
- [ ] 소셜 로그인 검토 (Google, Kakao)
- [ ] 2FA 검토 (선택)

### 산출물
- [ ] 재정의된 Prisma 스키마
- [ ] API 엔드포인트 문서
- [ ] 사용자 시나리오 문서
- [ ] 로그인/회원가입 UI 완성

---

## 🎯 Phase 3: 환경 설정 기능

**기간**: 2025.12.01 ~ 2025.12.05 (5일)

### 📋 작업 항목

#### 1. 환경 설정 페이지 구현 (2일)
- [ ] API 설정 (Band API, Gemini AI)
- [ ] 자동화 설정 (수집 주기, AI 분석 옵션)
- [ ] 알림 설정 (이메일, SMS)
- [ ] 소매밴드 설정
- [ ] 쇼핑몰 설정

**파일**:
- `src/app/(admin)/admin/settings/api/page.tsx`
- `src/app/(admin)/admin/settings/automation/page.tsx`
- `src/app/(admin)/admin/settings/notifications/page.tsx`

**기능 요구사항**:
```typescript
// 설정 저장 API
POST /api/settings/api
{
  "bandClientId": "...",
  "bandClientSecret": "...",
  "geminiApiKey": "..."
}

// 설정 조회 API
GET /api/settings/api
```

#### 2. 설정값 검증 (1일)
- [ ] Band API 연동 테스트
- [ ] Gemini AI 연동 테스트
- [ ] 이메일 발송 테스트
- [ ] 환경변수 검증

**테스트 API**:
```typescript
POST /api/settings/api/test
POST /api/settings/ai/test
POST /api/settings/notifications/test
```

#### 3. 사용자 시나리오 재정의 (2일)
- [ ] Phase 2 시나리오 검토
- [ ] 환경 설정 시나리오 추가
- [ ] 예외 처리 시나리오 보완
- [ ] 플로우 차트 업데이트

### 산출물
- [ ] 환경 설정 페이지 완성
- [ ] 설정 테스트 기능
- [ ] 업데이트된 사용자 시나리오 문서

---

## 🎯 Phase 4: 소싱/포스팅/자동화 기능

**기간**: 2025.12.08 ~ 2025.12.12 (5일)

### 📋 작업 항목

#### 1. 소싱 기능 강화 (2일)
- [ ] 도매 밴드 게시물 수집 UI 개선
- [ ] AI 분석 결과 표시 개선
- [ ] 가격정책 자동 적용 확인
- [ ] 소싱 확정 플로우 개선
- [ ] 일괄 처리 기능

**파일**:
- `src/app/(admin)/admin/wholesale/collect/page.tsx`
- `src/domain/wholesale/services/collect.service.ts`

**기능 체크리스트**:
- [ ] 수집 진행 상태 표시 (Progress Bar)
- [ ] 배치 처리 (30개씩)
- [ ] 에러 핸들링 (수집 실패 시)
- [ ] 필터링 (카테고리, 가격대)

#### 2. 포스팅 기능 개선 (1일)
- [ ] 소매밴드 자동 포스팅 UI
- [ ] 게시물 미리보기
- [ ] 이미지 업로드 최적화
- [ ] 포스팅 스케줄링

**파일**:
- `src/app/(admin)/retail/page.tsx`
- `src/domain/retail/services/posting.service.ts`

#### 3. 자동화 기능 구현 (2일)
- [ ] 자동 수집 스케줄러 (Bull Queue)
- [ ] 자동 AI 분석 트리거
- [ ] 자동 포스팅 스케줄러
- [ ] 작업 모니터링 대시보드

**기술 스택**:
- Bull Queue (작업 큐)
- Redis (작업 저장소)
- Cron (스케줄링)

**구현 예시**:
```typescript
// 매일 오전 9시 자동 수집
scheduledJobs.add('daily-collect', {
  cron: '0 9 * * *',
  wholesaleBandIds: [1, 2, 3]
})
```

### 산출물
- [ ] 강화된 소싱 UI
- [ ] 포스팅 자동화 기능
- [ ] 작업 모니터링 대시보드

---

## 🎯 Phase 5: 쇼핑몰 서버 분리 및 기본 기능

**기간**: 2025.12.15 ~ 2025.12.19 (5일)

### 📋 작업 항목

#### 1. 쇼핑몰 서버 분리 작업 (2일)
- [ ] 아키텍처 설계 (모노레포 vs 멀티레포)
- [ ] API Gateway 구성
- [ ] 데이터베이스 분리 검토
- [ ] 도메인 분리 (`shop.bandauto.com`)

**아키텍처 옵션**:

**Option A: 모노레포 (권장)**
```
bandauto/
├── apps/
│   ├── admin/          # 관리자 대시보드
│   └── shop/           # 고객용 쇼핑몰
├── packages/
│   ├── database/       # Prisma 공유
│   ├── ui/             # 공통 컴포넌트
│   └── utils/          # 유틸리티
```

**Option B: 멀티레포**
```
bandauto-admin/         # 관리자 레포
bandauto-shop/          # 쇼핑몰 레포
bandauto-shared/        # 공통 패키지
```

#### 2. 쇼핑몰 로그인/회원가입 (1일)
- [ ] 고객용 회원가입 페이지
- [ ] 고객용 로그인 페이지
- [ ] 소셜 로그인 (Google, Kakao, Naver)
- [ ] 비회원 주문 지원

**파일**:
- `apps/shop/app/(auth)/login/page.tsx`
- `apps/shop/app/(auth)/register/page.tsx`

#### 3. 쇼핑몰 마이페이지 (1일)
- [ ] 회원 정보 수정
- [ ] 주문 내역 조회
- [ ] 배송지 관리
- [ ] 위시리스트 조회
- [ ] 포인트/쿠폰 관리 (선택)

**파일**:
- `apps/shop/app/mypage/page.tsx`
- `apps/shop/app/mypage/orders/page.tsx`
- `apps/shop/app/mypage/wishlist/page.tsx`

#### 4. 쇼핑몰 UI 작업 (1일)
- [ ] 헤더/푸터 컴포넌트
- [ ] 메인 페이지 레이아웃
- [ ] 카테고리 네비게이션
- [ ] 반응형 디자인 (모바일)

**디자인 시스템**:
```typescript
// 컬러 팔레트
colors: {
  primary: '#3B82F6',    // 블루
  secondary: '#10B981',  // 그린
  accent: '#F59E0B',     // 오렌지
}

// 타이포그래피
fontSize: {
  h1: '2.5rem',
  h2: '2rem',
  body: '1rem',
}
```

### 산출물
- [ ] 분리된 쇼핑몰 서버 구조
- [ ] 고객용 인증 시스템
- [ ] 마이페이지 기본 기능
- [ ] 쇼핑몰 기본 UI

---

## 🎯 Phase 6: 쇼핑몰 고급 기능

**기간**: 2025.12.22 ~ 2025.12.31 (10일)

### 📋 작업 항목

#### 1. 장바구니 기능 (1일)
- [ ] 장바구니 추가/삭제/수정
- [ ] 수량 변경
- [ ] 옵션 선택 (사이즈, 색상 등)
- [ ] 배송비 자동 계산
- [ ] 비회원 장바구니 (세션 기반)

**현재 상태**: ✅ API 100% 구현 완료
- `src/domain/cart/services/cart.service.ts` (완성)
- `src/app/api/cart/route.ts` (완성)

**남은 작업**: UI만 구현하면 됨!

**파일**:
- `apps/shop/app/cart/page.tsx`
- `apps/shop/components/CartDrawer.tsx`

#### 2. 위시리스트 기능 (1일)
- [ ] 위시리스트 추가/삭제
- [ ] 위시리스트 페이지
- [ ] 위시리스트 → 장바구니 이동
- [ ] 재입고 알림 (선택)

**새 Prisma 모델 필요**:
```prisma
model Wishlist {
  id        Int      @id @default(autoincrement())
  userId    Int?
  sessionId String?
  createdAt DateTime @default(now())

  items WishlistItem[]
}

model WishlistItem {
  id         Int @id @default(autoincrement())
  wishlistId Int
  productId  Int

  wishlist Wishlist @relation(fields: [wishlistId], references: [id])
  product  Product  @relation(fields: [productId], references: [id])
}
```

#### 3. 상품 상세 페이지 (2일)
- [ ] 상품 이미지 갤러리
- [ ] 상품 정보 표시
- [ ] 옵션 선택
- [ ] 수량 선택
- [ ] 장바구니 담기
- [ ] 바로 구매
- [ ] 상품 후기 (선택)
- [ ] 상품 문의 (선택)

**파일**:
- `apps/shop/app/product/[id]/page.tsx`
- `apps/shop/components/ProductImageGallery.tsx`
- `apps/shop/components/ProductInfo.tsx`

**주요 기능**:
```typescript
// 이미지 갤러리 (확대, 슬라이드)
<ProductImageGallery images={product.images} />

// 옵션 선택 (사이즈, 색상)
<ProductOptions options={product.options} />

// 수량 선택
<QuantitySelector min={1} max={product.stock} />

// CTA 버튼
<AddToCartButton productId={product.id} />
<BuyNowButton productId={product.id} />
```

#### 4. 상품 카테고리 기능 (1일)
- [ ] 카테고리 페이지
- [ ] 카테고리별 필터링
- [ ] 정렬 (가격순, 인기순, 최신순)
- [ ] 페이지네이션

**파일**:
- `apps/shop/app/category/[slug]/page.tsx`

**Prisma 모델** (이미 있음):
```prisma
model ProductCategory {
  id       Int    @id @default(autoincrement())
  name     String
  slug     String @unique
  parentId Int?

  parent   ProductCategory?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children ProductCategory[] @relation("CategoryHierarchy")
  products Product[]
}
```

#### 5. 검색 기능 (2일)
- [ ] 검색 UI (검색창, 자동완성)
- [ ] 전체 검색 (상품명, 설명)
- [ ] 필터링 (카테고리, 가격대)
- [ ] 정렬
- [ ] 검색 결과 페이지

**기술 선택**:
- **Option A**: Prisma Full-text Search (간단, 기본 기능)
- **Option B**: Meilisearch (고급, 빠름) ⭐ 권장

**Meilisearch 구현**:
```typescript
// 1. 상품 인덱싱
await meilisearch.index('products').addDocuments([{
  id: product.id,
  title: product.title,
  description: product.description,
  category: product.category.name,
  price: product.salePrice
}])

// 2. 검색 API
const results = await meilisearch
  .index('products')
  .search('신선한 과일', {
    filter: 'category = "농산" AND price < 30000',
    sort: ['price:asc']
  })
```

**파일**:
- `apps/shop/app/search/page.tsx`
- `apps/shop/components/SearchBar.tsx`
- `src/lib/search/meilisearch.ts`

#### 6. 주문내역 기능 (2일)
- [ ] 주문 목록 조회
- [ ] 주문 상세 조회
- [ ] 주문 취소
- [ ] 배송 추적
- [ ] 주문서 출력

**파일**:
- `apps/shop/app/mypage/orders/page.tsx`
- `apps/shop/app/mypage/orders/[id]/page.tsx`

**주문 상태**:
```typescript
enum OrderStatus {
  PENDING = '결제대기',
  PAID = '결제완료',
  PREPARING = '상품준비중',
  SHIPPED = '배송중',
  DELIVERED = '배송완료',
  CANCELLED = '취소',
  REFUNDED = '환불완료'
}
```

#### 7. 게시판(고객센터) 기능 (1일)
- [ ] 공지사항
- [ ] FAQ
- [ ] 1:1 문의
- [ ] 상품 문의
- [ ] 후기 작성

**새 Prisma 모델**:
```prisma
model Board {
  id         Int      @id @default(autoincrement())
  type       String   // NOTICE, FAQ, QNA, REVIEW
  title      String
  content    String
  authorId   Int?
  productId  Int?
  isPublic   Boolean  @default(true)
  createdAt  DateTime @default(now())

  author   User?    @relation(fields: [authorId], references: [id])
  product  Product? @relation(fields: [productId], references: [id])
  comments BoardComment[]
}

model BoardComment {
  id        Int      @id @default(autoincrement())
  boardId   Int
  authorId  Int
  content   String
  createdAt DateTime @default(now())

  board  Board @relation(fields: [boardId], references: [id])
  author User  @relation(fields: [authorId], references: [id])
}
```

**파일**:
- `apps/shop/app/board/notice/page.tsx`
- `apps/shop/app/board/faq/page.tsx`
- `apps/shop/app/board/qna/page.tsx`

### 산출물
- [ ] 장바구니 UI 완성
- [ ] 위시리스트 기능
- [ ] 상품 상세 페이지
- [ ] 카테고리 페이지
- [ ] 검색 기능 (Meilisearch)
- [ ] 주문내역 조회
- [ ] 고객센터 게시판

---

## 📊 마일스톤

### Milestone 1: 기본 구조 완성 (25.11.28)
- [x] 프로젝트 구조 분석 완료
- [ ] 테이블/API 재정의
- [ ] 사용자 시나리오 정리
- [ ] 로그인/회원가입

### Milestone 2: 관리자 기능 완성 (25.12.12)
- [ ] 환경 설정 페이지
- [ ] 소싱 기능 강화
- [ ] 포스팅 자동화
- [ ] 작업 모니터링

### Milestone 3: 쇼핑몰 기본 기능 (25.12.19)
- [ ] 쇼핑몰 서버 분리
- [ ] 고객 인증 시스템
- [ ] 마이페이지
- [ ] 기본 UI

### Milestone 4: 쇼핑몰 고급 기능 (25.12.31)
- [ ] 장바구니/위시리스트
- [ ] 상품 상세/카테고리
- [ ] 검색 기능
- [ ] 주문내역
- [ ] 고객센터

---

## 🚨 리스크 관리

### 기술적 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| 쇼핑몰 서버 분리 복잡도 | 높음 | 모노레포 구조 선택, Turborepo 활용 |
| 검색 성능 저하 | 중간 | Meilisearch 도입 (빠른 검색) |
| 이미지 최적화 부족 | 중간 | Next.js Image 컴포넌트, CDN 연동 |
| 동시 접속 처리 | 높음 | PostgreSQL 마이그레이션, Redis 캐싱 |

### 일정 리스크

| 리스크 | 확률 | 대응 방안 |
|--------|------|-----------|
| 환경 설정 복잡도 증가 | 중간 | 우선순위 낮은 기능 Phase 7로 이동 |
| 쇼핑몰 UI 작업 지연 | 높음 | UI 라이브러리 활용 (Shadcn/ui) |
| 검색 기능 구현 난이도 | 중간 | Meilisearch 공식 문서 참고 |

---

## 📈 성공 지표 (KPI)

### Phase별 목표

**Phase 2 (25.11.28)**
- [ ] API 엔드포인트 100% 문서화
- [ ] 사용자 시나리오 3개 이상 작성

**Phase 4 (25.12.12)**
- [ ] 자동 수집 성공률 95% 이상
- [ ] AI 분석 정확도 90% 이상

**Phase 6 (25.12.31)**
- [ ] 쇼핑몰 페이지 로딩 속도 3초 이내
- [ ] 검색 결과 응답 시간 0.5초 이내
- [ ] 모바일 반응형 100% 지원

---

## 📝 일일 작업 로그 템플릿

```markdown
## 2025.MM.DD (요일)

### 완료 작업
- [ ] 작업 1
- [ ] 작업 2

### 진행 중 작업
- [ ] 작업 3 (50%)

### 블로커
- 이슈 1: 설명
- 해결 방안: ...

### 내일 계획
- [ ] 작업 4
- [ ] 작업 5

### 메모
- 중요 사항 기록
```

---

## 🔗 참고 자료

### 공식 문서
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- Tailwind CSS: https://tailwindcss.com/docs
- Toss Payments: https://docs.tosspayments.com/
- Meilisearch: https://www.meilisearch.com/docs

### 디자인 참고
- Shadcn/ui: https://ui.shadcn.com/
- Radix UI: https://www.radix-ui.com/
- Headless UI: https://headlessui.com/

### 개발 도구
- Prisma Studio: `npx prisma studio`
- Next.js Dev: `npm run dev`
- TypeScript: `npx tsc --noEmit` (타입 체크)

---

## 📞 문의 및 지원

**프로젝트 관련 문의**
- GitHub Issues: [프로젝트 레포지토리]/issues
- 개발 문서: `docs/` 폴더 참조

**업데이트 내역**
- 2025.11.17: 초기 작업 계획서 작성

---

**작성자**: Claude AI
**최종 수정일**: 2025.11.17
**버전**: 1.0.0
