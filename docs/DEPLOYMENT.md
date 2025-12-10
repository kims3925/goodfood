# Bandauto v1.0.0 AWS 배포 가이드

## 배포 체크리스트

### Phase 1: AWS EC2 인스턴스 생성
- [ ] EC2 인스턴스 생성 (Ubuntu 22.04, t3.small, 서울 리전)
- [ ] 보안 그룹 설정 (22, 80, 443 포트)
- [ ] 탄력적 IP 할당 및 연결
- [ ] 키페어(.pem) 다운로드 및 안전한 곳에 보관

### Phase 2: 서버 초기 설정
- [ ] SSH 접속 확인
- [ ] 시스템 업데이트 (`sudo apt update && sudo apt upgrade -y`)
- [ ] Git, build-essential 설치

### Phase 3: Node.js 환경 설정
- [ ] Node.js 20 LTS 설치
- [ ] PM2 전역 설치

### Phase 4: 프로젝트 배포
- [ ] GitHub에서 코드 클론
- [ ] 환경 변수 파일 생성 (.env)
- [ ] 의존성 설치 (`npm install`)
- [ ] Prisma 클라이언트 생성 및 DB 스키마 적용
- [ ] shop-app, sourcing-app 빌드

### Phase 5: PM2로 앱 실행
- [ ] shop-app 실행 (포트 3000)
- [ ] sourcing-app 실행 (포트 3001)
- [ ] 자동 시작 설정 (`pm2 startup && pm2 save`)

### Phase 6: Nginx 설정
- [ ] Nginx 설치
- [ ] 리버스 프록시 설정 파일 생성
- [ ] 설정 활성화 및 Nginx 재시작

### Phase 7: HTTP 테스트
- [ ] shop-app 접속 확인
- [ ] sourcing-app 접속 확인
- [ ] 로그인/기본 기능 테스트

### Phase 8: HTTPS 적용
- [ ] DNS A 레코드 설정
- [ ] Certbot 설치
- [ ] SSL 인증서 발급
- [ ] 자동 갱신 테스트

---

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| shop-app | 고객용 쇼핑몰 (포트 3000) |
| sourcing-app | 관리자 대시보드 (포트 3001) |
| 데이터베이스 | Prisma + SQLite |
| 프레임워크 | Next.js 14.2.3 |

---

## Phase 1: AWS EC2 인스턴스 생성

### 1.1 EC2 인스턴스 생성
**왜?** 서버가 있어야 앱을 24시간 실행할 수 있습니다.

| 설정 항목 | 권장값 | 이유 |
|----------|--------|------|
| 리전 | 서울 (ap-northeast-2) | 한국 사용자 대상이므로 가장 빠른 응답 |
| AMI | Ubuntu 22.04 LTS | 안정적이고 문서가 많음 |
| 인스턴스 타입 | t3.small (2GB RAM) | Next.js 빌드에 최소 2GB 필요 |
| 스토리지 | 30GB gp3 | 소스코드 + 빌드 파일 + DB |
| 키페어 | 새로 생성 (.pem 다운로드) | SSH 접속용 |

### 1.2 보안 그룹 설정
**왜?** 어떤 포트로 접속을 허용할지 방화벽 규칙을 정합니다.

| 포트 | 용도 | 소스 |
|------|------|------|
| 22 | SSH 접속 | 내 IP만 (보안) |
| 80 | HTTP | 전체 (0.0.0.0/0) |
| 443 | HTTPS | 전체 (0.0.0.0/0) |

### 1.3 탄력적 IP 할당
**왜?** 서버를 재시작해도 IP가 바뀌지 않습니다. 도메인 연결에 필수입니다.

1. EC2 콘솔 → 탄력적 IP → 할당
2. 생성된 IP 선택 → 작업 → 연결
3. 인스턴스 선택 후 연결

---

## Phase 2: 서버 초기 설정

### 2.1 SSH 접속
```bash
# Windows PowerShell에서
ssh -i "your-key.pem" ubuntu@<EC2-퍼블릭-IP>

# 권한 오류 시 (Windows)
icacls your-key.pem /inheritance:r /grant:r "%username%:R"
```

### 2.2 시스템 업데이트
**왜?** 보안 패치와 최신 패키지를 적용합니다.
```bash
sudo apt update && sudo apt upgrade -y
```

