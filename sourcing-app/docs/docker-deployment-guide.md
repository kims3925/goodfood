# Docker 배포 가이드

> BandAuto 프로젝트를 Docker로 컨테이너화하고 AWS에 배포하는 완전 가이드

---

## 목차

1. [Docker 기초 개념](#1-docker-기초-개념)
2. [프로젝트 Docker화](#2-프로젝트-docker화)
3. [Docker Compose 구성](#3-docker-compose-구성)
4. [환경별 설정](#4-환경별-설정)
5. [AWS 배포 옵션](#5-aws-배포-옵션)
6. [CI/CD 파이프라인](#6-cicd-파이프라인)
7. [모니터링 & 로깅](#7-모니터링--로깅)
8. [트러블슈팅](#8-트러블슈팅)

---

## 1. Docker 기초 개념

### 1.1 Docker란?

Docker는 애플리케이션을 **컨테이너**라는 격리된 환경에서 실행할 수 있게 해주는 플랫폼입니다.

```
┌─────────────────────────────────────────────────────────────┐
│                    기존 방식 (VM)                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │  App A  │  │  App B  │  │  App C  │                     │
│  ├─────────┤  ├─────────┤  ├─────────┤                     │
│  │Guest OS │  │Guest OS │  │Guest OS │  ← 각각 OS 필요     │
│  └─────────┘  └─────────┘  └─────────┘                     │
│  ┌─────────────────────────────────────┐                   │
│  │           Hypervisor                 │                   │
│  └─────────────────────────────────────┘                   │
│  ┌─────────────────────────────────────┐                   │
│  │            Host OS                   │                   │
│  └─────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Docker 방식                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │  App A  │  │  App B  │  │  App C  │                     │
│  └─────────┘  └─────────┘  └─────────┘                     │
│  ┌─────────────────────────────────────┐                   │
│  │         Docker Engine               │  ← OS 공유        │
│  └─────────────────────────────────────┘                   │
│  ┌─────────────────────────────────────┐                   │
│  │            Host OS                   │                   │
│  └─────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 핵심 개념

| 개념 | 설명 | 비유 |
|------|------|------|
| **Image** | 애플리케이션 실행에 필요한 모든 것이 담긴 템플릿 | 설치 CD |
| **Container** | 이미지로부터 생성된 실행 인스턴스 | 실행 중인 프로그램 |
| **Dockerfile** | 이미지를 만드는 레시피/설명서 | 요리 레시피 |
| **Volume** | 컨테이너와 호스트 간 데이터 공유 | 외장 하드 |
| **Network** | 컨테이너 간 통신 네트워크 | LAN 케이블 |
| **Registry** | 이미지 저장소 (Docker Hub, ECR) | 앱스토어 |

### 1.3 Docker 명령어 기초

```bash
# 이미지 관련
docker build -t myapp:v1 .      # 이미지 빌드
docker images                    # 이미지 목록
docker rmi myapp:v1             # 이미지 삭제
docker pull nginx               # 이미지 다운로드
docker push myrepo/myapp:v1     # 이미지 업로드

# 컨테이너 관련
docker run -d -p 3000:3000 myapp   # 컨테이너 실행
docker ps                           # 실행 중인 컨테이너
docker ps -a                        # 모든 컨테이너
docker stop <container_id>          # 컨테이너 중지
docker rm <container_id>            # 컨테이너 삭제
docker logs <container_id>          # 로그 확인
docker exec -it <container_id> sh   # 컨테이너 접속

# Docker Compose
docker compose up -d            # 서비스 시작
docker compose down             # 서비스 중지
docker compose logs -f          # 로그 확인
docker compose ps               # 상태 확인
```

---

## 2. 프로젝트 Docker화

### 2.1 프로젝트 구조

```
bandauto/
├── db/
│   └── Dockerfile.db           # Prisma 클라이언트 빌드용 (선택)
├── shop-app/
│   └── Dockerfile              # Shop App 이미지
├── sourcing-app/
│   └── Dockerfile              # Sourcing App 이미지
├── docker-compose.yml          # 전체 서비스 구성
├── docker-compose.dev.yml      # 개발 환경
├── docker-compose.prod.yml     # 프로덕션 환경
└── .dockerignore               # 빌드 제외 파일
```

### 2.2 Shop App Dockerfile

```dockerfile
# shop-app/Dockerfile

# ============================================
# Stage 1: Dependencies (의존성 설치)
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# 의존성 파일만 먼저 복사 (캐시 활용)
COPY package.json package-lock.json ./
COPY db/package.json ./db/
COPY shop-app/package.json ./shop-app/

# 전체 의존성 설치
RUN npm ci --workspace=shop-app

# ============================================
# Stage 2: Builder (빌드)
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

# 의존성 복사
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/db/node_modules ./db/node_modules
COPY --from=deps /app/shop-app/node_modules ./shop-app/node_modules

# 소스 코드 복사
COPY . .

# Prisma 클라이언트 생성
RUN cd db && npx prisma generate --schema prisma

# Next.js 빌드
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=shop-app

# ============================================
# Stage 3: Runner (실행)
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

# 보안: non-root 사용자
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 환경 변수
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# 필요한 파일만 복사
COPY --from=builder /app/shop-app/public ./shop-app/public
COPY --from=builder /app/shop-app/.next/standalone ./
COPY --from=builder /app/shop-app/.next/static ./shop-app/.next/static

# Prisma 클라이언트 복사
COPY --from=builder /app/db/src/generated ./db/src/generated
COPY --from=builder /app/db/prisma ./db/prisma

USER nextjs

EXPOSE 3000

# standalone 모드로 실행
CMD ["node", "shop-app/server.js"]
```

### 2.3 Sourcing App Dockerfile

```dockerfile
# sourcing-app/Dockerfile

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Playwright 시스템 의존성 설치
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Playwright 환경 변수
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package.json package-lock.json ./
COPY db/package.json ./db/
COPY sourcing-app/package.json ./sourcing-app/

RUN npm ci --workspace=sourcing-app

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/db/node_modules ./db/node_modules
COPY --from=deps /app/sourcing-app/node_modules ./sourcing-app/node_modules

COPY . .

# Prisma 클라이언트 생성
RUN cd db && npx prisma generate --schema prisma

# Next.js 빌드
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=sourcing-app

# ============================================
# Stage 3: Runner
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

# Playwright 시스템 의존성 (런타임)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-cjk  # 한글 폰트

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

COPY --from=builder /app/sourcing-app/public ./sourcing-app/public
COPY --from=builder /app/sourcing-app/.next/standalone ./
COPY --from=builder /app/sourcing-app/.next/static ./sourcing-app/.next/static

COPY --from=builder /app/db/src/generated ./db/src/generated
COPY --from=builder /app/db/prisma ./db/prisma

USER nextjs

EXPOSE 3001

CMD ["node", "sourcing-app/server.js"]
```

### 2.4 .dockerignore

```
# .dockerignore

# 의존성 (빌드 시 새로 설치)
node_modules
**/node_modules

# 빌드 산출물
.next
**/.next
out

# 개발 환경
.env*.local
*.log
.git
.gitignore

# IDE
.vscode
.idea
*.swp
*.swo

# 테스트
coverage
.nyc_output

# 기타
README.md
*.md
!prisma/*.md
```

### 2.5 next.config.js 수정 (standalone 모드)

```javascript
// shop-app/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // Docker 최적화 필수

  // 기존 설정 유지
  experimental: {
    instrumentationHook: true,
  },

  // 이미지 도메인 설정
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.band.us' },
      { protocol: 'https', hostname: '*.naver.com' },
    ],
  },
}

module.exports = nextConfig
```

---

## 3. Docker Compose 구성

### 3.1 기본 docker-compose.yml

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ============================================
  # MySQL 데이터베이스
  # ============================================
  mysql:
    image: mysql:8.0
    container_name: bandauto-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpassword}
      MYSQL_DATABASE: bandauto
      MYSQL_USER: banduser
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-bandpassword}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./db/init:/docker-entrypoint-initdb.d  # 초기화 SQL
    networks:
      - bandauto-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ============================================
  # Redis (캐시/세션)
  # ============================================
  redis:
    image: redis:7-alpine
    container_name: bandauto-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - bandauto-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ============================================
  # Shop App (고객용 쇼핑몰)
  # ============================================
  shop-app:
    build:
      context: .
      dockerfile: shop-app/Dockerfile
    container_name: bandauto-shop
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://banduser:${MYSQL_PASSWORD:-bandpassword}@mysql:3306/bandauto
      - NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - TOSS_PAYMENTS_CLIENT_KEY=${TOSS_PAYMENTS_CLIENT_KEY}
      - TOSS_PAYMENTS_SECRET_KEY=${TOSS_PAYMENTS_SECRET_KEY}
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - bandauto-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ============================================
  # Sourcing App (관리자 앱)
  # ============================================
  sourcing-app:
    build:
      context: .
      dockerfile: sourcing-app/Dockerfile
    container_name: bandauto-sourcing
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://banduser:${MYSQL_PASSWORD:-bandpassword}@mysql:3306/bandauto
      - JWT_SECRET=${JWT_SECRET}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - PLAYWRIGHT_HEADLESS=true
      - PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
    volumes:
      - upload_data:/app/uploads  # 업로드 파일 영구 저장
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - bandauto-network

  # ============================================
  # Nginx (리버스 프록시)
  # ============================================
  nginx:
    image: nginx:alpine
    container_name: bandauto-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro  # SSL 인증서
    depends_on:
      - shop-app
      - sourcing-app
    networks:
      - bandauto-network

# ============================================
# 볼륨 정의
# ============================================
volumes:
  mysql_data:
    driver: local
  redis_data:
    driver: local
  upload_data:
    driver: local

# ============================================
# 네트워크 정의
# ============================================
networks:
  bandauto-network:
    driver: bridge
```

### 3.2 Nginx 설정

```nginx
# nginx/nginx.conf

events {
    worker_connections 1024;
}

http {
    # 업스트림 정의
    upstream shop {
        server shop-app:3000;
    }

    upstream sourcing {
        server sourcing-app:3001;
    }

    # Shop App (쇼핑몰)
    server {
        listen 80;
        server_name shop.bandauto.com *.bandauto.com;

        # HTTPS 리다이렉트 (프로덕션)
        # return 301 https://$server_name$request_uri;

        location / {
            proxy_pass http://shop;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }

    # Sourcing App (관리자)
    server {
        listen 80;
        server_name admin.bandauto.com;

        location / {
            proxy_pass http://sourcing;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }

    # HTTPS 설정 (SSL 인증서 있을 때)
    # server {
    #     listen 443 ssl http2;
    #     server_name shop.bandauto.com;
    #
    #     ssl_certificate /etc/nginx/ssl/fullchain.pem;
    #     ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    #
    #     location / {
    #         proxy_pass http://shop;
    #         ...
    #     }
    # }
}
```

---

## 4. 환경별 설정

### 4.1 개발 환경 (docker-compose.dev.yml)

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  mysql:
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: devpassword
      MYSQL_PASSWORD: devpassword

  redis:
    ports:
      - "6379:6379"

  shop-app:
    build:
      target: deps  # 빌드 없이 개발 모드
    volumes:
      - ./shop-app:/app/shop-app  # 핫 리로드
      - ./db:/app/db
    environment:
      - NODE_ENV=development
    command: npm run dev --workspace=shop-app

  sourcing-app:
    build:
      target: deps
    volumes:
      - ./sourcing-app:/app/sourcing-app
      - ./db:/app/db
    environment:
      - NODE_ENV=development
      - PLAYWRIGHT_HEADLESS=false  # 브라우저 표시
    command: npm run dev --workspace=sourcing-app
```

**실행:**
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### 4.2 프로덕션 환경 (docker-compose.prod.yml)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  mysql:
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    # 외부 포트 노출하지 않음 (보안)
    ports: []

  redis:
    ports: []
    command: redis-server --requirepass ${REDIS_PASSWORD}

  shop-app:
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://banduser:${MYSQL_PASSWORD}@mysql:3306/bandauto
    deploy:
      replicas: 2  # 2개 인스턴스
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  sourcing-app:
    environment:
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G  # Playwright용 메모리

  nginx:
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/nginx/ssl:ro  # Let's Encrypt 인증서
```

**실행:**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 4.3 환경 변수 파일 (.env)

```env
# .env.production

# 데이터베이스
MYSQL_ROOT_PASSWORD=super-secure-root-password
MYSQL_PASSWORD=super-secure-user-password
DATABASE_URL=mysql://banduser:super-secure-user-password@mysql:3306/bandauto

# Redis
REDIS_PASSWORD=super-secure-redis-password

# 인증
NEXTAUTH_URL=https://shop.bandauto.com
NEXTAUTH_SECRET=random-32-character-secret-key
JWT_SECRET=another-random-32-character-secret

# 토스페이먼츠 (라이브 키)
TOSS_PAYMENTS_CLIENT_KEY=live_gck_xxxxx
TOSS_PAYMENTS_SECRET_KEY=live_gsk_xxxxx

# AI
GEMINI_API_KEY=AIzaSyxxxxx
```

---

## 5. AWS 배포 옵션

### 5.1 배포 옵션 비교

```
┌─────────────────────────────────────────────────────────────────┐
│                    AWS 배포 옵션 비교                            │
├──────────────┬───────────────┬──────────────┬──────────────────┤
│    항목      │   EC2 직접    │   ECS/Fargate │    EKS           │
├──────────────┼───────────────┼──────────────┼──────────────────┤
│ 복잡도       │ ⭐⭐          │ ⭐⭐⭐        │ ⭐⭐⭐⭐⭐        │
│ 비용 (소규모) │ $20-50/월    │ $30-80/월    │ $80-150/월       │
│ 자동 확장    │ 수동          │ 자동          │ 자동             │
│ 관리 부담    │ 높음          │ 중간          │ 낮음 (학습곡선↑) │
│ 추천 규모    │ 1-100 사용자  │ 100-10K      │ 10K+             │
└──────────────┴───────────────┴──────────────┴──────────────────┘
```

### 5.2 Option 1: EC2 단일 서버 (초기 추천)

```
┌─────────────────────────────────────────────────────────────┐
│                      EC2 Instance                            │
│                    (t3.medium/large)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────────────────────┐                   │
│   │          Docker Compose              │                   │
│   ├─────────────────────────────────────┤                   │
│   │  ┌────────┐ ┌────────┐ ┌────────┐  │                   │
│   │  │ Shop   │ │Sourcing│ │  MySQL │  │                   │
│   │  │  App   │ │  App   │ │        │  │                   │
│   │  └────────┘ └────────┘ └────────┘  │                   │
│   │       ┌────────┐ ┌────────┐         │                   │
│   │       │ Redis  │ │ Nginx  │         │                   │
│   │       └────────┘ └────────┘         │                   │
│   └─────────────────────────────────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │  Elastic IP      │
                │  + Route 53      │
                └──────────────────┘
```

**배포 스크립트:**
```bash
#!/bin/bash
# deploy-ec2.sh

# EC2 접속
EC2_HOST="ec2-user@your-ec2-ip"

# 최신 코드 가져오기
ssh $EC2_HOST << 'EOF'
cd /app/bandauto
git pull origin main

# 이미지 빌드 & 배포
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Prisma 마이그레이션
docker compose exec shop-app npx prisma migrate deploy

# 정리
docker system prune -f
EOF
```

### 5.3 Option 2: ECS Fargate (확장성 추천)

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Cloud                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    ┌──────────────┐                                             │
│    │     ALB      │  ←── Application Load Balancer              │
│    └──────┬───────┘                                             │
│           │                                                      │
│    ┌──────▼───────────────────────────────────────────┐         │
│    │                  ECS Cluster                      │         │
│    ├──────────────────────────────────────────────────┤         │
│    │                                                   │         │
│    │   ┌─────────────────┐   ┌─────────────────┐     │         │
│    │   │  Shop Service   │   │Sourcing Service │     │         │
│    │   │ (Fargate Tasks) │   │ (Fargate Tasks) │     │         │
│    │   │    x 2-10       │   │    x 1-5        │     │         │
│    │   └─────────────────┘   └─────────────────┘     │         │
│    │                                                   │         │
│    └──────────────────────────────────────────────────┘         │
│                          │                                       │
│           ┌──────────────┼──────────────┐                       │
│           ▼              ▼              ▼                       │
│    ┌──────────┐   ┌──────────┐   ┌──────────┐                  │
│    │   RDS    │   │ElastiCache│   │   ECR    │                  │
│    │ (MySQL)  │   │ (Redis)  │   │ (Images) │                  │
│    └──────────┘   └──────────┘   └──────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**ECS Task Definition (shop-app):**
```json
{
  "family": "bandauto-shop",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "shop-app",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/bandauto-shop:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:ap-northeast-2:xxx:secret:bandauto/db-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bandauto-shop",
          "awslogs-region": "ap-northeast-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget -q -O - http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

### 5.4 비용 예상

```
┌─────────────────────────────────────────────────────────────┐
│                    월간 비용 예상 (USD)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  EC2 (t3.medium) 단일 서버                                   │
│  ├── EC2 인스턴스: $30-40                                    │
│  ├── EBS 스토리지 (50GB): $5                                 │
│  ├── 데이터 전송: $5-10                                      │
│  └── 총계: ~$50/월                                           │
│                                                              │
│  ECS Fargate (소규모)                                        │
│  ├── Fargate (2 Tasks): $40-60                              │
│  ├── RDS (db.t3.micro): $15-20                              │
│  ├── ElastiCache (t3.micro): $15                            │
│  ├── ALB: $20                                                │
│  ├── ECR: $5                                                 │
│  └── 총계: ~$100-120/월                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. CI/CD 파이프라인

### 6.1 GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

env:
  AWS_REGION: ap-northeast-2
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-northeast-2.amazonaws.com

jobs:
  # ============================================
  # 1. 테스트
  # ============================================
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

  # ============================================
  # 2. 빌드 & 푸시
  # ============================================
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Shop App
        run: |
          docker build -f shop-app/Dockerfile -t $ECR_REGISTRY/bandauto-shop:${{ github.sha }} .
          docker push $ECR_REGISTRY/bandauto-shop:${{ github.sha }}
          docker tag $ECR_REGISTRY/bandauto-shop:${{ github.sha }} $ECR_REGISTRY/bandauto-shop:latest
          docker push $ECR_REGISTRY/bandauto-shop:latest

      - name: Build and push Sourcing App
        run: |
          docker build -f sourcing-app/Dockerfile -t $ECR_REGISTRY/bandauto-sourcing:${{ github.sha }} .
          docker push $ECR_REGISTRY/bandauto-sourcing:${{ github.sha }}
          docker tag $ECR_REGISTRY/bandauto-sourcing:${{ github.sha }} $ECR_REGISTRY/bandauto-sourcing:latest
          docker push $ECR_REGISTRY/bandauto-sourcing:latest

  # ============================================
  # 3. 배포
  # ============================================
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster bandauto --service shop-app --force-new-deployment
          aws ecs update-service --cluster bandauto --service sourcing-app --force-new-deployment

      - name: Wait for deployment
        run: |
          aws ecs wait services-stable --cluster bandauto --services shop-app sourcing-app
```

### 6.2 배포 흐름도

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   Push   │────▶│   Test   │────▶│  Build   │────▶│  Deploy  │
│ to main  │     │          │     │ & Push   │     │  to ECS  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │   Amazon ECR     │
                              │  (Image Registry)│
                              └──────────────────┘
```

---

## 7. 모니터링 & 로깅

### 7.1 CloudWatch 로그

```yaml
# docker-compose.yml 수정
services:
  shop-app:
    logging:
      driver: awslogs
      options:
        awslogs-group: /bandauto/shop-app
        awslogs-region: ap-northeast-2
        awslogs-stream-prefix: shop
```

### 7.2 헬스체크 API

```typescript
// shop-app/src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'

export async function GET() {
  try {
    // DB 연결 확인
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: 'Database connection failed' },
      { status: 503 }
    )
  }
}
```

---

## 8. 트러블슈팅

### 8.1 일반적인 문제

| 문제 | 원인 | 해결 방법 |
|------|------|----------|
| `Cannot find module '@bandauto/db'` | Prisma 클라이언트 미생성 | `cd db && npx prisma generate --schema prisma` |
| `ECONNREFUSED 127.0.0.1:3306` | 컨테이너 네트워크 문제 | `mysql` 대신 서비스명 사용 |
| Playwright 실패 | Chromium 미설치 | Dockerfile에 의존성 추가 |
| 메모리 부족 | Playwright 메모리 사용량 | `--memory=2g` 옵션 추가 |

### 8.2 디버깅 명령어

```bash
# 컨테이너 로그 확인
docker compose logs -f shop-app

# 컨테이너 접속
docker compose exec shop-app sh

# 네트워크 확인
docker network inspect bandauto-network

# 리소스 사용량
docker stats

# Prisma 연결 테스트
docker compose exec shop-app npx prisma db pull
```

---

## 다음 문서

- [Playwright 스케일링 전략](./playwright-scaling-strategy.md)
- [아키텍처 개요](./architecture-overview.md)
