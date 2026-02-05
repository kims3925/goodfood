# BandAuto 인수인계 체크리스트

> **최종 업데이트:** 2026-02
> **대상:** 신규 개발자

---

## 1. 프로젝트 개요

### 비즈니스 설명

BandAuto는 **Band 기반 소셜커머스 상품 소싱 및 판매 자동화 플랫폼**입니다.

```
[도매 밴드] → [상품 수집] → [AI 가공] → [소매 밴드 발행] → [고객 구매]
```

### 핵심 기능

| 기능 | 설명 | 앱 |
|------|------|-----|
| 상품 수집 | Playwright로 도매 밴드에서 상품 자동 수집 | Sourcing |
| AI 가공 | Gemini로 상품 설명 생성/최적화 | Sourcing |
| 발행 | 소매 밴드로 상품 자동 게시 | Sourcing |
| 쇼핑몰 | 고객 상품 조회, 장바구니, 결제 | Shop |
| 주문 관리 | 주문 처리, 배송, CS | Sourcing |

### 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| Framework | Next.js (App Router) | 14.2.3 |
| Language | TypeScript | 5.9 |
| ORM | Prisma | 6.2 |
| Database | MariaDB | 10.11 |
| Auth | NextAuth.js (JWT) | 4.24 |
| Payment | Toss Payments | - |
| AI | Google Gemini | - |
| Automation | Playwright | 1.58.1 |
| State | Zustand | 4.5 |
| Queue | Bull + Redis | - |
| Container | Docker Compose | - |
| Package Manager | pnpm | 9.15.9 |

---

## 2. 아키텍처

### 모노레포 구조

```
bandauto/
├── shop-app/        # 고객용 쇼핑몰 (포트 3000)
├── sourcing-app/    # 관리자/워커 (포트 3001)
└── db/              # 공유 Prisma 패키지 (@bandauto/db)
```

### 앱별 역할

| 앱 | 역할 | 사용자 | 포트 |
|----|------|--------|------|
| shop-app | 쇼핑몰 프론트엔드 | 고객 | 3000 |
| sourcing-app | 관리자 백오피스 | 관리자/매니저 | 3001 |
| db | Prisma ORM 패키지 | (공유) | - |

### 프로덕션 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                   Docker Compose 환경                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  shop-app   │  │sourcing-app │  │   mariadb   │        │
│  │   :3000     │  │   :3001     │  │   :3306     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐                                           │
│  │    redis    │       볼륨: /home/ubuntu/assets           │
│  │   :6379     │                                           │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 접근 권한 확인

### 저장소 및 서버

- [ ] GitHub 저장소 접근 권한
- [ ] AWS EC2 SSH 접근 권한 (운영 서버)

### 외부 서비스 계정

- [ ] 토스페이먼츠 대시보드 (테스트/운영 키)
- [ ] Google Cloud Console (Gemini API)
- [ ] Band 개발자 센터 (OAuth 앱)

### 환경 변수 파일

| 파일 | 용도 |
|------|------|
| `.env` | Docker Compose용 (DB 비밀번호 등) |
| `db/.env` | Prisma DATABASE_URL |
| `shop-app/.env.local` | Shop 앱 환경 변수 |
| `sourcing-app/.env` | Sourcing 앱 환경 변수 |

- [ ] `.env` 파일 전달받음
- [ ] `db/.env` 파일 전달받음
- [ ] `shop-app/.env.local` 파일 전달받음
- [ ] `sourcing-app/.env` 파일 전달받음

### 주요 환경 변수

```env
# db/.env
DATABASE_URL="mysql://banduser:password@localhost:3306/sourcing_db"

# shop-app/.env.local
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=http://localhost:3000
TOSS_CLIENT_KEY=<key>
TOSS_SECRET_KEY=<key>

# sourcing-app/.env
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=http://localhost:3001
GEMINI_API_KEY=<key>
BAND_CLIENT_ID=<id>
BAND_CLIENT_SECRET=<secret>
```

---

## 4. 로컬 환경 설정

### 사전 요구사항

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- Git

### 설정 체크리스트

- [ ] Node.js 20+ 설치됨 (`node -v`)
- [ ] pnpm 9+ 설치됨 (`pnpm -v`)
- [ ] Docker 설치됨 (`docker -v`)
- [ ] Docker Compose 설치됨 (`docker-compose -v`)

### 초기 설정

