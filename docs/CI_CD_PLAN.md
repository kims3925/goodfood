# Bandauto CI/CD 구현 계획서 (Jenkins)

## 개요

| 항목 | 내용 |
|------|------|
| **프로젝트** | Bandauto Monorepo |
| **배포 대상** | AWS EC2 |
| **CI/CD 도구** | Jenkins |
| **프로세스 관리** | PM2 |
| **적용 앱** | shop-app, sourcing-app |

---

## 1. 아키텍처 다이어그램

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   GitHub    │────▶│     Jenkins      │────▶│   AWS EC2   │
│  (Webhook)  │     │   (빌드 & 배포)   │     │  (PM2 배포)  │
└─────────────┘     └──────────────────┘     └─────────────┘
       │                     │                      │
       │                     ▼                      ▼
  Push 트리거          ┌────────────┐         ┌───────────┐
                      │ Jenkinsfile │         │ shop:3000 │
                      │  Pipeline   │         │sourcing:3001│
                      └────────────┘         └───────────┘
```

---

## 2. Jenkins 설치 옵션

### Option A: EC2에 Jenkins 직접 설치 (간단)
- 기존 EC2에 Jenkins 설치
- 같은 서버에서 빌드 & 배포
- 소규모 프로젝트에 적합

### Option B: 별도 Jenkins 서버 (권장)
- Jenkins 전용 EC2 인스턴스
- 배포 대상 EC2와 분리
- 확장성, 보안 우수

### Option C: Docker로 Jenkins 실행
- 컨테이너 기반 Jenkins
- 관리 용이, 이식성 좋음

---

## 3. 구현 단계 (TODO)

### Phase 1: Jenkins 서버 준비
- [ ] Jenkins 설치 방식 결정 (Option A/B/C)
- [ ] EC2에 Jenkins 설치
- [ ] Jenkins 초기 설정 (관리자 계정)
- [ ] 필수 플러그인 설치

### Phase 2: Jenkins 플러그인 설치
- [ ] NodeJS Plugin
- [ ] Git Plugin
- [ ] SSH Agent Plugin
- [ ] Pipeline Plugin
- [ ] GitHub Integration Plugin (Webhook용)

### Phase 3: Jenkins 설정
- [ ] NodeJS 도구 설정 (v20.x)
- [ ] Git Credentials 등록
- [ ] SSH Credentials 등록 (배포용)
- [ ] GitHub Webhook 설정

### Phase 4: Pipeline 생성
- [ ] Jenkinsfile 프로젝트에 추가
- [ ] Pipeline Job 생성
- [ ] 테스트 빌드 실행

### Phase 5: 검증
- [ ] Push → 자동 빌드 확인
- [ ] 배포 성공 확인
- [ ] 롤백 테스트

---

## 4. Jenkins 설치 가이드 (EC2 Ubuntu)

### 4.1 Java 설치
```bash
sudo apt update
sudo apt install -y openjdk-17-jdk
java -version
```

### 4.2 Jenkins 설치
```bash
# Jenkins 저장소 키 추가
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null

# Jenkins 저장소 추가
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

# Jenkins 설치
sudo apt update
sudo apt install -y jenkins

# Jenkins 시작
sudo systemctl start jenkins
sudo systemctl enable jenkins
```

### 4.3 초기 비밀번호 확인
```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

### 4.4 방화벽 설정
```bash
# Jenkins 기본 포트: 8080
sudo ufw allow 8080
```

### 4.5 접속
- 브라우저: `http://<EC2-IP>:8080`
- 초기 비밀번호 입력 → 플러그인 설치 → 관리자 계정 생성

---

## 5. Jenkins 필수 플러그인

Jenkins 관리 → Plugins → Available plugins에서 설치:

| 플러그인 | 용도 |
|---------|------|
| **NodeJS** | Node.js 빌드 환경 |
| **Git** | Git 저장소 연동 |
| **Pipeline** | Jenkinsfile 파이프라인 |
| **SSH Agent** | SSH 키 관리 |
| **GitHub Integration** | GitHub Webhook |
| **Credentials Binding** | 인증 정보 관리 |

---

## 6. Jenkins Credentials 설정

### 6.1 SSH 키 등록 (배포용)
1. Jenkins 관리 → Credentials → System → Global credentials
2. **Add Credentials** 클릭
3. Kind: **SSH Username with private key**
4. 설정:
   - ID: `ec2-ssh-key`
   - Username: `ubuntu` (또는 `ec2-user`)
   - Private Key: Enter directly → PEM 키 내용 붙여넣기

### 6.2 GitHub 토큰 등록 (Private repo인 경우)
1. **Add Credentials** 클릭
2. Kind: **Username with password**
3. 설정:
   - ID: `github-token`
   - Username: GitHub 사용자명
   - Password: Personal Access Token

