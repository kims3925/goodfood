# 트러블슈팅 가이드

> **최종 업데이트:** 2026-02
> **대상:** 개발자, 운영 담당자

---

## 1. Prisma / 데이터베이스

### 1.1 `Unknown option '--schema'`

**증상:**
```
Unknown option '--schema'. Did you mean '--help'?
```

**원인:** db 폴더가 아닌 곳에서 Prisma 명령어 실행

**해결:**
```bash
cd db
npx prisma generate --schema prisma
```

---

### 1.2 DB 연결 실패

**증상:**
```
Can't reach database server at `localhost:3306`
```

**원인:** MariaDB 컨테이너가 실행 중이지 않음

**해결:**
```bash
# 컨테이너 상태 확인
docker-compose ps

# DB 컨테이너 시작
docker-compose up -d mariadb redis

# 헬스체크 확인
docker inspect bandauto-mariadb --format='{{.State.Health.Status}}'
```

---

### 1.3 Prisma Client 타입 오류

**증상:**
```
Property 'user' does not exist on type 'PrismaClient'
```

**원인:** Prisma Client가 생성되지 않음

**해결:**
```bash
cd db
npx prisma generate --schema prisma
```

---

### 1.4 스키마 동기화 오류

**증상:**
```
The database schema is not in sync with your Prisma schema
```

**원인:** DB 스키마와 Prisma 스키마 불일치

**해결:**
```bash
cd db

# 개발 환경 (데이터 유지)
npx prisma db push --schema prisma

# 또는 스키마 확인
npx prisma validate --schema prisma
```

---

## 2. Docker / 배포

### 2.1 컨테이너 시작 실패

**증상:**
```
container exited with code 1
```

**원인:** DB 연결 대기 실패, 환경변수 누락

**해결:**
```bash
# 로그 확인
docker-compose logs shop-app
docker-compose logs sourcing-app

# DB 먼저 시작 후 앱 시작
docker-compose up -d mariadb redis
sleep 30
docker-compose up -d shop-app sourcing-app
```

---

### 2.2 볼륨 권한 오류

**증상:**
```
EACCES: permission denied, open '/home/ubuntu/assets/...'
```

**원인:** 호스트/컨테이너 간 파일 권한 불일치

**해결:**
```bash
# 호스트에서 권한 변경
sudo chown -R 1000:1000 /home/ubuntu/assets

# 또는 Docker Compose에서 user 지정 확인
```

---

### 2.3 이미지 빌드 실패 (메모리)

**증상:**
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

**원인:** 서버 메모리 부족

**해결:**
```bash
# 스왑 메모리 추가 (EC2)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 또는 빌드 시 메모리 제한 늘리기
NODE_OPTIONS="--max-old-space-size=4096" docker-compose build
```

---

### 2.4 디스크 용량 부족

**증상:**
```
no space left on device
```

**원인:** Docker 이미지/캐시 누적

**해결:**
```bash
# 사용하지 않는 이미지 삭제
docker image prune -a

# 전체 정리 (볼륨 제외)
docker system prune -a

# 빌드 캐시 삭제
docker builder prune
```

---

## 3. Band 연동

### 3.1 세션 만료

**증상:**
- 상품 수집 시 "로그인 필요" 오류
- Playwright 크롤링 실패

**원인:** Band 로그인 세션(쿠키) 만료

**해결:**
1. Chrome 브라우저에서 Band 로그인
2. Band Session Extension으로 쿠키 저장
3. Sourcing App에서 세션 갱신

---

### 3.2 OAuth Redirect URI 불일치

**증상:**
```
redirect_uri_mismatch
```

**원인:** Band 개발자센터에 등록된 URI와 실제 URI 불일치

