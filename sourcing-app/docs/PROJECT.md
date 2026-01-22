# 프로젝트 개요

> **관련 문서:** [STRUCTURE.md](./STRUCTURE.md) | [CLAUDE.md](../CLAUDE.md)

---

## 프로젝트 정보

| 항목 | 값 |
|-----|---|
| 프로젝트명 | BandAuto |
| 설명 | Band 기반 소셜커머스 상품 소싱 및 판매 자동화 플랫폼 |
| 비즈니스 도메인 | 소셜커머스, 상품 소싱, 도매/소매 |
| 아키텍처 유형 | Monorepo |
| 저장소 | https://github.com/ABC-Group-Tech/bandauto |

---

## 기술 스택

### 프론트엔드

| 항목 | 값 |
|-----|---|
| Framework | Next.js 14.2.3 (App Router) |
| Language | TypeScript 5.9 |
| State Management | Zustand 4.5, React Hook Form 7.49 |
| UI Library | Tailwind CSS 3.4, Lucide React |
| Drag & Drop | @dnd-kit 6.3 |
| Charts | Recharts 3.5 |
| Validation | Zod 3.22 |

### 백엔드

| 항목 | 값 |
|-----|---|
| Framework | Next.js API Routes |
| Runtime | Node.js 20.x |
| API Style | REST |
| Authentication | NextAuth.js 4.24 (JWT with jose) |
| Scheduler | node-cron 4.2 |
| Email | Nodemailer 7.0 |
| Browser Automation | Playwright 1.55 |

### 데이터

| 항목 | 값 |
|-----|---|
| ORM | Prisma 6.2 |
| Database | MariaDB |
| Queue | Bull 4.16 (Redis) |
| Excel | exceljs 4.4, xlsx 0.18 |

### 인프라

| 항목 | 값 |
|-----|---|
| Cloud | AWS EC2 |
| Process Manager | PM2 |
| CI/CD | Jenkins |
| Reverse Proxy | Nginx |

### 환경

| 항목 | 값 |
|-----|---|
| Timezone | Asia/Seoul (KST) |
| Package Manager | npm (workspaces) |
| Node Version | 20.x |

---

## 애플리케이션

### Monorepo 구조

| 패키지 | 경로 | 설명 |
|--------|------|-----|
| sourcing-app | `/sourcing-app` | 소싱 관리 앱 (상품 수집, AI 변환, 발행) |
| shop-app | `/shop-app` | 쇼핑몰 앱 (주문, 결제, CS) |
| db | `/db` | 공유 Prisma 클라이언트 (@bandauto/db) |
| band-session-extension | `/band-session-extension` | Chrome 확장프로그램 (Band 세션 수집, 자동 저장, 웹 연동) |

### 포트 설정

| App | Port | 설명 |
|-----|------|-----|
| sourcing-app | 3001 | 소싱 관리 |
| shop-app | 3000 | 쇼핑몰 |

---

## 환경 설정

| 환경 | 용도 | URL |
|-----|-----|-----|
| local | 로컬 개발 | localhost:3000, localhost:3001 |
| prod | 운영 | https://snsauto.abcpharm.net |

---

## 비즈니스 컨텍스트

### 핵심 흐름

1. **수집 (Collection)**: 도매밴드에서 상품 게시물 수집
2. **변환 (Transformation)**: AI를 통한 상품 정보 추출 및 가격 계산
3. **발행 (Publishing)**: 소매밴드로 상품 자동 발행
4. **판매 (Sales)**: 쇼핑몰을 통한 주문 접수 및 결제
5. **정산 (Settlement)**: 판매 대금 정산

### 사용자 역할

| 역할 | 설명 | 주요 기능 |
|-----|-----|---------|
| USER | 회원 | 상품 소싱, 판매 |
| MANAGER | 관리자 | 사용자 관리, 설정 |
| ADMIN | 어드민 | 전체 시스템 관리 |

---

## 도메인 용어집

| 한글 | 영문 | 약어 | 설명 |
|-----|-----|-----|-----|
| 도매채널 | Wholesale Channel | WC | 상품을 수집하는 소스 채널 (도매밴드) |
| 소매채널 | Retail Channel | RC | 상품을 발행하는 대상 채널 (소매밴드) |
| 수집 게시물 | Collected Post | CP | 도매채널에서 수집한 원본 게시물 |
| 수집 상품 | Collected Product | - | 게시물에서 추출한 상품 정보 |
| 상품 | Product | - | AI 변환 완료된 판매 가능 상품 |
| 발행 상품 | Published Product | PP | 소매채널에 발행된 상품 |
| 도매가 | Wholesale Price | - | 도매 원가 |
| 소매가 | Retail Price | - | 판매 가격 |
| 마진 | Margin | - | 소매가 - 도매가 |
| 합배송 | Bundle Shipping | - | 여러 상품을 묶어서 배송비 절약 |
| 워크플로우 | Workflow | WF | 자동화 파이프라인 실행 단위 |

---

## 외부 연동

| 서비스 | 용도 | API |
|--------|------|-----|
| Band Open API | 게시물 조회/작성 | https://openapi.band.us |
| Toss Payments | 결제 처리 | https://api.tosspayments.com |
| Gemini AI | 상품 정보 변환 | Google Generative AI |
| OpenAI | 상품 정보 변환 (대체) | OpenAI API |
