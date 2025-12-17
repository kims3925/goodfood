# AWS 서버 분리 계획

> 프로덕션 서버와 Jenkins CI/CD 서버 분리

## 개요

### 현재 상태

```
┌─────────────────────────────────────────────────────┐
│           EC2 인스턴스 (43.200.225.91)              │
│                 탄력적 IP 사용                       │
│                                                     │
│  ┌─────────────────┐    ┌─────────────────┐        │
│  │   shop-app      │    │  sourcing-app   │        │
│  │   (포트 3000)    │    │   (포트 3001)    │        │
│  └─────────────────┘    └─────────────────┘        │
│                                                     │
│  ┌─────────────────┐    ┌─────────────────┐        │
│  │    Jenkins      │    │      PM2        │        │
│  │   (포트 8080)    │    │   프로세스 관리   │        │
│  └─────────────────┘    └─────────────────┘        │
│                                                     │
│  ┌─────────────────┐    ┌─────────────────┐        │
│  │     Nginx       │    │    SQLite DB    │        │
│  │   리버스 프록시   │    │                 │        │
│  └─────────────────┘    └─────────────────┘        │
└─────────────────────────────────────────────────────┘
```

### 문제점

| 문제 | 설명 | 영향도 |
|------|------|--------|
| 리소스 경쟁 | Jenkins 빌드 시 CPU/메모리 급증 | 높음 |
| 보안 위험 | Jenkins 크리덴셜이 프로덕션 서버에 노출 | 높음 |
| 단일 장애점 | 서버 장애 시 CI/CD + 프로덕션 동시 중단 | 높음 |
| 스케일링 제약 | 각기 다른 스케일링 요구사항 충돌 | 중간 |
| 유지보수 어려움 | Jenkins 업데이트 시 프로덕션 영향 가능 | 중간 |

---

## 목표 아키텍처

```
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│   프로덕션 서버                   │    │   CI/CD 서버                     │
│   43.200.225.91 (탄력적 IP)      │    │   [유동 IP] (탄력적 IP 불필요)    │
│                                 │    │                                 │
│  ┌───────────┐ ┌───────────┐   │    │  ┌─────────────────────────┐   │
│  │ shop-app  │ │ sourcing  │   │    │  │        Jenkins          │   │
│  │  :3000    │ │   :3001   │   │    │  │        :8080            │   │
│  └───────────┘ └───────────┘   │    │  └─────────────────────────┘   │
│                                 │    │                                 │
│  ┌───────────┐ ┌───────────┐   │    │  ┌─────────────────────────┐   │
│  │   Nginx   │ │    PM2    │   │    │  │     Node.js 24          │   │
│  │   :80/443 │ │           │   │    │  │     Git, npm            │   │
│  └───────────┘ └───────────┘   │    │  └─────────────────────────┘   │
│                                 │    │                                 │
│  ┌───────────────────────────┐ │    │                                 │
│  │        SQLite DB          │ │    │                                 │
│  └───────────────────────────┘ │    │                                 │
└─────────────────────────────────┘    └─────────────────────────────────┘
              ▲                                      │
              │         SSH 배포 (포트 22)            │
              └──────────────────────────────────────┘
```

### Jenkins 탄력적 IP가 불필요한 이유

1. **웹훅 URL 변경 빈도 낮음**: 서버 재시작은 드묾
2. **비용 절감**: 월 $3.6 절약
3. **대안 존재**: Route 53으로 DNS 기반 관리 가능
4. **내부 접근 위주**: 관리자만 접근하므로 IP 변경 영향 적음

---

## 사전 요구사항 확인

### 체크리스트

- [ ] 현재 서버 SSH 접근 가능 확인
- [ ] AWS 콘솔 접근 권한 확인
- [ ] Jenkins 관리자 계정 정보 확인
- [ ] GitHub/GitLab 웹훅 설정 위치 확인
- [ ] 현재 Jenkins 크리덴셜 목록 확인
- [ ] 프로덕션 서버 도메인 및 SSL 인증서 확인

### 현재 Jenkins 크리덴셜 (Jenkinsfile 기준)

```
- nextauth-secret
- guest-secret
- jwt-secret
```

---

## 단계별 실행 계획

### Phase 1: 새 Jenkins EC2 인스턴스 생성

**예상 소요 시간: 30분**

#### 1.1 EC2 인스턴스 생성

**AWS 콘솔 설정:**

| 항목 | 권장 값 |
|------|--------|
| 이름 | bandauto-jenkins |
| AMI | Ubuntu Server 22.04 LTS |
| 인스턴스 타입 | t3.small (또는 t3.medium) |
| 키 페어 | 기존 키 페어 사용 또는 새로 생성 |
| 스토리지 | 30GB gp3 |
| 탄력적 IP | 불필요 (선택사항) |