**해결:**
1. [Band 개발자센터](https://developers.band.us/) 접속
2. 앱 설정에서 Redirect URI 확인
3. 환경변수 `NEXTAUTH_URL` 확인
4. URI가 정확히 일치하는지 확인:
   - 등록: `https://admin.example.com/api/auth/band/callback`
   - 실제: `https://admin.example.com/api/auth/band/callback` (동일해야 함)

---

### 3.3 상품 수집 타임아웃

**증상:**
```
TimeoutError: Navigation timeout of 30000 ms exceeded
```

**원인:** 네트워크 느림, Band 서버 응답 지연

**해결:**
```typescript
// 타임아웃 늘리기 (코드 수정 필요 시)
await page.goto(url, { timeout: 60000 })
```

또는 재시도

---

## 4. 개발 환경

### 4.1 포트 충돌

**증상:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**원인:** 이전 프로세스가 포트를 점유 중

**해결:**
```bash
# 포트 사용 프로세스 확인
lsof -i :3000
lsof -i :3001

# 프로세스 종료
kill -9 <PID>

# 또는 모든 Node 프로세스 종료
pkill -f node
```

---

### 4.2 환경변수 못 읽음

**증상:**
- `undefined` 값
- API 키 오류

**원인:** `.env` 파일 위치 오류 또는 변수명 오타

**해결:**
```bash
# 파일 위치 확인
ls -la shop-app/.env.local
ls -la sourcing-app/.env

# 변수 확인
cat sourcing-app/.env | grep GEMINI

# 서버 재시작 (환경변수 다시 로드)
npm run dev:sourcing
```

---

### 4.3 pnpm 의존성 오류

**증상:**
```
Cannot find module '...'
```

**원인:** 의존성 설치 안 됨 또는 불완전

**해결:**
```bash
# 의존성 재설치
rm -rf node_modules
rm -rf shop-app/node_modules
rm -rf sourcing-app/node_modules
pnpm install
```

---

### 4.4 TypeScript 타입 오류

**증상:**
```
Type error: Cannot find name 'xxx'
```

**원인:** 타입 정의 누락, Prisma Client 미생성

**해결:**
```bash
# Prisma 클라이언트 재생성
cd db && npx prisma generate --schema prisma && cd ..

# 타입 체크
pnpm run typecheck
```

---

## 5. 결제 (토스페이먼츠)

### 5.1 결제창이 안 뜸

**증상:** 결제 버튼 클릭해도 반응 없음

**원인:** 클라이언트 키 누락

**해결:**
```bash
# 환경변수 확인
cat shop-app/.env.local | grep NEXT_PUBLIC_TOSS

# NEXT_PUBLIC_ 접두사 필수
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxxx
```

---

### 5.2 결제 승인 실패

**증상:**
```
{ code: "UNAUTHORIZED", message: "잘못된 시크릿 키입니다" }
```

**원인:** 시크릿 키 오류

**해결:**
```bash
# 서버 환경변수 확인
cat shop-app/.env.local | grep TOSS_PAYMENTS_SECRET_KEY

# 키 형식 확인 (test_sk_ 또는 live_sk_)
```

---

### 5.3 가상계좌 입금 확인 안 됨

**증상:** 입금했는데 주문 상태 안 바뀜

**원인:** 웹훅 미설정 또는 웹훅 URL 오류

**해결:**
1. 토스페이먼츠 개발자센터에서 웹훅 URL 확인
2. URL이 외부에서 접근 가능한지 확인
3. 웹훅 시크릿 환경변수 확인

---

## 6. AI 변환 (Gemini)

### 6.1 API 키 오류

**증상:**
```
API key not valid. Please pass a valid API key.
```

**원인:** 잘못된 API 키

**해결:**
1. [Google AI Studio](https://aistudio.google.com/)에서 키 재발급
2. 환경변수 또는 앱 설정에서 키 업데이트

---

### 6.2 Rate Limit 초과

**증상:**
```
Resource has been exhausted (e.g. check quota).
```

**원인:** 분당 요청 수 초과

**해결:**
- 잠시 대기 후 재시도
- 요청 간격 늘리기
- 유료 플랜 업그레이드 고려

---

### 6.3 변환 결과 품질 낮음

**증상:** AI 변환 결과가 이상함

**원인:** 프롬프트 문제 또는 입력 데이터 품질

**해결:**
1. 원본 상품 데이터 확인
2. AI 설정에서 모델 변경 (flash → pro)
3. 프롬프트 템플릿 수정 검토

---

## 7. 빠른 진단 명령어

```bash
# 전체 상태 확인
docker-compose ps
pnpm run typecheck

# 로그 확인
docker-compose logs -f --tail=50 shop-app
docker-compose logs -f --tail=50 sourcing-app

# DB 연결 테스트
cd db && npx prisma studio --schema prisma

# 포트 확인
lsof -i :3000 -i :3001 -i :3306 -i :6379
```

---

## 8. 도움 요청

위 방법으로 해결되지 않는 경우:

1. 에러 메시지 전문 캡처
2. 재현 단계 정리
3. 환경 정보 (OS, Node 버전, Docker 버전)
4. 담당자에게 문의
