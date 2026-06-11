# 굿푸드몰 오픈 API 사용 안내 (V2)

- 갱신일: 2026-06-12 (V1 → V2: 어드민 주소/키 발급 절차 확정, 카테고리 관리 기능 반영)
- Base URL: `https://goodshop.hublink.im`
- 어드민: `https://goodshop-admin.hublink.im`
- 인증: OAuth2 **client_credentials** (카페24 호환, 토큰 유효 2시간)
- 응답 규격: `{ data, pagination: { limit, offset, total } }` / 에러 `{ error: { code, message } }`

## 1. API 키 발급 (운영자)

1. 어드민 로그인 → **어드민 패널 → 오픈 API → API 클라이언트** (`goodshop-admin.hublink.im/admin/openapi/clients`)
2. 클라이언트 생성 시 `clientId` / `clientSecret`(생성 직후 1회만 표시 — 즉시 안전한 곳에 보관)과 scope가 발급됩니다.
   - scope: `products:read`(상품/카테고리 조회), `orders:read`(발주 조회), `orders:write`(발주 생성)
3. 호출 한도: 기본 분당 60회 (초과 시 `429`, 백오프 후 재시도)
4. 키 유출 시: 어드민에서 해당 클라이언트 비활성화 후 재발급

## 2. 토큰 발급

```bash
curl -X POST https://goodshop.hublink.im/api/v1/oauth/token \
  -H "Authorization: Basic $(echo -n '{clientId}:{clientSecret}' | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials"
# → { "access_token": "...", "token_type": "Bearer", "expires_in": 7200, "scopes": [...] }
```

이후 모든 요청 헤더: `Authorization: Bearer {access_token}`

## 3. 엔드포인트

| Method | Path | 설명 | scope |
|---|---|---|---|
| GET | `/api/v1/categories` | 카테고리 트리 (code/name/하위 포함) | products:read |
| GET | `/api/v1/products` | 상품 목록 — `limit`(≤100)/`offset`, `category`(코드, 대분류는 하위 포함 prefix 매칭), `updated_after`(ISO8601, 증분 동기화), `sort=latest\|best_7d\|trending` | products:read |
| GET | `/api/v1/products/{id}` | 상품 상세 (공급가, 옵션/variant, 이미지, 배송정책, sourceStatus) | products:read |
| GET | `/api/v1/products/{id}/status` | 품절/가격 경량 폴링 | products:read |
| POST | `/api/v1/orders` | 발주 생성 (variantId, qty, 수령자 정보) | orders:write |
| GET | `/api/v1/orders` · `/api/v1/orders/{id}` | 발주 목록/상세 (배송상태·송장) | orders:read |

### 카테고리 안내 (V2 신규)

- 카테고리는 굿푸드몰 운영자가 어드민 **상품 → 카테고리 관리**에서 등록/숨김/변경하며, 상품목록의 **카테고리 변경** 버튼으로 상품에 일괄 적용됩니다.
- `GET /api/v1/categories` 응답의 `code`를 상품 조회 필터(`?category=CODE`)에 사용하세요. 대분류 코드는 하위(예: `SEA` → `SEA_FISH` 포함)까지 매칭됩니다.
- 숨김(isActive=false) 카테고리의 상품은 노출 정책에 따라 제외될 수 있습니다.

### 사용 예시

```bash
# 베스트 상품 50개
curl -H "Authorization: Bearer $TOKEN" \
  "https://goodshop.hublink.im/api/v1/products?sort=best_7d&limit=50"

# 특정 카테고리 + 증분 동기화
curl -H "Authorization: Bearer $TOKEN" \
  "https://goodshop.hublink.im/api/v1/products?category=SEA&updated_after=2026-06-12T00:00:00Z"

# 발주 생성
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"variantId":123,"qty":2}],"receiver":{"name":"홍길동","phone":"010-0000-0000","address":"..."}}' \
  https://goodshop.hublink.im/api/v1/orders
```

## 4. 연동 권장 패턴 (외부 쇼핑몰)

1. **초기 적재**: `GET /categories`로 카테고리 매핑 구성 → `GET /products` offset 페이징으로 전체 수집 → 내 쇼핑몰 등록 (판매가 = 공급가 + 마진)
2. **정기 동기화**: 10~30분 주기 `updated_after` 증분 호출 → 가격/품절(`sourceStatus=SOLDOUT`) 반영
3. **주문 전달**: 내 쇼핑몰 주문 발생 시 `POST /orders` 발주 → `GET /orders/{id}` 폴링으로 배송상태/송장 수신
4. 토큰은 만료(2h) 전 재발급, `429`/`5xx`는 지수 백오프

## 5. 운영 메모

- 호출 로그: 어드민 → 오픈 API → 호출 로그
- 시스템 구성: 쇼핑몰/API = Vercel(goodshop.hublink.im), 어드민 = EC2(goodshop-admin.hublink.im), DB = Supabase PostgreSQL(goodfood 스키마)
- 문의: skkim3925@gmail.com
