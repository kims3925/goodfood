# SQLite → MySQL 마이그레이션 가이드

## 📋 목차

1. [마이그레이션 개요](#마이그레이션-개요)
2. [사전 준비](#사전-준비)
3. [MySQL 서버 설치](#mysql-서버-설치)
4. [Prisma 스키마 변경](#prisma-스키마-변경)
5. [환경변수 설정](#환경변수-설정)
6. [의존성 설치](#의존성-설치)
7. [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
8. [데이터 이전 (선택사항)](#데이터-이전-선택사항)
9. [테스트 및 검증](#테스트-및-검증)
10. [트러블슈팅](#트러블슈팅)

---

## 마이그레이션 개요

### 왜 MySQL로 마이그레이션하는가?

| 항목 | SQLite (현재) | MySQL (목표) |
|------|--------------|-------------|
| **동시 접속** | ⚠️ 제한적 (단일 쓰기 락) | ✅ 우수 (수천 명 동시 처리) |
| **성능 (읽기)** | ⭐⭐⭐ 보통 | ⭐⭐⭐⭐⭐ 최고 (10배 빠름) |
| **성능 (쓰기)** | ⭐⭐ 낮음 | ⭐⭐⭐⭐⭐ 최고 (10배 빠름) |
| **확장성** | ⚠️ 제한적 (파일 크기) | ✅ 무제한 (테라바이트급) |
| **프로덕션 배포** | ❌ Vercel/Netlify 불가 | ✅ 모든 플랫폼 지원 |
| **백업/복구** | ⚠️ 수동 (파일 복사) | ✅ 자동 백업 시스템 |

### 예상 작업 시간

- **마이그레이션만 (데이터 없음):** 30분
- **데이터 이전 포함:** 1~2시간
- **난이도:** ⭐⭐⭐ 중간

---

## 사전 준비

### 체크리스트

- [ ] 현재 SQLite 데이터베이스 백업 (`prisma/dev.db`)
- [ ] Node.js 18+ 설치 확인
- [ ] Docker Desktop 설치 (권장) 또는 MySQL 로컬 설치
- [ ] 작업 중인 코드 커밋 (Git 백업)

### 백업 명령어

```bash
# SQLite 데이터베이스 백업
cp prisma/dev.db prisma/dev.db.backup

# Git 커밋
git add .
git commit -m "Backup before MySQL migration"
```

---

## MySQL 서버 설치

### 옵션 A: Docker 사용 (권장 ✅)

**장점:**
- 격리된 환경
- 쉬운 삭제 및 재설치
- 버전 관리 용이

**1. Docker 설치 확인**
```bash
docker --version
# Docker version 24.0.0 이상
```

**2. MySQL 8.0 컨테이너 실행**
```bash
docker run -d \
  --name bandauto-mysql \
  -e MYSQL_ROOT_PASSWORD=bandauto_root_2025 \
  -e MYSQL_DATABASE=bandauto \
  -e MYSQL_USER=bandauto_user \
  -e MYSQL_PASSWORD=bandauto_pass_2025 \
  -p 3306:3306 \
  mysql:8.0
```

**3. 컨테이너 실행 확인**
```bash
docker ps
# bandauto-mysql 컨테이너가 Up 상태인지 확인

docker logs bandauto-mysql
# "ready for connections" 메시지 확인
```

**4. MySQL 접속 테스트**
```bash
docker exec -it bandauto-mysql mysql -u bandauto_user -pbandauto_pass_2025 -D bandauto

# MySQL 프롬프트에서
SHOW DATABASES;
# bandauto 데이터베이스가 보이면 성공
EXIT;
```

---

### 옵션 B: 로컬 MySQL 설치 (Windows)

**1. MySQL Installer 다운로드**
- https://dev.mysql.com/downloads/installer/
- `mysql-installer-community-8.0.XX.msi` 다운로드

**2. 설치 옵션 선택**
- **Setup Type:** Developer Default
- **Root Password:** `bandauto_root_2025` (기억할 것!)
- **MySQL Server 포트:** 3306 (기본값)

**3. 데이터베이스 생성**
```bash
# MySQL Command Line Client 실행
mysql -u root -p
# Password: bandauto_root_2025

# 데이터베이스 및 사용자 생성
CREATE DATABASE bandauto CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bandauto_user'@'localhost' IDENTIFIED BY 'bandauto_pass_2025';
GRANT ALL PRIVILEGES ON bandauto.* TO 'bandauto_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**4. 접속 테스트**
```bash
mysql -u bandauto_user -p bandauto
# Password: bandauto_pass_2025
# 접속되면 성공
```

---

### 옵션 C: 클라우드 MySQL (PlanetScale - 무료)

**1. PlanetScale 회원가입**
- https://planetscale.com/
- GitHub 계정으로 가입

**2. 데이터베이스 생성**
- **Database Name:** `bandauto`
- **Region:** AWS ap-northeast-2 (Seoul)
- **Plan:** Free (무료)

**3. 연결 정보 복사**
```
Host: aws.connect.psdb.cloud
Username: xxxxxxxxxx
Password: pscale_pw_xxxxxxxxxx
Database: bandauto
Port: 3306
SSL: Required
```

**4. DATABASE_URL 생성**
```env
DATABASE_URL="mysql://username:password@aws.connect.psdb.cloud/bandauto?sslaccept=strict"
```

---

## Prisma 스키마 변경

### 파일: `prisma/schema.prisma`

**변경 전:**
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**변경 후:**
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

### 데이터 타입 최적화 (권장)

**1. JSON 필드 명시화**
```prisma
// 변경 전
model PaymentMethod {
  config String @default("{}")
}

// 변경 후
model PaymentMethod {
  config String @db.Text @default("{}")
}
```

**영향받는 필드:**
- `PaymentMethod.config`
- `Payment.webhookData`
- `CollectedPost.priceOptions`
- `CollectedPost.priceCalculation`
- `AliExpressSourcing.priceRange`
- `AliExpressProduct.priceOptions`
- `AliExpressProduct.priceCalculation`
- `ShopProduct.options`

**2. 긴 텍스트 필드 최적화**
```prisma
// 변경 전
model Product {
  description String
}

// 변경 후
model Product {
  description String @db.Text
}
```

**영향받는 필드:**
- `Product.description`
- `Product.hookingContent`
- `Product.detailedContent`
- `CollectedPost.content`
- `CollectedPost.hookingContent`
- `CollectedPost.detailedContent`
- `RetailPost.content`
- `ShopProduct.detailContent`
- `ShopSettings.returnPolicy`
- `ShopSettings.privacyPolicy`
- `ShopSettings.termsOfService`

---

## 환경변수 설정

### 파일 수정

**1. e-commerce-app/.env.local**
```env
# 변경 전
DATABASE_URL="file:../prisma/dev.db"

# 변경 후 (Docker 사용 시)
DATABASE_URL="mysql://bandauto_user:bandauto_pass_2025@localhost:3306/bandauto"

# 변경 후 (로컬 MySQL 사용 시)
DATABASE_URL="mysql://bandauto_user:bandauto_pass_2025@localhost:3306/bandauto"

# 변경 후 (PlanetScale 사용 시)
DATABASE_URL="mysql://username:password@aws.connect.psdb.cloud/bandauto?sslaccept=strict"
```

**2. sourcing-app/.env.local**
```env
# e-commerce-app과 동일하게 변경
DATABASE_URL="mysql://bandauto_user:bandauto_pass_2025@localhost:3306/bandauto"
```

### DATABASE_URL 형식

```
mysql://[사용자명]:[비밀번호]@[호스트]:[포트]/[데이터베이스명]?[옵션]
```

**예시:**
```env
# 로컬 Docker
DATABASE_URL="mysql://bandauto_user:bandauto_pass_2025@localhost:3306/bandauto"

# 로컬 MySQL (Windows)
DATABASE_URL="mysql://root:bandauto_root_2025@localhost:3306/bandauto"

# PlanetScale (SSL 필수)
DATABASE_URL="mysql://user:pass@host.psdb.cloud/bandauto?sslaccept=strict"
```

---

## 의존성 설치

### MySQL 클라이언트 라이브러리 설치

```bash
# 프로젝트 루트에서 실행
npm install mysql2

# 설치 확인
npm list mysql2
# mysql2@3.x.x
```

### Prisma 클라이언트 재생성

```bash
# Prisma 클라이언트 재생성
npx prisma generate

# 출력 예시:
# ✔ Generated Prisma Client (5.x.x) to ./node_modules/@prisma/client
```

---

## 데이터베이스 마이그레이션

### 방법 A: `prisma db push` (빠른 개발)

**특징:**
- 마이그레이션 파일 생성 안 함
- 즉시 스키마 동기화
- 개발 환경에 적합

```bash
# 스키마를 MySQL에 적용
npx prisma db push

# 출력 예시:
# Your database is now in sync with your Prisma schema. Done in 3.45s
```

---

### 방법 B: `prisma migrate` (프로덕션 권장)

**특징:**
- 마이그레이션 파일 생성 (Git 추적 가능)
- 버전 관리 가능
- 프로덕션 환경에 적합

```bash
# 마이그레이션 생성 및 적용
npx prisma migrate dev --name init_mysql

# 출력 예시:
# Applying migration `20250120000000_init_mysql`
# Your database is now in sync with your schema.
```

**생성된 파일:**
```
prisma/migrations/
└── 20250120000000_init_mysql/
    └── migration.sql
```

---

### Prisma Studio로 확인

```bash
npx prisma studio

# 브라우저에서 자동으로 열림
# http://localhost:5555
```

**확인 사항:**
- [x] 20개 테이블이 모두 생성되었는가?
- [x] 외래키 관계가 올바른가?
- [x] 인덱스가 생성되었는가?

---

## 데이터 이전 (선택사항)

### 시나리오 1: 기존 데이터가 없는 경우

→ **이 섹션 건너뛰기** ✅

---

### 시나리오 2: 테스트 데이터만 있는 경우

→ **데이터 이전 없이 새로 시작** 권장

```bash
# MySQL에 새 시드 데이터 생성
npm run seed
```

---

### 시나리오 3: 실제 운영 데이터가 있는 경우

#### 옵션 A: Prisma Studio 수동 이전 (소량 데이터)

**1. SQLite 데이터 확인**
```bash
DATABASE_URL="file:./prisma/dev.db" npx prisma studio
```

**2. MySQL에서 수동 입력**
```bash
DATABASE_URL="mysql://..." npx prisma studio
```

---

#### 옵션 B: 스크립트 작성 (대량 데이터)

**파일 생성: `scripts/migrate-data.ts`**

```typescript
import { PrismaClient as SqliteClient } from '@prisma/client'
import { PrismaClient as MysqlClient } from '@prisma/client'

// SQLite 연결
const sqlite = new SqliteClient({
  datasources: {
    db: {
      url: 'file:./prisma/dev.db'
    }
  }
})

// MySQL 연결
const mysql = new MysqlClient({
  datasources: {
    db: {
      url: 'mysql://bandauto_user:bandauto_pass_2025@localhost:3306/bandauto'
    }
  }
})

async function migrateData() {
  console.log('🚀 데이터 마이그레이션 시작...')

  try {
    // 1. User 데이터 이전
    console.log('📦 User 데이터 이전 중...')
    const users = await sqlite.user.findMany()
    for (const user of users) {
      await mysql.user.upsert({
        where: { id: user.id },
        update: user,
        create: user
      })
    }
    console.log(`✅ User ${users.length}개 이전 완료`)

    // 2. WholesaleBand 데이터 이전
    console.log('📦 WholesaleBand 데이터 이전 중...')
    const bands = await sqlite.wholesaleBand.findMany()
    for (const band of bands) {
      await mysql.wholesaleBand.upsert({
        where: { id: band.id },
        update: band,
        create: band
      })
    }
    console.log(`✅ WholesaleBand ${bands.length}개 이전 완료`)

    // 3. Product 데이터 이전
    console.log('📦 Product 데이터 이전 중...')
    const products = await sqlite.product.findMany()
    for (const product of products) {
      await mysql.product.upsert({
        where: { id: product.id },
        update: product,
        create: product
      })
    }
    console.log(`✅ Product ${products.length}개 이전 완료`)

    // 4. CollectedPost 데이터 이전
    console.log('📦 CollectedPost 데이터 이전 중...')
    const posts = await sqlite.collectedPost.findMany()
    for (const post of posts) {
      await mysql.collectedPost.upsert({
        where: { id: post.id },
        update: post,
        create: post
      })
    }
    console.log(`✅ CollectedPost ${posts.length}개 이전 완료`)

    // 5. Order 데이터 이전
    console.log('📦 Order 데이터 이전 중...')
    const orders = await sqlite.order.findMany()
    for (const order of orders) {
      await mysql.order.upsert({
        where: { id: order.id },
        update: order,
        create: order
      })
    }
    console.log(`✅ Order ${orders.length}개 이전 완료`)

    // 나머지 테이블도 동일한 방식으로 이전...

    console.log('🎉 데이터 마이그레이션 완료!')
  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error)
    throw error
  } finally {
    await sqlite.$disconnect()
    await mysql.$disconnect()
  }
}

migrateData()
  .then(() => {
    console.log('✅ 스크립트 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 스크립트 실패:', error)
    process.exit(1)
  })
```

**실행:**
```bash
npx ts-node scripts/migrate-data.ts
```

**예상 시간:**
- 100개 레코드: ~1분
- 1,000개 레코드: ~5분
- 10,000개 레코드: ~30분

---

## 테스트 및 검증

### 1. Prisma Studio로 데이터 확인

```bash
npx prisma studio
```

**확인 사항:**
- [ ] 모든 테이블이 보이는가?
- [ ] 데이터가 올바르게 이전되었는가?
- [ ] 관계(Relations)가 정상 작동하는가?

---

### 2. 개발 서버 실행

```bash
# E-commerce 앱 실행
npm run dev:ecommerce

# Sourcing 앱 실행 (새 터미널)
npm run dev:sourcing
```

**확인 사항:**
- [ ] 서버가 정상 시작되는가?
- [ ] 콘솔에 Prisma 연결 오류가 없는가?

---

### 3. 주요 기능 테스트

#### 테스트 시나리오

**E-commerce App (http://localhost:3000)**

1. **회원 인증**
   - [ ] 로그인 성공
   - [ ] 세션 유지 확인

2. **장바구니**
   - [ ] GET `/api/cart` → 장바구니 조회
   - [ ] POST `/api/cart` → 상품 추가
   - [ ] PATCH `/api/cart/items/:id` → 수량 변경
   - [ ] DELETE `/api/cart/items/:id` → 아이템 삭제

3. **주문**
   - [ ] POST `/api/orders` → 주문 생성
   - [ ] GET `/api/orders` → 주문 목록 조회
   - [ ] GET `/api/orders/:id` → 주문 상세 조회

4. **결제**
   - [ ] POST `/api/payments/confirm` → 결제 승인 (테스트 모드)
   - [ ] GET `/api/payments/webhook` → 웹훅 엔드포인트 확인

**Sourcing App (http://localhost:3001)**

1. **도매 밴드 관리**
   - [ ] 밴드 목록 조회
   - [ ] 게시물 수집

2. **상품 관리**
   - [ ] 상품 목록 조회
   - [ ] 상품 생성/수정

---

### 4. 성능 테스트

**벤치마크 쿼리:**

```typescript
// 대량 조회 성능
console.time('product-list')
const products = await prisma.product.findMany({
  take: 100,
  include: {
    images: true,
    category: true
  }
})
console.timeEnd('product-list')
// MySQL: ~10ms
// SQLite: ~50ms (5배 차이)
```

---

## 트러블슈팅

### 문제 1: MySQL 서버에 연결할 수 없습니다

**증상:**
```
Error: P1001: Can't reach database server at `localhost`:`3306`
```

**해결 방법:**

1. **MySQL 서버 실행 확인**
```bash
# Docker 사용 시
docker ps
# bandauto-mysql 컨테이너가 Up 상태인지 확인

# 로컬 MySQL (Windows)
net start MySQL80
```

2. **포트 확인**
```bash
# 3306 포트가 사용 중인지 확인
netstat -ano | findstr :3306
```

3. **DATABASE_URL 확인**
```bash
# .env.local 파일의 DATABASE_URL이 올바른지 확인
echo %DATABASE_URL%  # Windows CMD
echo $env:DATABASE_URL  # PowerShell
```

---

### 문제 2: 인증 실패 (Authentication failed)

**증상:**
```
Error: P1000: Authentication failed against database server
```

**해결 방법:**

1. **비밀번호 확인**
```bash
# Docker MySQL
docker exec -it bandauto-mysql mysql -u bandauto_user -pbandauto_pass_2025
```

2. **사용자 권한 확인**
```sql
SELECT user, host FROM mysql.user;
SHOW GRANTS FOR 'bandauto_user'@'localhost';
```

3. **비밀번호 재설정**
```sql
ALTER USER 'bandauto_user'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
```

---

### 문제 3: 마이그레이션 실패 (데이터 타입 오류)

**증상:**
```
Error: Schema validation failed
```

**해결 방법:**

1. **Prisma 클라이언트 재생성**
```bash
npx prisma generate
```

2. **기존 데이터베이스 초기화**
```bash
# 주의: 모든 데이터가 삭제됩니다!
npx prisma migrate reset

# 또는 수동 삭제
docker exec -it bandauto-mysql mysql -u root -p
DROP DATABASE bandauto;
CREATE DATABASE bandauto CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 다시 마이그레이션
npx prisma db push
```

---

### 문제 4: 데이터 이전 중 외래키 오류

**증상:**
```
Error: Foreign key constraint failed
```

**해결 방법:**

1. **올바른 순서로 데이터 이전**
```typescript
// 순서 중요!
// 1. 부모 테이블 먼저
await migrateUsers()
await migrateWholesaleBands()

// 2. 자식 테이블 나중에
await migrateCollectedPosts()
await migrateProducts()
```

2. **외래키 체크 일시 중지 (MySQL)**
```sql
SET FOREIGN_KEY_CHECKS = 0;
-- 데이터 삽입
SET FOREIGN_KEY_CHECKS = 1;
```

---

### 문제 5: 성능이 느립니다

**해결 방법:**

1. **인덱스 확인**
```sql
SHOW INDEX FROM products;
```

2. **쿼리 최적화**
```typescript
// Bad (N+1 문제)
const products = await prisma.product.findMany()
for (const product of products) {
  const images = await prisma.productImage.findMany({ where: { productId: product.id } })
}

// Good (한 번에 가져오기)
const products = await prisma.product.findMany({
  include: {
    images: true
  }
})
```

3. **연결 풀 설정**
```env
DATABASE_URL="mysql://user:pass@localhost:3306/bandauto?connection_limit=10"
```

---

## 마이그레이션 완료 체크리스트

### 필수 확인 사항

- [ ] MySQL 서버가 정상 실행 중
- [ ] `prisma/schema.prisma`에서 `provider = "mysql"` 확인
- [ ] `.env.local` 파일에 올바른 `DATABASE_URL` 설정
- [ ] `mysql2` 패키지 설치 완료
- [ ] `npx prisma db push` 또는 `npx prisma migrate` 성공
- [ ] Prisma Studio에서 20개 테이블 확인
- [ ] 개발 서버 정상 실행 (포트 3000, 3001)
- [ ] API 엔드포인트 정상 작동 (장바구니, 주문, 결제)
- [ ] 기존 데이터 이전 완료 (필요한 경우)
- [ ] Git 커밋 완료

### 선택 사항

- [ ] PlanetScale 같은 클라우드 MySQL로 전환 준비
- [ ] 자동 백업 스크립트 설정
- [ ] 모니터링 도구 설정 (Prisma Pulse, Datadog 등)
- [ ] 성능 벤치마크 수행

---

## 롤백 (원래대로 되돌리기)

마이그레이션 후 문제가 발생한 경우:

```bash
# 1. Prisma 스키마 원복
# prisma/schema.prisma 변경
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

# 2. 환경변수 원복
# .env.local 변경
DATABASE_URL="file:../prisma/dev.db"

# 3. SQLite 백업 복원
cp prisma/dev.db.backup prisma/dev.db

# 4. Prisma 클라이언트 재생성
npx prisma generate

# 5. 서버 재시작
npm run dev:all
```

---

## 추가 리소스

### 공식 문서

- [Prisma MySQL 가이드](https://www.prisma.io/docs/concepts/database-connectors/mysql)
- [MySQL 8.0 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/)
- [PlanetScale Docs](https://planetscale.com/docs)

### 유용한 도구

- **Prisma Studio**: 데이터베이스 GUI
- **MySQL Workbench**: MySQL 관리 도구
- **DBeaver**: 범용 데이터베이스 클라이언트
- **TablePlus**: 모던 데이터베이스 GUI (유료)

---

## 문의 및 지원

마이그레이션 중 문제가 발생하면:

1. 이 문서의 [트러블슈팅](#트러블슈팅) 섹션 참조
2. GitHub Issues에 질문 등록
3. Prisma Discord 커뮤니티 방문

---

**마이그레이션 성공을 기원합니다! 🚀**