```bash
# 1. 저장소 클론
git clone <repo-url> bandauto
cd bandauto

# 2. 의존성 설치
pnpm install

# 3. 환경 변수 파일 복사 (전달받은 파일)

# 4. Docker로 DB/Redis 실행
docker-compose up -d mariadb redis

# 5. Prisma 클라이언트 생성
cd db && npx prisma generate --schema prisma && cd ..

# 6. DB 스키마 동기화
cd db && npx prisma db push --schema prisma && cd ..

# 7. 개발 서버 실행
pnpm run dev:all
```

- [ ] `pnpm install` 완료
- [ ] `docker-compose up -d mariadb redis` 실행
- [ ] Prisma 클라이언트 생성 완료
- [ ] DB 스키마 동기화 완료
- [ ] http://localhost:3000 (Shop) 접속 확인
- [ ] http://localhost:3001 (Sourcing) 접속 확인

---

## 5. 코드 구조

### 공통 폴더 구조

각 앱은 동일한 구조를 따릅니다:

```
src/
├── app/           # Next.js App Router (페이지 + API)
│   ├── (group)/   # Route Group
│   └── api/       # API Routes
├── modules/       # 도메인 비즈니스 로직 ⭐ 핵심
├── components/    # UI 컴포넌트
├── hooks/         # Custom Hooks
├── services/      # 외부 서비스 호출
├── lib/           # 유틸리티
└── types/         # TypeScript 타입
```

### Shop App 구조

```
shop-app/src/
├── app/
│   ├── (shop)/              # 쇼핑몰 라우트 그룹
│   │   ├── auth/            # 로그인, 회원가입
│   │   ├── product/         # 상품 목록/상세
│   │   ├── cart/            # 장바구니
│   │   ├── checkout/        # 주문서
│   │   ├── payment/         # 결제 결과
│   │   ├── order/           # 주문 조회
│   │   └── mypage/          # 마이페이지
│   └── api/
│       ├── auth/            # NextAuth.js
│       ├── cart/            # 장바구니 API
│       ├── orders/          # 주문 API
│       └── payments/        # 결제 API
└── modules/
    ├── auth/                # 인증 서비스
    ├── cart/                # 장바구니 (Zustand)
    ├── order/               # 주문 서비스
    ├── guest-order/         # 비회원 주문
    ├── payments/            # 토스페이먼츠
    └── cs/                  # 고객서비스
```

### Sourcing App 구조

```
sourcing-app/src/
├── app/
│   ├── (admin)/             # 인증 필요 라우트 그룹
│   │   ├── sourcing/        # 소싱 관리
│   │   │   ├── channel/     # 채널 관리
│   │   │   ├── collected-product/  # 수집 상품
│   │   │   ├── product/     # 가공 상품
│   │   │   └── publish/     # 발행 관리
│   │   └── shop/            # 쇼핑몰 관리
│   │       ├── order/       # 주문 관리
│   │       ├── settlement/  # 정산
│   │       └── cs/          # CS 관리
│   └── api/
└── modules/
    ├── band-playwright/     # Playwright 상품 수집 ⭐
    ├── transformation/      # Gemini AI 가공 ⭐
    ├── automation/          # 자동화 파이프라인 ⭐
    ├── publish/             # 밴드 발행
    ├── sourcing/            # 소싱 도메인
    └── order/               # 주문 관리
```

### DB 패키지 구조

```
db/
├── prisma/
│   ├── schema.prisma        # 메인 스키마 (generator, datasource, enum)
│   └── models/              # 도메인별 모델 분리
│       ├── user.prisma
│       ├── product.prisma
│       ├── order.prisma
│       └── ...
└── src/
    └── index.ts             # PrismaClient export
```

### 코드 확인 체크리스트

- [ ] `modules/` 폴더가 핵심 비즈니스 로직임을 이해함
- [ ] Shop 앱 `src/modules/` 폴더 확인
- [ ] Sourcing 앱 `src/modules/` 폴더 확인
- [ ] `db/prisma/models/` 스키마 파일 확인

---

## 6. 핵심 비즈니스 로직

### Shop App 플로우

```
[인증] → [상품 조회] → [장바구니] → [결제] → [주문 완료]
```

| 플로우 | 모듈 | 파일 위치 |
|--------|------|-----------|
| 인증 | auth | `src/modules/auth/` |
| 장바구니 | cart | `src/modules/cart/` (Zustand) |
| 결제 | payments | `src/modules/payments/` (토스페이먼츠) |
| 주문 | order | `src/modules/order/` |
| 비회원 주문 | guest-order | `src/modules/guest-order/` |

### Sourcing App 플로우

