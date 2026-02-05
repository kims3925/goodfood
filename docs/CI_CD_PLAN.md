# BandAuto CI/CD 가이드 (Docker Compose)

> **최종 업데이트:** 2026-02
> **배포 방식:** Docker Compose

---

## 개요

| 항목 | 내용 |
|------|------|
| **프로젝트** | BandAuto Monorepo |
| **배포 대상** | AWS EC2 |
| **컨테이너** | Docker Compose |
| **적용 앱** | shop-app, sourcing-app |

---

## 1. 아키텍처

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│   GitHub    │────▶│   EC2 Server     │────▶│    Docker Compose       │
│   (Push)    │     │  (git pull)      │     │                         │
└─────────────┘     └──────────────────┘     │  ┌─────────────────┐   │
                                              │  │   shop-app      │   │
                                              │  │   :3000         │   │
                                              │  └─────────────────┘   │
                                              │  ┌─────────────────┐   │
                                              │  │  sourcing-app   │   │
                                              │  │   :3001         │   │
                                              │  └─────────────────┘   │
                                              │  ┌─────────────────┐   │
                                              │  │    mariadb      │   │
                                              │  │   :3306         │   │
                                              │  └─────────────────┘   │
                                              │  ┌─────────────────┐   │
                                              │  │     redis       │   │
                                              │  │   :6379         │   │
                                              │  └─────────────────┘   │
                                              └─────────────────────────┘
```

---

## 2. Docker 이미지 구성

### 2.1 Shop App (`docker/Dockerfile.shop`)

| 스테이지 | 베이스 이미지 | 역할 |
|----------|---------------|------|
| deps | node:20-alpine | pnpm 의존성 설치 |
| builder | node:20-alpine | Prisma 생성 + Next.js 빌드 |
| runner | node:20-alpine | standalone 실행 |

### 2.2 Sourcing App (`docker/Dockerfile.sourcing`)

| 스테이지 | 베이스 이미지 | 역할 |
|----------|---------------|------|
| deps | node:20-bookworm | pnpm 의존성 설치 |
| builder | node:20-bookworm | Prisma 생성 + Next.js 빌드 |
| runner | playwright:v1.58.1-noble | Playwright 포함 실행 |

---

## 3. 배포 프로세스

### 3.1 수동 배포 (현재 방식)

```bash
# 1. 서버 SSH 접속
ssh ubuntu@<EC2-IP>

# 2. 프로젝트 디렉토리 이동
cd ~/bandauto

# 3. 코드 풀
git pull origin main

# 4. 이미지 빌드 및 배포
docker-compose up -d --build

# 5. 상태 확인
docker-compose ps
docker-compose logs -f --tail=50
```

### 3.2 특정 앱만 배포

```bash
# shop-app만 재배포
docker-compose up -d --build shop-app

# sourcing-app만 재배포
docker-compose up -d --build sourcing-app
```

### 3.3 빌드 캐시 없이 배포 (문제 발생 시)

```bash
docker-compose build --no-cache
docker-compose up -d
```

---

## 4. 배포 스크립트

### 4.1 전체 배포 스크립트

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "=== Starting deployment ==="

cd ~/bandauto

echo ">>> Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo ">>> Building and deploying..."
docker-compose up -d --build

echo ">>> Waiting for services to start..."
sleep 10

echo ">>> Checking status..."
docker-compose ps

echo "=== Deployment completed! ==="
```

### 4.2 롤백 스크립트

```bash
#!/bin/bash
# scripts/rollback.sh

set -e

COMMIT=${1:-HEAD~1}

echo "=== Rolling back to $COMMIT ==="

cd ~/bandauto

echo ">>> Resetting to $COMMIT..."
git reset --hard $COMMIT

echo ">>> Rebuilding and deploying..."
docker-compose up -d --build

echo ">>> Checking status..."
docker-compose ps

echo "=== Rollback completed! ==="
```

---

## 5. 환경 변수 관리

### 5.1 파일 구조

```
bandauto/
├── .env                    # Docker Compose용 (DB 비밀번호 등)
├── db/.env                 # Prisma DATABASE_URL
├── shop-app/.env.local     # Shop 앱 환경 변수
└── sourcing-app/.env       # Sourcing 앱 환경 변수
```

### 5.2 배포 시 환경 변수 보호

```bash
# .env 파일들은 .gitignore에 포함되어 있음
# 서버에서 직접 관리

# 환경 변수 백업 (선택사항)
cp .env .env.backup
cp shop-app/.env.local shop-app/.env.local.backup
cp sourcing-app/.env sourcing-app/.env.backup
```

---

## 6. 헬스 체크

### 6.1 서비스 상태 확인

