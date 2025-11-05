# BandAuto v1.1

**릴리즈 날짜**: 2025-11-03

## 🎯 주요 변경사항

### 1. AI 설정 시스템 완전 재구축
- TypeScript 인터페이스 통일 (프론트엔드/백엔드)
- Gemini + OpenAI 듀얼 지원 구조
- 설정 파일 우선, 환경변수 폴백 시스템

### 2. 동적 AI 서비스 통합
- `lib/gemini-ai.ts`: 설정 파일에서 API 키 자동 로드
- 실시간 모델 선택 지원
- 매 호출마다 최신 설정 반영

### 3. AI 설정 UI 개선
- 탭 구조 (설정/테스트)
- Provider 선택 (Gemini/OpenAI)
- 모델별 가격 정보 표시
- 실시간 API 연결 테스트

### 4. 에러 처리 강화
- 상세 에러 로깅 추가
- Provider별 에러 분류
- 사용자 친화적 에러 메시지

## 📝 변경된 파일

### 백엔드
- `lib/config-storage.ts`: AISettings 인터페이스 확장
- `lib/gemini-ai.ts`: 동적 API 키/모델 로드 시스템
- `app/api/settings/ai/route.ts`: 설정 저장/로드 API
- `app/api/settings/ai/test/route.ts`: 듀얼 provider 테스트 API

### 프론트엔드
- `app/(admin)/admin/settings/ai/page.tsx`: UI 완전 재설계

## 🔧 기술 스택
- Next.js 14 (App Router)
- TypeScript
- Gemini AI API
- OpenAI API
- Prisma ORM

## 📦 설치 및 실행

```bash
# 의존성 설치
npm install

# 데이터베이스 설정
npx prisma generate
npx prisma db push

# 개발 서버 실행
npm run dev
```

## 🔑 환경 변수 설정

`.env.local` 파일 생성:

```env
# AI 설정은 관리자 페이지에서 가능
# 또는 환경변수로 설정 (설정 파일 우선)
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
```

## 📋 알려진 이슈

### OpenAI API
- **에러**: "You exceeded your current quota"
- **원인**: 무료 크레딧 소진 또는 결제 수단 미등록
- **해결**: https://platform.openai.com/account/billing 에서 결제 수단 등록

### Gemini API
- **에러**: "quota exceeded"
- **원인**: 일일 할당량 초과 또는 새 계정 제한
- **해결**: 다른 Google 계정으로 새 API 키 발급

## 🚀 다음 버전 계획 (v1.2)

- [ ] OpenAI API를 실제 상품 수집에도 사용
- [ ] AI Provider별 성능 비교 기능
- [ ] 자동 API 키 로테이션 시스템
- [ ] 비용 추적 대시보드

---

**GitHub**: https://github.com/abcpharm00002-spec/bandauto
**버전 태그**: v1.1
**커밋**: 3fb2c6a

🤖 Generated with Claude Code
https://claude.com/claude-code
