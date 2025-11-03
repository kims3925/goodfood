# 토스페이먼츠 연동 및 자체 판매 페이지 구축 기획서

## 📋 프로젝트 개요

**목표**: 스룩페이 대신 토스페이먼츠를 연동하고, 자체 플랫폼에서 상품 판매 페이지와 결제가 모두 가능한 통합 시스템 구축

**기간**: 2-3주 예상 (개발 복잡도에 따라 조정)

**핵심 가치**: 
- 외부 플랫폼 의존도 감소
- 수수료 절약 및 수익 극대화
- 고객 데이터 직접 관리
- 브랜딩 및 사용자 경험 향상

---

## 🎯 주요 기능 요구사항

### 1. 토스페이먼츠 연동
- **결제 처리**: 카드, 계좌이체, 가상계좌, 간편결제
- **결제 상태 관리**: 승인, 취소, 환불, 부분취소
- **웹훅 처리**: 실시간 결제 상태 업데이트
- **결제 내역 조회**: 관리자 대시보드

### 2. 자체 판매 페이지 시스템
- **상품 상세 페이지**: SEO 최적화된 개별 상품 페이지
- **장바구니 기능**: 다중 상품 주문 지원
- **주문서 작성**: 고객 정보 입력 및 배송지 관리
- **결제 프로세스**: 토스페이먼츠 위젯 통합

### 3. 주문 관리 시스템
- **실시간 주문 알림**: 카카오톡, 이메일, SMS
- **자동 발주 시스템**: 도매업체 자동 발주서 생성
- **배송 추적**: 택배사 연동 및 배송 상태 업데이트
- **고객 서비스**: 주문 조회, 취소, 교환, 환불

---

## 🛠 기술 스택 및 아키텍처

### Frontend
- **Next.js 14**: App Router 기반
- **토스페이먼츠 SDK**: `@tosspayments/payment-sdk`
- **React Query**: 서버 상태 관리
- **Zustand**: 장바구니 상태 관리

### Backend
- **토스페이먼츠 API**: Server-to-Server 통신
- **Webhook 처리**: 결제 상태 실시간 업데이트
- **Queue 시스템**: Bull Queue로 주문 처리 작업

### 데이터베이스 (Prisma 스키마 확장)
```prisma
// 새로 추가될 모델들
model PaymentMethod {
  id        String @id @default(cuid())
  name      String // "토스페이먼츠"
  isActive  Boolean @default(true)
  config    Json   // API 키, 설정값들
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  payments  Payment[]
}

model Payment {
  id              String @id @default(cuid())
  orderId         String @unique
  paymentKey      String? // 토스페이먼츠 결제 키
  method          String  // "카드", "계좌이체" 등
  amount          Int     // 결제 금액 (원)
  status          String  // "READY", "IN_PROGRESS", "DONE", "CANCELED"
  approvedAt      DateTime?
  failReason      String?
  cancelReason    String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  order           Order @relation(fields: [orderId], references: [id])
  paymentMethod   PaymentMethod @relation(fields: [paymentMethodId], references: [id])
  paymentMethodId String
}

model ProductPage {
  id              String @id @default(cuid())
  productId       String @unique
  slug            String @unique // SEO 친화적 URL
  title           String
  metaDescription String?
  customDomain    String? // 커스텀 도메인 지원
  isPublished     Boolean @default(false)
  viewCount       Int @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  product         Product @relation(fields: [productId], references: [id])
}

model Cart {
  id        String @id @default(cuid())
  sessionId String // 비회원 장바구니 지원
  userId    String?
  items     CartItem[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User? @relation(fields: [userId], references: [id])
}

model CartItem {
  id        String @id @default(cuid())
  cartId    String
  productId String
  quantity  Int
  priceAt   Float  // 장바구니 담을 당시 가격
  cart      Cart @relation(fields: [cartId], references: [id])
  product   Product @relation(fields: [productId], references: [id])
}

// Order 모델 확장
model Order {
  // 기존 필드들...
  paymentStatus    String @default("PENDING") // "PENDING", "PAID", "FAILED", "CANCELED"
  shippingAddress  Json? // 배송지 정보
  customerMemo     String? // 고객 요청사항
  trackingNumber   String? // 송장번호
  shippingStatus   String @default("PREPARING") // "PREPARING", "SHIPPED", "DELIVERED"
  payments         Payment[]
  refunds          Refund[]
}

model Refund {
  id          String @id @default(cuid())
  orderId     String
  amount      Int
  reason      String
  status      String // "PENDING", "APPROVED", "REJECTED", "COMPLETED"
  processedAt DateTime?
  createdAt   DateTime @default(now())
  order       Order @relation(fields: [orderId], references: [id])
}
```

---

## 🔑 필요한 API 키 및 환경 변수

