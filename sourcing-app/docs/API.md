# API 규칙

> **관련 문서:** [STRUCTURE.md](./STRUCTURE.md) | [SECURITY.md](./SECURITY.md) | [CLAUDE.md](../CLAUDE.md)

---

## Next.js API Routes 구조

```text
app/api/
├── auth/                    # 인증
│   ├── login/               # 로그인
│   ├── logout/              # 로그아웃
│   ├── session/             # 세션 조회
│   └── band/                # Band OAuth
│       ├── authorize/
│       └── callback/
├── channel/                 # 채널 관리
│   ├── [id]/
│   │   └── band-session/    # 채널별 Band 세션
│   └── keys/                # 채널 암호화 키
├── post/                    # 게시물
│   ├── available/           # 등록 가능 게시물
│   └── [id]/
├── collected-product/       # 수집 상품
│   └── [id]/
├── product/                 # 상품
│   ├── ai-generate/         # AI 상품 생성
│   ├── deactivate/          # 일괄 비활성화 (TR-20260122-001)
│   ├── publish/             # 상품 발행
│   ├── validate-pricing/    # 가격 검증
│   └── [id]/
├── published-product/       # 발행된 상품
│   └── [id]/
├── shop/                    # 쇼핑몰
│   ├── check-duplicate/     # 중복 체크
│   ├── publish/             # 쇼핑몰 발행
│   │   └── stream/          # SSE 스트림
│   └── [id]/
├── order/                   # 주문
│   ├── unified/             # 통합 주문
│   │   └── [id]/
│   └── external/            # 외부 주문
│       ├── [orderNumber]/   # 주문번호로 조회
│       ├── guest/           # 비회원 주문
│       │   └── [id]/        # 조회/삭제
│       └── member/          # 회원 주문
│           └── [id]/        # 조회/삭제
├── automation/              # 자동화
│   ├── config/              # 설정
│   ├── execute/             # 실행
│   ├── resume/              # 재개
│   ├── logs/                # 로그
│   └── stats/               # 통계
├── settings/                # 설정
│   ├── ai/                  # AI 설정
│   │   └── test/
│   ├── api/                 # API 설정
│   │   └── test/
│   ├── google-sheets/       # 구글 시트 설정 (TR-20260112-003)
│   │   └── test/
│   └── prompt/              # 프롬프트 설정
├── dashboard/               # 대시보드
│   └── pipeline/            # 파이프라인 통합 대시보드
├── admin/                   # 관리자
│   ├── notifications/       # 알림
│   ├── reviews/             # 리뷰 관리
│   └── wholesale-orders/    # 도매 주문
│       └── [id]/
│           └── sync-sheets/ # 구글 시트 동기화 (TR-20260112-003)
├── cs/                      # 고객 서비스
│   └── inquiry/             # 문의
│       └── [id]/
│           └── reply/
├── coupon/                  # 쿠폰
│   └── [id]/
├── settlement/              # 정산
│   ├── toss-transactions/   # 토스페이먼츠 거래 조회
│   ├── history/
│   └── [id]/
├── policy/                  # 정책
│   ├── privacy/
│   └── terms/
├── images/                  # 이미지 처리
│   ├── channel/
│   ├── post/
│   └── product/
└── user/                    # 사용자
    └── [id]/
```

---

## Route Handler 패턴

### 기본 구조

```typescript
// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request)
  const user = token ? await verifyToken(token) : null

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH.UNAUTHORIZED' } },
      { status: 401 }
    )
  }

  // 비즈니스 로직
  return NextResponse.json({ success: true, data: {} })
}
```

### 동적 라우트

```typescript
// app/api/products/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  // ...
}
```

---

## 인증

### JWT 인증

| 항목 | 값 |
|-----|---|
| 라이브러리 | jose, jsonwebtoken |
| Token 저장 | HttpOnly Cookie (auth-token) |
| 만료 | 24시간 |
| 암호화 | HS256 |

### 세션 검증 패턴

```typescript
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

// API Route 내부
const token = getTokenFromRequest(request)
const user = token ? await verifyToken(token) : null

if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const userId = user.id
```

### 미들웨어 인증

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
```

---

## 응답 형식

### 성공

```json
{
  "success": true,
  "data": {}
}
```

### 목록 (페이지네이션)

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "size": 20,
      "totalItems": 150,
      "totalPages": 8
    }
  }
}
```

### 에러

```json
{
  "success": false,
  "error": {
    "code": "DOMAIN.ERROR_NAME",
    "message": "사용자 친화적 메시지"
  }
}
```

---

## HTTP 상태 코드

| Status | 용도 |
|--------|-----|
| 200 | 조회/수정 성공 |
| 201 | 생성 성공 |
| 204 | 삭제 성공 |
| 400 | 잘못된 요청 형식 |
| 401 | 인증 필요/실패 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복) |
| 422 | 비즈니스 규칙 위반 |
| 500 | 서버 오류 |

