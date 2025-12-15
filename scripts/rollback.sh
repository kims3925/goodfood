#!/bin/bash

# Bandauto Rollback Script
# 배포 실패 시 이전 버전으로 롤백하는 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=========================================="
echo "  Bandauto Rollback Script"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 프로젝트 디렉토리
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

# 현재 커밋 확인
CURRENT_COMMIT=$(git rev-parse --short HEAD)
log_info "Current commit: $CURRENT_COMMIT"

# 롤백 대상 확인
if [ -z "$1" ]; then
    # 인자 없으면 1단계 이전으로
    ROLLBACK_TARGET="HEAD~1"
    log_info "Rolling back to previous commit (HEAD~1)"
else
    # 특정 커밋으로 롤백
    ROLLBACK_TARGET="$1"
    log_info "Rolling back to: $ROLLBACK_TARGET"
fi

# 롤백 커밋 정보 표시
TARGET_COMMIT=$(git rev-parse --short "$ROLLBACK_TARGET" 2>/dev/null)
if [ $? -ne 0 ]; then
    log_error "Invalid commit reference: $ROLLBACK_TARGET"
    exit 1
fi

TARGET_MESSAGE=$(git log -1 --format="%s" "$TARGET_COMMIT")
log_info "Target commit: $TARGET_COMMIT"
log_info "Commit message: $TARGET_MESSAGE"

# 확인
echo ""
log_warn "This will rollback from $CURRENT_COMMIT to $TARGET_COMMIT"
read -p "Continue with rollback? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_error "Rollback cancelled."
    exit 1
fi

# 롤백 실행
log_info "Starting rollback..."
git checkout "$TARGET_COMMIT"

# 의존성 설치
log_info "Installing dependencies..."
npm ci

# Prisma 클라이언트 생성
log_info "Generating Prisma client..."
cd db
npx prisma generate --schema prisma
cd ..

# 빌드
log_info "Building applications..."
npm run build:all

# PM2 재시작
log_info "Restarting PM2..."
pm2 reload ecosystem.config.js --update-env

# 상태 확인
pm2 status

echo ""
echo "=========================================="
echo -e "  ${GREEN}Rollback completed!${NC}"
echo "  From: $CURRENT_COMMIT"
echo "  To: $TARGET_COMMIT"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""
log_warn "Note: You are now in 'detached HEAD' state."
log_warn "To return to main branch later: git checkout main"
