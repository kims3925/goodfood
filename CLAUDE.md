# BandAuto - 밴드 자동화 + 토스페이먼츠 통합 쇼핑몰 시스템

## 📋 프로젝트 개요

BandAuto는 도매 밴드의 상품을 자동으로 수집하여 AI로 상세페이지를 제작하고, **토스페이먼츠를 연동한 자체 쇼핑몰**에서 직접 판매하는 통합 자동화 시스템입니다. 기존의 외부 결제 플랫폼 의존도를 줄이고 수익성을 극대화하는 것이 목표입니다.

### 🎯 핵심 기능

1. **도매 밴드 상품 수집**: 도매 밴드에서 상품 게시물 자동 크롤링
2. **AI 상세페이지 생성**: Gemini AI를 활용한 매력적인 상품 설명 자동 생성
3. **자체 쇼핑몰**: 토스페이먼츠 연동 자체 브랜딩 쇼핑몰
4. **통합 결제 시스템**: 카드, 계좌이체, 가상계좌, 간편결제 지원
5. **소매 밴드 자동 포스팅**: 여러 소매 밴드에 쇼핑몰 링크 게시
6. **주문 관리 자동화**: 자동 발주서 생성 및 알림 발송

## 🏗️ 기술 스택

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + Custom UI Components
- **State Management**: Zustand (장바구니 상태 관리)
- **Forms**: React Hook Form + Zod
- **Payment**: 토스페이먼츠 SDK (`@tosspayments/payment-sdk`, `@tosspayments/payment-widget-sdk`)
- **Authentication**: NextAuth.js v4 with Prisma Adapter
- **Testing**: Playwright E2E Testing

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: SQLite with Prisma ORM (20개 모델)
- **AI**: Google Gemini API (`@google/generative-ai`)
- **Payment**: 토스페이먼츠 API (결제, 취소, 환불)
- **Queue**: Bull Queue (주문 처리 작업)
- **Automation**: Playwright (도매 밴드 크롤링)
- **Security**: bcryptjs (암호화), crypto-js (데이터 보안)
- **File Processing**: ExcelJS, XLSX (엑셀 파일 처리)
- **Email**: Nodemailer (알림 시스템)
- **Caching**: Redis (세션 및 캐시 관리)

## 📚 상세 문서

이 프로젝트의 상세한 개발 가이드는 다음 문서들을 참조하세요:

- **🎨 [프론트엔드 개발 가이드](./docs/frontend/CLAUDE.md)**
  - UI/UX 디자인 시스템
  - 컴포넌트 구조 및 상태 관리
  - React Hook과 폼 관리
  - 반응형 디자인 가이드라인

- **⚙️ [백엔드 개발 가이드](./docs/backend/CLAUDE.md)**
  - API 구조 및 엔드포인트
  - 데이터베이스 스키마 상세
  - AI 서비스 (Gemini) 통합
  - 자동화 시스템 구현

## 📁 프로젝트 구조

```
bandauto/
├── app/                        # Next.js App Router
│   ├── (auth)/                # 인증 관련 페이지
│   │   ├── login/             # 로그인 페이지
│   │   └── register/          # 회원가입 페이지
│   ├── (admin)/               # 관리자 대시보드
│   │   ├── admin/             # 시스템 관리
│   │   │   ├── wholesale/     # 도매 밴드 관리
│   │   │   ├── products/      # 상품 관리
│   │   │   ├── shop/          # 쇼핑몰 관리
│   │   │   └── settings/      # 시스템 설정
│   │   ├── automation/        # 자동화 시스템
│   │   ├── retail/            # 소매 밴드 관리
│   │   └── shop/              # 쇼핑몰 관리
│   ├── store/                 # 고객용 쇼핑몰
│   ├── dashboard/             # 사용자 대시보드
│   └── api/                   # API Routes (백엔드)
│       ├── auth/              # 인증 API
│       ├── wholesale/         # 도매 관리 API
│       ├── retail/            # 소매 관리 API
│       ├── shop/              # 쇼핑몰 API
│       ├── products/          # 상품 관리 API
│       └── settings/          # 설정 API
├── components/                # React 컴포넌트
│   ├── auth/                  # 인증 컴포넌트
│   ├── layout/                # 레이아웃 컴포넌트
│   └── ui/                    # UI 컴포넌트
├── lib/                       # 라이브러리 & 유틸리티
│   ├── gemini-ai.ts          # AI 분석 서비스 (873라인)
│   ├── api/band-client.ts    # Band API 클라이언트
│   ├── payments/             # 결제 서비스
│   │   ├── toss-payments.ts  # 토스페이먼츠 서비스
│   │   └── webhook-handler.ts # 웹훅 핸들러
│   ├── shop/cart-service.ts  # 장바구니 서비스
│   ├── auth.ts               # NextAuth 설정
│   └── db.ts                 # Prisma 클라이언트
├── docs/                      # 📚 개발 문서
│   ├── frontend/              # 프론트엔드 가이드
│   └── backend/               # 백엔드 가이드
├── prisma/                    # 데이터베이스
│   └── schema.prisma         # 20개 모델 정의
├── types/                     # TypeScript 타입 정의
├── hooks/                     # Custom React Hooks
└── tests/                     # Playwright 테스트
```