---

## SSE (Server-Sent Events)

### 발행 스트림 API

**엔드포인트:** `GET /api/shop/publish/stream`

실시간으로 발행 진행 상황을 클라이언트에 전달합니다.

### 이벤트 타입

| Event | 설명 |
|-------|-----|
| `start` | 발행 시작 |
| `progress` | 진행 상황 업데이트 |
| `complete` | 발행 완료 |
| `error` | 오류 발생 |

### progress 이벤트 페이로드

```typescript
interface PublishProgressEvent {
  productId: number
  productName: string
  current: number           // 현재 처리 중인 상품 순번
  total: number             // 전체 상품 수
  stage: 'preparing' | 'downloading' | 'uploading' | 'entering' | 'submitting' | 'completed'
  stageProgress?: string    // 단계별 진행 메시지
  uploadProgress?: {        // 이미지 업로드 진행률 (TR-20260107-001)
    fileIndex: string       // "1/10" (현재/전체 파일)
    totalPercent: string    // "10%" (전체 진행률)
    currentPercent: string  // "92%" (현재 파일 업로드 진행률)
  }
}
```

### 예시 응답

```text
event: progress
data: {"productId":123,"productName":"상품명","current":1,"total":5,"stage":"uploading","uploadProgress":{"fileIndex":"3/10","totalPercent":"25%","currentPercent":"85%"}}

event: complete
data: {"success":true,"successCount":5,"failedCount":0}
```

### 클라이언트 사용 예시

```typescript
const eventSource = new EventSource('/api/shop/publish/stream?productIds=1,2,3&channelId=1')

eventSource.addEventListener('progress', (event) => {
  const data = JSON.parse(event.data)
  console.log(`${data.current}/${data.total}: ${data.productName}`)

  // 업로드 진행률 표시
  if (data.uploadProgress) {
    console.log(`📤 ${data.uploadProgress.fileIndex} (${data.uploadProgress.totalPercent})`)
  }
})

eventSource.addEventListener('complete', (event) => {
  const result = JSON.parse(event.data)
  console.log(`완료: 성공 ${result.successCount}, 실패 ${result.failedCount}`)
  eventSource.close()
})
```

---

## 에러 코드

### 공통

| Code | HTTP | 설명 |
|------|------|-----|
| COMMON.VALIDATION_ERROR | 422 | 입력값 검증 실패 |
| COMMON.NOT_FOUND | 404 | 리소스 없음 |
| COMMON.INTERNAL_ERROR | 500 | 서버 내부 오류 |

### 인증 (AUTH)

| Code | HTTP | 설명 |
|------|------|-----|
| AUTH.UNAUTHORIZED | 401 | 인증 필요 |
| AUTH.INVALID_CREDENTIALS | 401 | 잘못된 자격증명 |
| AUTH.SESSION_EXPIRED | 401 | 세션 만료 |
| AUTH.FORBIDDEN | 403 | 권한 부족 |

### 소싱 (SOURCING)

| Code | HTTP | 설명 |
|------|------|-----|
| SOURCING.BAND_API_ERROR | 502 | Band API 호출 실패 |
| SOURCING.BAND_SESSION_EXPIRED | 401 | Band 세션 만료 |
| SOURCING.AI_TRANSFORM_FAILED | 422 | AI 변환 실패 |
| SOURCING.CHANNEL_NOT_FOUND | 404 | 채널 없음 |

### 상품 (PRODUCT)

| Code | HTTP | 설명 |
|------|------|-----|
| PRODUCT.NOT_FOUND | 404 | 상품 없음 |
| PRODUCT.OUT_OF_STOCK | 422 | 재고 없음 |
| PRODUCT.INVALID_OPTION | 422 | 잘못된 옵션 |

### 주문 (ORDER)

| Code | HTTP | 설명 |
|------|------|-----|
| ORDER.NOT_FOUND | 404 | 주문 없음 |
| ORDER.INVALID_STATUS | 422 | 잘못된 상태 전이 |
| ORDER.ALREADY_CANCELLED | 409 | 이미 취소됨 |

### 결제 (PAYMENT)

| Code | HTTP | 설명 |
|------|------|-----|
| PAYMENT.CONFIRM_FAILED | 422 | 결제 승인 실패 |
| PAYMENT.AMOUNT_MISMATCH | 422 | 금액 불일치 |
| PAYMENT.REFUND_FAILED | 422 | 환불 실패 |

---

## 입력 검증 (Zod)