```
[채널 등록] → [상품 수집] → [AI 가공] → [발행] → [주문 관리]
     ↓            ↓            ↓          ↓
  channel   band-playwright  transformation  publish
```

| 플로우 | 모듈 | 설명 |
|--------|------|------|
| 채널 관리 | - | 도매/소매 밴드 채널 등록 |
| 상품 수집 | band-playwright | Playwright로 밴드 게시글 크롤링 |
| AI 가공 | transformation | Gemini로 상품 설명 생성 |
| 자동화 | automation | 수집→가공→발행 파이프라인 |
| 발행 | publish | 소매 밴드에 상품 게시 |

### 핵심 모듈 상세

#### band-playwright (상품 수집)

```
src/modules/band-playwright/
├── services/
│   └── band-crawler.service.ts   # Playwright 크롤링 로직
├── types/
└── utils/
```

- Playwright headless 브라우저로 밴드 페이지 접근
- 상품 이미지, 가격, 설명 추출
- 세션 관리 (Chrome Extension으로 로그인 유지)

#### transformation (AI 가공)

```
src/modules/transformation/
├── services/
│   └── gemini.service.ts         # Gemini API 호출
├── prompts/                       # AI 프롬프트 템플릿
└── types/
```

- Google Gemini API로 상품 설명 생성
- 프롬프트 템플릿 관리
- 가격 정책 적용

#### payments (결제)

```
shop-app/src/modules/payments/
├── services/
│   └── toss-payments.service.ts  # 토스페이먼츠 SDK
├── types/
└── constants/
```

- 토스페이먼츠 SDK 연동
- 결제 승인/취소/환불
- 가상계좌 입금 확인

### 비즈니스 로직 이해 체크리스트

- [ ] Shop 앱 결제 플로우 이해함
- [ ] Sourcing 앱 수집→가공→발행 플로우 이해함
- [ ] Playwright 상품 수집 방식 이해함
- [ ] Gemini AI 가공 방식 이해함

---

## 7. 데이터베이스

### Prisma CLI 사용법

**중요: db 폴더에서 `--schema prisma` 옵션 필수**

```bash
cd db

# 클라이언트 생성
npx prisma generate --schema prisma

# 스키마 동기화 (개발용)
npx prisma db push --schema prisma

# GUI 실행
npx prisma studio --schema prisma

# 스키마 검증
npx prisma validate --schema prisma

# 마이그레이션 (운영용)
npx prisma migrate deploy --schema prisma
```

### 주요 모델 관계

```
User ─┬─ Order ─── OrderItem ─── Product
      └─ Cart ──── CartItem ────┘

Channel ─── CollectedPost ─── CollectedProduct ─── ShopProduct

Shop ─── ShopProduct ─── ProductVariant ─── ProductOption
```

### 모델 파일 위치

| 도메인 | 파일 | 주요 모델 |
|--------|------|----------|
| 사용자 | `models/user.prisma` | User, UserAddress |
| 상품 | `models/product.prisma` | Product, ProductVariant, ProductOption |
| 주문 | `models/order.prisma` | Order, OrderItem |
| 결제 | `models/payment.prisma` | Payment, PaymentLog |
| 채널 | `models/channel.prisma` | Channel, ChannelProduct |
| 수집 | `models/collected-product.prisma` | CollectedProduct |
| 게시글 | `models/post.prisma` | CollectedPost, CollectedPostImage |

### DB 확인 체크리스트

- [ ] Prisma CLI 옵션 (`--schema prisma`) 이해함
- [ ] `npx prisma studio --schema prisma`로 데이터 확인
- [ ] 주요 모델 관계 이해함

---

## 8. 개발 명령어

### 개발 서버

```bash
pnpm run dev:shop          # Shop 앱 (포트 3000)
pnpm run dev:sourcing      # Sourcing 앱 (포트 3001)
pnpm run dev:all           # 두 앱 동시 실행
```

### 빌드

```bash
pnpm run build:shop        # Shop 앱 빌드
pnpm run build:sourcing    # Sourcing 앱 빌드
pnpm run build:all         # 전체 빌드
```

### 타입체크

```bash
pnpm run typecheck         # 전체
pnpm run typecheck:shop    # Shop 앱
pnpm run typecheck:sourcing # Sourcing 앱
```

### 린트

```bash
pnpm run lint              # 전체 린트
```

### 테스트

```bash
pnpm test                  # E2E 테스트 (Playwright)
pnpm run test:ui           # 테스트 UI 모드
pnpm run test:headed       # 헤드 모드
```

### 명령어 확인 체크리스트