## ⚙️ 개발 환경 설정

### 필수 환경 변수
```env
# 데이터베이스
DATABASE_URL="file:./dev.db"

# 인증
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# AI 서비스
GEMINI_API_KEY="your-gemini-api-key"

# Band API
BAND_CLIENT_ID="your-band-client-id"
BAND_CLIENT_SECRET="your-band-client-secret"

# 토스페이먼츠 (⚠️ 현재 미설정)
TOSS_PAYMENTS_CLIENT_KEY="test_ck_..."
TOSS_PAYMENTS_SECRET_KEY="test_sk_..."
TOSS_PAYMENTS_WEBHOOK_SECRET="..."

# 결제 설정
PAYMENT_SUCCESS_URL="http://localhost:3000/payment/success"
PAYMENT_FAIL_URL="http://localhost:3000/payment/fail"

# 쇼핑몰 설정
FREE_SHIPPING_AMOUNT="30000"  # 무료배송 기준
DEFAULT_SHIPPING_FEE="3000"   # 기본 배송비
SHOP_ADMIN_EMAIL="admin@example.com"
```

> 전체 환경 변수 목록은 [백엔드 가이드](./docs/backend/CLAUDE.md)에서 확인하세요.

## 🚀 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 데이터베이스 초기화
npx prisma generate
npx prisma db push

# 3. 개발 서버 실행 
npm run dev

# 4. 브라우저에서 접속
# http://localhost:3000
```

## 🔧 주요 명령어

```bash
# 개발
npm run dev              # 개발 서버 시작 (포트 자동 정리)
npm run build            # 프로덕션 빌드
npm run lint             # 코드 린트 검사
npm test                 # E2E 테스트 (Playwright)

