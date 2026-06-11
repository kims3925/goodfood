# 굿푸드몰 오픈 API 사용 안내 (v1)

- 기준일: 2026-06-11 · Base URL: `https://goodshop.hublink.im`
- 인증: OAuth2 **client_credentials** (카페24 호환 패턴, 토큰 유효 2시간)
- 응답 규격: `{ data, pagination: { limit, offset, total } }` / 에러 `{ error: { code, message } }`

## 1. API 키 발급

1. 굿푸드몰 B2B 판매자 승인 후, 관리자(굿푸드몰 운영자)가 **어드민 → 오픈 API → API 클라이언트**(`goodshop-admin.hublink.im/admin/openapi/clients`)에서 클라이언트를 발급합니다.
2. 발급 시 `clientId` / `clientSecret`(1회만 표시)과 scope(`products:read`, `orders:read`, `orders:write`)가 부여됩니다.
3. 분당 호출 한도(기본 60회)를 초과하면 `429`가 반환됩니다.

## 2. 토큰 발급

```bash
curl -X POST https://goodshop.hublink.im/api/v1/oauth/token \
  -H "Authorization: Basic $(echo -n '{clientId}:{clientSecret}' | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials"
# → { "access_token": "...", "token_type": "Bearer", "expires_in": 7200, "scopes": [...] }
```

이후 모든 요청에 `Authorization: Bearer {access_token}` 헤더를 포함합니다.

## 3. 엔드포인트

| Method | Path | 설명 | scope |
|---|---|---|---|
| GET | `/api/v1/categories` | 카테고리 트리 | products:read |
| GET | `/api/v1/products` | 상품 목록 — `limit`(≤100)/`offset`, `category`(대분류 prefix 포함), `updated_after`(증분 동기화), `sort=latest\|best_7d\|trending` | products:read |
| GET | `/api/v1/products/{id}` | 상품 상세 (공급가, 옵션/variant, 이미지, 배송정책, sourceStatus) | products:read |
| GET | `/api/v1/products/{id}/status` | 품절/가격 경량 폴링 | products:read |
| POST | `/api/v1/orders` | 발주 생성 (variantId, qty, 수령자 정보) | orders:write |
| GET | `/api/v1/orders` · `/api/v1/orders/{id}` | 발주 목록/상세 (배송상태·송장) | orders:read |

### 사용 예시

```bash
# 베스트 상품 50개
curl -H "Authorization: Bearer $TOKEN" \
  "https://goodshop.hublink.im/api/v1/products?sort=best_7d&limit=50"

# 증분 동기화 (마지막 동기화 이후 변경분)
curl -H "Authorization: Bearer $TOKEN" \
  "https://goodshop.hublink.im/api/v1/products?updated_after=2026-06-11T00:00:00Z"

# 발주 생성
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"variantId":123,"qty":2}],"receiver":{"name":"홍길동","phone":"010-0000-0000","address":"..."}}' \
  https://goodshop.hublink.im/api/v1/orders
```

## 4. 연동 권장 패턴 (외부 쇼핑몰)

1. **초기 적재**: `GET /products`를 offset 페이징으로 전체 수집 → 내 쇼핑몰에 등록 (판매가 = 공급가 + 마진)
2. **정기 동기화**: 10~30분 주기로 `updated_after` 증분 호출 → 가격/품절(sourceStatus=SOLDOUT) 반영
3. **주문 전달**: 내 쇼핑몰에 주문 발생 시 `POST /orders`로 발주 → `GET /orders/{id}`로 배송상태/송장 폴링
4. 토큰은 만료(2h) 전 재발급, `429` 시 백오프

## 5. 운영 메모

- API 호출 로그: 어드민 → 오픈 API → 호출 로그
- 비밀키 유출 시 어드민에서 클라이언트 비활성화 후 재발급
- 문의: skkim3925@gmail.com
