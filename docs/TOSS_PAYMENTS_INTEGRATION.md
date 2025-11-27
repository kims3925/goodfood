# 토스 페이먼츠 결제 시스템 통합 가이드

## 📋 목차
1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [설정 방법](#설정-방법)
4. [결제 흐름](#결제-흐름)
5. [주요 컴포넌트](#주요-컴포넌트)
6. [API 엔드포인트](#api-엔드포인트)
7. [테스트 방법](#테스트-방법)
8. [프로덕션 배포](#프로덕션-배포)
9. [트러블슈팅](#트러블슈팅)

---

## 개요

이 프로젝트는 **토스 페이먼츠 Payment Widget V2**를 사용하여 완전한 온라인 결제 시스템을 구현했습니다.

### 지원 결제 수단
- ✅ 신용카드 / 체크카드
- ✅ 계좌이체 (실시간 계좌이체)
- ✅ 간편결제 (카카오페이, 네이버페이, 토스페이 등)
- ✅ 휴대폰 소액결제
- ✅ 가상계좌
- ✅ 상품권 (문화상품권, 도서문화상품권, 게임문화상품권)

### 주요 기능
- 🎨 **노코드 UI 커스터마이징**: 토스페이먼츠 어드민에서 결제 UI 디자인 변경
- 🔐 **안전한 결제**: 서버 사이드 결제 승인으로 보안 강화
- 📱 **반응형 디자인**: 모바일/데스크톱 모든 환경 지원
- 🔄 **실시간 금액 업데이트**: 쿠폰, 할인 적용 시 즉시 반영
- 📊 **결제 내역 관리**: 주문-결제 연동 및 이력 추적

---

## 아키텍처

### 시스템 구조

```
┌─────────────┐
│   Client    │  (결제 페이지 - Next.js)
└──────┬──────┘
       │ 1. 주문 생성 요청
       ▼
┌─────────────┐
│    API      │  POST /api/orders
│   Server    │  → Order 생성 & DB 저장
└──────┬──────┘
       │ 2. Order 정보 반환
       ▼
┌─────────────┐
│   Client    │  TossPaymentWidget 렌더링
└──────┬──────┘
       │ 3. 결제 요청 (requestPayment)
       ▼
┌─────────────┐
│    Toss     │  결제창 표시 & 결제 수단 선택
│  Payments   │  → 결제 인증 완료
└──────┬──────┘
       │ 4. successUrl로 리다이렉트
       │    (paymentKey, orderId, amount)
       ▼
┌─────────────┐
│   Client    │  /store/payment/success
└──────┬──────┘
       │ 5. 결제 승인 요청
       ▼
┌─────────────┐
│    API      │  POST /api/payments/confirm
│   Server    │  → Toss API 결제 승인 호출
└──────┬──────┘
       │ 6. 승인 결과
       ▼
┌─────────────┐
│  Database   │  Payment 저장 & Order 상태 업데이트
└─────────────┘
```

### 데이터 모델

#### Order (주문)
```prisma
model Order {
  id             Int                 @id @default(autoincrement())
  userId         Int
  orderNumber    String              @unique
  status         CustomerOrderStatus @default(PENDING)
  recipientName  String
  recipientPhone String
  address        String
  totalAmount    Decimal
  payment        Payment?            // 1:1 관계
  // ... 기타 필드
}
```

#### Payment (결제)
```prisma
model Payment {
  id           Int               @id @default(autoincrement())
  orderId      Int               @unique
  paymentKey   String            @unique
  tossOrderId  String
  method       TossPaymentMethod
  status       TossPaymentStatus @default(READY)
  amount       Decimal
  approvedAt   DateTime?
  order        Order             @relation(fields: [orderId], references: [id])
  // ... 기타 필드
}
```

---

## 설정 방법

### 1. 토스 페이먼츠 가입 및 키 발급

#### 개발 단계 (테스트 키 사용)
1. 토스 페이먼츠 개발자센터 방문: https://developers.tosspayments.com
2. 회원가입 및 로그인
3. 문서에 제공된 **테스트 키** 사용:
   ```
   Client Key: test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm
   Secret Key: test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6
   ```

#### 프로덕션 단계 (실제 키 발급)
1. 토스 페이먼츠 전자결제 신청: https://www.tosspayments.com
2. 계약 완료 후 개발자센터에서 **결제위젯 연동 키** 발급
3. 실제 키 형식:
   ```
   Client Key: live_gck_xxxxxxxx
   Secret Key: live_gsk_xxxxxxxx
   ```

### 2. 환경 변수 설정

`.env` 파일에 키 추가:

```bash
# Toss Payments API Keys
TOSS_PAYMENTS_CLIENT_KEY="test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm"
TOSS_PAYMENTS_SECRET_KEY="test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6"
```

### 3. 데이터베이스 마이그레이션

```bash
cd db
npx prisma migrate dev
npx prisma generate
```

### 4. 개발 서버 실행

```bash
cd e-commerce-app
npm install
npm run dev
```

---

## 결제 흐름

### 1단계: 주문서 작성
- **페이지**: `/store/checkout`
- **기능**:
  - 주문자 정보 입력 (이름, 전화번호, 이메일)
  - 배송지 정보 입력 (주소, 우편번호)
  - 배송 메모 선택
  - 결제 금액 계산 (상품금액 + 배송비 - 할인)

### 2단계: 결제위젯 렌더링
```javascript
// TossPaymentWidget 컴포넌트 초기화
const widgets = tossPayments.widgets({ customerKey })

// 결제 금액 설정
await widgets.setAmount({
  currency: 'KRW',
  value: totalAmount
})

// 결제 UI 렌더링
await widgets.renderPaymentMethods({
  selector: '#payment-method',
  variantKey: 'DEFAULT'
})

// 약관 UI 렌더링
await widgets.renderAgreement({
  selector: '#agreement'
})
```

### 3단계: 결제 요청
```javascript
await widgets.requestPayment({
  orderId: orderNumber,           // 주문번호 (고유값)
  orderName: '상품명',             // 결제창에 표시될 상품명
  successUrl: '/store/payment/success',  // 성공 시 이동할 URL
  failUrl: '/store/payment/fail',        // 실패 시 이동할 URL
  customerEmail: 'user@example.com',
  customerName: '홍길동'
})
```

### 4단계: 결제 승인 (서버)
```javascript
// POST /api/payments/confirm
const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${base64(secretKey + ':')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentKey,  // 토스에서 발급한 결제 키
    orderId,     // 주문번호
    amount       // 결제 금액 (검증)
  })
})
```

### 5단계: 결제 완료
- **성공**: `/store/payment/success` 페이지 표시
- **실패**: `/store/payment/fail` 페이지 표시 (에러 메시지 포함)

---

## 주요 컴포넌트

### 1. CheckoutPage (`/store/checkout/page.tsx`)
주문서 페이지

**주요 기능**:
- 장바구니 또는 단일 상품 구매 지원
- 주문자/수령인 정보 폼
- 배송지 입력
- 결제 금액 계산 (상품금액 + 배송비)
- 주문 생성 API 호출

**사용 예시**:
```tsx
// 장바구니에서 주문
<Link href="/store/checkout?fromCart=true">주문하기</Link>

// 단일 상품 주문
<Link href={`/store/checkout?productId=${id}&quantity=1`}>바로 구매</Link>
```

### 2. TossPaymentWidget (`/modules/payments/.../TossPaymentWidget.tsx`)
토스 페이먼츠 결제 위젯 컴포넌트

**Props**:
```typescript
interface PaymentWidgetProps {
  orderId: string        // 주문번호
  orderName: string      // 상품명
  customerEmail?: string // 구매자 이메일
  customerName?: string  // 구매자 이름
  amount: number         // 결제 금액
  onPaymentSuccess?: (payment: any) => void
  onPaymentFail?: (error: any) => void
}
```

**주요 기능**:
- 토스페이먼츠 SDK V2 로드
- 클라이언트 키 가져오기 (`/api/shop/settings`)
- 결제 UI 렌더링
- 결제 요청 처리
- Mock 결제 (로컬 개발 환경)

### 3. PaymentSuccessPage (`/store/payment/success/page.tsx`)
결제 성공 페이지

**URL 파라미터**:
- `paymentKey`: 토스에서 발급한 결제 키
- `orderId`: 주문번호
- `amount`: 결제 금액

**동작**:
1. URL에서 파라미터 추출
2. `/api/payments/confirm` 호출하여 결제 승인
3. 승인 성공 시 주문 정보 표시
4. 배송 단계 안내

### 4. PaymentFailPage (`/store/payment/fail/page.tsx`)
결제 실패 페이지

**URL 파라미터**:
- `code`: 에러 코드
- `message`: 에러 메시지
- `orderId`: 주문번호

**에러 코드 예시**:
- `PAY_PROCESS_CANCELED`: 사용자가 결제 취소
- `REJECT_CARD_COMPANY`: 카드사 승인 거부
- `INSUFFICIENT_BALANCE`: 잔액 부족
- `INVALID_CARD_EXPIRATION`: 카드 유효기간 오류

---

## API 엔드포인트

### POST `/api/orders`
주문 생성

**요청 바디**:
```json
{
  "customerInfo": {
    "name": "홍길동",
    "phone": "010-1234-5678",
    "email": "user@example.com"
  },
  "shippingAddress": {
    "address": "서울시 강남구 테헤란로 123",
    "postalCode": "06234",
    "addressDetail": "101동 1001호",
    "recipientName": "홍길동",
    "recipientPhone": "010-1234-5678",
    "deliveryMemo": "문 앞에 놓아주세요"
  },
  "fromCart": true,
  "items": [
    {
      "productId": 1,
      "quantity": 2
    }
  ]
}
```

**응답**:
```json
{
  "success": true,
  "order": {
    "id": 123,
    "orderNumber": "ORD-20250327-ABC123",
    "totalAmount": 50000,
    "status": "PENDING"
  }
}
```

### POST `/api/payments/confirm`
결제 승인

**요청 바디**:
```json
{
  "paymentKey": "tviva20240327151055FmhG5",
  "orderId": "ORD-20250327-ABC123",
  "amount": 50000
}
```

**응답 (성공)**:
```json
{
  "success": true,
  "payment": {
    "paymentKey": "tviva20240327151055FmhG5",
    "orderId": "ORD-20250327-ABC123",
    "amount": 50000,
    "method": "CARD",
    "status": "DONE",
    "approvedAt": "2025-03-27T15:10:55.000Z"
  },
  "order": {
    "id": 123,
    "orderNumber": "ORD-20250327-ABC123",
    "status": "PAID"
  }
}
```

**응답 (실패)**:
```json
{
  "success": false,
  "error": "결제 승인에 실패했습니다",
  "code": "REJECT_CARD_COMPANY"
}
```

### POST `/api/payments/cancel`
결제 취소

**요청 바디**:
```json
{
  "paymentKey": "tviva20240327151055FmhG5",
  "cancelReason": "고객 변심",
  "cancelAmount": 50000
}
```

### POST `/api/payments/webhook`
웹훅 수신 (가상계좌 입금 알림 등)

---

## 테스트 방법

### 1. 로컬 테스트 (Mock 결제)

HTTP 환경 (`http://localhost:3000`)에서 자동으로 Mock 결제 시스템 사용:

```bash
npm run dev
```

1. 주문서 작성: http://localhost:3000/store/checkout
2. 결제 버튼 클릭
3. Mock 결제 창에서 확인 클릭
4. 성공 페이지로 이동

### 2. 테스트 환경 (실제 토스 SDK)

HTTPS 환경에서 테스트 키 사용:

1. **ngrok 또는 로컬 HTTPS 설정**:
   ```bash
   # ngrok 사용
   ngrok http 3000
   ```

2. **테스트 카드번호** (토스페이먼츠 제공):
   - 카드번호: `4000000000000002`
   - 유효기간: 임의 미래 날짜
   - CVC: 임의 3자리
   - 비밀번호: 임의 2자리

3. **테스트 계좌이체**:
   - 은행: 임의 선택
   - 계좌번호: 임의 입력

4. **결제 확인**:
   - 토스 개발자센터 > 테스트 결제내역: https://developers.tosspayments.com/my/payment-logs

### 3. 샌드박스 테스트

토스페이먼츠 샌드박스 활용:
- https://developers.tosspayments.com/sandbox
- 다양한 결제 시나리오 시뮬레이션
- 결제 성공/실패/취소 등 테스트

---

## 프로덕션 배포

### 1. 환경 준비

1. **토스페이먼츠 전자결제 신청**:
   - https://www.tosspayments.com
   - 사업자등록증, 통신판매업신고증 필요
   - 심사 완료 후 실제 결제 가능

2. **실제 키 발급**:
   - 개발자센터 > 결제위젯 연동 키
   - Client Key (`live_gck_xxx`)
   - Secret Key (`live_gsk_xxx`)

3. **환경 변수 설정**:
   ```bash
   TOSS_PAYMENTS_CLIENT_KEY="live_gck_your_actual_key"
   TOSS_PAYMENTS_SECRET_KEY="live_gsk_your_actual_secret_key"
   ```

### 2. 보안 체크리스트

- [ ] Secret Key를 클라이언트에 노출하지 않음
- [ ] HTTPS 적용
- [ ] 결제 금액 서버 검증 (amount 비교)
- [ ] orderId 고유성 보장
- [ ] CORS 설정 확인
- [ ] API Rate Limiting 적용
- [ ] 결제 로그 저장

### 3. 배포 체크리스트

토스페이먼츠 공식 배포 체크리스트:
https://docs.tosspayments.com/guides/v2/deployment-checklist

주요 항목:
- [ ] 결제 테스트 완료 (성공/실패/취소)
- [ ] 웹훅 연동 (가상계좌 사용 시 필수)
- [ ] 에러 처리 로직 검증
- [ ] 모바일 환경 테스트
- [ ] 결제 내역 관리 기능
- [ ] 고객 문의 대응 프로세스

### 4. 모니터링

- **토스 개발자센터**:
  - 결제 내역 실시간 확인
  - 에러 로그 모니터링

- **자체 로그**:
  - Payment 테이블 조회
  - `rawResponse` 필드에 전체 응답 저장

---

## 트러블슈팅

### 문제 1: SDK 로드 실패
**증상**: "토스페이먼츠 SDK 로드 실패" 에러

**해결**:
1. HTTPS 환경인지 확인
2. 네트워크 연결 확인
3. 브라우저 콘솔에서 스크립트 로드 상태 확인
4. 로컬 개발 시 Mock 결제 사용

### 문제 2: 결제 승인 실패 (NOT_FOUND_PAYMENT_SESSION)
**증상**: 결제 창은 성공했으나 승인 API에서 실패

**원인**: 결제 시간 만료 (결제 후 30분 이내 승인 필요)

**해결**:
1. successUrl 페이지에서 즉시 승인 API 호출
2. 승인 로직에 타임아웃 없는지 확인

### 문제 3: 금액 불일치 에러
**증상**: "주문 금액과 결제 금액이 일치하지 않습니다"

**원인**: 클라이언트와 서버의 금액 불일치

**해결**:
```javascript
// 클라이언트
await widgets.setAmount({ value: totalAmount })
await widgets.requestPayment({ orderId, orderName })

// 서버 검증
if (Number(order.totalAmount) !== amount) {
  throw new Error('금액 불일치')
}
```

### 문제 4: 결제 UI가 렌더링되지 않음
**증상**: 빈 화면 또는 로딩만 표시

**해결**:
1. Client Key 확인 (`test_gck_` 또는 `live_gck_`로 시작)
2. `/api/shop/settings`에서 키 정상 반환 확인
3. 브라우저 콘솔 에러 확인
4. DOM 요소 존재 여부 확인 (`#payment-method`, `#agreement`)

### 문제 5: 가상계좌 입금 후 상태 미변경
**증상**: 가상계좌로 입금했으나 주문 상태가 변경되지 않음

**해결**:
1. 웹훅 연동 필수: https://docs.tosspayments.com/guides/v2/webhook
2. `/api/payments/webhook` 엔드포인트 구현
3. 토스 개발자센터에 웹훅 URL 등록

---

## 추가 자료

### 공식 문서
- 토스페이먼츠 개발자 센터: https://developers.tosspayments.com
- Payment Widget V2 가이드: https://docs.tosspayments.com/guides/v2/payment-widget/integration
- API 레퍼런스: https://docs.tosspayments.com/reference
- 샌드박스: https://developers.tosspayments.com/sandbox

### 샘플 코드
- 공식 샘플 다운로드: https://github.com/tosspayments/payment-widget-sample

### 고객 지원
- 토스페이먼츠 고객센터: 1544-7772
- 이메일: support@tosspayments.com
- 개발자 커뮤니티: https://developers.tosspayments.com/community

---

## 요약

✅ **완료된 작업**:
1. ✅ 토스 페이먼츠 Payment Widget V2 통합
2. ✅ 주문 생성 API 구현
3. ✅ 결제 승인 API 구현
4. ✅ 결제 성공/실패 페이지 구현
5. ✅ Prisma 스키마 설정 (Order, Payment 모델)
6. ✅ 환경 변수 설정 (테스트 키 포함)
7. ✅ Mock 결제 시스템 (로컬 개발용)

🎯 **다음 단계** (필요 시):
- [ ] 웹훅 연동 (가상계좌 입금 알림)
- [ ] 부분 취소 기능
- [ ] 정기 결제 (빌링)
- [ ] 에스크로 결제
- [ ] 다국어 지원
- [ ] 결제 통계 대시보드

**테스트 시작**:
```bash
cd e-commerce-app
npm run dev
# http://localhost:3000/store/checkout 접속
```
