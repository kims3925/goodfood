# 네이버 밴드 API를 활용한 도매밴드 상품 수집 구현 가이드

## 📋 구현 체크리스트

### 1. 네이버 밴드 API 환경 설정
- [ ] **네이버 개발자센터 애플리케이션 등록**
  - https://developers.naver.com/apps/ 에서 새 애플리케이션 등록
  - API 사용 권한에서 '밴드 API' 체크
  - 서비스 URL 및 Callback URL 설정
  - Client ID, Client Secret 발급받기

- [ ] **환경변수 설정**
  ```env
  # .env.local
  BAND_CLIENT_ID="your-client-id"
  BAND_CLIENT_SECRET="your-client-secret"
  BAND_REDIRECT_URI="http://localhost:3000/api/auth/band/callback"
  ```

- [ ] **OAuth 2.0 인증 플로우 구현**
  - 인증 URL 생성 및 리다이렉트
  - Authorization Code → Access Token 교환
  - Access Token 저장 및 갱신 관리

### 2. 데이터베이스 스키마 설계

#### 소싱처(Source) 관리
- [ ] **SourceProvider 모델 생성**
  ```prisma
  model SourceProvider {
    id          String   @id @default(cuid())
    name        String   // "도매밴드A", "도매몰B" 등
    type        SourceType // NAVER_BAND, SHOPPING_MALL, etc
    bandId      String?  // 밴드 고유 ID
    bandUrl     String?  // 밴드 URL
    accessToken String?  // API 액세스 토큰
    isActive    Boolean  @default(true)
    config      Json?    // 각 소싱처별 설정값
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    
    // Relations
    posts       WholesalePost[]
  }

  enum SourceType {
    NAVER_BAND
    SHOPPING_MALL
    WHOLESALE_SITE
  }
  ```

- [ ] **WholesalePost 모델 개선**
  ```prisma
  model WholesalePost {
    id             String        @id @default(cuid())
    sourceId       String
    source         SourceProvider @relation(fields: [sourceId], references: [id])
    
    // 밴드 API에서 가져온 원본 데이터
    originalPostId String        // 밴드 게시물 ID
    bandId         String        // 밴드 ID
    authorId       String        // 작성자 ID
    
    // 게시물 내용
    title          String?
    content        String        @db.Text
    images         String[]      // 이미지 URL 배열
    
    // 상품 정보 (파싱된 데이터)
    productName    String?
    originalPrice  Decimal?
    salePrice      Decimal?
    options        Json?         // 옵션 정보
    
    // 메타데이터
    createdAt      DateTime
    updatedAt      DateTime
    fetchedAt      DateTime      @default(now())
    
    // 상태 관리
    status         PostStatus    @default(PENDING)
    isProcessed    Boolean       @default(false)
  }

  enum PostStatus {
    PENDING     // 수집됨, 처리 대기
    PROCESSING  // AI 처리중
    PROCESSED   // 처리 완료
    ERROR       // 오류 발생
  }
  ```

### 3. 네이버 밴드 API 클라이언트 구현

- [ ] **Band API 클라이언트 서비스 생성**
  ```typescript
  // lib/api/band-client.ts
  class NaverBandClient {
    // OAuth 인증
    - generateAuthUrl()
    - exchangeCodeForToken()
    - refreshAccessToken()
    
    // 밴드 정보 조회
    - getBandInfo(bandKey: string)
    - getBandMembers(bandKey: string)
    
    // 게시물 조회
    - getBandPosts(bandKey: string, options?)
    - getPostDetail(bandKey: string, postKey: string)
    - getPostComments(bandKey: string, postKey: string)
    
    // 유틸리티
    - parseBandUrl(url: string) // URL에서 bandKey 추출
  }
  ```

### 4. API 엔드포인트 구현

- [ ] **밴드 인증 API**
  ```typescript
  // app/api/auth/band/route.ts
  GET  /api/auth/band        // 인증 URL 생성
  POST /api/auth/band/callback // 콜백 처리
  ```

- [ ] **소싱처 관리 API**
  ```typescript
  // app/api/sources/route.ts
  GET    /api/sources        // 등록된 소싱처 목록
  POST   /api/sources        // 새 소싱처 등록
  PUT    /api/sources/[id]   // 소싱처 정보 수정
  DELETE /api/sources/[id]   // 소싱처 삭제
  ```

- [ ] **도매 게시물 수집 API**
  ```typescript
  // app/api/wholesale/posts/route.ts
  GET  /api/wholesale/posts           // 수집된 게시물 목록
  POST /api/wholesale/posts/fetch     // 특정 소싱처에서 게시물 수집
  GET  /api/wholesale/posts/[id]      // 특정 게시물 상세
  ```

### 5. 게시물 수집 로직 구현

