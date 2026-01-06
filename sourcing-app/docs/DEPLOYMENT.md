# 배포 규칙

> **관련 문서:** [SECURITY.md](./SECURITY.md) | [PROJECT.md](./PROJECT.md) | [CLAUDE.md](../CLAUDE.md)

---

## 인프라 구성

| 항목 | 기술 |
|-----|-----|
| Cloud | AWS EC2 |
| Database | MySQL 8.0 (AWS RDS) |
| Cache | Redis (Bull Queue) |
| Process Manager | PM2 |
| Reverse Proxy | Nginx |
| CI/CD | Jenkins |

---

## 환경 전략

| 환경 | 용도 | URL | 브랜치 |
|-----|-----|-----|-------|
| Development | 로컬 개발 | localhost:3000, 3001 | feature/* |
| Production | 운영 | https://snsauto.abcpharm.net | main |

---

## CI/CD 파이프라인

### CI Pipeline (ci-Jenkinsfile)

```text
Push → Install → Prisma Generate → Build (parallel) → Success
```

### CD Pipeline (cd-Jenkinsfile)

```text
Checkout → Install → Prisma Generate → Build → Deploy
```

### 상세 단계

| 단계 | 설명 | 실패 시 |
|-----|-----|--------|
| Checkout | 소스 코드 가져오기 | 차단 |
| Install Dependencies | `npm ci --legacy-peer-deps` | 차단 |
| Generate Prisma Client | `npx prisma generate --schema prisma` | 차단 |
| Build Applications | shop-app, sourcing-app 병렬 빌드 | 차단 |
| Deploy | PM2 재시작 | 롤백 |

---

## 배포 프로세스

### 1. .env 파일 보호

```bash
# 배포 전 .env 백업
cp .env /tmp/.env.backup
cp db/.env /tmp/.env.db.backup
cp shop-app/.env /tmp/.env.shop.backup
cp sourcing-app/.env /tmp/.env.sourcing.backup

# git reset 후 복원
git reset --hard origin/main
cp /tmp/.env.backup .env
# ... (각 앱별 복원)
```

### 2. 의존성 관리

```bash
# package-lock.json 변경 시 재설치
if [ "$OLD_CHECKSUM" != "$NEW_CHECKSUM" ]; then
    rm -rf node_modules
    npm ci --legacy-peer-deps
fi
```

### 3. PM2 프로세스 관리

```bash
# 빌드 전 프로세스 중지 (파일 잠금 해제)
sudo -u ubuntu pm2 stop shop-app sourcing-app shop sourcing

# 프로세스 중지 확인 (최대 10초 대기)
for i in 1 2 3 4 5; do
    if ! pm2 list | grep -E 'shop|sourcing' | grep -q 'online'; then
        break
    fi
    sleep 2
done

# 빌드 후 재시작
sudo -u ubuntu pm2 reload all --update-env
```

---

## PM2 설정

### 앱 구성

| 앱 | 포트 | PM2 이름 |
|---|-----|---------|
| shop-app | 3000 | shop 또는 shop-app |
| sourcing-app | 3001 | sourcing 또는 sourcing-app |

### PM2 명령어

```bash
# 상태 확인
pm2 status

# 로그 확인
pm2 logs shop
pm2 logs sourcing

# 재시작
pm2 restart shop sourcing

# 전체 재시작
pm2 reload all --update-env
```

---

## 환경 변수

### 필수 환경 변수

| 변수 | 설명 | 위치 |
|-----|-----|-----|
| DATABASE_URL | MySQL 연결 문자열 | db/.env |
| NEXTAUTH_SECRET | NextAuth 암호화 키 | shop-app, sourcing-app |
| NEXTAUTH_URL | 인증 URL | shop-app, sourcing-app |
| JWT_SECRET | JWT 서명 키 | shop-app |
| GUEST_TOKEN_SECRET | 게스트 토큰 키 | shop-app |
| TOSS_SECRET_KEY | Toss 결제 키 | shop-app |
| BAND_CLIENT_ID | Band API 클라이언트 ID | sourcing-app |
| BAND_CLIENT_SECRET | Band API 시크릿 | sourcing-app |

### Jenkins Credentials

| Credential ID | 설명 |
|--------------|-----|
| nextauth-secret | NEXTAUTH_SECRET |
| guest-secret | GUEST_TOKEN_SECRET |
| jwt-secret | JWT_SECRET |

---

## 빌드 명령어

```bash
# 전체 빌드
npm run build

# 개별 앱 빌드
npm run build:shop      # shop-app 빌드
npm run build:sourcing  # sourcing-app 빌드
```

### 빌드 실패 시 재시도

```bash
npm run build:shop || {
    rm -rf shop-app/.next
    npm run build:shop
}
```

---

## 헬스 체크

| 체크 항목 | 방법 |
|---------|-----|
| 앱 실행 | PM2 status 확인 |
| 웹 접근 | HTTP 응답 확인 |
| DB 연결 | Prisma 연결 확인 |

---

## 롤백 절차

### 자동 롤백 조건

| 증상 | 조치 |
|-----|-----|
| 빌드 실패 | 이전 빌드 유지 |
| PM2 시작 실패 | 수동 개입 필요 |

### 수동 롤백

```bash
# 이전 커밋으로 롤백
git reset --hard HEAD~1
npm ci --legacy-peer-deps
cd db && npx prisma generate --schema prisma && cd ..
npm run build
pm2 reload all
```

---

## 배포 전 체크리스트

- [ ] 모든 테스트 통과 (`npm run build` 성공)
- [ ] 코드 리뷰 완료
- [ ] DB 마이그레이션 테스트
- [ ] 환경 변수 확인 (.env 파일)
- [ ] 롤백 계획 수립

---

## 배포 후 체크리스트

- [ ] PM2 상태 확인 (`pm2 status`)
- [ ] 웹사이트 접근 확인
- [ ] 로그 모니터링 (`pm2 logs`)
- [ ] 에러율 확인
- [ ] 주요 기능 스모크 테스트

---

## 모니터링

### 로그 확인

```bash
# PM2 로그
pm2 logs --lines 100

# 특정 앱 로그
pm2 logs shop --lines 50
pm2 logs sourcing --lines 50
```

### 리소스 확인

```bash
# PM2 모니터링
pm2 monit

# 시스템 리소스
htop
```

---

## 금지사항

| 금지 | 이유 |
|-----|-----|
| 운영 DB 직접 수정 | 데이터 무결성 |
| .env 파일 커밋 | 보안 |
| force push to main | 히스토리 손실 |
| 테스트 없이 배포 | 장애 위험 |
| PM2 stop all 사용 | 다른 서비스 영향 |
