# BandAuto

밴드 자동화 + 토스페이먼츠 통합 쇼핑몰 시스템

## 📦 버전별 브랜치

현재 개발 중인 프로젝트의 각 버전은 별도 브랜치로 관리됩니다.

### 브랜치 목록

- **[1.1](https://github.com/abcpharm00002-spec/bandauto/tree/1.1)** - AI 설정 시스템 재구축 (2025-11-03)
  - Gemini + OpenAI 듀얼 지원
  - 동적 API 키 관리
  - 향상된 에러 처리

## 🚀 시작하기

원하는 버전의 브랜치를 클론하세요:

```bash
# v1.1 브랜치 클론
git clone -b 1.1 https://github.com/abcpharm00002-spec/bandauto.git
cd bandauto

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 API 키 등 설정

# 데이터베이스 초기화
npx prisma generate
npx prisma db push

# 개발 서버 실행
npm run dev
```

## 📖 문서

각 브랜치의 `VERSION.md` 또는 `CLAUDE.md` 파일을 참조하세요.

## 🏷️ 릴리즈

- [v1.1](https://github.com/abcpharm00002-spec/bandauto/releases/tag/v1.1) - AI Settings System Rebuild

## 🔧 기술 스택

- Next.js 14
- TypeScript
- Prisma ORM
- Gemini AI / OpenAI
- Toss Payments

## 📝 라이센스

MIT License

---

**최신 버전**: [1.1 브랜치](https://github.com/abcpharm00002-spec/bandauto/tree/1.1)