- [ ] **게시물 파서 서비스**
  ```typescript
  // services/post-parser-service.ts
  class PostParserService {
    // 밴드 게시물에서 상품 정보 추출
    - parseProductInfo(post: BandPost)
    - extractImages(post: BandPost)
    - detectPriceInfo(content: string)
    - parseProductOptions(content: string)
  }
  ```

- [ ] **수집 작업 큐 구현**
  ```typescript
  // lib/queue/collection-queue.ts
  interface CollectionJob {
    sourceId: string
    type: 'FULL_SYNC' | 'INCREMENTAL' | 'SINGLE_POST'
    options?: {
      postId?: string
      startDate?: Date
      endDate?: Date
    }
  }
  ```

### 6. 프론트엔드 UI 구현

- [ ] **소싱처 관리 페이지**
  ```
  app/(dashboard)/sources/
  ├── page.tsx              // 소싱처 목록
  ├── new/page.tsx          // 새 소싱처 등록
  └── [id]/
      ├── page.tsx          // 소싱처 상세/편집
      └── posts/page.tsx    // 해당 소싱처 게시물 목록
  ```

- [ ] **밴드 연동 설정 컴포넌트**
  ```typescript
  // components/sources/BandConnectionForm.tsx
  - 밴드 URL 입력
  - OAuth 인증 버튼
  - 연동 상태 표시
  - 수집 설정 (주기, 키워드 필터 등)
  ```

- [ ] **게시물 목록 및 상세 페이지**
  ```typescript
  // components/wholesale/PostList.tsx
  - 게시물 목록 표시
  - 필터링 (소싱처별, 날짜별, 상태별)
  - 대량 작업 (선택 삭제, 상태 변경)
  
  // components/wholesale/PostDetail.tsx
  - 원본 게시물 내용 표시
  - 파싱된 상품 정보 표시
  - 이미지 갤러리
  - AI 처리 버튼
  ```

### 7. 자동화 및 스케줄링

- [ ] **크론 작업 설정**
  ```typescript
  // cron 설정으로 주기적 수집
  - 매시간 신규 게시물 체크
  - 일일 전체 동기화
  - 오류 게시물 재시도
  ```

- [ ] **웹훅 지원 (선택사항)**
  ```typescript
  // 실시간 게시물 수집을 위한 웹훅 엔드포인트
  POST /api/webhooks/band
  ```

## 🔧 구현 시 고려사항

### API 제한 사항 대응
- [ ] **Rate Limiting 처리**
  - API 호출 제한 준수 (시간당 최대 호출 수)
  - 요청 간격 조절 (Throttling)
  - 에러 발생 시 백오프 전략

- [ ] **대용량 데이터 처리**
  - 페이지네이션 처리
  - 배치 처리로 메모리 사용량 최적화
  - 이미지 다운로드 및 저장 최적화

### 데이터 품질 관리
- [ ] **중복 데이터 방지**
  - 게시물 고유 ID 기반 중복 체크
  - 유사한 게시물 감지 알고리즘

- [ ] **상품 정보 추출 정확도 향상**
  - 정규표현식 패턴 최적화
  - AI 기반 텍스트 분석 활용
  - 수동 검토 및 수정 기능

### 보안 및 컴플라이언스
- [ ] **API 키 보안**
  - 환경변수 암호화
  - 토큰 주기적 갱신
  - 접근 권한 최소화

- [ ] **개인정보 보호**
  - 수집 대상 데이터 최소화
  - 개인식별정보 제외
  - GDPR/개인정보보호법 준수

## 🚀 단계별 구현 순서

### Phase 1: 기본 인프라 (1주)
1. 데이터베이스 스키마 생성
2. 밴드 API 클라이언트 구현
3. OAuth 인증 플로우 구현

### Phase 2: 핵심 기능 (2주)
1. 게시물 수집 로직 구현
2. 상품 정보 파싱 서비스
3. 기본 API 엔드포인트 구현

### Phase 3: UI 개발 (1주)
1. 소싱처 관리 페이지
2. 게시물 목록 및 상세 페이지
3. 대시보드 통합

### Phase 4: 최적화 및 안정화 (1주)
1. 에러 처리 및 로깅
2. 성능 최적화
3. 테스트 코드 작성

## 📝 참고 자료

- [네이버 밴드 API 공식 문서](https://developers.naver.com/docs/login/band/)
- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
- [Prisma 공식 문서](https://www.prisma.io/docs/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

---

**💡 참고**: 이 체크리스트는 첫 번째 도매밴드(네이버 밴드) 구현을 위한 가이드입니다. 이후 다른 소싱처(쇼핑몰, 다른 플랫폼) 추가 시에는 `SourceProvider` 모델과 전략 패턴을 활용하여 확장 가능합니다.