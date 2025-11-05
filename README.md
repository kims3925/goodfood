# BandAuto v1.2 - 글로벌 도매 자동화 판매 시스템

> 🌍 Band + AliExpress 통합 소싱부터 AI 상세페이지 제작, 자체 쇼핑몰 판매까지 완전 자동화

도매 밴드와 글로벌 마켓플레이스(AliExpress)의 상품을 자동으로 수집하여 AI로 상세페이지를 제작하고, 토스페이먼츠를 통합한 자체 쇼핑몰에서 직접 판매하는 통합 자동화 시스템입니다.

---

## ✨ v1.2 주요 업데이트

### 🌍 **AliExpress API 통합**
- AliExpress Open Platform API 연동 (MD5 서명 인증)
- 실시간 USD → KRW 환율 계산 (1시간 캐싱)
- 가격정책 자동 적용 (환율, 배송비, 관세, 마진)
- 모의 데이터 모드 (API 키 없이도 테스트 가능)

### 🔄 **5단계 중복 제거 시스템**
- productId 기반 DB 중복 체크
- 제목 유사도 필터링 (Jaccard 80%)
- 이미지 기반 중복 체크
- DB 키워드 유사도 검색
- 현재 배치 내 유사도 체크

### ⚙️ **통합 API 설정 시스템**
- 탭 기반 멀티 API 관리 (Band, AliExpress)
- 각 API별 설정 가이드 및 발급 링크 버튼
- 연결 테스트 기능
- 향후 확장 준비 (Taobao, Coupang, 1688.com)

---

## 🚀 빠른 시작

### 필수 요구사항

- Node.js 18.0 이상
- npm 또는 yarn
- SQLite (개발용) / PostgreSQL (프로덕션 권장)

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 필요한 API 키 입력

# 3. 데이터베이스 초기화
npx prisma generate
npx prisma db push

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속

---

## 🛠 주요 기능

### 1️⃣ **다중 소싱 시스템**
- 🏪 **Band 도매**: 6개 도매밴드 가격정책 지원
- 🌍 **AliExpress**: 글로벌 상품 소싱 (USD → KRW 자동 환산)
- 🔜 **Taobao / 1688**: 중국 직구 (향후 지원)
- 🔜 **Coupang**: 국내 파트너스 (향후 지원)

### 2️⃣ **AI 상품 분석** (Gemini AI)
- 20자 고정 제목 자동 생성
- 5단계 자동 분류 (수산/축산/농산/가공품/기타)
- 가격정책 자동 적용
- 배치 병렬 처리 (초고속 분석)

### 3️⃣ **자체 쇼핑몰**
- 토스페이먼츠 통합 결제 시스템
- 장바구니 및 주문 관리
- 회원/비회원 모두 지원
- SEO 최적화 상품 페이지

### 4️⃣ **소매밴드 자동 포스팅**
- 여러 소매 밴드에 동시 게시
- 쇼핑몰 링크 자동 포함
- 포스팅 이력 관리

### 5️⃣ **주문 자동화**
- 자동 발주서 생성
- 도매업체 자동 발주
- 실시간 알림 시스템

---

## 📊 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    관리자 대시보드                       │
├─────────────────────────────────────────────────────────┤
│  도매 소싱           AI 분석          자체 쇼핑몰         │
│  ├─ Band 6개밴드    ├─ Gemini AI     ├─ 상품 등록       │
│  └─ AliExpress      └─ 5단계 분류    └─ 토스페이먼츠    │
├─────────────────────────────────────────────────────────┤
│                    자동화 엔진                           │
│  ├─ 5단계 중복 제거                                     │
│  ├─ 가격정책 자동 적용                                  │
│  ├─ 환율 계산 (1시간 캐싱)                              │
│  └─ 소매밴드 자동 포스팅                                │
├─────────────────────────────────────────────────────────┤
│              데이터베이스 (Prisma ORM)                   │
│  ├─ 20개 모델 (User, Product, Order, Payment...)       │
│  ├─ Band: WholesaleBand, CollectedPost                 │
│  └─ AliExpress: AliExpressSourcing, AliExpressProduct   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 개발 명령어

