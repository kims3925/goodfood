# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat openssl

# Copy package files
COPY package.json package-lock.json ./
COPY db/package.json ./db/
COPY db/prisma ./db/prisma
COPY shop-app/package.json ./shop-app/
COPY sourcing-app/package.json ./sourcing-app/

# Install all dependencies (prisma generate runs via postinstall)
RUN npm ci

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments
ARG APP_NAME=shop
ARG APP_PORT=3000

ENV NEXT_TELEMETRY_DISABLED=1

# Install build dependencies
RUN apk add --no-cache openssl

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy entire source
COPY . .

# Generate Prisma Client
WORKDIR /app/db
RUN npx prisma generate --schema prisma

# Build the specified app
WORKDIR /app
RUN if [ "$APP_NAME" = "shop" ]; then \
      cd shop-app && npm run build; \
    elif [ "$APP_NAME" = "sourcing" ]; then \
      cd sourcing-app && npm run build; \
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

# Install runtime dependencies
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Prisma files and generated client
COPY --from=builder /app/db/prisma ./db/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built standalone app
COPY --from=builder --chown=nextjs:nodejs /app/${APP_NAME}-app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/${APP_NAME}-app/.next/static ./${APP_NAME}-app/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/${APP_NAME}-app/public ./${APP_NAME}-app/public

USER nextjs

EXPOSE ${APP_PORT}

# Start command - server.js is in the app folder for standalone output
CMD ["sh", "-c", "node ${APP_NAME}-app/server.js"]