---

## 7. NodeJS 도구 설정

1. Jenkins 관리 → Tools
2. **NodeJS installations** 섹션
3. **Add NodeJS** 클릭
4. 설정:
   - Name: `NodeJS-20`
   - Version: `NodeJS 20.x`
   - ✅ Install automatically

---

## 8. GitHub Webhook 설정

### 8.1 Jenkins 측
1. Jenkins Job → Configure → Build Triggers
2. ✅ **GitHub hook trigger for GITScm polling** 체크

### 8.2 GitHub 측
1. GitHub 저장소 → Settings → Webhooks
2. **Add webhook** 클릭
3. 설정:
   - Payload URL: `http://<Jenkins-IP>:8080/github-webhook/`
   - Content type: `application/json`
   - Events: **Just the push event**
4. ✅ Active 체크 → **Add webhook**

---

## 9. Pipeline Job 생성

1. Jenkins 메인 → **New Item**
2. 이름: `bandauto-deploy`
3. 타입: **Pipeline** 선택
4. Configure:
   - ✅ GitHub hook trigger for GITScm polling
   - Pipeline → Definition: **Pipeline script from SCM**
   - SCM: Git
   - Repository URL: `https://github.com/YOUR_USERNAME/bandauto.git`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`

---

## 10. Jenkinsfile 설명

```groovy
pipeline {
    agent any

    tools {
        nodejs 'NodeJS-20'  // Jenkins에서 설정한 NodeJS 이름
    }

    stages {
        stage('Checkout')  // 코드 체크아웃
        stage('Install')   // npm ci
        stage('Prisma')    // Prisma 클라이언트 생성
        stage('Build')     // shop-app, sourcing-app 빌드
        stage('Deploy')    // EC2에 SSH 배포
    }
}
```

---

## 11. 배포 변수 설정

Jenkinsfile에서 사용하는 변수들:

```groovy
environment {
    EC2_HOST = 'your-ec2-ip'           // EC2 IP 주소
    EC2_USER = 'ubuntu'                 // SSH 사용자
    PROJECT_PATH = '/home/ubuntu/bandauto'  // 프로젝트 경로
}
```

또는 Jenkins Credentials로 관리:
1. Jenkins 관리 → Credentials
2. Secret text로 각 값 등록
3. Jenkinsfile에서 `credentials()` 함수로 참조

---

## 12. 트러블슈팅

### Jenkins가 시작되지 않음
```bash
sudo systemctl status jenkins
sudo journalctl -u jenkins -f
```

### Node.js를 찾을 수 없음
- Jenkins 관리 → Tools → NodeJS 설정 확인
- Pipeline에서 `tools { nodejs 'NodeJS-20' }` 확인

### SSH 연결 실패
```bash
# Jenkins 서버에서 수동 테스트
ssh -i /path/to/key.pem ubuntu@<EC2-IP>

# EC2 보안그룹에서 Jenkins IP 허용 확인
```

### Webhook이 동작하지 않음
- Jenkins URL이 외부에서 접근 가능한지 확인
- GitHub Webhook → Recent Deliveries에서 응답 확인
- Jenkins 보안 설정 확인 (CSRF 등)

### 빌드 메모리 부족
```bash
# Jenkins JVM 메모리 설정
sudo vim /etc/default/jenkins
JAVA_ARGS="-Xmx2048m"
sudo systemctl restart jenkins
```

---

## 13. 파일 구조 (완료 후)

```
bandauto/
├── Jenkinsfile              # Jenkins Pipeline 정의
├── scripts/
│   ├── deploy.sh            # 배포 스크립트
│   └── rollback.sh          # 롤백 스크립트
├── docs/
│   └── CI_CD_PLAN.md        # 이 문서
├── ecosystem.config.js      # PM2 설정
└── ...
```

---

## 14. 체크리스트 요약

```
[ ] Phase 1: Jenkins 서버 준비
    [ ] Java 17 설치
    [ ] Jenkins 설치 & 시작
    [ ] 방화벽 8080 포트 열기
    [ ] 초기 설정 완료

[ ] Phase 2: 플러그인 설치
    [ ] NodeJS Plugin
    [ ] Git Plugin
    [ ] Pipeline Plugin
    [ ] SSH Agent Plugin

[ ] Phase 3: 설정
    [ ] NodeJS 도구 설정 (v20)
    [ ] SSH Credentials 등록
    [ ] GitHub Webhook 설정

[ ] Phase 4: Pipeline
    [ ] Jenkinsfile 커밋
    [ ] Pipeline Job 생성
    [ ] 테스트 빌드

[ ] Phase 5: 검증
    [ ] 자동 빌드 확인
    [ ] 배포 성공 확인
```

---

*문서 작성일: 2025-12-15*
*버전: 2.0 (Jenkins)*
