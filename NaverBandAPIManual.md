# Naver Band API 매뉴얼

## 📖 개요

네이버 밴드 API는 밴드 데이터를 읽고 쓸 수 있는 Open API를 제공합니다. 이 매뉴얼은 주요 API 엔드포인트와 사용법을 정리한 것입니다.

### 🔑 기본 인증

모든 API 요청에는 `access_token`이 필요합니다.

```javascript
const accessToken = process.env.BAND_ACCESS_TOKEN
```

## 📋 주요 API 엔드포인트

### 1. 게시물 목록 조회 (Get Posts)

**📍 엔드포인트:** `https://openapi.band.us/v2/band/posts`
**🔢 버전:** v2
**📤 메소드:** GET

#### 필수 파라미터
- `access_token` (string): 사용자 액세스 토큰
- `band_key` (string): 밴드 ID
- `locale` (string): 지역 및 언어 (예: "ko_KR", "en_US")

#### 선택 파라미터
- `after` (string): 페이지네이션을 위한 커서
- `limit` (integer): 반환할 게시물 수 (기본값: 20)

#### 요청 예시
```javascript
const postsUrl = new URL('https://openapi.band.us/v2/band/posts')
postsUrl.searchParams.append('access_token', accessToken)
postsUrl.searchParams.append('band_key', bandKey)
postsUrl.searchParams.append('locale', 'ko_KR')

const response = await fetch(postsUrl.toString())
const data = await response.json()
```

#### 응답 구조
```json
{
  "result_code": 1,
  "result_data": {
    "paging": {
      "next_params": {
        "after": "cursor_value",
        "limit": 20
      }
    },
    "items": [
      {
        "post_key": "post_id",
        "content": "게시물 내용",
        "author": {
          "name": "작성자명",
          "profile_image_url": "프로필 이미지 URL"
        },
        "created_at": 1692123456,
        "comment_count": 5,
        "emotion_count": 10,
        "photos": []
      }
    ]
  }
}
```

### 2. 게시물 상세 조회 (Get Post)

**📍 엔드포인트:** `https://openapi.band.us/v2.1/band/post`
**🔢 버전:** v2.1
**📤 메소드:** GET

#### 필수 파라미터
- `access_token` (string): 사용자 액세스 토큰
- `band_key` (string): 밴드 ID
- `post_key` (string): 게시물 ID

#### 요청 예시
```javascript
const postUrl = new URL('https://openapi.band.us/v2.1/band/post')
postUrl.searchParams.append('access_token', accessToken)
postUrl.searchParams.append('band_key', bandKey)
postUrl.searchParams.append('post_key', postKey)

const response = await fetch(postUrl.toString())
const data = await response.json()
```

#### 응답 구조
```json
{
  "result_code": 1,
  "result_data": {
    "post": {
      "post_key": "post_id",
      "content": "상세 게시물 내용 (HTML 태그 이스케이프됨)",
      "author": {
        "name": "작성자명",
        "profile_image_url": "프로필 이미지 URL"
      },
      "created_at": 1692123456,
      "comment_count": 5,
      "emotion_count": 10,
      "photo": [
        {
          "url": "이미지 URL",
          "width": 800,
          "height": 600
        }
      ]
    }
  }
}
```

### 3. 밴드 목록 조회 (Get Bands)

**📍 엔드포인트:** `https://openapi.band.us/v2.1/bands`
**🔢 버전:** v2.1
**📤 메소드:** GET

#### 헤더 방식 인증 (권장)
```javascript
const response = await fetch('https://openapi.band.us/v2.1/bands', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'User-Agent': 'YourAppName/1.0.0'
  }
})
```

#### 응답 구조
```json
{
  "result_code": 1,
  "result_data": {
    "bands": [
      {
        "band_key": "band_id",
        "name": "밴드명",
        "description": "밴드 설명",
        "member_count": 100,
        "cover": "커버 이미지 URL",
        "is_public": false
      }
    ]
  }
}
```

## 🔄 페이지네이션

게시물 목록 API는 페이지네이션을 지원합니다.

```javascript
// 첫 페이지
let url = 'https://openapi.band.us/v2/band/posts?access_token=xxx&band_key=yyy&locale=ko_KR'

// 다음 페이지 (next_params 사용)
if (data.result_data.paging.next_params) {
  const nextUrl = new URL('https://openapi.band.us/v2/band/posts')
  Object.entries(data.result_data.paging.next_params).forEach(([key, value]) => {
    nextUrl.searchParams.append(key, value)
  })
}
```

## 🚨 오류 처리

### 일반적인 HTTP 상태 코드
- `200 OK`: 성공
- `400 Bad Request`: 잘못된 요청 (파라미터 오류 등)
- `401 Unauthorized`: 인증 실패 (토큰 무효 또는 만료)
- `403 Forbidden`: 권한 없음 (밴드 접근 권한 없음)
- `404 Not Found`: 리소스 없음 (밴드 또는 게시물 없음)

### result_code 의미
- `1`: 성공
- `300`: OAuth 오류
- `10400`: 잘못된 요청

### 오류 응답 예시
```json
{
  "result_code": 300,
  "result_data": {
    "message": "oauth error",
    "detail": {
      "error": "invalid_token",
      "error_description": ""
    }
  }
}
```

