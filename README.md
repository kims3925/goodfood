# BandAuto - Modular E-commerce & Sourcing Platform

> **Version 1.1.0** | Band 기반 소셜커머스 상품 소싱 및 판매 자동화 플랫폼

BandAuto는 도매 밴드 상품 자동화부터 AI 상세페이지 생성, 토스페이먼츠 통합 쇼핑몰까지 제공하는 풀스택 자동화 플랫폼입니다.

## 📊 프로젝트 현황

| 항목 | Shop App | Sourcing App | 합계 |
|------|----------|--------------|------|
| API 엔드포인트 | 53개 | 95개 | **148개** |
| 페이지 | 33개 | 59개 | **92개** |
| 컴포넌트 | 3개 | 32개 | **35개** |
| **Prisma 모델** | - | - | **47개** |
| **스키마 라인** | - | - | **1,063줄** |

## 🌿 브랜치 전략

### 브랜치 구조

```
main                    # 프로덕션 브랜치 (안정 버전)
├── release-1           # v1.0.0 릴리즈 브랜치 (완료)
├── release-2           # v1.1.0 릴리즈 브랜치 (현재)
├── hong                # 개발자 브랜치 (홍)
└── Lee                 # 개발자 브랜치 (이)
```

### 브랜치별 용도

| 브랜치 | 용도 | 배포 환경 |
|--------|------|-----------|
| `main` | 프로덕션 코드, 안정 버전만 머지 | Production |
| `release-*` | 버전별 릴리즈 브랜치, 배포 전 검증 | Staging |
| `hong`, `Lee` | 개발자별 작업 브랜치 | Local/Dev |

### 버전 태그

| 태그 | 설명 |
|------|------|
| `v1.0.0` | 초기 릴리즈 |
| `v1.1.0` | 무통장입금 자동 취소, 비회원 주문 처리 개선 |

### 개발 워크플로우

```bash
# 1. 개발자 브랜치에서 작업
git checkout hong
# ... 작업 ...
git commit -m "feat(sourcing): 새 기능 추가"
git push origin hong

# 2. release 브랜치로 머지 후 배포 검증
git checkout release-2
git merge hong
git push origin release-2

# 3. 검증 완료 후 main으로 머지
git checkout main
git merge release-2
git push origin main
```

### 머지 규칙

- **release ← 개발자 브랜치**: 배포 전 검증용
- **main ← release**: 검증 완료 후 머지
- **main 직접 커밋 금지**

## 🏗️ 프로젝트 구조

이 프로젝트는 **2개의 독립적인 Next.js 앱**과 **공유 DB 패키지**로 구성된 모노레포입니다:

```
bandauto/
├── shop-app/                # 고객용 쇼핑몰 앱 (포트 3000)
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   │   ├── (shop)/      # 쇼핑몰 페이지 그룹
│   │   │   │   ├── main/       # 메인 페이지
│   │   │   │   ├── product/    # 상품 목록/상세
│   │   │   │   ├── cart/       # 장바구니
│   │   │   │   ├── checkout/   # 주문서 작성
│   │   │   │   ├── payment/    # 결제 처리
│   │   │   │   ├── order/      # 주문 완료/조회 (비회원 포함)
│   │   │   │   ├── mypage/     # 마이페이지
│   │   │   │   ├── cs/         # 고객센터
│   │   │   │   ├── band/       # 밴드 연동
│   │   │   │   ├── popular/    # 인기 상품
│   │   │   │   └── auth/       # 인증 (로그인/회원가입)
│   │   │   └── api/            # REST API
│   │   ├── components/      # 쇼핑몰 UI 컴포넌트
│   │   ├── contexts/        # React Context
│   │   ├── hooks/           # Custom Hooks
│   │   ├── modules/         # 비즈니스 로직 모듈
│   │   └── services/        # 서비스 레이어
│   └── .env.local           # 환경변수
│
├── sourcing-app/            # 관리자/워커 앱 (포트 3001)
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   │   ├── (admin)/     # 관리자 페이지 그룹
│   │   │   │   ├── sourcing/   # 소싱 관리
│   │   │   │   │   ├── automation/         # 자동화 설정
│   │   │   │   │   ├── channel/            # 채널 관리
│   │   │   │   │   ├── collected-product/  # 수집 상품
│   │   │   │   │   ├── product/            # 가공 상품
│   │   │   │   │   ├── post/               # 게시글 관리
│   │   │   │   │   ├── publish/            # 발행 관리
│   │   │   │   │   ├── dashboard/          # 대시보드
│   │   │   │   │   ├── settings/           # 설정 (Google Sheets 등)
│   │   │   │   │   ├── notification/       # 알림 관리
│   │   │   │   │   └── user/               # 사용자 관리
│   │   │   │   └── shop/       # 쇼핑몰 관리
│   │   │   │       ├── order/              # 주문 관리 (외부 주문 포함)
│   │   │   │       ├── wholesale-orders/   # 도매 주문
│   │   │   │       ├── settlement/         # 정산 관리
│   │   │   │       ├── user/               # 회원 관리
│   │   │   │       ├── store/              # 스토어 관리
│   │   │   │       ├── visitors/           # 방문자 통계
│   │   │   │       ├── cs/                 # CS 관리
│   │   │   │       ├── reviews/            # 리뷰 관리
│   │   │   │       ├── coupon/             # 쿠폰 관리
│   │   │   │       ├── notification/       # 알림 관리
│   │   │   │       ├── dashboard/          # 쇼핑몰 대시보드
│   │   │   │       └── policy/             # 약관 관리
│   │   │   ├── (auth)/         # 인증 페이지
│   │   │   └── api/            # REST API + cron jobs
│   │   ├── components/      # 관리자 UI 컴포넌트
│   │   ├── modules/         # 비즈니스 로직 모듈
│   │   │   ├── auth/           # 인증
│   │   │   ├── automation/     # 자동화 스케줄러/파이프라인
│   │   │   ├── band-playwright/# Playwright 밴드 자동화
│   │   │   ├── order/          # 주문 (자동 취소 스케줄러)
│   │   │   ├── publish/        # 발행 서비스
│   │   │   ├── sourcing/       # 소싱 도메인
│   │   │   ├── transformation/ # AI 변환
│   │   │   └── catalog/        # 카탈로그
│   │   └── services/        # 서비스 레이어
│   └── .env                 # 환경변수
│
├── db/                      # 공유 데이터베이스 패키지 (@bandauto/db)
│   ├── prisma/
│   │   ├── schema.prisma    # Prisma 설정 (generator, datasource, enum)
│   │   ├── models/          # 모델 정의 (47개 모델)
│   │   └── migrations/      # 마이그레이션 히스토리
│   └── src/                 # Prisma Client 및 타입 export
│
├── docs/                    # 프로젝트 문서
└── band-session-extension/  # Chrome 확장 프로그램 (밴드 세션 관리)
```

## 🎯 2-App 아키텍처

### Shop App (고객용 쇼핑몰)
- **포트**: 3000
- **역할**: 고객이 상품을 보고 구매하는 프론트엔드
- **핵심 기능**:
  - 상품 목록/상세 페이지 (옵션/변형 지원)
  - 장바구니 (회원/비회원 지원)
  - 토스페이먼츠 결제 (카드, 가상계좌, 계좌이체, 간편결제)
  - 주문 관리 및 주문 조회
  - 마이페이지 (주문내역, 배송조회, 1:1문의)
  - 회원 인증 (회원가입, 로그인, 소셜로그인)
  - 고객센터 (1:1문의, FAQ, 공지사항)
  - 비회원 주문 (주문번호+비밀번호로 조회)

### Sourcing App (관리자/워커)
- **포트**: 3001
- **역할**: 관리자가 상품을 수집하고 AI로 가공하는 백오피스
- **핵심 기능**:
  - **소싱 관리**
    - 채널 관리 (도매 밴드, 소매 밴드)
    - 상품 수집 (Playwright 자동화)
    - AI 상품 가공 (Gemini - 게시글 → 상세페이지)
    - 상품 발행 (소매 밴드로 자동 업로드)
    - 자동화 파이프라인 (수집 → 가공 → 발행)
    - 대시보드 (실시간 통계)
  - **쇼핑몰 관리**
    - 주문 관리 (주문확인, 배송처리, 취소/반품, 외부 주문)
    - 무통장입금 자동 취소 (입금 기한 초과 시 회원/비회원 주문 자동 취소)
    - 회원 관리
    - 정산 관리 (쇼핑몰별/기간별 정산, 토스페이먼츠 연동)
    - CS 관리 (1:1문의, 리뷰 관리)
    - 쿠폰 관리
    - 스토어 설정
    - 알림 관리
    - 방문자 통계