### 토스페이먼츠 설정
```env
# 토스페이먼츠 API (테스트/프로덕션)
TOSS_PAYMENTS_CLIENT_KEY="test_ck_..." # 클라이언트 키 (프론트엔드용)
TOSS_PAYMENTS_SECRET_KEY="test_sk_..." # 시크릿 키 (서버용)
TOSS_PAYMENTS_WEBHOOK_SECRET="..." # 웹훅 검증용

# 결제 설정
PAYMENT_SUCCESS_URL="http://localhost:3000/payment/success"
PAYMENT_FAIL_URL="http://localhost:3000/payment/fail"
PAYMENT_WEBHOOK_URL="http://localhost:3000/api/webhook/payments"

# 도메인 설정 (프로덕션)
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"
TOSS_PAYMENTS_ORIGIN_URL="https://yourdomain.com" # CORS 설정용
```

### 알림 서비스 (기존 확장)
```env
# SMS 알림 (선택사항)
SMS_API_KEY="..." # 알리고, 쿨SMS 등
SMS_SENDER="010-0000-0000"

# 택배 조회 API
DELIVERY_TRACKER_API_KEY="..." # 스위트트래커 등
```

---

## 📁 프로젝트 구조 확장

```
bandauto/
├── app/
│   ├── (shop)/                    # 쇼핑몰 레이아웃
│   │   ├── layout.tsx            # 쇼핑몰 전용 레이아웃
│   │   ├── products/             # 상품 상세 페이지
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   ├── cart/                 # 장바구니
│   │   │   └── page.tsx
│   │   ├── checkout/             # 주문서 작성
│   │   │   └── page.tsx
│   │   └── order/                # 주문 완료/조회
│   │       ├── success/
│   │       ├── fail/
│   │       └── [orderNumber]/
│   ├── api/
│   │   ├── payments/             # 토스페이먼츠 API
│   │   │   ├── initialize/       # 결제 초기화
│   │   │   ├── confirm/          # 결제 승인
│   │   │   ├── cancel/           # 결제 취소
│   │   │   └── webhook/          # 웹훅 처리
│   │   ├── cart/                 # 장바구니 API
│   │   ├── checkout/             # 주문서 API
│   │   └── orders/               # 주문 관리 API
│   └── (dashboard)/
│       └── dashboard/
│           ├── sales/            # 매출 관리
│           ├── payments/         # 결제 내역
│           └── shop-settings/    # 쇼핑몰 설정
├── components/
│   ├── shop/                     # 쇼핑몰 컴포넌트
│   │   ├── ProductCard.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── Cart.tsx
│   │   ├── CheckoutForm.tsx
│   │   └── PaymentWidget.tsx
│   └── payments/                 # 결제 관련 컴포넌트
│       ├── TossPayments.tsx
│       ├── PaymentMethods.tsx
│       └── PaymentStatus.tsx
├── lib/
│   ├── payments/                 # 결제 서비스
│   │   ├── toss-payments.ts
│   │   ├── webhook-handler.ts
│   │   └── payment-validator.ts
│   ├── shop/                     # 쇼핑몰 서비스
│   │   ├── cart-service.ts
│   │   ├── order-service.ts
│   │   └── product-page-service.ts
│   └── notifications/            # 확장된 알림 서비스
│       ├── order-notifications.ts
│       └── sms-service.ts
└── hooks/                        # Custom Hooks
    ├── useCart.ts
    ├── usePayment.ts
    └── useOrderTracking.ts
```

---

## 🔄 워크플로우 설계

### 1. 상품 등록 및 페이지 생성 플로우
```
도매 상품 수집 
    ↓
AI 상세페이지 생성 
    ↓
상품 페이지 퍼블리시
    ↓
SEO 최적화 적용
    ↓
소매 밴드 자동 포스팅 (상품 페이지 링크 포함)
```

### 2. 주문 및 결제 플로우
```
고객 상품 페이지 방문
    ↓
장바구니 담기 / 바로 구매
    ↓
주문서 작성 (배송지, 연락처)
    ↓
토스페이먼츠 결제 위젯
    ↓
결제 승인 처리
    ↓
주문 확정 & 알림 발송
    ↓
도매업체 자동 발주
    ↓
배송 처리 & 추적
```

### 3. 주문 관리 플로우
```
결제 완료 웹훅 수신
    ↓
주문 상태 업데이트
    ↓
고객 주문 확인 알림 (카카오톡/SMS/이메일)
    ↓
관리자 새 주문 알림
    ↓
도매업체 발주서 자동 생성 및 발송
    ↓
배송 시작시 고객 알림
    ↓
배송 완료시 리뷰 요청
```

---

## 💳 토스페이먼츠 MCP 및 SDK 설치

### 1. 패키지 설치
```bash
# 토스페이먼츠 SDK
npm install @tosspayments/payment-sdk
npm install @tosspayments/payment-widget-sdk

# 추가 의존성
npm install uuid crypto-js
npm install @types/uuid @types/crypto-js --save-dev
```

### 2. MCP 설정 (Claude Desktop용)
```json
// claude_desktop_config.json에 추가
{
  "mcpServers": {
    "toss-payments": {
      "command": "npx",
      "args": ["@tosspayments/mcp-server"],
      "env": {
        "TOSS_PAYMENTS_SECRET_KEY": "test_sk_...",
        "TOSS_PAYMENTS_CLIENT_KEY": "test_ck_..."
      }
    }
  }
}
```