## 📝 실제 구현 예시

### 완전한 게시물 수집 함수
```javascript
async function collectBandPosts(bandKey, limit = 20) {
  try {
    // 1단계: 게시물 목록 조회
    const postsUrl = new URL('https://openapi.band.us/v2/band/posts')
    postsUrl.searchParams.append('access_token', process.env.BAND_ACCESS_TOKEN)
    postsUrl.searchParams.append('band_key', bandKey)
    postsUrl.searchParams.append('locale', 'ko_KR')
    
    const postsResponse = await fetch(postsUrl.toString(), {
      headers: { 'User-Agent': 'BandAuto/1.0.0' }
    })
    
    if (!postsResponse.ok) {
      throw new Error(`Posts API Error: ${postsResponse.status}`)
    }
    
    const postsData = await postsResponse.json()
    const posts = postsData.result_data?.items || []
    
    // 2단계: 각 게시물 상세 조회
    const detailedPosts = []
    
    for (const post of posts.slice(0, limit)) {
      const postUrl = new URL('https://openapi.band.us/v2.1/band/post')
      postUrl.searchParams.append('access_token', process.env.BAND_ACCESS_TOKEN)
      postUrl.searchParams.append('band_key', bandKey)
      postUrl.searchParams.append('post_key', post.post_key)
      
      const postResponse = await fetch(postUrl.toString(), {
        headers: { 'User-Agent': 'BandAuto/1.0.0' }
      })
      
      if (postResponse.ok) {
        const postData = await postResponse.json()
        const detailPost = postData.result_data.post
        
        detailedPosts.push({
          post_key: post.post_key,
          title: post.content?.substring(0, 50) + '...' || '제목 없음',
          content: detailPost?.content || post.content || '',
          author: post.author?.name || '알 수 없음',
          created_at: new Date(post.created_at * 1000),
          images: detailPost?.photo || [],
          comment_count: post.comment_count || 0,
          emotion_count: post.emotion_count || 0
        })
      }
      
      // Rate limiting 방지
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    return detailedPosts
    
  } catch (error) {
    console.error('게시물 수집 실패:', error)
    throw error
  }
}
```

## ⚙️ API 버전별 차이점

### v2 vs v2.1 주요 차이점

| API | v2 엔드포인트 | v2.1 엔드포인트 |
|-----|---------------|----------------|
| 게시물 목록 | `v2/band/posts` | - |
| 게시물 상세 | - | `v2.1/band/post` |
| 밴드 목록 | - | `v2.1/bands` |

### 응답 구조 차이점

**게시물 목록 (v2):**
- 응답: `result_data.items[]`
- 이미지: `photos` 배열

**게시물 상세 (v2.1):**
- 응답: `result_data.post`
- 이미지: `photo` 배열

## 🔐 인증 방식

### 1. URL 파라미터 방식
```javascript
const url = `https://openapi.band.us/v2/band/posts?access_token=${token}&band_key=${bandKey}&locale=ko_KR`
```

### 2. Authorization 헤더 방식 (v2.1)
```javascript
const response = await fetch('https://openapi.band.us/v2.1/bands', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'YourApp/1.0.0'
  }
})
```

## 🎯 권장 사항

### 1. Rate Limiting
API 호출 간에 적절한 지연시간을 두세요:
```javascript
await new Promise(resolve => setTimeout(resolve, 300)) // 300ms 대기
```

### 2. 에러 핸들링
항상 HTTP 상태 코드와 result_code를 모두 확인하세요:
```javascript
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${await response.text()}`)
}

const data = await response.json()
if (data.result_code !== 1) {
  throw new Error(`API Error: ${data.result_code}`)
}
```

### 3. User-Agent 설정
모든 요청에 적절한 User-Agent를 설정하세요:
```javascript
headers: {
  'User-Agent': 'YourAppName/1.0.0'
}
```

### 4. 토큰 관리
액세스 토큰이 만료될 수 있으므로 refresh 로직을 구현하세요.

## 🔧 트러블슈팅

### 자주 발생하는 오류

1. **HTTP 401 / result_code 300**
   - 토큰 만료 또는 유효하지 않음
   - OAuth 재인증 필요

2. **HTTP 404 / result_code 10400**
   - 잘못된 band_key 또는 post_key
   - API 엔드포인트 URL 확인 필요

3. **HTTP 403**
   - 해당 밴드에 접근 권한 없음
   - 밴드 멤버십 확인 필요

### 디버깅 팁

1. **API 응답 로깅:**
```javascript
console.log('API Response:', JSON.stringify(data, null, 2))
```

2. **URL 확인:**
```javascript
console.log('Request URL:', url.toString())
```

3. **토큰 확인:**
```javascript
console.log('Token Preview:', accessToken.substring(0, 20) + '...')
```

## 📚 참고 자료

- [Band Developers 공식 문서](https://developers.band.us/develop/guide/api)
- [OAuth 인증 가이드](https://developers.band.us/develop/guide/api/get_authorization_code_from_user)
- [Band Developer Center](https://developers.band.us/)

---

**작성일:** 2025-08-23  
**버전:** 1.0  
**업데이트:** 최신 API 엔드포인트 및 응답 구조 반영