## 🚀 빠른 시작

### 1. 저장소 클론 및 의존성 설치
```bash
git clone https://github.com/ABC-Group-Tech/bandauto.git
cd bandauto

# 의존성 설치
npm install
```

### 2. 데이터베이스 설정

```bash
# db 패키지로 이동
cd db

# Prisma Client 생성
npx prisma generate --schema prisma

# 데이터베이스 스키마 동기화
npx prisma db push --schema prisma
```

### 3. 환경변수 설정

**db/.env**
```env
DATABASE_URL="mysql://user:password@localhost:3306/bandauto"  # MariaDB
```

**shop-app/.env.local**
```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
TOSS_PAYMENTS_CLIENT_KEY=""
TOSS_PAYMENTS_SECRET_KEY=""
```

**sourcing-app/.env**
```env
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-key"
GEMINI_API_KEY=""
```

### 4. 개발 서버 실행

**각 앱 개별 실행:**
```bash
# Shop 앱 (포트 3000)
npm run dev:shop

# Sourcing 앱 (포트 3001)
npm run dev:sourcing
```

**두 앱 동시 실행:**
```bash
npm run dev:all
```

## 📦 모듈 접근 제어

### 앱별 모듈 접근 규칙

1. **Shop App**
   - ✅ `modules/common/*` 접근 가능 (공통 모듈)
   - ✅ `src/modules/*` 접근 가능 (앱 전용 모듈)
   - ❌ `sourcing-app/src/modules/*` 접근 불가

2. **Sourcing App**
   - ✅ `modules/common/*` 접근 가능 (공통 모듈)
   - ✅ `src/modules/*` 접근 가능 (앱 전용 모듈)
   - ❌ `shop-app/src/modules/*` 접근 불가

3. **Common Modules**
   - 모든 앱에서 접근 가능
   - 공통 타입, 유틸리티, UI 컴포넌트

### Import 경로 예시

```typescript
// Shop App에서
import { Button } from '@common/ui-kit'                   // ✅ 공통 모듈
import { OrderService } from '@modules/order'             // ✅ 앱 전용 모듈
import { SourcingService } from '@modules/sourcing'       // ❌ ERROR (다른 앱)

// Sourcing App에서
import { Button } from '@common/ui-kit'                   // ✅ 공통 모듈
import { SourcingService } from '@modules/sourcing'       // ✅ 앱 전용 모듈
import { TransformService } from '@modules/transformation' // ✅ 앱 전용 모듈
import { OrderService } from '@modules/order'             // ❌ ERROR (다른 앱)
```

## 🛠️ 주요 명령어

### 개발
```bash
npm run dev:shop           # Shop 앱 실행 (포트 3000)
npm run dev:sourcing       # Sourcing 앱 실행 (포트 3001)
npm run dev:all            # 두 앱 동시 실행
```

### 빌드
```bash
npm run build:shop         # Shop 앱 빌드
npm run build:sourcing     # Sourcing 앱 빌드
npm run build:all          # 두 앱 모두 빌드
```

### 타입체크
```bash
npm run typecheck          # 전체 타입체크
npm run typecheck:shop     # Shop 앱만
npm run typecheck:sourcing # Sourcing 앱만
```

### 데이터베이스
```bash
cd db
npx prisma studio --schema prisma      # 데이터베이스 GUI
npx prisma db push --schema prisma     # 스키마 동기화
npx prisma generate --schema prisma    # 클라이언트 생성
```

### 테스트
```bash
npm test                   # E2E 테스트 (Playwright)
npm run test:ui            # 테스트 UI 모드
npm run test:headed        # 헤드 모드
```

## 🔧 기술 스택

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 14.2.3 | App Router 프레임워크 |
| TypeScript | 5.9.2 | 타입 안전성 |
| Tailwind CSS | 3.4.1 | 스타일링 |
| Zustand | 4.5.0 | 상태 관리 |
| React Hook Form | - | 폼 관리 |
| 토스페이먼츠 SDK | - | 결제 연동 |

### Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| Node.js | - | 런타임 |
| Prisma ORM | 6.2.1 | 데이터베이스 ORM |
| MariaDB | - | 데이터베이스 (개발/프로덕션) |
| Google Gemini | - | AI 상품 가공 |
| Playwright | 1.55.0 | 브라우저 자동화 |
| Bull | 4.16.5 | 작업 큐 |
| Redis | - | 캐시/큐 백엔드 |
| NextAuth.js | 4.24 | 인증 |

### 인프라
| 기술 | 용도 |
|------|------|
| AWS EC2 | 서버 호스팅 |
| PM2 | 프로세스 관리 |
| Jenkins | CI/CD |

## 🚀 구현된 API 엔드포인트

| 앱 | API 수 | 주요 기능 |
|----|--------|----------|
| **Shop App** | 53개 | 상품, 장바구니, 주문, 결제, 마이페이지, CS |
| **Sourcing App** | 95개 | 채널, 수집, 가공, 발행, 정산, 자동화 |

### Shop App 주요 API
- 🛒 Cart: 장바구니 CRUD
- 📦 Orders: 주문 생성/조회/관리
- 💳 Payments: 토스페이먼츠 결제/취소/웹훅
- 👤 Mypage: 주문내역, 배송조회, 1:1문의
- 🏠 Shop: 상품 목록/상세, 리뷰

### Sourcing App 주요 API
- 📡 Channel: 도매/소매 채널 관리
- 📥 Collect: 상품 수집 자동화
- 🤖 Transform: AI 상품 가공
- 📤 Publish: 쇼핑몰/채널 발행
- 💰 Settlement: 정산 관리 (토스페이먼츠 연동)
- 🔔 Notification: 알림 관리

**자세한 API 문서**: 각 앱의 `docs/API.md` 참조

## 📚 상세 문서

| 문서 | 설명 |
|------|------|
| [shop-app/docs/](./shop-app/docs/) | Shop App 문서 (API, DB, 배포) |
| [sourcing-app/docs/](./sourcing-app/docs/) | Sourcing App 문서 (API, DB, 배포) |
| [docs/project/](./docs/project/) | 프로젝트 전체 가이드 |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | AWS 배포 가이드 |

## 🗄️ 데이터베이스 스키마

### 현재 데이터베이스

- **개발/프로덕션**: MariaDB
- **ORM**: Prisma 6.2.1

### 데이터 모델 (총 47개)

**사용자 & 인증:**
- User, UserAddress, UserLoginLog, UserCoupon

**상품:**
- Product, ProductVariant, ProductOption, ProductImage

**주문 & 결제:**
- Order, OrderItem, Payment, RefundAccount
- GuestOrder, GuestOrderItem, GuestPayment

**쇼핑몰:**
- Shop, ShopTheme, ShopProduct, Cart, CartItem

**채널 & 소싱:**
- Channel, ChannelProduct
- CollectedPost, CollectedPostImage, CollectedPostComment, CollectedProduct

**CS & 반품:**
- Inquiry, InquiryReply, Review, ReturnRequest, GuestReturnRequest

**정산:**
- Settlement, SettlementItem

**자동화:**
- AutomationConfig, WorkflowLog, WorkflowStepLog
- SourcingApiConfig, AiApiConfig, AiPromptConfig, GoogleSheetConfig

**기타:**
- Coupon, Notification, Wishlist, ShippingAddress
- PricingPolicy, TermsPolicy, PrivacyPolicy

자세한 스키마는 `db/prisma/` 참조 (1,063 lines)

## 🔐 보안 및 환경변수

각 앱은 독립적인 `.env.local` 파일을 사용합니다:

**공통 환경변수:**
- `DATABASE_URL`: 데이터베이스 연결 문자열
  - `mysql://user:pass@host:3306/bandauto` (MariaDB)
- `NEXTAUTH_SECRET`: 세션 암호화 키
- `NEXTAUTH_URL`: 앱 URL

**Shop App 전용:**
- `TOSS_PAYMENTS_CLIENT_KEY`: 토스페이먼츠 클라이언트 키
- `TOSS_PAYMENTS_SECRET_KEY`: 토스페이먼츠 시크릿 키
- `TOSS_PAYMENTS_WEBHOOK_SECRET`: 웹훅 검증 시크릿

**Sourcing App 전용:**
- `GEMINI_API_KEY`: Google Gemini AI API 키
- `BAND_CLIENT_ID`: Band API 클라이언트 ID
- `BAND_CLIENT_SECRET`: Band API 클라이언트 시크릿

