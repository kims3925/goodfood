# 배포 규칙

> **관련 문서:** [SECURITY.md](./SECURITY.md) | [PROJECT.md](./PROJECT.md) | [../CLAUDE.md](../CLAUDE.md)

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

> 브랜치 조건: `main`, `release-*`, PR만 빌드 실행

```text
Branch Check → Setup → Debug → Install → Prisma Generate → Lint → Typecheck → Build → Success
```

| 단계 | 설명 | 명령어 |
|-----|-----|--------|
| Branch Check | 빌드 대상 브랜치 필터링 | main, release-*, PR |
| Setup | Node/npm 버전 확인 | `node -v && npm -v` |
| Debug | Git 커밋, 패키지 정보 확인 | `git log -1`, package.json 검증 |
| Install | 의존성 설치 | `npm ci` |
| Prisma Generate | Prisma 클라이언트 생성 | `npx prisma generate --schema prisma` |
| Lint | ESLint 검사 (조건부) | `npm run lint` |
| Typecheck | TypeScript 타입 검사 (조건부) | `npm run typecheck` |
| Build | 앱 순차 빌드 | `npm run build:shop` → `npm run build:sourcing` |

### CD Pipeline (cd-Jenkinsfile)

> **트리거 조건**: CI Pipeline (`bandauto-ci`) 성공 시에만 자동 실행
> CI Pipeline에서 빌드 검증 완료되므로, CD에서는 Deploy 단계에서만 빌드

```text
CI Guard → Checkout → Install → Prisma Generate → Deploy (빌드 포함)
```

| 단계 | 설명 | 실행 방식 |
|-----|-----|----------|
| CI Guard | CI 성공 여부 확인 (수동 실행 시 경고) | 순차 |
| Checkout | 소스 코드 가져오기 | 순차 |
| Install Dependencies | `npm ci --legacy-peer-deps` | 순차 |
| Generate Prisma Client | `npx prisma generate --schema prisma` | 순차 |
| Deploy | 복합 배포 로직 (빌드 포함, 아래 상세) | 순차 |

> **참고**: `triggers { upstream(...) }` 설정으로 CI 성공 시에만 CD가 트리거됨.
> 수동 실행 시에는 경고 메시지 출력 (배포는 진행됨).

### Deploy 단계 상세

```text
┌─────────────────────────────────────────────────────────────┐
│                    Deploy Stage Flow                         │
├─────────────────────────────────────────────────────────────┤
│  1. .env 백업                                                │
│     └─ 모든 .env, .env.local 파일을 보안 디렉토리에 백업     │
│                                                              │
│  2. Git Pull                                                 │
│     └─ git fetch origin main && git reset --hard origin/main │
│                                                              │
│  3. .env 복원                                                │
│     └─ 백업한 .env 파일들을 원래 위치로 복원                  │
│                                                              │
│  4. node_modules 무결성 체크                                 │
│     ├─ node_modules 존재 여부 확인                           │
│     ├─ package-lock.json 변경 여부 (체크섬 비교)             │
│     ├─ 주요 패키지 존재 확인 (next, react, prisma)           │
│     └─ 필요시 npm ci --legacy-peer-deps 재설치               │
│                                                              │
│  5. Prisma Generate & Migrate                                │
│     ├─ npx prisma generate --schema prisma                   │
│     ├─ 마이그레이션 상태 확인 (migrate status)               │
│     └─ 펜딩 마이그레이션 적용 (migrate deploy)               │
│                                                              │
│  6. PM2 프로세스 중지                                        │
│     └─ 파일 잠금 해제를 위해 빌드 전 중지                    │
│                                                              │
│  7. 앱 빌드                                                  │
│     └─ npm run build:shop && npm run build:sourcing          │
│                                                              │
│  8. PM2 재시작                                               │
│     └─ pm2 reload all --update-env                           │
│                                                              │
│  9. 검증                                                     │
│     └─ pm2 status 확인                                       │
└─────────────────────────────────────────────────────────────┘
```

### 실패 시 조치

| 단계 | 실패 시 |
|-----|--------|
| Checkout | 차단 |
| Install Dependencies | 차단 |
| Generate Prisma Client | 차단 |
| Prisma Migrate | 배포 중단 (스키마 드리프트 시 수동 개입 필요) |
| Deploy (빌드 포함) | 롤백 |

---

## 배포 프로세스

### 1. .env 파일 보호

```bash
# 보안: 프로젝트 디렉토리 내 전용 백업 폴더 사용 (Jenkins 권한 문제 해결)
ENV_BACKUP_DIR="${PROJECT_PATH}/.env-backup-$$"
mkdir -p "$ENV_BACKUP_DIR"
chmod 700 "$ENV_BACKUP_DIR"  # 소유자만 접근 가능

# 배포 전 .env 백업
cp .env "$ENV_BACKUP_DIR/.env.backup"
cp db/.env "$ENV_BACKUP_DIR/.env.db.backup"
cp shop-app/.env "$ENV_BACKUP_DIR/.env.shop.backup"
cp sourcing-app/.env "$ENV_BACKUP_DIR/.env.sourcing.backup"

# 백업 파일 권한 제한 (소유자만 읽기/쓰기)
chmod 600 "$ENV_BACKUP_DIR"/.env.*

# git reset 후 복원
git reset --hard origin/main
cp "$ENV_BACKUP_DIR/.env.backup" .env
cp "$ENV_BACKUP_DIR/.env.db.backup" db/.env
cp "$ENV_BACKUP_DIR/.env.shop.backup" shop-app/.env
cp "$ENV_BACKUP_DIR/.env.sourcing.backup" sourcing-app/.env

# 복원 후 임시 백업 삭제 (민감 정보 노출 방지)
rm -rf "$ENV_BACKUP_DIR"
```

> **보안 주의사항:**
> - `/tmp`는 모든 사용자가 접근 가능하므로 민감 정보 백업에 부적합
> - 백업 디렉토리에 `chmod 700`, 백업 파일에 `chmod 600` 적용 필수
> - 복원 완료 후 반드시 임시 백업 삭제

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
