# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# workspace 설정 및 패키지 파일 복사
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY db/package.json ./db/
COPY db/prisma ./db/prisma
COPY shop-app/package.json ./shop-app/
COPY sourcing-app/package.json ./sourcing-app/

# 의존성 설치 (prisma generate는 db postinstall에서 실행)
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

ARG APP_NAME=shop
ARG APP_PORT=3000

ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# deps 스테이지에서 의존성 복사
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/db/node_modules ./db/node_modules
COPY --from=deps /app/shop-app/node_modules ./shop-app/node_modules
COPY --from=deps /app/sourcing-app/node_modules ./sourcing-app/node_modules

# 소스 전체 복사
COPY . .

# Prisma Client 생성 및 고정 위치로 복사
WORKDIR /app/db
RUN pnpm prisma generate --schema prisma && \
    mkdir -p /app/prisma-client && \
    cp -r $(find /app/node_modules/.pnpm -path "*/@prisma+client@*/node_modules/.prisma" -type d | head -1)/* /app/prisma-client/

# 앱 빌드
WORKDIR /app
RUN if [ "$APP_NAME" = "shop" ]; then \
      pnpm --filter shop-app build; \
    elif [ "$APP_NAME" = "sourcing" ]; then \
      pnpm --filter sourcing-app build; \
    fi

# ============================================
# Stage 3: Runner
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

ARG APP_NAME=shop
ARG APP_PORT=3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=${APP_PORT}
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Prisma 스키마 및 클라이언트 복사
COPY --from=builder /app/db/prisma ./db/prisma
COPY --from=builder /app/prisma-client ./node_modules/.prisma

# standalone 빌드 결과 복사
COPY --from=builder --chown=nextjs:nodejs /app/${APP_NAME}-app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/${APP_NAME}-app/.next/static ./${APP_NAME}-app/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/${APP_NAME}-app/public ./${APP_NAME}-app/public

USER nextjs

EXPOSE ${APP_PORT}

CMD ["sh", "-c", "node ${APP_NAME}-app/server.js"]
