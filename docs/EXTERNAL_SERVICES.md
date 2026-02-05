# 외부 서비스 연동 가이드

> **최종 업데이트:** 2026-02
> **대상:** 신규 개발자, 운영 담당자

---

## 개요

BandAuto는 다음 외부 서비스와 연동됩니다:

| 서비스 | 용도 | 앱 |
|--------|------|-----|
| Band API | 상품 수집, 밴드 발행 | Sourcing |
| Google Gemini | AI 상품 설명 생성 | Sourcing |
| 토스페이먼츠 | 결제 처리 | Shop |

---

## 1. Band API

### 1.1 서비스 설명

Band API를 통해:
- 도매 밴드에서 상품 게시글 수집
- 소매 밴드로 가공된 상품 발행
- 사용자 프로필 조회

### 1.2 앱 등록

1. [Band 개발자 센터](https://developers.band.us/) 접속
2. 로그인 후 **앱 만들기** 클릭
3. 앱 정보 입력:
   - **앱 이름**: BandAuto (또는 원하는 이름)
   - **앱 설명**: 상품 소싱 자동화
   - **Redirect URI**: `https://your-domain.com/api/auth/band/callback`
     - 로컬 개발: `http://localhost:3001/api/auth/band/callback`
4. 생성 후 **Client ID**와 **Client Secret** 확인

### 1.3 환경변수 설정

```env
# sourcing-app/.env
BAND_CLIENT_ID=your_client_id
BAND_CLIENT_SECRET=your_client_secret
```

### 1.4 OAuth 연동 흐름

```
[사용자] → [Sourcing App] → [Band 인증 페이지] → [콜백] → [Access Token 저장]
```

1. 사용자가 Sourcing App의 **설정 > API 설정**에서 "Band 연동" 클릭
2. Band 로그인 페이지로 리다이렉트
3. 사용자가 권한 승인
4. 콜백 URL로 인증 코드 전달
5. 인증 코드를 Access Token으로 교환
6. DB에 Access Token 저장

### 1.5 연동 테스트

1. Sourcing App 접속 (`http://localhost:3001`)
2. **설정 > API 설정** 이동
3. **Band 연동** 버튼 클릭
4. Band 계정으로 로그인 및 권한 승인
5. "Band 연동이 완료되었습니다" 메시지 확인

### 1.6 주의사항

- Access Token은 **사용자별**로 저장됨
- Token 만료 시 재연동 필요
- Redirect URI는 Band 개발자 센터에 등록된 것과 **정확히 일치**해야 함

---

## 2. Google Gemini API

### 2.1 서비스 설명

Gemini API를 통해:
- 수집된 상품 설명을 소매용으로 변환
- 상품명, 상세 설명, 태그 자동 생성

### 2.2 API 키 발급

1. [Google AI Studio](https://aistudio.google.com/) 접속
2. Google 계정으로 로그인
3. 좌측 메뉴에서 **Get API Key** 클릭
4. **Create API Key** 클릭
5. 프로젝트 선택 (없으면 새로 생성)
6. 생성된 API Key 복사

### 2.3 환경변수 설정

```env
# sourcing-app/.env
GEMINI_API_KEY=your_gemini_api_key
```

### 2.4 앱 내 설정

환경변수 외에도 앱 내에서 API 키를 설정할 수 있습니다:

1. Sourcing App 접속
2. **설정 > AI 설정** 이동
3. Provider를 **Gemini** 선택
4. API Key 입력
5. **연결 테스트** 클릭
6. "연결 성공" 확인 후 저장

### 2.5 사용 모델

| 모델 | 용도 | 특징 |
|------|------|------|
| gemini-1.5-flash | 기본 (권장) | 빠른 응답, 저렴 |
| gemini-1.5-pro | 고품질 | 더 정교한 변환, 비용 높음 |

### 2.6 연동 테스트

```bash
# API 키 테스트 (curl)
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

또는 앱 내 **설정 > AI 설정 > 연결 테스트** 사용

### 2.7 주의사항

- API 사용량에 따라 비용 발생 (무료 티어 있음)
- Rate Limit 주의 (분당 요청 수 제한)
- API Key 노출 주의 (환경변수로 관리)

---

## 3. 토스페이먼츠

### 3.1 서비스 설명

토스페이먼츠를 통해:
- 카드 결제
- 가상계좌 발급
- 결제 취소/환불
- 웹훅 알림 (입금 확인 등)

### 3.2 가맹점 등록

1. [토스페이먼츠 개발자센터](https://developers.tosspayments.com/) 접속
2. 회원가입 및 로그인
3. **내 개발정보**에서 테스트 키 확인:
   - **클라이언트 키** (test_ck_...)
   - **시크릿 키** (test_sk_...)

### 3.3 환경변수 설정

```env
# shop-app/.env.local
TOSS_PAYMENTS_CLIENT_KEY=test_ck_xxxxxxxxxxxx
TOSS_PAYMENTS_SECRET_KEY=test_sk_xxxxxxxxxxxx
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxxxxxxxxxxx

# 웹훅 사용 시 (선택)
TOSS_PAYMENTS_WEBHOOK_SECRET=your_webhook_secret
```

### 3.4 테스트 vs 운영

| 구분 | 키 접두사 | 용도 |
|------|----------|------|
| 테스트 | `test_ck_`, `test_sk_` | 개발/테스트 환경 |
| 운영 | `live_ck_`, `live_sk_` | 실제 결제 |

**주의:** 운영 키는 실제 결제가 발생하므로 신중하게 사용

### 3.5 결제 흐름

```
[고객] → [결제 요청] → [토스 결제창] → [결제 완료] → [승인 API] → [주문 완료]
```

1. 고객이 주문서에서 결제 버튼 클릭
2. 토스페이먼츠 결제창 표시
3. 고객이 결제 수단 선택 및 결제
4. 성공 시 `/payment/success`로 리다이렉트
5. 서버에서 결제 승인 API 호출
6. 주문 상태 업데이트

### 3.6 웹훅 설정 (가상계좌)

가상계좌 입금 확인을 위해 웹훅 설정 필요:

1. 토스페이먼츠 개발자센터 접속
2. **웹훅** 메뉴 이동
3. **웹훅 등록**:
   - URL: `https://your-shop-domain.com/api/payments/webhook`
   - 이벤트: `PAYMENT_STATUS_CHANGED`
4. 웹훅 시크릿 키를 환경변수에 설정

### 3.7 연동 테스트

1. Shop App 접속 (`http://localhost:3000`)
2. 상품 장바구니에 담기
3. 주문서 작성
4. 결제 진행 (테스트 모드)
5. 테스트 카드 정보:
   - 카드번호: `4330000000000000` (어떤 번호든 가능)
   - 유효기간: 미래 날짜
   - CVC: 아무 숫자 3자리
   - 비밀번호: 아무 숫자 2자리

### 3.8 주의사항

- 테스트 키로는 실제 결제 불가
- 운영 전환 시 반드시 키 변경
- 시크릿 키는 **절대** 클라이언트에 노출 금지
- `NEXT_PUBLIC_` 접두사는 클라이언트 키에만 사용

---

## 4. 환경변수 요약

### Shop App (`shop-app/.env.local`)

```env
# 토스페이먼츠
TOSS_PAYMENTS_CLIENT_KEY=test_ck_xxxx
TOSS_PAYMENTS_SECRET_KEY=test_sk_xxxx
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxxx
TOSS_PAYMENTS_WEBHOOK_SECRET=xxxx  # 선택

# 인증
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
JWT_SECRET=your-jwt-secret
GUEST_TOKEN_SECRET=your-guest-secret
```

### Sourcing App (`sourcing-app/.env`)

```env
# Band API
BAND_CLIENT_ID=your_client_id
BAND_CLIENT_SECRET=your_client_secret

# Gemini API
GEMINI_API_KEY=your_gemini_key

# 인증
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret
JWT_SECRET=your-jwt-secret
```

---

## 5. 트러블슈팅

### Band API

| 증상 | 원인 | 해결 |
|------|------|------|
| "redirect_uri mismatch" | Redirect URI 불일치 | Band 개발자센터에서 URI 확인 |
| "invalid_client" | Client ID/Secret 오류 | 환경변수 확인 |
| Token 만료 | Access Token 유효기간 초과 | 재연동 필요 |

### Gemini API

| 증상 | 원인 | 해결 |
|------|------|------|
| "API key not valid" | 잘못된 API 키 | Google AI Studio에서 재발급 |
| Rate limit exceeded | 요청 한도 초과 | 잠시 대기 후 재시도 |
| 응답 없음 | 네트워크 문제 | VPN/방화벽 확인 |

### 토스페이먼츠

| 증상 | 원인 | 해결 |
|------|------|------|
| "잘못된 요청입니다" | 키 불일치 | 클라이언트/시크릿 키 확인 |
| 결제창 안 뜸 | 클라이언트 키 누락 | `NEXT_PUBLIC_` 환경변수 확인 |
| 승인 실패 | 시크릿 키 오류 | 서버 환경변수 확인 |

---

## 6. 보안 체크리스트

- [ ] API 키가 코드에 하드코딩되어 있지 않음
- [ ] `.env` 파일이 `.gitignore`에 포함됨
- [ ] 시크릿 키가 클라이언트에 노출되지 않음
- [ ] 운영 환경에서 테스트 키가 아닌 운영 키 사용
- [ ] 웹훅 엔드포인트에 시크릿 검증 적용
