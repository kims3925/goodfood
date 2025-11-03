# 네이버 밴드 API 분석 및 해결책

## 🚨 현재 문제 상황

### 발생한 에러들
1. **에러 코드 2300**: `Band API Error: undefined (Code: 2300)`
2. **HTTP 404**: API 엔드포인트 접근 불가

### 테스트 결과 분석
- ✅ **밴드 목록 조회**: 성공 (26개 밴드 확인)
- ❌ **게시물 조회**: 실패 (모든 밴드에서 동일한 오류)
- ✅ **API 토큰 유효성**: 정상 (기본 인증은 통과)

## 🔍 원인 분석

### 가설 1: OAuth 2.0 인증 플로우 필요
- 현재 사용 중인 `BAND_ACCESS_TOKEN`은 개인 액세스 토큰
- 밴드 게시물 접근을 위해서는 **사용자 동의**를 거친 OAuth 토큰이 필요할 수 있음
- 네이버 밴드 API는 사용자의 명시적 허가가 있어야 게시물 접근 가능

### 가설 2: API 권한 스코프 문제  
- 현재 애플리케이션에 설정된 권한 스코프가 게시물 읽기를 포함하지 않을 수 있음
- 네이버 개발자센터에서 권한 설정 확인 필요

### 가설 3: API 엔드포인트 변경
- 네이버 밴드 API v2.1의 실제 엔드포인트가 문서와 다를 수 있음
- REST API 형식이 아닌 다른 방식을 사용할 수 있음

## 🛠️ 해결책

### 즉시 시도 가능한 방법들

#### 1. OAuth 2.0 인증 플로우 구현
```typescript
// 1단계: 사용자를 네이버 인증 페이지로 리다이렉트
const authUrl = `https://nid.naver.com/oauth2.0/authorize?` +
  `response_type=code&` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `scope=band`

// 2단계: 인증 코드로 액세스 토큰 교환
const tokenResponse = await fetch('https://nid.naver.com/oauth2.0/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: authorizationCode,
    redirect_uri: REDIRECT_URI
  })
})
```

#### 2. 네이버 개발자센터 설정 점검
- [ ] 애플리케이션 서비스 URL 확인
- [ ] API 권한에서 "밴드" 체크 여부 확인  
- [ ] 콜백 URL 정확히 설정되어 있는지 확인
- [ ] 애플리케이션 상태가 "검수완료" 또는 "서비스 적용"인지 확인

#### 3. 대체 접근 방법 시도
```typescript
// 다른 API 엔드포인트 패턴들
const endpoints = [
  `/v2/band/posts`,           // v2 API 시도
  `/v2.1/band/${bandKey}`,    // 밴드 정보만 먼저
  `/bands/${bandKey}`,        // 밴드 상세 정보
  `/band/posts/${bandKey}`,   // 순서 변경
]
```

### 단계별 구현 계획

#### Phase 1: OAuth 인증 시스템 구축 (우선순위: 높음)
1. **인증 플로우 API 구현**
   - `GET /api/auth/band` - 인증 URL 생성
   - `GET /api/auth/band/callback` - 콜백 처리
   - `POST /api/auth/band/refresh` - 토큰 갱신

2. **사용자 동의 획득**
   - 프론트엔드에서 팝업 또는 리다이렉트로 인증 진행
   - 사용자가 밴드 접근 권한 허가
   - OAuth 토큰 저장 및 관리

#### Phase 2: 크롤링 대안 (우선순위: 중간)
네이버 밴드 API가 제한적일 경우 Playwright를 활용한 웹 크롤링 고려

```typescript
// Playwright를 이용한 밴드 크롤링
async function crawlBandPosts(bandUrl: string) {
  const browser = await playwright.chromium.launch()
  const page = await browser.newPage()
  
  // 로그인 과정 자동화
  await page.goto('https://band.us/login')
  // ... 로그인 로직
  
  // 밴드 페이지 접근
  await page.goto(bandUrl)
  
  // 게시물 데이터 추출
  const posts = await page.$$eval('.post-item', elements => 
    elements.map(el => ({
      title: el.querySelector('.post-title')?.textContent,
      content: el.querySelector('.post-content')?.textContent,
      author: el.querySelector('.author-name')?.textContent,
      date: el.querySelector('.post-date')?.textContent,
      images: Array.from(el.querySelectorAll('img')).map(img => img.src)
    }))
  )
  
  return posts
}
```

#### Phase 3: 혼합 접근법 (우선순위: 낮음)
- API와 크롤링을 조합하여 사용
- 공개 데이터는 API, 상세 데이터는 크롤링
- 백업 시스템으로 활용

## 📋 다음 단계 체크리스트

### 🔴 즉시 확인 필요
- [ ] 네이버 개발자센터 애플리케이션 설정 점검
- [ ] API 권한 스코프에 "밴드" 포함 여부 확인
- [ ] 서비스 URL과 콜백 URL 정확성 확인

### 🟡 단기 구현 (1-2일)
- [ ] OAuth 2.0 인증 플로우 구현
- [ ] 사용자 동의 기반 토큰 획득 시스템
- [ ] 토큰 저장 및 갱신 로직

### 🟢 장기 대안 (1주)
- [ ] Playwright 기반 크롤링 시스템
- [ ] 데이터 수집 스케줄러
- [ ] 에러 핸들링 및 복구 메커니즘

## 🎯 권장 사항

**현재 상황에서 가장 빠른 해결책:**
1. **네이버 개발자센터 설정 점검** (30분 소요)
2. **OAuth 2.0 플로우 구현** (2시간 소요)  
3. **기본 게시물 수집 테스트** (1시간 소요)

만약 API 제한이 계속될 경우, **Playwright 크롤링**으로 대체하여 프로젝트 진행 지연을 방지하는 것을 추천합니다.