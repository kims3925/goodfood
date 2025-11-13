# 🚀 BandAuto AWS EC2 배포 완전 가이드

> **초보자도 따라할 수 있는 단계별 AWS 배포 가이드**
> 보안과 안정성을 최우선으로 하는 배포 절차

---

## 📋 목차
1. [배포 전 준비사항](#-배포-전-준비사항)
2. [AWS 계정 및 설정](#-aws-계정-및-설정)
3. [EC2 인스턴스 생성](#-ec2-인스턴스-생성)
4. [서버 환경 구성](#-서버-환경-구성)
5. [프로젝트 배포](#-프로젝트-배포)
6. [도메인 및 SSL 설정](#-도메인-및-ssl-설정)
7. [모니터링 및 백업](#-모니터링-및-백업)
8. [보안 체크리스트](#-보안-체크리스트)

---

## 🔧 배포 전 준비사항

### ✅ 1단계: 로컬 환경 점검

- [ ] **프로젝트 빌드 테스트**
  ```bash
  npm run build
  ```
  - 오류 없이 빌드가 완료되는지 확인
  - 모든 TypeScript 오류 해결

- [ ] **환경변수 정리**
  ```bash
  # 현재 .env.local 파일의 모든 변수를 정리
  cp .env.local .env.example
  # .env.example에서 실제 값들을 제거하고 예시로 변경
  ```

- [ ] **데이터베이스 백업**
  ```bash
  # SQLite 데이터베이스 백업
  cp prisma/dev.db prisma/backup-$(date +%Y%m%d).db
  ```

- [ ] **중요 파일 체크리스트**
  - `package.json` - 의존성 확인
  - `next.config.js` - 프로덕션 설정 확인
  - `prisma/schema.prisma` - 데이터베이스 스키마 확인

### ✅ 2단계: 보안 준비사항

- [ ] **민감한 정보 제거**
  ```bash
  # .gitignore 확인 및 업데이트
  echo "*.log" >> .gitignore
  echo ".env*" >> .gitignore
  echo "*.backup" >> .gitignore
  ```

- [ ] **API 키 및 비밀번호 확인**
  - 토스페이먼츠 API 키 (테스트 → 운영)
  - Gemini AI API 키
  - Band API 키
  - NextAuth Secret 키

- [ ] **Git 커밋**
  ```bash
  git add .
  git commit -m "배포 준비: 환경변수 정리 및 보안 강화"
  git push origin main
  ```

---

## 🏢 AWS 계정 및 설정

### ✅ 3단계: AWS 계정 생성 및 설정

- [ ] **AWS 계정 생성**
  1. [AWS 콘솔](https://aws.amazon.com) 접속
  2. "AWS 계정 생성" 클릭
  3. 이메일, 비밀번호, 계정 이름 입력
  4. 결제 정보 등록 (신용카드 필요)
  5. 전화번호 인증 완료

- [ ] **MFA(다중 인증) 설정** ⭐ **보안 필수**
  1. AWS 콘솔 → IAM → 사용자 → 보안 자격 증명
  2. "MFA 디바이스 할당" 클릭
  3. Google Authenticator 앱 사용 권장
  4. QR 코드 스캔 후 인증 코드 2개 입력

- [ ] **결제 알람 설정**
  1. 결제 및 비용 관리 → 결제 기본 설정
  2. "결제 알림 수신" 활성화
  3. CloudWatch → 결제 알람 생성
  4. 월 사용량 $10 초과 시 알림 설정

### ✅ 4단계: IAM 사용자 생성 (세부 가이드)

- [ ] **관리용 IAM 사용자 생성** ⭐ **보안 필수**

  **Step 1: IAM 사용자 생성 시작**
  1. AWS 콘솔 → **IAM** 서비스 검색 → **IAM** 클릭
  2. 좌측 메뉴 → **사용자** 클릭
  3. **사용자 생성** 버튼 클릭

  **Step 2: 사용자 세부 정보**
  1. **사용자 이름**: `bandauto-admin` 입력
  2. **사용자에게 AWS Management Console에 대한 액세스 권한 제공**: ✅ 체크
  3. **사용자가 새 암호를 생성하도록 요구**: ✅ 체크
  4. **사용자는 다음에 로그인할 때 새 암호를 생성해야 합니다**: ✅ 체크

  **Step 3: 권한 설정**
  1. **권한 옵션**: `직접 정책 연결` 선택
  2. **권한 정책** 검색창에서 `AdministratorAccess` 검색
  3. **AdministratorAccess** ✅ 체크 선택

  **⚠️ 중요**: AdministratorAccess는 모든 권한을 가진 정책입니다. 배포 완료 후 권한을 축소해야 합니다.

  **Step 4: 검토 및 생성**
  1. **사용자 생성** 버튼 클릭
  2. **암호 검색** 클릭하여 임시 암호 확인
  3. **콘솔 로그인 링크** 복사 및 저장

  **Step 5: 액세스 키 생성 (API 접근용)**
  1. 생성된 사용자 `bandauto-admin` 클릭
  2. **보안 자격 증명** 탭 클릭
  3. **액세스 키 만들기** 클릭
  4. **사용 사례**: `Command Line Interface (CLI)` 선택
  5. **위의 권장 사항을 이해했으며 액세스 키를 만들겠습니다** ✅ 체크
  6. **다음** 클릭
  7. **설명 태그 값** (선택사항): `BandAuto 배포용 액세스 키`
  8. **액세스 키 만들기** 클릭

  **⚠️ 매우 중요 - 자격 증명 안전하게 보관:**
  ```
  액세스 키 ID: AKIA... (20자리)
  비밀 액세스 키: ... (40자리)
  ```

  **📝 안전한 보관 방법:**
  - **.csv 파일 다운로드** 클릭하여 안전한 곳에 저장
  - 메모장에 복사하여 USB나 안전한 폴더에 저장
  - **절대로 GitHub이나 공개된 곳에 올리지 말 것**

  **Step 6: MFA 설정 (추가 보안)**
  1. **보안 자격 증명** 탭에서 **MFA 디바이스 할당** 클릭
  2. **MFA 디바이스 이름**: `bandauto-admin-phone` 입력
  3. **MFA 디바이스**: `Authenticator app` 선택
  4. 스마트폰에서 **Google Authenticator** 또는 **Microsoft Authenticator** 앱 설치
  5. QR 코드를 앱으로 스캔
  6. 앱에서 생성되는 6자리 코드 2개를 연속으로 입력
  7. **MFA 할당** 클릭

---

## 🖥️ EC2 인스턴스 생성

### ✅ 5단계: EC2 인스턴스 설정

- [ ] **인스턴스 타입 선택 가이드**

  **권장 사양 (BandAuto 프로젝트):**
  ```
  인스턴스 타입: t3.small
  - vCPU: 2개
  - 메모리: 2GB RAM
  - 네트워크 성능: 최대 5Gbps
  - 월 예상 비용: $16-20 USD

  스토리지: 20GB EBS GP3
  - IOPS: 3,000 (기본값)
  - 처리량: 125MB/s (기본값)
  - 백업: 자동 스냅샷 권장
  ```

  **💡 인스턴스 타입 비교:**
  - `t3.micro` (1GB RAM): 무료티어, 개발/테스트만 적합
  - `t3.small` (2GB RAM): **권장**, 소규모 프로덕션 적합
  - `t3.medium` (4GB RAM): 트래픽 많은 경우 선택

### ✅ 6단계: 인스턴스 생성 단계별 가이드

- [ ] **Step 1: AMI(Amazon Machine Image) 선택**
  1. AWS 콘솔 → EC2 → 인스턴스 → **인스턴스 시작** 클릭
  2. **검색창에 "Ubuntu" 입력**
  3. **"Ubuntu Server 22.04 LTS (HVM), SSD Volume Type"** 선택
  4. **아키텍처**: `64비트 (x86)` 선택
  5. ✅ **프리 티어 사용 가능** 표시 확인

- [ ] **Step 2: 인스턴스 유형 선택**
  1. **인스턴스 유형**: `t3.small` 선택
  2. **vCPU**: 2개 확인
  3. **메모리**: 2.0GiB 확인
  4. **네트워크 성능**: 최대 5Gbps 확인

- [ ] **Step 3: 키 페어 생성**
  1. **키 페어 생성** 클릭
  2. **키 페어 이름**: `bandauto-keypair` 입력
  3. **키 페어 유형**: `RSA` 선택
  4. **프라이빗 키 파일 형식**: `.pem` 선택
  5. **키 페어 생성** 클릭
  6. **`bandauto-keypair.pem` 파일 다운로드**
  7. **⚠️ 중요**: 이 파일을 안전한 곳에 보관 (분실 시 서버 접근 불가)

  **Windows 사용자 추가 설정:**
  ```cmd
  # 다운로드 폴더에서 실행 (관리자 권한 PowerShell)
  icacls "bandauto-keypair.pem" /inheritancelevel:r /grant:r "%username%:R"
  ```

### ✅ 7단계: 네트워크 설정 (매우 중요)

- [ ] **보안 그룹 생성 및 설정** ⭐ **보안 최우선**

  **보안 그룹 이름**: `bandauto-security-group`
  **설명**: `BandAuto web application security group`

  **인바운드 규칙 설정 (단계별):**

  **Step 1: SSH 규칙 생성**
  1. **유형**: `SSH` 선택
  2. **프로토콜**: `TCP` (자동 설정됨)
  3. **포트 범위**: `22` (자동 설정됨)
  4. **소스**: `내 IP` 클릭 → 자동으로 현재 IP/32 입력됨
  5. **설명**: `SSH access from my IP` 입력

  **❌ SSH 설정 시 자주 발생하는 오류 해결:**

  **문제**: "기존 참조된 그룹 ID 규칙에 an IPv4 CIDR을(를) 지정할 수 없습니다"

  **해결방법:**
  ```
  1. "소스" 필드에서 "내 IP" 대신 "사용자 지정" 선택
  2. 내 IP 주소를 직접 입력: YOUR_IP/32
  3. 예시: 203.123.45.67/32
  ```

  **🆘 AWS 콘솔에서 바로 IP 확인하기:**
  ```
  1. AWS 콘솔 상단 검색창에 "CloudShell" 입력
  2. CloudShell 서비스 클릭 (무료)
  3. 터미널에서 명령어 실행: curl ifconfig.me
  4. 출력된 IP 주소 복사
  5. 보안 그룹 설정으로 돌아가서 IP/32 형식으로 입력
  ```

  **내 IP 확인 및 입력 방법:**
  1. **내 IP 확인 (3가지 방법)**:

     **방법 1: Google 검색**
     - Google에서 "내 IP 주소" 또는 "my ip" 검색
     - 바로 IP 주소가 표시됨 (가장 쉬움)

     **방법 2: 전용 웹사이트**
     - [https://whatismyipaddress.com](https://whatismyipaddress.com) 접속
     - [https://ipinfo.io/ip](https://ipinfo.io/ip) 접속

     **방법 3: 터미널/명령프롬프트**
     ```bash
     # Windows (PowerShell)
     (Invoke-WebRequest -uri "http://ifconfig.me/ip").Content

     # Mac/Linux
     curl ifconfig.me

     # 또는
     curl ipinfo.io/ip
     ```

  2. **보안 그룹에 입력**:
     - 소스 타입: `사용자 지정`
     - 소스 값: `203.123.45.67/32` (본인 IP + /32)
     - `/32`는 정확히 해당 IP 주소만 허용한다는 의미

  **Step 2: HTTP 규칙 생성**
  1. **인바운드 규칙 추가** 클릭
  2. **유형**: `HTTP` 선택
  3. **소스**: `위치 무관 (0.0.0.0/0)` 또는 `Anywhere-IPv4` 선택
  4. **설명**: `HTTP web traffic`

  **Step 3: HTTPS 규칙 생성**
  1. **인바운드 규칙 추가** 클릭
  2. **유형**: `HTTPS` 선택
  3. **소스**: `위치 무관 (0.0.0.0/0)` 또는 `Anywhere-IPv4` 선택
  4. **설명**: `HTTPS web traffic`

  **Step 4: Next.js 개발 서버용 (선택사항)**
  1. **인바운드 규칙 추가** 클릭
  2. **유형**: `사용자 지정 TCP`
  3. **포트 범위**: `3000`
  4. **소스**: `사용자 지정` → `YOUR_IP/32`
  5. **설명**: `Next.js dev server (temporary)`

  **✅ 최종 보안 규칙 확인:**
  | 유형 | 프로토콜 | 포트 | 소스 | 설명 |
  |------|----------|------|------|------|
  | SSH | TCP | 22 | `YOUR_IP/32` | SSH 접근 |
  | HTTP | TCP | 80 | `0.0.0.0/0` | 웹 트래픽 |
  | HTTPS | TCP | 443 | `0.0.0.0/0` | 보안 웹 트래픽 |
  | 사용자 지정 TCP | TCP | 3000 | `YOUR_IP/32` | 개발서버 (임시) |

  **🔧 문제 해결 팁:**

  **문제 1**: "내 IP"가 자동으로 입력되지 않을 때
  ```
  해결: 수동으로 IP 입력
  1. 내 IP 확인: curl ifconfig.me
  2. 소스 필드에 "IP주소/32" 형식으로 입력
  ```

  **문제 2**: IP 주소가 자주 바뀔 때 (유동 IP)
  ```
  해결: IP 범위로 설정
  1. ISP의 IP 대역 확인
  2. 예: 203.123.45.0/24 (같은 대역 허용)
  ⚠️ 보안상 권장하지 않음, 가능하면 정확한 IP 사용
  ```

  **문제 3**: 회사/공공 와이파이에서 접속할 때
  ```
  해결: 추가 IP 규칙 생성
  1. 각 위치별로 별도 SSH 규칙 추가
  2. 집 IP: 203.123.45.67/32
  3. 회사 IP: 210.98.76.54/32
  ```

### ✅ 8단계: 스토리지 구성

- [ ] **EBS 볼륨 설정**
  1. **볼륨 유형**: `gp3` (General Purpose SSD) 선택
  2. **크기**: `20 GiB` 입력
  3. **IOPS**: `3000` (기본값 유지)
  4. **처리량**: `125 MB/s` (기본값 유지)
  5. **종료 시 삭제**: ✅ 체크 (인스턴스 종료 시 같이 삭제)
  6. **암호화**: ✅ 체크 (보안 강화)

  **💡 스토리지 용량 가이드:**
  - 20GB: 기본 시스템 + Node.js + 데이터베이스
  - 추후 용량 부족 시 AWS 콘솔에서 확장 가능

### ✅ 9단계: 고급 세부 정보

- [ ] **고급 설정 (선택사항)**
  1. **IAM 인스턴스 프로파일**: 없음 (기본값)
  2. **종료 방식**: `중지` 선택 (실수로 삭제 방지)
  3. **종료 보호 활성화**: ✅ 체크 권장 (실수 삭제 방지)
  4. **모니터링**: `CloudWatch 세부 모니터링 활성화` ✅ 체크
  5. **크레딧 사양**: `표준` (기본값)

### ✅ 10단계: 인스턴스 시작 및 확인

- [ ] **최종 검토 및 시작**
  1. **인스턴스 시작** 클릭
  2. **시작 상태 확인**: "인스턴스가 시작 중입니다" 메시지 확인
  3. **인스턴스 ID 기록**: `i-0123456789abcdef0` (예시)
  4. **인스턴스 상태**: `running`이 될 때까지 2-3분 대기

### ✅ 11단계: Elastic IP 할당 (고정 IP)

- [ ] **Elastic IP 생성 및 연결**
  1. **EC2 콘솔** → **네트워크 및 보안** → **탄력적 IP**
  2. **탄력적 IP 주소 할당** 클릭
  3. **네트워크 경계 그룹**: 기본값 유지
  4. **할당** 클릭
  5. **생성된 IP 주소 선택** → **작업** → **탄력적 IP 주소 연결**
  6. **인스턴스**: 방금 생성한 인스턴스 선택
  7. **프라이빗 IP 주소**: 자동 선택된 값 유지
  8. **연결** 클릭

  **⚠️ 중요**: Elastic IP는 인스턴스가 실행 중일 때 무료입니다. 인스턴스를 중지하면 시간당 요금이 부과됩니다.

  **IP 주소 기록:**
  ```
  Elastic IP: _____._____._____._____ (여기에 할당받은 IP 기록)
  ```

### ✅ 12단계: 인스턴스 접속 테스트

- [ ] **SSH 접속 확인**

  **Windows 사용자 (PowerShell):**
  ```powershell
  # PowerShell을 관리자 권한으로 실행
  ssh -i "C:\path\to\bandauto-keypair.pem" ubuntu@YOUR_ELASTIC_IP

  # 예시:
  ssh -i "C:\Users\YourName\Downloads\bandauto-keypair.pem" ubuntu@13.125.123.45
  ```

  **Mac/Linux 사용자:**
  ```bash
  # 키 파일 권한 설정
  chmod 400 ~/Downloads/bandauto-keypair.pem

  # SSH 접속
  ssh -i ~/Downloads/bandauto-keypair.pem ubuntu@YOUR_ELASTIC_IP
  ```

  **✅ 접속 성공 시 나타나는 화면:**
  ```
  Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.19.0-1029-aws x86_64)

  * Documentation:  https://help.ubuntu.com
  * Management:     https://landscape.canonical.com
  * Support:        https://ubuntu.com/advantage

  ubuntu@ip-xxx-xxx-xxx-xxx:~$
  ```

### 💰 **예상 비용 (월간)**

| 서비스 | 사양 | 월 비용 (USD) |
|--------|------|---------------|
| EC2 t3.small | 2GB RAM, 2 vCPU | $16.79 |
| EBS gp3 20GB | 20GB 스토리지 | $1.60 |
| Elastic IP | 1개 (사용 중) | $0.00 |
| 데이터 전송 | 1GB 무료 | $0.00 |
| **총 예상 비용** | | **약 $18-20** |

### 🔧 **문제 해결**

**SSH 접속이 안 될 때:**
1. 보안 그룹에서 SSH(22) 포트가 내 IP로 설정되어 있는지 확인
2. Elastic IP가 올바르게 연결되어 있는지 확인
3. 키 파일 경로와 권한 확인
4. 방화벽이 22번 포트를 차단하고 있는지 확인

**인스턴스가 시작되지 않을 때:**
1. 인스턴스 상태 확인 (pending → running 변경 대기)
2. 시스템 상태 확인에서 오류 메시지 확인
3. 인스턴스 로그 확인

**Elastic IP 연결이 안 될 때:**
1. 인스턴스가 `running` 상태인지 확인
2. VPC와 서브넷이 올바른지 확인
3. 기존에 연결된 Elastic IP가 있다면 먼저 연결 해제

---

## ⚙️ 서버 환경 구성

### ✅ 13단계: 서버 접속 및 기본 설정

- [ ] **서버 첫 접속 및 보안 설정**

  **첫 번째 SSH 접속:**
  ```bash
  # Windows PowerShell (관리자 권한)
  ssh -i "C:\path\to\bandauto-keypair.pem" ubuntu@YOUR_ELASTIC_IP

  # Mac/Linux Terminal
  ssh -i ~/Downloads/bandauto-keypair.pem ubuntu@YOUR_ELASTIC_IP
  ```

  **✅ 접속 성공 확인:**
  - 터미널에 `ubuntu@ip-xxx-xxx-xxx:~$` 프롬프트 표시
  - "Welcome to Ubuntu" 메시지 출력

- [ ] **시스템 업데이트 및 기본 설정**
  ```bash
  # 1. 패키지 리스트 업데이트
  sudo apt update

  # 2. 설치된 패키지 업그레이드 (5-10분 소요)
  sudo apt upgrade -y

  # 3. 필수 도구 설치
  sudo apt install -y curl wget unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

  # 4. 시간대 설정 (한국 시간)
  sudo timedatectl set-timezone Asia/Seoul

  # 5. 시간 확인
  date
  # 출력 예시: Thu Oct 26 14:30:45 KST 2024
  ```

- [ ] **방화벽 설정 (UFW)**
  ```bash
  # 1. UFW 상태 확인
  sudo ufw status

  # 2. SSH 포트 허용 (매우 중요!)
  sudo ufw allow OpenSSH

  # 3. HTTP/HTTPS 포트 허용 (Nginx용)
  sudo ufw allow 'Nginx Full'

  # 4. 또는 개별적으로 허용
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp

  # 5. 방화벽 활성화
  sudo ufw --force enable

  # 6. 설정 확인
  sudo ufw status verbose
  ```

  **✅ 방화벽 설정 결과 확인:**
  ```
  Status: active

  To                         Action      From
  --                         ------      ----
  22/tcp                     ALLOW IN    Anywhere
  80/tcp                     ALLOW IN    Anywhere
  443/tcp                    ALLOW IN    Anywhere
  ```

- [ ] **시스템 리소스 확인**
  ```bash
  # 메모리 사용량 확인
  free -h
  # 예상 출력:
  #               total        used        free      shared  buff/cache   available
  # Mem:           1.9Gi       150Mi       1.5Gi       0.0Ki       250Mi       1.6Gi

  # 디스크 사용량 확인
  df -h
  # 예상 출력:
  # Filesystem      Size  Used Avail Use% Mounted on
  # /dev/root        20G  2.1G   17G  12% /

  # CPU 정보 확인
  lscpu | grep "Model name"
  # 예상 출력: Model name: Intel(R) Xeon(R) CPU E5-2686 v4
  ```

### ✅ 14단계: Node.js 18 및 npm 설치

- [ ] **Node.js 18 LTS 설치 (단계별)**

  **Step 1: NodeSource 공식 저장소 추가**
  ```bash
  # 1. GPG 키 다운로드 및 추가
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/nodesource.gpg

  # 2. NodeSource 저장소 추가
  echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x jammy main" | sudo tee /etc/apt/sources.list.d/nodesource.list

  # 3. 패키지 리스트 업데이트
  sudo apt update
  ```

  **Step 2: Node.js 및 npm 설치**
  ```bash
  # Node.js 18.x 설치 (npm 포함)
  sudo apt-get install -y nodejs

  # 빌드 도구 설치 (네이티브 모듈 컴파일용)
  sudo apt-get install -y build-essential
  ```

  **Step 3: 설치 확인**
  ```bash
  # Node.js 버전 확인
  node --version
  # 예상 출력: v18.18.2

  # npm 버전 확인
  npm --version
  # 예상 출력: 9.8.1

  # 설치 경로 확인
  which node
  # 출력: /usr/bin/node

  which npm
  # 출력: /usr/bin/npm
  ```

  **Step 4: npm 글로벌 패키지 권한 설정**
  ```bash
  # npm 글로벌 디렉토리 확인
  npm config get prefix
  # 출력: /usr

  # 사용자 글로벌 디렉토리 생성
  mkdir -p ~/.npm-global

  # npm 글로벌 디렉토리 변경
  npm config set prefix '~/.npm-global'

  # PATH 환경변수에 추가
  echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc

  # 현재 세션에 적용
  source ~/.bashrc
  ```

  **Step 5: PM2 프로세스 매니저 설치**
  ```bash
  # PM2 글로벌 설치
  npm install -g pm2

  # PM2 버전 확인
  pm2 --version
  # 예상 출력: 5.3.0

  # PM2 상태 확인
  pm2 list
  # 출력: 현재 실행 중인 프로세스 없음 확인
  ```

- [ ] **Git 설치 및 설정**
  ```bash
  # Git 설치
  sudo apt install -y git

  # Git 버전 확인
  git --version
  # 예상 출력: git version 2.34.1

  # Git 사용자 설정 (GitHub과 동일하게)
  git config --global user.name "kims3925"
  git config --global user.email "kims3925@naver.com"

  # 설정 확인
  git config --list | grep user
  ```

### ✅ 15단계: Nginx 웹서버 설치 및 설정

- [ ] **Nginx 설치**
  ```bash
  # 1. Nginx 설치
  sudo apt install nginx -y

  # 2. Nginx 버전 확인
  nginx -v
  # 예상 출력: nginx version: nginx/1.22.1

  # 3. Nginx 시작
  sudo systemctl start nginx

  # 4. 부팅 시 자동 시작 설정
  sudo systemctl enable nginx

  # 5. Nginx 상태 확인
  sudo systemctl status nginx
  # 출력: Active: active (running) 확인
  ```

  **✅ Nginx 설치 확인:**
  - 웹 브라우저에서 `http://YOUR_ELASTIC_IP` 접속
  - "Welcome to nginx!" 페이지 표시되면 성공

- [ ] **Nginx 기본 설정 확인**
  ```bash
  # Nginx 설정 파일 위치 확인
  sudo nginx -t
  # 출력: nginx: configuration file /etc/nginx/nginx.conf syntax is ok

  # 기본 웹 루트 디렉토리 확인
  ls -la /var/www/html/
  # 출력: index.nginx-debian.html 파일 확인

  # Nginx 프로세스 확인
  ps aux | grep nginx
  # 출력: nginx 마스터 및 워커 프로세스 확인
  ```

- [ ] **방화벽에서 웹 트래픽 허용 확인**
  ```bash
  # UFW 상태 확인
  sudo ufw status

  # Nginx 프로필 확인
  sudo ufw app list | grep Nginx
  # 출력: Nginx Full, Nginx HTTP, Nginx HTTPS

  # 이미 설정했지만 재확인
  sudo ufw allow 'Nginx Full'
  ```

### ✅ 16단계: SSL 인증서 도구 설치 (Let's Encrypt)

- [ ] **Certbot 설치**
  ```bash
  # 1. Certbot 및 Nginx 플러그인 설치
  sudo apt install certbot python3-certbot-nginx -y

  # 2. Certbot 버전 확인
  certbot --version
  # 예상 출력: certbot 1.21.0

  # 3. Certbot 테스트 (실제 인증서 발급 아님)
  sudo certbot --nginx --dry-run
  # 출력: "The dry run was successful" 확인
  ```

### ✅ 17단계: 시스템 모니터링 도구 설치

- [ ] **htop 및 기타 모니터링 도구**
  ```bash
  # htop (시스템 리소스 모니터링)
  sudo apt install htop -y

  # 기타 유용한 도구들
  sudo apt install tree ncdu -y

  # htop 실행 테스트
  htop
  # q 키로 종료

  # 디렉토리 트리 확인
  tree /etc/nginx/
  ```

### ✅ 18단계: 방화벽 최종 설정 확인

- [ ] **포트 접근성 테스트**
  ```bash
  # 1. 열린 포트 확인
  sudo netstat -tlnp

  # 2. 방화벽 상태 상세 확인
  sudo ufw status verbose

  # 3. Nginx 포트 리스닝 확인
  sudo lsof -i :80
  sudo lsof -i :443
  ```

  **✅ 예상 출력:**
  ```
  COMMAND PID     USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
  nginx   1234   root    6u  IPv4  12345      0t0  TCP *:80 (LISTEN)
  nginx   1235   www-data 6u  IPv4  12345      0t0  TCP *:80 (LISTEN)
  ```

### ✅ 19단계: 서버 환경 최종 확인

- [ ] **시스템 정보 종합 확인**
  ```bash
  # 시스템 정보 출력
  echo "=== 시스템 정보 ==="
  uname -a

  echo "=== CPU 정보 ==="
  lscpu | grep "Model name"

  echo "=== 메모리 정보 ==="
  free -h

  echo "=== 디스크 정보 ==="
  df -h /

  echo "=== 네트워크 정보 ==="
  ip addr show | grep "inet "

  echo "=== 설치된 소프트웨어 버전 ==="
  node --version
  npm --version
  pm2 --version
  nginx -v
  git --version
  certbot --version

  echo "=== 실행 중인 서비스 ==="
  systemctl is-active nginx
  systemctl is-active ufw

  echo "=== 방화벽 상태 ==="
  sudo ufw status
  ```

  **✅ 모든 확인이 완료되면 다음과 같이 출력됩니다:**
  - Node.js: v18.x.x
  - nginx: active
  - ufw: active
  - 포트 22, 80, 443: 열림

**🎉 서버 환경 구성 완료!**
이제 프로젝트 배포 단계로 진행할 수 있습니다.

---

## 📦 프로젝트 배포

### ✅ 8단계: 프로젝트 업로드

- [ ] **Git 클론**
  ```bash
  # 홈 디렉토리에 프로젝트 클론
  cd /home/ubuntu
  git clone https://github.com/YOUR_USERNAME/bandauto_3.git
  cd bandauto_3
  ```

- [ ] **환경변수 설정** ⭐ **보안 중요**
  ```bash
  # 환경변수 파일 생성
  sudo nano .env.local
  ```

  **환경변수 내용 (실제 값으로 수정 필요):**
  ```env
  # 데이터베이스
  DATABASE_URL="file:/home/ubuntu/bandauto_3/prisma/prod.db"

  # NextAuth 설정
  NEXTAUTH_URL="https://yourdomain.com"
  NEXTAUTH_SECRET="super-secret-key-change-this-in-production"

  # AI 서비스
  GEMINI_API_KEY="your-actual-gemini-api-key"

  # Band API
  BAND_CLIENT_ID="your-band-client-id"
  BAND_CLIENT_SECRET="your-band-client-secret"

  # 토스페이먼츠 (운영 키로 변경)
  TOSS_PAYMENTS_CLIENT_KEY="live_ck_..."
  TOSS_PAYMENTS_SECRET_KEY="live_sk_..."
  TOSS_PAYMENTS_WEBHOOK_SECRET="your-webhook-secret"

  # 결제 URL
  PAYMENT_SUCCESS_URL="https://yourdomain.com/store/payment/success"
  PAYMENT_FAIL_URL="https://yourdomain.com/store/payment/fail"

  # 배송 설정
  FREE_SHIPPING_AMOUNT="30000"
  DEFAULT_SHIPPING_FEE="3000"
  SHOP_ADMIN_EMAIL="admin@yourdomain.com"

  # 프로덕션 환경
  NODE_ENV="production"
  ```

- [ ] **의존성 설치 및 빌드**
  ```bash
  # 의존성 설치
  npm install --production

  # Prisma 설정
  npx prisma generate
  npx prisma db push

  # 프로젝트 빌드
  npm run build
  ```

### ✅ 9단계: PM2로 애플리케이션 실행

- [ ] **PM2 설정 파일 생성**
  ```bash
  # PM2 생태계 파일 생성
  sudo nano ecosystem.config.js
  ```

  **ecosystem.config.js 내용:**
  ```javascript
  module.exports = {
    apps: [{
      name: 'bandauto',
      script: 'npm',
      args: 'start',
      cwd: '/home/ubuntu/bandauto_3',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }]
  }
  ```

- [ ] **PM2로 애플리케이션 시작**
  ```bash
  # PM2로 애플리케이션 시작
  pm2 start ecosystem.config.js

  # PM2 상태 확인
  pm2 status
  pm2 logs bandauto

  # 시스템 재시작 시 자동 시작 설정
  pm2 save
  pm2 startup
  # 출력된 명령어를 복사해서 실행
  ```

### ✅ 10단계: Nginx 리버스 프록시 설정

- [ ] **Nginx 설정 파일 생성**
  ```bash
  # 기본 설정 제거
  sudo rm /etc/nginx/sites-enabled/default

  # 새 설정 파일 생성
  sudo nano /etc/nginx/sites-available/bandauto
  ```

  **Nginx 설정 내용:**
  ```nginx
  server {
      listen 80;
      server_name yourdomain.com www.yourdomain.com;

      # 보안 헤더 추가
      add_header X-Frame-Options "SAMEORIGIN" always;
      add_header X-XSS-Protection "1; mode=block" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header Referrer-Policy "no-referrer-when-downgrade" always;
      add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'; frame-ancestors 'self';" always;

      # 업로드 파일 크기 제한
      client_max_body_size 10M;

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

          # 타임아웃 설정
          proxy_connect_timeout 60s;
          proxy_send_timeout 60s;
          proxy_read_timeout 60s;
      }

      # 정적 파일 캐싱
      location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
          expires 1y;
          add_header Cache-Control "public, immutable";
      }
  }
  ```

- [ ] **Nginx 설정 활성화**
  ```bash
  # 설정 파일 심볼릭 링크 생성
  sudo ln -s /etc/nginx/sites-available/bandauto /etc/nginx/sites-enabled/

  # Nginx 설정 테스트
  sudo nginx -t

  # Nginx 재시작
  sudo systemctl restart nginx
  ```

---

## 🌐 도메인 및 SSL 설정

### ✅ 11단계: 도메인 연결

- [ ] **도메인 구매 및 DNS 설정**
  1. 도메인 등록업체에서 도메인 구매 (예: 가비아, 후이즈)
  2. DNS 레코드 설정:
     ```
     A 레코드: yourdomain.com → YOUR_ELASTIC_IP
     A 레코드: www.yourdomain.com → YOUR_ELASTIC_IP
     ```
  3. DNS 전파 확인 (최대 24시간 소요)

- [ ] **SSL 인증서 설치**
  ```bash
  # Let's Encrypt SSL 인증서 자동 설치
  sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

  # 이메일 주소 입력 및 약관 동의
  # 뉴스레터 구독 선택 (선택사항)

  # SSL 인증서 자동 갱신 설정
  sudo crontab -e
  # 다음 라인 추가:
  0 12 * * * /usr/bin/certbot renew --quiet
  ```

### ✅ 12단계: HTTPS 리다이렉트 확인

- [ ] **Certbot 자동 설정 확인**
  ```bash
  # Nginx 설정 파일 확인
  sudo nano /etc/nginx/sites-available/bandauto

  # HTTP → HTTPS 리다이렉트가 자동으로 추가되었는지 확인
  # SSL 설정이 올바르게 추가되었는지 확인

  # Nginx 재시작
  sudo systemctl restart nginx
  ```

- [ ] **SSL 등급 확인**
  - [SSL Labs](https://www.ssllabs.com/ssltest/)에서 도메인 테스트
  - A+ 등급 목표

---

## 📊 모니터링 및 백업

### ✅ 13단계: 모니터링 설정

- [ ] **시스템 모니터링**
  ```bash
  # htop 설치 (시스템 리소스 모니터링)
  sudo apt install htop -y

  # 로그 로테이션 설정
  sudo nano /etc/logrotate.d/bandauto
  ```

  **로그 로테이션 설정:**
  ```
  /home/ubuntu/bandauto_3/.next/logs/*.log {
      daily
      missingok
      rotate 30
      compress
      notifempty
      copytruncate
  }
  ```

- [ ] **PM2 모니터링**
  ```bash
  # PM2 모니터링 명령어들
  pm2 monit          # 실시간 모니터링
  pm2 logs bandauto  # 로그 확인
  pm2 restart bandauto  # 재시작
  ```

### ✅ 14단계: 백업 시스템 구성

- [ ] **데이터베이스 백업 스크립트**
  ```bash
  # 백업 스크립트 생성
  sudo nano /home/ubuntu/backup.sh
  ```

  **백업 스크립트 내용:**
  ```bash
  #!/bin/bash
  DATE=$(date +%Y%m%d_%H%M%S)
  BACKUP_DIR="/home/ubuntu/backups"
  PROJECT_DIR="/home/ubuntu/bandauto_3"

  # 백업 디렉토리 생성
  mkdir -p $BACKUP_DIR

  # 데이터베이스 백업
  cp $PROJECT_DIR/prisma/prod.db $BACKUP_DIR/db_backup_$DATE.db

  # 환경변수 백업 (민감한 정보 주의)
  cp $PROJECT_DIR/.env.local $BACKUP_DIR/env_backup_$DATE.txt

  # 7일 이상된 백업 파일 삭제
  find $BACKUP_DIR -name "*.db" -mtime +7 -delete
  find $BACKUP_DIR -name "*.txt" -mtime +7 -delete

  echo "Backup completed: $DATE"
  ```

- [ ] **백업 스크립트 권한 및 자동 실행**
  ```bash
  # 실행 권한 부여
  chmod +x /home/ubuntu/backup.sh

  # 크론잡 설정 (매일 새벽 2시)
  sudo crontab -e
  # 다음 라인 추가:
  0 2 * * * /home/ubuntu/backup.sh >> /var/log/backup.log 2>&1
  ```

---

## 🔐 보안 체크리스트

### ✅ 15단계: 보안 강화

- [ ] **방화벽 재확인**
  ```bash
  # UFW 상태 확인
  sudo ufw status verbose

  # 불필요한 포트 차단 확인
  sudo ufw deny 3000  # Next.js 직접 접근 차단 (Nginx 프록시만 허용)
  ```

- [ ] **SSH 보안 강화**
  ```bash
  # SSH 설정 파일 편집
  sudo nano /etc/ssh/sshd_config

  # 다음 설정들을 확인/수정:
  # Port 22 (또는 다른 포트로 변경)
  # PermitRootLogin no
  # PasswordAuthentication no
  # PubkeyAuthentication yes
  # MaxAuthTries 3

  # SSH 재시작
  sudo systemctl restart sshd
  ```

- [ ] **시스템 보안 업데이트**
  ```bash
  # 자동 보안 업데이트 설정
  sudo apt install unattended-upgrades -y
  sudo dpkg-reconfigure -plow unattended-upgrades

  # fail2ban 설치 (브루트포스 공격 차단)
  sudo apt install fail2ban -y
  sudo systemctl enable fail2ban
  sudo systemctl start fail2ban
  ```

### ✅ 16단계: 환경변수 보안

- [ ] **환경변수 파일 권한 설정**
  ```bash
  # .env.local 파일 권한을 소유자만 읽기 가능하도록 설정
  chmod 600 /home/ubuntu/bandauto_3/.env.local

  # 소유자 확인
  ls -la /home/ubuntu/bandauto_3/.env.local
  ```

- [ ] **민감한 키 재생성**
  - NextAuth Secret 키 새로 생성
  - 토스페이먼츠 API 키 운영용으로 교체
  - 데이터베이스 접근 권한 최소화

---

## 🧪 배포 후 테스트

### ✅ 17단계: 기능 테스트

- [ ] **웹사이트 접근 테스트**
  - [ ] https://yourdomain.com 접속 확인
  - [ ] HTTP → HTTPS 자동 리다이렉트 확인
  - [ ] SSL 인증서 유효성 확인

- [ ] **핵심 기능 테스트**
  - [ ] 회원가입/로그인 기능
  - [ ] 상품 조회 기능
  - [ ] 장바구니 기능
  - [ ] 결제 테스트 (소액)
  - [ ] 관리자 대시보드 접근

- [ ] **성능 테스트**
  ```bash
  # 페이지 로딩 속도 확인
  curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com
  ```

### ✅ 18단계: 모니터링 확인

- [ ] **로그 확인**
  ```bash
  # PM2 로그 확인
  pm2 logs bandauto --lines 100

  # Nginx 로그 확인
  sudo tail -f /var/log/nginx/access.log
  sudo tail -f /var/log/nginx/error.log

  # 시스템 리소스 확인
  htop
  df -h  # 디스크 사용량
  free -h  # 메모리 사용량
  ```

---

## 🚨 긴급 상황 대응

### 🆘 문제 해결 가이드

**웹사이트가 안 열릴 때:**
```bash
# 1. PM2 상태 확인
pm2 status

# 2. PM2 재시작
pm2 restart bandauto

# 3. Nginx 상태 확인
sudo systemctl status nginx

# 4. Nginx 재시작
sudo systemctl restart nginx

# 5. 로그 확인
pm2 logs bandauto --lines 50
```

**데이터베이스 문제:**
```bash
# 1. 백업에서 복구
cp /home/ubuntu/backups/db_backup_YYYYMMDD_HHMMSS.db /home/ubuntu/bandauto_3/prisma/prod.db

# 2. 권한 설정
chmod 644 /home/ubuntu/bandauto_3/prisma/prod.db

# 3. 애플리케이션 재시작
pm2 restart bandauto
```

**SSL 인증서 만료:**
```bash
# 수동 갱신
sudo certbot renew

# Nginx 재시작
sudo systemctl restart nginx
```

---

## 📞 지원 및 연락처

### 🔗 유용한 리소스

- **AWS 프리티어 한도 확인**: [AWS 콘솔 > 결제 > 프리티어](https://console.aws.amazon.com/billing/home#/freetier)
- **도메인 DNS 전파 확인**: [whatsmydns.net](https://www.whatsmydns.net)
- **SSL 인증서 테스트**: [SSL Labs](https://www.ssllabs.com/ssltest/)
- **웹사이트 속도 테스트**: [PageSpeed Insights](https://pagespeed.web.dev)

### 📋 체크리스트 요약

**배포 전:**
- [ ] 로컬 빌드 테스트 완료
- [ ] 환경변수 정리 완료
- [ ] Git 커밋 완료

**AWS 설정:**
- [ ] MFA 설정 완료
- [ ] IAM 사용자 생성 완료
- [ ] EC2 인스턴스 생성 완료
- [ ] Elastic IP 할당 완료

**서버 구성:**
- [ ] Node.js 설치 완료
- [ ] PM2 설치 및 설정 완료
- [ ] Nginx 설치 및 설정 완료

**배포:**
- [ ] 프로젝트 업로드 완료
- [ ] 환경변수 설정 완료
- [ ] 빌드 및 실행 완료

**보안:**
- [ ] SSL 인증서 설치 완료
- [ ] 방화벽 설정 완료
- [ ] SSH 보안 강화 완료

**모니터링:**
- [ ] 백업 시스템 구성 완료
- [ ] 로그 로테이션 설정 완료
- [ ] 모니터링 도구 설정 완료

---

## 💡 추가 권장사항

### 성능 최적화
- CloudFront CDN 적용 (이미지 로딩 속도 향상)
- RDS 데이터베이스 마이그레이션 (SQLite → PostgreSQL)
- Redis 캐시 서버 도입

### 확장성 고려
- Application Load Balancer 적용
- Auto Scaling Group 설정
- 다중 가용영역 배포

**⚠️ 중요 안내:**
- 이 가이드를 따라하기 전에 테스트 환경에서 먼저 실습해보세요
- 모든 비밀번호와 API 키는 강력하게 설정하세요
- 정기적으로 백업을 확인하고 복구 테스트를 수행하세요
- AWS 비용을 정기적으로 모니터링하세요

---

*🚀 성공적인 배포를 위해 단계별로 차근차근 진행하세요!*