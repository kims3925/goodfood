# BandAuto 배포 가이드

> **현재 배포 방식:** Docker Compose
> **최종 업데이트:** 2026-02

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                   Docker Compose 환경                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  shop-app   │  │sourcing-app │  │   mariadb   │        │
│  │   :3000     │  │   :3001     │  │   :3306     │        │
│  │  (alpine)   │  │ (playwright)│  │  (10.11)    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐                                           │
│  │    redis    │       볼륨: /home/ubuntu/assets           │
│  │   :6379     │                                           │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 서비스 구성

| 서비스 | 이미지 | 포트 | 설명 |
|--------|--------|------|------|
| shop-app | bandauto-shop:latest | 3000 | 고객용 쇼핑몰 |
| sourcing-app | bandauto-sourcing:latest | 3001 | 관리자 대시보드 (Playwright 포함) |
| mariadb | mariadb:10.11 | 3306 | 메인 데이터베이스 |
| redis | redis:7-alpine | 6379 | 캐시 및 큐 |

---

## Dockerfile 구조

### Shop App (`docker/Dockerfile.shop`)

| 스테이지 | 베이스 이미지 | 역할 |
|----------|---------------|------|
| deps | node:20-alpine | pnpm 의존성 설치 |
| builder | node:20-alpine | Prisma 생성 + Next.js 빌드 |
| runner | node:20-alpine | 프로덕션 실행 (standalone) |

### Sourcing App (`docker/Dockerfile.sourcing`)

| 스테이지 | 베이스 이미지 | 역할 |
|----------|---------------|------|
| deps | node:20-bookworm | pnpm 의존성 설치 |
| builder | node:20-bookworm | Prisma 생성 + Next.js 빌드 |
| runner | playwright:v1.58.1-noble | Playwright 포함 실행 환경 |

---

## 배포 명령어

### 전체 배포

```bash
# 이미지 빌드 및 컨테이너 시작
docker-compose up -d --build

# 로그 확인
docker-compose logs -f
```

### 특정 앱만 재배포

```bash
# shop-app만 재빌드 및 재시작
docker-compose up -d --build shop-app

# sourcing-app만 재빌드 및 재시작
docker-compose up -d --build sourcing-app
```

### 컨테이너 관리

```bash
# 상태 확인
docker-compose ps

# 로그 확인 (특정 서비스)
docker-compose logs -f shop-app
docker-compose logs -f sourcing-app

# 컨테이너 중지
docker-compose stop

# 컨테이너 삭제 (볼륨 유지)
docker-compose down

# 컨테이너 + 볼륨 삭제 (주의: DB 데이터 삭제됨)
docker-compose down -v
```

---

## 환경 변수

### 루트 `.env` (Docker Compose용)

```env
# Database
DB_ROOT_PASSWORD=<root-password>
DB_NAME=sourcing_db
DB_USER=banduser
DB_PASSWORD=<db-password>
```

### Shop App (`shop-app/.env.local`)

```env
DATABASE_URL=mysql://banduser:<password>@mariadb:3306/sourcing_db
REDIS_URL=redis://redis:6379
NEXTAUTH_URL=https://shop.yourdomain.com
NEXTAUTH_SECRET=<secret>
JWT_SECRET=<secret>
GUEST_TOKEN_SECRET=<secret>
TOSS_CLIENT_KEY=<key>
TOSS_SECRET_KEY=<key>
```

### Sourcing App (`sourcing-app/.env`)

```env
DATABASE_URL=mysql://banduser:<password>@mariadb:3306/sourcing_db
REDIS_URL=redis://redis:6379
NEXTAUTH_URL=https://admin.yourdomain.com
NEXTAUTH_SECRET=<secret>
BAND_CLIENT_ID=<id>
BAND_CLIENT_SECRET=<secret>
GEMINI_API_KEY=<key>
```

---

## 볼륨 마운트

| 호스트 경로 | 컨테이너 경로 | 용도 |
|-------------|---------------|------|
| /home/ubuntu/assets | /home/ubuntu/assets | 상품/포스트/채널 이미지 |
| mariadb_data (named) | /var/lib/mysql | DB 데이터 |
| redis_data (named) | /data | Redis 데이터 |

---

## 배포 프로세스

### 1. 코드 업데이트 후 배포

```bash
# 1. 코드 풀
cd ~/bandauto
git pull origin main

# 2. 이미지 재빌드 및 배포
docker-compose up -d --build
```

### 2. DB 스키마 변경 시

```bash
# 컨테이너 내부에서 Prisma 마이그레이션 실행
docker-compose exec shop-app sh -c "cd /app/db && npx prisma db push --schema prisma"
```

### 3. 환경 변수 변경 시

```bash
# .env 파일 수정 후 컨테이너 재시작
docker-compose up -d
```

---

## 헬스 체크

### 서비스 상태 확인

```bash
# 컨테이너 상태
docker-compose ps

# 헬스체크 상태
docker inspect --format='{{.State.Health.Status}}' bandauto-mariadb
docker inspect --format='{{.State.Health.Status}}' bandauto-redis
```

### 앱 접근 확인

```bash
# shop-app
curl -I http://localhost:3000

# sourcing-app
curl -I http://localhost:3001
```

### 로그 확인

```bash
# 전체 로그
docker-compose logs -f --tail=100

# 특정 서비스 로그
docker-compose logs -f shop-app --tail=50
docker-compose logs -f sourcing-app --tail=50
```

---

## 롤백 절차

### 이전 이미지로 롤백

```bash
# 1. 현재 이미지 태그 확인
docker images | grep bandauto

# 2. 이전 커밋으로 복구
git reset --hard HEAD~1

# 3. 재빌드 및 배포
docker-compose up -d --build
```

### 긴급 롤백 (이미지 캐시 사용)

```bash
# 빌드 없이 기존 이미지로 재시작
docker-compose up -d
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 컨테이너 시작 실패 | DB 연결 대기 | healthcheck 확인, 재시작 |
| 502 Bad Gateway | 앱 미실행 | `docker-compose logs` 확인 |
| 이미지 용량 부족 | 빌드 캐시 누적 | `docker system prune -a` |
| 볼륨 권한 오류 | 호스트/컨테이너 UID 불일치 | Dockerfile에서 USER 확인 |

### 디버깅 명령어

```bash
# 컨테이너 내부 접속
docker-compose exec shop-app sh
docker-compose exec sourcing-app bash

# 실시간 리소스 사용량
docker stats

# 이미지 빌드 로그 상세
docker-compose build --no-cache --progress=plain shop-app
```

---

## 배포 체크리스트

### 배포 전

- [ ] 로컬에서 빌드 테스트 (`npm run build:all`)
- [ ] 환경 변수 확인 (`.env` 파일들)
- [ ] DB 스키마 변경 여부 확인
- [ ] 롤백 계획 수립

### 배포 후

- [ ] `docker-compose ps` 상태 확인
- [ ] 각 앱 HTTP 접근 확인
- [ ] `docker-compose logs` 에러 확인
- [ ] 주요 기능 스모크 테스트

---

## 금지사항

| 금지 | 이유 |
|------|------|
| `docker-compose down -v` 운영 환경 실행 | DB 데이터 삭제됨 |
| 환경 변수 하드코딩 | 보안 위험 |
| 운영 DB 직접 수정 | 데이터 무결성 |
| 테스트 없이 배포 | 장애 위험 |