```typescript
import { z } from 'zod'

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.number(),
    variantId: z.number().optional(),
    quantity: z.number().positive()
  })),
  shippingAddress: z.object({
    name: z.string().min(1),
    phone: z.string().regex(/^01[0-9]{8,9}$/),
    address: z.string().min(1),
    detail: z.string().optional()
  })
})

// Route Handler에서 사용
const body = await request.json()
const result = orderSchema.safeParse(body)
if (!result.success) {
  return NextResponse.json(
    { success: false, error: { code: 'COMMON.VALIDATION_ERROR', details: result.error.issues } },
    { status: 422 }
  )
}
```

---

## 외부 API 연동

### Band Open API

| 항목 | 값 |
|-----|---|
| Base URL | `https://openapi.band.us` |
| Auth | OAuth2 + Session Cookie |
| Rate Limit | 100 req/min |

### Toss Payments

| 항목 | 값 |
|-----|---|
| Base URL | `https://api.tosspayments.com/v1` |
| Auth | Basic Auth (Secret Key) |
| 결제 승인 | POST `/payments/confirm` |

### Gemini AI

| 항목 | 값 |
|-----|---|
| Base URL | `https://generativelanguage.googleapis.com` |
| Auth | API Key |
| 용도 | 상품 정보 추출 |

---

## 페이지네이션

### 쿼리 파라미터

| Param | Type | Default | Max |
|-------|------|---------|-----|
| page | number | 1 | - |
| size | number | 20 | 100 |
| sort | string | - | `field:asc|desc` |

### 사용 예시

```typescript
// URL: /api/products?page=2&size=10&sort=createdAt:desc

const url = new URL(request.url)
const page = Number(url.searchParams.get('page')) || 1
const size = Math.min(Number(url.searchParams.get('size')) || 20, 100)
const skip = (page - 1) * size

const [items, total] = await Promise.all([
  prisma.product.findMany({ skip, take: size }),
  prisma.product.count()
])

return NextResponse.json({
  success: true,
  data: {
    items,
    pagination: {
      page,
      size,
      totalItems: total,
      totalPages: Math.ceil(total / size)
    }
  }
})
```

---

## 금지사항

| 금지 | 이유 |
|-----|-----|
| try-catch 없이 외부 API 호출 | 서버 크래시 방지 |
| 민감정보 응답 노출 | 보안 |
| 하드코딩된 에러 메시지 | 일관성 |
| 인증 없이 민감 데이터 반환 | 보안 |

---

## 엔드포인트 상세

### GET /api/shop

쇼핑몰 목록을 조회합니다.

**인증:** 필수 (JWT)

**쿼리 파라미터:**

| Param | Type | Default | 설명 |
|-------|------|---------|------|
| page | number | 1 | 페이지 번호 |
| limit | number | 20 | 페이지당 항목 수 |

**응답 스키마:**

```typescript
interface ShopListResponse {
  success: true
  data: Array<{
    id: number
    name: string
    slug: string
    description: string | null
    isActive: boolean
    createdAt: string
    updatedAt: string
    theme: ShopTheme | null
    _count: {
      publishedProducts: number  // 발행된 상품 수
      orders: number             // 회원 주문 수
      guestOrders: number        // 게스트 주문 수 (TR-20260107-005 추가)
    }
  }>
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
```

**응답 예시:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "마이쇼핑몰",
      "slug": "my-shop",
      "description": null,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-07T00:00:00.000Z",
      "theme": null,
      "_count": {
        "publishedProducts": 150,
        "orders": 45,
        "guestOrders": 23
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**변경 이력:**
- TR-20260107-005: `_count.guestOrders` 필드 추가

---

### GET /api/settlement/toss-transactions

토스페이먼츠 거래 내역을 조회합니다. (TR-20260112-002 추가)

**인증:** 필수 (JWT)

**쿼리 파라미터:**

| Param | Type | Required | 설명 |
|-------|------|----------|------|
| year | number | Yes | 조회 연도 |
| month | number | Yes | 조회 월 (1-12) |

**요청 예시:**

```http
GET /api/settlement/toss-transactions?year=2026&month=1
```

**응답 스키마:**

```typescript
interface TossTransactionsResponse {
  success: true
  data: {
    period: {
      year: number
      month: number
      startDate: string       // ISO 날짜 시작
      endDate: string         // ISO 날짜 끝
    }
    summary: {
      totalAmount: number     // 총 거래 금액 (DONE 상태)
      totalCount: number      // 총 거래 건수 (DONE 상태)
      cardAmount: number      // 카드 결제 금액
      cardCount: number       // 카드 결제 건수
      transferAmount: number  // 계좌이체 금액
      transferCount: number   // 계좌이체 건수
      virtualAccountAmount: number  // 가상계좌 금액
      virtualAccountCount: number   // 가상계좌 건수
      canceledAmount: number  // 취소 금액
      canceledCount: number   // 취소 건수
      methodTypes: string[]   // 결제 수단 목록 (디버깅용)
    }
    transactions: TossTransaction[]  // 최근 100건
  }
}

interface TossTransaction {
  mId: string
  transactionKey: string
  paymentKey: string
  orderId: string
  method: string              // 결제 수단 (카드, 간편결제 등)
  customerKey?: string
  useEscrow: boolean
  receiptUrl?: string
  status: string              // DONE, CANCELED, PARTIAL_CANCELED 등
  transactionAt: string       // 거래 시각
  currency: string
  amount: number
}
```

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "period": {
      "year": 2026,
      "month": 1,
      "startDate": "2026-01-01T00:00:00",
      "endDate": "2026-01-31T23:59:59"
    },
    "summary": {
      "totalAmount": 1500000,
      "totalCount": 45,
      "cardAmount": 1200000,
      "cardCount": 35,
      "transferAmount": 200000,
      "transferCount": 5,
      "virtualAccountAmount": 100000,
      "virtualAccountCount": 5,
      "canceledAmount": 50000,
      "canceledCount": 2,
      "methodTypes": ["카드", "계좌이체", "가상계좌"]
    },
    "transactions": [...]
  }
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 400 | Bad Request | year, month 파라미터 누락 |
| 500 | Internal Server Error | 토스페이먼츠 API 키 미설정 또는 조회 실패 |

