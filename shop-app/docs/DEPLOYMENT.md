# Shop App 배포 규칙

> **관련 문서:** [SECURITY.md](./SECURITY.md) | [PROJECT.md](./PROJECT.md) | [../CLAUDE.md](../CLAUDE.md)
> **전체 배포 가이드:** [../../docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)

---

## 인프라 구성

| 항목 | 기술 |
|-----|-----|
| Container | Docker (node:20-alpine) |
| Orchestration | Docker Compose |
| Database | MariaDB 10.11 (Docker) |
| Cache | Redis 7 (Docker) |
| Reverse Proxy | Nginx (호스트) |

---

## Docker 설정

### Dockerfile 위치

```
docker/Dockerfile
```

### 빌드 스테이지

| 스테이지 | 베이스 이미지 | 역할 |
|----------|---------------|------|
| deps | node:20-alpine | pnpm 의존성 설치 |
| builder | node:20-alpine | Prisma 생성 + Next.js standalone 빌드 |
| runner | node:20-alpine | 프로덕션 실행 |

### 빌드 특징

- **Multi-stage 빌드**: 최종 이미지 경량화
- **pnpm workspace**: 모노레포 의존성 관리
- **standalone output**: Next.js 독립 실행 파일 생성

---

## 환경 전략

| 환경 | 용도 | URL |
|-----|-----|-----|
| Development | 로컬 개발 | localhost:3000 |
| Production | 운영 | https://shop.yourdomain.com |

---

## 배포 명령어

### 개별 앱 배포

```bash
# shop-app만 재빌드 및 재시작
docker-compose up -d --build shop-app
```

### 로그 확인

```bash
docker-compose logs -f shop-app --tail=100
```

### 컨테이너 접속

```bash
docker-compose exec shop-app sh
```

---

## 환경 변수

### 필수 환경 변수 (`shop-app/.env.local`)

| 변수 | 설명 |
|-----|-----|
| DATABASE_URL | MariaDB 연결 문자열 |
| REDIS_URL | Redis 연결 URL |
| NEXTAUTH_SECRET | NextAuth 암호화 키 |
| NEXTAUTH_URL | 인증 URL |
| JWT_SECRET | JWT 서명 키 |
| GUEST_TOKEN_SECRET | 게스트 토큰 키 |
| TOSS_CLIENT_KEY | Toss 결제 클라이언트 키 |
| TOSS_SECRET_KEY | Toss 결제 시크릿 키 |

### Docker Compose 환경 변수

docker-compose.yml에서 자동 주입:
- `DATABASE_URL`: mariadb 서비스 연결
- `REDIS_URL`: redis 서비스 연결
- 이미지 저장 경로 (`*_IMAGE_STORAGE_PATH`)

---

## 빌드 명령어

### 로컬 빌드 테스트

```bash
# 루트에서 실행
npm run build:shop
```

### Docker 빌드

```bash
# 전체 빌드
docker-compose build shop-app

# 캐시 없이 빌드
docker-compose build --no-cache shop-app
```

---

## 헬스 체크

```bash
# 컨테이너 상태
docker-compose ps shop-app

# HTTP 응답 확인
curl -I http://localhost:3000

# 로그 확인
docker-compose logs shop-app --tail=50
```

---

## 롤백 절차

### 이전 버전으로 롤백

```bash
# 1. 이전 커밋으로 복구
git reset --hard HEAD~1

# 2. 재빌드 및 배포
docker-compose up -d --build shop-app
```

---

## 배포 전 체크리스트

- [ ] 로컬 빌드 성공 (`npm run build:shop`)
- [ ] 환경 변수 확인 (`.env.local`)
- [ ] DB 스키마 변경 여부 확인
- [ ] 결제 관련 변경 시 테스트 환경 검증

---

## 배포 후 체크리스트

- [ ] `docker-compose ps shop-app` 상태 확인
- [ ] HTTP 접근 확인 (http://localhost:3000)
- [ ] 로그 에러 확인
- [ ] 주요 기능 테스트:
  - [ ] 로그인/회원가입
  - [ ] 상품 목록/상세
  - [ ] 장바구니
  - [ ] 결제 (테스트 환경)

---

## 모니터링

### 로그 확인

```bash
# 실시간 로그
docker-compose logs -f shop-app

# 최근 에러만
docker-compose logs shop-app 2>&1 | grep -i error
```

### 리소스 확인

```bash
# 컨테이너 리소스 사용량
docker stats bandauto-shop
```

---

## 금지사항

| 금지 | 이유 |
|-----|-----|
| 운영 DB 직접 수정 | 데이터 무결성 |
| .env 파일 커밋 | 보안 |
| 테스트 없이 배포 | 장애 위험 |
| 결제 키 하드코딩 | 보안 위험 |