#### 1.2 보안 그룹 설정

**인바운드 규칙:**

| 타입 | 포트 | 소스 | 설명 |
|------|------|------|------|
| SSH | 22 | 내 IP | 관리자 SSH 접근 |
| Custom TCP | 8080 | 내 IP | Jenkins 웹 UI |
| Custom TCP | 8080 | GitHub IP 대역 | GitHub 웹훅 |

**GitHub 웹훅 IP 대역 (선택사항):**
```
140.82.112.0/20
143.55.64.0/20
185.199.108.0/22
192.30.252.0/22
```

#### 1.3 SSH 키 생성 (Jenkins → 프로덕션 배포용)

```bash
# 새 Jenkins 서버에서 실행
ssh-keygen -t ed25519 -C "jenkins-deploy" -f ~/.ssh/jenkins_deploy

# 공개키 확인
cat ~/.ssh/jenkins_deploy.pub
```

**프로덕션 서버에 공개키 등록:**
```bash
# 프로덕션 서버 (43.200.225.91)에서 실행
echo "ssh-ed25519 AAAA... jenkins-deploy" >> ~/.ssh/authorized_keys
```

---

### Phase 2: Jenkins 설치 및 설정

**예상 소요 시간: 30분**

#### 2.1 기본 패키지 설치

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 필수 패키지 설치
sudo apt install -y curl git fontconfig openjdk-17-jre

# Java 버전 확인
java -version
```

#### 2.2 Jenkins 설치

```bash
# Jenkins 저장소 키 추가
sudo wget -O /usr/share/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key

# 저장소 추가
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc]" \
  "https://pkg.jenkins.io/debian-stable binary/" | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

# Jenkins 설치
sudo apt update
sudo apt install jenkins -y

# 서비스 시작
sudo systemctl enable jenkins
sudo systemctl start jenkins

# 초기 비밀번호 확인
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

#### 2.3 Node.js 24 설치

```bash
# NVM 설치
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Node.js 24 설치
nvm install 24
nvm use 24
nvm alias default 24

# 확인
node -v  # v24.x.x
npm -v
```

#### 2.4 Jenkins에 Node.js 플러그인 설정

1. Jenkins 관리 → 플러그인 관리 → NodeJS 플러그인 설치
2. Jenkins 관리 → Tools → NodeJS installations
3. 이름: `NodeJS-24`, 버전: `24.x.x` 설정

---

### Phase 3: Jenkins 데이터 마이그레이션

**예상 소요 시간: 40분**

#### 3.1 기존 Jenkins 백업

```bash
# 기존 서버 (43.200.225.91)에서 실행
sudo systemctl stop jenkins

# 백업 생성
sudo tar -czvf /tmp/jenkins-backup-$(date +%Y%m%d).tar.gz \
  /var/lib/jenkins/config.xml \
  /var/lib/jenkins/credentials.xml \
  /var/lib/jenkins/jobs \
  /var/lib/jenkins/users \
  /var/lib/jenkins/secrets \
  /var/lib/jenkins/plugins

# 백업 파일 크기 확인
ls -lh /tmp/jenkins-backup-*.tar.gz
```

#### 3.2 백업 파일 전송

```bash
# 새 Jenkins 서버로 전송
scp /tmp/jenkins-backup-*.tar.gz ubuntu@[새서버IP]:/tmp/
```

#### 3.3 새 서버에서 복원

```bash
# 새 Jenkins 서버에서 실행
sudo systemctl stop jenkins

# 기존 설정 백업
sudo mv /var/lib/jenkins /var/lib/jenkins.original

# 복원
sudo mkdir /var/lib/jenkins
sudo tar -xzvf /tmp/jenkins-backup-*.tar.gz -C /

# 권한 설정
sudo chown -R jenkins:jenkins /var/lib/jenkins

# Jenkins 시작
sudo systemctl start jenkins

# 로그 확인
sudo journalctl -u jenkins -f
```

#### 3.4 크리덴셜 재설정 확인

Jenkins 웹 UI 접속 후:
1. Jenkins 관리 → Credentials 확인
2. 다음 크리덴셜 존재 확인:
   - `nextauth-secret`
   - `guest-secret`
   - `jwt-secret`

---

### Phase 4: Jenkinsfile 수정

**예상 소요 시간: 20분**

#### 4.1 SSH 배포 방식으로 변경

기존 Jenkinsfile의 Deploy 스테이지를 다음과 같이 수정:

