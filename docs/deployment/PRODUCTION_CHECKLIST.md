# 🚀 프로덕션 배포 체크리스트

## ⚠️ 필수 변경 사항

### 1. 환경변수 (.env.local)
- [ ] `NEXTAUTH_SECRET` 강력한 랜덤 키로 변경
- [ ] `NEXTAUTH_URL` 실제 도메인으로 변경 (https://)
- [ ] `DATABASE_URL` PostgreSQL로 변경 권장
- [ ] `GOOGLE_AI_API_KEY` 실제 Gemini API 키로 변경
- [ ] `BAND_ACCESS_TOKEN` 실제 Band API 토큰으로 변경
- [ ] `BAND_CLIENT_ID`, `BAND_CLIENT_SECRET` 실제 값으로 변경

### 2. 토스페이먼츠 API 키
- [ ] `TOSS_PAYMENTS_CLIENT_KEY` 운영용 키로 변경 (test_ → live_)
- [ ] `TOSS_PAYMENTS_SECRET_KEY` 운영용 키로 변경 (test_ → live_)
- [ ] `TOSS_PAYMENTS_WEBHOOK_SECRET` 실제 웹훅 시크릿으로 변경

### 3. URL 설정
- [ ] `PAYMENT_SUCCESS_URL` 실제 도메인으로 변경
- [ ] `PAYMENT_FAIL_URL` 실제 도메인으로 변경
- [ ] `NEXT_PUBLIC_SITE_URL` 실제 도메인으로 변경
- [ ] `TOSS_PAYMENTS_ORIGIN_URL` 실제 도메인으로 변경

### 4. 쇼핑몰 정보
- [ ] `SHOP_NAME` 실제 쇼핑몰 이름으로 변경
- [ ] `SHOP_BUSINESS_NUMBER` 실제 사업자등록번호로 변경
- [ ] `SHOP_ADMIN_EMAIL` 실제 관리자 이메일로 변경
- [ ] `SHOP_CUSTOMER_SERVICE` 실제 고객센터 번호로 변경

### 5. 선택사항 (필요시 설정)
- [ ] `SMTP_USER`, `SMTP_PASS` 실제 이메일 서버 설정
- [ ] `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` AWS S3 설정
- [ ] `SMS_API_KEY`, `SMS_SENDER` SMS 서비스 설정
- [ ] `KAKAO_ALIMTALK_KEY` 카카오 알림톡 설정

## 🔐 보안 체크리스트

### NextAuth Secret 생성 방법
```bash
# 강력한 랜덤 키 생성
openssl rand -base64 32
```

### 토스페이먼츠 API 키 확인
- 테스트 키: `test_ck_`, `test_sk_`로 시작
- 운영 키: `live_ck_`, `live_sk_`로 시작
- ⚠️ 반드시 운영 키로 변경 필요

## 📊 데이터베이스 마이그레이션

### SQLite → PostgreSQL 권장
현재 SQLite 사용 중이지만 프로덕션에서는 PostgreSQL 권장:

```sql
-- PostgreSQL 설정 예시
DATABASE_URL="postgresql://username:password@localhost:5432/bandauto"
```

## 🌐 도메인 설정

모든 localhost를 실제 도메인으로 변경:
- `http://localhost:3000` → `https://yourdomain.com`

## 📝 현재 설정된 민감한 정보

⚠️ **다음 정보들은 실제 값으로 변경이 필요합니다:**

1. **Band API**: 현재 개발용 토큰 사용 중
2. **Gemini API**: 실제 API 키 필요
3. **NextAuth Secret**: 기본값 사용 중
4. **토스페이먼츠**: 테스트 키 → 운영 키 변경 필요

## ✅ 배포 전 최종 확인

- [ ] 모든 API 키가 실제 값으로 설정됨
- [ ] https:// URL로 모두 변경됨
- [ ] 프로덕션 빌드 테스트 완료
- [ ] 데이터베이스 백업 완료
- [ ] 도메인 및 SSL 인증서 준비
- [ ] 서버 환경 준비 완료

---

**중요:** 이 체크리스트의 모든 항목을 완료한 후 배포를 진행하세요.