```bash
# 개발 서버 실행 (포트 자동 정리)
npm run dev

# 프로덕션 빌드
npm run build
npm run start

# 린트 검사
npm run lint

# Prisma 데이터베이스
npx prisma studio        # 데이터베이스 관리 UI
npx prisma db push       # 스키마 동기화
npx prisma generate      # 클라이언트 생성

# 테스트 (Playwright E2E)
npm test
```

---

## 📁 프로젝트 구조

```
bandauto/
├── app/                        # Next.js 14 App Router
│   ├── (admin)/               # 관리자 대시보드
│   │   ├── admin/
│   │   │   ├── wholesale/     # Band 도매 관리
│   │   │   ├── aliexpress/    # AliExpress 소싱 (NEW)
│   │   │   ├── products/      # 상품 관리
│   │   │   └── settings/      # 설정
│   │   │       └── api/       # 통합 API 설정 (NEW)
│   │   └── automation/        # 자동화 시스템
│   ├── store/                 # 고객용 쇼핑몰
│   └── api/                   # API Routes
│       ├── wholesale/         # Band API
│       ├── aliexpress/        # AliExpress API (NEW)
│       ├── payments/          # 결제 API
│       └── settings/          # 설정 API
│
├── components/                # React 컴포넌트
│   ├── layout/               # 레이아웃 (Header, Sidebar)
│   ├── auth/                 # 인증
│   └── ui/                   # UI 컴포넌트
│
├── lib/                       # 라이브러리 & 유틸리티
│   ├── gemini-ai.ts          # AI 분석 (873 lines)
│   ├── ali-express-api.ts    # AliExpress API (NEW)
│   ├── utils/
│   │   └── currency.ts       # 환율 계산 (NEW)
│   ├── payments/             # 토스페이먼츠
│   └── config-storage.ts     # 설정 관리
│
├── prisma/                    # 데이터베이스
│   └── schema.prisma         # 20개 모델
│
├── types/                     # TypeScript 타입
├── hooks/                     # Custom React Hooks
└── docs/                      # 개발 문서
```

---

## 🌐 API 설정 가이드