```groovy
pipeline {
    agent any

    tools {
        nodejs 'NodeJS-24'
    }

    environment {
        PROJECT_PATH = '/home/ubuntu/bandauto'
        PRODUCTION_SERVER = '43.200.225.91'
        PRODUCTION_USER = 'ubuntu'
        NEXTAUTH_SECRET = credentials('nextauth-secret')
        GUEST_TOKEN_SECRET = credentials('guest-secret')
        JWT_SECRET = credentials('jwt-secret')
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing dependencies...'
                sh 'npm ci --legacy-peer-deps'
            }
        }

        stage('Generate Prisma Client') {
            steps {
                echo 'Generating Prisma client...'
                dir('db') {
                    sh 'npx prisma generate --schema prisma'
                }
            }
        }

        stage('Build Applications') {
            parallel {
                stage('Build shop-app') {
                    steps {
                        echo 'Building shop-app...'
                        sh 'npm run build:shop'
                    }
                }
                stage('Build sourcing-app') {
                    steps {
                        echo 'Building sourcing-app...'
                        sh 'npm run build:sourcing'
                    }
                }
            }
        }

        stage('Deploy to Production') {
            steps {
                echo 'Deploying to production server...'
                sshagent(['production-server-ssh-key']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no ${PRODUCTION_USER}@${PRODUCTION_SERVER} << 'ENDSSH'
                            cd ${PROJECT_PATH}

                            echo "=== Starting deployment ==="

                            # Git pull
                            echo ">>> Pulling latest code..."
                            git fetch origin main
                            git reset --hard origin/main

                            # Install dependencies
                            echo ">>> Installing dependencies..."
                            npm ci --legacy-peer-deps

                            # Generate Prisma client
                            echo ">>> Generating Prisma client..."
                            cd db
                            npx prisma generate --schema prisma
                            cd ..

                            # Build applications
                            echo ">>> Building applications..."
                            npm run build:shop
                            npm run build:sourcing

                            # Restart PM2
                            echo ">>> Restarting PM2 processes..."
                            pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js

                            # Verify
                            echo ">>> Verifying deployment..."
                            pm2 status

                            echo "=== Deployment completed! ==="
ENDSSH
                    """
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed!'
        }
        always {
            echo "Build #${env.BUILD_NUMBER} finished with status: ${currentBuild.currentResult}"
            cleanWs()
        }
    }
}
```

#### 4.2 SSH Credentials 등록

Jenkins 관리 → Credentials → System → Global credentials:

1. **Add Credentials** 클릭
2. Kind: **SSH Username with private key**
3. ID: `production-server-ssh-key`
4. Username: `ubuntu`
5. Private Key: Enter directly → 새 Jenkins 서버의 `~/.ssh/jenkins_deploy` 내용 붙여넣기

---

### Phase 5: 웹훅 및 연동 설정

**예상 소요 시간: 15분**

#### 5.1 GitHub 웹훅 URL 변경

**저장소 설정:**
1. GitHub → Repository → Settings → Webhooks
2. 기존 웹훅 수정 또는 새로 추가

**웹훅 URL:**
```
기존: http://43.200.225.91:8080/github-webhook/
변경: http://[새Jenkins서버IP]:8080/github-webhook/
```

**설정값:**
| 항목 | 값 |
|------|-----|
| Payload URL | http://[새IP]:8080/github-webhook/ |
| Content type | application/json |
| Events | Just the push event |

#### 5.2 Jenkins 프로젝트 웹훅 트리거 확인

1. Jenkins → 해당 Job → Configure
2. Build Triggers → "GitHub hook trigger for GITScm polling" 체크 확인

---

### Phase 6: 테스트 및 검증

**예상 소요 시간: 30분**

#### 6.1 연결 테스트

```bash
# 새 Jenkins 서버에서 실행
# 프로덕션 서버 SSH 연결 테스트
ssh -i ~/.ssh/jenkins_deploy ubuntu@43.200.225.91 "echo 'SSH OK'"

# 프로젝트 디렉토리 확인
ssh -i ~/.ssh/jenkins_deploy ubuntu@43.200.225.91 "ls -la /home/ubuntu/bandauto"
```

#### 6.2 수동 빌드 테스트

1. Jenkins → 해당 Job → Build Now
2. Console Output 확인
3. 각 스테이지 성공 확인:
   - [ ] Checkout
   - [ ] Install Dependencies
   - [ ] Generate Prisma Client
   - [ ] Build shop-app
   - [ ] Build sourcing-app
   - [ ] Deploy to Production

#### 6.3 웹훅 테스트