**변경 이력:**
- TR-20260112-006: 스키마 변경 (tossPayAmount/Count → transferAmount/Count, virtualAccountAmount/Count)
- TR-20260112-002: 신규 API 추가

---

### Google Sheets API (TR-20260112-003)

구글 시트 연동 설정 및 동기화 기능을 제공합니다.

#### GET /api/settings/google-sheets

구글 시트 설정을 조회합니다.

**인증:** 필수 (JWT)

**응답 스키마:**

```typescript
interface GoogleSheetsSettingsResponse {
  success: true
  data: {
    spreadsheetId: string | null  // 스프레드시트 ID
    sheetUrl: string | null       // 전체 URL (편의용)
    createdAt: string | null
    updatedAt: string | null
  } | null
}
```

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetUrl": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "createdAt": "2026-01-12T10:00:00.000Z",
    "updatedAt": "2026-01-12T10:00:00.000Z"
  }
}
```

---

#### POST /api/settings/google-sheets

구글 시트 설정을 저장합니다.

**인증:** 필수 (JWT)

**요청 바디:**

```typescript
interface GoogleSheetsSettingsRequest {
  spreadsheetId: string  // 스프레드시트 ID (URL에서 추출된 ID)
}
```

**요청 예시:**

```json
{
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
}
```

**응답 스키마:**

```typescript
interface GoogleSheetsSettingsSaveResponse {
  success: true
  data: {
    spreadsheetId: string
    sheetUrl: string
    createdAt: string
    updatedAt: string
  }
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 400 | Bad Request | spreadsheetId 누락 |

---

#### DELETE /api/settings/google-sheets

구글 시트 설정을 삭제합니다.

**인증:** 필수 (JWT)

**응답:**

```json
{
  "success": true
}
```

---

#### POST /api/settings/google-sheets/test

구글 시트 연결을 테스트합니다.

**인증:** 필수 (JWT)

**요청 바디:**

```typescript
interface GoogleSheetsTestRequest {
  spreadsheetId: string
}
```

**응답 스키마:**

```typescript
interface GoogleSheetsTestResponse {
  success: true
  data: {
    success: true
    message: string       // "연결 성공: {시트 제목}"
    title: string         // 스프레드시트 제목
  }
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 400 | Bad Request | spreadsheetId 누락 또는 서비스 계정 미설정 |
| 403 | Forbidden | 스프레드시트 접근 권한 없음 |

---

#### POST /api/admin/wholesale-orders/[wholesaleChannelId]/sync-sheets

도매처별 발주 데이터를 구글 시트로 동기화합니다.

**인증:** 필수 (JWT)

**경로 파라미터:**

| Param | Type | 설명 |
|-------|------|------|
| wholesaleChannelId | number | 도매처(채널) ID |

**기능:**
- 해당 도매처의 결제 완료된 주문(회원/비회원)을 구글 시트로 동기화
- 날짜별로 그룹핑하여 소계/합계 자동 계산
- 엑셀 내보내기와 동일한 포맷 적용

**시트 구조:**

| 컬럼 | 설명 |
|------|------|
| A | 주문번호 |
| B | 쇼핑몰 |
| C | 일시 |
| D | 상품명 |
| E | 수량 |
| F | 상품금액 |
| G | 배송비 |
| H | 총금액 |
| I | 수취인 |
| J | 연락처 |
| K | 주소 |
| L | 의뢰인 |
| M | 현금영수증 |
| N | 이메일 |

**포맷팅:**
- 제목: 16pt bold, 중앙정렬, 셀 병합
- 정보 섹션 (도매처, 생성일시, 총 주문, 발주일수): 12pt
- 날짜 구분행: #4472C4 파란색 배경, 흰색 12pt bold, 셀 병합
- 헤더: #E0E0E0 회색 배경, 11pt bold, 중앙정렬, 테두리
- 데이터 행: 11pt, 테두리
- 발주 완료 행: #D0D0D0 회색 배경, 11pt, 테두리
- 소계: #D9E1F2 연한 파란색 배경, bold, 테두리
- 총계: #FFF0C0 연한 노란색 배경, 12pt bold, 테두리

**응답 스키마:**

```typescript
interface SyncSheetsResponse {
  success: true
  data: {
    success: true
    message: string
    url: string        // 동기화된 시트 URL
    sheetName: string  // 생성/업데이트된 시트 탭 이름
    rowCount: number   // 동기화된 행 수
  }
}
```

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "도매처A 발주서를 구글 시트로 동기화했습니다.",
    "url": "https://docs.google.com/spreadsheets/d/xxx#gid=123",
    "sheetName": "도매처A",
    "rowCount": 150
  }
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 400 | Bad Request | 구글 시트 설정 미완료 |
| 403 | Forbidden | 스프레드시트 접근 권한 없음 |
| 404 | Not Found | 도매처를 찾을 수 없음 |

**변경 이력:**
- TR-20260112-003: 신규 API 추가

---

### GET /api/post/available

도매채널에서 수집 가능한 게시물 목록을 조회합니다.

**인증:** 필수 (JWT)

**쿼리 파라미터:**

| Param | Type | Default | 설명 |
|-------|------|---------|------|
| platform | ChannelPlatform | BAND | 플랫폼 (현재 BAND만 지원) |
| todayOnly | string | false | "true"인 경우 오늘(KST) 게시물만 필터링 |

**응답 스키마:**

```typescript
interface PostAvailableResponse {
  success: true
  data: Array<{
    post_key: string        // Band 게시물 키
    title: string           // 게시물 제목 (내용 앞 100자)
    content: string         // 게시물 전체 내용
    author: string          // 작성자명
    created_at: number      // 작성 시각 (Unix timestamp, 초 단위)
    images: string[]        // 이미지 URL 배열
    comments: any[]         // 댓글 배열
    channel: {
      id: number
      name: string
      channelKey: string
      coverUrl: string | null
    }
  }>
  todayOnly: boolean        // 오늘 필터 적용 여부
  totalAvailable: number    // 전체 수집 가능 게시물 수
  todayCount: number        // 오늘 게시물 수
}
```

**응답 예시:**

```json
{
  "success": true,
  "data": [
    {
      "post_key": "AAA...",
      "title": "신상품 입고 안내",
      "content": "신상품 입고 안내...",
      "author": "도매처A",
      "created_at": 1736640000,
      "images": ["https://..."],
      "comments": [],
      "channel": {
        "id": 1,
        "name": "도매채널A",
        "channelKey": "BBB...",
        "coverUrl": null
      }
    }
  ],
  "todayOnly": true,
  "totalAvailable": 150,
  "todayCount": 12
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 400 | Bad Request | Band API 설정 미완료 |
| 401 | Unauthorized | 로그인 필요 |
| 500 | Internal Server Error | 게시물 조회 실패 |

**기능 설명:**
- 사용자의 도매채널(WHOLESALE)에서 Band API를 통해 게시물 조회
- 이미 수집한 게시물(CollectedPost)은 자동 제외
- `todayOnly=true` 시 KST 기준 오늘 게시물만 필터링

---

### GET /api/admin/wholesale-orders/[wholesaleChannelId]/items

도매처별 상세 주문 목록을 조회합니다. (회원 + 비회원 주문 통합)

**인증:** 필수 (JWT)

**경로 파라미터:**

| Param | Type | 설명 |
|-------|------|------|
| wholesaleChannelId | number | 도매처(채널) ID |

**쿼리 파라미터:**

| Param | Type | Default | 설명 |
|-------|------|---------|------|
| page | number | 1 | 페이지 번호 |
| limit | number | 50 | 페이지당 항목 수 |
| status | string | "pending" | 주문 상태 필터 ("pending": 발주대기, "completed": 발주완료) |
| from | string | - | 시작 날짜 (ISO 8601, 예: "2026-01-01") |
| to | string | - | 종료 날짜 (ISO 8601, 예: "2026-01-31") |

**요청 예시:**

```http
GET /api/admin/wholesale-orders/1/items?status=completed&from=2026-01-01&to=2026-01-13&page=1&limit=50
```

**응답 스키마:**

```typescript
interface WholesaleOrderItemsResponse {
  success: true
  data: {
    items: UnifiedOrderItem[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
    summary: {
      totalQuantity: number  // 총 수량
      totalAmount: number    // 총 금액
    }
  }
}

interface UnifiedOrderItem {
  orderItemId: number
  orderId: number           // 발주완료 처리용
  orderNumber: string
  orderedAt: string         // ISO 8601 날짜
  isMember: boolean         // 회원 주문 여부
  retailChannelName: string // 소매 채널명
  productName: string
  optionSummary: string
  quantity: number
  productAmount: number     // 상품금액 (도매가 × 수량)
  shippingFee: number       // 배송비 (합배송 단위 계산)
  totalAmount: number       // 합산금액 (상품금액 + 배송비)
  customerName: string
  customerPhone: string     // 마스킹됨 (010-****-5678)
  customerAddress: string
  postalCode: string
}
```

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "orderItemId": 123,
        "orderId": 456,
        "orderNumber": "ORD-20260113-001",
        "orderedAt": "2026-01-13T10:30:00.000Z",
        "isMember": true,
        "retailChannelName": "마이쇼핑몰",
        "productName": "상품명",
        "optionSummary": "색상: 블랙, 사이즈: M",
        "quantity": 2,
        "productAmount": 40000,
        "shippingFee": 3000,
        "totalAmount": 43000,
        "customerName": "홍길동",
        "customerPhone": "010-****-5678",
        "customerAddress": "서울시 강남구 테헤란로 123",
        "postalCode": "06234"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "totalPages": 1
    },
    "summary": {
      "totalQuantity": 45,
      "totalAmount": 1500000
    }
  }
}
```

**상태 필터:**

| status | 조회 대상 주문 상태 |
|--------|-------------------|
| pending | PAID, PREPARING (발주 대기) |
| completed | SHIPPED, DELIVERED (발주 완료) |

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 401 | Unauthorized | 인증 필요 |
| 500 | Internal Server Error | 조회 실패 |

**변경 이력:**
- TR-20260113-001: `from`, `to` 날짜 필터 파라미터 동작 수정 (기존 무시 → 정상 동작)

---

## POST /api/order/external

**설명:** 외부 주문 생성 (문자, 밴드 댓글 등)

**인증:** Required

**Request Body:**

```json
{
  "shopId": 1,
  "guestName": "홍길동",
  "guestPhone": "010-1234-5678",
  "guestEmail": "hong@example.com",
  "shippingAddress": {
    "recipientName": "홍길동",
    "recipientPhone": "010-1234-5678",
    "postalCode": "06234",
    "address": "서울시 강남구 테헤란로 123",
    "addressDetail": "A동 101호",
    "deliveryMemo": "문 앞에 놓아주세요"
  },
  "items": [
    {
      "shopProductId": 10,
      "variantId": 20,
      "quantity": 2
    }
  ],
  "memo": "밴드 댓글 주문",
  "customTotalAmount": 30000
}
```

**파라미터:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| shopId | number | O | 쇼핑몰 ID |
| guestName | string | O | 고객명 |
| guestPhone | string | O | 전화번호 |
| guestEmail | string | X | 이메일 |
| shippingAddress | object | O | 배송 주소 |
| items | array | O | 주문 상품 목록 |
| memo | string | X | 주문 메모 |
| customTotalAmount | number | X | 수동 입력 결제금액 (할인/협의 가격) |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "orderNumber": "XORD-20260115-ABC123456789",
    "status": "PENDING",
    "totalAmount": 30000,
    "itemCount": 1
  }
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 400 | Bad Request | 유효성 검증 실패 |
| 401 | Unauthorized | 인증 필요 |
| 500 | Internal Server Error | 주문 생성 실패 |

**변경 이력:**
- TR-20260115-007: customTotalAmount 파라미터 추가 (할인/협의 가격 지원)

---

## GET /api/order/external/[orderNumber]

**설명:** 주문번호로 외부 주문 상세 조회

**인증:** Required

**URL Parameters:**

| 필드 | 타입 | 설명 |
|------|------|------|
| orderNumber | string | 주문번호 (예: XORD-20260115-ABC123456789) |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "orderNumber": "XORD-20260115-ABC123456789",
    "status": "PENDING",
    "guestName": "홍길동",
    "guestPhone": "010-1234-5678",
    "subtotalAmount": 33000,
    "discountAmount": 3000,
    "totalAmount": 30000,
    "isGuest": true,
    "items": [
      {
        "productName": "상품명",
        "optionSummary": "옵션",
        "quantity": 2,
        "unitPrice": 15000,
        "totalPrice": 30000
      }
    ],
    "shippingAddress": {
      "recipientName": "홍길동",
      "recipientPhone": "010-1234-5678",
      "postalCode": "06234",
      "address": "서울시 강남구 테헤란로 123",
      "addressDetail": "A동 101호"
    }
  }
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 401 | Unauthorized | 인증 필요 |
| 404 | Not Found | 주문을 찾을 수 없음 |
| 500 | Internal Server Error | 조회 실패 |

**변경 이력:**
- TR-20260115-011: API 엔드포인트 추가

---

## GET /api/order/external/guest/[id]

**설명:** 비회원 외부 주문 상세 조회

**인증:** Required

**URL Parameters:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | number | 주문 ID |

**Response:** GET /api/order/external/[orderNumber]와 동일

**변경 이력:**
- TR-20260115-011: API 엔드포인트 추가

---

## DELETE /api/order/external/guest/[id]

**설명:** 비회원 외부 주문 삭제 (Soft Delete)

**인증:** Required

**URL Parameters:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | number | 주문 ID |

**Response:**

```json
{
  "success": true,
  "message": "주문이 삭제되었습니다."
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 401 | Unauthorized | 인증 필요 |
| 404 | Not Found | 주문을 찾을 수 없음 |
| 500 | Internal Server Error | 삭제 실패 |

**변경 이력:**
- TR-20260115-011: API 엔드포인트 추가

---

## GET /api/order/external/member/[id]

**설명:** 회원 외부 주문 상세 조회

**인증:** Required

**URL Parameters:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | number | 주문 ID |

**Response:** GET /api/order/external/[orderNumber]와 동일

**변경 이력:**
- TR-20260115-011: API 엔드포인트 추가

---

## DELETE /api/order/external/member/[id]

**설명:** 회원 외부 주문 삭제 (Soft Delete)

**인증:** Required

**URL Parameters:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | number | 주문 ID |

**Response:**

```json
{
  "success": true,
  "message": "주문이 삭제되었습니다."
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 401 | Unauthorized | 인증 필요 |
| 404 | Not Found | 주문을 찾을 수 없음 |
| 500 | Internal Server Error | 삭제 실패 |

**변경 이역:**
- TR-20260115-011: API 엔드포인트 추가

---

## GET /api/product/deactivate

**설명:** 일괄 비활성화 대상 상품 미리보기 (TR-20260122-001)

**인증:** Required

**쿼리 파라미터:**

| Param | Type | Default | 설명 |
|-------|------|---------|------|
| days | number | 90 | 기준 일수 (N일 전에 생성된 상품 조회) |

**요청 예시:**

```http
GET /api/product/deactivate?days=3
```

**응답 스키마:**

```typescript
interface DeactivatePreviewResponse {
  success: true
  data: {
    count: number           // 비활성화 대상 상품 수
    products: Array<{       // 미리보기 (최대 100개)
      id: number
      name: string
      thumbnailUrl: string | null
      createdAt: string
      channel: {
        id: number
        name: string
      } | null
    }>
    cutoffDate: string      // 기준 날짜 (ISO 8601)
    days: number            // 조회에 사용된 기간
  }
}
```

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "count": 26,
    "products": [
      {
        "id": 123,
        "name": "상품명",
        "thumbnailUrl": "https://...",
        "createdAt": "2026-01-10T10:00:00.000Z",
        "channel": {
          "id": 1,
          "name": "도매채널A"
        }
      }
    ],
    "cutoffDate": "2026-01-19T00:00:00.000Z",
    "days": 3
  }
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 401 | Unauthorized | 인증 필요 |
| 500 | Internal Server Error | 조회 실패 |

**변경 이력:**
- TR-20260122-001: API 엔드포인트 추가

---

## POST /api/product/deactivate

**설명:** 일괄 비활성화 실행 (Soft Delete) (TR-20260122-001)

**인증:** Required

**요청 바디:**

```typescript
interface DeactivateRequest {
  days: number              // 기준 일수 (필수)
  productIds?: number[]     // 특정 상품만 비활성화 (선택)
}
```

**요청 예시:**

```json
{
  "days": 3
}
```

또는 특정 상품만:

```json
{
  "days": 3,
  "productIds": [123, 456, 789]
}
```

**응답 스키마:**

```typescript
interface DeactivateResponse {
  success: true
  data: {
    deactivatedCount: number  // 비활성화된 상품 수
    cutoffDate: string        // 기준 날짜
    days: number
  }
  message: string             // 결과 메시지
}
```

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "deactivatedCount": 26,
    "cutoffDate": "2026-01-19T00:00:00.000Z",
    "days": 3
  },
  "message": "26개 상품이 비활성화되었습니다."
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 400 | Bad Request | days 파라미터 누락 또는 유효하지 않음 |
| 401 | Unauthorized | 인증 필요 |
| 500 | Internal Server Error | 비활성화 실패 |

**기능 설명:**
- 지정된 기간(days) 이전에 생성된 상품을 Soft Delete 처리
- `deletedAt` 필드에 현재 시각 설정, `isActive`를 false로 변경
- 발행 여부와 관계없이 모든 활성 상품이 대상
- productIds 지정 시 해당 상품만 비활성화

**변경 이력:**
- TR-20260122-001: API 엔드포인트 추가

---

## GET /api/shop/publish

**설명:** 발행 가능한 상품 목록 조회 (TR-20260205-001)

**인증:** Required

**쿼리 파라미터:**

| Param | Type | Default | 설명 |
|-------|------|---------|------|
| page | number | 1 | 페이지 번호 |
| limit | number | 20 | 페이지당 항목 수 |
| search | string | - | 상품명 검색 |
| channelId | number | - | 도매채널 ID 필터 |
| daysWithin | number | - | 최근 N일 이내 등록된 상품만 조회 |

**요청 예시:**

```http
GET /api/shop/publish?page=1&limit=20&daysWithin=1
```

**응답 스키마:**

```typescript
interface PublishProductsResponse {
  success: true
  data: Array<{
    id: number
    name: string
    description: string | null
    thumbnailUrl: string | null
    price: number
    wholesalePrice: number | null
    channel: {
      id: number
      name: string
    } | null
    publishStatus: {
      channel: boolean    // 소매밴드 발행 여부
      shop: boolean       // 쇼핑몰 발행 여부
    }
    publishSummary: '미발행' | '부분발행' | '발행완료'
    publishedChannels: Array<{
      publishId: number
      channelId: number | null
      channelName: string | null
      status: string
      createdAt: string
    }>
    publishedShops: Array<{
      publishId: number
      shopId: number | null
      shopName: string | null
      subdomain: string | null
      status: string
      createdAt: string
    }>
    createdAt: string
  }>
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  stats: {
    total: number
    published: number
    unpublished: number
    retailBandPublished: number
    retailBandUnpublished: number
  }
}
```

**기능 설명:**
- 활성 상태(`isActive: true`)인 상품만 조회
- `daysWithin` 파라미터로 최근 N일 이내 등록된 상품만 필터링 (오래된 상품 제외)
- 발행 페이지에서 기본값으로 오늘(1일) 설정하여 오래된 미발행 상품이 실수로 발행되는 것 방지

**변경 이력:**
- TR-20260205-001: `daysWithin` 파라미터 추가, `isActive` 필터 추가

---

### GET /api/dashboard/pipeline

파이프라인 통합 대시보드 데이터를 조회합니다. 소싱 자동화, 주문/발주, 정산 현황을 한 화면에서 통합 관리합니다.

**인증:** 필수 (JWT)

**쿼리 파라미터:**

| Param | Type | Default | 설명 |
|-------|------|---------|------|
| period | string | month | 조회 기간 ("week", "month", "quarter") |
| year | number | 현재년도 | 조회 연도 |
| month | number | 현재월 | 조회 월 (1-12) |

**요청 예시:**

```http
GET /api/dashboard/pipeline?period=month&year=2026&month=3
```

**응답 스키마:**

```typescript
interface PipelineDashboardResponse {
  success: true
  data: {
    period: {
      start: string      // ISO 8601 시작일
      end: string        // ISO 8601 종료일
    }
    sourcing: {
      automated: number  // 자동화 실행 횟수
      collected: number  // 수집한 상품 수
      published: number  // 발행한 상품 수
      success: number    // 성공 건수
      failed: number     // 실패 건수
    }
    orders: {
      total: number      // 총 주문 수
      pending: number    // 발주 대기 수
      completed: number  // 발주 완료 수
      amount: number     // 총 주문 금액
    }
    settlement: {
      totalAmount: number       // 총 결제액
      completeAmount: number    // 완료된 결제액
      pendingAmount: number     // 대기 중인 결제액
      transactionCount: number  // 거래 건수
    }
  }
}
```

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-03-01T00:00:00.000Z",
      "end": "2026-03-31T23:59:59.999Z"
    },
    "sourcing": {
      "automated": 12,
      "collected": 145,
      "published": 120,
      "success": 1740,
      "failed": 15
    },
    "orders": {
      "total": 450,
      "pending": 85,
      "completed": 365,
      "amount": 4500000
    },
    "settlement": {
      "totalAmount": 4500000,
      "completeAmount": 4200000,
      "pendingAmount": 300000,
      "transactionCount": 450
    }
  }
}
```

**에러:**

| Code | HTTP | 설명 |
|------|------|-----|
| 401 | Unauthorized | 인증 필요 |
| 422 | Unprocessable Entity | year/month 파라미터 유효하지 않음 |
| 500 | Internal Server Error | 조회 실패 |

**변경 이력:**
- TR-20260318-001: API 엔드포인트 추가