### 1️⃣ **Band API 설정**
1. [Band Developers](https://developers.band.us) 접속
2. 앱 생성 → Client ID, Secret 발급
3. OAuth 인증 → Access Token 획득
4. `/admin/settings/api` 에서 설정 저장

### 2️⃣ **AliExpress API 설정**
1. [AliExpress Open Platform](https://portals.aliexpress.com) 가입
2. App Key, App Secret 발급
3. `/admin/settings/api` 에서 설정 저장
4. ⚠️ API 키 없이도 모의 데이터 모드로 테스트 가능

### 3️⃣ **Gemini AI 설정**
1. [Google AI Studio](https://aistudio.google.com/apikey) 접속
2. API 키 발급 (무료)
3. `/admin/settings/ai` 에서 설정 저장

---

## 💰 가격정책 시스템

### **Band 도매 (6개 밴드)**
1. **가족도매방**: 원가 그대로 (공급가 90%)
2. **요한이네♧소매방**: 구간별 마진 (+1,000원 ~ +20,000원)
3. **초록이네**: 구간별 마진 (요한이네와 동일)
4. **나은 상품 공급방**: 공급가 기준 (+4,000원 + 초과구간)
5. **S D 푸드**: 공급가 기준 (나은과 동일)
6. **폐쇄몰VIP도매**: 공급가 기준 (나은과 동일)

### **AliExpress**
- USD → KRW 실시간 환율 적용
- 배송비, 관세, 마진 정책 자동 계산
- 100원 단위 반올림

---

## 📊 데이터베이스 스키마 (20개 모델)

### **기본 시스템**
- User, Customer, Product, Order, SourcingSite

### **도매 관리**
- WholesaleBand, CollectedPost
- AliExpressSourcing, AliExpressProduct (NEW)

### **결제 시스템**
- Payment, PaymentMethod, Refund

### **쇼핑몰**
- Shop, ShopProduct, ShopSettings
- Cart, CartItem
- ProductPage, DeliveryTracker

### **소매밴드**
- RetailBand, RetailSettings, RetailPost

---

## 🔐 환경 변수

```env
# 데이터베이스
DATABASE_URL="postgresql://..."
REDIS_URL="redis://localhost:6379"

# 인증
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Band API (필수)
BAND_ACCESS_TOKEN="your-band-token"
BAND_CLIENT_ID="your-client-id"
BAND_CLIENT_SECRET="your-client-secret"

# AliExpress API (선택사항)
ALIEXPRESS_API_KEY="your-app-key"
ALIEXPRESS_APP_SECRET="your-app-secret"

# AI (필수)
GOOGLE_AI_API_KEY="your-gemini-key"

# 토스페이먼츠 (필수)
TOSS_PAYMENTS_CLIENT_KEY="test_ck_..."
TOSS_PAYMENTS_SECRET_KEY="test_sk_..."

# 환율 API
EXCHANGE_RATE_API_URL="https://api.exchangerate-api.com/v4/latest/USD"
```

---

## 📈 성능 최적화

- ✅ **병렬 배치 처리**: AI 분석 3개씩 동시 처리
- ✅ **환율 캐싱**: 1시간 캐싱으로 API 호출 최소화
- ✅ **5단계 중복 제거**: 불필요한 상품 수집 방지
- ✅ **Prisma UPSERT**: 트랜잭션 안전성 보장
- ✅ **Redis 세션**: 고속 세션 관리

---

## 🚧 개발 로드맵

### ✅ **v1.0** (완료)
- Band 도매 수집 시스템
- Gemini AI 분석
- 기본 관리자 대시보드

### ✅ **v1.1** (완료)
- AI 설정 시스템 재구축
- 5단계 중복 제거
- 가격정책 자동 적용

### ✅ **v1.2** (현재)
- AliExpress API 통합
- 통합 API 설정 시스템
- 환율 계산 유틸리티

### 🔜 **v1.3** (계획)
- 토스페이먼츠 API 완전 구현
- 고객용 쇼핑몰 UI 완성
- 주문 관리 대시보드

### 🔜 **v2.0** (계획)
- Taobao, 1688.com API 통합
- Coupang 파트너스 연동
- 자동 번역 시스템
- 다국어 지원

---

## 📚 문서

- [CLAUDE.md](./CLAUDE.md) - 프로젝트 상세 가이드
- [VERSION.md](./VERSION.md) - 버전 히스토리
- [docs/frontend/](./docs/frontend/) - 프론트엔드 가이드
- [docs/backend/](./docs/backend/) - 백엔드 가이드

---

## 🤝 기여하기

프로젝트에 기여하고 싶으시다면 Pull Request를 보내주세요!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📞 문의 및 지원

- GitHub Issues: [프로젝트 이슈](https://github.com/ABC-Group-Tech/bandauto/issues)
- 이메일: admin@example.com

---

## 📄 라이센스

MIT License

---

## 🙏 감사의 말

- [Next.js](https://nextjs.org/) - React 프레임워크
- [Prisma](https://www.prisma.io/) - ORM
- [Google Gemini](https://ai.google.dev/) - AI 분석
- [TossPayments](https://www.tosspayments.com/) - 결제 시스템
- [AliExpress Open Platform](https://developers.aliexpress.com/) - 글로벌 소싱

---

**Made with ❤️ by ABC Group Tech**

🚀 Powered by Next.js 14, Prisma, Gemini AI, TossPayments
