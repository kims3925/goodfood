# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 브랜치 1.3 (개발중)

#### Added - Phase 6: 사이드바 UI 최종 정리
- 사이드바 UI 최종 개선 및 정리
- 사용자 경험 향상을 위한 네비게이션 개선

#### Added - Phase 5: 데이터베이스 스키마 통합
- 소매 밴드, AliExpress, 쇼핑몰 관련 스키마 확장
- 데이터베이스 백업 시스템 구축 (6.9MB 백업 파일)
- Prisma 스키마에 212줄 추가

#### Added - Phase 4: 확장 기능 탭 구조 생성
- 확장 기능 전용 라우트 구조 생성
- 모듈형 확장 시스템 아키텍처 구축

#### Added - Phase 3: AI/알림 설정 시스템 통합
- AI 설정 페이지 대폭 개선 (154줄 → 561줄)
- AI API 테스트 시스템 고도화 (301줄)
- 통합 설정 관리 시스템 구축

#### Added - Phase 2: 게시물 중복 삭제 및 소매 밴드 API 통합
- **소매 밴드 자동 포스팅 시스템** (475줄)
  - `/api/retail/bands/route.ts` - 소매 밴드 관리 (176줄)
  - `/api/retail/posts/route.ts` - 게시물 관리 (192줄)
  - `/api/retail/publish/route.ts` - 자동 발행 (107줄)
- **게시물 중복 관리 시스템** (198줄)
  - `/api/wholesale/posts/duplicates/route.ts` - 중복 감지 및 삭제

#### Added - Phase 1: 밴드 관리 기능 개선
- **확장 기능 - AliExpress 연동** (2,033줄)
  - AliExpress API 통합 (399줄)
  - 상품 수집 및 관리 UI (763줄)
  - API 엔드포인트 (871줄)
- **확장 기능 - 공급업체용 쇼핑몰** (2,184줄)
  - 쇼핑몰 관리 페이지 (1,147줄)
  - 상품/주문 관리 API (1,037줄)
- **도매 밴드 개별 관리 API** (87줄)
  - `/api/wholesale/bands/[id]/route.ts` - CRUD 작업 지원
- **도매 밴드 관리 페이지 개선** (247줄 추가)
  - 향상된 UI/UX 및 필터링 기능

#### Summary
- **총 추가 코드**: +6,094줄
- **총 삭제 코드**: -409줄
- **순증가**: +5,685줄
- **신규 파일**: 31개
- **핵심 기능**: AliExpress 연동, 공급업체용 쇼핑몰, 소매 밴드 자동 포스팅, 게시물 중복 관리

---

## [0.1.0] - 2025-11-10

### Added - v1.3 준비 (main 브랜치 기준)
- 기본 프로젝트 구조 설정
- Next.js 14 App Router 기반 아키텍처
- Prisma ORM + SQLite 데이터베이스 (6개 모델)
- NextAuth.js 인증 시스템
- **도매 밴드 관리 시스템** (100%)
  - 밴드 등록, 수집, 모니터링
  - 가격정책 시스템 (6개 도매방)
- **AI 상품 분석 시스템** (100%)
  - Gemini AI 통합 (873줄)
  - 5단계 자동 분류 (수산/축산/농산/가공품/기타)
  - 20자 고정 제목 생성
  - 배치 병렬 처리 (30개 동시)
- **상품 수집 관리 시스템** (100%)
  - 3뷰 모드 (카드/리스트/테이블)
  - 필터링 및 검색
  - 소싱 확정 기능
  - 일괄 처리
- **API 시스템** (15개 엔드포인트)
- **UI 컴포넌트** (Tailwind CSS + shadcn/ui)

### Technical Details
- **Frontend**: Next.js 14, React 18, Tailwind CSS, shadcn/ui, Zustand
- **Backend**: Next.js API Routes, Prisma ORM, SQLite
- **AI**: Google Gemini API
- **Automation**: Playwright (준비 완료)
- **Forms**: React Hook Form + Zod
- **Authentication**: NextAuth.js

### Database Schema
- User (사용자 정보)
- WholesaleBand (도매 밴드 + 가격정책)
- CollectedPost (수집 게시물 + AI 분석)
- Product (소싱 확정 상품)
- Customer (고객 정보)
- Order (주문 정보)

### Infrastructure
- 개발 서버 자동 포트 정리 (3000-3010)
- E2E 테스트 환경 (Playwright)
- 데이터베이스 시드 스크립트
- 환경 변수 관리 (.env.local)

---

## 가격정책 시스템

### 지원되는 도매방 (6개)

#### 1. 가족도매방
```
정책: 판매가는 원가 그대로, 공급가는 90%
예시: 원가 10,000원 → 판매가 10,000원, 공급가 9,000원
```

#### 2. 요한이네♧소매방
```
정책: 수집가격 기준 구간별 마진 적용
- 19,900원 이하: +1,000원
- 20,000~29,900원: +2,000원
- 30,000~39,900원: +3,000원
- 40,000~49,900원: +4,000원
- 50,000~59,900원: +5,000원
- 60,001원 이상: +6,000원
공급가: 최종가의 90%
```

#### 3. 초록이네
```
정책: 요한이네와 동일
```

#### 4. 나은 상품 공급방
```
정책: 공급가와 배송비 분리, 공급가에만 마진 적용
- 공급가 19,900원까지: +4,000원
- 초과 시: +4,000원 + (초과구간/10,000원 × 1,000원)
예시: 공급가 25,000원 + 무료배송 → 30,000원
```

#### 5. S D 푸드
```
정책: 나은 상품 공급방과 동일
특징: 댓글에 배송비 정보 포함
```

#### 6. 폐쇄몰VIP도매
```
정책: 나은 상품 공급방과 동일
```

---

[Unreleased]: https://github.com/ABC-Group-Tech/bandauto/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ABC-Group-Tech/bandauto/releases/tag/v0.1.0