### 2.3 필수 도구 설치
```bash
# Git 설치 (소스코드 다운로드용)
sudo apt install -y git

# 빌드 도구 (일부 npm 패키지 컴파일용)
sudo apt install -y build-essential
```

---

## Phase 3: Node.js 환경 설정

### 3.1 Node.js 20 LTS 설치
**왜?** Next.js 14는 Node.js 18+ 필요. 20 LTS가 가장 안정적입니다.
```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js 설치
sudo apt install -y nodejs

# 버전 확인
node -v  # v20.x.x
npm -v   # 10.x.x
```

### 3.2 PM2 설치
**왜?** 앱을 백그라운드에서 실행하고, 서버 재시작 시 자동 복구합니다.
```bash
sudo npm install -g pm2
```

---

## Phase 4: 프로젝트 배포

### 4.1 프로젝트 클론
```bash
cd ~
git clone <your-repo-url> bandauto
cd bandauto
```

### 4.2 환경 변수 설정
**왜?** 프로덕션 환경에 맞는 설정값을 적용합니다.

```bash
# db/.env
nano db/.env
```
```env
DATABASE_URL="file:./prod.db"
```

```bash
# shop-app/.env.local
nano shop-app/.env.local
```
```env
NEXTAUTH_URL=https://shop.yourdomain.com
NEXTAUTH_SECRET=<랜덤문자열-32자-이상>
# ... 기타 환경변수 (로컬 .env.local 참고)
```

```bash
# sourcing-app/.env
nano sourcing-app/.env
```
```env
# ... 기타 환경변수 (로컬 .env 참고)
```

> **팁:** `openssl rand -base64 32` 명령으로 랜덤 시크릿 생성 가능

### 4.3 의존성 설치 및 빌드
**왜?** 로컬에서 node_modules는 올리지 않으므로 서버에서 다시 설치합니다.
```bash
# 루트에서 전체 의존성 설치
npm install

# db 패키지 - Prisma 클라이언트 생성
cd db
npx prisma generate --schema prisma
npx prisma db push --schema prisma  # DB 스키마 적용
cd ..

# 각 앱 빌드 (메모리 부족 시 한 번에 하나씩)
cd shop-app && npm run build && cd ..
cd sourcing-app && npm run build && cd ..
```

> **주의:** t3.small에서 빌드 시 메모리 부족이 발생하면 스왑 메모리를 추가하세요:
> ```bash
> sudo fallocate -l 2G /swapfile
> sudo chmod 600 /swapfile
> sudo mkswap /swapfile
> sudo swapon /swapfile
> ```

---

## Phase 5: PM2로 앱 실행

### 5.1 앱 실행
**왜?** 터미널을 닫아도 앱이 계속 실행됩니다.
```bash
# shop-app 실행
cd ~/bandauto/shop-app
pm2 start npm --name "shop-app" -- start

# sourcing-app 실행
cd ~/bandauto/sourcing-app
pm2 start npm --name "sourcing-app" -- start

# 상태 확인
pm2 status
```

### 5.2 자동 시작 설정
**왜?** 서버가 재부팅되어도 앱이 자동으로 시작됩니다.
```bash
pm2 startup
# 출력되는 명령어 복사해서 실행
pm2 save
```

### 5.3 PM2 유용한 명령어
```bash
pm2 status          # 앱 상태 확인
pm2 logs            # 전체 로그
pm2 logs shop-app   # 특정 앱 로그
pm2 restart all     # 전체 재시작
pm2 stop shop-app   # 특정 앱 중지
pm2 monit           # 실시간 모니터링
```

---

## Phase 6: Nginx 리버스 프록시 설정

### 6.1 Nginx 설치
**왜?**
1. 80/443 포트로 들어오는 요청을 내부 포트(3000, 3001)로 전달
2. 정적 파일 캐싱으로 성능 향상
3. HTTPS 인증서 관리

```bash
sudo apt install -y nginx
```

### 6.2 Nginx 설정 파일 생성
**왜?** 도메인별로 어떤 앱으로 연결할지 정의합니다.

```bash
sudo nano /etc/nginx/sites-available/bandauto
```

```nginx
# shop-app (고객용 쇼핑몰)
server {
    listen 80;
    server_name shop.yourdomain.com;  # 실제 도메인으로 변경

    location / {
        proxy_pass http://localhost:3000;
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

# sourcing-app (관리자용)
server {
    listen 80;
    server_name admin.yourdomain.com;  # 실제 도메인으로 변경

    location / {
        proxy_pass http://localhost:3001;
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
```