```bash
# 컨테이너 상태
docker-compose ps

# 상세 상태
docker inspect bandauto-shop --format='{{.State.Status}}'
docker inspect bandauto-sourcing --format='{{.State.Status}}'
```

### 6.2 헬스체크 상태

```bash
# MariaDB 헬스체크
docker inspect bandauto-mariadb --format='{{.State.Health.Status}}'

# Redis 헬스체크
docker inspect bandauto-redis --format='{{.State.Health.Status}}'
```

### 6.3 HTTP 응답 확인

```bash
# shop-app
curl -I http://localhost:3000

# sourcing-app
curl -I http://localhost:3001
```

---

## 7. 로그 관리

### 7.1 실시간 로그

```bash
# 전체 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f shop-app
docker-compose logs -f sourcing-app
docker-compose logs -f mariadb
```

### 7.2 최근 로그

```bash
# 최근 100줄
docker-compose logs --tail=100 shop-app

# 에러만 필터링
docker-compose logs shop-app 2>&1 | grep -i error
```

### 7.3 로그 파일 저장

```bash
# 로그를 파일로 저장
docker-compose logs shop-app > logs/shop-app-$(date +%Y%m%d).log
```

---

## 8. 트러블슈팅

### 8.1 일반 이슈

| 증상 | 원인 | 해결 |
|------|------|------|
| 컨테이너 시작 실패 | DB 연결 대기 | `docker-compose logs` 확인 |
| 502 Bad Gateway | 앱 미실행 | 컨테이너 상태 확인 |
| 빌드 실패 | 메모리 부족 | 스왑 메모리 추가 |
| 이미지 용량 부족 | 캐시 누적 | `docker system prune -a` |

### 8.2 컨테이너 재시작

```bash
# 특정 서비스 재시작
docker-compose restart shop-app

# 전체 재시작
docker-compose restart
```

### 8.3 컨테이너 내부 디버깅

```bash
# 컨테이너 내부 접속
docker-compose exec shop-app sh
docker-compose exec sourcing-app bash

# 프로세스 확인
docker-compose exec shop-app ps aux
```

### 8.4 이미지 정리

```bash
# 사용하지 않는 이미지 삭제
docker image prune -a

# 전체 정리 (볼륨 제외)
docker system prune -a

# 빌드 캐시 삭제
docker builder prune
```

---

## 9. 롤백 절차

### 9.1 이전 커밋으로 롤백

```bash
# 1. 이전 커밋 확인
git log --oneline -10

# 2. 롤백
git reset --hard <commit-hash>

# 3. 재배포
docker-compose up -d --build
```

### 9.2 긴급 롤백 (이미지 캐시 사용)

```bash
# 빌드 없이 기존 이미지로 재시작
docker-compose down
docker-compose up -d
```

---

## 10. 모니터링

### 10.1 리소스 사용량

```bash
# 실시간 리소스 모니터링
docker stats

# 특정 컨테이너만
docker stats bandauto-shop bandauto-sourcing
```

### 10.2 디스크 사용량

```bash
# Docker 디스크 사용량
docker system df

# 상세 정보
docker system df -v
```

---

## 11. 보안 고려사항

### 11.1 환경 변수 보호

- `.env` 파일 절대 Git에 커밋하지 않음
- 서버에서만 환경 변수 파일 관리
- 정기적으로 시크릿 키 로테이션

### 11.2 이미지 보안

- 공식 베이스 이미지 사용
- 최신 보안 패치 적용
- 불필요한 패키지 제거

### 11.3 네트워크 보안

- 내부 네트워크로 DB/Redis 격리
- 외부 노출 포트 최소화

---

## 12. 배포 체크리스트

### 배포 전

- [ ] 로컬에서 빌드 테스트 (`npm run build:all`)
- [ ] 환경 변수 확인
- [ ] DB 스키마 변경 여부 확인
- [ ] 롤백 계획 수립

### 배포 중

- [ ] `git pull origin main`
- [ ] `docker-compose up -d --build`
- [ ] `docker-compose ps` 상태 확인

### 배포 후

- [ ] HTTP 접근 확인
- [ ] 로그 에러 확인
- [ ] 주요 기능 테스트

---

## 13. 자동화 CI/CD (향후 계획)

### GitHub Actions 예시

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd ~/bandauto
            git pull origin main
            docker-compose up -d --build
```

### 필요 사항

- GitHub Secrets 설정:
  - `EC2_HOST`: EC2 IP 주소
  - `EC2_SSH_KEY`: SSH 프라이빗 키

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-02 | 2.0 | Docker Compose 기반으로 재작성 |
| 2025-12 | 1.0 | 최초 작성 (Jenkins) |