⚠️ **환경변수는 절대로 Git에 커밋하지 마세요.**

## 📊 개발 현황

### ✅ 완료된 기능

**아키텍처 & 인프라:**
- ✅ 2-App 모노레포 아키텍처 (Shop + Sourcing)
- ✅ 공유 DB 패키지 (@bandauto/db)
- ✅ TypeScript 경로 별칭 (`@/`, `@modules/*`)
- ✅ Turbopack 개발 서버
- ✅ 반응형 모바일 UI (전체 페이지)

**데이터베이스:**
- ✅ Prisma 스키마 (47개 모델, 1,063 lines)
- ✅ MariaDB 개발/프로덕션 환경
- ✅ 마이그레이션 히스토리 관리

**백엔드 API:**
- ✅ Shop App REST API (53개 엔드포인트)
- ✅ Sourcing App REST API (95개 엔드포인트)
- ✅ NextAuth.js 인증 (JWT)
- ✅ 토스페이먼츠 결제 연동 (카드, 가상계좌, 간편결제)

**프론트엔드:**
- ✅ 고객용 쇼핑몰 (Shop App) - 33 pages
- ✅ 관리자 백오피스 (Sourcing App) - 59 pages
- ✅ 모바일 최적화 UI

**자동화:**
- ✅ Playwright 상품 수집
- ✅ Gemini AI 상품 가공
- ✅ 워크플로우 파이프라인
- ✅ 밴드 발행 후 댓글로 쇼핑몰 링크 자동 작성
- ✅ 무통장입금 기한 초과 주문 자동 취소 (회원/비회원)

**정산:**
- ✅ 쇼핑몰별 정산 관리
- ✅ 토스페이먼츠 거래 내역 연동
- ✅ 정산 현황 대시보드

### 🚧 진행 중
- 🚧 프로덕션 성능 최적화
- 🚧 E2E 테스트 확장

## 🤝 기여 가이드

1. 각 앱은 독립적으로 개발
2. 공통 기능은 `modules/common/`에 추가
3. 앱 간 직접 모듈 참조 금지
4. 모든 문서는 `docs/`에 보관

## 🚀 AWS EC2 배포 가이드

### 서버 요구사항

| 항목 | 최소 사양 | 권장 사양 |
|------|-----------|-----------|
| 인스턴스 | t3.small | t3.medium |
| 메모리 | 2GB | 4GB |
| 디스크 | 10GB | 20GB |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### 배포 순서

```bash
# 1. 시스템 패키지 업데이트
sudo apt-get update && sudo apt-get upgrade -y

# 2. Node.js 설치 (v20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Playwright 시스템 의존성 설치
npx playwright install-deps chromium
npx playwright install chromium

# 4. 한글 폰트 설치
sudo apt-get install -y fonts-noto-cjk

# 5. PM2 설치 (프로세스 관리)
sudo npm install -g pm2

# 6. 프로젝트 클론
git clone https://github.com/ABC-Group-Tech/bandauto.git
cd bandauto

# 7. 의존성 설치
npm install

# 8. 환경변수 설정
cp sourcing-app/.env.example sourcing-app/.env.local
# .env.local 편집...

# 9. 데이터베이스 초기화
cd db && npx prisma generate --schema prisma && npx prisma db push --schema prisma

# 10. 빌드 및 실행
cd ../sourcing-app && npm run build
pm2 start ecosystem.config.js
```

### PM2 관리 명령어

```bash
pm2 status              # 상태 확인
pm2 logs                # 로그 확인
pm2 restart all         # 재시작
pm2 stop all            # 중지
pm2 save                # 현재 상태 저장
pm2 startup             # 서버 재부팅 시 자동 시작 설정
```

### Playwright 관련 설정

Playwright는 `headless: true`로 실행되므로 Xvfb 불필요.

**자동 정리:**
- 디버그 스크린샷: 3시간 후 자동 삭제
- 저장 경로: `/tmp/band-playwright-debug/`

### 환경변수 체크리스트

```env
# 필수
DATABASE_URL="mysql://user:password@localhost:3306/bandauto"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://your-domain:3001"

# Band 자동화
# (Chrome Extension으로 세션 등록)

# AI (선택)
GEMINI_API_KEY="your-gemini-key"
```

## 📄 라이센스

MIT License

---

**Made with ❤️ by BandAuto Team**