### 6.3 설정 활성화
```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/bandauto /etc/nginx/sites-enabled/

# 기본 설정 제거 (충돌 방지)
sudo rm /etc/nginx/sites-enabled/default

# 문법 검사
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
sudo systemctl enable nginx  # 부팅 시 자동 시작
```

---

## Phase 7: HTTP 테스트

### 7.1 접속 테스트
1. 브라우저에서 `http://<EC2-IP>` 접속 → shop-app 확인
2. DNS 설정 전에는 IP로 직접 테스트

### 7.2 문제 해결 체크리스트
```bash
# PM2 앱 상태 확인
pm2 status
pm2 logs shop-app --lines 50

# Nginx 로그 확인
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# 포트 확인
sudo netstat -tlnp | grep -E '80|3000|3001'

# 방화벽 확인 (UFW 사용 시)
sudo ufw status
```

### 7.3 일반적인 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 502 Bad Gateway | PM2 앱 미실행 | `pm2 restart all` |
| 연결 거부 | 보안 그룹 미설정 | AWS 콘솔에서 포트 열기 |
| 페이지 로드 느림 | 빌드 안됨 | `npm run build` 재실행 |

---

## Phase 8: HTTPS 적용 (Let's Encrypt)

### 8.1 DNS 설정 (필수)
**왜?** Let's Encrypt는 IP가 아닌 도메인에만 인증서를 발급합니다.

1. 도메인 관리 페이지 접속 (가비아, AWS Route53 등)
2. DNS 레코드 추가:

| 타입 | 호스트 | 값 |
|------|--------|-----|
| A | shop | <EC2 탄력적 IP> |
| A | admin | <EC2 탄력적 IP> |

3. DNS 전파 대기 (최대 48시간, 보통 10분 내외)
4. 확인: `nslookup shop.yourdomain.com`

### 8.2 Certbot 설치
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 8.3 인증서 발급 및 자동 설정
**왜?** Certbot이 Nginx 설정을 자동으로 HTTPS로 수정해줍니다.
```bash
sudo certbot --nginx -d shop.yourdomain.com -d admin.yourdomain.com
```
- 이메일 입력
- 약관 동의 (Y)
- HTTP→HTTPS 리다이렉트 선택 (2번 권장)

### 8.4 자동 갱신 테스트
**왜?** Let's Encrypt 인증서는 90일마다 갱신 필요. Certbot이 자동화합니다.
```bash
sudo certbot renew --dry-run
```

---

## 배포 후 관리

### 코드 업데이트 시
```bash
cd ~/bandauto
git pull origin main

# 의존성 변경 시
npm install

# DB 스키마 변경 시
cd db && npx prisma db push --schema prisma && cd ..

# 앱 재빌드
cd shop-app && npm run build && cd ..
cd sourcing-app && npm run build && cd ..

# PM2 재시작
pm2 restart all
```

### 로그 확인
```bash
pm2 logs                    # 전체 로그
pm2 logs shop-app           # shop-app 로그
sudo tail -f /var/log/nginx/error.log  # Nginx 에러 로그
```

### 서버 상태 확인
```bash
htop                        # CPU/메모리 사용량
df -h                       # 디스크 사용량
pm2 monit                   # PM2 실시간 모니터링
```

### 백업
```bash
# SQLite DB 백업 (중요!)
cp ~/bandauto/db/prisma/prod.db ~/backups/prod_$(date +%Y%m%d).db

# 자동 백업 cron 설정 (매일 새벽 3시)
crontab -e
# 추가: 0 3 * * * cp ~/bandauto/db/prisma/prod.db ~/backups/prod_$(date +\%Y\%m\%d).db
```

---

## 예상 비용 (2024년 12월 기준)

| 항목 | 월 비용 (USD) |
|------|--------------|
| EC2 t3.small (온디맨드) | ~$15 |
| 탄력적 IP (사용 중) | $0 |
| EBS 30GB gp3 | ~$2.5 |
| 데이터 전송 (100GB) | ~$9 |
| **합계** | **~$27/월** |

> **절약 팁:** 예약 인스턴스(1년) 사용 시 약 30% 절감

---

## 문제 발생 시 연락처

- AWS 기술 지원: AWS 콘솔 → 지원
- 커뮤니티: AWS 한국 사용자 모임, 생활코딩 등
