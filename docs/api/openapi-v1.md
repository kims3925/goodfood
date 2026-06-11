# Wholesale Food 오픈 API v1

> B2B 도매상품 공급 플랫폼 오픈 API. 외부 판매자가 상품을 조회하고 발주합니다.
> 인증 패턴은 카페24 호환 (OAuth2 client_credentials, Bearer 2시간).

- Base URL: `https://{도메인}/api/v1`
- 응답 규격: 성공 `{ data, pagination? }`, 에러 `{ error: { code, message } }`
- Rate limit: 클라이언트당 분당 60회 (기본, 초과 시 `429 RATE_LIMIT_EXCEEDED`)

## 0. 키 발급

쇼핑몰 로그인 → 사업자 인증(`/b2b/apply`) 승인 후 → `/b2b/developers` 에서 발급.
`client_secret` 은 발급 시 1회만 표시됩니다.

## 1. 인증

### POST /oauth/token

| 항목 | 값 |
|---|---|
| Authorization | `Basic base64(client_id:client_secret)` |
| Body | `grant_type=client_credentials` (form 또는 JSON) |

```bash
curl -X POST https://example.com/api/v1/oauth/token \
  -H "Authorization: Basic $(echo -n 'bw_xxx:secret' | base64)" \
  -d "grant_type=client_credentials"
```

응답:

```json
{ "access_token": "...", "token_type": "Bearer", "expires_in": 7200, "scopes": ["products:read","orders:read","orders:write"] }
```

모든 v1 엔드포인트는 `Authorization: Bearer {access_token}` 필요.

## 2. 엔드포인트

| Method | Path | 설명 | scope |
|--------|------|------|-------|
| GET | `/categories` | 카테고리 트리 | products:read |
| GET | `/products` | 상품 목록 (증분/필터/페이지네이션) | products:read |
| GET | `/products/{id}` | 상품 상세 (공급가/옵션/이미지/sourceStatus) | products:read |
| GET | `/products/{id}/status` | 품절/가격 경량 폴링 | products:read |
| POST | `/orders` | 발주 생성 | orders:write |
| GET | `/orders` | 발주 목록 | orders:read |
| GET | `/orders/{id}` | 발주 상세 | orders:read |

### GET /products 쿼리

| 파라미터 | 설명 |
|---|---|
| `limit` / `offset` | 페이지네이션 (limit 1~100, 기본 20) |
| `category` | 카테고리 코드 (대분류 코드는 하위 중분류 포함) |
| `status` | `active`(기본) / `soldout` / `all` |
| `updated_after` | ISO 일시 — 증분 동기화 |

상품 필드: `wholesale_price`(공급가), `retail_price`(권장 소매가), `source_status`
(`ACTIVE`/`SOLDOUT`/`POST_DELETED`/`PRICE_CHANGED`), `shipping_fee`, `bundle_shipping_type`.

### POST /orders

```json
{
  "items": [{ "variant_id": 123, "quantity": 2 }],
  "receiver": {
    "name": "홍길동", "phone": "010-0000-0000",
    "address": "서울시 ...", "postal_code": "06000",
    "address_detail": "101호", "delivery_memo": "부재 시 문앞"
  }
}
```

- 단가 = variant 공급가(`wholesale_price`), 배송비 = 상품별 1회 합산
- 결제: 1차는 **무통장/관리자 확인** (`status=PENDING`, `payment_method=BANK_TRANSFER`)
- 비활성/품절 상품 발주 시 `409 PRODUCT_INACTIVE`

## 3. 에러 코드

| HTTP | code | 설명 |
|---|---|---|
| 400 | INVALID_BODY / INVALID_ITEM / INVALID_RECEIVER | 요청 형식 오류 |
| 401 | UNAUTHORIZED / INVALID_TOKEN / TOKEN_EXPIRED / INVALID_CLIENT | 인증 실패 |
| 403 | INSUFFICIENT_SCOPE / B2B_NOT_APPROVED | 권한 부족 |
| 404 | PRODUCT_NOT_FOUND / VARIANT_NOT_FOUND / ORDER_NOT_FOUND | 리소스 없음 |
| 409 | PRODUCT_INACTIVE / PRODUCT_NOT_PUBLISHED | 발주 불가 상태 |
| 429 | RATE_LIMIT_EXCEEDED | 분당 한도 초과 |

## 4. 웹훅 (2차 예고)

`product.soldout` / `product.price_changed` / `order.shipped` — Phase 2 모니터링 이벤트 기반. 미구현.

## ⚠️ 외부 공개 전 체크리스트

- [ ] SaaS P0 4건 완료 (밴드 계정 정체성 / 에이전트 userId 격리 / 쿠키 암호화 / 세션 상태 API) — `BandAuto_SaaS준비도_점검보고서_20260610.md`
- [ ] HTTPS + 운영 도메인 분리 (필요 시 `api.{도메인}` 라우팅)
- [ ] rate limit Redis 운영 환경 확인