- [ ] `pnpm run dev:all` 실행 확인
- [ ] `pnpm run typecheck` 실행 확인
- [ ] `pnpm run build:all` 빌드 성공 확인

---

## 9. 배포 프로세스

### 배포 방식: Docker Compose

### 배포 명령어

```bash
# 전체 배포
docker-compose up -d --build

# 특정 앱만 배포
docker-compose up -d --build shop-app
docker-compose up -d --build sourcing-app

# 로그 확인
docker-compose logs -f shop-app
docker-compose logs -f sourcing-app

# 상태 확인
docker-compose ps
```

### 배포 프로세스

```bash
# 1. 코드 풀
git pull origin main

# 2. 이미지 재빌드 및 배포
docker-compose up -d --build

# 3. 상태 확인
docker-compose ps
docker-compose logs -f --tail=50
```

### Docker 파일 구조

```
docker/
├── Dockerfile.shop      # Shop 앱 (경량 Alpine 이미지)
└── Dockerfile.sourcing  # Sourcing 앱 (Playwright 포함)
```

- Sourcing 앱은 Playwright가 필요해서 이미지 크기가 큼 (~1.5GB)
- Shop 앱은 경량 Alpine 이미지 사용 (~150MB)

### 배포 확인 체크리스트

- [ ] Docker Compose 배포 방식 이해함
- [ ] 배포 명령어 순서 이해함
- [ ] 로그 확인 방법 이해함

---

## 10. 핵심 규칙

### 반드시 지켜야 할 규칙

```
1. Soft Delete 기본 - Hard Delete 금지
2. 트랜잭션 필수 - 다중 테이블 변경 시
3. 도메인 분리 - 비즈니스 로직을 UI 레이어에 작성 금지
4. 앱 간 모듈 격리 - shop-app과 sourcing-app 간 직접 참조 금지
5. 문서 먼저 - 기능 구현 시 docs 폴더 동기화 필수
6. 불변성 - 객체 변경 금지, spread 연산자 사용
```

### 커밋 메시지 규칙

```
type(scope): 한 줄 요약

type: feat, fix, refactor, perf, test, docs, chore
scope: sourcing, shop, db, ci/cd
```

예시:
```
feat(shop): 장바구니 수량 변경 기능 추가
fix(sourcing): 상품 수집 타임아웃 오류 수정
refactor(db): Order 모델 관계 정리
```

### 규칙 확인 체크리스트

- [ ] Soft Delete 규칙 이해함
- [ ] 트랜잭션 사용 규칙 이해함
- [ ] 커밋 메시지 규칙 이해함

---

## 11. 문서 체계

### 프로젝트 루트

| 문서 | 내용 |
|------|------|
| `CLAUDE.md` | 프로젝트 전체 개발 규칙 |
| `README.md` | 프로젝트 소개 |
| `docs/DEPLOYMENT.md` | 배포 가이드 |
| `docs/HANDOVER.md` | 인수인계 가이드 (현재 문서) |

### 앱별 문서

각 앱(`shop-app/`, `sourcing-app/`)에 동일한 구조:

| 문서 | 내용 |
|------|------|
| `CLAUDE.md` | 앱별 개발 규칙 |
| `docs/STRUCTURE.md` | 폴더 구조, 네이밍 규칙 |
| `docs/API.md` | API 엔드포인트 문서 |
| `docs/FRONTEND.md` | 프론트엔드 컴포넌트 가이드 |
| `docs/BACKEND.md` | 백엔드 로직 가이드 |
| `docs/DATABASE.md` | DB 스키마 설명 |
| `docs/DEPLOYMENT.md` | 배포 규칙 |
| `docs/SECURITY.md` | 보안 가이드 |
| `docs/tracking/REQUIREMENTS.md` | 기능 요구사항 |
| `docs/tracking/CHANGELOG.md` | 구현 이력 |
| `docs/tracking/FLOW.md` | 비즈니스 플로우 |

### 문서 읽는 순서 (권장)

1. `README.md` - 프로젝트 소개
2. `CLAUDE.md` - 개발 규칙
3. `docs/DEPLOYMENT.md` - 배포 프로세스
4. 각 앱의 `docs/STRUCTURE.md` - 코드 구조
5. 각 앱의 `docs/API.md` - API 명세

### 문서 확인 체크리스트

- [ ] `CLAUDE.md` 읽음
- [ ] `shop-app/CLAUDE.md` 읽음
- [ ] `sourcing-app/CLAUDE.md` 읽음
- [ ] 각 앱 `docs/` 폴더 문서 확인
