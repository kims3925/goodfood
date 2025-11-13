# 데이터베이스 설정 가이드

## PostgreSQL 설치 및 설정

### Windows 설치

1. **PostgreSQL 다운로드**
   - [PostgreSQL 공식 사이트](https://www.postgresql.org/download/windows/)에서 다운로드
   - 설치 중 설정:
     - 포트: 5432 (기본값)
     - 비밀번호: 안전한 비밀번호 설정
     - Locale: Korean, Korea

2. **pgAdmin 4 실행**
   - 설치 시 함께 설치된 pgAdmin 4 실행
   - 서버 연결 확인

3. **데이터베이스 생성**
   ```sql
   -- pgAdmin 또는 psql에서 실행
   CREATE DATABASE bandauto;
   ```

4. **환경 변수 설정**
   - `.env.local` 파일에서 DATABASE_URL 수정:
   ```
   DATABASE_URL="postgresql://postgres:your_password@localhost:5432/bandauto"
   ```

### macOS 설치

1. **Homebrew로 설치**
   ```bash
   brew install postgresql@15
   brew services start postgresql@15
   ```

2. **데이터베이스 생성**
   ```bash
   createdb bandauto
   ```

3. **환경 변수 설정**
   ```
   DATABASE_URL="postgresql://username@localhost:5432/bandauto"
   ```

### Linux (Ubuntu/Debian) 설치

1. **APT로 설치**
   ```bash
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   ```

2. **PostgreSQL 서비스 시작**
   ```bash
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

3. **데이터베이스 생성**
   ```bash
   sudo -u postgres createdb bandauto
   ```

## Redis 설치 및 설정

### Windows 설치

1. **WSL2 설치 (권장)**
   ```powershell
   wsl --install
   ```

2. **WSL2에서 Redis 설치**
   ```bash
   sudo apt update
   sudo apt install redis-server
   ```

3. **Redis 서비스 시작**
   ```bash
   sudo service redis-server start
   ```

4. **Redis 테스트**
   ```bash
   redis-cli ping
   # PONG이 출력되면 정상
   ```

### 대안: Windows용 Redis (Memurai)

1. **Memurai 다운로드**
   - [Memurai 다운로드](https://www.memurai.com/get-memurai)
   - 개발자 에디션 무료 사용 가능

2. **서비스 시작**
   - 설치 후 자동으로 서비스 시작
   - 포트: 6379 (기본값)

### macOS 설치

1. **Homebrew로 설치**
   ```bash
   brew install redis
   ```

2. **Redis 서비스 시작**
   ```bash
   brew services start redis
   ```

3. **Redis 테스트**
   ```bash
   redis-cli ping
   ```

### Linux (Ubuntu/Debian) 설치

1. **APT로 설치**
   ```bash
   sudo apt update
   sudo apt install redis-server
   ```

2. **Redis 설정 편집**
   ```bash
   sudo nano /etc/redis/redis.conf
   # supervised no를 supervised systemd로 변경
   ```

3. **Redis 서비스 재시작**
   ```bash
   sudo systemctl restart redis.service
   sudo systemctl enable redis.service
   ```

## Prisma 초기 설정

1. **Prisma 초기화**
   ```bash
   npx prisma init
   ```

2. **스키마 파일이 이미 생성되어 있으므로 마이그레이션 실행**
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Prisma Client 생성**
   ```bash
   npx prisma generate
   ```

4. **Prisma Studio 실행 (선택사항)**
   ```bash
   npx prisma studio
   # 브라우저에서 http://localhost:5555 접속
   ```

## 연결 테스트

### PostgreSQL 연결 테스트

```bash
# psql 사용
psql -U postgres -d bandauto -c "SELECT version();"

# 또는 Prisma로 테스트
npx prisma db push
```

### Redis 연결 테스트

```bash
# Redis CLI 사용
redis-cli
> ping
PONG
> exit
```

## 트러블슈팅

### PostgreSQL 연결 오류

1. **"FATAL: password authentication failed"**
   - `.env.local`의 비밀번호 확인
   - PostgreSQL 사용자 비밀번호 재설정:
   ```sql
   ALTER USER postgres PASSWORD 'new_password';
   ```

2. **"could not connect to server"**
   - PostgreSQL 서비스 실행 확인:
   ```bash
   # Windows
   net start postgresql-x64-15
   
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   ```

### Redis 연결 오류

1. **"Connection refused"**
   - Redis 서비스 실행 확인:
   ```bash
   # WSL/Linux
   sudo service redis-server status
   
   # macOS
   brew services list
   ```

2. **메모리 부족**
   - Redis 설정에서 maxmemory 설정:
   ```bash
   redis-cli CONFIG SET maxmemory 256mb
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

## 개발 환경 최종 확인

모든 설정이 완료되면 다음 명령어로 확인:

```bash
# 1. PostgreSQL 확인
npx prisma db push

# 2. Redis 확인  
redis-cli ping

# 3. 개발 서버 실행
npm run dev
```

http://localhost:3000 접속하여 정상 작동 확인