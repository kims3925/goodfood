# Sourcing App 배포 규칙

> **관련 문서:** [SECURITY.md](./SECURITY.md) | [PROJECT.md](./PROJECT.md) | [CLAUDE.md](../CLAUDE.md)
> **전체 배포 가이드:** [../../docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)

---

## 인프라 구성

| 항목 | 기술 |
|-----|-----|
| Container | Docker (Playwright 이미지) |
| Orchestration | Docker Compose |
| Database | MariaDB 10.11 (Docker) |
| Cache | Redis 7 (Docker) |
| Browser Automation | Playwright 1.58.1 |

---

## Docker 설정

### Dockerfile 위치

```
docker/Dockerfile.sourcing
```

### 빌드 스테이지

| 스테이지 | 베이스 이미지 | 역할 |
|----------|---------------|------|
| deps | node:20-bookworm | pnpm 의존성 설치 |
| builder | node:20-bookworm | Prisma 생성 + Next.js standalone 빌드 |
| runner | playwright:v1.58.1-noble | Playwright 브라우저 포함 실행 환경 |

### 빌드 특징

- **Playwright 이미지**: Chromium 브라우저 내장
- **bookworm 베이스**: Playwright 호환성을 위해 Alpine 대신 Debian 사용
- **root 실행**: 볼륨 마운트 접근 권한을 위해 root 사용자로 실행

---

## 환경 전략

| 환경 | 용도 | URL |
|-----|-----|-----|
| Development | 로컬 개발 | localhost:3001 |
| Production | 운영 | https://admin.yourdomain.com |

---

## 배포 명령어

### 개별 앱 배포

```bash
# sourcing-app만 재빌드 및 재시작
docker-compose up -d --build sourcing-app
```

### 로그 확인

```bash
docker-compose logs -f sourcing-app --tail=100
```

### 컨테이너 접속

```bash
docker-compose exec sourcing-app bash
```

---

## 환경 변수

### 필수 환경 변수 (`sourcing-app/.env`)

| 변수 | 설명 |
|-----|-----|
| DATABASE_URL | MariaDB 연결 문자열 |
| REDIS_URL | Redis 연결 URL |
| NEXTAUTH_SECRET | NextAuth 암호화 키 |
| NEXTAUTH_URL | 인증 URL |
| BAND_CLIENT_ID | Band API 클라이언트 ID |
| BAND_CLIENT_SECRET | Band API 시크릿 |
| GEMINI_API_KEY | Google Gemini API 키 |

### Docker Compose 환경 변수

docker-compose.yml에서 자동 주입:
- `DATABASE_URL`: mariadb 서비스 연결
- `REDIS_URL`: redis 서비스 연결
- 이미지 저장 경로 (`*_IMAGE_STORAGE_PATH`)

---

## Playwright 관련

### 브라우저 자동화 환경

Playwright 이미지에 Chromium이 내장되어 있어 별도 설치 불필요.

```bash
# 컨테이너 내 브라우저 확인
docker-compose exec sourcing-app npx playwright --version
```

### 헤드리스 모드

프로덕션 환경에서는 항상 헤드리스 모드로 실행:
- `PLAYWRIGHT_HEADLESS=true` (기본값)

---

## 빌드 명령어

### 로컬 빌드 테스트

```bash
# 루트에서 실행
npm run build:sourcing
```

### Docker 빌드

```bash
# 전체 빌드
docker-compose build sourcing-app

# 캐시 없이 빌드
docker-compose build --no-cache sourcing-app
```

---

## 헬스 체크

```bash
# 컨테이너 상태
docker-compose ps sourcing-app

# HTTP 응답 확인
curl -I http://localhost:3001

# 로그 확인
docker-compose logs sourcing-app --tail=50
```

---

## 롤백 절차

### 이전 버전으로 롤백

```bash
# 1. 이전 커밋으로 복구
git reset --hard HEAD~1

# 2. 재빌드 및 배포
docker-compose up -d --build sourcing-app
```

---

## 배포 전 체크리스트

- [ ] 로컬 빌드 성공 (`npm run build:sourcing`)
- [ ] 환경 변수 확인 (`.env`)
- [ ] DB 스키마 변경 여부 확인
- [ ] Band API 연동 변경 시 테스트

---

## 배포 후 체크리스트

- [ ] `docker-compose ps sourcing-app` 상태 확인
- [ ] HTTP 접근 확인 (http://localhost:3001)
- [ ] 로그 에러 확인
- [ ] 주요 기능 테스트:
  - [ ] 로그인
  - [ ] 채널 목록
  - [ ] 상품 수집 (Playwright)
  - [ ] AI 가공 (Gemini)
  - [ ] 발행

---

## 모니터링

### 로그 확인

```bash
# 실시간 로그
docker-compose logs -f sourcing-app

# 최근 에러만
docker-compose logs sourcing-app 2>&1 | grep -i error

# Playwright 관련 로그
docker-compose logs sourcing-app 2>&1 | grep -i playwright
```

### 리소스 확인

```bash
# 컨테이너 리소스 사용량 (Playwright는 메모리 사용량이 높을 수 있음)
docker stats bandauto-sourcing
```

---

## 트러블슈팅

### Playwright 관련

| 증상 | 원인 | 해결 |
|------|------|------|
| 브라우저 시작 실패 | 메모리 부족 | 컨테이너 메모리 증가 |
| 타임아웃 | 네트워크 지연 | 타임아웃 값 조정 |
| 스크린샷 저장 실패 | 볼륨 권한 | 볼륨 마운트 권한 확인 |

### 일반 이슈

| 증상 | 원인 | 해결 |
|------|------|------|
| 컨테이너 재시작 반복 | DB 연결 실패 | mariadb 헬스체크 확인 |
| 이미지 빌드 느림 | Playwright 이미지 용량 | 캐시 활용 |

---

## 금지사항

| 금지 | 이유 |
|-----|-----|
| 운영 DB 직접 수정 | 데이터 무결성 |
| .env 파일 커밋 | 보안 |
| 테스트 없이 배포 | 장애 위험 |
| Band API 키 하드코딩 | 보안 위험 |
| Playwright 브라우저 수동 설치 | 이미지에 내장됨 |
