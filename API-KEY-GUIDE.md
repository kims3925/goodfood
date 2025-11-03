# Google Gemini API 키 발급 가이드

## 문제 상황
현재 API 키로는 어떤 모델에도 접근할 수 없습니다. 새 API 키가 필요합니다.

## 새 API 키 발급 방법

### 1단계: Google AI Studio 접속
🔗 https://aistudio.google.com/app/apikey

### 2단계: 새 API 키 생성
1. **"Get API key"** 또는 **"Create API Key"** 버튼 클릭
2. 프로젝트 선택:
   - 기존 Google Cloud 프로젝트가 있다면 선택
   - 없다면 **"Create API key in new project"** 선택
3. 생성된 API 키 복사

### 3단계: .env.local 파일 업데이트
```env
GOOGLE_AI_API_KEY="여기에-새로운-API-키-붙여넣기"
```

### 4단계: API 키 테스트
```bash
node test-gemini.js
```

## 주의사항

### 무료 플랜 제한
- **분당**: 15회 요청
- **일일**: 1,500회 요청
- **월간**: 1,500회 요청

### 프로젝트에서 사용하는 곳
이 프로젝트에서는 다음 기능에 Gemini API를 사용합니다:
- 도매 밴드 상품 자동 분석
- 상품 제목 생성 (20자 고정)
- 카테고리 자동 분류
- 가격정책 자동 적용

**한 번에 최대 30개 상품을 처리**하므로 할당량을 빠르게 소진할 수 있습니다.

## 대안 방법

### 옵션 1: 유료 플랜 업그레이드
더 높은 할당량이 필요하다면:
- Google Cloud Console에서 청구 계정 설정
- API 사용량에 따라 과금

### 옵션 2: 여러 API 키 사용
- 여러 Google 계정으로 여러 API 키 발급
- 코드에서 API 키 로테이션 구현

### 옵션 3: 다른 AI 서비스 사용
프로젝트는 다음 AI 서비스도 지원 가능:
- OpenAI GPT-4
- Anthropic Claude

## 문제 해결

### "API key not valid"
→ API 키를 다시 복사해서 붙여넣으세요 (공백 없이)

### "exceeded your current quota"
→ 새 Google 계정으로 새 API 키 발급

### "models not found"
→ API 키가 유효하지 않거나 프로젝트가 비활성화됨

## 도움이 필요하신가요?
1. https://ai.google.dev/gemini-api/docs 공식 문서
2. https://aistudio.google.com/app/apikey API 키 관리
3. https://ai.dev/usage 사용량 확인