```bash
# 테스트 커밋 생성
git commit --allow-empty -m "test: Jenkins webhook test"
git push origin main
```

Jenkins에서 자동 빌드 시작 확인

#### 6.4 프로덕션 서비스 확인

```bash
# 프로덕션 서버에서 확인
pm2 status
curl -I http://localhost:3000  # shop-app
curl -I http://localhost:3001  # sourcing-app
```

---

### Phase 7: 기존 서버 정리

**예상 소요 시간: 15분**

> ⚠️ **주의**: 새 Jenkins가 정상 동작하는 것을 충분히 검증한 후 진행

#### 7.1 기존 Jenkins 중지 및 제거

```bash
# 프로덕션 서버 (43.200.225.91)에서 실행
sudo systemctl stop jenkins
sudo systemctl disable jenkins

# Jenkins 제거
sudo apt remove jenkins -y
sudo apt autoremove -y

# 데이터 삭제 (백업 확인 후)
sudo rm -rf /var/lib/jenkins
```

#### 7.2 불필요한 패키지 정리

```bash
# Jenkins 관련 Java만 사용했다면 (Node.js 앱이 Java를 사용하지 않는 경우)
# sudo apt remove openjdk-* -y

# 포트 확인
sudo netstat -tlnp | grep 8080  # 8080 사용 없어야 함
```

#### 7.3 보안 그룹 업데이트

**프로덕션 서버 보안 그룹에서 제거:**
- 포트 8080 (Jenkins) 인바운드 규칙 삭제

---

## 롤백 계획

문제 발생 시 빠른 복구를 위한 계획

### 롤백 시나리오

#### 시나리오 1: 새 Jenkins 서버 문제

```bash
# 기존 서버에서 Jenkins 재시작
sudo systemctl start jenkins

# GitHub 웹훅 URL 원복
# http://43.200.225.91:8080/github-webhook/
```

#### 시나리오 2: SSH 배포 실패

```bash
# 임시로 프로덕션 서버에서 직접 배포
cd /home/ubuntu/bandauto
git pull origin main
npm ci --legacy-peer-deps
cd db && npx prisma generate --schema prisma && cd ..
npm run build:shop
npm run build:sourcing
pm2 reload ecosystem.config.js
```

---

## 비용 분석

### 추가 비용 (월간)

| 항목 | 사양 | 월 비용 (USD) |
|------|------|--------------|
| EC2 t3.small | 2 vCPU, 2GB RAM | ~$15.00 |
| EBS gp3 30GB | 스토리지 | ~$2.40 |
| 데이터 전송 | 예상 10GB | ~$0.90 |
| **소계** | | **~$18.30** |
| 탄력적 IP (미사용) | 절약 | -$3.60 |
| **총 추가 비용** | | **~$18.30** |

### 비용 최적화 옵션

1. **스팟 인스턴스 사용**: 최대 70% 절감 가능 (~$5.50/월)
2. **예약 인스턴스 (1년)**: 약 30% 절감
3. **Savings Plans**: 유연한 할인

### 비용 대비 이점

| 이점 | 가치 |
|------|------|
| 프로덕션 안정성 향상 | 높음 |
| 보안 리스크 감소 | 높음 |
| 독립적 스케일링 가능 | 중간 |
| 유지보수 용이성 | 중간 |

---

## 최종 체크리스트

### 마이그레이션 완료 확인

- [ ] 새 Jenkins EC2 인스턴스 생성 완료
- [ ] Jenkins 설치 및 설정 완료
- [ ] Node.js 24 설치 완료
- [ ] 기존 Jenkins 데이터 마이그레이션 완료
- [ ] SSH 키 설정 및 연결 테스트 완료
- [ ] Jenkinsfile 수정 및 커밋 완료
- [ ] GitHub 웹훅 URL 변경 완료
- [ ] 수동 빌드 테스트 성공
- [ ] 웹훅 자동 빌드 테스트 성공
- [ ] 프로덕션 서비스 정상 동작 확인
- [ ] 기존 서버 Jenkins 제거 완료
- [ ] 프로덕션 서버 보안 그룹 업데이트 완료

### 문서화

- [ ] 새 Jenkins 서버 IP 기록
- [ ] SSH 키 위치 및 백업 기록
- [ ] 팀원 공유 완료

---

## 참고 자료

- [Jenkins 공식 설치 가이드](https://www.jenkins.io/doc/book/installing/linux/)
- [AWS EC2 사용 설명서](https://docs.aws.amazon.com/ec2/)
- [GitHub Webhooks 설정](https://docs.github.com/en/webhooks)

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 2024-12-17 | 1.0 | 최초 작성 | - |
