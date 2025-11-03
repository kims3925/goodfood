# BandAuto - 밴드 자동화 판매 시스템

도매 밴드의 상품을 자동으로 수집하여 AI로 상세페이지를 제작하고, 스룩페이를 통해 결제 링크를 생성한 후 소매 밴드에 자동으로 업로드하는 통합 자동화 시스템입니다.

## 🚀 시작하기

### 필수 요구사항

- Node.js 18.0 이상
- PostgreSQL 15 이상
- Redis 6.0 이상
- npm 또는 yarn

### 설치

1. **의존성 설치**
```bash
npm install
```

2. **환경 변수 설정**
```bash
cp .env.example .env.local
# .env.local 파일을 열어 필요한 API 키와 설정값 입력
```

3. **데이터베이스 설정**
- PostgreSQL과 Redis 설치 (DATABASE_SETUP.md 참고)
- 데이터베이스 생성:
```bash
createdb bandauto
```

4. **Prisma 설정**
```bash
npx prisma migrate dev
npx prisma generate
```

5. **개발 서버 실행**
```bash
npm run dev
```

http://localhost:3000 에서 애플리케이션을 확인할 수 있습니다.

## 📚 문서

- [CLAUDE.md](./CLAUDE.md) - 프로젝트 상세 문서
- [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) - 개발 로드맵 및 체크리스트
- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - 데이터베이스 설정 가이드

## 🛠 주요 기능

1. **도매 밴드 상품 수집**: 도매 밴드에서 상품 게시물 자동 크롤링
2. **AI 상세페이지 생성**: OpenAI/Claude API를 활용한 매력적인 상품 설명 자동 생성
3. **스룩페이 자동화**: Playwright를 통한 자동 로그인 및 엑셀 업로드
4. **결제 링크 생성**: 스룩페이 결제 링크 자동 생성 및 관리
5. **소매 밴드 자동 포스팅**: 여러 소매 밴드에 동시 게시
6. **주문 관리**: 자동 발주서 생성 및 알림 발송

## 🔧 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
npm run start

# 린트 검사
npm run lint

# 타입 체크
npm run type-check

# 코드 포맷팅
npm run format

# Prisma 명령어
npm run prisma:generate  # Prisma Client 생성
npm run prisma:migrate   # 마이그레이션 실행
npm run prisma:studio    # Prisma Studio 실행
```

## 📁 프로젝트 구조

```
bandauto/
├── app/                # Next.js App Router
├── components/         # React 컴포넌트
├── lib/               # 라이브러리 & 유틸리티
├── services/          # 비즈니스 로직 서비스
├── prisma/            # 데이터베이스 스키마
├── public/            # 정적 파일
├── styles/            # 전역 스타일
├── types/             # TypeScript 타입 정의
└── hooks/             # Custom React Hooks
```

## 🤝 기여하기

프로젝트에 기여하고 싶으시다면 Pull Request를 보내주세요!

## 📄 라이센스

MIT License