# 데이터베이스  
npx prisma studio        # 데이터베이스 관리 UI
npx prisma db push       # 스키마 동기화
npm run seed             # 테스트 데이터 생성
```

## 📊 구현 현황 (85% 완료)

### ✅ 완료된 기능
- **기본 시스템**: Next.js 14, Prisma ORM, NextAuth.js 인증 (100%)
- **도매 밴드 관리**: 등록, 수집, 모니터링, 6개 밴드 가격정책 (100%)
- **AI 상품 분석**: Gemini AI 통합, 5단계 분류, 정책 기반 분석 (100%)
- **상품 수집 관리**: 3뷰모드, 필터링, 소싱 확정, 일괄 처리 (100%)
- **데이터베이스**: 20개 모델 완전 구현 (100%)
- **결제 서비스 라이브러리**: 토스페이먼츠 클래스, 웹훅 핸들러 (100%)
- **장바구니 서비스**: 세션 기반, 비회원 지원, 사용자 마이그레이션 (100%)
- **관리자 대시보드**: 쇼핑몰 관리, 상품 관리, 주문 관리 (95%)
- **소매밴드 시스템**: 밴드 등록, 설정 관리, 포스팅 자동화 (90%)
- **고객용 쇼핑몰**: 기본 구조, 상품 목록, 레이아웃 (80%)

### 🚧 현재 진행 중
- **토스페이먼츠 API 연동**: 백엔드 로직 완성, API 엔드포인트 구현 필요
- **고객용 쇼핑몰**: 상품 상세 페이지, 주문 프로세스 구현 중
- **자동화 시스템**: 소매밴드 자동 포스팅 기능 구현 중

### ❌ 구현 필요 (우선순위별)
#### Phase 1 (최고 우선순위)
- **토스페이먼츠 API 엔드포인트**: `/api/payments/*`, `/api/cart/*`, `/api/orders/*`
- **결제 위젯 컴포넌트**: React 컴포넌트 구현
- **환경변수 설정**: 토스페이먼츠 API 키 설정

#### Phase 2 (중간 우선순위)
- **고객용 쇼핑몰**: 상품 상세, 장바구니, 주문서 페이지
- **웹훅 처리**: 실시간 결제 상태 업데이트
- **주문 관리 시스템**: 관리자 주문 처리 대시보드

#### Phase 3 (낮은 우선순위)
- **알림 시스템**: 이메일/SMS 연동
- **소매밴드 자동화**: 완전 자동 포스팅 시스템
- **성능 최적화**: Redis 캐싱, 이미지 CDN 연동

## 🔄 자동화 워크플로우

### 상품 등록 플로우
```
도매 밴드 게시물 수집 → AI 상품 분석 → 소싱 확정
                ↓
자체 쇼핑몰 상품 등록 → SEO 최적화 적용
                ↓
소매 밴드 자동 포스팅 (쇼핑몰 링크 포함)
```

### 주문 및 결제 플로우
```
고객 쇼핑몰 방문 → 상품 선택 → 장바구니 담기
                ↓
주문서 작성 → 토스페이먼츠 결제 → 결제 승인
                ↓
주문 확정 → 도매업체 자동 발주 → 배송 처리
                ↓
실시간 알림 (고객/관리자) → 배송 추적
```

## 🗄️ 데이터베이스

현재 **20개 모델**이 구현되어 있습니다:

### 기본 시스템
- **User**: 사용자 정보 및 Band API 연동 (32 fields)
- **Product**: 소싱 확정된 상품 정보 (29 fields)
- **Customer**: 고객 정보 관리 (8 fields)
- **Order**: 주문 정보 및 배송 관리 (17 fields)
- **SourcingSite**: 소싱 사이트 정보 (15 fields)

### 도매 관리
- **WholesaleBand**: 도매 밴드 정보 (가격정책 포함) (10 fields)
- **CollectedPost**: 수집된 게시물 + AI 분석 결과 (26 fields)

### 토스페이먼츠 결제 시스템
- **PaymentMethod**: 결제 수단 관리 (6 fields)
- **Payment**: 결제 정보 및 상태 관리 (13 fields)
- **Refund**: 환불 처리 관리 (9 fields)

### 쇼핑몰 시스템
- **Shop**: 쇼핑몰 정보 (사용자별 1개) (8 fields)
- **ShopProduct**: 쇼핑몰 등록 상품 (21 fields)
- **Cart**: 장바구니 (세션/사용자 기반) (6 fields)
- **CartItem**: 장바구니 아이템 (7 fields)
- **ProductPage**: SEO 최적화 상품 페이지 (12 fields)
- **ShopSettings**: 쇼핑몰 설정 (17 fields)
- **DeliveryTracker**: 배송 추적 시스템 (9 fields)

### 소매밴드 관리 시스템
- **RetailBand**: 소매밴드 정보 관리 (8 fields)
- **RetailSettings**: 소매밴드 포스팅 설정 (13 fields)
- **RetailPost**: 소매밴드 게시물 관리 (16 fields)

> Prisma 스키마: `prisma/schema.prisma` (459 lines)

## 🤖 AI 시스템 (Gemini)

**핵심 특징:**
- **20자 고정 제목 생성** (가격/수량 제외)
- **5단계 자동 분류** (수산/축산/농산/가공품/기타)
- **배치 병렬 처리** (6개 배치 × 5개 동시 = 30개 상품)
- **가격정책 자동 적용** (밴드별 맞춤 마진)

**파일 위치:** `lib/gemini-ai.ts` (873라인)

## 💰 도매밴드별 가격정책 시스템

현재 시스템에는 **6개의 도매밴드**가 등록되어 있으며, 각각 고유한 가격정책을 가지고 있습니다.

### 🔑 용어 정의

1. **원가**: 상세페이지에 있는 가격 (공급가 또는 판매가, 고객노출 금지)
2. **공급가**: 우리에게 도매밴드에서 주는 가격 (판매가-공급가=수익, 고객노출 금지)
3. **판매가**: 가격정책이 적용된 고객에게 노출되는 가격

---

## 1️⃣ 가족도매방

### 📋 정책 개요
- **유형**: 원가 그대로 판매
- **공급가 책정**: 원가의 90%
- **특징**: 가장 단순한 정책

### 💰 가격 적용 로직

#### 코드 식별자
```javascript
if (policyText.includes('원가 그대로')) {
  return parsedPrice  // 원가 그대로 반환
}
```

#### 계산 방식
```
판매가 = 원가 인 경우에 공급가 계산은 원가의 90%로 함
공급가 = 원가 × 90%
```

#### 구간별 마진 (39,900원 이상에만 적용)
- **39,900원 이하**: +0원
- **40,000~49,900원**: +2,000원
- **50,000~59,900원**: +4,000원
- **60,001~70,000원**: +6,000원
- **70,001~80,000원**: +7,000원
- **80,001~90,000원**: +8,000원
- **90,001~100,000원**: +9,000원
- **100,001~150,000원**: +12,000원
- **150,001~200,000원**: +20,000원

#### 예시
```
원가: 45,000원
→ 판매가: 47,000원 (+2,000원)
→ 공급가: 40,500원 (45,000원의 90%)
```

---

## 2️⃣ 요한이네♧소매방

### 📋 정책 개요
- **유형**: 수집가격 기준 구간별 마진 적용
- **공급가 책정**: 원가의 90%
- **특징**: 가격 구간에 따른 차등 마진

### 💰 가격 적용 로직
**초록이네와 완전히 동일한 로직 적용**

#### 코드 식별자
```javascript
if (policyText.includes('수집가격 기준 구간별 마진 적용') ||
    policyText.includes('수집된 게시물 가격 기준으로')) {
  // 구간별 마진 적용
}
```

#### 구간별 마진표
- **19,900원 이하**: +1,000원
- **20,000~29,900원**: +2,000원
- **30,000~39,900원**: +3,000원
- **40,000~49,900원**: +4,000원
- **50,000~59,900원**: +5,000원
- **60,001원 이상**: +6,000원
- **70,001원 이상**: +7,000원
- **80,001원 이상**: +8,000원
- **90,001원 이상**: +9,000원
- **100,001~150,000원**: +12,000원
- **150,001~200,000원**: +20,000원

#### 계산 방식
```
판매가 = 원가 + 구간별 마진
공급가 = 원가 × 90%
```

#### 예시
```
원가: 15,000원
→ 판매가: 16,000원 (+1,000원, 19,900원 이하 구간)
→ 공급가: 13,500원 (15,000원의 90%)
```

---

## 3️⃣ 초록이네

### 📋 정책 개요
- **유형**: 수집가격 기준 구간별 마진 적용
- **공급가 책정**: 원가의 90%
- **특징**: 요한이네♧소매방과 동일한 정책

### 💰 가격 적용 로직
**요한이네♧소매방과 완전히 동일한 로직 적용**

#### 구간별 마진표
- **19,900원 이하**: +1,000원
- **20,000~29,900원**: +2,000원
- **30,000~39,900원**: +3,000원
- **40,000~49,900원**: +4,000원
- **50,000~59,900원**: +5,000원
- **60,001원 이상**: +6,000원
- **70,001원 이상**: +7,000원
- **80,001원 이상**: +8,000원
- **90,001원 이상**: +9,000원
- **100,001~150,000원**: +12,000원
- **150,001~200,000원**: +20,000원

#### 예시
```
원가: 25,000원
→ 판매가: 27,000원 (+2,000원, 20,000~29,900원 구간)
→ 공급가: 22,500원 (25,000원의 90%)
```

---

## 4️⃣ 나은 상품 공급방

### 📋 정책 개요
- **유형**: 공급가 기준 마진 적용, 배송비 별도
- **특징**: 공급가와 배송비를 분리하여 처리
- **배송비**: 별도 표시 (무료배송 또는 배송비 명시)

### 💰 가격 적용 로직

#### 코드 식별자
```javascript
if (policyText.includes('공급가와 배송비를 분리, 공급가에만 마진 적용')) {
  // 공급가 기준 마진 계산
}
```

#### 마진 계산 방식
- **기본 마진**: 4,000원
- **19,900원 초과 시**: 1만원 구간마다 +1,000원 추가

#### 계산 공식
```
공급가 19,900원까지: 공급가 + 4,000원
공급가 19,900원 초과: 공급가 + 4,000원 + (초과구간별 1,000원)
```

#### 초과 구간 계산
```javascript
if (parsedPrice <= 19900) {
  result = parsedPrice + 4000
} else {
  const excess = parsedPrice - 19900
  const additionalSections = Math.ceil(excess / 10000)
  const additionalMargin = additionalSections * 1000
  totalMargin = 4000 + additionalMargin
  result = parsedPrice + totalMargin
}
```

#### 예시 1: 기본 마진 적용
```
공급가: 15,000원
→ 판매가: 19,000원 (+4,000원)
→ 배송비: 3,000원 별도 명기
→ 최종 표시: "19,000원 (배송비 3,000원)"
```

#### 예시 2: 초과 구간 적용
```
공급가: 25,000원
→ 초과금액: 5,100원 (25,000 - 19,900)
→ 초과구간: 1구간 (5,100원 ÷ 10,000원 = 0.51 → 올림 1)
→ 총 마진: 4,000원 + 1,000원 = 5,000원
→ 판매가: 30,000원 (25,000 + 5,000)
→ 배송비: 무료배송
→ 최종 표시: "30,000원 (무료배송)"
```

---

## 5️⃣ S D 푸드

### 📋 정책 개요
- **유형**: 공급가 기준 마진 적용, 배송비 별도
- **특징**: 나은 상품 공급방과 동일한 정책
- **추가 특징**: 주로 댓글에 배송비 정보 포함

### 💰 가격 적용 로직
**나은 상품 공급방과 완전히 동일한 로직 적용**

#### 차이점
- 댓글에서 배송비 정보를 우선 검색
- 댓글 포함 가격 검색 기능 활용

#### 예시
```
공급가: 18,000원 (댓글에서 확인)
→ 판매가: 22,000원 (+4,000원)
→ 배송비: 3,000원 (댓글에서 확인)
→ 최종 표시: "22,000원 (배송비 3,000원)"
```

---

## 6️⃣ 폐쇄몰VIP도매

### 📋 정책 개요
- **유형**: 공급가 기준 마진 적용, 배송비 별도
- **특징**: 나은 상품 공급방과 동일한 정책

### 💰 가격 적용 로직
**나은 상품 공급방과 완전히 동일한 로직 적용**

#### 계산 방식
```
공급가 19,900원까지: +4,000원
공급가 19,900원 초과: +4,000원 + 초과구간별(1만원마다) +1,000원
```

#### 예시
```
공급가: 35,000원
→ 초과금액: 15,100원 (35,000 - 19,900)
→ 초과구간: 2구간 (15,100원 ÷ 10,000원 = 1.51 → 올림 2)
→ 총 마진: 4,000원 + 2,000원 = 6,000원
→ 판매가: 41,000원 (35,000 + 6,000)
```

---

## 🔧 시스템 구현 세부사항

### 가격 파싱 함수
```javascript
const parsePrice = (priceStr) => {
  if (!priceStr) return 0
  if (typeof priceStr === 'number' && !isNaN(priceStr) && priceStr > 0)
    return Math.floor(priceStr)

  let cleanStr = String(priceStr)

  // 1. "5,500원" 형태 파싱
  const priceMatch = cleanStr.match(/([0-9,]+)원/)
  if (priceMatch) {
    const priceOnly = priceMatch[1].replace(/,/g, '')
    const parsed = parseInt(priceOnly)
    return !isNaN(parsed) && parsed > 0 ? parsed : 0
  }

  // 2. "15000" 또는 "15,000" 형태 파싱
  const numberMatch = cleanStr.match(/^[0-9,]+/)
  if (numberMatch) {
    const cleanPrice = numberMatch[0].replace(/,/g, '')
    const parsed = parseInt(cleanPrice)
    return !isNaN(parsed) && parsed > 0 ? parsed : 0
  }

  // 3. 문자열에서 숫자만 추출
  const allNumbers = cleanStr.replace(/[^0-9]/g, '')
  if (allNumbers) {
    const limitedNumbers = allNumbers.substring(0, 6)
    const parsed = parseInt(limitedNumbers)
    return !isNaN(parsed) && parsed > 0 ? parsed : 0
  }

  return 0
}
```

### 정책 매칭 우선순위
1. **가족도매방**: `'원가 그대로'` 키워드 검색
2. **요한이네/초록이네**: `'수집가격 기준 구간별 마진 적용'` 키워드 검색
3. **나은/S D 푸드/폐쇄몰**: `'공급가와 배송비를 분리, 공급가에만 마진 적용'` 키워드 검색
4. **기본값**: 정책 매칭 실패 시 원가 그대로 반환

### 실시간 가격 계산
- **백엔드**: `app/api/wholesale/posts/confirm/route.ts` (lines 63-134)
- **프론트엔드**: `app/(admin)/admin/wholesale/collect/page.tsx` (lines 334-441)
- 프론트엔드에서 실시간으로 가격정책 적용
- 데이터베이스 값과 실시간 계산 값 비교 검증
- 캐싱 없이 매번 최신 정책 적용

## 📞 문의 및 지원

프로젝트 관련 문의사항이나 버그 리포트는 GitHub Issues를 통해 제출해 주세요.

**중요:** 완료된 기능들(✅)은 절대로 삭제하거나 무효화하지 마세요. 이들은 시스템의 핵심 기능입니다.

## 📄 라이센스

MIT License

---

## 🚨 기술적 이슈 및 구현 로드맵

### 현재 문제점 및 해결 방안

#### 1번 그룹: 토스페이먼츠 연동 이슈

**현재 상황:**
- ✅ 토스페이먼츠 SDK 설치됨
- ✅ 결제 서비스 라이브러리 구현됨 (`lib/payments/toss-payments.ts`)
- ✅ 웹훅 핸들러 구현됨 (`lib/payments/webhook-handler.ts`)
- ❌ API 엔드포인트 없음
- ❌ 환경변수 미설정

**구현 필요:**
```bash
# API 엔드포인트 구현 (4개)
app/api/payments/confirm/route.ts        # 결제 승인
app/api/payments/cancel/route.ts         # 결제 취소
app/api/payments/webhook/route.ts        # 웹훅 수신
app/api/payments/status/[paymentKey]/route.ts  # 결제 상태 조회
```

#### 2번 그룹: 쇼핑몰 프론트엔드 이슈

**현재 상황:**
- ✅ 장바구니 서비스 완전 구현됨
- ✅ 관리자 쇼핑몰 페이지 있음
- ❌ 고객용 쇼핑몰 페이지 없음
- ❌ 장바구니 API 없음
- ❌ 결제 위젯 컴포넌트 없음

**구현 필요:**
```bash
# 고객용 쇼핑몰 페이지
app/(shop)/layout.tsx                    # 쇼핑몰 전용 레이아웃
app/(shop)/products/[slug]/page.tsx      # 상품 상세 페이지
app/(shop)/cart/page.tsx                 # 장바구니 페이지
app/(shop)/checkout/page.tsx             # 주문서 작성 페이지
app/(shop)/order/success/page.tsx        # 결제 성공 페이지
app/(shop)/order/fail/page.tsx           # 결제 실패 페이지

# API 엔드포인트
app/api/cart/route.ts                    # 장바구니 CRUD
app/api/orders/route.ts                  # 주문 생성/조회

# React 컴포넌트
components/shop/ProductCard.tsx          # 상품 카드
components/shop/CartDrawer.tsx           # 장바구니 사이드바
components/payments/TossPaymentWidget.tsx # 결제 위젯
components/shop/CheckoutForm.tsx         # 주문서 폼
```

### 구현 우선순위 로드맵

#### Phase 1 (최고 우선순위 - 1주)
1. **토스페이먼츠 API 엔드포인트 구현**
2. **환경변수 설정**
3. **장바구니 API 엔드포인트 구현**
4. **주문 API 엔드포인트 구현**

#### Phase 2 (중간 우선순위 - 1주)
1. **결제 위젯 React 컴포넌트**
2. **고객용 쇼핑몰 페이지 기본 구조**
3. **상품 상세 페이지**
4. **장바구니 페이지**

#### Phase 3 (낮은 우선순위 - 1주)
1. **주문서 작성 페이지**
2. **결제 성공/실패 페이지**
3. **웹훅 처리 시스템 테스트**
4. **주문 관리 대시보드**

#### Phase 4 (추가 기능 - 1주)
1. **레거시 코드 정리** (스룩페이 관련)
2. **SEO 최적화**
3. **모바일 반응형 최적화**
4. **성능 최적화**

---

## 🧑‍💻 개발자 가이드

### 즉시 구현 가능한 작업들

1. **토스페이먼츠 API 엔드포인트**
   ```typescript
   // app/api/payments/confirm/route.ts
   import { getTossPaymentsService } from '@/lib/payments/toss-payments'

   export async function POST(req: Request) {
     const service = getTossPaymentsService()
     const { paymentKey, orderId, amount } = await req.json()
     return await service.confirmPayment({ paymentKey, orderId, amount })
   }
   ```

2. **장바구니 API**
   ```typescript
   // app/api/cart/route.ts
   import { getCartService } from '@/lib/shop/cart-service'

   export async function POST(req: Request) {
     const cartService = getCartService()
     const { sessionId, productId, quantity, userId } = await req.json()
     return await cartService.addToCart(sessionId, productId, quantity, userId)
   }
   ```

### 기존 코드 활용 방법

현재 구현된 코드들은 대부분 완전하므로, API 엔드포인트만 연결하면 바로 사용 가능합니다:

1. **`lib/payments/toss-payments.ts`**: 바로 사용 가능 ✅
2. **`lib/payments/webhook-handler.ts`**: 바로 사용 가능 ✅
3. **`lib/shop/cart-service.ts`**: 바로 사용 가능 ✅
4. **Prisma 스키마**: 모든 필요한 모델 완성 ✅

### 필수 TODO 체크리스트

**환경 설정:**
- [ ] 토스페이먼츠 개발자 계정 생성
- [ ] 테스트 API 키 발급
- [ ] `.env.local`에 토스페이먼츠 API 키 설정
- [ ] HTTPS 설정 (localhost에서도 필요)
- [ ] 웹훅 URL 등록 (토스페이먼츠 콘솔)

**API 엔드포인트:**
- [ ] `/api/payments/confirm` 결제 승인 구현
- [ ] `/api/payments/webhook` 웹훅 수신 구현
- [ ] `/api/cart` 장바구니 CRUD 구현
- [ ] `/api/orders` 주문 생성/조회 구현

**프론트엔드:**
- [ ] 결제 위젯 React 컴포넌트
- [ ] 고객용 상품 상세 페이지
- [ ] 장바구니 페이지
- [ ] 주문서 작성 페이지

### 레거시 코드 정리 계획

**삭제 후보 (신중히 검토 후):**
- `app/(admin)/strokepay/` - 스룩페이 관리 페이지들
- `app/api/strokepay/` - 스룩페이 API 엔드포인트들
- `app/api/automation/strokepay/` - 스룩페이 자동화
- `lib/strokepay-automation.ts` - 스룩페이 서비스

---

## 💡 추후 구현 권장사항

### 고급 기능
- **쿠폰/할인 시스템**: 마케팅 기능 강화
- **적립금 시스템**: 고객 재방문 유도
- **리뷰/평점 시스템**: 신뢰도 향상
- **위시리스트**: 구매 전환율 향상
- **재입고 알림**: 고객 만족도 향상

### 운영 도구
- **매출 분석 대시보드**: 비즈니스 인사이트
- **재고 관리 시스템**: 효율적 운영
- **고객 관리 시스템**: 개인화 마케팅
- **배송 추적 자동화**: 고객 서비스 향상

### 기술적 개선
- **CDN 연동**: 이미지 로딩 속도 향상
- **Redis 캐싱**: 성능 최적화
- **검색 엔진 최적화**: 트래픽 증대
- **PWA 구현**: 모바일 사용성 향상