---

## 🧪 개발 단계별 로드맵

### Phase 1: 기반 구조 구축 (1주차)
- [ ] 데이터베이스 스키마 확장
- [ ] 토스페이먼츠 SDK 설치 및 설정
- [ ] 기본 결제 API 엔드포인트 구현
- [ ] 웹훅 처리 시스템 구축

### Phase 2: 쇼핑몰 UI 구현 (2주차)
- [ ] 상품 상세 페이지 컴포넌트
- [ ] 장바구니 시스템 구현
- [ ] 주문서 작성 폼
- [ ] 토스페이먼츠 결제 위젯 통합

### Phase 3: 주문 관리 시스템 (3주차)
- [ ] 주문 상태 관리 대시보드
- [ ] 자동 발주 시스템 확장
- [ ] 알림 시스템 확장 (SMS, 카카오톡)
- [ ] 배송 추적 시스템

### Phase 4: 최적화 및 테스트 (4주차)
- [ ] 결제 프로세스 테스트
- [ ] 성능 최적화
- [ ] SEO 최적화
- [ ] 모바일 반응형 최적화

---

## 📊 예상 비용 및 수익 분석

### 수수료 비교
| 플랫폼 | 카드 결제 | 계좌이체 | 가상계좌 |
|--------|-----------|----------|----------|
| **스룩페이** | 3.3% | 1.5% | 500원 |
| **토스페이먼츠** | 2.9% | 1.0% | 400원 |
| **월 절약액 예상** | -0.4% | -0.5% | -100원 |

### 추가 이익
- **브랜딩 효과**: 자체 도메인 쇼핑몰
- **데이터 소유권**: 고객 정보 직접 관리
- **마케팅 확장성**: 쿠폰, 적립금 시스템 추가 가능
- **수익성 향상**: 중간 수수료 제거

---

## 🚨 주요 고려사항 및 리스크

### 기술적 고려사항
1. **PCI DSS 컴플라이언스**: 카드 정보 직접 처리 금지
2. **보안**: HTTPS 필수, 민감 정보 암호화
3. **성능**: 결제 위젯 로딩 최적화
4. **브라우저 호환성**: 다양한 결제 수단 지원

### 법적/규제 고려사항
1. **전자상거래법**: 쇼핑몰 의무 사항 준수
2. **개인정보보호법**: 고객 정보 수집·처리 동의
3. **소비자보호법**: 반품·환불 정책 명시
4. **통신판매업 신고**: 사업자 등록 필요

### 운영 고려사항
1. **고객 서비스**: 주문 문의, 결제 실패 대응
2. **정산 관리**: 토스페이먼츠 정산 주기 (D+1)
3. **세금 처리**: 부가세, 원천징수 등
4. **재고 관리**: 실시간 재고 연동 시스템

---

## 🎯 성공 지표 (KPI)

### 비즈니스 지표
- **전환율**: 방문자 대비 구매 완료율
- **객단가**: 평균 주문 금액
- **재방문율**: 고객 재구매율
- **수수료 절약**: 월별 결제 수수료 절약액

### 기술 지표
- **결제 성공률**: 95% 이상 목표
- **페이지 로딩 속도**: 3초 이내
- **모바일 전환율**: 데스크톱 대비 80% 이상
- **API 응답 시간**: 500ms 이내

### 운영 지표
- **고객 만족도**: 주문 후 피드백 점수
- **주문 처리 시간**: 자동화율 90% 이상
- **배송 추적률**: 실시간 배송 상태 업데이트
- **클레임 처리**: 24시간 이내 응답

---

## 🔧 초기 설정 체크리스트

### 토스페이먼츠 설정
- [ ] 토스페이먼츠 개발자 계정 생성
- [ ] 테스트 API 키 발급
- [ ] 웹훅 URL 등록
- [ ] 결제 수단 활성화 설정

### 개발 환경 설정
- [ ] 환경 변수 설정 (.env.local)
- [ ] 데이터베이스 마이그레이션
- [ ] SSL 인증서 설정 (HTTPS 필수)
- [ ] CORS 정책 설정

### 법적 준비사항
- [ ] 통신판매업 신고
- [ ] 개인정보처리방침 작성
- [ ] 이용약관 작성
- [ ] 결제·환불 정책 수립

---

## 📞 다음 단계

1. **요구사항 확인**: 위 기획서 검토 및 피드백
2. **우선순위 결정**: Phase별 개발 순서 최종 확정
3. **개발 환경 준비**: 토스페이먼츠 계정 및 API 키 준비
4. **프로토타입 개발**: 기본 결제 플로우 구현

이 기획서를 바탕으로 단계별로 개발을 진행하시겠습니까? 특별히 우선적으로 구현하고 싶은 기능이나 수정하고 싶은 부분이 있으시면 알려주세요.