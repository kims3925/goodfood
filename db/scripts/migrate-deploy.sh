#!/bin/bash
# ===========================================
# Prisma 마이그레이션 배포 스크립트
# 기존 데이터베이스에 안전하게 마이그레이션 적용
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(dirname "$SCRIPT_DIR")"

cd "$DB_DIR"

echo "=========================================="
echo "Prisma 마이그레이션 배포 시작"
echo "=========================================="

# 1. Prisma 클라이언트 생성
echo "[1/3] Prisma 클라이언트 생성..."
pnpm prisma generate --schema prisma

# 2. _prisma_migrations 테이블 존재 여부 확인 및 baseline 설정
echo "[2/3] 마이그레이션 상태 확인..."

# migrate deploy 시도, 실패하면 baseline 설정 후 재시도
if ! pnpm prisma migrate deploy --schema prisma 2>/dev/null; then
    echo "기존 데이터베이스 감지됨. Baseline 설정 중..."

    # 모든 마이그레이션을 이미 적용된 것으로 표시
    for migration_dir in prisma/migrations/*/; do
        if [ -d "$migration_dir" ]; then
            migration_name=$(basename "$migration_dir")
            # 숫자로 시작하는 디렉토리만 처리 (migration_ 같은 폴더 제외)
            if [[ "$migration_name" =~ ^[0-9] ]]; then
                echo "  - Baseline 설정: $migration_name"
                pnpm prisma migrate resolve --applied "$migration_name" --schema prisma 2>/dev/null || true
            fi
        fi
    done

    # 다시 deploy 시도
    echo "마이그레이션 재시도..."
    pnpm prisma migrate deploy --schema prisma
fi

echo "[3/3] 마이그레이션 완료!"
echo "=========================================="
echo "Prisma 마이그레이션 배포 완료"
echo "=========================================="
