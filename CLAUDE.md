# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

BandAuto는 Band 기반 소셜커머스 상품 소싱 및 판매 자동화 플랫폼입니다. **2개의 독립적인 Next.js 앱**과 **공유 DB 패키지**로 구성된 모노레포입니다.

## 아키텍처

```
bandauto/
├── shop-app/        # 고객용 쇼핑몰 (포트 3000) - 상품 조회, 장바구니, 결제
├── sourcing-app/    # 관리자/워커 (포트 3001) - 상품 소싱, AI 가공, 쇼핑몰 관리
└── db/              # 공유 Prisma 패키지 (@bandauto/db)
```

### 앱별 역할
- **Shop App**: 고객용 쇼핑몰 프론트엔드 - 상품 목록/상세, 장바구니, 토스페이먼츠 결제, 주문 관리, 마이페이지
- **Sourcing App**: 관리자 백오피스 - 채널 관리, Playwright 상품 수집, Gemini AI 가공, 소매 밴드 발행, 주문/정산/CS 관리

## 개발 명령어

```bash
# 개발 서버 실행
npm run dev:shop          # Shop 앱 (포트 3000)
npm run dev:sourcing      # Sourcing 앱 (포트 3001)
npm run dev:all           # 두 앱 동시 실행

# 빌드
npm run build:shop
npm run build:sourcing
npm run build:all

# 타입체크
npm run typecheck         # 전체
npm run typecheck:shop
npm run typecheck:sourcing

# 테스트 (Playwright)
npm test                  # E2E 테스트
npm run test:ui           # 테스트 UI 모드
npm run test:headed       # 헤드 모드

# Lint
npm run lint
```

**참고**: 개발 서버는 Turbopack을 사용하여 빠른 HMR과 컴파일 속도를 제공합니다.

## Prisma CLI

**중요: db 폴더에서 `--schema prisma` 옵션 필수**

```bash
cd db
npx prisma generate --schema prisma   # 클라이언트 생성
npx prisma db push --schema prisma    # 스키마 동기화
npx prisma studio --schema prisma     # GUI
npx prisma validate --schema prisma   # 검증
npx prisma db pull --schema prisma    # DB에서 스키마 가져오기
```

### Prisma 스키마 구조
- `db/prisma/schema.prisma`: generator, datasource, enum 정의
- `db/prisma/models/*.prisma`: 모델 정의 (user, product, order, payment 등 24개)
- `--schema prisma` 옵션이 models/ 하위 파일도 자동 로드

## 기술 스택

| 영역 | 기술 |
|-----|-----|
| Framework | Next.js 14.2.3 (App Router) |
| Language | TypeScript 5.9 |
| ORM | Prisma 6.19 |
| Database | MySQL (Prod) / SQLite (Dev) |
| Auth | NextAuth.js 4.24 (JWT) |
| Payment | Toss Payments SDK |
| AI | Google Gemini API |
| Automation | Playwright 1.55 |
| State | Zustand 4.5 |
| Queue | Bull 4.16 + Redis |
| Deploy | AWS EC2, PM2, Jenkins |

## 핵심 원칙

1. **Soft Delete 기본** - Hard Delete 금지
2. **트랜잭션 필수** - 다중 테이블 변경 시 반드시 트랜잭션 사용
3. **도메인 분리** - 비즈니스 로직을 Controller/UI 레이어에 작성하지 않음
4. **앱 간 모듈 격리** - shop-app과 sourcing-app 간 직접 모듈 참조 금지

## 커밋 메시지 규칙

```
type(scope): 한 줄 요약
```

| type | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 (기능 변경 없음) |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `docs` | 문서 변경 |
| `chore` | 빌드, 설정 등 기타 변경 |

| scope | 설명 |
|-------|------|
| `sourcing` | 소싱 앱 변경 |
| `shop` | 쇼핑몰 앱 변경 |
| `db` | 데이터베이스/Prisma 변경 |
| `ci/cd` | CI/CD 파이프라인 변경 |

## 문서 업데이트 규칙

기능 구현 완료 시 해당 앱의 docs 폴더 문서를 업데이트:

| 문서 | 업데이트 시점 |
|------|-------------|
| `docs/STRUCTURE.md` | 폴더/파일 구조 변경 시 |
| `docs/API.md` | API 엔드포인트 추가/변경 시 |
| `docs/FRONTEND.md` | 페이지/컴포넌트 추가/변경 시 |
| `docs/BACKEND.md` | 서버 로직 변경 시 |
| `docs/DATABASE.md` | DB 스키마 변경 시 |
| `docs/tracking/CHANGELOG.md` | 모든 기능 구현 완료 시 |

## 앱별 문서

각 앱에는 더 상세한 가이드라인이 있습니다:
- `shop-app/CLAUDE.md` - Shop 앱 전용 규칙
- `sourcing-app/CLAUDE.md` - Sourcing 앱 전용 규칙
- `shop-app/docs/` - Shop 앱 문서
- `sourcing-app/docs/` - Sourcing 앱 문서
